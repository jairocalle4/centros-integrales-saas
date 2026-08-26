-- ============================================================
-- Migration: Relajar la restricción única de attendance
-- Hoy attendance solo permite UNA fila por (beneficiary_id, session_date)
-- en TODO el sistema, sin importar el servicio — esto bloquea el caso
-- real de un beneficiario con dos servicios activos el mismo día (ej.
-- guardería de tiempo completo + una terapia puntual). Se reemplaza por
-- una restricción que incluye service_id: sigue evitando duplicar la
-- MISMA actividad el mismo día, pero permite actividades distintas.
--
-- El nombre de la restricción original nunca se fijó explícitamente
-- (quedó con el nombre autogenerado por Postgres), así que se busca por
-- sus columnas reales en vez de asumir el nombre a ciegas.
-- ============================================================

DO $$
DECLARE
  v_name text;
BEGIN
  SELECT tc.constraint_name INTO v_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'attendance'
    AND tc.constraint_type = 'UNIQUE'
    AND (
      SELECT array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
      FROM information_schema.key_column_usage kcu
      WHERE kcu.constraint_name = tc.constraint_name
        AND kcu.constraint_schema = tc.constraint_schema
    ) = ARRAY['beneficiary_id', 'session_date']::text[]
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_beneficiary_date_service_key UNIQUE (beneficiary_id, session_date, service_id);
