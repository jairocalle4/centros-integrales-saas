-- ============================================================
-- sri_documents: snapshot del comprador + régimen/ambiente aplicados,
-- y seguimiento del envío por correo.
--
-- Por qué el snapshot (no solo cliente_identificacion): handleRetry
-- reenvía el XML ya firmado tal cual — el comprador, régimen y ambiente
-- que ese XML realmente contiene quedaron fijados en el intento
-- original. Si handleRetry re-consultara beneficiary_representatives /
-- sri_configurations "en vivo" para regenerar el RIDE, un cambio
-- posterior (representante editado, cambio de régimen o de ambiente)
-- produciría un RIDE que muestra datos DISTINTOS a los del XML
-- realmente reenviado al SRI. Estas columnas son la única fuente de
-- verdad para cualquier regeneración posterior del RIDE o reenvío de
-- correo.
--
-- cliente_razon_social / cliente_email quedan NULLABLE sin default: para
-- filas preexistentes a esta migración no tenemos ese dato histórico y
-- no queremos afirmar una suposición como si fuera un hecho (el código
-- que las lee ya maneja el NULL explícitamente). regimen_fiscal_aplicado
-- y environment_aplicado sí llevan DEFAULT porque para filas viejas SÍ
-- sabemos con certeza (regimen) o con alta probabilidad (ambiente, dado
-- que el proyecto sigue en fase de pruebas) cuál era el único
-- comportamiento posible antes de este cambio.
-- ============================================================

ALTER TABLE public.sri_documents
  ADD COLUMN IF NOT EXISTS cliente_razon_social TEXT,
  ADD COLUMN IF NOT EXISTS cliente_email TEXT,
  ADD COLUMN IF NOT EXISTS regimen_fiscal_aplicado TEXT NOT NULL DEFAULT 'rimpe_negocio_popular',
  ADD COLUMN IF NOT EXISTS environment_aplicado TEXT NOT NULL DEFAULT 'pruebas',
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_sent_to TEXT;

ALTER TABLE public.sri_documents DROP CONSTRAINT IF EXISTS sri_documents_regimen_fiscal_aplicado_check;
ALTER TABLE public.sri_documents ADD CONSTRAINT sri_documents_regimen_fiscal_aplicado_check
  CHECK (regimen_fiscal_aplicado IN ('rimpe_negocio_popular', 'general'));

ALTER TABLE public.sri_documents DROP CONSTRAINT IF EXISTS sri_documents_environment_aplicado_check;
ALTER TABLE public.sri_documents ADD CONSTRAINT sri_documents_environment_aplicado_check
  CHECK (environment_aplicado IN ('pruebas', 'produccion'));
