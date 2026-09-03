-- ============================================================
-- Ciclo de vida de platform_charges: asignar plan genera el cargo
-- pendiente correcto; cambiar de plan/ciclo anula el pendiente viejo y
-- crea uno nuevo (nunca dos a la vez); pagar marca el cargo pagado,
-- avanza current_period_end, y genera el siguiente pendiente. Más
-- aislamiento RLS (mismo patrón que 20260814232500_plataforma_billing_test.sql).
-- Self-contained: crea sus propios usuarios/orgs, hace ROLLBACK al final.
-- ============================================================
BEGIN;

CREATE TEMP TABLE tap_log (id SERIAL, line TEXT);
GRANT INSERT, SELECT ON tap_log TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE tap_log_id_seq TO authenticated, anon;

INSERT INTO tap_log(line) SELECT plan(7);

-- ─── Fixtures + flujo funcional completo (como postgres, bypassa RLS;
-- las RPCs SECURITY DEFINER se llaman igual haciendo login como el admin
-- vía request.jwt.claims, mismo patrón que 20260805120000_platform_admins_test.sql) ──
DO $$
DECLARE
  v_admin   UUID := gen_random_uuid();
  v_owner_a UUID := gen_random_uuid();
  v_owner_b UUID := gen_random_uuid();
  v_org_a   UUID := gen_random_uuid();
  v_org_b   UUID := gen_random_uuid();
  v_plan    UUID;
  v_charge_monthly UUID;
  v_charge_annual  UUID;
  v_period_before  TIMESTAMPTZ;
  v_period_after   TIMESTAMPTZ;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_admin, 'admin@charges.test'),
    (v_owner_a, 'owner_a@charges.test'),
    (v_owner_b, 'owner_b@charges.test');
  UPDATE public.profiles SET first_name = 'Admin', last_name = 'Charges' WHERE id = v_admin;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'A' WHERE id = v_owner_a;
  UPDATE public.profiles SET first_name = 'Owner', last_name = 'B' WHERE id = v_owner_b;

  INSERT INTO public.platform_admins (user_id) VALUES (v_admin);

  INSERT INTO public.organizations (id, name) VALUES
    (v_org_a, 'Org A - charges test'),
    (v_org_b, 'Org B - charges test');

  ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
    (v_org_a, v_owner_a, 'owner', 'active'),
    (v_org_b, v_owner_b, 'owner', 'active');
  ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

  INSERT INTO public.subscription_plans (name, price_monthly, price_annual)
  VALUES ('Plan Charges Test', 30.00, 300.00)
  RETURNING id INTO v_plan;

  -- Guardar los IDs en variables de sesión (is_local=true: viven el resto
  -- de esta transacción) — después de cambiar a role=authenticated más
  -- abajo, ninguna consulta directa a auth.users/organizations funciona
  -- (permission denied, correctamente), así que las secciones de más
  -- abajo los leen de aquí en vez de volver a consultarlos.
  PERFORM set_config('test.org_a', v_org_a::text, true);
  PERFORM set_config('test.org_b', v_org_b::text, true);
  PERFORM set_config('test.owner_a', v_owner_a::text, true);
  PERFORM set_config('test.owner_b', v_owner_b::text, true);

  -- Actuar como el superadmin para el resto del flujo.
  SET LOCAL role = authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub": "' || v_admin || '"}', true);

  -- 1) Asignar plan mensual -> debe crear un cargo pendiente de $30.
  PERFORM public.superadmin_assign_plan(v_org_a, v_plan, 'monthly');
  SELECT id INTO v_charge_monthly FROM public.platform_charges
   WHERE organization_id = v_org_a AND status = 'pending';
  IF v_charge_monthly IS NULL THEN
    RAISE EXCEPTION 'No se generó el cargo pendiente mensual';
  END IF;
  IF (SELECT amount FROM public.platform_charges WHERE id = v_charge_monthly) != 30.00 THEN
    RAISE EXCEPTION 'El cargo mensual no tiene el monto correcto (esperado 30.00)';
  END IF;

  -- 2) Cambiar a ciclo anual antes de pagar -> el cargo mensual pendiente
  -- debe quedar void, y debe existir exactamente UN cargo pending nuevo
  -- de $300 (nunca dos a la vez, lo blinda además el índice único parcial).
  PERFORM public.superadmin_assign_plan(v_org_a, v_plan, 'annual');
  IF (SELECT status FROM public.platform_charges WHERE id = v_charge_monthly) != 'void' THEN
    RAISE EXCEPTION 'El cargo mensual anterior no quedó anulado al cambiar de ciclo';
  END IF;
  IF (SELECT count(*) FROM public.platform_charges WHERE organization_id = v_org_a AND status = 'pending') != 1 THEN
    RAISE EXCEPTION 'Debe existir exactamente un cargo pendiente, nunca dos a la vez';
  END IF;
  SELECT id INTO v_charge_annual FROM public.platform_charges
   WHERE organization_id = v_org_a AND status = 'pending';
  IF (SELECT amount FROM public.platform_charges WHERE id = v_charge_annual) != 300.00 THEN
    RAISE EXCEPTION 'El cargo anual no tiene el monto correcto (esperado 300.00)';
  END IF;

  -- 3) Pagar el cargo anual -> debe marcarse 'paid', avanzar
  -- current_period_end en +1 año, y generar automáticamente el
  -- siguiente cargo pendiente para esa nueva fecha.
  v_period_before := (SELECT current_period_end FROM public.subscriptions WHERE organization_id = v_org_a);
  PERFORM public.superadmin_register_payment(v_org_a, v_charge_annual, 'TX-TEST-ANNUAL', '');

  IF (SELECT status FROM public.platform_charges WHERE id = v_charge_annual) != 'paid' THEN
    RAISE EXCEPTION 'El cargo anual no quedó marcado como pagado';
  END IF;

  SELECT current_period_end INTO v_period_after FROM public.subscriptions WHERE organization_id = v_org_a;
  IF v_period_after IS NULL OR v_period_after < NOW() + INTERVAL '11 months' THEN
    RAISE EXCEPTION 'current_period_end no avanzó ~1 año tras el pago anual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_charges
     WHERE organization_id = v_org_a AND status = 'pending'
       AND billing_cycle = 'annual' AND amount = 300.00
       AND due_date = v_period_after
  ) THEN
    RAISE EXCEPTION 'No se generó el siguiente cargo pendiente tras el pago';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payments WHERE charge_id = v_charge_annual AND amount = 300.00) THEN
    RAISE EXCEPTION 'No quedó registrado el pago histórico vinculado al cargo';
  END IF;

  -- 4) Intentar pagar el mismo cargo dos veces debe fallar (ya no está 'pending').
  BEGIN
    PERFORM public.superadmin_register_payment(v_org_a, v_charge_annual, 'TX-TEST-DOUBLE', '');
    RAISE EXCEPTION 'Pagar un cargo ya pagado debería haber fallado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ya fue pagado%' THEN RAISE; END IF; -- re-lanzar si es un error inesperado distinto
  END;
END $$;

-- ─── Aislamiento RLS de platform_charges (mismo patrón que payments) ──────
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_b') || '"}', true);

INSERT INTO tap_log(line) SELECT is_empty(
  format($$ SELECT id FROM public.platform_charges WHERE organization_id = %L $$, current_setting('test.org_a')::uuid),
  'Owner B no ve los platform_charges de Org A');

SELECT set_config('request.jwt.claims', '{"sub": "' || current_setting('test.owner_a') || '"}', true);

INSERT INTO tap_log(line) SELECT ok(
  EXISTS(SELECT 1 FROM public.platform_charges WHERE organization_id = current_setting('test.org_a')::uuid),
  'Owner A sí ve sus propios platform_charges (política "Owners can view own platform charges")');

-- ─── Resumen del flujo funcional (aserciones ya verificadas arriba vía
-- RAISE EXCEPTION dentro del DO — si el bloque llegó hasta aquí, pasaron) ──
INSERT INTO tap_log(line) SELECT ok(true, 'Asignar plan mensual genera cargo pendiente de $30');
INSERT INTO tap_log(line) SELECT ok(true, 'Cambiar a ciclo anual anula el cargo mensual y crea uno nuevo de $300 (nunca dos pending)');
INSERT INTO tap_log(line) SELECT ok(true, 'Pagar el cargo anual lo marca paid, avanza current_period_end ~1 año, y registra el pago vinculado');
INSERT INTO tap_log(line) SELECT ok(true, 'Pagar el mismo cargo genera automáticamente el siguiente cargo pendiente');
INSERT INTO tap_log(line) SELECT ok(true, 'Pagar un cargo ya pagado es rechazado');

INSERT INTO tap_log(line) SELECT * FROM finish();

SELECT line FROM tap_log ORDER BY id;

ROLLBACK;
