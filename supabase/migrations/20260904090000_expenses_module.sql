-- ============================================================
-- Módulo de Gastos (Egresos) — "gasto" está nombrado en la skill
-- centros-integrales-domain y en docs/product/MODULES.md (Finanzas,
-- edición Esencial/base, junto a Cargos/Pagos/Recibos Internos) pero
-- nunca se había construido. Espejo de "pago" (dinero que entra) para
-- dinero que sale de la organización — igual que cargo/pago son
-- entidades separadas en el dominio, "gasto" es su propia entidad, no
-- una variante de charges/internal_payments.
--
-- Categorías: texto libre, sin tabla aparte — la lista curada vive en
-- el frontend (GastosModule.tsx). Evita una migración/tabla extra para
-- v1; si más adelante se necesitan categorías personalizadas por
-- centro, es una extensión aparte, no un rediseño.
-- ============================================================

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  description text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL,
  payment_method text CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['cash', 'transfer', 'card', 'other'])),
  vendor text,
  notes text,
  -- Ruta en el bucket 'expense-receipts', mismo patrón '{organization_id}/archivo'
  -- ya usado en sri-documents — nunca una URL pública, siempre firmada al ver.
  receipt_path text,
  created_by uuid REFERENCES auth.users(id),
  -- Soft-delete — igual que internal_payments.voided_at. Un gasto nunca
  -- se borra de verdad (regla de dominio: no eliminación de historial).
  voided_at timestamptz,
  voided_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_org_date ON public.expenses (organization_id, expense_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Ver gastos es abierto a cualquier miembro activo — mismo criterio
-- exacto que org_members_see_charges / org_members_see_internal_payments
-- (los datos financieros del centro se pueden CONSULTAR sin importar el
-- rol; lo que se restringe es quién puede REGISTRARLOS/modificarlos).
CREATE POLICY org_members_see_expenses ON public.expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = expenses.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- Crear/editar/anular un gasto: owner, admin, staff — nunca professional
-- (docs/product/ROLES_PERMISSIONS.md: "sin control financiero de la
-- organización"), mismo conjunto de roles exacto que
-- org_members_manage_charges / org_members_create_internal_payments.
CREATE POLICY org_members_manage_expenses ON public.expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = expenses.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = expenses.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  );

CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ─── Storage: comprobantes de gasto (privado, mismo patrón que
-- sri-documents — ruta '{organization_id}/archivo', nunca pública) ────

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members can view expense receipts" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = (split_part(objects.name, '/', 1))::uuid
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can upload expense receipts" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = (split_part(objects.name, '/', 1))::uuid
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  );

CREATE POLICY "Org members can replace expense receipts" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = (split_part(objects.name, '/', 1))::uuid
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = (split_part(objects.name, '/', 1))::uuid
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  );
