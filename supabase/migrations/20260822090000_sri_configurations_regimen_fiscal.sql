-- ============================================================
-- Régimen tributario por centro (RIMPE Negocio Popular vs Régimen
-- General) — controla la tarifa de IVA (0% vs 15%) y si se envía la
-- leyenda RIMPE al emisor en cada factura. Ver computeSriInvoiceTax en
-- supabase/functions/electronic-billing/index.ts.
--
-- DEFAULT 'rimpe_negocio_popular' preserva el comportamiento actual para
-- TODOS los centros existentes — ninguno cambia de tarifa hasta que su
-- dueño elija explícitamente 'general' en Configuración.
-- ============================================================

ALTER TABLE public.sri_configurations
  ADD COLUMN IF NOT EXISTS regimen_fiscal TEXT NOT NULL DEFAULT 'rimpe_negocio_popular';

ALTER TABLE public.sri_configurations DROP CONSTRAINT IF EXISTS sri_configurations_regimen_fiscal_check;
ALTER TABLE public.sri_configurations ADD CONSTRAINT sri_configurations_regimen_fiscal_check
  CHECK (regimen_fiscal IN ('rimpe_negocio_popular', 'general'));
