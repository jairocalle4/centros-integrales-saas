# Despertador de los servicios de Render (plan gratuito)

Documento de referencia — léelo completo antes de tocar el keepalive o de replicarlo en un
servicio nuevo. Escrito después de un incidente real (ver "Qué pasó" abajo), no es una guía
teórica: cada número aquí fue verificado contra el dashboard de Render y la base de datos real
del proyecto, no supuesto.

## El problema que resuelve

`services/electronic-billing` (RIDE, .NET) y la instancia dedicada de `open-api-facturacion-sri`
(SRI API, NestJS) — ver `ELECTRONIC_BILLING_BOUNDARY.md` — corren en el **plan gratuito de
Render**. Ese plan duerme cualquier servicio web tras ~15 minutos sin tráfico, y el siguiente
request tarda 30-60+ segundos en "despertarlo" (cold start). Sin mitigación, el primer intento de
facturar después de un rato de inactividad se ve como un timeout o un 504 para el usuario.

## Cómo se construyó

En vez de un servicio externo gratuito de "pinging" (el mismo tipo de servicio que ya se
autodesactivó una vez en el ERP del usuario tras varios pings fallidos seguidos), se reutiliza
**pg_cron** (ya instalado en el proyecto para `enforce_payment_grace_period`) junto con
**pg_net**, que permite hacer HTTP asíncrono desde el propio Postgres. Un job de pg_cron llama
`net.http_get()` contra un endpoint liviano y de solo lectura de cada servicio, con la frecuencia
suficiente para que Render nunca los vea inactivos.

```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'render-keepalive-ping',
  '<expresión cron>',
  $$
    SELECT net.http_get(url := 'https://centros-integrales-ride.onrender.com/health', timeout_milliseconds := 30000);
    SELECT net.http_get(url := 'https://centros-integrales-sri-api.onrender.com/api-json', timeout_milliseconds := 30000);
  $$
);
```

Detalles que importan si vas a tocar esto:
- `net.http_get` es **asíncrono** — devuelve un id de solicitud de inmediato sin esperar la
  respuesta real, así que ni un cold-start de 60s ni un servicio completamente caído cuelgan el
  cron. La respuesta real (si llega) queda en `extensions.net._http_response`, consultable después.
- `timeout_milliseconds` se sube a 30000 — el default de pg_net son solo 2s, insuficiente para un
  cold-start real.
- Los endpoints se eligieron por ser **livianos, de solo lectura y sin autenticación** — no hace
  falta ni conviene usar las credenciales reales de cada servicio solo para mantenerlo despierto:
  - RIDE (.NET): `/health` — definido en `Program.cs`, devuelve `{ status: "Healthy" }`.
  - SRI API (NestJS): `/api-json` — el esquema OpenAPI/Swagger autogenerado.
  - El código de respuesta HTTP no importa para este propósito — basta con que Render reciba
    tráfico, incluso un 401/404 cuenta como actividad.
- El job se llama siempre `render-keepalive-ping` — para cambiar el horario o los servicios,
  **nunca edites la migración ya aplicada** (regla del proyecto). Crea una migración nueva que
  haga `SELECT cron.unschedule('render-keepalive-ping');` seguido de un `cron.schedule(...)` con
  el mismo nombre y la nueva expresión cron — así el histórico queda documentado en
  `supabase/migrations/` en vez de perderse.
- `cron.timezone` en este proyecto es **GMT/UTC** — verificado con
  `SELECT setting FROM pg_settings WHERE name = 'cron.timezone';` antes de escribir cualquier
  horario, nunca asumido. Ecuador es UTC-5 sin horario de verano, así que "hora Ecuador" = "hora
  UTC − 5".

Migraciones reales de este mecanismo (orden cronológico):
1. `supabase/migrations/20260903160000_render_keepalive_ping.sql` — versión original, `*/10 * * * *`
   (cada 10 min, 24/7, los dos servicios).
2. `supabase/migrations/20260920170000_render_keepalive_business_hours.sql` — la reemplaza por
   `*/10 12-22 * * *` (horas UTC 12-22 = 07:00-18:00 Ecuador) tras el incidente descrito abajo.

Verificar el estado real en cualquier momento (no asumir que sigue como dice este documento — los
documentos se desactualizan, la base no):
```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'render-keepalive-ping';
```

## Qué pasó (el incidente que motivó la versión 2)

Render Free da **750 horas de instancia por mes, compartidas entre todos los servicios gratuitos
de la cuenta** (no por servicio individual) — confirmado contra la documentación y comunidad de
Render, no asumido. Un mes tiene ~730-744 horas, así que 750h alcanza para UN servicio corriendo
24/7 todo el mes, con muy poco margen.

La versión 1 del cron mantenía **dos** servicios corriendo sin parar, 24/7: eso es ~48h de
consumo por cada día calendario contra un cupo mensual pensado para ~24h/día. Del 3 al 20 de
septiembre (17 días) el cupo se agotó, y Render suspendió los dos servicios — confirmado en tres
niveles independientes, no por un solo indicio:
1. `curl -sI https://centros-integrales-sri-api.onrender.com/api-json` → `HTTP/1.1 503`, header
   `x-render-routing: suspend`, cuerpo `"This service has been suspended."`.
2. El dashboard de Render mostró la etiqueta roja **"Suspended by Render"** en los dos servicios.
3. La página de cada servicio mostró el banner exacto: *"Free usage limit reached. Your service is
   now suspended until the next billing period. To resume the service immediately, upgrade its
   compute plan."*

