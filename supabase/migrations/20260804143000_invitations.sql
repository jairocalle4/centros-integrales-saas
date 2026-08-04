-- Creación de la tabla de invitaciones segura

CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.organization_role NOT NULL DEFAULT 'staff',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- Habilitar RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas para invitaciones
-- Los miembros pueden ver las invitaciones de su organización
CREATE POLICY "Members can view invitations"
ON public.invitations
FOR SELECT TO authenticated
USING (
    public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);

-- Solo owners y admins pueden invitar (INSERT)
CREATE POLICY "Admins and Owners can create invitations"
ON public.invitations
FOR INSERT TO authenticated
WITH CHECK (
    public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
    AND invited_by = auth.uid()
);

-- Nadie puede invitar a un owner excepto un owner
-- Ya tenemos políticas, pero podemos añadir un trigger o función para asegurarnos de que los admins no inviten owners
CREATE OR REPLACE FUNCTION public.check_invitation_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  -- Un admin no puede invitar a un owner
  IF NEW.role = 'owner' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = NEW.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'Solo un owner puede invitar a otro owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_admin_inviting_owner
BEFORE INSERT ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.check_invitation_role();

-- Permisos mínimos
GRANT SELECT, INSERT ON TABLE public.invitations TO authenticated;
