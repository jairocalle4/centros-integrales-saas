-- Fixtures base
-- Estos INSERTS se ejecutan como postgres (service_role), por lo que evitan el bloqueo RLS sin necesidad de alterarlo.

BEGIN;

ALTER TABLE public.organization_members DISABLE TRIGGER prevent_role_escalation;

INSERT INTO auth.users (id, email) VALUES
('11111111-1111-1111-1111-111111111111', 'owner_a@example.com'),
('22222222-2222-2222-2222-222222222222', 'owner_b@example.com'),
('33333333-3333-3333-3333-333333333333', 'admin_a@example.com'),
('44444444-4444-4444-4444-444444444444', 'staff_a@example.com'),
('55555555-5555-5555-5555-555555555555', 'inactive_a@example.com'),
('66666666-6666-6666-6666-666666666666', 'unauth_user@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name) VALUES
('11111111-1111-1111-1111-111111111111', 'Owner', 'A'),
('22222222-2222-2222-2222-222222222222', 'Owner', 'B'),
('33333333-3333-3333-3333-333333333333', 'Admin', 'A'),
('44444444-4444-4444-4444-444444444444', 'Staff', 'A'),
('55555555-5555-5555-5555-555555555555', 'Inactive', 'A'),
('66666666-6666-6666-6666-666666666666', 'Unauth', 'User')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Organización A'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Organización B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner', 'active'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'admin', 'active'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'staff', 'active'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'staff', 'inactive')
ON CONFLICT (organization_id, user_id) DO NOTHING;

ALTER TABLE public.organization_members ENABLE TRIGGER prevent_role_escalation;

COMMIT;
