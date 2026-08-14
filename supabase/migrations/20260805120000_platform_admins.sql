-- Migración: Superadmins, Suspensiones y Rediseño B2B

-- 1. Tabla Superadmins
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE user_id = p_user_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "Platform admins can read their own row" ON public.platform_admins;
CREATE POLICY "Platform admins can read their own row" 
ON public.platform_admins FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));


-- 2. Modificar el CHECK constraint de subscriptions para soportar suspensiones
DO $$ 
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%';
      
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.subscriptions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled'));

-- 3. Función is_organization_active
CREATE OR REPLACE FUNCTION public.is_organization_active(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT 
        EXISTS (
            SELECT 1 FROM public.subscriptions
            WHERE organization_id = p_org_id
              AND status IN ('trialing', 'active')
        )
        OR
        NOT EXISTS (
            SELECT 1 FROM public.subscriptions
            WHERE organization_id = p_org_id
        );
$$;

REVOKE EXECUTE ON FUNCTION public.is_organization_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_active(UUID) TO authenticated;

-- 4. Modificar RLS de organization_members para bloquear operativamente si está suspendida
DROP POLICY IF EXISTS "Members can view members of their organization" ON public.organization_members;
CREATE POLICY "Members can view members of their organization" ON public.organization_members FOR SELECT TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin','professional','staff']::public.organization_role[])
  AND public.is_organization_active(organization_id)
);

DROP POLICY IF EXISTS "Admins and Owners can insert members" ON public.organization_members;
CREATE POLICY "Admins and Owners can insert members" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
  AND public.is_organization_active(organization_id)
);

DROP POLICY IF EXISTS "Admins and Owners can update members" ON public.organization_members;
CREATE POLICY "Admins and Owners can update members" ON public.organization_members FOR UPDATE TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
  AND public.is_organization_active(organization_id)
) WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
  AND public.is_organization_active(organization_id)
);

DROP POLICY IF EXISTS "Admins and Owners can delete members" ON public.organization_members;
CREATE POLICY "Admins and Owners can delete members" ON public.organization_members FOR DELETE TO authenticated USING (
  public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
  AND public.is_organization_active(organization_id)
);


-- 5. RPC: Superadmin Create Organization
CREATE OR REPLACE FUNCTION public.superadmin_create_organization(
    p_org_name TEXT,
    p_plan_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_superadmin_id UUID;
BEGIN
    v_superadmin_id := auth.uid();
    IF NOT public.is_platform_admin(v_superadmin_id) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Superadmin';
    END IF;

    -- Create organization
    INSERT INTO public.organizations (name) VALUES (p_org_name) RETURNING id INTO v_org_id;
    
    -- Create default subscription (if plan provided, otherwise an active empty one or logic dictates)
    IF p_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (organization_id, plan_id, status) 
        VALUES (v_org_id, p_plan_id, 'active');
    END IF;

    -- Log
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (v_org_id, v_superadmin_id, 'superadmin_create_org', 'organizations', v_org_id);

    RETURN v_org_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.superadmin_create_organization(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_create_organization(TEXT, UUID) TO authenticated;


-- 6. RPC: Superadmin Set Subscription Status
CREATE OR REPLACE FUNCTION public.superadmin_set_subscription_status(
    p_org_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_superadmin_id UUID;
BEGIN
    v_superadmin_id := auth.uid();
    IF NOT public.is_platform_admin(v_superadmin_id) THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere rol de Superadmin';
    END IF;

    UPDATE public.subscriptions SET status = p_status WHERE organization_id = p_org_id;

    -- Log
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (p_org_id, v_superadmin_id, 'superadmin_set_status_' || p_status, 'subscriptions', p_org_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.superadmin_set_subscription_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_set_subscription_status(UUID, TEXT) TO authenticated;


-- 7. Modificar create_invitation para permitir a los superadmins invitar owners
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_organization_id UUID,
    p_email TEXT,
    p_role public.organization_role
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inviter_id UUID;
    v_inviter_role public.organization_role;
    v_normalized_email TEXT;
    v_token TEXT;
    v_token_hash TEXT;
    v_existing_id UUID;
BEGIN
    -- 1. Obtener invitador
    v_inviter_id := auth.uid();
    IF v_inviter_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Normalizar correo
    v_normalized_email := lower(trim(p_email));
    IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'Correo inválido';
    END IF;

    -- 3. Comprobar membresía y rol del invitador
    SELECT role INTO v_inviter_role 
    FROM public.organization_members 
    WHERE organization_id = p_organization_id 
      AND user_id = v_inviter_id 
      AND status = 'active';

    -- Permiso de Superadmin (by-pass)
    IF NOT public.is_platform_admin(v_inviter_id) THEN
        IF v_inviter_role IS NULL OR v_inviter_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'No tienes permiso para invitar en esta organización';
        END IF;

        -- 4. Validar rol destino: un admin no puede invitar a un owner
        IF v_inviter_role = 'admin' AND p_role = 'owner' THEN
            RAISE EXCEPTION 'Un administrador no puede invitar a un owner';
        END IF;
    END IF;

    -- 5. Evitar invitaciones pendientes duplicadas
    SELECT id INTO v_existing_id
    FROM public.invitations
    WHERE organization_id = p_organization_id
      AND email = v_normalized_email
      AND status = 'pending'
      AND expires_at > now();

    IF v_existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este correo';
    END IF;

    -- Comprobar si ya es miembro
    IF EXISTS (
        SELECT 1 
        FROM public.organization_members m
        JOIN auth.users u ON m.user_id = u.id
        WHERE m.organization_id = p_organization_id
          AND u.email = v_normalized_email
    ) THEN
        RAISE EXCEPTION 'El usuario ya es miembro de esta organización';
    END IF;

    -- 6. Generar token de alta entropía (64 caracteres hex)
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    -- Guardar solo el hash (SHA256)
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    -- 7. Insertar invitación
    INSERT INTO public.invitations (
        organization_id, 
        email, 
        role, 
        invited_by, 
        status, 
        token_hash, 
        expires_at
    ) VALUES (
        p_organization_id,
        v_normalized_email,
        p_role,
        v_inviter_id,
        'pending',
        v_token_hash,
        now() + interval '7 days'
    );

    -- 8. Registrar en auditoría
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id)
    VALUES (p_organization_id, v_inviter_id, 'create_invitation', 'invitations', p_organization_id);

    -- 9. Devolver el token
    RETURN v_token;
END;
$$;


-- 8. RLS: Superadmin puede leer TODAS las organizaciones (para el panel de gestión)
CREATE POLICY "Platform admins can view all organizations"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Superadmin puede insertar organizaciones (vía RPC, pero la política protege el INSERT directo también)
CREATE POLICY "Platform admins can insert organizations"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9. RLS: Superadmin puede leer TODAS las suscripciones
CREATE POLICY "Platform admins can view all subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Superadmin puede insertar y actualizar suscripciones
CREATE POLICY "Platform admins can insert subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 10. RLS: Superadmin puede leer invitations de cualquier organización
CREATE POLICY "Platform admins can view all invitations"
ON public.invitations FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- 11. RLS: Superadmin puede leer audit_logs de cualquier organización
CREATE POLICY "Platform admins can view all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Superadmin puede insertar audit_logs (trazabilidad)
CREATE POLICY "Platform admins can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));
