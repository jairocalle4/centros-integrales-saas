-- ============================================================
-- Aislamiento RLS: beneficiaries, representatives,
-- beneficiary_representatives, services, attendance,
-- commitments, appointments, session_notes
-- Self-contained: creates its own orgs/users, rolls back at the end.
--
-- NOTE: run via `supabase db query --linked --file`, which only
-- returns the final statement's result set. Every pgTAP assertion
-- below is captured into pg_temp.tap_log so the full transcript is
-- visible in one SELECT at the end, instead of only the last line.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

CREATE OR REPLACE FUNCTION pg_temp.throws_any(command text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE command;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

INSERT INTO tap_log(line) SELECT plan(18);

-- ─── Fixtures (as postgres, bypasses RLS) ──────────────────────────────────
DO $$
DECLARE
  org_a  UUID := 'c1c1c1c1-0000-0000-0000-000000000001';
  org_b  UUID := 'c1c1c1c1-0000-0000-0000-000000000002';
  user_a UUID := 'd1d1d1d1-0000-0000-0000-000000000001';
  user_b UUID := 'd1d1d1d1-0000-0000-0000-000000000002';
  ben_a  UUID := 'e1e1e1e1-0000-0000-0000-000000000001';
  rep_a  UUID := 'e2e2e2e2-0000-0000-0000-000000000001';
  svc_a  UUID := 'e3e3e3e3-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (user_a, 'owner_a@beneficiarios.test'),
    (user_b, 'owner_b@beneficiarios.test');

  -- public.profiles rows are auto-created by the on_auth_user_created
  -- trigger fired by the auth.users insert above; just relabel them.
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'A' WHERE id = user_a;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'B' WHERE id = user_b;

  INSERT INTO public.organizations (id, name) VALUES
    (org_a, 'Org A - beneficiarios test'),
    (org_b, 'Org B - beneficiarios test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (org_a, user_a, 'owner', 'active'),
    (org_b, user_b, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  INSERT INTO public.beneficiaries (id, organization_id, first_name, last_name) VALUES
    (ben_a, org_a, 'Beneficiario', 'A');

  INSERT INTO public.representatives (id, organization_id, first_name, last_name) VALUES
    (rep_a, org_a, 'Representante', 'A');

  INSERT INTO public.beneficiary_representatives (beneficiary_id, representative_id, is_primary) VALUES
    (ben_a, rep_a, true);

  INSERT INTO public.services (id, organization_id, name, price) VALUES
    (svc_a, org_a, 'Terapia de Lenguaje', 25.00);

  INSERT INTO public.attendance (organization_id, beneficiary_id, session_date, status) VALUES
    (org_a, ben_a, CURRENT_DATE, 'present');

  INSERT INTO public.commitments (organization_id, beneficiary_id, representative_id) VALUES
    (org_a, ben_a, rep_a);

  INSERT INTO public.appointments (organization_id, patient_name, representative_name, appointment_date) VALUES
    (org_a, 'Paciente A', 'Representante A', CURRENT_DATE + 1);

  INSERT INTO public.session_notes (organization_id, beneficiary_id, observations) VALUES
    (org_a, ben_a, 'Sesión de prueba');
END $$;

-- ─── beneficiaries ──────────────────────────────────────────────────────
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "d1d1d1d1-0000-0000-0000-000000000002"}', true); -- Owner B

INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.beneficiaries WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve beneficiarios de Org A');

WITH upd AS (
  UPDATE public.beneficiaries SET notes = 'hack' WHERE id = 'e1e1e1e1-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar beneficiario de Org A');

INSERT INTO tap_log(line) SELECT ok(
  pg_temp.throws_any($sql$ INSERT INTO public.beneficiaries (organization_id, first_name, last_name) VALUES ('c1c1c1c1-0000-0000-0000-000000000001', 'Intruso', 'X') $sql$),
  'Owner B no puede insertar beneficiario en Org A'
);

SELECT set_config('request.jwt.claims', '{"sub": "d1d1d1d1-0000-0000-0000-000000000001"}', true); -- Owner A
INSERT INTO tap_log(line) SELECT ok(
  EXISTS(SELECT 1 FROM public.beneficiaries WHERE id = 'e1e1e1e1-0000-0000-0000-000000000001'),
  'Owner A sí ve su propio beneficiario'
);

-- ─── representatives ────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "d1d1d1d1-0000-0000-0000-000000000002"}', true); -- Owner B
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.representatives WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve representantes de Org A');

WITH upd AS (
  UPDATE public.representatives SET notes = 'hack' WHERE id = 'e2e2e2e2-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar representante de Org A');

-- ─── beneficiary_representatives ───────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT beneficiary_id FROM public.beneficiary_representatives WHERE beneficiary_id = 'e1e1e1e1-0000-0000-0000-000000000001' $$,
  'Owner B no ve el vínculo beneficiario-representante de Org A');

-- ─── services ───────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.services WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve servicios de Org A');

WITH upd AS (
  UPDATE public.services SET price = 999 WHERE id = 'e3e3e3e3-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar servicio de Org A');

-- ─── attendance ─────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.attendance WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve asistencia de Org A');

WITH upd AS (
  UPDATE public.attendance SET status = 'absent' WHERE beneficiary_id = 'e1e1e1e1-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar asistencia de Org A');

-- ─── commitments ────────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.commitments WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve compromisos (actas) de Org A');

WITH upd AS (
  UPDATE public.commitments SET status = 'void' WHERE beneficiary_id = 'e1e1e1e1-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede anular acta de compromiso de Org A');

-- ─── appointments ───────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.appointments WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve citas de Org A');

WITH upd AS (
  UPDATE public.appointments SET status = 'cancelled' WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede cancelar cita de Org A');

-- ─── session_notes ──────────────────────────────────────────────────────
INSERT INTO tap_log(line) SELECT is_empty(
  $$ SELECT id FROM public.session_notes WHERE organization_id = 'c1c1c1c1-0000-0000-0000-000000000001' $$,
  'Owner B no ve notas de sesión de Org A');

WITH upd AS (
  UPDATE public.session_notes SET observations = 'hack' WHERE beneficiary_id = 'e1e1e1e1-0000-0000-0000-000000000001' RETURNING id
)
INSERT INTO tap_log(line)
SELECT is((SELECT count(*) FROM upd), 0::bigint, 'Owner B no puede editar nota de sesión de Org A');

-- ─── staff (rol operativo, sin acceso a expedientes clínicos por diseño) ──
-- No existe todavía un rol dedicado a excluir "staff" de session_notes;
-- este assert documenta el estado ACTUAL (staff SÍ puede, ver informe de auditoría).
SELECT set_config('request.jwt.claims', '{"sub": "d1d1d1d1-0000-0000-0000-000000000001"}', true); -- Owner A
INSERT INTO tap_log(line) SELECT ok(
  EXISTS(SELECT 1 FROM public.session_notes WHERE beneficiary_id = 'e1e1e1e1-0000-0000-0000-000000000001'),
  'Owner A (miembro activo de su org) sí ve la nota de sesión propia'
);

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
