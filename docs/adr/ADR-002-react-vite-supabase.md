# ADR 002: React, Vite y Supabase

## Contexto
Se requiere una pila tecnológica robusta, tipada y con buena experiencia de desarrollador para la web, y un backend manejado que facilite Auth, base de datos relacional (PostgreSQL) y seguridad.

## Decisión
Se utilizará React con TypeScript y Vite para el frontend web (empaquetado rápido, Ecosistema fuerte). TanStack Query para el manejo de estado remoto. Supabase para Autenticación y acceso autorizado a la base de datos PostgreSQL.

## Consecuencias
- **Positivas:** Reducción de boilerplate para la API CRUD gracias a Supabase JS y RLS; desarrollo ágil con Vite; tipos seguros en toda la aplicación.
- **Negativas:** Acoplamiento inicial a la plataforma Supabase y sus clientes, aunque mitigable separando las llamadas en hooks de acceso a datos.

## Estado
Aprobado
