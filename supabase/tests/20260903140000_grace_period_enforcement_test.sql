-- ============================================================
-- enforce_payment_grace_period(): suspende centros 'active' con un
-- cargo pending vencido más allá del plazo de gracia configurado;
-- nunca toca 'trialing', ni un cargo todavía dentro del plazo, ni algo
-- ya 'canceled'/'suspended'. Self-contained, ROLLBACK al final —
-- nunca corre contra datos reales.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(5);

DO $$
DECLARE
  v_org_overdue   UUID := gen_random_uuid(); -- active, vencido hace 20 días (> 15 por defecto) -> debe suspenderse
  v_org_trialing  UUID := gen_random_uuid(); -- trialing, igual de vencido -> NO debe tocarse
  v_org_grace     UUID := gen_random_uuid(); -- active, vencido hace 5 días (< 15) -> todavía NO debe suspenderse
  v_org_canceled  UUID := gen_random_uuid(); -- canceled, vencido -> no-op
  v_plan UUID;
BEGIN
  INSERT INTO public.organizations (id, name) VALUES
    (v_org_overdue, 'Org Overdue - grace test'),
    (v_org_trialing, 'Org Trialing - grace test'),
    (v_org_grace, 'Org Grace - grace test'),
    (v_org_canceled, 'Org Canceled - grace test');

  INSERT INTO public.subscription_plans (name, price_monthly, price_annual)
  VALUES ('Plan Grace Test', 20.00, 200.00) RETURNING id INTO v_plan;

  INSERT INTO public.subscriptions (organization_id, plan_id, status, billing_cycle) VALUES
    (v_org_overdue, v_plan, 'active', 'monthly'),
    (v_org_trialing, v_plan, 'trialing', 'monthly'),
    (v_org_grace, v_plan, 'active', 'monthly'),
    (v_org_canceled, v_plan, 'canceled', 'monthly');

  INSERT INTO public.platform_charges (organization_id, plan_id, billing_cycle, amount, due_date, status) VALUES
    (v_org_overdue, v_plan, 'monthly', 20.00, NOW() - INTERVAL '20 days', 'pending'),
    (v_org_trialing, v_plan, 'monthly', 20.00, NOW() - INTERVAL '20 days', 'pending'),
    (v_org_grace, v_plan, 'monthly', 20.00, NOW() - INTERVAL '5 days', 'pending'),
    (v_org_canceled, v_plan, 'monthly', 20.00, NOW() - INTERVAL '20 days', 'pending');

  PERFORM set_config('test.org_overdue', v_org_overdue::text, true);
  PERFORM set_config('test.org_trialing', v_org_trialing::text, true);
  PERFORM set_config('test.org_grace', v_org_grace::text, true);
  PERFORM set_config('test.org_canceled', v_org_canceled::text, true);

  PERFORM public.enforce_payment_grace_period();
END $$;

INSERT INTO tap_log(line) SELECT is(
  (SELECT status FROM public.subscriptions WHERE organization_id = current_setting('test.org_overdue')::uuid),
  'suspended',
  'Org con cargo vencido más allá del plazo de gracia queda suspendida');

INSERT INTO tap_log(line) SELECT ok(
  EXISTS(
    SELECT 1 FROM public.audit_logs
     WHERE organization_id = current_setting('test.org_overdue')::uuid
       AND action = 'system_auto_suspend_grace_period_expired'
       AND user_id IS NULL
  ),
  'Queda registrado en audit_logs con user_id NULL (lo hizo el sistema, no un superadmin)');

INSERT INTO tap_log(line) SELECT is(
  (SELECT status FROM public.subscriptions WHERE organization_id = current_setting('test.org_trialing')::uuid),
  'trialing',
  'Org en trial con el mismo cargo vencido NO se toca');

INSERT INTO tap_log(line) SELECT is(
  (SELECT status FROM public.subscriptions WHERE organization_id = current_setting('test.org_grace')::uuid),
  'active',
  'Org todavía dentro del plazo de gracia (5 de 15 días) sigue activa');

INSERT INTO tap_log(line) SELECT is(
  (SELECT status FROM public.subscriptions WHERE organization_id = current_setting('test.org_canceled')::uuid),
  'canceled',
  'Org ya cancelada no se toca (no-op)');

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
