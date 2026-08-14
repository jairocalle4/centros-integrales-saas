-- ============================================================
-- Migration: Session Notes (Registros de avance por sesión)
-- Cada sesión de terapia puede tener un registro de progreso
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_notes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  beneficiary_id        UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  enrollment_service_id UUID REFERENCES public.enrollment_services(id) ON DELETE SET NULL,
  attendance_id         UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
  session_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  therapist_name        TEXT,
  observations          TEXT,          -- Qué se trabajó en la sesión
  goals_achieved        TEXT,          -- Logros del día
  next_steps            TEXT,          -- Plan para próxima sesión
  rating                INTEGER        -- 1-5, progreso general
                        CHECK (rating BETWEEN 1 AND 5),
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_session_notes"
  ON public.session_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = session_notes.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_session_notes"
  ON public.session_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = session_notes.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff', 'professional')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = session_notes.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff', 'professional')
    )
  );

-- Crear bucket en storage para fotos de beneficiarios (si no existe)
-- Este INSERT es idempotente gracias al ON CONFLICT DO NOTHING
INSERT INTO storage.buckets (id, name, public)
VALUES ('beneficiary-photos', 'beneficiary-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy de storage para fotos (usando DO block para idempotencia)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can upload beneficiary photos'
  ) THEN
    CREATE POLICY "Org members can upload beneficiary photos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'beneficiary-photos' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view beneficiary photos'
  ) THEN
    CREATE POLICY "Anyone can view beneficiary photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'beneficiary-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Org members can update beneficiary photos'
  ) THEN
    CREATE POLICY "Org members can update beneficiary photos"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'beneficiary-photos' AND auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_notes_org         ON public.session_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_beneficiary ON public.session_notes(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_date        ON public.session_notes(session_date);
