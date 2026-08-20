-- ============================================================
-- Reuse open-api-facturacion-sri instead of the in-house .NET signer
--
-- The org's own encrypted P12 no longer needs to live in Supabase
-- Storage — the actual signing certificate now lives in the dedicated
-- open-api-facturacion-sri instance, which the Edge Function calls over
-- HTTPS. cert_storage_path / cert_password_encrypted are kept (not
-- dropped — no destructive change to an applied migration) but are no
-- longer written to going forward.
--
-- cert_uploaded_at is the new "is configured" signal (replaces checking
-- cert_storage_path IS NOT NULL from the frontend).
-- sri_api_emisor_id caches the "emisor" id created for this org inside
-- the reused API, so the Edge Function doesn't have to re-resolve it by
-- RUC on every emission.
-- ============================================================

ALTER TABLE public.sri_configurations
  ADD COLUMN IF NOT EXISTS cert_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sri_api_emisor_id TEXT;

-- The sri-documents bucket only had a SELECT policy (the .NET service
-- used to upload via a direct service-role Storage client). Now the
-- Edge Function uploads on behalf of the authenticated owner/admin who
-- triggered the emission, so it needs an INSERT policy too — same
-- role check as the existing SELECT policy, not a service-role bypass.
CREATE POLICY "Org members can upload sri documents files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sri-documents'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role])
    )
  );
