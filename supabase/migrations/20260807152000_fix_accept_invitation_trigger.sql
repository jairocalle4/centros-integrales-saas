-- Migración para arreglar el trigger check_member_management en la aceptación de invitaciones

CREATE OR REPLACE FUNCTION public.check_member_management()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_owner BOOLEAN;
  owner_count INT;
BEGIN
  -- Permitir bypass desde funciones seguras (como accept_invitation)
  IF current_setting('app.bypassing_role_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    is_owner := public.has_organization_role(NEW.organization_id, ARRAY['owner']::public.organization_role[]);
    IF NEW.role = 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Solo un owner puede asignar el rol de owner';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    is_owner := public.has_organization_role(OLD.organization_id, ARRAY['owner']::public.organization_role[]);
    IF OLD.role = 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Admin no puede modificar a un owner';
    END IF;
    IF NEW.role = 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Solo un owner puede asignar el rol de owner';
    END IF;
    IF OLD.role = 'owner' AND (NEW.status = 'inactive' OR NEW.role != 'owner') THEN
      SELECT COUNT(*) INTO owner_count FROM public.organization_members
      WHERE organization_id = OLD.organization_id AND role = 'owner' AND status = 'active' AND id != OLD.id;
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'La organización debe tener al menos un owner activo';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    is_owner := public.has_organization_role(OLD.organization_id, ARRAY['owner']::public.organization_role[]);
    IF OLD.role = 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Admin no puede eliminar a un owner';
    END IF;
    IF OLD.role = 'owner' THEN
      SELECT COUNT(*) INTO owner_count FROM public.organization_members
      WHERE organization_id = OLD.organization_id AND role = 'owner' AND status = 'active' AND id != OLD.id;
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'La organización debe tener al menos un owner activo';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


-- Modificar accept_invitation para usar el bypass
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
        RAISE EXCEPTION 'No autenticado';
    END IF;

    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'No se encontró el correo del usuario';
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
        UPDATE public.invitations SET status = 'expired' WHERE id = v_invitation.id;
        RAISE EXCEPTION 'La invitación ha caducado';
    END IF;

    -- 5. Comprobar que el correo coincide
    IF v_invitation.email != v_user_email THEN
        RAISE EXCEPTION 'El correo de la invitación no coincide con tu usuario autenticado';
    END IF;

    -- 6. Insertar membresía (saltando el trigger usando la variable de sesión)
    PERFORM set_config('app.bypassing_role_trigger', 'true', true);

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
