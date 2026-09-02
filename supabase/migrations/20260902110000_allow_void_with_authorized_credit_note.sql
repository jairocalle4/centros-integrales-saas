-- Antes: cualquier factura AUTHORIZED vinculada bloqueaba SIEMPRE la
-- anulación de su cargo/pago, sin excepción — el mensaje de error de
-- ambos triggers decía literalmente "hace falta una nota de crédito (aún
-- no disponible)". Ahora que existe (ver 20260902100000), se permite la
-- anulación cuando exista una nota de crédito (document_type=04)
-- AUTHORIZED que respalde esa factura específica via
-- documento_modificado_id.
--
-- CREATE OR REPLACE FUNCTION reemplaza el cuerpo sin tocar los triggers
-- (trg_prevent_void_charge_with_authorized_invoice,
-- trg_prevent_void_payment_with_authorized_invoice), que ya apuntan a
-- estas funciones por nombre.

CREATE OR REPLACE FUNCTION public.prevent_void_charge_with_authorized_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'void' AND OLD.status IS DISTINCT FROM 'void' THEN
    IF EXISTS (
      SELECT 1
      FROM public.internal_payments ip
      JOIN public.sri_documents sd ON sd.id = ip.sri_document_id
      WHERE ip.charge_id = NEW.id
        AND sd.status = 'AUTHORIZED'
        AND NOT EXISTS (
          SELECT 1 FROM public.sri_documents cn
          WHERE cn.documento_modificado_id = sd.id
            AND cn.document_type = '04'
            AND cn.status = 'AUTHORIZED'
        )
    ) THEN
      RAISE EXCEPTION 'No se puede anular este cargo: tiene una factura electrónica autorizada por el SRI sin una nota de crédito que la respalde.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_void_payment_with_authorized_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    IF NEW.sri_document_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.sri_documents sd
      WHERE sd.id = NEW.sri_document_id
        AND sd.status = 'AUTHORIZED'
        AND NOT EXISTS (
          SELECT 1 FROM public.sri_documents cn
          WHERE cn.documento_modificado_id = sd.id
            AND cn.document_type = '04'
            AND cn.status = 'AUTHORIZED'
        )
    ) THEN
      RAISE EXCEPTION 'No se puede anular este pago: tiene una factura electrónica autorizada por el SRI sin una nota de crédito que la respalde.';
    END IF;
    NEW.voided_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
