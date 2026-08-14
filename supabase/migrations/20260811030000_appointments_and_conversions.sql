-- ============================================================
-- Migration: Appointments (Citas Previas / Evaluaciones)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_name                TEXT NOT NULL,
  representative_name         TEXT NOT NULL,
  representative_identification TEXT,
  phone                       TEXT,
  email                       TEXT,
  appointment_date            DATE NOT NULL,
  time_slot                   TEXT NOT NULL DEFAULT '10:00 AM',
  therapy_type                TEXT NOT NULL DEFAULT 'lenguaje',
  assigned_professional       TEXT,
  deposit_amount              NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  consultation_reason         TEXT,
  status                      TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, attended, converted, cancelled
  converted_beneficiary_id    UUID REFERENCES public.beneficiaries(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_appointments"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = appointments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_appointments"
  ON public.appointments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = appointments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = appointments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );
