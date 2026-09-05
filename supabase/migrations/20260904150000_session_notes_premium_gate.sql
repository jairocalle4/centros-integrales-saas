-- ============================================================
-- "Notas de Sesión" (session_notes / pestaña "Progreso de Sesiones")
-- pasa a ser un feature de plan, igual patrón que has_electronic_billing
-- — decisión explícita del usuario: es el diferenciador real de
-- "Operación Profesional" (le sirve a un centro de terapia, no a una
-- guardería), mientras que Agendamiento se queda en ambos planes por
-- servirle a cualquier tipo de centro por igual.
--
-- Se gatea a nivel de frontend (oculta la pestaña completa, mismo
-- patrón que buildNavItems(hasElectronicBilling) ya oculta el ítem
-- "Facturas" del menú) — no a nivel de RLS. Es proporcional: a
-- diferencia de emitir un comprobante SRI real (que si tiene
-- consecuencias fiscales y por eso handleEmit lo valida server-side),
-- una nota de sesión no tiene ese mismo riesgo — el gate de UI es
-- suficiente aquí, igual de riguroso que el resto del sistema de
-- entitlements ya existente.
-- ============================================================

-- DROP explícito de la firma vieja — CREATE OR REPLACE con una lista de
-- parámetros distinta crea un overload nuevo en vez de reemplazar
-- (gotcha ya encontrado antes esta sesión con superadmin_register_payment).
DROP FUNCTION IF EXISTS public.superadmin_upsert_plan(uuid, text, integer, numeric, numeric, boolean);

CREATE OR REPLACE FUNCTION public.superadmin_upsert_plan(
  p_plan_id uuid,
  p_name text,
  p_max_members integer,
  p_price_monthly numeric,
  p_price_annual numeric,
  p_has_electronic_billing boolean,
  p_has_session_notes boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_final_id UUID;
  v_features JSONB;
BEGIN
  SELECT public.is_platform_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo un administrador de la plataforma puede gestionar planes.';
  END IF;

  v_features := jsonb_build_object(
    'has_electronic_billing', p_has_electronic_billing,
    'has_session_notes', p_has_session_notes
  );

  IF p_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (name, max_members, features, price_monthly, price_annual)
    VALUES (p_name, p_max_members, v_features, p_price_monthly, p_price_annual)
    RETURNING id INTO v_final_id;
  ELSE
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
$function$;

-- Mismo gotcha de siempre: Supabase otorga EXECUTE a anon de forma
-- independiente a PUBLIC en cada función nueva.
REVOKE EXECUTE ON FUNCTION public.superadmin_upsert_plan(uuid, text, integer, numeric, numeric, boolean, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.superadmin_upsert_plan(uuid, text, integer, numeric, numeric, boolean, boolean) FROM anon;
