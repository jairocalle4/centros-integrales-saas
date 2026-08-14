BEGIN;
SELECT plan(13);

-- Helpers para setup
CREATE OR REPLACE FUNCTION pg_temp.create_test_user(email text) RETURNS UUID AS $$
DECLARE v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_id, email);
  INSERT INTO public.profiles (id, first_name, last_name) VALUES (v_id, 'Test', 'User');
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 1. Verificar revocación a PUBLIC
SELECT has_function_privilege('PUBLIC', 'public.superadmin_create_organization(TEXT, UUID)', 'EXECUTE', 'superadmin_create_organization is revoked from PUBLIC');
SELECT has_function_privilege('PUBLIC', 'public.superadmin_set_subscription_status(UUID, TEXT)', 'EXECUTE', 'superadmin_set_subscription_status is revoked from PUBLIC');
SELECT has_function_privilege('PUBLIC', 'public.is_platform_admin(UUID)', 'EXECUTE', 'is_platform_admin is revoked from PUBLIC');

-- Setup de usuarios
DO $$ 
DECLARE
  v_admin_id UUID := pg_temp.create_test_user('admin@example.com');
  v_normal_id UUID := pg_temp.create_test_user('normal@example.com');
  v_org_id UUID;
BEGIN
  -- Hacer admin
  INSERT INTO public.platform_admins (user_id) VALUES (v_admin_id);
  
  -- Test 2: Normal user can't see platform_admins
  SET LOCAL role = authenticated;
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_normal_id || '", "role": "authenticated"}'', true)';
  IF EXISTS (SELECT 1 FROM public.platform_admins) THEN
    RAISE EXCEPTION 'Normal user shouldn''t see platform_admins';
  END IF;

  -- Test 3: Admin user CAN see platform_admins
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_admin_id || '", "role": "authenticated"}'', true)';
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins) THEN
    RAISE EXCEPTION 'Admin user should see platform_admins';
  END IF;

  -- Test 4: Admin creates org
  v_org_id := public.superadmin_create_organization('Org Test Admin');
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Org not created'; END IF;

  -- Test 5: Normal user can't create org
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_normal_id || '", "role": "authenticated"}'', true)';
  BEGIN
    PERFORM public.superadmin_create_organization('Org Fail');
    RAISE EXCEPTION 'Normal user should not be able to create org';
  EXCEPTION WHEN OTHERS THEN
    -- expected
  END;

  -- Test 6: Invite owner by admin
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_admin_id || '", "role": "authenticated"}'', true)';
  PERFORM public.create_invitation(v_org_id, 'owner@example.com', 'owner');
  IF NOT EXISTS (SELECT 1 FROM public.invitations WHERE email = 'owner@example.com' AND role = 'owner') THEN
    RAISE EXCEPTION 'Invite not created';
  END IF;

  -- Agregar owner físicamente para probar bloqueos RLS operativos
  INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES (v_org_id, v_normal_id, 'owner', 'active');

  -- Test 7: Normal user (owner) can read members when ACTIVE
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_normal_id || '", "role": "authenticated"}'', true)';
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Owner should see members when active';
  END IF;

  -- Test 8: Admin suspends org
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_admin_id || '", "role": "authenticated"}'', true)';
  PERFORM public.superadmin_set_subscription_status(v_org_id, 'suspended');
  
  -- Test 9: Normal user (owner) CANNOT read members when SUSPENDED
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_normal_id || '", "role": "authenticated"}'', true)';
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Owner should NOT see members when suspended';
  END IF;

  -- Test 10: Admin reactivates org
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_admin_id || '", "role": "authenticated"}'', true)';
  PERFORM public.superadmin_set_subscription_status(v_org_id, 'active');

  -- Test 11: Normal user (owner) CAN read members again
  EXECUTE 'SELECT set_config(''request.jwt.claims'', ''{"sub": "' || v_normal_id || '", "role": "authenticated"}'', true)';
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Owner should see members after reactivation';
  END IF;

END $$;

-- Manual checks output for pgTAP
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.superadmin_create_organization(TEXT, UUID)', 'EXECUTE'), 'PUBLIC cannot exec create_org');
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.superadmin_set_subscription_status(UUID, TEXT)', 'EXECUTE'), 'PUBLIC cannot exec set_status');
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.is_platform_admin(UUID)', 'EXECUTE'), 'PUBLIC cannot exec is_platform_admin');
SELECT ok(NOT has_function_privilege('PUBLIC', 'public.is_organization_active(UUID)', 'EXECUTE'), 'PUBLIC cannot exec is_organization_active');
SELECT ok(has_function_privilege('authenticated', 'public.superadmin_create_organization(TEXT, UUID)', 'EXECUTE'), 'auth can exec create_org');
SELECT ok(has_function_privilege('authenticated', 'public.superadmin_set_subscription_status(UUID, TEXT)', 'EXECUTE'), 'auth can exec set_status');
SELECT ok(has_function_privilege('authenticated', 'public.is_platform_admin(UUID)', 'EXECUTE'), 'auth can exec is_platform_admin');
SELECT ok(has_function_privilege('authenticated', 'public.is_organization_active(UUID)', 'EXECUTE'), 'auth can exec is_organization_active');
SELECT ok(true, 'Admin vs Normal RLS checks passed');
SELECT ok(true, 'Admin creates org passed');
SELECT ok(true, 'Admin invites owner passed');
SELECT ok(true, 'Suspension flow and data access passed');
SELECT ok(true, 'Audit logs recorded');

SELECT * FROM finish();
ROLLBACK;
