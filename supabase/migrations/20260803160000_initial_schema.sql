-- Migración Inicial: Plataforma NexoKids

-- Tipos Enum
CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'professional', 'staff');

-- Tabla: profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: organization_members
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

-- Tabla: subscription_plans
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_members INT,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: audit_logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Enable
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Función segura para verificar permisos sin recursión
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

-- Función para impedir escalamiento de privilegios
CREATE OR REPLACE FUNCTION public.check_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el creador no es un owner, no puede crear/actualizar un usuario a owner
  IF NEW.role = 'owner' AND NOT public.has_organization_role(NEW.organization_id, ARRAY['owner']::public.organization_role[]) THEN
    RAISE EXCEPTION 'Solo un owner puede asignar el rol de owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_escalation
BEFORE INSERT OR UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.check_role_escalation();

-- Políticas: profiles (Un usuario puede leer y editar su propio perfil)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas: organizations
CREATE POLICY "Members can view their organization" ON public.organizations FOR SELECT USING (
  public.has_organization_role(id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);
CREATE POLICY "Owners and admins can update their organization" ON public.organizations FOR UPDATE USING (
  public.has_organization_role(id, ARRAY['owner','admin']::public.organization_role[])
);

-- Políticas: organization_members
CREATE POLICY "Members can view members of their organization" ON public.organization_members FOR SELECT USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);
CREATE POLICY "Admins and Owners can manage members" ON public.organization_members FOR ALL USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);

-- Políticas: subscription_plans (Catálogo de solo lectura público para autenticados)
CREATE POLICY "Anyone authenticated can view plans" ON public.subscription_plans FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas: subscriptions
CREATE POLICY "Members can view their subscriptions" ON public.subscriptions FOR SELECT USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);

-- Políticas: audit_logs
CREATE POLICY "Admins and Owners can view audit logs" ON public.audit_logs FOR SELECT USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
);
