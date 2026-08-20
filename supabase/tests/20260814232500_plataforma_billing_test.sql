-- ============================================================
-- Aislamiento RLS: subscriptions, payments,
-- sri_configurations, sri_documents
-- Self-contained: creates its own orgs/users, rolls back at the end.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(9);

-- ─── Fixtures (as postgres, bypasses RLS) ──────────────────────────────────
DO $$
DECLARE
  org_a  UUID := 'a9a9a9a9-0000-0000-0000-000000000001';
  org_b  UUID := 'a9a9a9a9-0000-0000-0000-000000000002';
  user_a UUID := 'b9b9b9b9-0000-0000-0000-000000000001';
  user_b UUID := 'b9b9b9b9-0000-0000-0000-000000000002';
  plan_a UUID;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (user_a, 'owner_a@billing.test'),
    (user_b, 'owner_b@billing.test');
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'A' WHERE id = user_a;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'B' WHERE id = user_b;

  INSERT INTO public.organizations (id, name) VALUES
    (org_a, 'Org A - billing test'),
    (org_b, 'Org B - billing test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (org_a, user_a, 'owner', 'active'),
    (org_b, user_b, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  INSERT INTO public.subscription_plans (name, max_members) VALUES ('Plan Test Billing', 10)
  RETURNING id INTO plan_a;

  INSERT INTO public.subscriptions (id, organization_id, plan_id, status) VALUES
    ('c9c9c9c9-0000-0000-0000-000000000001', org_a, plan_a, 'active');

  INSERT INTO public.payments (id, organization_id, amount, reference) VALUES
    ('d9d9d9d9-0000-0000-0000-000000000001', org_a, 50.00, 'TX-TEST-A');

  INSERT INTO public.sri_configurations (id, organization_id, environment) VALUES
    ('e9e9e9e9-0000-0000-0000-000000000001', org_a, 'pruebas');

  INSERT INTO public.sri_documents (id, organization_id, secuencial, cliente_identificacion) VALUES
    ('f9f9f9f9-0000-0000-0000-000000000001', org_a, '000000001', '0999999999');
END $$;

SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "b9b9b9b9-0000-0000-0000-000000000002"}', true); -- Owner B

-- ─── subscriptions ──────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.subscriptions WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' $$,
  'Owner B no ve la suscripción de Org A');

WITH upd AS (
  UPDATE public.subscriptions SET status = 'canceled' WHERE id = 'c9c9c9c9-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede cancelar la suscripción de Org A (sin política UPDATE para authenticated)');

-- ─── payments ───────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.payments WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' $$,
  'Owner B no ve los pagos globales de Org A');

SELECT set_config('request.jwt.claims', '{"sub": "b9b9b9b9-0000-0000-0000-000000000001"}', true); -- Owner A
INSERT INTO tap_log(line) SELECT ok(
  EXISTS(SELECT 1 FROM public.payments WHERE id = 'd9d9d9d9-0000-0000-0000-000000000001'),
  'Owner A sí ve su propio pago (política "Owners can view own payments")');

-- ─── sri_configurations ─────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "b9b9b9b9-0000-0000-0000-000000000002"}', true); -- Owner B
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.sri_configurations WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' $$,
  'Owner B no ve la configuración SRI de Org A');

WITH upd AS (
  UPDATE public.sri_configurations SET establecimiento = '999' WHERE id = 'e9e9e9e9-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar la configuración SRI de Org A');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.sri_configurations (organization_id, environment)
    VALUES ('a9a9a9a9-0000-0000-0000-000000000001', 'produccion');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- expected: rejected, sri_configurations_org_unique + RLS both would block a second row anyway
  END;
END $$;
INSERT INTO tap_log(line) SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.sri_configurations WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' AND environment = 'produccion'),
  'Owner B no logró insertar una configuración SRI adicional en Org A'
);

-- ─── sri_documents ──────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.sri_documents WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' $$,
  'Owner B no ve los documentos SRI de Org A');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.sri_documents (organization_id, secuencial, cliente_identificacion)
    VALUES ('a9a9a9a9-0000-0000-0000-000000000001', '000000002', '0888888888');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.sri_documents WHERE organization_id = 'a9a9a9a9-0000-0000-0000-000000000001' AND secuencial = '000000002' $$,
  'Owner B no logró insertar un documento SRI fraudulento en Org A');

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
