-- ============================================================
-- Electronic billing: link internal_payments to sri_documents
--
-- Backs the "Guardar y Facturar" / "Facturar Inscripción" flows: a
-- payment can be covered by at most one sri_documents row, whether it
-- was invoiced alone or as part of a consolidated invoice for several
-- payments in one enrollment. `sri_document_id IS NULL` is the
-- "pending to invoice" signal used by both flows.
--
-- Idempotency ("never re-invoice a payment") is enforced twice: the
-- electronic-billing edge function checks before inserting, and the
-- trigger below blocks overwriting a non-null sri_document_id outright
-- — a DB-level backstop independent of the edge function's own logic.
-- ============================================================

ALTER TABLE public.internal_payments
  ADD COLUMN IF NOT EXISTS sri_document_id UUID REFERENCES public.sri_documents(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.prevent_sri_document_id_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.sri_document_id IS NOT NULL AND NEW.sri_document_id IS DISTINCT FROM OLD.sri_document_id THEN
    RAISE EXCEPTION 'Este pago ya fue facturado electrónicamente y no se puede volver a vincular a otra factura.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sri_document_id_overwrite ON public.internal_payments;
CREATE TRIGGER trg_prevent_sri_document_id_overwrite
  BEFORE UPDATE ON public.internal_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sri_document_id_overwrite();

-- internal_payments only had INSERT + SELECT policies before this —
-- linking a payment to the invoice that covers it needs UPDATE too.
-- Same role set as org_members_manage_charges (owner/admin/staff would
-- be too broad here: emitting an invoice is gated to owner/admin at the
-- sri_documents level, so linking access matches that, not the wider
-- staff-can-register-payments set).
CREATE POLICY "org_members_link_sri_document"
  ON public.internal_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = internal_payments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = internal_payments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role])
    )
  );

-- ============================================================
-- Platform-wide settings (superadmin). First entry: IVA percentage.
-- Not consumed by any tax math yet — the field is being added now so
-- it exists ahead of that work, per explicit request.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true), -- enforces a single row
  iva_percentage NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_view_settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_update_settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER set_updated_at_platform_settings
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
