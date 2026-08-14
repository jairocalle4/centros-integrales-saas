-- ============================================================
-- Migration: Enrollments (Inscripciones Formales) y Enrollment Services
-- Representa el contrato de servicio entre un beneficiario y el centro
-- ============================================================

-- -------------------------------------------------------
-- 1. ENROLLMENTS — Inscripción formal de un beneficiario
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  beneficiary_id   UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'suspended', 'completed')),
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_enrollments"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_enrollments"
  ON public.enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = enrollments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 2. ENROLLMENT_SERVICES — Servicios/Terapias por inscripción
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollment_services (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id         UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  service_id            UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  sessions_per_week     INTEGER NOT NULL DEFAULT 1,
  session_duration_min  INTEGER NOT NULL DEFAULT 40,
  unit_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_sessions        INTEGER,         -- null = indefinido/mensual
  sessions_completed    INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'completed')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.enrollment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_enrollment_services"
  ON public.enrollment_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
        JOIN public.organization_members om ON om.organization_id = e.organization_id
       WHERE e.id = enrollment_services.enrollment_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_enrollment_services"
  ON public.enrollment_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
        JOIN public.organization_members om ON om.organization_id = e.organization_id
       WHERE e.id = enrollment_services.enrollment_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.enrollments e
        JOIN public.organization_members om ON om.organization_id = e.organization_id
       WHERE e.id = enrollment_services.enrollment_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 3. Vincular charges con enrollments
-- -------------------------------------------------------
ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL;

-- -------------------------------------------------------
-- 4. Indexes para performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_enrollments_org         ON public.enrollments(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_beneficiary ON public.enrollments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_services_enr ON public.enrollment_services(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_charges_enrollment       ON public.charges(enrollment_id);
