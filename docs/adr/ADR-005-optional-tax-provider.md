# ADR 005: Proveedor de impuestos opcional (TaxProvider)

## Contexto
No todas las organizaciones necesitan facturación electrónica SRI en un principio, y la facturación electrónica es modular. Además, acoplar el núcleo del SaaS a facturación directa generaría dependencias duras.

## Decisión
Se decide crear un contrato desacoplado equivalente a `ITaxDocumentProvider` (o una interfaz en el frontend para llamar al endpoint). Durante la fase administrativa básica, este proveedor será implementado como un "NotConfiguredTaxDocumentProvider" que fallará de forma controlada. Solo cuando la organización tenga el complemento activo se enrutará a la implementación real de facturación del SRI.

## Consecuencias
- **Positivas:** Desacoplamiento total del núcleo administrativo de las reglas del SRI. Facilita probar flujos administrativos sin certificados ni dependencias complejas.
- **Negativas:** Se debe abstraer cuidadosamente el concepto de recibo interno (no válido tributariamente) frente a comprobante fiscal (válido).

## Estado
Aprobado
