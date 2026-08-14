-- Migración para actualizar la tabla de suscripciones y agregar control de pagos

BEGIN;

-- 1. Modificar Constraint de Estado de Suscripción para admitir nuevos estados
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled'));

-- 2. Añadir columnas de control de Trial a subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN trial_start TIMESTAMPTZ,
ADD COLUMN trial_end TIMESTAMPTZ;

-- 3. Crear tabla de pagos
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Solo los Superadmins pueden leer y registrar pagos globales (o dueños de sus propios pagos si lo requerimos luego)
-- Por ahora lo mantenemos blindado, usaremos RPCs con SECURITY DEFINER para que el admin interactúe.
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT TO authenticated USING (
  public.is_platform_admin(auth.uid())
);
CREATE POLICY "Owners can view own payments" ON public.payments FOR SELECT TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
);

-- 4. Función segura (RPC) para registrar un pago
CREATE OR REPLACE FUNCTION public.superadmin_register_payment(
  p_org_id UUID,
  p_amount NUMERIC(10,2),
  p_reference TEXT,
  p_notes TEXT
) RETURNS UUID AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_payment_id UUID;
BEGIN
  -- Verificar Superadmin
  SELECT public.is_platform_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo un administrador puede registrar pagos.';
  END IF;

  -- Insertar el pago
  INSERT INTO public.payments (organization_id, amount, reference, notes, status)
  VALUES (p_org_id, p_amount, p_reference, p_notes, 'completed')
  RETURNING id INTO v_payment_id;

  -- Actualizar el estado de la suscripción a activo automáticamente
  UPDATE public.subscriptions 
  SET status = 'active', updated_at = NOW()
  WHERE organization_id = p_org_id;

  -- Registrar en auditoría
  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (p_org_id, auth.uid(), 'register_payment', 'payments', v_payment_id);

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
