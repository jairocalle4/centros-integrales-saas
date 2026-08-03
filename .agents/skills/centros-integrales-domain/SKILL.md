---
name: centros-integrales-domain
description: Reglas de dominio para el SaaS NexoKids (Centros Integrales y Guarderías). Activar al diseñar módulos, tablas, permisos, flujos, planes o reportes.
---

# Skill: Dominio de Centros Integrales (NexoKids)

## Reglas Obligatorias
1. **Un solo SaaS modular:** NO separar aplicaciones para guarderías vs centros integrales.
2. **Entidades Centrales:** Usa estrictamente la nomenclatura: organización, miembro, beneficiario, representante, servicio, paquete, sesión, asistencia, cargo, pago, asignación de pago, gasto, suscripción, entitlement.
3. **Múltiples Representantes:** Un beneficiario siempre debe poder tener múltiples representantes y viceversa.
4. **Pagos Parciales:** Todo sistema de cuentas debe soportar pagos parciales aplicados a un cargo.
5. **No eliminación (Soft Delete o Estado):** No eliminar historiales al desactivar beneficiarios o miembros.
6. **Recibo vs Factura:** Separar recibo interno (administrativo) de comprobante electrónico (SRI).
7. **Reglas Genéricas:** Evitar codificar reglas específicas de un solo centro (ej. "Creciendo Juntos"). Todo debe ser configurable.

**Referencias:** Consulta `docs/product/DOMAIN_MODEL.md` para detalles profundos.
