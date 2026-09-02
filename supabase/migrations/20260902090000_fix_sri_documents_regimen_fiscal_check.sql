-- Bugfix independiente: al agregar el régimen 'rimpe_emprendedor'
-- (20260828120000, sobre sri_configurations.regimen_fiscal) se olvidó
-- actualizar el CHECK gemelo de sri_documents.regimen_fiscal_aplicado
-- (columna que congela el régimen vigente al momento de emitir cada
-- comprobante). Sin este fix, CUALQUIER emisión (factura o nota de
-- crédito) para un centro configurado como 'rimpe_emprendedor' falla el
-- INSERT en sri_documents.
--
-- Busca el constraint por su definición real, no por un nombre asumido
-- (mismo patrón ya usado en la migración de relajación de la restricción
-- de attendance de esta sesión).

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'public.sri_documents'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%regimen_fiscal_aplicado%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sri_documents DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.sri_documents
  ADD CONSTRAINT sri_documents_regimen_fiscal_aplicado_check
  CHECK (regimen_fiscal_aplicado IN ('rimpe_negocio_popular', 'rimpe_emprendedor', 'general'));
