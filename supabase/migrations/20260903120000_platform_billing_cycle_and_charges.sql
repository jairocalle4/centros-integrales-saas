-- ============================================================
-- Facturación de plataforma (NexoKids cobrando a sus centros tenant):
-- el ciclo mensual/anual pasa a ser una propiedad persistente de la
-- suscripción, y se agrega platform_charges — el equivalente, a nivel
-- de plataforma, de `charges` en el dominio centro→familia (regla de
-- dominio: "cargo" y "pago" son entidades separadas).
--
-- Hoy asignar un plan (superadmin_assign_plan) no genera ningún cobro
-- — el ciclo solo se elegía ad-hoc al registrar un pago y se
-- descartaba después. Esta migración es solo el schema; la migración
-- siguiente (20260903130000) reescribe las RPCs que lo usan.
-- ============================================================

ALTER TABLE public.subscriptions
  ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual'));

-- Sin estado 'partial': a diferencia de `charges` (que sí soporta pagos
-- parciales, regla de dominio), superadmin_register_payment ya exigía
-- desde antes de esta migración que el pago coincida EXACTO con el
-- precio del plan/ciclo — no existe "pagar la mitad de una suscripción
-- SaaS" en el negocio actual. Este diseño solo conserva esa regla ya
-- vigente.
CREATE TABLE public.platform_charges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES public.subscription_plans(id),
  billing_cycle   TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_date        TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  period_label    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_charges_org ON public.platform_charges(organization_id);

-- Invariante a nivel de BD: nunca dos cargos "pending" simultáneos para
-- el mismo centro (además sirve de índice de acceso directo al pendiente).
CREATE UNIQUE INDEX idx_platform_charges_one_pending_per_org
  ON public.platform_charges(organization_id) WHERE status = 'pending';

ALTER TABLE public.platform_charges ENABLE ROW LEVEL SECURITY;

-- Mismo patrón exacto que las políticas SELECT ya existentes de "payments".
CREATE POLICY "Admins can view all platform charges"
  ON public.platform_charges FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Owners can view own platform charges"
  ON public.platform_charges FOR SELECT TO authenticated
  USING (public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[]));

-- Sin políticas INSERT/UPDATE: igual que `payments` hoy, toda escritura
-- pasa por RPCs SECURITY DEFINER (superadmin_assign_plan / superadmin_register_payment).
GRANT SELECT ON TABLE public.platform_charges TO authenticated;

-- Vínculo del pago histórico al cargo que salda. Nullable: los pagos
-- anteriores a esta migración quedan correctamente sin vínculo.
ALTER TABLE public.payments ADD COLUMN charge_id UUID REFERENCES public.platform_charges(id);
CREATE INDEX idx_payments_charge ON public.payments(charge_id);
