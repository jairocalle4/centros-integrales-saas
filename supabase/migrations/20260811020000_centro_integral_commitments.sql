-- ============================================================
-- Migration: Centro Integral specialization
-- Commitments (Acta de Compromiso), Photo Consent, Consultation Reason
-- ============================================================

-- 1. Add fields to beneficiaries
ALTER TABLE public.beneficiaries
  ADD COLUMN IF NOT EXISTS consultation_reason TEXT,
  ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN DEFAULT TRUE;

-- 2. Add fields to attendance for therapy tracking
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS therapy_type TEXT,
  ADD COLUMN IF NOT EXISTS representative_signature BOOLEAN DEFAULT FALSE;

-- 3. Create commitments table
CREATE TABLE IF NOT EXISTS public.commitments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  beneficiary_id            UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  representative_id         UUID REFERENCES public.representatives(id) ON DELETE SET NULL,
  session_duration_minutes  INTEGER NOT NULL DEFAULT 40,
  max_justified_absences    INTEGER NOT NULL DEFAULT 2,
  selected_therapies        JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_frequency         TEXT NOT NULL DEFAULT 'session', -- session, weekly, monthly
  photo_consent             BOOLEAN NOT NULL DEFAULT TRUE,
  status                    TEXT NOT NULL DEFAULT 'signed', -- pending, signed, void
  signed_at                 TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_commitments"
  ON public.commitments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = commitments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_commitments"
  ON public.commitments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = commitments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = commitments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );
