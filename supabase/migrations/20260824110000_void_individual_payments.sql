-- ============================================================
-- Anular un pago individual (no solo el cargo completo).
--
-- Hasta ahora solo existía "anular cargo" (charges.status = 'void'),
-- pero eso no revierte los pagos ya registrados — un cargo anulado con
-- pagos reales seguía sumando como "pagado" en cualquier cálculo que
-- recorriera internal_payments directamente. Lo que hace falta es poder
-- anular un abono puntual (ej. un cheque rebotado, un registro por
-- error), preservando el historial (soft-delete, no borrado — mismo
-- principio ya usado en el resto del dominio) y recalculando
-- correctamente el estado del cargo.
--
-- Mismo patrón de guardia que prevent_void_charge_with_authorized_invoice
-- (migración 20260824100000): no se puede anular un pago que ya tiene una
-- factura AUTORIZADA vinculada — hace falta una nota de crédito.
-- ============================================================

ALTER TABLE public.internal_payments
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

-- Recalcula el estado del cargo excluyendo pagos anulados de la suma.
-- CREATE OR REPLACE preserva el trigger ya existente
-- (trg_recalculate_charge_status, migración 20260811010000) — no hace
-- falta tocarlo ni recrearlo.
CREATE OR REPLACE FUNCTION public.recalculate_charge_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_charge_id   UUID;
  v_total_paid  NUMERIC;
  v_charge_amt  NUMERIC;
  v_new_status  TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_charge_id := OLD.charge_id;
  ELSE
    v_charge_id := NEW.charge_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM public.internal_payments
   WHERE charge_id = v_charge_id
     AND voided_at IS NULL;

  SELECT amount INTO v_charge_amt
    FROM public.charges
   WHERE id = v_charge_id;

  IF v_total_paid <= 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_paid < v_charge_amt THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'paid';
  END IF;

  UPDATE public.charges
     SET status = v_new_status, updated_at = NOW()
   WHERE id = v_charge_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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
      WHERE sd.id = NEW.sri_document_id AND sd.status = 'AUTHORIZED'
    ) THEN
      RAISE EXCEPTION 'No se puede anular este pago: tiene una factura electrónica autorizada por el SRI vinculada. Para revertirla hace falta una nota de crédito (aún no disponible).';
    END IF;
    -- Nunca confiar en un voided_by que mande el cliente — se sella aquí
    -- con la identidad real de quien ejecuta la operación.
    NEW.voided_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_void_payment_with_authorized_invoice ON public.internal_payments;
CREATE TRIGGER trg_prevent_void_payment_with_authorized_invoice
  BEFORE UPDATE ON public.internal_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_void_payment_with_authorized_invoice();

-- La política de UPDATE ya existente "org_members_link_sri_document"
-- (migración 20260817173529) permite UPDATE a owner/admin sobre
-- internal_payments sin restricción de columna — ya cubre este nuevo uso
-- (anular un pago) sin necesitar una política nueva.
