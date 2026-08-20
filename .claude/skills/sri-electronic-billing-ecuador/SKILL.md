---
name: sri-electronic-billing-ecuador
description: Reglas para extraer, auditar o implementar la facturación electrónica SRI (Ecuador). Activar únicamente en dicho dominio.
---

# Skill: Facturación Electrónica SRI (Ecuador)

## Reglas Obligatorias
1. **No inventar integraciones:** El repositorio FastStore ya emite comprobantes. No reimplementes XSD, algoritmos de firma o SOAP desde cero sin verificar su estado previo.
2. **Aislamiento (`ITaxDocumentProvider`):** La facturación debe estar detrás de un contrato estricto en C# / ASP.NET Core 10.
3. **Ambiente de Certificación Primero:** Todas las pruebas deben hacerse en certificación.
4. **Protección de Datos Reales:** Nunca expongas certificados `.p12`, contraseñas, RIDE reales ni XML de clientes en el repositorio o en los prompts.
5. **Robustez:** Implementar idempotencia, secuenciales concurrentes seguros y reintentos.
6. **Sprint 0 Restricciones:** Durante el Sprint 0, NO consumas SRI ni copies código de FastStore; solo prepara la estructura.

**Referencias:** Consulta `docs/architecture/ELECTRONIC_BILLING_BOUNDARY.md`.
