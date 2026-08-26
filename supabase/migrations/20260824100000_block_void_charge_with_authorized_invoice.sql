-- ============================================================
-- Bloquear anular un cargo que ya tiene una factura electrónica
-- AUTORIZADA vinculada.
--
-- En Ecuador, un comprobante ya autorizado por el SRI no se puede
-- simplemente "borrar" localmente — sigue siendo legalmente exigible
-- hasta que se emita una Nota de Crédito (document_type = '04' en
-- sri_documents, todavía no implementado). Sin este trigger, un cargo se
-- podía marcar como anulado mientras su factura real ante el SRI seguía
-- vigente, dando la falsa impresión de que "ya no aplica".
--
-- Mismo patrón que el trigger ya existente
-- prevent_sri_document_id_overwrite (migración 20260817173529): un
-- backstop a nivel de base de datos, independiente de cualquier
-- validación del lado de la aplicación.
-- ============================================================

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
    ) THEN
      RAISE EXCEPTION 'No se puede anular este cargo: tiene una factura electrónica autorizada por el SRI. Para revertirla hace falta una nota de crédito (aún no disponible).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_void_charge_with_authorized_invoice ON public.charges;
CREATE TRIGGER trg_prevent_void_charge_with_authorized_invoice
  BEFORE UPDATE ON public.charges
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_void_charge_with_authorized_invoice();
