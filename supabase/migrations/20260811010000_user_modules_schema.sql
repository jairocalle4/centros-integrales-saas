-- ============================================================
-- Migration: Core domain tables for NexoKids user modules
-- Beneficiaries, Representatives, Services, Charges, Payments
-- ============================================================

-- -------------------------------------------------------
-- 1. BENEFICIARIES (children / students)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  birth_date      DATE,
  photo_url       TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_beneficiaries"
  ON public.beneficiaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = beneficiaries.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_beneficiaries"
  ON public.beneficiaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = beneficiaries.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = beneficiaries.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 2. REPRESENTATIVES (parents / guardians)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.representatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  identification  TEXT,
  phone           TEXT,
  email           TEXT,
  relationship    TEXT,   -- mother, father, guardian, etc.
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_representatives"
  ON public.representatives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = representatives.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_representatives"
  ON public.representatives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = representatives.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = representatives.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 3. BENEFICIARY <-> REPRESENTATIVE (many-to-many)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficiary_representatives (
  beneficiary_id     UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  representative_id  UUID NOT NULL REFERENCES public.representatives(id) ON DELETE CASCADE,
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (beneficiary_id, representative_id)
);

ALTER TABLE public.beneficiary_representatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_ben_rep"
  ON public.beneficiary_representatives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = beneficiary_representatives.beneficiary_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_ben_rep"
  ON public.beneficiary_representatives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = beneficiary_representatives.beneficiary_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.beneficiaries b
        JOIN public.organization_members om ON om.organization_id = b.organization_id
       WHERE b.id = beneficiary_representatives.beneficiary_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 4. SERVICES (actividades / terapias)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_services"
  ON public.services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = services.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_services"
  ON public.services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = services.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = services.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin')
    )
  );

-- -------------------------------------------------------
-- 5. CHARGES (cargos / facturas internas)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.charges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  beneficiary_id  UUID REFERENCES public.beneficiaries(id),
  service_id      UUID REFERENCES public.services(id),
  description     TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'partial', 'paid', 'void')),
  period_label    TEXT,   -- e.g. "Agosto 2026"
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_charges"
  ON public.charges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = charges.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_charges"
  ON public.charges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = charges.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = charges.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 6. INTERNAL_PAYMENTS (pagos internos con soporte parcial)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  charge_id       UUID NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  method          TEXT DEFAULT 'cash' CHECK (method IN ('cash', 'transfer', 'card', 'other')),
  reference       TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.internal_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_internal_payments"
  ON public.internal_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = internal_payments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_create_internal_payments"
  ON public.internal_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = internal_payments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff')
    )
  );

-- -------------------------------------------------------
-- 7. ATTENDANCE (asistencia diaria de beneficiarios)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  beneficiary_id  UUID NOT NULL REFERENCES public.beneficiaries(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'justified', 'late')),
  notes           TEXT,
  recorded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (beneficiary_id, session_date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_attendance"
  ON public.attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = attendance.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
    )
  );

CREATE POLICY "org_members_manage_attendance"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = attendance.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff', 'professional')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = attendance.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role IN ('owner', 'admin', 'staff', 'professional')
    )
  );

-- -------------------------------------------------------
-- 8. Trigger: update payments -> recalc charge status
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_charge_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_charge_id   UUID;
  v_total_paid  NUMERIC;
  v_charge_amt  NUMERIC;
  v_new_status  TEXT;
BEGIN
  -- Determine which charge_id to use depending on operation type
  IF TG_OP = 'DELETE' THEN
    v_charge_id := OLD.charge_id;
  ELSE
    v_charge_id := NEW.charge_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM public.internal_payments
   WHERE charge_id = v_charge_id;

  SELECT amount INTO v_charge_amt
    FROM public.charges
   WHERE id = v_charge_id;

  IF v_total_paid <= 0 THEN
    v_new_status := 'pending';
  ELSIF v_total_paid < v_charge_amt THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'paid';
  END IF;

  UPDATE public.charges
     SET status = v_new_status, updated_at = NOW()
   WHERE id = v_charge_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_charge_status
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_charge_status();

-- -------------------------------------------------------
-- 9. Indexes for performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_beneficiaries_org      ON public.beneficiaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_representatives_org    ON public.representatives(organization_id);
CREATE INDEX IF NOT EXISTS idx_charges_org            ON public.charges(organization_id);
CREATE INDEX IF NOT EXISTS idx_charges_beneficiary    ON public.charges(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_internal_payments_charge ON public.internal_payments(charge_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date    ON public.attendance(organization_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_beneficiary ON public.attendance(beneficiary_id);
