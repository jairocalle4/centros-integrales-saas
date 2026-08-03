# ADR 006: Separación de Entornos DEV y PROD en Supabase

## Contexto
El SaaS manejará datos de menores e historiales sensibles, así como configuraciones de facturación. No es seguro ni escalable utilizar el mismo proyecto Supabase para pruebas/desarrollo y para producción.

## Decisión
Se decide tener una estricta separación de entornos (Local, DEV/Staging, PROD). No se creará un proyecto distinto por cliente, sino un proyecto Supabase DEV para desarrollo/pruebas, y un proyecto PROD para todos los clientes reales aislados por RLS.

## Consecuencias
- **Positivas:** Seguridad, prevención de fugas de datos y cumplimiento con prácticas estándar de CI/CD.
- **Negativas:** Obliga a usar flujos de migraciones controladas (migration files) y nunca depender de cambios manuales en el dashboard de Supabase (ya que no se replicarían fácilmente).

## Estado
Aprobado
