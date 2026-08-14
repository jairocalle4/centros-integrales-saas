# AGENTS.md (Canonical Rules for Agents)

Bienvenido, agente de IA. Al trabajar en este repositorio, debes acatar estas reglas globales y arquitectónicas irrevocables.

## 1. Seguridad y Secretos (Irrevocable)
- NUNCA incluir secretos, certificados ni datos reales en Git, logs, capturas, pruebas o documentación.
- Todos los secretos deben proveerse vía variables de entorno (`.env` local) e inyectarse en CI/CD.

## 2. Multi-tenancy y Row-Level Security (Supabase)
- NUNCA usar `service_role` en el navegador o frontend.
- NUNCA aceptar un identificador de organización (`organization_id`) desde el cliente sin verificar la pertenencia a través de tokens / backend (PostgreSQL RPCs seguras).
- Toda tabla "tenant-owned" (que pertenece a un cliente) DEBE incluir RLS habilitado y políticas explícitas probadas (pruebas de aislamiento).

## 3. Base de Datos
- Toda migración aplicada debe estar versionada (`supabase/migrations/`).
- No modificar una migración ya aplicada en producción; siempre crear una nueva.

## 4. Definición de Hecho (DoD)
- No declarar una tarea terminada con lint, typecheck, compilación o pruebas fallando.
- No ocultar fallos con `any`, desactivación de reglas (eslint-disable) o eliminación de pruebas.
- No inventar resultados: las pruebas de integración con recursos externos deben proveer evidencia o marcarse como bloqueadas si el entorno no lo soporta.

## 5. Arquitectura General
- No realizar despliegues o acciones sobre producción sin autorización explícita.
- No incorporar código del ERP FastStore por copia masiva; solo extraer estratégicamente refactorizando para .NET 10.

## 6. Skills Obligatorias (Regla 00-mandatory-skills)
- Es imperativo acatar la Workspace Rule `.agents/rules/00-mandatory-skills.md` antes de procesar solicitudes. Las skills de dominio, base de datos y UI/UX deben ser leídas completamente en cada contexto nuevo.
