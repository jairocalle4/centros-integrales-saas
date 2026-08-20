# Reglas Billing (.NET)
Aplica a: `services/electronic-billing/**`

1. **.NET 10 Exclusivo:** Todo debe estar configurado para compilar estrictamente en `net10.0`.
2. **Secretos:** Prohibición absoluta de guardar certificados `.p12`, XML reales o credenciales en código.
3. **Sprint 0:** No comunicar con el SRI. No copiar código de FastStore (ERP original). Solo definir la interfaz `ITaxDocumentProvider` y un mock que falle explícitamente (`NotConfiguredTaxDocumentProvider`).
