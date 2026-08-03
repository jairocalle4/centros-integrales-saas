# ADR 004: Servicio de Facturación en ASP.NET Core 10

## Contexto
La funcionalidad de facturación electrónica en Ecuador (SRI) ya fue implementada exitosamente en el ERP FastStore usando C# (.NET). 

## Decisión
Se decide crear un servicio privado independiente en `services/electronic-billing` utilizando ASP.NET Core 10 LTS. Este servicio no será accesible directamente desde el frontend web, sino a través de contratos estrictos o un proxy interno, manteniendo la responsabilidad de firmar y emitir comprobantes aislada.

## Consecuencias
- **Positivas:** Reutilización de conocimiento validado y de librerías criptográficas que funcionan correctamente con el SRI en C#; contención de complejidad XML/SOAP.
- **Negativas:** Introduce heterogeneidad en el stack (TypeScript / C#) requiriendo un contrato claro (ej. OpenAPI) y desarrolladores con conocimiento en ambos lenguajes.

## Estado
Aprobado
