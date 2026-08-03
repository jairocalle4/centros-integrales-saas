# Política de Secretos

- No confirmar archivos `.env`, `.env.local`, `.p12`, `.pfx`, `.key` ni XML/RIDE reales en el repositorio.
- Configurar verificaciones estáticas en CI (secret scanning).
- Los certificados SRI por organización se almacenarán en soluciones seguras (Azure Key Vault, AWS Secrets, o Vault) administradas por el backend .NET, o cifrados en la DB (para desencriptar en memoria durante el uso).
- En desarrollo local, se usarán claves "mock" y el ambiente de certificación SRI.
