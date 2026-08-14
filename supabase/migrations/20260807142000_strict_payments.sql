-- Migración para refactorizar pagos estrictos e inteligencia de fechas

BEGIN;

-- 1. Añadir el ciclo de facturación a la tabla de pagos
ALTER TABLE public.payments ADD COLUMN billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual'));

-- 2. Reescribir la función de pagos para que sea inteligente y estricta
CREATE OR REPLACE FUNCTION public.superadmin_register_payment(
  p_org_id UUID,
  p_amount NUMERIC(10,2),
  p_billing_cycle TEXT,
  p_reference TEXT,
  p_notes TEXT
) RETURNS UUID AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_payment_id UUID;
  v_sub RECORD;
  v_plan RECORD;
  v_expected_amount NUMERIC(10,2);
  v_new_period_end TIMESTAMPTZ;
  v_interval INTERVAL;
BEGIN
  -- 1. Verificar Superadmin
  SELECT public.is_platform_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo un administrador puede registrar pagos.';
  END IF;

  -- 2. Validar Ciclo
  IF p_billing_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'El ciclo de facturación debe ser "monthly" o "annual"';
  END IF;

  -- 3. Obtener suscripción y plan
  SELECT * INTO v_sub FROM public.subscriptions WHERE organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El centro no tiene una suscripción configurada.';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan asociado a este centro no existe.';
  END IF;

  -- 4. Validar monto exacto
  IF p_billing_cycle = 'monthly' THEN
    v_expected_amount := v_plan.price_monthly;
    v_interval := '1 month'::interval;
  ELSE
    v_expected_amount := v_plan.price_annual;
    v_interval := '1 year'::interval;
  END IF;

  IF p_amount != v_expected_amount THEN
    RAISE EXCEPTION 'Pago rechazado: El monto ingresado ($%) no coincide con el precio exacto del plan ($%) para el ciclo %.', p_amount, v_expected_amount, p_billing_cycle;
  END IF;

  -- 5. Calcular nueva fecha de vencimiento inteligente
  -- Si estaba activo y no estaba vencido, sumamos al final del periodo (pago adelantado sin perder días)
  IF v_sub.status = 'active' AND v_sub.current_period_end > NOW() THEN
    v_new_period_end := v_sub.current_period_end + v_interval;
  ELSE
    -- Si estaba suspendido, vencido, cancelado, o en prueba, cuenta a partir de HOY
    v_new_period_end := NOW() + v_interval;
  END IF;

  -- 6. Insertar el pago histórico
  INSERT INTO public.payments (organization_id, amount, billing_cycle, reference, notes, status)
  VALUES (p_org_id, p_amount, p_billing_cycle, p_reference, p_notes, 'completed')
  RETURNING id INTO v_payment_id;

  -- 7. Actualizar el estado de la suscripción y su fecha de vencimiento
  UPDATE public.subscriptions 
  SET 
    status = 'active', 
    current_period_end = v_new_period_end,
    updated_at = NOW()
  WHERE organization_id = p_org_id;

  -- 8. Registrar en auditoría
  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (p_org_id, auth.uid(), 'register_payment_strict', 'payments', v_payment_id);

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
