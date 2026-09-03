-- ============================================================
-- Suspensión automática de un centro cuando un cargo de plataforma
-- pendiente lleva vencido más del plazo de gracia configurado.
--
-- Primer cron job de todo el proyecto (pg_cron estaba disponible pero
-- nunca instalado) — hasta ahora toda renovación/cambio de estado era
-- una acción explícita del superadmin, nunca un proceso en segundo
-- plano. Se agrega deliberadamente, a pedido explícito del usuario.
--
-- Alcance: solo suscripciones 'active' con un platform_charges
-- 'pending' vencido — nunca 'trialing' (superadmin_assign_plan genera
-- un cargo pendiente incluso para una suscripción nueva en trial; sin
-- este límite un centro recién creado podría suspenderse antes de que
-- el trial tenga sentido), ni 'canceled' ni lo ya 'suspended'. No pasa
-- por 'past_due' — salta directo de 'active' a 'suspended'.
-- ============================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payment_grace_period_days INTEGER NOT NULL DEFAULT 15
    CHECK (payment_grace_period_days > 0);

CREATE OR REPLACE FUNCTION public.enforce_payment_grace_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grace_days INTEGER;
  v_org RECORD;
BEGIN
  SELECT payment_grace_period_days INTO v_grace_days FROM public.platform_settings WHERE id = true;
  v_grace_days := COALESCE(v_grace_days, 15);

  FOR v_org IN
    SELECT DISTINCT s.organization_id
    FROM public.subscriptions s
    JOIN public.platform_charges pc
      ON pc.organization_id = s.organization_id AND pc.status = 'pending'
    WHERE s.status = 'active'
      AND pc.due_date + (v_grace_days || ' days')::interval < NOW()
  LOOP
    UPDATE public.subscriptions SET status = 'suspended', updated_at = NOW()
     WHERE organization_id = v_org.organization_id;

    -- user_id NULL distingue "lo hizo el sistema" de un cambio manual
    -- del superadmin (que sí trae su auth.uid() en audit_logs).
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (v_org.organization_id, NULL, 'system_auto_suspend_grace_period_expired', 'subscriptions', v_org.organization_id);
  END LOOP;
END;
$$;

-- Nadie la ejecuta por request HTTP — solo el cron (que corre como el
-- dueño de la función). No se otorga a PUBLIC ni a authenticated.
REVOKE EXECUTE ON FUNCTION public.enforce_payment_grace_period() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_payment_grace_period() FROM authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'enforce-payment-grace-period',
  '0 6 * * *',
  $$SELECT public.enforce_payment_grace_period();$$
);
