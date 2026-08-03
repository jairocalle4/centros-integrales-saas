# Reglas Supabase
Aplica a: `supabase/**`

1. **RLS (Row-Level Security):** Toda tabla tenant-owned debe incluir RLS y pruebas de aislamiento (que un usuario A no pueda leer/escribir de B).
2. **Migraciones:** No modificar migraciones aplicadas.
3. **Roles y Permisos:** Evitar recursión en políticas RLS y controlar el `search_path` en las funciones (RPCs). Impedir escalamiento de privilegios por parte de un usuario.
4. **Sprint 0:** No conectarse a proyectos remotos (PROD).
