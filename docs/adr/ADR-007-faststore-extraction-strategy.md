# ADR 007: Estrategia de extracción de FastStore

## Contexto
El repositorio `ERP-STORE-FAST-ConFirmaElectronica` contiene código probado que emite facturas al SRI. No debemos copiar ni portar de forma ciega todo el código de dicho ERP en este Sprint 0, sino usarlo de referencia futura.

## Decisión
La funcionalidad de SRI se mantendrá intacta en su esencia lógica (firma, consumos SOAP, generación XML), pero será extraída, limpiada (refactorizada a ASP.NET Core 10), aislada con RLS/Multi-tenant a futuro, y probada con tests de regresión antes de integrarse. 

Durante el Sprint 0, NO se copia código. Solo se genera el cascarón de la solución C# .NET 10.
El repositorio de referencia se mantiene externo en https://github.com/jairocalle4/ERP-STORE-FAST-ConFirmaElectronica.git
Commit exacto de referencia: `b8aeee8297ede8d2b8b257d2aebb1289946d35f2` y no se incluirá como submódulo. Los componentes se extraerán de forma manual según sea necesario en los siguientes sprints.

## Consecuencias
- **Positivas:** Se asegura la calidad de la adaptación y se previenen problemas de dependencias obsoletas, variables globales o acoplamiento con la base de datos MySQL anterior.
- **Negativas:** La implementación real de facturación se pospone a fases posteriores, priorizando el esqueleto.

## Estado
Aprobado
