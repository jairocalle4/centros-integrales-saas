# Estructura del Repositorio

El proyecto utiliza un enfoque monorepo con `pnpm workspaces`:

- `apps/web`: Aplicación frontend en React y Vite.
- `services/electronic-billing`: Microservicio .NET 10 aislado para el SRI.
- `packages/contracts`: Contratos compartidos (ej. OpenAPI/Swagger).
- `packages/shared`: Utilidades de TypeScript.
- `packages/ui`: Componentes UI genéricos (basados en Tailwind).
- `supabase`: Configuraciones y migraciones de DB.
- `docs/`: Documentación de producto, arquitectura, ADRs y seguridad.
- `.agents/`: Skills y reglas para el agente de IA.
