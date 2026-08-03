# Modelo de Dominio

El dominio central modela la operación de guarderías y centros integrales, considerando:
- **Organización (Tenant):** El negocio en sí mismo.
- **Miembro:** Un usuario asociado a la organización con un Rol específico.
- **Beneficiario / Estudiante:** El menor que recibe el servicio.
- **Representante:** El tutor, madre, padre o encargado. Un beneficiario puede tener múltiples representantes y un representante puede tener múltiples beneficiarios.
- **Servicio:** Actividad u oferta (ej. Guardería, Terapia de Lenguaje).
- **Paquete / Modalidad:** Agrupación de servicios o esquema de cobro.
- **Sesión / Asistencia:** Registro temporal de un servicio prestado.
- **Cargo:** Obligación de pago por un servicio.
- **Pago:** Transacción financiera. Un pago puede aplicarse parcial o totalmente a uno o varios cargos.
- **Suscripción / Entitlement:** Reglas y límites de módulos accesibles para la Organización según su plan comercial en NexoKids.
