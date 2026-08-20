-- ============================================================
-- Let platform admins see/toggle a center's SRI environment
-- (pruebas/producción) from the superadmin panel, mirroring the same
-- access pattern already used for subscriptions
-- (20260805120000_platform_admins.sql). Tenant-side owner access
-- (already granted) is untouched — this only adds platform-admin
-- policies alongside it.
-- ============================================================

CREATE POLICY "Platform admins can view sri_configurations"
  ON public.sri_configurations FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update sri_configurations"
  ON public.sri_configurations FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));
