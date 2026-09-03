-- Fix de la migración anterior (20260903140000): Supabase otorga EXECUTE
-- a anon/authenticated/service_role de forma independiente a PUBLIC en
-- cada función nueva (ALTER DEFAULT PRIVILEGES propio del proyecto) —
-- revocar solo de PUBLIC y authenticated no alcanzó; "anon" (visitantes
-- sin autenticar, con la anon key pública) todavía podía invocar
-- enforce_payment_grace_period() vía RPC. Verificado con
-- information_schema.routine_privileges tras aplicar la migración
-- anterior. service_role se deja intacto (requiere la clave secreta,
-- nunca expuesta al navegador — regla irrevocable de AGENTS.md).

REVOKE EXECUTE ON FUNCTION public.enforce_payment_grace_period() FROM anon;
