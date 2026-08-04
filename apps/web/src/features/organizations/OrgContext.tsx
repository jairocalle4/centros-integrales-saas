import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type Organization = {
  id: string;
  name: string;
};

interface OrgContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  organizations: Organization[];
  isLoading: boolean;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrgs = async () => {
    if (!session) return;
    
    setIsLoading(true);
    // Since we have RLS, we can just query organizations.
    // The policy "Members can view their organization" ensures we only see what we have access to.
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrganizations(data);
      // Auto-select if we only have one or none is selected and we have some
      if (data.length > 0 && !currentOrg) {
        // Optionally, we could load the last selected from localStorage here
        const savedOrgId = localStorage.getItem('nexo_current_org_id');
        const savedOrg = data.find(o => o.id === savedOrgId);
        setCurrentOrg(savedOrg || data[0]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOrgs();
  }, [session]);

  const handleSetCurrentOrg = (org: Organization) => {
    setCurrentOrg(org);
    localStorage.setItem('nexo_current_org_id', org.id);
  };

  return (
    <OrgContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg: handleSetCurrentOrg, 
      organizations, 
      isLoading,
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
