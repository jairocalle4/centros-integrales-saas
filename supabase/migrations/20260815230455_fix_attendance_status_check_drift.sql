-- ============================================================
-- Fix: attendance.status CHECK constraint drift
--
-- The original migration (20260811010000_user_modules_schema.sql)
-- only allowed ('present','absent','justified','late'), but the live
-- nexokids-dev database's constraint was found to already allow
-- ('present','absent','justified','late','scheduled','rescheduled',
-- 'cancelled') — changed directly on the database at some point,
-- never captured in a migration (the exact drift AGENTS.md's "toda
-- migración debe estar versionada" rule exists to prevent).
--
-- 'scheduled' is not cosmetic: it is now the status every attendance
-- row starts in when created by MatriculaWizard (matrícula, cita
-- rápida→conversión) or by a reposición por falta justificada, and
-- AsistenciaModule reads it directly as "sin registrar todavía". This
-- migration makes the versioned schema match what every environment
-- actually needs, so a fresh database created from these migrations
-- behaves the same as nexokids-dev.
-- ============================================================

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'justified', 'late', 'scheduled', 'rescheduled', 'cancelled'));
