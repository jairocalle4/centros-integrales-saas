# Límite del Servicio de Facturación Electrónica

## El Contrato (`ITaxDocumentProvider`)
El módulo administrativo principal y la aplicación React NO CONOCEN del SRI. Solo conocen la idea de generar un comprobante a través del contrato `ITaxDocumentProvider` (o su equivalente REST/gRPC en TypeScript).

## Responsabilidades de `services/electronic-billing`
- Recibir una solicitud de emisión (datos del receptor, detalles, totales).
- Firmar el XML con el certificado `.p12` de esa organización específica.
- Enviar el archivo al web service SOAP del SRI.
- Manejar la lógica de reintentos, validación XSD, concurrencia de secuencias y almacenamiento del RIDE (PDF).

## Restricciones
Durante el Sprint 0 no existe implementación real de este servicio, solo su declaración estructural (`NotConfiguredTaxDocumentProvider`).
