-- ============================================================
-- Hallazgo real, encontrado al probar el fix anterior de RLS: el
-- CHECK constraint de invitations.status solo permitía
-- 'pending' | 'accepted' | 'expired' — 'cancelled' nunca estuvo
-- permitido, pese a que el frontend (PlatformDashboard.tsx
-- handleCancelInvitation, y el propio STATUS_LABEL que ya muestra
-- "Cancelada") lo da por hecho hace tiempo. Cancelar una invitación
-- fallaba desde siempre, con o sin la política de RLS.
-- ============================================================

ALTER TABLE public.invitations DROP CONSTRAINT invitations_status_check;

ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text]));
