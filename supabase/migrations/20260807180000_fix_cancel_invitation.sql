CREATE OR REPLACE FUNCTION public.cancel_invitation(
    p_invitation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id FROM public.invitations WHERE id = p_invitation_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada';
    END IF;

    IF NOT public.is_platform_admin(auth.uid()) AND NOT public.has_organization_role(v_org_id, ARRAY['owner','admin']::public.organization_role[]) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    -- Eliminamos la invitación pendiente para no violar el check constraint
    DELETE FROM public.invitations WHERE id = p_invitation_id AND status = 'pending';
END;
$$;
