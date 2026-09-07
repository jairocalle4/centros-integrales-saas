-- ============================================================
-- Hallazgo real: la tabla invitations nunca tuvo ninguna política de
-- UPDATE (verificado contra pg_policies) — solo dos políticas de
-- SELECT. Eso significa que cancelar una invitación (el "Cancelar" que
-- ya existe en el panel de superadmin, y el que se agrega ahora a
-- nivel de centro) queda bloqueado por RLS por defecto para
-- absolutamente cualquiera, incluido un superadmin autenticado con el
-- cliente normal (no service_role).
--
-- Dos políticas nuevas, mismo patrón que ya usan las dos de SELECT:
-- una para el dueño/admin del propio centro, otra para superadmin.
-- Ambas limitadas a invitaciones todavía 'pending' — no tiene sentido
-- "cancelar" una ya aceptada/vencida, y así una petición mal formada
-- no puede reabrir una invitación que ya se resolvió. El WITH CHECK
-- exige el mismo rol otra vez sobre organization_id, para que la fila
-- no pueda terminar reasignada a otro centro (regla de la skill de
-- Supabase: toda política de UPDATE necesita USING y WITH CHECK).
-- ============================================================

CREATE POLICY "Org owners/admins can cancel their own pending invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND public.has_organization_role(organization_id, ARRAY['owner'::organization_role, 'admin'::organization_role])
)
WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner'::organization_role, 'admin'::organization_role])
);

CREATE POLICY "Platform admins can cancel any pending invitation"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND public.is_platform_admin(auth.uid())
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
);
