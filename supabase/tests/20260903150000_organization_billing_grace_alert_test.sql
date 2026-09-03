-- ============================================================
-- get_organization_billing_alert(): el dueño de un centro con un cargo
-- de plataforma vencido ve is_overdue=true y el días_restantes correcto
-- (mismo punto de corte que enforce_payment_grace_period); el dueño de
-- un centro sin cargos vencidos ve is_overdue=false; cualquiera que NO
-- sea el dueño de ese centro (ni un miembro con otro rol, ni el dueño
-- de otro centro) es rechazado. Self-contained, ROLLBACK al final —
-- nunca corre contra datos reales.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(6);

DO $$
DECLARE
  v_owner_overdue UUID := gen_random_uuid();
  v_owner_current UUID := gen_random_uuid();
  v_staff_overdue UUID := gen_random_uuid();
  v_org_overdue   UUID := gen_random_uuid();
  v_org_current   UUID := gen_random_uuid();
  v_plan UUID;
  v_grace_days INTEGER := 12;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_owner_overdue, 'owner_overdue@billingalert.test'),
    (v_owner_current, 'owner_current@billingalert.test'),
    (v_staff_overdue, 'staff_overdue@billingalert.test');
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'Overdue' WHERE id = v_owner_overdue;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'Current' WHERE id = v_owner_current;
  UPDATE public.profiles SET first_name = 'Staff', last_name = 'Overdue' WHERE id = v_staff_overdue;

  INSERT INTO public.organizations (id, name) VALUES
    (v_org_overdue, 'Org Overdue - billing alert test'),
    (v_org_current, 'Org Current - billing alert test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (v_org_overdue, v_owner_overdue, 'owner', 'active'),
    (v_org_overdue, v_staff_overdue, 'staff', 'active'),
    (v_org_current, v_owner_current, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  INSERT INTO public.subscription_plans (name, price_monthly, price_annual)
  VALUES ('Plan Billing Alert Test', 25.00, 250.00) RETURNING id INTO v_plan;

  INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle) VALUES
    (v_org_overdue, v_plan, 'active', 'monthly'),
    (v_org_current, v_plan, 'active', 'monthly');

  -- Org Overdue: cargo pendiente vencido hace 5 días.
  INSERT INTO public.platform_charges (organization_id, plan_id, billing_cycle, amount, due_date, status)
  VALUES (v_org_overdue, v_plan, 'monthly', 25.00, NOW() - INTERVAL '5 days', 'pending');

  -- Org Current: tiene un cargo pendiente, pero su vencimiento todavía no llegó.
  INSERT INTO public.platform_charges (organization_id, plan_id, billing_cycle, amount, due_date, status)
  VALUES (v_org_current, v_plan, 'monthly', 25.00, NOW() + INTERVAL '10 days', 'pending');

  -- Plazo de gracia propio del test (no depender de que el default de
  -- producción siga en 15 — así se comprueba que la función lee el
  -- valor real configurado, no uno fijo).
  UPDATE public.platform_settings SET payment_grace_period_days = v_grace_days WHERE id = true;

  PERFORM set_config('test.org_overdue', v_org_overdue::text, true);
  PERFORM set_config('test.org_current', v_org_current::text, true);
  PERFORM set_config('test.owner_overdue', v_owner_overdue::text, true);
  PERFORM set_config('test.owner_current', v_owner_current::text, true);
  PERFORM set_config('test.staff_overdue', v_staff_overdue::text, true);
  PERFORM set_config('test.grace_days', v_grace_days::text, true);
END $$;

SET LOCAL role = authenticated;

-- ─── Dueño del centro vencido: is_overdue=true y días correctos ─────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_overdue') || '"}', true);

INSERT INTO tap_log(line) SELECT is(
  (SELECT is_overdue FROM public.get_organization_billing_alert(current_setting('test.org_overdue')::uuid)),
  true,
  'El dueño del centro vencido ve is_overdue = true');

INSERT INTO tap_log(line) SELECT is(
  (SELECT days_remaining FROM public.get_organization_billing_alert(current_setting('test.org_overdue')::uuid)),
  7,
  'Con 5 días de atraso y 12 días de plazo, quedan 7 (mismo corte que enforce_payment_grace_period)');

INSERT INTO tap_log(line) SELECT is(
  (SELECT grace_period_days FROM public.get_organization_billing_alert(current_setting('test.org_overdue')::uuid)),
  current_setting('test.grace_days')::integer,
  'Devuelve el plazo de gracia real configurado en platform_settings, no uno fijo');

-- ─── Dueño de un centro sin cargos vencidos: is_overdue=false ───────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_current') || '"}', true);

INSERT INTO tap_log(line) SELECT is(
  (SELECT is_overdue FROM public.get_organization_billing_alert(current_setting('test.org_current')::uuid)),
  false,
  'El dueño de un centro sin cargos vencidos ve is_overdue = false');

-- ─── Un miembro que no es dueño (staff) del centro vencido: rechazado ──
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.staff_overdue') || '"}', true);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.get_organization_billing_alert(current_setting('test.org_overdue')::uuid);
    RAISE EXCEPTION 'Debería haber sido rechazado: staff no es dueño del centro';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%No autorizado%' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO tap_log(line) SELECT ok(true, 'Un miembro que no es dueño (staff) del centro vencido es rechazado');

-- ─── El dueño de OTRO centro no puede consultar el vencido ──────────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_current') || '"}', true);

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.get_organization_billing_alert(current_setting('test.org_overdue')::uuid);
    RAISE EXCEPTION 'Debería haber sido rechazado: no es dueño de ese centro';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%No autorizado%' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO tap_log(line) SELECT ok(true, 'El dueño de otro centro no puede consultar el estado de facturación del centro vencido');

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
