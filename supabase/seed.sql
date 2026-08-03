-- Seed data para pruebas locales o CI

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner_a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'staff_a@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@example.com');

INSERT INTO public.profiles (id, first_name, last_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'Bob', 'Staff A'),
  ('33333333-3333-3333-3333-333333333333', 'Charlie', 'Owner B');

INSERT INTO public.organizations (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Guardería A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Centro Integral B');

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');
