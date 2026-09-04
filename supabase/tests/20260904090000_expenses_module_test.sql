-- ============================================================
-- Aislamiento del módulo de Gastos: cualquier miembro activo puede VER
-- los gastos de su organización (sin restricción de rol); solo
-- owner/admin/staff pueden registrar o anular uno — professional queda
-- fuera (sin control financiero, docs/product/ROLES_PERMISSIONS.md).
-- Un miembro de otra organización no ve nada. Self-contained,
-- ROLLBACK al final — nunca corre contra datos reales.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(7);

DO $$
DECLARE
  v_owner_a UUID := gen_random_uuid();
  v_staff_a UUID := gen_random_uuid();
  v_prof_a  UUID := gen_random_uuid();
  v_owner_b UUID := gen_random_uuid();
  v_org_a   UUID := gen_random_uuid();
  v_org_b   UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_owner_a, 'owner_a@expenses.test'),
    (v_staff_a, 'staff_a@expenses.test'),
    (v_prof_a, 'prof_a@expenses.test'),
    (v_owner_b, 'owner_b@expenses.test');
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'A' WHERE id = v_owner_a;
  UPDATE public.profiles SET first_name = 'Staff', last_name = 'A' WHERE id = v_staff_a;
  UPDATE public.profiles SET first_name = 'Prof', last_name = 'A' WHERE id = v_prof_a;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'B' WHERE id = v_owner_b;

  INSERT INTO public.organizations (id, name) VALUES
    (v_org_a, 'Org A - expenses test'),
    (v_org_b, 'Org B - expenses test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (v_org_a, v_owner_a, 'owner', 'active'),
    (v_org_a, v_staff_a, 'staff', 'active'),
    (v_org_a, v_prof_a, 'professional', 'active'),
    (v_org_b, v_owner_b, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  PERFORM set_config('test.org_a', v_org_a::text, true);
  PERFORM set_config('test.org_b', v_org_b::text, true);
  PERFORM set_config('test.owner_a', v_owner_a::text, true);
  PERFORM set_config('test.staff_a', v_staff_a::text, true);
  PERFORM set_config('test.prof_a', v_prof_a::text, true);
  PERFORM set_config('test.owner_b', v_owner_b::text, true);
END $$;

SET LOCAL role = authenticated;

-- ─── 1) El dueño registra un gasto ───────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_a') || '"}', true);
DO $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.expenses (organization_id, description, category, amount, expense_date)
  VALUES (current_setting('test.org_a')::uuid, 'Arriendo septiembre', 'Arriendo', 350.00, CURRENT_DATE)
  RETURNING id INTO v_id;
  PERFORM set_config('test.expense_owner', v_id::text, true);
END $$;
INSERT INTO tap_log(line) SELECT ok(current_setting('test.expense_owner', true) IS NOT NULL, 'El dueño puede registrar un gasto');

-- ─── 2) Staff registra un gasto ───────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.staff_a') || '"}', true);
DO $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.expenses (organization_id, description, category, amount, expense_date)
  VALUES (current_setting('test.org_a')::uuid, 'Pañales', 'Insumos y Materiales', 45.00, CURRENT_DATE)
  RETURNING id INTO v_id;
  PERFORM set_config('test.expense_staff', v_id::text, true);
END $$;
INSERT INTO tap_log(line) SELECT ok(current_setting('test.expense_staff', true) IS NOT NULL, 'Staff puede registrar un gasto');

-- ─── 3) Professional NO puede registrar un gasto ─────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.prof_a') || '"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.expenses (organization_id, description, category, amount, expense_date)
    VALUES (current_setting('test.org_a')::uuid, 'Intento no autorizado', 'Otro', 10.00, CURRENT_DATE);
    RAISE EXCEPTION 'Debería haber sido rechazado: professional no tiene control financiero';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%row-level security%' THEN RAISE; END IF;
  END;
END $$;
INSERT INTO tap_log(line) SELECT ok(true, 'Professional no puede registrar un gasto (sin control financiero)');

-- ─── 4) Professional SÍ puede ver los gastos de su centro ────────────
INSERT INTO tap_log(line) SELECT ok(
  (SELECT count(*) FROM public.expenses WHERE organization_id = current_setting('test.org_a')::uuid) >= 2,
  'Professional sí puede ver los gastos de su centro (solo se restringe registrar/editar)');

-- ─── 5) El dueño de OTRA organización no ve los gastos de Org A ──────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_b') || '"}', true);
INSERT INTO tap_log(line) SELECT is_empty(
  format($$ SELECT id FROM public.expenses WHERE organization_id = %L $$, current_setting('test.org_a')),
  'El dueño de otra organización no ve los gastos de Org A');

-- ─── 6) Staff puede anular (voided_at) un gasto ──────────────────────
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.staff_a') || '"}', true);
UPDATE public.expenses SET voided_at = now(), voided_reason = 'Registrado por error'
 WHERE id = current_setting('test.expense_staff')::uuid;
INSERT INTO tap_log(line) SELECT ok(
  (SELECT voided_at IS NOT NULL FROM public.expenses WHERE id = current_setting('test.expense_staff')::uuid),
  'Staff puede anular un gasto');

-- ─── 7) Professional no puede editar/anular un gasto ─────────────────
-- RLS silencia el UPDATE (0 filas afectadas) en vez de lanzar excepción
-- — es el mismo comportamiento estándar de Postgres para UPDATE sin una
-- política aplicable, no un caso especial de esta tabla.
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.prof_a') || '"}', true);
UPDATE public.expenses SET voided_reason = 'intento no autorizado'
 WHERE id = current_setting('test.expense_owner')::uuid;
INSERT INTO tap_log(line) SELECT is(
  (SELECT voided_reason FROM public.expenses WHERE id = current_setting('test.expense_owner')::uuid),
  NULL,
  'Professional no puede editar/anular un gasto (el UPDATE no afecta ninguna fila bajo RLS)');

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
