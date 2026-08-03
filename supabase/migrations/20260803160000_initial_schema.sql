-- Migración Inicial: Plataforma NexoKids

CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'professional', 'staff');

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_members INT,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_organization_role(org_id UUID, required_roles public.organization_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = ANY(required_roles)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_organization_role(UUID, public.organization_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_organization_role(UUID, public.organization_role[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_member_management()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner BOOLEAN;
  owner_count INT;
BEGIN
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
        RAISE EXCEPTION 'No se puede degradar ni desactivar al último owner';
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    is_owner := public.has_organization_role(OLD.organization_id, ARRAY['owner']::public.organization_role[]);
    IF OLD.role = 'owner' AND NOT is_owner THEN
      RAISE EXCEPTION 'Admin no puede eliminar a un owner';
    END IF;
    IF OLD.role = 'owner' AND OLD.status = 'active' THEN
      SELECT COUNT(*) INTO owner_count FROM public.organization_members
      WHERE organization_id = OLD.organization_id AND role = 'owner' AND status = 'active' AND id != OLD.id;
      IF owner_count = 0 THEN
        RAISE EXCEPTION 'No se puede eliminar al último owner';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_member_management() FROM PUBLIC;

CREATE TRIGGER prevent_role_escalation
BEFORE INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.check_member_management();

-- Políticas: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Políticas: organizations
CREATE POLICY "Members can view their organization" ON public.organizations FOR SELECT TO authenticated USING (
  public.has_organization_role(id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);
CREATE POLICY "Owners and admins can update their organization" ON public.organizations FOR UPDATE TO authenticated USING (
  public.has_organization_role(id, ARRAY['owner','admin']::public.organization_role[])
) WITH CHECK (
  public.has_organization_role(id, ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "Owners and admins can insert organization" ON public.organizations FOR INSERT TO authenticated WITH CHECK (
  true -- The first org creation might be complex, we allow authenticated to create. The trigger assigns them as owner (out of scope for this schema, usually done via Edge function).
);

-- Políticas: organization_members
CREATE POLICY "Members can view members of their organization" ON public.organization_members FOR SELECT TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);
CREATE POLICY "Admins and Owners can insert members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "Admins and Owners can update members" ON public.organization_members FOR UPDATE TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
) WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "Admins and Owners can delete members" ON public.organization_members FOR DELETE TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);

-- Políticas: subscription_plans
CREATE POLICY "Anyone authenticated can view plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);

-- Políticas: subscriptions
CREATE POLICY "Members can view their subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);

-- Políticas: audit_logs (Solo lectura, inserción por servidor)
CREATE POLICY "Admins and Owners can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);
-- No se permite INSERT a authenticated. Se reserva a service_role.
