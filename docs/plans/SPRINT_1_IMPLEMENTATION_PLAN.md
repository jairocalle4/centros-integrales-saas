# Sprint 1 Implementation Plan: Autenticación, Organizaciones y Configuración Inicial de Supabase

Este plan describe el procedimiento para configurar el proyecto base en la nube de Supabase (entorno de desarrollo) e implementar los módulos críticos de seguridad (login, rutas protegidas, organizaciones y RLS) de forma robusta y con arquitectura Multi-tenancy, acatando las reglas de no exponer secretos ni roles administrativos.

## 1. Conexión del Proyecto `nexokids-dev` en Supabase (Sin `service_role` en Frontend)

### Procedimiento
1. **Creación del proyecto:** Desde el Dashboard de Supabase, crear el proyecto `nexokids-dev` (Región: US East / N. Virginia o preferida, para menor latencia a Ecuador).
2. **Generación de credenciales (backend):** Obtener `SUPABASE_URL` y la clave `service_role` para inyectarla **únicamente** en los servicios backend / server-side (Next.js Edge Functions o Backend .NET, dependiendo de la capa) mediante `.env` (no comiteado).
3. **Credenciales públicas (frontend):** Configurar el entorno web y aplicaciones cliente para utilizar **exclusivamente** `SUPABASE_URL` y la clave `anon` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`).
4. **Enlace del proyecto:** Ejecutar de forma local (con una sesión iniciada):
   ```bash
   pnpm exec supabase link --project-ref <REF_DEL_PROYECTO>
   ```
5. **Despliegue de esquema y reglas (Migraciones):**
   ```bash
   pnpm exec supabase db push
   ```
   Esto asegura que todo el RLS, triggers de seguridad y tipos `ENUM` pasen de manera idéntica al entorno remoto.

> [!WARNING]
> La clave `service_role` **NUNCA** debe ser leída, inyectada ni utilizada en archivos `.tsx`, `.ts` de componentes cliente, Vite build o cualquier proceso ejecutado en el navegador. Las pruebas que simulen acciones administrativas deben realizarse con cuentas dueñas creadas y autenticadas, y las creaciones de organizaciones desde el cliente se harán invocando una función backend o un Edge Function autorizado.

## 2. Autenticación y Autorización (Login y Rutas)

### Objetivos
- **Login:** Flujo de inicio de sesión con email y contraseña, delegando la emisión y validación de tokens JWT nativamente a Supabase Auth.
- **Recuperación de contraseña:** Flujo de correo con enlace seguro y formulario de reseteo.
- **Rutas Protegidas:** Implementar guardias de navegación en la aplicación Web (por ejemplo, mediante Layouts en Next/Vite y Supabase Auth Helpers / SSR).
- **Redirección condicional:**
  - Usuarios no autenticados en ruta privada -> redirección a `/login`.
  - Usuarios autenticados en ruta `/login` -> redirección al dashboard ( `/app` o `/orgs`).

## 3. Organizaciones y Multi-tenancy (Row-Level Security)

### Objetivos
- **Aislamiento Multi-tenant:** Ningún cliente o usuario debe poder cruzar la barrera de su organización (ya probado con RLS pgTAP).
- **Selección de Organización:** Al iniciar sesión, el sistema comprueba las membresías activas.
  - Si el usuario tiene más de una organización activa, se le exige seleccionar un entorno de trabajo.
  - El ID de organización debe proveerse al contexto cliente, pero RLS garantiza en el backend (vía sub/claim) que la lectura es segura.
- **Creación de Organizaciones:** 
  - Diseñar el flujo por el cual un cliente nuevo solicita crear un tenant.
  - *Arquitectura:* Dado que RLS prohíbe explícitamente a `authenticated` insertar organizaciones de forma directa, se construirá o llamará a un servicio de Backend (.NET o Supabase RPC/Edge Function) con capacidad administrativa (`service_role`) para que orqueste: 
    1) la creación del tenant (`organizations`), 
    2) la membresía como `owner` en `organization_members`.

## 4. Gestión de Integrantes, Roles e Invitaciones

### Objetivos
- **Dashboard de Miembros:** Pantalla (solo accesible a `owner` o `admin`) para visualizar usuarios dentro del tenant.
- **Roles y Permisos:**
  - Owner: control total, facturación.
  - Admin: administración de configuración y usuarios (excepto degradar owners).
  - Professional/Staff: roles operativos.
- **Invitaciones (Invitations Workflow):**
  - Tabla de invitaciones (futura migración) o mecanismo de adición directa controlada.
  - El sistema enviará un correo (con Supabase o servicio transaccional) para que un integrante se una al tenant de forma segura, pasando al estado `active`.

## 5. Pruebas y Validación (Sprint 1)

### Objetivos
- Extender `supabase-rls-tests` si se introducen tablas de invitaciones.
- Escribir pruebas E2E (con Playwright o Cypress) enfocadas en el flujo de:
  - Registro ficticio e intento de lectura cruzada en la UI.
  - Verificación de guardias de rutas.
- Mantener cobertura `pnpm verify` con lint y typecheck riguroso en todo el monorepo.

> [!IMPORTANT]
> A la espera de autorización formal para comenzar a escribir código cliente y crear las migraciones de conectividad real (Sprint 1). No se modificarán recursos de producción hasta que las pruebas locales de estos módulos queden cubiertas.
