-- ============================================================
-- Permitir borrar un pago SOLO si nunca llegó a vincularse a ningún
-- intento de factura (sri_document_id IS NULL).
--
-- "Guardar y Facturar" es una operación que el usuario espera atómica:
-- si la factura no se emite, el pago tampoco debe quedar guardado — hoy
-- el pago se inserta primero y, si facturar falla, se queda huérfano
-- (confirmado como confuso en un incidente real). Esta política habilita
-- que el frontend revierta (borre) ese pago recién creado cuando la
-- Edge Function responde con un error SIN sri_document_id — es decir,
-- cuando el intento de facturar nunca llegó a registrarse en absoluto
-- (gates tempranos, rechazo de validación antes de tocar el SRI).
--
-- El acotador `sri_document_id IS NULL` es la salvaguarda real: en
-- cuanto un pago queda vinculado a CUALQUIER intento de factura — incluso
-- uno rechazado — esta política dejar de aplicar. Nunca se puede borrar
-- un pago con historial de facturación real, ni con esta política ni con
-- ninguna otra (no existe una política de DELETE sin esta condición).
-- ============================================================

CREATE POLICY "org_members_delete_unlinked_internal_payments"
  ON public.internal_payments FOR DELETE
  TO authenticated
  USING (
    sri_document_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = internal_payments.organization_id
         AND om.user_id = auth.uid()
         AND om.status = 'active'
         AND om.role = ANY (ARRAY['owner'::public.organization_role, 'admin'::public.organization_role, 'staff'::public.organization_role])
    )
  );
