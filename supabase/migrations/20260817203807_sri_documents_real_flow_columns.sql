-- ============================================================
-- sri_documents: columns + bucket needed for the real emission flow
--
-- authorization_number/authorization_date come back FROM SRI's real
-- authorization response — distinct from clave_acceso (generated
-- locally before sending) and worth keeping as their own legal record
-- of when/how SRI actually approved the document.
--
-- 'ERROR' is added to the status check for genuine pre-SRI failures
-- (signing/network/etc.) — previously there was no status for that,
-- only SRI-side outcomes (PENDING/SIGNED/SENT/AUTHORIZED/REJECTED/CANCELED).
-- ============================================================

ALTER TABLE public.sri_documents
  ADD COLUMN IF NOT EXISTS authorization_number VARCHAR(49),
  ADD COLUMN IF NOT EXISTS authorization_date TIMESTAMPTZ;

ALTER TABLE public.sri_documents DROP CONSTRAINT IF EXISTS sri_documents_status_check;
ALTER TABLE public.sri_documents ADD CONSTRAINT sri_documents_status_check
  CHECK (status IN ('PENDING', 'SIGNED', 'SENT', 'AUTHORIZED', 'REJECTED', 'CANCELED', 'ERROR'));

-- Private bucket for the final signed XML + RIDE PDF outputs. Path
-- convention: `${organization_id}/${sri_document_id}.xml` / `.pdf`.
-- xml_url/pdf_url on sri_documents store these paths, not raw content.

INSERT INTO storage.buckets (id, name, public)
VALUES ('sri-documents', 'sri-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members can view sri documents files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sri-documents'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = (split_part(storage.objects.name, '/', 1))::uuid
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role])
    )
  );
