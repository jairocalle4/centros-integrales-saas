import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type Organization = {
  id: string;
  name: string;
  ruc?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
};

interface OrgContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  organizations: Organization[];
  isLoading: boolean;
  isActive: boolean | null;
  currentRole: string | null;
  hasElectronicBilling: boolean;
  hasSessionNotes: boolean;
  hasSriCertificate: boolean;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(() => {
    const saved = localStorage.getItem('nexo_current_org_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(!currentOrg);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [hasElectronicBilling, setHasElectronicBilling] = useState(false);
  const [hasSessionNotes, setHasSessionNotes] = useState(false);
  const [hasSriCertificate, setHasSriCertificate] = useState(false);

  const fetchOrgs = async () => {
    if (!session) return;
    
    setIsLoading(true);
    // Since we have RLS, we can just query organizations.
    // The policy "Members can view their organization" ensures we only see what we have access to.
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrganizations(data);
      if (data.length > 0 && !currentOrg) {
        const savedOrgId = localStorage.getItem('nexo_current_org_id');
        const savedOrg = data.find(o => o.id === savedOrgId);
        if (savedOrg) {
          // Returning user: restore their last active organization.
          setCurrentOrg(savedOrg);
        } else if (data.length === 1) {
          // Only one membership: nothing to choose, select it directly.
          setCurrentOrg(data[0]);
        }
        // Otherwise (first login, multiple active memberships, no prior
        // selection): leave currentOrg null so UserLayout forces an
        // explicit choice instead of silently picking the newest one.
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (session && !currentOrg) {
      fetchOrgs();
    }
  }, [session, currentOrg]);

  useEffect(() => {
    async function checkActive() {
      if (!currentOrg) {
        setIsActive(null);
        return;
      }
      // Check if it's active
      const { data, error } = await supabase.rpc('is_organization_active', {
        p_org_id: currentOrg.id
      });
      if (!error) {
        setIsActive(!!data);
      }
    }
    checkActive();
  }, [currentOrg]);

  useEffect(() => {
    // Un solo fetch de features alimenta ambos entitlements — evita
    // repetir el mismo par de consultas (subscriptions + subscription_plans)
    // por cada flag que se agregue a futuro.
    async function loadPlanEntitlements() {
      if (!currentOrg) { setHasElectronicBilling(false); setHasSessionNotes(false); return; }
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('organization_id', currentOrg.id)
        .maybeSingle();
      if (!subscription?.plan_id) { setHasElectronicBilling(false); setHasSessionNotes(false); return; }

      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('features')
        .eq('id', subscription.plan_id)
        .maybeSingle();
      const features = plan?.features as any;
      setHasElectronicBilling(Boolean(features?.has_electronic_billing));
      setHasSessionNotes(Boolean(features?.has_session_notes));
    }
    loadPlanEntitlements();
  }, [currentOrg]);

  useEffect(() => {
    async function loadSriCertificateStatus() {
      if (!currentOrg) { setHasSriCertificate(false); return; }
      // Owner/admin only, per sri_configurations RLS — staff/professional
      // simply won't see this as configured, matching that they also
      // can't emit invoices (sri_documents insert is owner/admin only too).
      const { data } = await supabase
        .from('sri_configurations')
        .select('cert_uploaded_at')
        .eq('organization_id', currentOrg.id)
        .maybeSingle();
      setHasSriCertificate(Boolean(data?.cert_uploaded_at));
    }
    loadSriCertificateStatus();
  }, [currentOrg]);

  useEffect(() => {
    async function loadRole() {
      if (!currentOrg || !session?.user.id) {
        setCurrentRole(null);
        return;
      }
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', currentOrg.id)
        .eq('user_id', session.user.id)
        .maybeSingle();
      setCurrentRole(!error && data ? data.role : null);
    }
    loadRole();
  }, [currentOrg, session]);

  const handleSetCurrentOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('nexo_current_org_id', org.id); // Keep for legacy
    localStorage.setItem('nexo_current_org_data', JSON.stringify(org));
  };

  return (
    <OrgContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg: handleSetCurrentOrg, 
      organizations,
      isLoading,
      isActive,
      currentRole,
      hasElectronicBilling,
      hasSessionNotes,
      hasSriCertificate,
      refreshOrgs: fetchOrgs
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
