-- Migración para obtener detalles de la organización (usuarios e invitaciones)

CREATE OR REPLACE FUNCTION public.get_organization_users(
    p_organization_id UUID
) RETURNS TABLE (
    id UUID,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    role public.organization_role,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_platform_admin(auth.uid()) AND NOT public.has_organization_role(p_organization_id, ARRAY['owner','admin']::public.organization_role[]) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        COALESCE(p.first_name, ''),
        COALESCE(p.last_name, ''),
        u.email::TEXT,
        om.role,
        om.status,
        om.created_at
    FROM public.organization_members om
    JOIN auth.users u ON om.user_id = u.id
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE om.organization_id = p_organization_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_organization_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_users(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_organization_invitations(
    p_organization_id UUID
) RETURNS TABLE (
    id UUID,
    email TEXT,
    role public.organization_role,
    status TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_platform_admin(auth.uid()) AND NOT public.has_organization_role(p_organization_id, ARRAY['owner','admin']::public.organization_role[]) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    RETURN QUERY
    SELECT 
        i.id,
        i.email,
        i.role,
        i.status,
        i.expires_at,
        i.created_at
    FROM public.invitations i
    WHERE i.organization_id = p_organization_id
    ORDER BY i.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_organization_invitations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_invitations(UUID) TO authenticated;


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

    UPDATE public.invitations SET status = 'cancelled' WHERE id = p_invitation_id AND status = 'pending';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_invitation(UUID) TO authenticated;
