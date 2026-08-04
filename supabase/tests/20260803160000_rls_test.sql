BEGIN;
SELECT plan(20);

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

-- Preparativos
SELECT set_config('role', 'authenticated', true);

-- 1. owner A ve únicamente organización A
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);
SELECT results_eq('SELECT id FROM public.organizations', $$VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$, 'Owner A ve su Org');

-- 2. owner B ve únicamente organización B
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', true);
SELECT results_eq('SELECT id FROM public.organizations', $$VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$, 'Owner B ve su Org');

-- 3. owner A no ve integrantes de B
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);
SELECT is_empty('SELECT id FROM public.organization_members WHERE organization_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''', 'Owner A no ve miembros de B');

-- 4. actualización cruzada afecta cero filas y B permanece sin cambios
WITH updated AS (
  UPDATE public.organizations SET name = 'Hack' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT is((SELECT count(*) FROM updated), 0::bigint, 'Actualización cruzada afecta cero filas');

-- 5
SELECT set_config('role', 'postgres', true);
SELECT results_eq('SELECT name FROM public.organizations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''', $$VALUES ('Organización B')$$, 'El dato original sigue intacto tras UPDATE');
SELECT set_config('role', 'authenticated', true);

-- 6. eliminación cruzada afecta cero filas y B permanece existente
WITH deleted AS (
  DELETE FROM public.organizations WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT is((SELECT count(*) FROM deleted), 0::bigint, 'Eliminación cruzada afecta cero filas');

-- 7
SELECT set_config('role', 'postgres', true);
SELECT results_eq('SELECT name FROM public.organizations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''', $$VALUES ('Organización B')$$, 'El dato original sigue intacto tras DELETE');
SELECT set_config('role', 'authenticated', true);

-- 8. inserción de un integrante en otra organización es rechazada
SELECT ok(
  pg_temp.throws_any($sql$
    INSERT INTO public.organization_members (organization_id, user_id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666');
  $sql$),
  'No se puede insertar miembro en otra org'
);

-- 9. staff no puede cambiar su propio rol
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444"}', true); -- Staff A
UPDATE public.organization_members SET role = 'admin' WHERE user_id = '44444444-4444-4444-4444-444444444444';
SELECT set_config('role', 'postgres', true);
SELECT results_eq('SELECT role FROM public.organization_members WHERE user_id = ''44444444-4444-4444-4444-444444444444''', $$VALUES ('staff'::public.organization_role)$$, 'Staff no pudo cambiar su rol a admin porque su UPDATE fue invisibilizado por RLS');
SELECT set_config('role', 'authenticated', true);

-- 10. admin no puede convertirse en owner
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}', true); -- Admin A
SELECT throws_ok($$ UPDATE public.organization_members SET role = 'owner' WHERE user_id = '33333333-3333-3333-3333-333333333333' $$, 'Solo un owner puede asignar el rol de owner', 'Admin no puede escalar a owner');

-- 11. admin no puede degradar ni eliminar al owner
SELECT throws_ok($$ UPDATE public.organization_members SET role = 'staff' WHERE user_id = '11111111-1111-1111-1111-111111111111' $$, 'Admin no puede modificar a un owner', 'Admin no degrada a owner');

-- 12
SELECT throws_ok($$ DELETE FROM public.organization_members WHERE user_id = '11111111-1111-1111-1111-111111111111' $$, 'Admin no puede eliminar a un owner', 'Admin no elimina a owner');

-- 13. integrante inactivo no ve la organización
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555"}', true); -- Inactive A
SELECT is_empty('SELECT id FROM public.organizations', 'Integrante inactivo no ve org');

-- 14. usuario autenticado sin membresía no ve organizaciones
SELECT set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666"}', true); -- Unauth User
SELECT is_empty('SELECT id FROM public.organizations', 'Usuario sin membresía no ve org');

-- 15. usuario autenticado sin membresía no puede crear organizaciones
SELECT ok(
  pg_temp.throws_any($sql$
    INSERT INTO public.organizations (name) VALUES ('Hacked Org');
  $sql$),
  'Usuario sin membresía no puede crear organizaciones'
);

-- 16. anon no puede leer organizaciones ni integrantes
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT is_empty('SELECT id FROM public.organizations', 'Anon no lee orgs');

-- 17
SELECT is_empty('SELECT id FROM public.organization_members', 'Anon no lee miembros');

-- 18. anon no puede crear organizaciones
SELECT ok(
  pg_temp.throws_any($sql$
    INSERT INTO public.organizations (name) VALUES ('X');
  $sql$),
  'Anon no crea orgs'
);

-- 19. una operación válida dentro de la organización sí funciona
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true); -- Owner A
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'staff');
SELECT results_eq('SELECT COUNT(*) > 0 FROM public.organization_members WHERE user_id = ''66666666-6666-6666-6666-666666666666''', $$VALUES (true)$$, 'Owner puede insertar staff');

-- 20. no es posible falsificar el actor de un registro de auditoría
SELECT throws_ok($$ INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'login', 'auth', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$, 'new row violates row-level security policy for table "audit_logs"', 'Authenticated user cannot insert audit logs');

SELECT * FROM finish();
ROLLBACK;
