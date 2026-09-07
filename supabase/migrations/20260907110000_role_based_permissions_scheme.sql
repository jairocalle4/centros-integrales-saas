-- ============================================================
-- Esquema de permisos por rol, aprobado por el usuario tras revisar
-- pg_policies real: Beneficiarios, Representantes, Cobros, Pagos y
-- Notas de Sesión dejaban a Staff/Auxiliar con el mismo control total
-- que el Dueño (crear/editar/ELIMINAR); Notas de Sesión además dejaba
-- a Staff editar/borrar información clínica de un menor. Profesional,
-- al contrario, solo podía VER Beneficiarios/Representantes/Cobros/
-- Pagos, sin poder editar ni siquiera lo que le corresponde.
--
-- Esquema objetivo (Total = select+insert+update+delete):
--
--   Tabla            | Dueño | Admin | Profesional | Staff
--   Beneficiarios     Total   Total   Ver+Editar    Ver+Editar
--   Representantes    Total   Total   Solo Ver      Ver+Editar
--   Cobros            Total   Total   Solo Ver      Ver+Editar
--   Pagos             Total   Total   Solo Ver      Ver+Crear
--   Gastos            Total   Total   Sin acceso    Sin acceso
--   Notas de Sesión   Total   Total   Total         Sin acceso
--
-- Eliminar queda SIEMPRE reservado a owner/admin en las 6 tablas.
-- Mismo predicado de organization_members que ya usaban las políticas
-- que se reemplazan — solo cambia la lista de roles por comando.
-- ============================================================

-- ─── Beneficiarios: Profesional pasa de "solo ver" a poder editar ────
DROP POLICY "org_members_manage_beneficiaries" ON public.beneficiaries;

CREATE POLICY "org_members_create_beneficiaries" ON public.beneficiaries
FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = beneficiaries.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','professional','staff']::public.organization_role[])
));

CREATE POLICY "org_members_update_beneficiaries" ON public.beneficiaries
FOR UPDATE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = beneficiaries.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','professional','staff']::public.organization_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = beneficiaries.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','professional','staff']::public.organization_role[])
));

CREATE POLICY "org_members_delete_beneficiaries" ON public.beneficiaries
FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = beneficiaries.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
));

-- ─── Representantes: Staff mantiene edición, Profesional queda solo lectura, nadie mas que owner/admin elimina ───
DROP POLICY "org_members_manage_representatives" ON public.representatives;

CREATE POLICY "org_members_create_representatives" ON public.representatives
FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = representatives.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
));

CREATE POLICY "org_members_update_representatives" ON public.representatives
FOR UPDATE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = representatives.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = representatives.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
));

CREATE POLICY "org_members_delete_representatives" ON public.representatives
FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = representatives.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
));

-- ─── Cobros (charges): mismo criterio que Representantes ───
DROP POLICY "org_members_manage_charges" ON public.charges;

CREATE POLICY "org_members_create_charges" ON public.charges
FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = charges.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
));

CREATE POLICY "org_members_update_charges" ON public.charges
FOR UPDATE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = charges.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = charges.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','staff']::public.organization_role[])
));

CREATE POLICY "org_members_delete_charges" ON public.charges
FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = charges.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
));

-- ─── Pagos (internal_payments): ya separada en varias políticas hoy.
-- INSERT (owner/admin/staff) ya coincide con el esquema — sin cambio.
-- Solo se aprieta el DELETE, que hoy incluye a staff. ───
DROP POLICY "org_members_delete_unlinked_internal_payments" ON public.internal_payments;

CREATE POLICY "org_members_delete_unlinked_internal_payments" ON public.internal_payments
FOR DELETE TO authenticated
USING (
  sri_document_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = internal_payments.organization_id AND om.user_id = auth.uid()
      AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
  )
);

-- ─── Gastos (expenses): queda cerrado del todo a Profesional/Staff, incluida la lectura ───
DROP POLICY "org_members_manage_expenses" ON public.expenses;
DROP POLICY "org_members_see_expenses" ON public.expenses;

CREATE POLICY "org_members_manage_expenses" ON public.expenses
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = expenses.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = expenses.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin']::public.organization_role[])
));

-- ─── Notas de Sesión: Staff pierde el acceso por completo (ni ver);
-- Profesional mantiene control total junto a owner/admin ───
DROP POLICY "org_members_manage_session_notes" ON public.session_notes;
DROP POLICY "org_members_see_session_notes" ON public.session_notes;

CREATE POLICY "org_members_manage_session_notes" ON public.session_notes
FOR ALL TO public
USING (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = session_notes.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','professional']::public.organization_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = session_notes.organization_id AND om.user_id = auth.uid()
    AND om.status = 'active' AND om.role = ANY (ARRAY['owner','admin','professional']::public.organization_role[])
));
