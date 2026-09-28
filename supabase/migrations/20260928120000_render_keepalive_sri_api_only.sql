-- ============================================================
-- Despertador de Render: solo la SRI API, no RIDE.
--
-- De los dos servicios que despertaba este cron, solo la SRI API
-- (open-api-facturacion-sri) es un bloqueador duro: si está dormida, no
-- se puede ni autenticar ni emitir factura (ver getSriApiToken en
-- supabase/functions/electronic-billing/index.ts). RIDE
-- (services/electronic-billing) ya tiene reintento con backoff
-- (resilientFetch) y un botón manual "Reintentar" en el módulo Facturas
-- si el PDF falla por un cold-start — la factura ya quedó AUTHORIZED
-- ante el SRI de todas formas, así que no necesita el mismo nivel de
-- protección. Análisis completo en docs/architecture/RENDER_KEEPALIVE.md,
-- decisión explícita del usuario tras revisar las opciones.
--
-- Horario: 07:00-20:00 hora Ecuador (13h/día), elegido por el usuario en
-- vez de 24/7 (que también hubiera sido seguro con un solo servicio,
-- ~720-744h/mes) o de una ventana de 1 hora. cron.timezone en este
-- proyecto es GMT/UTC (verificado con SHOW cron.timezone, no asumido).
-- Ecuador es UTC-5, así que:
--   UTC 12-23      = Ecuador 07:00-18:59
--   UTC 0           = Ecuador 19:00-19:59
--   0,12-23 (UTC)   = Ecuador 07:00-20:00 en punto
-- Presupuesto resultante: 13h/día x 31 días =~ 403h/mes, muy por debajo
-- de las 750h/mes gratis compartidas de la cuenta.
-- ============================================================

SELECT cron.unschedule('render-keepalive-ping');

SELECT cron.schedule(
  'render-keepalive-ping',
  '*/10 0,12-23 * * *',
  $$
    SELECT net.http_get(url := 'https://centros-integrales-sri-api.onrender.com/api-json', timeout_milliseconds := 30000);
  $$
);
