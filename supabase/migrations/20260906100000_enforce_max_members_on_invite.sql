-- ============================================================
-- Hallazgo real del usuario: nada en el sistema comparaba el número de
-- integrantes de un centro contra max_members de su plan. Verificado
-- contra el código real de create_invitation, accept_invitation y el
-- trigger check_member_management — ninguno lo hacía. Un centro en
-- Plan Básico (max_members = 1) podía invitar y aceptar integrantes
-- sin límite.
--
-- Se agrega el candado en create_invitation (el punto más temprano
-- posible — el usuario se entera al invitar, no cuando el invitado ya
-- aceptó). Cuenta miembros activos + invitaciones pendientes no
-- vencidas, para que no se puedan mandar más invitaciones de las que
-- caben aunque ninguna se haya aceptado todavía. max_members = 0
-- sigue significando "ilimitado" (mismo criterio que ya usa la UI de
-- superadmin: "Max Miembros (0 = Ilimitado)").
--
-- Aplica también cuando invita un superadmin (is_platform_admin) — es
-- un límite del plan del cliente, no un permiso de quién invita; si
-- alguna vez hace falta que un superadmin lo pueda saltar para dar
-- soporte, se agrega aparte, a propósito, no por default.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_invitation(p_organization_id uuid, p_email text, p_role organization_role)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_inviter_id UUID;
    v_inviter_role public.organization_role;
    v_normalized_email TEXT;
    v_token TEXT;
    v_token_hash TEXT;
    v_existing_id UUID;
    v_max_members INTEGER;
    v_current_count INTEGER;
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

    -- 4.5 Límite de integrantes del plan comercial del centro. 0 = ilimitado.
    SELECT sp.max_members INTO v_max_members
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.organization_id = p_organization_id;

    IF v_max_members IS NOT NULL AND v_max_members > 0 THEN
        SELECT
            (SELECT count(*) FROM public.organization_members
              WHERE organization_id = p_organization_id AND status = 'active')
            +
            (SELECT count(*) FROM public.invitations
              WHERE organization_id = p_organization_id AND status = 'pending' AND expires_at > now())
        INTO v_current_count;

        IF v_current_count >= v_max_members THEN
            RAISE EXCEPTION 'Tu plan permite hasta % integrante(s) y ya llegaste al límite (contando invitaciones pendientes). Cancela una invitación pendiente, quita a alguien inactivo, o sube de plan.', v_max_members;
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
$function$;
