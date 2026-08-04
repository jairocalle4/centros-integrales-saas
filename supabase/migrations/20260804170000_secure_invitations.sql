-- 1. Modificar tabla invitations
ALTER TABLE public.invitations ADD COLUMN token_hash TEXT;
-- Como ya hay datos (quizás), permitimos temporalmente nulos, luego lo hacemos NOT NULL? No hay datos reales en dev.
DELETE FROM public.invitations;
ALTER TABLE public.invitations ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE public.invitations ADD COLUMN accepted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.invitations ADD COLUMN accepted_at TIMESTAMPTZ;

-- 2. Eliminar permiso de INSERT directo para el frontend
DROP POLICY IF EXISTS "Admins and Owners can create invitations" ON public.invitations;

-- Asegurar que la extensión pgcrypto esté habilitada para digest y gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. RPC: create_invitation
-- Solo será llamada desde la Edge Function, pero para asegurar, podemos dejarla accesible a authenticated (la Edge Function usará su JWT o el service_role pero suplantando el JWT).
-- La Edge Function invocará esto con supabase.rpc() con el JWT del usuario.
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_organization_id UUID,
    p_email TEXT,
    p_role public.organization_role
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inviter_id UUID;
    v_inviter_role public.organization_role;
    v_normalized_email TEXT;
    v_token TEXT;
    v_token_hash TEXT;
    v_existing_id UUID;
BEGIN
    -- 1. Obtener invitador
    v_inviter_id := auth.uid();
    IF v_inviter_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Normalizar correo
    v_normalized_email := lower(trim(p_email));
    IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'Correo inválido';
    END IF;

    -- 3. Comprobar membresía y rol del invitador
    SELECT role INTO v_inviter_role 
    FROM public.organization_members 
    WHERE organization_id = p_organization_id 
      AND user_id = v_inviter_id 
      AND status = 'active';

    IF v_inviter_role IS NULL OR v_inviter_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'No tienes permiso para invitar en esta organización';
    END IF;

    -- 4. Validar rol destino: un admin no puede invitar a un owner
    IF v_inviter_role = 'admin' AND p_role = 'owner' THEN
        RAISE EXCEPTION 'Un administrador no puede invitar a un owner';
    END IF;

    -- 5. Evitar invitaciones pendientes duplicadas
    SELECT id INTO v_existing_id
    FROM public.invitations
    WHERE organization_id = p_organization_id
      AND email = v_normalized_email
      AND status = 'pending'
      AND expires_at > now();

    IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este correo';
    END IF;

    -- Comprobar si ya es miembro
    IF EXISTS (
        SELECT 1 
        FROM public.organization_members m
        JOIN auth.users u ON m.user_id = u.id
        WHERE m.organization_id = p_organization_id
          AND u.email = v_normalized_email
    ) THEN
        RAISE EXCEPTION 'El usuario ya es miembro de esta organización';
    END IF;

    -- 6. Generar token de alta entropía (64 caracteres hex)
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    -- Guardar solo el hash (SHA256)
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    -- 7. Insertar invitación
    INSERT INTO public.invitations (
        organization_id, 
        email, 
        role, 
        invited_by, 
        status, 
        token_hash, 
        expires_at
    ) VALUES (
        p_organization_id,
        v_normalized_email,
        p_role,
        v_inviter_id,
        'pending',
        v_token_hash,
        now() + interval '7 days'
    );

    -- 8. Registrar en auditoría
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (p_organization_id, v_inviter_id, 'create_invitation', 'invitations', p_organization_id);

    -- 9. Devolver el token (una sola vez)
    RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, public.organization_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, public.organization_role) TO authenticated;


-- 4. RPC: accept_invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(
    p_token TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_token_hash TEXT;
    v_invitation RECORD;
BEGIN
    -- 1. Exigir usuario autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Obtener el email autenticado desde el JWT (o la tabla users, pero el JWT es seguro si se lee bien, 
    -- y auth.jwt()->>'email' es el estándar. También podemos buscar en auth.users)
    -- Por seguridad extrema usamos auth.users (al ser SECURITY DEFINER lo puede leer)
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'User email not found';
    END IF;

    v_user_email := lower(trim(v_user_email));

    -- 2. Localizar invitación y bloquear fila
    v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE token_hash = v_token_hash
    FOR UPDATE SKIP LOCKED;

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada o ya está siendo procesada';
    END IF;

    -- 3. Comprobar estado
    IF v_invitation.status != 'pending' THEN
        RAISE EXCEPTION 'La invitación ya no está pendiente (estado: %)', v_invitation.status;
    END IF;

    -- 4. Comprobar expiración
    IF v_invitation.expires_at < now() THEN
        -- Opcional: Marcar como expirada
        UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
        RAISE EXCEPTION 'La invitación ha caducado';
    END IF;

    -- 5. Comprobar que el correo coincide
    IF v_invitation.email != v_user_email THEN
        RAISE EXCEPTION 'El correo de la invitación no coincide con tu usuario autenticado';
    END IF;

    -- 6. Insertar membresía de forma exclusiva (si no existía)
    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_invitation.organization_id, v_user_id, v_invitation.role, 'active')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- 7. Marcar invitación como aceptada
    UPDATE public.invitations
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    WHERE id = v_invitation.id;

    -- 8. Auditoría
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (v_invitation.organization_id, v_user_id, 'accept_invitation', 'invitations', v_invitation.id);

    RETURN v_invitation.organization_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
