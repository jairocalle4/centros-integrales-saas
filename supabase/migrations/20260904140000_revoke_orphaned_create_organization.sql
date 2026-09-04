-- ============================================================
-- create_organization(org_name) es una función huérfana: ningún botón
-- del frontend la llama hoy (el alta real de centros pasa por
-- superadmin_create_organization, que sí asigna un plan). Pero seguía
-- siendo invocable por cualquier usuario autenticado vía
-- /rest/v1/rpc/create_organization — creaba una organización nueva y lo
-- dejaba como 'owner', sin ningún plan/suscripción asociado. Como
-- is_organization_active() permite acceso cuando NO existe ninguna fila
-- en subscriptions ("grace period for newly created orgs"), un centro
-- creado por esta vía quedaba activo indefinidamente sin pagar nunca —
-- una cuenta gratis permanente. Hallazgo real de `supabase db advisors`.
--
-- Se revoca el permiso en vez de borrar la función: conserva el
-- historial de qué existía, y evita romper algo si en el futuro se
-- decide reactivar un alta de centro auto-servicio a propósito (en ese
-- caso, sería una decisión explícita, no un descuido).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.create_organization(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization(text) FROM anon;
