-- ============================================================
-- Real SRI integration — schema adjustments
--
-- Backs the transition from the Sprint-0 mock (supabase/functions/
-- electronic-billing) to a real .NET service (services/electronic-billing)
-- that performs real XAdES-BES signing and SOAP calls to SRI. Three
-- changes:
--   1. cert_password_hash was misleadingly named — real signing needs
--      the password DECRYPTABLE (symmetric encryption), not hashed
--      one-way. Renamed, not re-typed (still bytea-compatible text).
--   2. A real sequence table for legally-required strictly-incrementing
--      secuenciales (the mock used a random 9-digit number).
--   3. A private bucket for the real .p12 certificate upload (the
--      frontend previously only fabricated a fake path string).
-- ============================================================

ALTER TABLE public.sri_configurations
  RENAME COLUMN cert_password_hash TO cert_password_encrypted;

-- ============================================================
-- Sequences
--
-- The .NET billing service connects directly to Postgres (not through
-- PostgREST) and performs the atomic increment itself via a single
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement, so no
-- SECURITY DEFINER RPC is required for it to use this table. RLS is
-- still enabled below as defense-in-depth / for any future PostgREST
-- access, matching the sri_configurations policy shape.
-- ============================================================

CREATE TABLE public.sri_emission_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  establecimiento VARCHAR(3) NOT NULL,
  punto_emision VARCHAR(3) NOT NULL,
  document_type VARCHAR(2) NOT NULL DEFAULT '01',
  last_sequence BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sri_emission_sequences_unique UNIQUE (organization_id, establecimiento, punto_emision, document_type)
);

ALTER TABLE public.sri_emission_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sri_emission_sequences of their organizations"
  ON public.sri_emission_sequences FOR SELECT
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]));

CREATE TRIGGER set_updated_at_sri_emission_sequences
  BEFORE UPDATE ON public.sri_emission_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- sri-certificates storage bucket
--
-- Private from the start (same shape as payment-receipts). Object path
-- convention: `${organization_id}/cert.p12`.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('sri-certificates', 'sri-certificates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners can upload sri certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sri-certificates'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can view sri certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sri-certificates'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = 'owner'
    )
  );

CREATE POLICY "Owners can update sri certificates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sri-certificates'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = 'owner'
    )
  )
  WITH CHECK (
    bucket_id = 'sri-certificates'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = 'owner'
    )
  );
