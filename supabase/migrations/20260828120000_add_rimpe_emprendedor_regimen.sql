-- Agrega 'rimpe_emprendedor' como tercer valor válido de régimen
-- tributario (antes solo existían 'rimpe_negocio_popular' y 'general').
-- RIMPE Emprendedor cobra IVA igual que Régimen General (15%) — la única
-- diferencia para efectos de la factura es la leyenda obligatoria
-- ("CONTRIBUYENTE RÉGIMEN RIMPE" en vez de "...NEGOCIO POPULAR...").
-- Ver computeSriInvoiceTax en supabase/functions/electronic-billing/index.ts.
--
-- No cambia el DEFAULT ni ninguna fila existente — ningún centro cambia
-- de régimen hasta que su dueño lo elija explícitamente en Configuración.

ALTER TABLE public.sri_configurations DROP CONSTRAINT IF EXISTS sri_configurations_regimen_fiscal_check;
ALTER TABLE public.sri_configurations ADD CONSTRAINT sri_configurations_regimen_fiscal_check
  CHECK (regimen_fiscal IN ('rimpe_negocio_popular', 'rimpe_emprendedor', 'general'));
