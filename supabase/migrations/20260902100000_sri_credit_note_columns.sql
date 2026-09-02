-- Nota de Crédito (SRI document_type = '04'): columnas para vincular la
-- nota a la factura que modifica, más el motivo obligatorio.
-- document_type ya admite '04' sin cambios (VARCHAR(2), sin CHECK propio
-- sobre sus valores). Aditiva — no rompe ninguna fila existente (todas
-- son document_type='01', a las que el nuevo CHECK no aplica).

ALTER TABLE public.sri_documents
  ADD COLUMN IF NOT EXISTS documento_modificado_id UUID REFERENCES public.sri_documents(id),
  ADD COLUMN IF NOT EXISTS motivo TEXT;

CREATE INDEX IF NOT EXISTS idx_sri_documents_documento_modificado
  ON public.sri_documents(documento_modificado_id);

COMMENT ON COLUMN public.sri_documents.documento_modificado_id IS
  'Para document_type=04 (Nota de Crédito): la factura (sri_documents.id) que esta nota modifica. NULL para facturas.';
COMMENT ON COLUMN public.sri_documents.motivo IS
  'Motivo de la nota de crédito (obligatorio si document_type=04). NULL para facturas.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sri_documents_credit_note_requires_link_check') THEN
    ALTER TABLE public.sri_documents
      ADD CONSTRAINT sri_documents_credit_note_requires_link_check
      CHECK (document_type <> '04' OR (documento_modificado_id IS NOT NULL AND motivo IS NOT NULL));
  END IF;
END $$;

-- Backstop a nivel de BD (mismo principio ya usado en los triggers de
-- 20260824100000/110000): valida que el vínculo sea coherente ANTES de
-- confiar en él para desbloquear una anulación —
-- misma organización (aislamiento multi-tenant, regla irrevocable de
-- AGENTS.md), solo puede referenciar una FACTURA (no otra nota de
-- crédito, no encadenar), y esa factura debe estar AUTHORIZED.
CREATE OR REPLACE FUNCTION public.validate_credit_note_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_original RECORD;
BEGIN
  IF NEW.document_type = '04' THEN
    SELECT organization_id, document_type, status INTO v_original
      FROM public.sri_documents WHERE id = NEW.documento_modificado_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'documento_modificado_id no corresponde a un sri_documents existente.';
    END IF;
    IF v_original.organization_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'La nota de crédito y la factura que modifica deben pertenecer a la misma organización.';
    END IF;
    IF v_original.document_type <> '01' THEN
      RAISE EXCEPTION 'Una nota de crédito solo puede modificar una factura (document_type=01).';
    END IF;
    IF v_original.status <> 'AUTHORIZED' THEN
      RAISE EXCEPTION 'Solo se puede emitir una nota de crédito sobre una factura AUTHORIZED.';
    END IF;
  ELSIF NEW.documento_modificado_id IS NOT NULL THEN
    RAISE EXCEPTION 'documento_modificado_id solo aplica a notas de crédito (document_type=04).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_credit_note_link ON public.sri_documents;
CREATE TRIGGER trg_validate_credit_note_link
  BEFORE INSERT OR UPDATE ON public.sri_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_credit_note_link();
