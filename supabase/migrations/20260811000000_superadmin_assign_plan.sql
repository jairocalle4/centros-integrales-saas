-- Migration: RPC to assign/change plan for an organization
-- Also adds unique constraint on organization_id to subscriptions

-- 1. Add unique constraint (prevent double subscriptions per org)
ALTER TABLE public.subscriptions 
  ADD CONSTRAINT subscriptions_organization_id_unique UNIQUE (organization_id);

-- 2. Superadmin function to assign or change plan
CREATE OR REPLACE FUNCTION public.superadmin_assign_plan(
  p_org_id UUID,
  p_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Superadmin';
  END IF;

  -- Check if a subscription already exists
  SELECT status INTO v_current_status
    FROM public.subscriptions
   WHERE organization_id = p_org_id;

  IF FOUND THEN
    -- Update plan only; keep the current status so it doesn't unlock automatically
    UPDATE public.subscriptions
       SET plan_id    = p_plan_id,
           updated_at = NOW()
     WHERE organization_id = p_org_id;
  ELSE
    -- Create a fresh trialing subscription
    INSERT INTO public.subscriptions (organization_id, plan_id, status)
    VALUES (p_org_id, p_plan_id, 'trialing');
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (p_org_id, auth.uid(), 'superadmin_assign_plan', 'subscriptions', p_org_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.superadmin_assign_plan(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.superadmin_assign_plan(UUID, UUID) TO authenticated;
