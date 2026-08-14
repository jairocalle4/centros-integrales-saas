-- Migración: Corrección de Superadmins y Traducción de errores para create_invitation

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
        RAISE EXCEPTION 'No autenticado';
    END IF;

    -- 2. Normalizar correo
    v_normalized_email := lower(trim(p_email));
    IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'Correo electrónico inválido';
    END IF;

    -- 3. Comprobar membresía y rol del invitador
    SELECT role INTO v_inviter_role 
    FROM public.organization_members 
    WHERE organization_id = p_organization_id 
      AND user_id = v_inviter_id 
      AND status = 'active';

    -- Permiso de Superadmin (by-pass total)
    IF NOT public.is_platform_admin(v_inviter_id) THEN
        IF v_inviter_role IS NULL OR v_inviter_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'No tienes permiso para invitar usuarios a este centro';
        END IF;

        -- 4. Validar rol destino: un admin no puede invitar a un owner
        IF v_inviter_role = 'admin' AND p_role = 'owner' THEN
            RAISE EXCEPTION 'Un Administrador no puede invitar a un Dueño de Centro';
        END IF;
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
        RAISE EXCEPTION 'El usuario ya es miembro de este centro';
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

    -- 8. Auditar
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (p_organization_id, v_inviter_id, 'create_invitation', 'invitations', p_organization_id);

    -- 9. Retornar el token plano para que la Edge Function envíe el email
    RETURN v_token;
END;
$$;

-- Asegurar permisos
REVOKE EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, public.organization_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, public.organization_role) TO authenticated;