El síntoma visible para el usuario fue el error real de la Edge Function:
`No se pudo autenticar contra el servicio de facturación (HTTP 503)` — el login contra la SRI API
(`getSriApiToken` en `supabase/functions/electronic-billing/index.ts`) fallaba porque el servicio
estaba suspendido, no dormido (un cold-start normal sí se recupera solo con los reintentos que ya
tiene ese código; una suspensión de Render no).

**El reset es por mes calendario**, no por aniversario de la cuenta — confirmado contra la
documentación de Render. Para saber cuánto falta: `Billing` en el dashboard de Render, o
simplemente contar los días hasta el día 1 del mes siguiente. Una suspensión por cupo agotado NO
se levanta antes de esa fecha salvo que se pase el servicio a un plan pago (el botón "Upgrade
compute plan" en el banner rojo de cada servicio) — no hay forma de acelerarlo desde código ni
desde este proyecto.

## Cómo evitar que se repita — análisis, no solo el parche

La versión 2 (horario de oficina, 07:00-18:00 Ecuador en los dos servicios) fue el arreglo rápido
elegido explícitamente por el usuario mientras no hay clientes reales — reduce cada servicio de
~24h/día a ~11h/día, dejando el consumo combinado (~682h/mes) bajo las 750h con margen.

Pero los dos servicios **no tienen la misma criticidad**, y vale la pena una estrategia más fina
la próxima vez que se ajuste esto:

- **SRI API es un bloqueador duro**: si está dormida o inalcanzable, `handleEmit` nunca llega a
  autenticarse y la factura completa falla — no hay forma de recuperarla sin que el usuario
  reintente toda la operación.
- **RIDE es recuperable**: si está dormido y la generación del PDF falla o se demora, la factura
  ya quedó `AUTHORIZED` ante el SRI (lo que legalmente importa) — el pago no se pierde, y existe
  un botón "Reintentar" explícito en el módulo Facturas para regenerar solo el RIDE después. El
  propio código ya tiene reintentos con backoff (`resilientFetch`) pensados para absorber un
  cold-start normal en un solo intento.

Esa asimetría implica que, si hay que priorizar presupuesto de horas, **SRI API merece más
ventana activa que RIDE, no la misma**. De hecho, matemáticamente: mantener **un solo** servicio
despierto 24/7 todo el mes consume ~720-744h (según el mes tenga 30 o 31 días) — por debajo de las
750h con margen ajustado pero real, sin restringir ningún horario. Mantener los dos 24/7 es
exactamente lo que ya falló. Si en el futuro se decide dar más prioridad a SRI API:
- SRI API: ping 24/7 (o con una ventana muy amplia, ej. dejando solo 1-2h/día sin pings de
  madrugada como margen de seguridad).
- RIDE: sin keepalive, o con una ventana bastante más angosta (ej. solo horas pico) — sus
  cold-starts ya son tolerables gracias al reintento existente.

No se aplicó este ajuste más fino todavía porque implica volver a tocar el cron después de que
termine la suspensión actual (1 de octubre) — queda documentado aquí para que quien continúe este
trabajo (humano o IA) lo evalúe con el usuario antes de aplicarlo, no lo decida solo (ver regla
"Aprobación para Cambios Mayores" en `.claude/rules/00-mandatory-skills.md`).

## Receta para replicarlo en un servicio nuevo

Antes de copiar este patrón a cualquier otro servicio del plan gratuito de Render:

1. **Confirma que de verdad lo necesita.** Si el servicio tolera cold-starts (tiene reintentos,
   no es parte de un flujo síncrono crítico, o su primer uso del día ya absorbe el cold-start sin
   que nadie lo note), probablemente no necesita keepalive en absoluto — cada servicio agregado
   suma directo al presupuesto de horas.
2. **Súmalo al presupuesto combinado, no lo pienses aislado.** El cupo de 750h/mes se comparte
   entre TODOS los servicios gratuitos de la cuenta, no solo entre los dos de este proyecto —
   revisa `Suspended (0)`/`Active` en el dashboard de Render para ver si hay otros consumiendo del
   mismo cupo antes de calcular cuánto margen queda de verdad.
3. **Calcula antes de programar:** `horas/día del servicio × 30 × cantidad de servicios en
   keepalive ≤ ~700` (deja margen bajo 750, no lo topes exacto). Con eso decide la ventana horaria
   de cada uno — no asumas que 24/7 para todos es seguro solo porque "antes funcionó".
4. **Reutiliza el mismo cron, no crees uno nuevo por servicio.** Agrega la nueva URL como una
   línea más de `net.http_get` dentro del mismo job `render-keepalive-ping` (o ajusta su horario
   si el nuevo servicio necesita uno distinto al de los actuales — en ese caso sí conviene un
   segundo `cron.schedule` con otro nombre de job, para no forzar a todos los servicios a compartir
   una sola ventana horaria).
5. **Usa un endpoint de solo lectura sin credenciales** para el ping — nunca la ruta real de
   negocio ni las API keys del servicio.
6. **Verifica siempre `cron.timezone` con una consulta real** antes de escribir horas UTC a mano
   — no lo copies de este documento sin confirmar que sigue igual.
7. **Nunca edites una migración de keepalive ya aplicada** — `cron.unschedule` +
   `cron.schedule` del mismo nombre, en una migración nueva.
