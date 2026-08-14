-- Migración para arreglar el trigger check_invitation_role y permitir superadmins

CREATE OR REPLACE FUNCTION public.check_invitation_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_is_superadmin BOOLEAN;
BEGIN
  -- Un admin no puede invitar a un owner
  IF NEW.role = 'owner' THEN
    -- Check if user is superadmin
    SELECT public.is_platform_admin(auth.uid()) INTO v_is_superadmin;

    IF NOT v_is_superadmin THEN
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_id = NEW.organization_id
            AND user_id = auth.uid()
            AND role = 'owner'
            AND status = 'active'
        ) INTO v_is_owner;
        
        IF NOT v_is_owner THEN
          RAISE EXCEPTION 'Solo un Dueño de Centro puede invitar a otro Dueño de Centro';
        END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
