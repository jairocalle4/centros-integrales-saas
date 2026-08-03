# Reglas Globales (Always On)
Aplica a: `**/*`

1. **Seguridad y Secretos:** Nunca incluir secretos, certificados ni datos reales.
2. **Multi-tenancy:** Nunca usar `service_role` en el navegador. Nunca aceptar un identificador de organización sin verificar pertenencia en el servidor.
3. **Definición de Hecho (DoD):** No declarar terminado si lint, typecheck o pruebas fallan. No ocultar fallos.
4. **Migraciones:** Toda migración debe estar versionada.
5. **No despliegues a PROD** en Sprint 0.
