-- ============================================================
-- Bug real reportado por el usuario: "Error guardando plan: invalid
-- input syntax for type uuid: ''" al crear un plan nuevo desde
-- PlatformDashboard.tsx.
--
-- Causa raíz: p_plan_id (primer parámetro) no tenía DEFAULT, así que
-- el generador de tipos de Supabase lo marca como `string` obligatorio
-- en database.types.ts — nunca `string | null` — aunque la función sí
-- acepta NULL para crear un plan (ver `IF p_plan_id IS NULL THEN
-- INSERT ... ELSE UPDATE ...` en el cuerpo, sin cambios). El frontend
-- terminó pasando '' (string vacío) para poder compilar, y Postgres
-- rechaza '' como uuid.
--
-- Postgres solo permite DEFAULT en parámetros finales (trailing), así
-- que para darle DEFAULT NULL a p_plan_id hay que moverlo al final —
-- eso cambia el orden de la lista de tipos, que sí cuenta como una
-- identidad de función distinta (aunque los tipos sean los mismos),
-- por eso el DROP explícito de la firma vieja antes del CREATE OR
-- REPLACE (mismo gotcha ya encontrado antes esta sesión). El orden no
-- afecta a ningún llamador real: supabase-js siempre llama esta
-- función con argumentos nombrados (p_plan_id: ..., p_name: ...), no
-- posicionales.
-- ============================================================

DROP FUNCTION IF EXISTS public.superadmin_upsert_plan(uuid, text, integer, numeric, numeric, boolean, boolean);

CREATE OR REPLACE FUNCTION public.superadmin_upsert_plan(
  p_name text,
  p_max_members integer,
  p_price_monthly numeric,
  p_price_annual numeric,
  p_has_electronic_billing boolean,
  p_has_session_notes boolean DEFAULT false,
  p_plan_id uuid DEFAULT NULL
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
REVOKE EXECUTE ON FUNCTION public.superadmin_upsert_plan(text, integer, numeric, numeric, boolean, boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.superadmin_upsert_plan(text, integer, numeric, numeric, boolean, boolean, uuid) FROM anon;
