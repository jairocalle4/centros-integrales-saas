# ADR 001: Monorepo con pnpm workspaces

## Contexto
El SaaS requiere un frontend web (React), un backend aislado para facturación electrónica (.NET), infraestructura de base de datos (Supabase) y paquetes compartidos (contratos, UI, utilidades). 

## Decisión
Se decide adoptar una arquitectura de monorepo utilizando `pnpm workspaces` para gestionar las dependencias de TypeScript/Node, integrando todas las piezas del sistema en el mismo repositorio (NexoKids).

## Consecuencias
- **Positivas:** Facilita la refactorización transversal, consistencia de versiones, y agilidad en el desarrollo de funcionalidades de punta a punta.
- **Negativas:** La configuración de CI debe ser lo suficientemente inteligente para solo construir lo que ha cambiado. Para .NET, se gestionará su solución (sln) propia en `services/electronic-billing`, independiente de pnpm pero dentro del mismo repo.

## Estado
Aprobado
