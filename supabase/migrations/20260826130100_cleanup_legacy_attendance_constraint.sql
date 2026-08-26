-- ============================================================
-- Migration: Limpiar restricción duplicada y no versionada en attendance
--
-- Al aplicar la migración anterior (20260826130000) se descubrió que ya
-- existía en la base de datos una restricción UNIQUE
-- (beneficiary_id, session_date, service_id) llamada
-- attendance_beneficiary_session_service_key — con las mismas columnas
-- que la nueva attendance_beneficiary_date_service_key, pero SIN ningún
-- archivo de migración que la haya creado (deuda técnica / drift previo
-- a este cambio). Se elimina la duplicada no versionada y se deja una
-- sola restricción (la creada por la migración anterior, que sí está
-- documentada en el repositorio).
-- ============================================================

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_beneficiary_session_service_key;
