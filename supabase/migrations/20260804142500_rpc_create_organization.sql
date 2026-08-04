-- Función segura (RPC) para que un usuario autenticado cree una organización.
-- Se ejecuta con SECURITY DEFINER (como postgres) para saltar RLS en el INSERT,
-- ya que la política no permite INSERT directo desde el frontend para evitar 
-- creaciones no controladas.

CREATE OR REPLACE FUNCTION public.create_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- 1. Validar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validar nombre
  IF trim(org_name) = '' THEN
    RAISE EXCEPTION 'Organization name cannot be empty';
  END IF;

  -- 3. Crear organización
  INSERT INTO public.organizations (name)
  VALUES (trim(org_name))
  RETURNING id INTO v_org_id;

  -- 4. Asignar rol de owner al creador
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user_id, 'owner', 'active');

  -- 5. Registrar en auditoría (opcional, pero buena práctica)
  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
  VALUES (v_org_id, v_user_id, 'create', 'organization', v_org_id);

  RETURN v_org_id;
END;
$$;

-- Revocar acceso a PUBLIC y conceder solo a autenticados
REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT) TO authenticated;
