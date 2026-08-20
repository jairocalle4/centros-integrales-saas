-- ============================================================
-- Fix: beneficiary-photos storage policies (critical audit finding)
--
-- 20260812020000_session_notes.sql created a PUBLIC bucket with
-- policies that let ANY authenticated user (from ANY organization)
-- upload/overwrite objects, and let ANYONE (no auth at all, via the
-- public object URL) read them. That leaks photos of minors across
-- tenants. This migration does not edit the already-applied
-- migration; it replaces the policies and closes the public bucket.
-- ============================================================

DROP POLICY IF EXISTS "Org members can upload beneficiary photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view beneficiary photos" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update beneficiary photos" ON storage.objects;

-- Object path convention is `${beneficiary_id}/photo.<ext>` (see
-- BeneficiaryDetailPage.tsx). Resolve the beneficiary from the first
-- path segment and require the caller to be an active member of the
-- organization that owns that beneficiary.

CREATE POLICY "Org members can upload beneficiary photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'beneficiary-photos'
    AND EXISTS (
      SELECT 1
        FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can view beneficiary photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'beneficiary-photos'
    AND EXISTS (
      SELECT 1
        FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can update beneficiary photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'beneficiary-photos'
    AND EXISTS (
      SELECT 1
        FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'beneficiary-photos'
    AND EXISTS (
      SELECT 1
        FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

-- The bucket no longer needs to be public: access is gated by the RLS
-- policies above, and the frontend now serves photos via short-lived
-- signed URLs (createSignedUrl) instead of getPublicUrl().
UPDATE storage.buckets SET public = false WHERE id = 'beneficiary-photos';
