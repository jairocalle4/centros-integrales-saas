-- ============================================================
-- Allow retrying a rejected/errored sri_documents row in place
--
-- sri_documents only had INSERT + SELECT policies — a retry must UPDATE
-- the existing row (same clave_acceso/secuencial), not INSERT a new one,
-- otherwise the prevent_sri_document_id_overwrite trigger on
-- internal_payments (20260817173529) would block re-linking it. Same
-- role check as the existing INSERT policy.
-- ============================================================

CREATE POLICY "Owners and admins can update sri_documents"
  ON public.sri_documents FOR UPDATE
  TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]))
  WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]));
