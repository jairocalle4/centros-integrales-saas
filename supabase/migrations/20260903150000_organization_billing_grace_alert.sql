-- ============================================================
-- get_organization_billing_alert(p_org_id): permite que el DUEÑO de un
-- centro (nunca otro rol, nunca otro centro) sepa si su plan está
-- vencido y cuántos días de plazo le quedan antes de que
-- enforce_payment_grace_period() (migración 20260903140000) lo
-- suspenda automáticamente — hoy esa cuenta regresiva no tiene ninguna
-- señal visible para el dueño hasta que ya lo suspendieron.
--
-- payment_grace_period_days vive en platform_settings, que es de solo
-- superadmin (contiene brevo_api_key) — nunca se expone esa tabla al
-- dueño de un centro. Este SECURITY DEFINER expone únicamente el valor
-- puntual que hace falta, verificando pertenencia con
-- has_organization_role (mismo helper que ya usa la política RLS
-- "Owners can view own platform charges" de platform_charges).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_organization_billing_alert(p_org_id uuid)
RETURNS TABLE (
  is_overdue boolean,
  days_remaining integer,
  grace_period_days integer,
  amount numeric,
  due_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grace_days integer;
  v_due_date timestamptz;
  v_amount numeric;
BEGIN
  IF NOT public.has_organization_role(p_org_id, ARRAY['owner']::public.organization_role[]) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT ps.payment_grace_period_days INTO v_grace_days
  FROM public.platform_settings ps WHERE ps.id = true;
  v_grace_days := COALESCE(v_grace_days, 15);

  -- El cargo pendiente más antiguo del centro — si hay más de uno
  -- vencido (no debería, dado idx_platform_charges_one_pending_per_org),
  -- el más antiguo manda porque es el que primero dispara la suspensión.
  -- Solo importa mientras la suscripción sigue 'active': si ya es
  -- 'suspended'/'past_due', is_organization_active() ya bloquea toda la
  -- app con SuspendedTenant — esta alerta nunca llegaría a mostrarse.
  SELECT pc.due_date, pc.amount INTO v_due_date, v_amount
  FROM public.platform_charges pc
  JOIN public.subscriptions s ON s.organization_id = pc.organization_id
  WHERE pc.organization_id = p_org_id
    AND pc.status = 'pending'
    AND s.status = 'active'
  ORDER BY pc.due_date ASC
  LIMIT 1;

  IF v_due_date IS NULL OR v_due_date >= NOW() THEN
    is_overdue := false;
    days_remaining := NULL;
    grace_period_days := v_grace_days;
    amount := NULL;
    due_date := NULL;
  ELSE
    is_overdue := true;
    -- Mismo punto de corte que enforce_payment_grace_period (due_date +
    -- grace_days) — el redondeo hacia arriba (CEIL) evita mostrar "0
    -- días" mientras técnicamente todavía queda una fracción de día.
    days_remaining := GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM ((v_due_date + (v_grace_days || ' days')::interval) - NOW())) / 86400.0)
    )::integer;
    grace_period_days := v_grace_days;
    amount := v_amount;
    due_date := v_due_date;
  END IF;

  RETURN NEXT;
END;
$$;

-- Igual que enforce_payment_grace_period (migración 20260903140100):
-- Supabase otorga EXECUTE a anon de forma independiente a PUBLIC en
-- cada función nueva — se revoca explícitamente. authenticated SÍ
-- conserva EXECUTE (lo necesita cualquier dueño de centro autenticado);
-- la función igual rechaza con excepción a quien no sea dueño del
-- centro pedido.
REVOKE EXECUTE ON FUNCTION public.get_organization_billing_alert(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_organization_billing_alert(uuid) FROM anon;
