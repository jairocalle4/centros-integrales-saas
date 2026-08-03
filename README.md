# NexoKids - Sistema Administrativo SaaS

## Objetivo del Producto
NexoKids es un SaaS multi-tenant diseñado para la gestión integral de guarderías y centros educativos en Ecuador. El sistema permite a cada centro gestionar sus clientes, planes y flujos operativos de forma aislada, garantizando privacidad y seguridad total sobre sus datos.

## Arquitectura
* **Monorepo:** Gestionado con `pnpm` workspaces (Corepack).
* **Frontend:** Aplicación SPA React 19, Vite, y Tailwind CSS v4, ubicada en `apps/web`.
* **Backend de Facturación:** Microservicio autónomo desarrollado en ASP.NET Core 10 (`net10.0`), ubicado en `services/electronic-billing`.
* **Base de Datos & Auth:** Supabase (PostgreSQL). Utiliza estricto aislamiento Row-Level Security (RLS) para separar a los inquilinos (Tenants).

## Requisitos de Entorno
* **Node.js:** v24 o superior.
* **Gestor de Paquetes:** pnpm v11 (habilitado con Corepack).
* **Supabase CLI:** Herramienta local (instalada vía `devDependencies`, ejecutada como `pnpm exec supabase`).
* **Docker Desktop:** Requerido para levantar Supabase localmente.
* **.NET SDK:** Versión `10.0.x`.

## Preparación Local
1. Clona el repositorio.
2. Asegúrate de tener Node.js 24 y .NET 10 instalados.
3. Habilita Corepack e instala dependencias:
   ```bash
   corepack enable
   corepack pnpm install
   ```
4. Levanta el entorno local de Supabase (requiere Docker):
   ```bash
   pnpm exec supabase start
   ```

## Comandos Principales
* `pnpm verify`: Ejecuta linting, typecheck, tests web, build web y tests de la solución .NET.
* `pnpm dev`: Inicia el servidor de desarrollo del Frontend web.
* `pnpm exec supabase db lint --level error`: Audita la seguridad de la base de datos local.
* `pnpm exec supabase test db`: Ejecuta las pruebas pgTAP de aislamiento (RLS).

## Estado Real del Sprint 0
Actualmente, el proyecto se encuentra con la **arquitectura base implementada y auditada**, con flujos de integración continua en GitHub Actions, configuraciones de RLS y Supabase, aplicación base React Vite montada y solución vacía pero probada de .NET. Todavía no existen características de negocio implementadas ni un módulo completo de UI de autenticación.

> [!CAUTION]
> **Prohibición de Producción:** Este código y configuración está **estrictamente en fase de desarrollo (Sprint 0)**. No se autoriza el despliegue de esta aplicación a entornos productivos reales. El aislamiento de Supabase funciona, pero no existen variables de entorno ni configuraciones SSL para un ambiente productivo. No conectar a proyectos de Supabase en producción bajo ninguna circunstancia.
