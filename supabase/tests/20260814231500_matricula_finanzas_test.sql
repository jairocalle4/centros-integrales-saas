-- ============================================================
-- Aislamiento RLS: enrollments, enrollment_services,
-- enrollment_schedules, charges, internal_payments
-- Self-contained: creates its own orgs/users, rolls back at the end.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(11);

-- ─── Fixtures (as postgres, bypasses RLS) ──────────────────────────────────
DO $$
DECLARE
  org_a  UUID := 'f1f1f1f1-0000-0000-0000-000000000001';
  org_b  UUID := 'f1f1f1f1-0000-0000-0000-000000000002';
  user_a UUID := 'f2f2f2f2-0000-0000-0000-000000000001';
  user_b UUID := 'f2f2f2f2-0000-0000-0000-000000000002';
  ben_a  UUID := 'f3f3f3f3-0000-0000-0000-000000000001';
  svc_a  UUID := 'f4f4f4f4-0000-0000-0000-000000000001';
  enr_a  UUID := 'f5f5f5f5-0000-0000-0000-000000000001';
  enrs_a UUID := 'f6f6f6f6-0000-0000-0000-000000000001';
  chg_a  UUID := 'f7f7f7f7-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (user_a, 'owner_a@matricula.test'),
    (user_b, 'owner_b@matricula.test');
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'A' WHERE id = user_a;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'B' WHERE id = user_b;

  INSERT INTO public.organizations (id, name) VALUES
    (org_a, 'Org A - matricula test'),
    (org_b, 'Org B - matricula test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (org_a, user_a, 'owner', 'active'),
    (org_b, user_b, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  INSERT INTO public.beneficiaries (id, organization_id, first_name, last_name) VALUES
    (ben_a, org_a, 'Beneficiario', 'A');

  INSERT INTO public.services (id, organization_id, name, price) VALUES
    (svc_a, org_a, 'Terapia Ocupacional', 30.00);

  INSERT INTO public.enrollments (id, organization_id, beneficiary_id) VALUES
    (enr_a, org_a, ben_a);

  INSERT INTO public.enrollment_services (id, enrollment_id, service_id, unit_price) VALUES
    (enrs_a, enr_a, svc_a, 30.00);

  INSERT INTO public.enrollment_schedules (organization_id, enrollment_service_id, day_of_week, start_time, end_time) VALUES
    (org_a, enrs_a, 1, '09:00', '09:40');

  INSERT INTO public.charges (id, organization_id, beneficiary_id, service_id, enrollment_id, description, amount) VALUES
    (chg_a, org_a, ben_a, svc_a, enr_a, 'Cargo Agosto', 30.00);

  INSERT INTO public.internal_payments (organization_id, charge_id, amount, method) VALUES
    (org_a, chg_a, 15.00, 'cash');
END $$;

SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "f2f2f2f2-0000-0000-0000-000000000002"}', true); -- Owner B

-- ─── enrollments ────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.enrollments WHERE organization_id = 'f1f1f1f1-0000-0000-0000-000000000001' $$,
  'Owner B no ve inscripciones de Org A');

WITH upd AS (
  UPDATE public.enrollments SET status = 'suspended' WHERE id = 'f5f5f5f5-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede suspender inscripción de Org A');

-- ─── enrollment_services ────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.enrollment_services WHERE enrollment_id = 'f5f5f5f5-0000-0000-0000-000000000001' $$,
  'Owner B no ve servicios de inscripción de Org A');

WITH upd AS (
  UPDATE public.enrollment_services SET status = 'paused' WHERE id = 'f6f6f6f6-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede pausar servicio de inscripción de Org A');

-- ─── enrollment_schedules ───────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.enrollment_schedules WHERE organization_id = 'f1f1f1f1-0000-0000-0000-000000000001' $$,
  'Owner B no ve horarios de inscripción de Org A');

WITH upd AS (
  UPDATE public.enrollment_schedules SET is_active = false WHERE enrollment_service_id = 'f6f6f6f6-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede desactivar horario de Org A');

-- ─── charges ────────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.charges WHERE organization_id = 'f1f1f1f1-0000-0000-0000-000000000001' $$,
  'Owner B no ve cargos de Org A');

WITH upd AS (
  UPDATE public.charges SET status = 'void' WHERE id = 'f7f7f7f7-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede anular cargo de Org A');

-- ─── internal_payments ──────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.internal_payments WHERE organization_id = 'f1f1f1f1-0000-0000-0000-000000000001' $$,
  'Owner B no ve pagos internos de Org A');

-- Intento real de insertar un pago de Owner B contra el cargo de Org A
DO $$
BEGIN
  BEGIN
    INSERT INTO public.internal_payments (organization_id, charge_id, amount, method)
    VALUES ('f1f1f1f1-0000-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-000000000001', 999, 'cash');
  EXCEPTION WHEN OTHERS THEN
    -- expected: RLS WITH CHECK rejects it
    NULL;
  END;
END $$;

INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.internal_payments WHERE amount = 999 $$,
  'El intento de pago fraudulento de Owner B sobre el cargo de Org A no quedó insertado');

-- ─── Positive: Owner A sí gestiona su propia cadena de matrícula ─────────
SELECT set_config('request.jwt.claims', '{"sub": "f2f2f2f2-0000-0000-0000-000000000001"}', true); -- Owner A
INSERT INTO tap_log(line) SELECT ok(
  EXISTS(
    SELECT 1 FROM public.enrollments e
      JOIN public.enrollment_services es ON es.enrollment_id = e.id
      JOIN public.enrollment_schedules sc ON sc.enrollment_service_id = es.id
      JOIN public.charges c ON c.enrollment_id = e.id
      JOIN public.internal_payments ip ON ip.charge_id = c.id
    WHERE e.id = 'f5f5f5f5-0000-0000-0000-000000000001'
  ),
  'Owner A ve toda su cadena de matrícula (inscripción, servicio, horario, cargo, pago)'
);

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
