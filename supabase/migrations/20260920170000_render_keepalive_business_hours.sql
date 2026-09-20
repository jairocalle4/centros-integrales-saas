-- ============================================================
-- Restringe el despertador de Render a horario de oficina (Ecuador),
-- en vez de 24/7.
--
-- El cron 24/7 original (20260903160000) mantenía DOS servicios del
-- plan gratuito de Render corriendo sin parar. Render Free da 750
-- horas/mes compartidas en la cuenta — suficiente para 1 instancia
-- corriendo todo el mes, no para 2. A los ~17 días (3 al 20 de
-- septiembre) esa cuota se agotó y Render suspendió ambos servicios
-- (confirmado: HTTP 503 "Service Suspended", header
-- `x-render-routing: suspend` en las dos URLs) — causa real del error
-- "No se pudo autenticar contra el servicio de facturación (HTTP 503)"
-- reportado por el usuario.
--
-- Decisión explícita del usuario mientras no hay clientes reales
-- todavía: en vez de pasar ambos servicios a un plan pago de Render
-- (~$7/mes c/u, la solución de fondo), limitar el ping a un horario de
-- oficina realista para un centro integral, para no volver a agotar la
-- cuota gratuita. Fuera de ese horario los servicios pueden dormirse
-- normalmente — si alguien factura fuera de esa ventana, vuelve a
-- verse el cold-start original de 30-60s (compromiso aceptado a
-- propósito, no un descuido).
--
-- cron.timezone en este proyecto es GMT (UTC) — verificado con
-- `SHOW cron.timezone` antes de escribir esto, no asumido. Ventana:
-- 07:00-18:00 hora Ecuador (UTC-5) = horas UTC 12-22. Con esto, cada
-- servicio acumula ~11h/día en vez de 24h/día -> ~682h/mes combinadas
-- entre los dos, con margen bajo las 750h.
-- ============================================================

SELECT cron.unschedule('render-keepalive-ping');

SELECT cron.schedule(
  'render-keepalive-ping',
  '*/10 12-22 * * *',
  $$
    SELECT net.http_get(url := 'https://centros-integrales-ride.onrender.com/health', timeout_milliseconds := 30000);
    SELECT net.http_get(url := 'https://centros-integrales-sri-api.onrender.com/api-json', timeout_milliseconds := 30000);
  $$
);
