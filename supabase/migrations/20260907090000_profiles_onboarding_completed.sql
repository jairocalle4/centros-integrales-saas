-- ============================================================
-- Hallazgo real del usuario (con evidencia: un integrante "Usuario"
-- sin nombre en Equipo de Trabajo): el enlace mágico de invitación ya
-- deja una sesión completa y válida ANTES de que aparezca "Crea tu
-- Contraseña" (ResetPassword.tsx, isFirstTime). Ese formulario nunca
-- fue una puerta real — RequireAuth.tsx solo revisaba "¿hay sesión?",
-- nunca "¿ya completó su perfil?". El botón atrás (o /app directo)
-- dejaba entrar a alguien que nunca puso su nombre real ni una
-- contraseña propia.
--
-- DEFAULT true primero: retroactivamente marca a TODOS los usuarios
-- ya existentes como completos — nadie que ya usa la app normal debe
-- verse afectado por este cambio. Luego se baja el DEFAULT a false
-- para que cualquier fila nueva (creada por handle_new_user() de aquí
-- en adelante) empiece bloqueada hasta completar el formulario de
-- verdad.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles ALTER COLUMN onboarding_completed SET DEFAULT false;
