-- ============================================================
-- payment-receipts storage bucket
--
-- Backs the "Recibo" feature: a downloadable/WhatsApp-shareable PDF
-- receipt per internal_payments row. Private from the start (unlike
-- beneficiary-photos, which had to be fixed after the fact) — access
-- is gated by RLS below, the frontend serves files via short-lived
-- signed URLs (createSignedUrl), never getPublicUrl().
--
-- Object path convention: `${organization_id}/${payment_id}.pdf`.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Path's first segment is the organization_id directly (no join needed,
-- unlike beneficiary-photos which has to resolve through beneficiaries).

CREATE POLICY "Org members can upload payment receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can view payment receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can update payment receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND EXISTS (
      SELECT 1
        FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );
