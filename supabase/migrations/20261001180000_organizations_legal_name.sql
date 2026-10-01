-- ============================================================
-- Razón social (nombre legal del titular del RUC) separada del nombre
-- comercial del centro.
--
-- organizations.name se usaba hasta ahora como nombreComercial Y como
-- razonSocial en la factura electrónica (ver electronic-billing/index.ts).
-- Para un contribuyente persona natural (el caso típico de un centro
-- integral pequeño), la razón social legal son los nombres y apellidos
-- del propietario tal como está registrado en el RUC — casi nunca
-- coincide con el nombre comercial ("Centro Integral", "Mi Centrito",
-- etc.). El SRI sí autoriza el comprobante aunque este campo no
-- coincida con el registro real (la autorización en tiempo real valida
-- firma/esquema/estado del RUC, no hace match de texto contra el
-- nombre registrado) — pero el dato queda legalmente incorrecto en el
-- RIDE, detectado en pruebas reales.
--
-- Nullable y con fallback a organizations.name en el código (nunca se
-- asume rellenado — las organizaciones existentes no lo tienen).
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN legal_name text;

COMMENT ON COLUMN public.organizations.legal_name IS
  'Razón social legal del titular del RUC (nombres y apellidos si es persona natural) — distinta del nombre comercial (name). Se usa como razonSocial del emisor en la factura electrónica; si está vacía, se usa name como respaldo.';
