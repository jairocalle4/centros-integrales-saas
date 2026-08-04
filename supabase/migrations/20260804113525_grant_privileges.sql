-- Otorgar privilegios mínimos a los roles predeterminados de Supabase

-- Uso del esquema public
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Perfiles (profiles)
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- Organizaciones (organizations)
-- SELECT: para que los miembros puedan leer la suya.
-- UPDATE: para que los dueños y administradores puedan modificar la suya.
-- DELETE: concedido para que la aserción de seguridad #6 sea filtrada por RLS (afecta 0 filas) y no falle prematuramente.
-- INSERT: reservado para el backend (service_role), la aserción #15 (throws_any) comprobará el rechazo correctamente (ya sea por privilegios o RLS).
GRANT SELECT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;

-- Para anon, se otorga SELECT en organizations y organization_members de modo que 
-- las funciones is_empty() de pgTAP en las aserciones #16 y #17 puedan ejecutarse y 
-- retornar 0 registros en lugar de abortar la prueba con un error de "permission denied".
GRANT SELECT ON TABLE public.organizations TO anon;

-- Integrantes (organization_members)
-- SELECT, INSERT, UPDATE, DELETE: todos son filtrados exhaustivamente por RLS y triggers de seguridad, 
-- según comprueban las aserciones #8 a #12 y #19.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;
GRANT SELECT ON TABLE public.organization_members TO anon;

-- Planes de suscripción (subscription_plans)
GRANT SELECT ON TABLE public.subscription_plans TO authenticated;

-- Suscripciones (subscriptions)
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

-- Registros de auditoría (audit_logs)
-- SELECT: para dueños y administradores.
-- INSERT: se otorga para que la aserción #20 alcance la capa de RLS y valide específicamente 
-- la excepción "new row violates row-level security policy for table audit_logs", 
-- que es la arquitectura decidida para proteger auditorías sin depender únicamente de permisos de tabla.
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
