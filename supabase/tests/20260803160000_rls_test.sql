BEGIN;
SELECT plan(8);

-- Test 1: Lectura (Aislamiento)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', true);
SELECT set_config('role', 'authenticated', true);
SELECT results_eq('SELECT id FROM public.organizations', $$VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$, 'Owner A solo ve Org A');

-- Test 2: Inserción y Actualización
SELECT throws_ok($$ UPDATE public.organizations SET name = 'Hack' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$, 'new row violates row-level security policy for table "organizations"', 'No puede actualizar Org B');

-- Test 3: Escalado de roles
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', true); -- Staff A
SELECT throws_ok($$ UPDATE public.organization_members SET role = 'owner' WHERE user_id = '22222222-2222-2222-2222-222222222222' $$, 'Solo un owner puede asignar el rol de owner', 'Staff no puede escalar a owner');

-- Test 4: Integrante inactivo
UPDATE public.organization_members SET status = 'inactive' WHERE user_id = '22222222-2222-2222-2222-222222222222';
SELECT is_empty('SELECT id FROM public.organizations', 'Usuario inactivo no ve la org');

-- Test 5: Usuario no autenticado
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT is_empty('SELECT id FROM public.organizations', 'Anon no ve ninguna org');
SELECT is_empty('SELECT id FROM public.organization_members', 'Anon no ve miembros');
SELECT throws_ok($$ INSERT INTO public.organizations (name) VALUES ('X') $$, 'new row violates row-level security policy for table "organizations"', 'Anon no puede crear org');

SELECT * FROM finish();
ROLLBACK;
