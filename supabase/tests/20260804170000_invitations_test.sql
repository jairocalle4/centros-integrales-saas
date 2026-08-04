BEGIN;

-- Añadir una función throws_any() temporal si no existe
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

SELECT plan(13);

-- Preparar datos de prueba
-- Creamos usuarios
-- user_a1 (Owner Org 1)
-- user_a2 (Admin Org 1)
-- user_b1 (Owner Org 2)
-- user_invited (No org yet)
-- user_wrong (No org yet)

INSERT INTO auth.users (id, email) VALUES
('00000000-0000-0000-0000-000000000001', 'owner1@test.com'),
('00000000-0000-0000-0000-000000000002', 'admin1@test.com'),
('00000000-0000-0000-0000-000000000003', 'owner2@test.com'),
('00000000-0000-0000-0000-000000000004', 'invited@test.com'),
('00000000-0000-0000-0000-000000000005', 'wrong@test.com');

INSERT INTO public.organizations (id, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'Org 1'),
('22222222-2222-2222-2222-222222222222', 'Org 2');

INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'owner', 'active'),
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'admin', 'active'),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000003', 'owner', 'active');


-- 1. usuario no autenticado (create)
SELECT ok(
  pg_temp.throws_any($$ SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'test@test.com', 'staff') $$),
  'Usuario no autenticado no puede crear invitaciones'
);

-- 2. owner invitando a integrante
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "email": "owner1@test.com"}';
SET role authenticated;
SELECT ok(
  (SELECT length(public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited@test.com', 'staff'))) = 64,
  'Owner puede invitar a un integrante'
);

-- 3. admin invitando a integrante permitido
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000002", "email": "admin1@test.com"}';
SELECT ok(
  (SELECT length(public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited2@test.com', 'professional'))) = 64,
  'Admin puede invitar a professional'
);

-- 4. admin intentando invitar a owner
SELECT ok(
  pg_temp.throws_any($$ SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited3@test.com', 'owner') $$),
  'Admin NO puede invitar a un owner'
);

-- 5. acceso cruzado entre organizaciones (Owner2 intentando invitar a Org1)
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000003", "email": "owner2@test.com"}';
SELECT ok(
  pg_temp.throws_any($$ SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited4@test.com', 'staff') $$),
  'Owner de Org2 NO puede invitar a Org1'
);

-- Preparar token para aceptar
RESET ROLE;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "email": "owner1@test.com"}';
SET role authenticated;
-- Hacemos una invitación nueva
SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited5@test.com', 'staff') AS my_token
INTO pg_temp.test_token;

-- 6. correo autenticado diferente al invitado
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000005", "email": "wrong@test.com"}';
SELECT ok(
  pg_temp.throws_any(format($$ SELECT public.accept_invitation('%s') $$, (SELECT my_token FROM pg_temp.test_token))),
  'Usuario con correo distinto no puede aceptar la invitación'
);

-- 7. token inválido
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000004", "email": "invited5@test.com"}';
SELECT ok(
  pg_temp.throws_any($$ SELECT public.accept_invitation('invalid_token_1234') $$),
  'Falla al usar token inválido'
);

-- 8. aceptación correcta
SELECT ok(
  (SELECT public.accept_invitation((SELECT my_token FROM pg_temp.test_token))) = '11111111-1111-1111-1111-111111111111'::UUID,
  'El usuario correcto puede aceptar la invitación'
);

-- 9. verificación de membresía creada
SELECT ok(
  (SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = '00000000-0000-0000-0000-000000000004' AND organization_id = '11111111-1111-1111-1111-111111111111')),
  'La membresía fue creada en organization_members'
);

-- 10. reutilización del token
SELECT ok(
  pg_temp.throws_any(format($$ SELECT public.accept_invitation('%s') $$, (SELECT my_token FROM pg_temp.test_token))),
  'No se puede reutilizar un token'
);

-- 11. integrante sin permisos intentando invitar
-- invited5@test.com ahora es staff en Org1
SELECT ok(
  pg_temp.throws_any($$ SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited6@test.com', 'staff') $$),
  'Staff no puede invitar a otras personas'
);

-- 12. invitación vencida
RESET ROLE;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "email": "owner1@test.com"}';
SET role authenticated;
SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited_expired@test.com', 'staff') AS my_token_exp
INTO pg_temp.test_token_exp;

-- Forzamos vencimiento (necesitamos volver a rol admin de BD para modificar expiración, pues owner1 no tiene permiso para UPDATE en expiración)
RESET ROLE;
UPDATE public.invitations SET expires_at = now() - interval '1 day' 
WHERE token_hash = encode(extensions.digest((SELECT my_token_exp FROM pg_temp.test_token_exp), 'sha256'), 'hex');

-- Intentamos aceptar
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000006', 'invited_expired@test.com');
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000006", "email": "invited_expired@test.com"}';
SET role authenticated;

SELECT ok(
  pg_temp.throws_any(format($$ SELECT public.accept_invitation('%s') $$, (SELECT my_token_exp FROM pg_temp.test_token_exp))),
  'No se puede aceptar una invitación vencida'
);

-- 13. invitación revocada / no pendiente
RESET ROLE;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "email": "owner1@test.com"}';
SET role authenticated;
SELECT public.create_invitation('11111111-1111-1111-1111-111111111111', 'invited_revoked@test.com', 'staff') AS my_token_rev
INTO pg_temp.test_token_rev;

-- Revocamos simulando UPDATE
-- Wait, we don't have a revoke function, but owner1 could theoretically delete the row or update status if policy allowed.
-- RLS current doesn't allow UPDATE for invitations. Let's do it as postgres.
RESET ROLE;
UPDATE public.invitations SET status = 'expired' 
WHERE token_hash = encode(extensions.digest((SELECT my_token_rev FROM pg_temp.test_token_rev), 'sha256'), 'hex');

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000007', 'invited_revoked@test.com');
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000007", "email": "invited_revoked@test.com"}';
SET role authenticated;

SELECT ok(
  pg_temp.throws_any(format($$ SELECT public.accept_invitation('%s') $$, (SELECT my_token_rev FROM pg_temp.test_token_rev))),
  'No se puede aceptar una invitación que no esté en estado pending'
);


SELECT * FROM finish();
ROLLBACK;
