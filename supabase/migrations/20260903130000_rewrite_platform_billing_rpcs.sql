-- ============================================================
-- Reescribe superadmin_assign_plan y superadmin_register_payment para
-- que la asignación de un plan genere el cargo pendiente correcto
-- (platform_charges), y que pagarlo avance current_period_end y genere
-- automáticamente el siguiente cargo pendiente — todo disparado por
-- una acción explícita del superadmin, sin ningún cron/proceso en
-- segundo plano (mismo principio ya establecido en todo el repo).
--
-- IMPORTANTE: CREATE OR REPLACE FUNCTION con una firma de parámetros
-- distinta NO reemplaza la versión vieja — Postgres identifica una
-- función por nombre+tipos de argumentos, así que quedarían dos
-- overloads coexistiendo (y PostgREST puede fallar con "Could not
-- choose the best candidate function"). De hecho ya existía este
-- problema en el propio repo: superadmin_register_payment tenía DOS
-- versiones desplegadas simultáneamente (la original de 4 parámetros
-- de 20260807140000_payments_and_trials.sql, nunca eliminada cuando
-- 20260807142000_strict_payments.sql agregó la de 5 con
-- billing_cycle). Se eliminan explícitamente las 3 firmas reales
-- verificadas contra pg_proc antes de escribir esta migración.
-- ============================================================

DROP FUNCTION IF EXISTS public.superadmin_assign_plan(uuid, uuid);
DROP FUNCTION IF EXISTS public.superadmin_register_payment(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public.superadmin_register_payment(uuid, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.superadmin_assign_plan(
  p_org_id UUID,
  p_plan_id UUID,
  p_billing_cycle TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub_exists BOOLEAN;
  v_plan       RECORD;
  v_amount     NUMERIC(10,2);
  v_sub        RECORD;
  v_due_date   TIMESTAMPTZ;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Superadmin';
  END IF;

  IF p_billing_cycle NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'El ciclo de facturación debe ser "monthly" o "annual"';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan seleccionado no existe.';
  END IF;
  v_amount := CASE WHEN p_billing_cycle = 'monthly' THEN v_plan.price_monthly ELSE v_plan.price_annual END;

  SELECT * INTO v_sub FROM public.subscriptions WHERE organization_id = p_org_id;
  v_sub_exists := FOUND;

  IF v_sub_exists THEN
    UPDATE public.subscriptions
       SET plan_id = p_plan_id, billing_cycle = p_billing_cycle, updated_at = NOW()
     WHERE organization_id = p_org_id;

    -- Si ya hay un período pagado vigente, el nuevo precio aplica recién
    -- en la próxima renovación (sin prorrateo — mismo criterio que ya
    -- usa el registro de pago para decidir desde cuándo cuenta el período).
    IF v_sub.status = 'active' AND v_sub.current_period_end > NOW() THEN
      v_due_date := v_sub.current_period_end;
    ELSE
      v_due_date := NOW();
    END IF;
  ELSE
    INSERT INTO public.subscriptions (organization_id, plan_id, billing_cycle, status)
    VALUES (p_org_id, p_plan_id, p_billing_cycle, 'trialing');
    v_due_date := NOW();
  END IF;

  -- Cambiar de plan/ciclo invalida lo que se le debía cobrar antes: nunca
  -- deben coexistir dos cargos "pending" (lo blinda además el índice
  -- único parcial idx_platform_charges_one_pending_per_org).
  UPDATE public.platform_charges
     SET status = 'void', updated_at = NOW()
   WHERE organization_id = p_org_id AND status = 'pending';

  INSERT INTO public.platform_charges (organization_id, plan_id, billing_cycle, amount, due_date, status, period_label)
  VALUES (p_org_id, p_plan_id, p_billing_cycle, v_amount, v_due_date, 'pending', to_char(v_due_date, 'YYYY-MM'));

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (p_org_id, auth.uid(), 'superadmin_assign_plan', 'subscriptions', p_org_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.superadmin_assign_plan(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_assign_plan(UUID, UUID, TEXT) TO authenticated;

-- Deja de recibir monto/ciclo a mano (elimina de raíz la clase de error
-- que la validación estricta anterior combatía: ya no hay monto que
-- teclear mal, se deriva del cargo mismo). FOR UPDATE evita que un
-- doble clic en "Confirmar Pago" genere doble pago/doble "siguiente
-- cargo" para el mismo cargo pendiente — protección de carrera que no
-- existía antes.
CREATE OR REPLACE FUNCTION public.superadmin_register_payment(
  p_org_id UUID,
  p_charge_id UUID,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_charge         RECORD;
  v_sub            RECORD;
  v_plan           RECORD;
  v_interval       INTERVAL;
  v_new_period_end TIMESTAMPTZ;
  v_next_amount    NUMERIC(10,2);
  v_payment_id     UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso denegado. Solo un administrador puede registrar pagos.';
  END IF;

  SELECT * INTO v_charge FROM public.platform_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cargo indicado no existe.';
  END IF;
  IF v_charge.organization_id != p_org_id THEN
    RAISE EXCEPTION 'El cargo no corresponde a este centro.';
  END IF;
  IF v_charge.status != 'pending' THEN
    RAISE EXCEPTION 'Este cargo ya fue pagado o anulado.';
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions WHERE organization_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El centro no tiene una suscripción configurada.';
  END IF;

  v_interval := CASE WHEN v_charge.billing_cycle = 'monthly' THEN '1 month'::interval ELSE '1 year'::interval END;

  IF v_sub.status = 'active' AND v_sub.current_period_end > NOW() THEN
    v_new_period_end := v_sub.current_period_end + v_interval;
  ELSE
    v_new_period_end := NOW() + v_interval;
  END IF;

  INSERT INTO public.payments (organization_id, amount, billing_cycle, reference, notes, status, charge_id)
  VALUES (p_org_id, v_charge.amount, v_charge.billing_cycle, p_reference, p_notes, 'completed', v_charge.id)
  RETURNING id INTO v_payment_id;

  UPDATE public.platform_charges SET status = 'paid', updated_at = NOW() WHERE id = v_charge.id;

  UPDATE public.subscriptions
     SET status = 'active', current_period_end = v_new_period_end, updated_at = NOW()
   WHERE organization_id = p_org_id;

  -- Siguiente cargo pendiente, al precio VIGENTE del plan (por si cambió
  -- desde la última renovación) — nunca copiando v_charge.amount a ciegas.
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_sub.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El plan asociado a este centro ya no existe.';
  END IF;
  v_next_amount := CASE WHEN v_sub.billing_cycle = 'monthly' THEN v_plan.price_monthly ELSE v_plan.price_annual END;

  INSERT INTO public.platform_charges (organization_id, plan_id, billing_cycle, amount, due_date, status, period_label)
  VALUES (p_org_id, v_sub.plan_id, v_sub.billing_cycle, v_next_amount, v_new_period_end, 'pending', to_char(v_new_period_end, 'YYYY-MM'));

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (p_org_id, auth.uid(), 'register_payment_strict', 'payments', v_payment_id);

  RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.superadmin_register_payment(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_register_payment(UUID, UUID, TEXT, TEXT) TO authenticated;
