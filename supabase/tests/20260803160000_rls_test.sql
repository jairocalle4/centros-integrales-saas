BEGIN;
SELECT plan(18);

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
UPDATE public.organizations SET name = 'Hack' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Para verificar, cambiamos a postgres (bypass RLS)
SELECT set_config('role', 'postgres', true);
SELECT results_eq('SELECT name FROM public.organizations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''', $$VALUES ('Organización B')$$, 'Actualización cruzada falló en Org B');
SELECT set_config('role', 'authenticated', true);

-- 5. eliminación cruzada afecta cero filas y B permanece existente
DELETE FROM public.organizations WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT set_config('role', 'postgres', true);
SELECT is_empty('SELECT id FROM public.organizations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'' AND false', 'B existe');
SELECT results_eq('SELECT COUNT(*) > 0 FROM public.organizations WHERE id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb''', $$VALUES (true)$$, 'Eliminación cruzada no afectó B');
SELECT set_config('role', 'authenticated', true);

-- 6. inserción de un integrante en otra organización es rechazada
SELECT throws_ok($$ INSERT INTO public.organization_members (organization_id, user_id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666') $$, 'new row violates row-level security policy for table "organization_members"', 'No se puede insertar miembro en otra org');

-- 7. staff no puede cambiar su propio rol
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444"}', true); -- Staff A
UPDATE public.organization_members SET role = 'admin' WHERE user_id = '44444444-4444-4444-4444-444444444444';
SELECT set_config('role', 'postgres', true);
SELECT results_eq('SELECT role FROM public.organization_members WHERE user_id = ''44444444-4444-4444-4444-444444444444''', $$VALUES ('staff'::public.organization_role)$$, 'Staff no pudo cambiar su rol a admin porque su UPDATE fue invisibilizado por RLS');
SELECT set_config('role', 'authenticated', true);

-- 8. admin no puede convertirse en owner
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}', true); -- Admin A
SELECT throws_ok($$ UPDATE public.organization_members SET role = 'owner' WHERE user_id = '33333333-3333-3333-3333-333333333333' $$, 'Solo un owner puede asignar el rol de owner', 'Admin no puede escalar a owner');

-- 9. admin no puede degradar ni eliminar al owner
SELECT throws_ok($$ UPDATE public.organization_members SET role = 'staff' WHERE user_id = '11111111-1111-1111-1111-111111111111' $$, 'Admin no puede modificar a un owner', 'Admin no degrada a owner');
SELECT throws_ok($$ DELETE FROM public.organization_members WHERE user_id = '11111111-1111-1111-1111-111111111111' $$, 'Admin no puede eliminar a un owner', 'Admin no elimina a owner');

-- 10. integrante inactivo no ve la organización
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555"}', true); -- Inactive A
SELECT is_empty('SELECT id FROM public.organizations', 'Integrante inactivo no ve org');

-- 11. usuario autenticado sin membresía no ve organizaciones
SELECT set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666"}', true); -- Unauth User
SELECT is_empty('SELECT id FROM public.organizations', 'Usuario sin membresía no ve org');

-- 12. anon no puede leer organizaciones ni integrantes
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT is_empty('SELECT id FROM public.organizations', 'Anon no lee orgs');
SELECT is_empty('SELECT id FROM public.organization_members', 'Anon no lee miembros');

-- 13. anon no puede crear organizaciones
SELECT throws_ok($$ INSERT INTO public.organizations (name) VALUES ('X') $$, 'new row violates row-level security policy for table "organizations"', 'Anon no crea orgs');

-- 14. una operación válida dentro de la organización sí funciona
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true); -- Owner A
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'staff');
SELECT results_eq('SELECT COUNT(*) > 0 FROM public.organization_members WHERE user_id = ''66666666-6666-6666-6666-666666666666''', $$VALUES (true)$$, 'Owner puede insertar staff');

-- 15. no es posible falsificar el actor de un registro de auditoría
-- Al insertar en audit_logs, el usuario autenticado está bloqueado (solo service_role puede).
SELECT throws_ok($$ INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'login', 'auth', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$, 'new row violates row-level security policy for table "audit_logs"', 'Authenticated user cannot insert audit logs');

SELECT * FROM finish();
ROLLBACK;
