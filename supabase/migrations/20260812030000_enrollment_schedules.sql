-- ============================================================
-- Migration: Enrollment Schedules (Horario Recurrente Semanal)
-- Cada enrollment_service puede tener múltiples bloques de horario
-- que definen en qué día y hora se dictan las sesiones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.enrollment_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_service_id UUID NOT NULL REFERENCES public.enrollment_services(id) ON DELETE CASCADE,
  day_of_week           SMALLINT NOT NULL
                        CHECK (day_of_week BETWEEN 0 AND 6),
                        -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles,
                        -- 4=Jueves, 5=Viernes, 6=Sábado
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enrollment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_enrollment_schedules"
  ON public.enrollment_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollment_schedules.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_enrollment_schedules"
  ON public.enrollment_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollment_schedules.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollment_schedules.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- También agregar scheduled_time al attendance para registrar
-- la hora programada cuando se registra asistencia desde el horario
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS enrollment_schedule_id UUID REFERENCES public.enrollment_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_time TIME,
  ADD COLUMN IF NOT EXISTS actual_arrival_time TIME,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_enrollment_schedules_org       ON public.enrollment_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_schedules_service   ON public.enrollment_schedules(enrollment_service_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_schedules_day       ON public.enrollment_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_attendance_schedule            ON public.attendance(enrollment_schedule_id);
