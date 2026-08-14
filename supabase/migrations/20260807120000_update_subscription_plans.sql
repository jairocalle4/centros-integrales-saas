-- Migración para añadir soporte de precios (Mensual/Anual) a los planes de suscripción
-- y crear la función RPC para que el Superadmin gestione los planes.

BEGIN;

-- Añadir columnas numéricas para los precios.
-- El precio puede ser 0 o nulo para planes gratuitos o personalizados.
ALTER TABLE public.subscription_plans 
ADD COLUMN price_monthly NUMERIC(10,2) DEFAULT 0,
ADD COLUMN price_annual NUMERIC(10,2) DEFAULT 0;

-- Crear RPC segura para Upsert de Planes
-- Security Definer permite saltar temporalmente el RLS, pero validamos is_platform_admin()
CREATE OR REPLACE FUNCTION public.superadmin_upsert_plan(
  p_plan_id UUID,
  p_name TEXT,
  p_max_members INT,
  p_price_monthly NUMERIC(10,2),
  p_price_annual NUMERIC(10,2),
  p_has_electronic_billing BOOLEAN
) RETURNS UUID AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_final_id UUID;
  v_features JSONB;
BEGIN
  -- Verificar si el usuario que llama es Superadmin
  SELECT public.is_platform_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo un administrador de la plataforma puede gestionar planes.';
  END IF;

  -- Construir el JSONB de features
  v_features := jsonb_build_object('has_electronic_billing', p_has_electronic_billing);

  IF p_plan_id IS NULL THEN
    -- Insertar nuevo plan
    INSERT INTO public.subscription_plans (name, max_members, features, price_monthly, price_annual)
    VALUES (p_name, p_max_members, v_features, p_price_monthly, p_price_annual)
    RETURNING id INTO v_final_id;
  ELSE
    -- Actualizar plan existente
    UPDATE public.subscription_plans
    SET 
      name = p_name,
      max_members = p_max_members,
      features = v_features,
      price_monthly = p_price_monthly,
      price_annual = p_price_annual
    WHERE id = p_plan_id
    RETURNING id INTO v_final_id;
  END IF;

  RETURN v_final_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
