# Propiedad de Datos (Data Ownership)

1. **Aislamiento Férreo (Tenant Isolation):** Todo registro que pertenezca a un cliente (organización) tiene un `organization_id`. Su acceso está restringido vía PostgreSQL RLS.
2. **Propiedad de los Representantes:** Un Representante (tutor) pertenece al sistema globalmente pero su vinculación a un Menor/Organización es local.
3. **Restricción de Borrado (Soft Delete):** No se deben destruir registros financieros o historiales al desactivar a un miembro o niño. Se usan estados (`status = 'inactive'`).
4. **Privacidad de Expedientes:** Los datos sensibles de profesionales o psiquiatras/psicopedagogos solo podrán ser vistos por miembros de esa organización con el rol `Professional` asignado específicamente para ese caso o con permisos elevados.
