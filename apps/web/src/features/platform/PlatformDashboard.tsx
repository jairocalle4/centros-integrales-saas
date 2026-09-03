import { useEffect, useLayoutEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/formatDate';
import { Loader2, User, Settings, Percent, Mail, ShieldAlert } from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  created_at: string;
  status?: string;
  trial_start?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
  plan_id?: string;
  billing_cycle?: string;
};



type SubscriptionPlan = {
  id: string;
  name: string;
  max_members: number | null;
  price_monthly: number;
  price_annual: number;
  features: {
    has_electronic_billing?: boolean;
    [key: string]: any;
  };
  created_at: string;
};

type AuditLog = {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string;
};

type Invitation = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  expires_at?: string | null;
  created_at: string;
  organizations?: {
    name: string;
  } | null;
};

type PlatformAdmin = {
  user_id: string;
  created_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export function PlatformDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  // Data states
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [platformAdmins, setPlatformAdmins] = useState<PlatformAdmin[]>([]);
  const [totalBeneficiariesCount, setTotalBeneficiariesCount] = useState(0);
  const [totalMembersCount, setTotalMembersCount] = useState(0);
  const [totalVolumeProcessed, setTotalVolumeProcessed] = useState(0);

  // Audit & Invitation Tab States
  const [auditSubTab, setAuditSubTab] = useState<'invitations' | 'logs'>('invitations');
  const [auditOrgFilter, setAuditOrgFilter] = useState<string>('all');
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<string>('all');
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Actions
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlanId, setNewOrgPlanId] = useState('');
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);



  // Profile Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Configuración: sub-navegación interna del módulo unificado (Mi Cuenta / Plataforma)
  const [configSubTab, setConfigSubTab] = useState<'cuenta' | 'plataforma'>('cuenta');

  // Plan States
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price_monthly: 0,
    price_annual: 0,
    max_members: 10,
    has_electronic_billing: false,
  });
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  // Platform-wide Settings (IVA, etc.)
  const [ivaPercentage, setIvaPercentage] = useState<number>(15);
  const [savingSettings, setSavingSettings] = useState(false);

  // Plazo de gracia antes de suspender automáticamente un centro con un
  // cobro vencido (enforce_payment_grace_period, cron diario).
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(15);
  const [savingGracePeriod, setSavingGracePeriod] = useState(false);

  // Brevo (envío de facturas por correo) — brevoApiKeyInput es write-only:
  // nunca se carga desde la base de datos, solo viaja hacia ella cuando el
  // superadmin escribe una nueva. brevoConfigured es un booleano derivado
  // en memoria al cargar (nunca se guarda la key real en el estado), solo
  // para mostrar "ya configurada" sin volver a exponerla en un input.
  const [brevoApiKeyInput, setBrevoApiKeyInput] = useState('');
  const [brevoConfigured, setBrevoConfigured] = useState(false);
  const [brevoSenderEmail, setBrevoSenderEmail] = useState('');
  const [brevoSenderName, setBrevoSenderName] = useState('');
  const [savingBrevo, setSavingBrevo] = useState(false);



  useEffect(() => {
    if (user) {
      const fetchProfileData = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
        }
      };
      fetchProfileData();
    }

    const loadPlatformSettings = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('iva_percentage, brevo_api_key, brevo_sender_email, brevo_sender_name, payment_grace_period_days')
        .eq('id', true)
        .maybeSingle();
      if (data) {
        setIvaPercentage(Number(data.iva_percentage));
        // El valor real de brevo_api_key nunca se guarda en el estado —
        // solo se usa aquí mismo para derivar este booleano.
        setBrevoConfigured(Boolean(data.brevo_api_key));
        setBrevoSenderEmail(data.brevo_sender_email || '');
        setBrevoSenderName(data.brevo_sender_name || '');
        setGracePeriodDays(Number(data.payment_grace_period_days ?? 15));
      }
    };
    loadPlatformSettings();
  }, [user]);

  const fetchPlatformData = async () => {
    // Load all platform metrics in parallel
    const [
      { data: orgsData },
      { data: subsData },
      { data: plansData },
      { data: logsData },
      { data: invsData },
      { data: adminsData },
      benRes,
      memRes,
      pmtsRes
    ] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('organization_id, status, trial_start, trial_end, current_period_end, plan_id, billing_cycle'),
      supabase.from('subscription_plans').select('*').order('created_at', { ascending: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      (supabase as any).from('invitations').select('*, organizations(name)').order('created_at', { ascending: false }),
      (supabase as any).from('platform_admins').select('user_id, created_at, profiles(first_name, last_name)').order('created_at', { ascending: false }),
      supabase.from('beneficiaries').select('id', { count: 'exact', head: true }),
      supabase.from('organization_members').select('id', { count: 'exact', head: true }),
      supabase.from('internal_payments').select('amount'),
    ]);

    const mergedOrgs = (orgsData || []).map((org) => {
      const sub = subsData?.find((s) => s.organization_id === org.id);
      return {
        ...org,
        status: sub?.status || 'sin_plan',
        trial_start: sub?.trial_start,
        trial_end: sub?.trial_end,
        current_period_end: sub?.current_period_end,
        plan_id: sub?.plan_id,
        billing_cycle: sub?.billing_cycle
      };
    });

    const vol = (pmtsRes.data || []).reduce((sum, p: any) => sum + Number(p.amount), 0);

    return {
      organizations: mergedOrgs,
      plans: (plansData as any as SubscriptionPlan[]) || [],
      auditLogs: logsData || [],
      invitations: (invsData as any as Invitation[]) || [],
      platformAdmins: (adminsData as any as PlatformAdmin[]) || [],
      totalBeneficiariesCount: benRes.count || 0,
      totalMembersCount: memRes.count || 0,
      totalVolumeProcessed: vol,
    };
  };

  // React Query en vez de un solo fetch al montar: el superadmin ya no
  // depende de F5 para ver, por ejemplo, que una invitación pasó de
  // pendiente a aceptada — se refresca solo al volver a la pestaña
  // (refetchOnWindowFocus) y cada 45s mientras siga activa (refetchInterval).
  const { data: platformData, isLoading: loading } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: fetchPlatformData,
    refetchOnWindowFocus: true,
    refetchInterval: 45000,
  });

  const invalidatePlatformData = () => queryClient.invalidateQueries({ queryKey: ['platform-dashboard'] });

  useLayoutEffect(() => {
    if (!platformData) return;
    setOrganizations(platformData.organizations);
    setPlans(platformData.plans);
    setAuditLogs(platformData.auditLogs);
    setInvitations(platformData.invitations);
    setPlatformAdmins(platformData.platformAdmins);
    setTotalBeneficiariesCount(platformData.totalBeneficiariesCount);
    setTotalMembersCount(platformData.totalMembersCount);
    setTotalVolumeProcessed(platformData.totalVolumeProcessed);
  }, [platformData]);

  const handleCancelInvitation = async (invId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invId);

      if (error) throw error;
      toast.success('Invitación cancelada.');
      invalidatePlatformData();
    } catch (err: any) {
      toast.error('Error al cancelar invitación: ' + err.message);
    }
  };

  // Actions
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    if (!newOrgPlanId) {
      toast.error('Debes seleccionar un plan para el nuevo centro.');
      return;
    }

    setIsSubmittingOrg(true);
    const { error } = await supabase.rpc('superadmin_create_organization', {
      p_org_name: newOrgName.trim(),
      p_plan_id: newOrgPlanId,
    });

    if (error) {
      toast.error('Error creando centro: ' + error.message);
    } else {
      toast.success('Centro creado exitosamente.');
      setNewOrgName('');
      setNewOrgPlanId('');
      setIsCreatingOrg(false);
      invalidatePlatformData();
    }
    setIsSubmittingOrg(false);
  };

  const handleSetStatus = async (orgId: string, status: string) => {
    const { error } = await supabase.rpc('superadmin_set_subscription_status', {
      p_org_id: orgId,
      p_status: status,
    });

    if (error) {
      toast.error('Error actualizando estado: ' + error.message);
    } else {
      toast.success('Estado actualizado.');
      invalidatePlatformData();
    }
  };



  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error('Error actualizando perfil: ' + error.message);
    } else {
      toast.success('Perfil actualizado correctamente.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ iva_percentage: ivaPercentage })
        .eq('id', true);
      if (error) throw error;
      toast.success('Configuración de plataforma guardada.');
    } catch (err: any) {
      toast.error('Error guardando configuración: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGracePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGracePeriod(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ payment_grace_period_days: gracePeriodDays })
        .eq('id', true);
      if (error) throw error;
      toast.success('Plazo de gracia actualizado.');
    } catch (err: any) {
      toast.error('Error guardando el plazo de gracia: ' + err.message);
    } finally {
      setSavingGracePeriod(false);
    }
  };

  const handleSaveBrevo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBrevo(true);
    try {
      const trimmedKey = brevoApiKeyInput.trim();
      const update: { brevo_sender_email: string; brevo_sender_name: string; brevo_api_key?: string } = {
        brevo_sender_email: brevoSenderEmail.trim(),
        brevo_sender_name: brevoSenderName.trim(),
      };
      // Dejar el campo en blanco conserva la API Key ya guardada — solo se
      // sobrescribe si el superadmin escribió una nueva.
      if (trimmedKey) update.brevo_api_key = trimmedKey;

      const { error } = await supabase.from('platform_settings').update(update).eq('id', true);
      if (error) throw error;

      if (trimmedKey) setBrevoConfigured(true);
      setBrevoApiKeyInput('');
      toast.success('Configuración de correo (Brevo) guardada.');
    } catch (err: any) {
      toast.error('Error guardando la configuración de Brevo: ' + err.message);
    } finally {
      setSavingBrevo(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      toast.error('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      toast.error('La contraseña debe incluir al menos una letra minúscula.');
      return;
    }

    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      toast.error('La contraseña debe incluir al menos un símbolo o carácter especial.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error('Error al cambiar contraseña: ' + error.message);
    } else {
      toast.success('Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
  };

  const handleUpsertPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) return;

    setIsSubmittingPlan(true);
    const { error } = await supabase.rpc('superadmin_upsert_plan', {
      p_plan_id: editingPlanId || '',
      p_name: planForm.name.trim(),
      p_max_members: planForm.max_members,
      p_price_monthly: planForm.price_monthly,
      p_price_annual: planForm.price_annual,
      p_has_electronic_billing: planForm.has_electronic_billing
    });

    if (error) {
      toast.error('Error guardando plan: ' + error.message);
    } else {
      toast.success('Plan guardado exitosamente.');
      setIsPlanModalOpen(false);
      setEditingPlanId(null);
      invalidatePlatformData();
    }
    setIsSubmittingPlan(false);
  };

  // Filter logic
  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculations for Superadmin Dashboard
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

  // Un centro en ciclo anual aporta price_annual/12 al MRR, no
  // price_monthly — antes se asumía mensual para todos, sin importar el
  // ciclo real (billing_cycle) de la suscripción.
  const mrr = organizations.reduce((sum, org) => {
    if (org.status !== 'active' || !org.plan_id) return sum;
    const plan = plans.find((p) => p.id === org.plan_id);
    if (!plan) return sum;
    return sum + (org.billing_cycle === 'annual' ? (plan.price_annual || 0) / 12 : (plan.price_monthly || 0));
  }, 0);

  const arr = mrr * 12;
  const totalTenants = organizations.length;
  const activeTenants = organizations.filter((o) => o.status === 'active').length;
  const trialingTenants = organizations.filter((o) => o.status === 'trialing').length;
  const pastDueTenants = organizations.filter((o) => o.status === 'past_due' || o.status === 'suspended').length;

  const now = new Date();
  const fiveDaysFromNow = new Date();
  fiveDaysFromNow.setDate(now.getDate() + 5);

  const expiringTrials = organizations.filter((o) => {
    if (o.status !== 'trialing' || !o.trial_end) return false;
    const trialEndDate = new Date(o.trial_end);
    return trialEndDate <= fiveDaysFromNow;
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  const recentRegistrationsCount = organizations.filter((o) => new Date(o.created_at) >= sevenDaysAgo).length;

  const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthlyGrowth: { month: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();
    const count = organizations.filter((o) => {
      const cd = new Date(o.created_at);
      return cd.getMonth() === m && cd.getFullYear() === y;
    }).length;
    monthlyGrowth.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: MONTH_NAMES_SHORT[m],
      count,
    });
  }

  const planDistMap: Record<string, number> = {};
  organizations.forEach((o) => {
    const pName = plans.find((p) => p.id === o.plan_id)?.name || 'Sin Plan';
    planDistMap[pName] = (planDistMap[pName] || 0) + 1;
  });
  const colorsList = ['bg-indigo-500', 'bg-emerald-500', 'bg-violet-500', 'bg-cyan-500', 'bg-amber-500'];
  const planDistribution = Object.entries(planDistMap).map(([name, count], idx) => ({
    name,
    count,
    pct: totalTenants > 0 ? Math.round((count / totalTenants) * 100) : 0,
    color: colorsList[idx % colorsList.length],
  }));

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {
            activeTab === 'dashboard' ? 'Dashboard General SaaS' :
            activeTab === 'tenants' ? 'Centros Integrales' :
            activeTab === 'plans' ? 'Planes & Licencias' :
            activeTab === 'audit' ? 'Auditoría' :
            activeTab === 'settings' ? 'Configuración' : 'Dashboard General'
          }
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {
            activeTab === 'dashboard' ? 'Visión ejecutiva de ingresos, clientes y salud global de la plataforma.' :
            activeTab === 'settings' ? 'Administra tu cuenta, el equipo de superadministradores y los parámetros globales de facturación y cobranza de la plataforma.' :
            'Panel de control de operaciones globales y tenants de la plataforma.'
          }
        </p>
      </header>

        {/* PESTAÑA 0: Dashboard General (Superadmin) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Top KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: MRR */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    SaaS MRR
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-extrabold text-slate-900">{fmt(mrr)}</p>
                  <p className="text-xs text-slate-500 mt-1">ARR Proyectado: <strong className="text-slate-800">{fmt(arr)}/año</strong></p>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-3">Ingreso Recurrente Mensual</p>
              </div>

              {/* Card 2: Active Tenants */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                    {activeTenants} Activos
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-extrabold text-slate-900">{totalTenants} Centros</p>
                  <p className="text-xs text-slate-500 mt-1">{trialingTenants} en prueba | {pastDueTenants} pend./susp.</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-3">Centros Integrales Registrados</p>
              </div>

              {/* Card 3: Global Impact */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-violet-50 text-violet-700 rounded-full">
                    Impacto Global
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-extrabold text-slate-900">{totalBeneficiariesCount}</p>
                  <p className="text-xs text-slate-500 mt-1">{totalMembersCount} usuarios de equipo en la plataforma</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-3">Beneficiarios Totales Atendidos</p>
              </div>

              {/* Card 4: Total Volume */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-cyan-50 text-cyan-700 rounded-full">
                    Transaccionado
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-extrabold text-slate-900">{fmt(totalVolumeProcessed)}</p>
                  <p className="text-xs text-slate-500 mt-1">Volumen total cobrado por los centros</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-3">Volumen de Operaciones</p>
              </div>
            </div>

            {/* Actionable Alerts Banner */}
            {(expiringTrials.length > 0 || pastDueTenants > 0 || recentRegistrationsCount > 0) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Alertas Ejecutivas para Superadmin</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {expiringTrials.length > 0 && (
                    <div className="p-4 rounded-xl border-l-4 border-l-amber-500 bg-amber-50 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{expiringTrials.length} centro(s) en prueba por vencer</p>
                        <p className="text-xs text-slate-500 mt-0.5">Vencen en menos de 5 días</p>
                      </div>
                      <Link to="/admin?tab=tenants&status=trialing" className="text-xs font-bold text-indigo-600 hover:underline flex-shrink-0 ml-3">
                        Ver →
                      </Link>
                    </div>
                  )}
                  {pastDueTenants > 0 && (
                    <div className="p-4 rounded-xl border-l-4 border-l-red-500 bg-red-50 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{pastDueTenants} centro(s) con pago pendiente / susp.</p>
                        <p className="text-xs text-slate-500 mt-0.5">Requieren gestión comercial</p>
                      </div>
                      <Link to="/admin?tab=tenants&status=past_due" className="text-xs font-bold text-indigo-600 hover:underline flex-shrink-0 ml-3">
                        Ver →
                      </Link>
                    </div>
                  )}
                  {recentRegistrationsCount > 0 && (
                    <div className="p-4 rounded-xl border-l-4 border-l-emerald-500 bg-emerald-50 flex items-center justify-between shadow-xs">
                      <div>
                        <p className="text-sm font-bold text-slate-800">+{recentRegistrationsCount} nuevo(s) centro(s) esta semana</p>
                        <p className="text-xs text-slate-500 mt-0.5">Nuevos registros en la plataforma</p>
                      </div>
                      <Link to="/admin?tab=tenants" className="text-xs font-bold text-indigo-600 hover:underline flex-shrink-0 ml-3">
                        Ver →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tenant Growth Chart (6 months) */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Crecimiento de Centros Integrales</h3>
                    <p className="text-xs text-slate-500">Nuevos registros por mes (últimos 6 meses)</p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    +{recentRegistrationsCount} esta semana
                  </span>
                </div>
                <div className="flex items-end gap-3 h-40 w-full pt-4">
                  {monthlyGrowth.map((mg) => {
                    const maxGrowth = Math.max(...monthlyGrowth.map(m => m.count), 1);
                    const pct = (mg.count / maxGrowth) * 100;
                    return (
                      <div key={mg.month} className="flex flex-col items-center gap-1 flex-1 group relative">
                        <div className="relative w-full flex items-end justify-center h-28">
                          {mg.count > 0 && (
                            <span className="absolute -top-6 text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {mg.count} centro(s)
                            </span>
                          )}
                          <div
                            className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:from-indigo-700 group-hover:to-indigo-500"
                            style={{ height: `${Math.max(pct, mg.count > 0 ? 12 : 4)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 mt-1">{mg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Plan Distribution Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-1">Distribución por Plan</h3>
                <p className="text-xs text-slate-500 mb-4">Centros asignados por paquete comercial</p>

                <div className="space-y-4">
                  {planDistribution.map((pd, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">{pd.name}</span>
                        <span className="text-slate-500">{pd.count} centros ({pd.pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pd.color}`}
                          style={{ width: `${pd.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Planes Activos: <strong>{plans.length}</strong></span>
                  <Link to="/admin?tab=plans" className="text-indigo-600 font-semibold hover:underline">Gestionar →</Link>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Tenants & Audit Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Tenants */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Centros Recientes</h3>
                    <p className="text-xs text-slate-500">Últimas organizaciones registradas</p>
                  </div>
                  <Link to="/admin?tab=tenants" className="text-xs font-bold text-indigo-600 hover:underline">Ver todos →</Link>
                </div>
                <div className="divide-y divide-slate-100">
                  {organizations.slice(0, 5).map((org) => {
                    const planName = plans.find(p => p.id === org.plan_id)?.name || 'Sin Plan';
                    return (
                      <div key={org.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-400 font-mono">ID: {org.id.substring(0, 8)}... | Plan: {planName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            org.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            org.status === 'trialing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            org.status === 'suspended' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {org.status === 'active' ? 'Activo' : org.status === 'trialing' ? 'En Prueba' : org.status === 'suspended' ? 'Suspendido' : org.status}
                          </span>
                          <Link to={`/admin/organizations/${org.id}`} className="text-xs text-indigo-600 font-semibold hover:underline">
                            Ver
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Audit Stream */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Actividad de Auditoría Global</h3>
                    <p className="text-xs text-slate-500">Log reciente del sistema (`audit_logs`)</p>
                  </div>
                  <Link to="/admin?tab=audit" className="text-xs font-bold text-indigo-600 hover:underline">Ver log completo →</Link>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No hay eventos de auditoría registrados aún.</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                            {log.action}
                          </span>
                          <span className="text-slate-600">{log.entity}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(log.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 1: Centros Integrales (Tenants) */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            {/* Toolbar: Búsqueda, Filtros y Botón de Nuevo Centro */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-lg">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar centro por nombre o ID..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activo</option>
                  <option value="trialing">En Prueba (Trial)</option>
                  <option value="suspended">Suspendido</option>
                  <option value="past_due">Pago Pendiente</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>

              <button
                onClick={() => setIsCreatingOrg(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Registrar Nuevo Centro
              </button>
            </div>

            {/* Tabla de Centros */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-500 animate-pulse">Cargando centros...</div>
              ) : filteredOrgs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  No se encontraron centros integrales con los criterios aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Organización / Centro</th>
                        <th className="px-6 py-3.5">Estado Suscripción</th>
                        <th className="px-6 py-3.5">Fecha Registro</th>
                        <th className="px-6 py-3.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredOrgs.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-base">{org.name}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{org.id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={org.status}
                                onChange={(e) => handleSetStatus(org.id, e.target.value)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                                  org.status === 'active' || org.status === 'trialing'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : org.status === 'suspended'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <option value="trialing">En Prueba (Trialing)</option>
                                <option value="active">Activo (Active)</option>
                                <option value="past_due">Pago Pendiente (Past Due)</option>
                                <option value="suspended">Suspendido (Suspended)</option>
                                <option value="canceled">Cancelado (Canceled)</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {formatDate(org.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                to={`/admin/organizations/${org.id}`}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver Detalles
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: Planes & Licencias */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Planes Comerciales Disponibles</h2>
                  <p className="text-sm text-slate-500">
                    Define los paquetes de suscripción y sus costos para los centros.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanForm({ name: '', price_monthly: 0, price_annual: 0, max_members: 10, has_electronic_billing: false });
                    setIsPlanModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Nuevo Plan
                </button>
              </div>

              {plans.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="font-medium text-slate-600">No hay planes registrados</p>
                  <p className="text-xs mt-1">Comienza creando un plan básico para ofrecer a tus clientes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div key={plan.id} className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col relative overflow-hidden group hover:border-indigo-300 transition-colors">
                      {/* Ribbon para Facturación */}
                      {plan.features?.has_electronic_billing && (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                          Incluye SRI
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                        
                        <div className="mt-4 flex items-baseline text-slate-900">
                          <span className="text-3xl font-extrabold tracking-tight">${plan.price_monthly}</span>
                          <span className="ml-1 text-sm font-medium text-slate-500">/mes</span>
                        </div>
                        <div className="mt-1 flex items-baseline text-slate-600">
                          <span className="text-sm font-semibold">${plan.price_annual}</span>
                          <span className="ml-1 text-xs text-slate-500">/año (Ahorro Anual)</span>
                        </div>

                        <ul className="mt-6 space-y-3 text-sm text-slate-600">
                          <li className="flex gap-x-3">
                            <svg className="h-5 w-5 flex-none text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span>Límite de <strong className="font-semibold text-slate-900">{plan.max_members || 'Ilimitados'}</strong> usuarios</span>
                          </li>
                          <li className="flex gap-x-3">
                            <svg className={`h-5 w-5 flex-none ${plan.features?.has_electronic_billing ? 'text-indigo-600' : 'text-slate-300'}`} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span className={plan.features?.has_electronic_billing ? 'text-slate-700' : 'text-slate-400 line-through'}>
                              Facturación Electrónica
                            </span>
                          </li>
                        </ul>
                      </div>

                      <button
                        onClick={() => {
                          setEditingPlanId(plan.id);
                          setPlanForm({
                            name: plan.name,
                            price_monthly: plan.price_monthly,
                            price_annual: plan.price_annual,
                            max_members: plan.max_members || 10,
                            has_electronic_billing: plan.features?.has_electronic_billing || false,
                          });
                          setIsPlanModalOpen(true);
                        }}
                        className="mt-8 block w-full rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                      >
                        Editar Plan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: Auditoría & Invitaciones */}
        {activeTab === 'audit' && (() => {
          // Filtered invitations
          const filteredInvs = invitations.filter((inv) => {
            const matchesOrg = auditOrgFilter === 'all' || inv.organization_id === auditOrgFilter;
            const matchesStatus = invitationStatusFilter === 'all' || inv.status === invitationStatusFilter;
            const matchesSearch =
              !auditSearchTerm ||
              inv.email.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
              inv.role.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
              (inv.organizations?.name || '').toLowerCase().includes(auditSearchTerm.toLowerCase());
            return matchesOrg && matchesStatus && matchesSearch;
          });

          // Filtered audit logs
          const filteredLogs = auditLogs.filter((log) => {
            const matchesOrg = auditOrgFilter === 'all' || log.organization_id === auditOrgFilter;
            const orgName = organizations.find(o => o.id === log.organization_id)?.name || '';
            const matchesSearch =
              !auditSearchTerm ||
              log.action.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
              log.entity.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
              orgName.toLowerCase().includes(auditSearchTerm.toLowerCase());
            return matchesOrg && matchesSearch;
          });

          const pendingInvs = invitations.filter(i => i.status === 'pending').length;
          const acceptedInvs = invitations.filter(i => i.status === 'accepted').length;
          const expiredInvs = invitations.filter(i => i.status === 'expired' || i.status === 'cancelled').length;

          return (
            <div className="space-y-6">
              {/* Header & Sub-tab switcher */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Auditoría & Invitaciones de Plataforma</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Supervisa la actividad inmutable del sistema y rastrea las invitaciones enviadas en cada centro.
                  </p>
                </div>

                {/* Sub-tab navigation */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    onClick={() => setAuditSubTab('invitations')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      auditSubTab === 'invitations'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✉️ Invitaciones Globales ({invitations.length})
                  </button>
                  <button
                    onClick={() => setAuditSubTab('logs')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      auditSubTab === 'logs'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📜 Logs de Auditoría ({auditLogs.length})
                  </button>
                </div>
              </div>

              {/* Badges / KPI Cards bar for Invitations */}
              {auditSubTab === 'invitations' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Total Invitaciones</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{invitations.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <p className="text-xs font-semibold text-amber-500 uppercase">Pendientes</p>
                    <p className="text-xl font-bold text-amber-600 mt-1">{pendingInvs}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <p className="text-xs font-semibold text-emerald-500 uppercase">Aceptadas</p>
                    <p className="text-xl font-bold text-emerald-600 mt-1">{acceptedInvs}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <p className="text-xs font-semibold text-red-500 uppercase">Vencidas / Canceladas</p>
                    <p className="text-xl font-bold text-red-600 mt-1">{expiredInvs}</p>
                  </div>
                </div>
              )}

              {/* Filters toolbar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    placeholder={auditSubTab === 'invitations' ? "Buscar por correo, rol o centro..." : "Buscar por acción, entidad o centro..."}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Org filter dropdown */}
                <select
                  value={auditOrgFilter}
                  onChange={(e) => setAuditOrgFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 w-full sm:w-auto"
                >
                  <option value="all">Todos los Centros</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>

                {/* Status filter dropdown (only for invitations) */}
                {auditSubTab === 'invitations' && (
                  <select
                    value={invitationStatusFilter}
                    onChange={(e) => setInvitationStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 w-full sm:w-auto"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pending">Pendientes</option>
                    <option value="accepted">Aceptadas</option>
                    <option value="expired">Vencidas</option>
                    <option value="cancelled">Canceladas</option>
                  </select>
                )}
              </div>

              {/* TAB CONTENT 1: Invitations Table */}
              {auditSubTab === 'invitations' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  {filteredInvs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">
                      No se encontraron invitaciones registradas con los filtros aplicados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-3.5">Centro Integral</th>
                            <th className="px-6 py-3.5">Correo Destinatario</th>
                            <th className="px-6 py-3.5">Rol Asignado</th>
                            <th className="px-6 py-3.5">Estado</th>
                            <th className="px-6 py-3.5">Fecha Envío</th>
                            <th className="px-6 py-3.5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredInvs.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-900 block">
                                  {inv.organizations?.name || 'Centro Desconocido'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">ID: {inv.organization_id.substring(0, 8)}...</span>
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-800">{inv.email}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                                  {inv.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                                  inv.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  inv.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                  {inv.status === 'accepted' ? 'Aceptada' : inv.status === 'pending' ? 'Pendiente' : inv.status === 'cancelled' ? 'Cancelada' : 'Vencida'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                                {formatDate(inv.created_at)}, {new Date(inv.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {inv.status === 'pending' && (
                                  <button
                                    onClick={() => handleCancelInvitation(inv.id)}
                                    className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 2: Audit Logs Table */}
              {auditSubTab === 'logs' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">
                      No hay registros de auditoría que coincidan con la búsqueda.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-3.5">Fecha / Hora</th>
                            <th className="px-6 py-3.5">Acción</th>
                            <th className="px-6 py-3.5">Entidad</th>
                            <th className="px-6 py-3.5">Centro Integral</th>
                            <th className="px-6 py-3.5">ID Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredLogs.map((log) => {
                            const orgName = organizations.find((o) => o.id === log.organization_id)?.name || 'Sistema Global';
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-3.5 text-xs text-slate-500 font-mono">
                                  {new Date(log.created_at).toLocaleString('es-EC')}
                                </td>
                                <td className="px-6 py-3.5">
                                  <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded text-xs">
                                    {log.action}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 text-xs text-slate-600 font-semibold">{log.entity}</td>
                                <td className="px-6 py-3.5 text-xs font-semibold text-slate-800">
                                  {orgName}
                                  <span className="block text-[10px] text-slate-400 font-mono">{log.organization_id}</span>
                                </td>
                                <td className="px-6 py-3.5 text-xs font-mono text-slate-500">{log.user_id || 'Sistema'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* PESTAÑA 4: Configuración (Mi Cuenta + Plataforma, un solo módulo) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Sub-navegación interna */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-fit">
              <button
                type="button"
                onClick={() => setConfigSubTab('cuenta')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  configSubTab === 'cuenta'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Mi Cuenta
              </button>
              <button
                type="button"
                onClick={() => setConfigSubTab('plataforma')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  configSubTab === 'plataforma'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" /> Plataforma
              </button>
            </div>

            {configSubTab === 'cuenta' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fadeIn">
                {/* Columna principal: perfil + equipo */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Formulario Datos Personales */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Datos del Superusuario</h2>

                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                        <input
                          type="text"
                          value={user?.email || ''}
                          disabled
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-500 cursor-not-allowed font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                          <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Tu nombre"
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Tu apellido"
                            className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        Guardar Perfil
                      </button>
                    </form>
                  </div>

                  {/* Equipo de Superadministradores de la Plataforma */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Equipo de Superadministradores</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Usuarios con acceso de control total a la plataforma (`platform_admins`).
                        </p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full whitespace-nowrap">
                        {platformAdmins.length} Administrador(es)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {platformAdmins.map((adm) => {
                        const isCurrent = adm.user_id === user?.id;
                        const name = adm.profiles?.first_name ? `${adm.profiles.first_name} ${adm.profiles.last_name || ''}` : 'Superusuario';
                        return (
                          <div key={adm.user_id} className="py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                                {name[0] || 'S'}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                  {name}
                                  {isCurrent && (
                                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                      Tú
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">ID: {adm.user_id}</p>
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              {formatDate(adm.created_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Columna lateral: Seguridad de la Cuenta — cambio de contraseña colapsado por defecto */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-xs lg:sticky lg:top-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Seguridad de la Cuenta</h2>
                      <p className="text-sm text-slate-500 mt-0.5">Contraseña de acceso al panel de superadmin.</p>
                    </div>
                  </div>

                  {!showPasswordForm && (
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(true)}
                      className="mt-4 inline-flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Cambiar Contraseña
                    </button>
                  )}

                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      showPasswordForm ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <form onSubmit={handleChangePassword} className="space-y-4 pt-5 mt-5 border-t border-slate-100">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                              {showNewPassword ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.858A9.954 9.954 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-4.592-4.592a3 3 0 11-4.243-4.243m4.242 4.242L3 3l18 18" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nueva Contraseña</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                              {showConfirmPassword ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.858A9.954 9.954 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-4.592-4.592a3 3 0 11-4.243-4.243m4.242 4.242L3 3l18 18" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                          >
                            Actualizar Contraseña
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}
                            className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {configSubTab === 'plataforma' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start animate-fadeIn">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-start gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Percent className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Facturación Electrónica</p>
                      <h2 className="text-lg font-bold text-slate-900">Impuestos</h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-4 mt-3">
                    Porcentaje de IVA usado como referencia para la facturación electrónica.
                    Por ahora los montos se registran ya incluyendo IVA — este valor todavía
                    no se aplica automáticamente en ningún cálculo.
                  </p>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Porcentaje de IVA (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={ivaPercentage}
                        onChange={(e) => setIvaPercentage(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                      {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">Comunicaciones</p>
                        <h2 className="text-lg font-bold text-slate-900">Correo de Facturas (Brevo)</h2>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      brevoConfigured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {brevoConfigured ? 'Configurada' : 'Sin configurar'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-4 mt-3">
                    Credenciales de la API transaccional de Brevo usadas para enviar automáticamente el RIDE y el XML de cada factura autorizada al correo del cliente. Se comparte entre todos los centros de la plataforma.
                  </p>

                  <form onSubmit={handleSaveBrevo} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">API Key de Brevo</label>
                      <input
                        type="password"
                        value={brevoApiKeyInput}
                        onChange={(e) => setBrevoApiKeyInput(e.target.value)}
                        placeholder={brevoConfigured ? 'Ya configurada — deja en blanco para no cambiarla' : 'xkeysib-...'}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Generar en Brevo → Configuración → SMTP y API → API Keys. Distinta de la clave SMTP que ya usa el envío de invitaciones.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Correo Remitente</label>
                      <input
                        type="email"
                        value={brevoSenderEmail}
                        onChange={(e) => setBrevoSenderEmail(e.target.value)}
                        placeholder="facturacion@tudominio.com"
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">Debe estar verificado en Brevo, o los envíos se rechazan.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Remitente</label>
                      <input
                        type="text"
                        value={brevoSenderName}
                        onChange={(e) => setBrevoSenderName(e.target.value)}
                        placeholder="Facturación Electrónica"
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingBrevo}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {savingBrevo && <Loader2 className="w-4 h-4 animate-spin" />}
                      {savingBrevo ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-start gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Cobranza y Suscripciones</p>
                      <h2 className="text-lg font-bold text-slate-900">Suspensión Automática por Falta de Pago</h2>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-4 mt-3">
                    Si un centro tiene un cargo pendiente vencido por más de este plazo, se
                    suspende automáticamente (una vez al día) — pierde acceso hasta que
                    confirmes su pago. Mientras el plazo no se cumpla, el centro sigue activo
                    con normalidad.
                  </p>

                  <form onSubmit={handleSaveGracePeriod} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Días de gracia</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={gracePeriodDays}
                        onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingGracePeriod}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {savingGracePeriod && <Loader2 className="w-4 h-4 animate-spin" />}
                      {savingGracePeriod ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
        </div>

      {/* MODAL: Registrar Nuevo Centro */}
      {isCreatingOrg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Registrar Nuevo Centro Integral</h3>
            <p className="text-sm text-slate-500 mb-6">
              Ingresa el nombre oficial de la organización o guardería y elige el plan inicial.
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Organización</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ej. Centro Integral Creciendo Juntos"
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan Inicial <span className="text-red-500">*</span></label>
                <select
                  value={newOrgPlanId}
                  onChange={(e) => setNewOrgPlanId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>Selecciona el plan para este centro</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${p.price_monthly}/mes
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">El centro iniciará en estado Trial. Puedes cambiarlo luego desde la ficha del centro.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsCreatingOrg(false); setNewOrgName(''); setNewOrgPlanId(''); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrg || !newOrgPlanId}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingOrg && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmittingOrg ? 'Registrando...' : 'Crear Centro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: Crear / Editar Plan */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {editingPlanId ? 'Editar Plan Comercial' : 'Crear Nuevo Plan'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Define los límites y el costo mensual/anual para este paquete de suscripción.
            </p>

            <form onSubmit={handleUpsertPlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Plan</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Ej. Plan Pro"
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Mensual ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.price_monthly}
                    onChange={(e) => setPlanForm({ ...planForm, price_monthly: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Anual ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.price_annual}
                    onChange={(e) => setPlanForm({ ...planForm, price_annual: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Miembros (0 = Ilimitado)</label>
                <input
                  type="number"
                  min="0"
                  value={planForm.max_members}
                  onChange={(e) => setPlanForm({ ...planForm, max_members: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="flex h-6 items-center">
                    <input
                      type="checkbox"
                      checked={planForm.has_electronic_billing}
                      onChange={(e) => setPlanForm({ ...planForm, has_electronic_billing: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-900">Facturación Electrónica (SRI)</span>
                    <span className="block text-xs text-slate-500 mt-1">Activa el módulo integrado de facturación electrónica ecuatoriana para este plan.</span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPlan}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPlan && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmittingPlan ? 'Guardando...' : 'Guardar Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
