# Contexto del Sistema

NexoKids es un SaaS que interactúa con:
1. **Usuarios (Web):** Representantes, Profesionales, Owners.
2. **Supabase:** Base de datos PostgreSQL (con RLS), Autenticación, Storage.
3. **Electronic Billing Service (.NET 10):** API Privada aislada.
4. **SRI (Servicio de Rentas Internas - Ecuador):** Interacción externa vía SOAP consumida exclusivamente por el Billing Service.
