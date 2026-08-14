-- Migration: Electronic Billing Schema (Sprint 0)
-- Descripción: Crea las tablas de configuración y registro documental de facturas para los centros (tenant-owned).
-- Referencia: ELECTRONIC_BILLING_BOUNDARY.md

-- 1. Configuraciones SRI por Centro
CREATE TABLE public.sri_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    environment TEXT NOT NULL CHECK (environment IN ('pruebas', 'produccion')),
    establecimiento VARCHAR(3) NOT NULL DEFAULT '001',
    punto_emision VARCHAR(3) NOT NULL DEFAULT '001',
    cert_storage_path TEXT, -- Ruta en el storage
    cert_password_hash TEXT, -- En una implementación real, se usaría Vault o HashiCorp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sri_configurations_org_unique UNIQUE (organization_id)
);

-- Habilitar RLS
ALTER TABLE public.sri_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sri_configurations of their organizations"
    ON public.sri_configurations FOR SELECT
    USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]));

CREATE POLICY "Owners can update sri_configurations"
    ON public.sri_configurations FOR UPDATE
    USING (public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[]));

CREATE POLICY "Owners can insert sri_configurations"
    ON public.sri_configurations FOR INSERT
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[]));


-- 2. Registro de Documentos Tributarios (Facturas, Notas, etc.)
CREATE TABLE public.sri_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_type VARCHAR(2) NOT NULL DEFAULT '01', -- '01' Factura
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED', 'SENT', 'AUTHORIZED', 'REJECTED', 'CANCELED')),
    secuencial VARCHAR(9) NOT NULL,
    clave_acceso VARCHAR(49),
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    cliente_identificacion VARCHAR(20) NOT NULL,
    xml_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.sri_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sri_documents of their organizations"
    ON public.sri_documents FOR SELECT
    USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]));

CREATE POLICY "Owners and admins can insert sri_documents"
    ON public.sri_documents FOR INSERT
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[]));

-- Función Trigger para updated_at (por si no existe)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger Update para updated_at en ambas
CREATE TRIGGER set_updated_at_sri_configs
    BEFORE UPDATE ON public.sri_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_sri_docs
    BEFORE UPDATE ON public.sri_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
