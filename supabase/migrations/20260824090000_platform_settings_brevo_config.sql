-- ============================================================
-- Configuración de Brevo (envío de facturas por correo) editable desde
-- el panel de superadmin, en vez de un secreto fijo de la Edge Function
-- — así se puede rotar la API Key sin redeploy. Vive en
-- platform_settings porque es una sola cuenta de Brevo compartida por
-- toda la plataforma, no algo por organización.
--
-- La tabla ya tiene RLS que restringe SELECT/UPDATE a
-- is_platform_admin(auth.uid()) (política platform_admins_view_settings /
-- platform_admins_update_settings, migración 20260805120000) — no hace
-- falta ninguna política nueva. El frontend nunca vuelve a leer
-- brevo_api_key hacia un campo de formulario (queda write-only, igual
-- que la contraseña del certificado .p12 en ElectronicBillingSettings) —
-- solo se usa para calcular un booleano de "configurada" en memoria.
-- ============================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS brevo_api_key TEXT,
  ADD COLUMN IF NOT EXISTS brevo_sender_email TEXT,
  ADD COLUMN IF NOT EXISTS brevo_sender_name TEXT;
