# ADR 003: Multi-tenancy mediante Row-Level Security (RLS)

## Contexto
El SaaS servirá a múltiples guarderías y centros integrales. Cada organización debe tener sus propios datos aislados y privacidad estricta.

## Decisión
Se decide utilizar el mecanismo de Row-Level Security (RLS) nativo de PostgreSQL (vía Supabase). Todas las tablas pertenecientes a un inquilino (tenant) deberán tener la columna `organization_id` y políticas (Policies) que restrinjan las operaciones (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) únicamente a los miembros de la organización que tengan el rol adecuado.

## Consecuencias
- **Positivas:** Seguridad a nivel de base de datos, evitando que errores de lógica en el frontend (o backend proxy) expongan datos cruzados.
- **Negativas:** Las consultas complejas o migraciones requieren un cuidado estricto; se debe testear exhaustivamente para no impactar rendimiento ni omitir políticas.

## Estado
Aprobado
