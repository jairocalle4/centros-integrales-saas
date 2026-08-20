# Límite del Servicio de Facturación Electrónica

## El Contrato
El módulo administrativo principal y la aplicación React NO CONOCEN del SRI. Solo conocen la idea de generar un comprobante a través de un único punto de contacto: la Edge Function `supabase/functions/electronic-billing` — la variante en TypeScript del contrato `ITaxDocumentProvider` mencionada en el diseño original.

## Por qué el límite ya no es un único servicio en C#
Tras analizar el ERP existente del usuario (`ERP-STORE-FAST-ConFirmaElectronica`, 5 meses en producción real), se confirmó que ya existe una implementación real, madura y probada de la firma/envío al SRI: el proyecto open-source `open-api-facturacion-sri` (NestJS). Reinventar XSD, XAdES-BES y el cliente SOAP desde cero (como advierte esta misma skill) habría sido trabajo redundante frente a algo ya funcionando. Ver el plan de la sesión que hizo este cambio para el detalle completo del análisis.

## Responsabilidades detrás de la Edge Function
- **Instancia dedicada de `open-api-facturacion-sri`** (separada de la del ERP): recibe la solicitud de emisión, firma el XML con el certificado `.p12` de la organización, lo envía al web service SOAP del SRI, y maneja reintentos, validación y secuenciales.
- **`services/electronic-billing`** (C#, recortado): ya no firma ni habla con el SRI. Su única responsabilidad es generar el RIDE (PDF+QR) a partir de un comprobante ya autorizado.
- **La Edge Function**: único llamador autorizado de ambos servicios; nunca expone sus credenciales ni URLs internas al navegador.

## Restricciones
Nunca exponer certificados `.p12`, contraseñas de la firma, ni el JWT/API key de estos servicios al cliente o en logs/prompts.
