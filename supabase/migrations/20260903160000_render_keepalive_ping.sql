-- ============================================================
-- Despertador de los servicios de facturación electrónica en el tier
-- gratuito de Render (services/electronic-billing y la instancia
-- dedicada de open-api-facturacion-sri): sin tráfico por ~15 min,
-- Render duerme la instancia y el siguiente request tarda 30-60+s en
-- "despertarla" — causa raíz confirmada del 504 de hoy (el servicio
-- de RIDE estaba dormido durante "Guardar y Facturar").
--
-- pg_net (disponible en este proyecto, nunca instalado hasta ahora)
-- permite hacer HTTP asíncrono desde el propio Postgres, así que se
-- reutiliza el pg_cron ya instalado (enforce_payment_grace_period,
-- migración 20260903140000) en vez de depender de un pinger externo
-- gratuito — el mismo tipo de servicio que ya se autodesactivó en el
-- ERP del usuario tras varios pings fallidos seguidos contra un
-- servicio completamente dormido.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Cada 10 minutos, día y noche — cómodamente por debajo del umbral de
-- inactividad de Render, así que ninguno de los dos servicios debería
-- volver a dormirse del todo (y ya no hace falta entrar manualmente
-- cada mañana a "precalentarlos"). net.http_get es asíncrono (devuelve
-- un id de solicitud de inmediato, sin bloquear el cron esperando a
-- que el servicio realmente responda) — incluso el primer ping en frío
-- nunca cuelga el job. timeout_milliseconds se amplía a 30s (el
-- default de pg_net son solo 2s, insuficiente para un cold-start real)
-- para que, si alguna vez sí llega a estar dormido, quede una
-- respuesta real en net._http_response en vez de un timeout.
--
-- Endpoints elegidos por ser livianos y de solo lectura, sin requerir
-- las credenciales/API keys reales de cada servicio:
--   - RIDE (.NET): /health — definido explícitamente en Program.cs,
--     sin autenticación (devuelve { status: "Healthy" }).
--   - open-api-facturacion-sri (NestJS): /api-json — el esquema
--     OpenAPI/Swagger autogenerado, ya usado en esta sesión para
--     verificar el contrato real de Nota de Crédito.
-- El código de respuesta no importa para el propósito de esto: basta
-- con que Render reciba tráfico para no dormir la instancia, incluso
-- si alguno respondiera 401/404.
SELECT cron.schedule(
  'render-keepalive-ping',
  '*/10 * * * *',
  $$
    SELECT net.http_get(url := 'https://centros-integrales-ride.onrender.com/health', timeout_milliseconds := 30000);
    SELECT net.http_get(url := 'https://centros-integrales-sri-api.onrender.com/api-json', timeout_milliseconds := 30000);
  $$
);
