import { useState, useCallback, useLayoutEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { Building2, ArrowLeft, Users, Mail, CreditCard, Trash2, ShieldCheck, Check, Clock, AlertCircle, PackageCheck, FileKey2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../lib/formatDate';

type SriConfig = {
  environment: 'pruebas' | 'produccion';
  establecimiento: string;
  punto_emision: string;
  cert_uploaded_at: string | null;
};

type PendingCharge = {
  id: string;
  amount: number;
  billing_cycle: 'monthly' | 'annual';
  due_date: string;
  period_label: string | null;
};

type Organization = {
  id: string;
  name: string;
  created_at: string;
  subscription_status?: string;
  billing_cycle?: 'monthly' | 'annual';
  current_period_end?: string | null;
  plan_id?: string;
  plan_name?: string;
  plan_price?: number;
  plan_price_annual?: number;
  pending_charge?: PendingCharge | null;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  price_monthly: number;
  price_annual: number;
};

type OrgUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

type OrgInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type PaymentRecord = {
  id: string;
  amount: number;
  billing_cycle: 'monthly' | 'annual' | null;
  payment_date: string;
  reference: string | null;
  status: string;
};

export function PlatformOrganizationDetail() {
  const { id: orgId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'payments' | 'billing'>('members');

  // Facturación electrónica SRI
  const [sriConfig, setSriConfig] = useState<SriConfig | null>(null);
  const [sriEnvironment, setSriEnvironment] = useState<'pruebas' | 'produccion'>('pruebas');
  const [savingSriEnv, setSavingSriEnv] = useState(false);
  // La base ya permite a un superadmin actualizar toda la fila de
  // sri_configurations (política "Platform admins can update
  // sri_configurations") — antes solo se aprovechaba para "environment";
  // establecimiento/punto_emision se mostraban de solo lectura sin
  // necesidad real, ya que el permiso ya estaba puesto.
  const [establecimientoDraft, setEstablecimientoDraft] = useState('');
  const [puntoEmisionDraft, setPuntoEmisionDraft] = useState('');
  const [savingSriIds, setSavingSriIds] = useState(false);

  // Modales
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ConfirmDialog State
  const [confirmCancelInv, setConfirmCancelInv] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  // Pagos
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Planes
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isAssigningPlan, setIsAssigningPlan] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!orgId) throw new Error('Falta el id de la organización.');

    // 1. Obtener datos de la organización
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();
    if (orgError) throw orgError;

    // 2. Obtener estado de suscripción con nombre y precios del plan
    const { data: subData } = await supabase
      .from('subscriptions')
      .select(`
        status,
        plan_id,
        billing_cycle,
        current_period_end,
        subscription_plans (
          id,
          name,
          price_monthly,
          price_annual
        )
      `)
      .eq('organization_id', orgId)
      .single();

    // 2b. Cargo pendiente actual (a lo sumo uno — lo garantiza el índice
    // único parcial idx_platform_charges_one_pending_per_org).
    const { data: chargeData } = await supabase
      .from('platform_charges')
      .select('id, amount, billing_cycle, due_date, period_label')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .maybeSingle();

    const planData = subData?.subscription_plans as any;
    const org: Organization = {
      ...orgData,
      subscription_status: subData?.status,
      billing_cycle: (subData?.billing_cycle as 'monthly' | 'annual') || 'monthly',
      current_period_end: subData?.current_period_end,
      plan_id: subData?.plan_id,
      plan_name: planData?.name,
      plan_price: planData?.price_monthly,
      plan_price_annual: planData?.price_annual,
      pending_charge: (chargeData as PendingCharge) || null,
    };

    // 3. Obtener planes disponibles
    const { data: plansData } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly, price_annual')
      .order('price_monthly', { ascending: true });

    // 4. Obtener usuarios
    const { data: usersData, error: usersError } = await supabase.rpc('get_organization_users', { p_organization_id: orgId });
    if (usersError) throw usersError;

    // 5. Obtener invitaciones
    const { data: invData, error: invError } = await supabase.rpc('get_organization_invitations', { p_organization_id: orgId });
    if (invError) throw invError;

    // 6. Obtener configuración SRI (si el centro ya la configuró)
    const { data: sriData } = await supabase
      .from('sri_configurations')
      .select('environment, establecimiento, punto_emision, cert_uploaded_at')
      .eq('organization_id', orgId)
      .maybeSingle();

    // 7. Historial de pagos de plataforma (más reciente primero).
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, amount, billing_cycle, payment_date, reference, status')
      .eq('organization_id', orgId)
      .order('payment_date', { ascending: false });

    return {
      organization: org,
      availablePlans: (plansData as SubscriptionPlan[]) || [],
      users: (usersData as unknown as OrgUser[]) || [],
      invitations: (invData as unknown as OrgInvitation[]) || [],
      sriConfig: (sriData as SriConfig) || null,
      paymentHistory: (paymentsData as PaymentRecord[]) || [],
    };
  }, [orgId]);

  // React Query en vez de un solo fetch al montar: así el superadmin ya no
  // depende de F5 para ver, por ejemplo, que un representante aceptó una
  // invitación en su propia sesión — se refresca solo al volver a la
  // pestaña (refetchOnWindowFocus) y cada 45s mientras la pestaña siga
  // activa (refetchInterval).
  const { data: orgDetailData, isLoading: loading } = useQuery({
    queryKey: ['org-detail', orgId],
    queryFn: fetchDetails,
    enabled: !!orgId,
    refetchOnWindowFocus: true,
    refetchInterval: 45000,
  });

  const invalidateOrgDetail = () => queryClient.invalidateQueries({ queryKey: ['org-detail', orgId] });

  useLayoutEffect(() => {
    if (!orgDetailData) return;
    setOrganization(orgDetailData.organization);
    setUsers(orgDetailData.users);
    setInvitations(orgDetailData.invitations);
    setSriConfig(orgDetailData.sriConfig);
    setAvailablePlans(orgDetailData.availablePlans);
    setPaymentHistory(orgDetailData.paymentHistory);
  }, [orgDetailData]);

  // Estos dos son borradores editables (el superadmin puede cambiar la
  // selección antes de guardar) — se resincronizan solo cuando el valor
  // GUARDADO realmente cambia, nunca en cada refetch de fondo, para no
  // pisar una selección que el superadmin todavía no guardó.
  useLayoutEffect(() => {
    setSelectedPlanId(orgDetailData?.organization.plan_id || '');
  }, [orgDetailData?.organization.plan_id]);

  useLayoutEffect(() => {
    setSelectedBillingCycle(orgDetailData?.organization.billing_cycle || 'monthly');
  }, [orgDetailData?.organization.billing_cycle]);

  useLayoutEffect(() => {
    const env = orgDetailData?.sriConfig?.environment;
    if (env) setSriEnvironment(env);
  }, [orgDetailData?.sriConfig?.environment]);

  useLayoutEffect(() => {
    setEstablecimientoDraft(orgDetailData?.sriConfig?.establecimiento || '');
    setPuntoEmisionDraft(orgDetailData?.sriConfig?.punto_emision || '');
  }, [orgDetailData?.sriConfig?.establecimiento, orgDetailData?.sriConfig?.punto_emision]);

  const handleAssignPlan = async () => {
    if (!orgId || !selectedPlanId) return;
    setIsAssigningPlan(true);
    try {
      const { error } = await supabase.rpc('superadmin_assign_plan', {
        p_org_id: orgId,
        p_plan_id: selectedPlanId,
        p_billing_cycle: selectedBillingCycle,
      });
      if (error) throw error;
      toast.success('Plan actualizado — se generó el cargo pendiente correspondiente.');
      await invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error al asignar plan: ' + err.message);
    } finally {
      setIsAssigningPlan(false);
    }
  };

  const handleSetStatus = async (status: string) => {
    if (!orgId) return;
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase.rpc('superadmin_set_subscription_status', {
        p_org_id: orgId,
        p_status: status,
      });
      if (error) throw error;
      toast.success('Estado actualizado.');
      await invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error actualizando estado: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveSriEnvironment = async () => {
    if (!orgId) return;
    setSavingSriEnv(true);
    try {
      const { error } = await supabase
        .from('sri_configurations')
        .update({ environment: sriEnvironment })
        .eq('organization_id', orgId);
      if (error) throw error;
      toast.success('Ambiente SRI actualizado.');
      await invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error al guardar el ambiente: ' + err.message);
    } finally {
      setSavingSriEnv(false);
    }
  };

  const handleSaveSriIds = async () => {
    if (!orgId) return;
    const establecimiento = establecimientoDraft.trim();
    const puntoEmision = puntoEmisionDraft.trim();
    if (!/^\d{3}$/.test(establecimiento) || !/^\d{3}$/.test(puntoEmision)) {
      toast.error('Establecimiento y Punto de Emisión deben ser exactamente 3 dígitos (ej. 001).');
      return;
    }
    setSavingSriIds(true);
    try {
      const { error } = await supabase
        .from('sri_configurations')
        .update({ establecimiento, punto_emision: puntoEmision })
        .eq('organization_id', orgId);
      if (error) throw error;
      toast.success('Establecimiento y Punto de Emisión actualizados.');
      await invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSavingSriIds(false);
    }
  };

  const handleInviteOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !inviteEmail) return;
    
    setIsSubmittingInvite(true);
    setInviteStatus(null);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          organization_id: orgId,
          email: inviteEmail,
          role: 'owner'
        }
      });
      if (error) throw error;
      setInviteStatus({ type: 'success', msg: 'Invitación enviada exitosamente.' });
      invalidateOrgDetail();
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteEmail('');
        setInviteStatus(null);
      }, 2000);
    } catch (err: any) {
      setInviteStatus({ type: 'error', msg: err.message || 'Error al enviar invitación.' });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (!confirmCancelInv.id) return;
    try {
      const { error } = await supabase.rpc('cancel_invitation', { p_invitation_id: confirmCancelInv.id });
      if (error) throw error;
      toast.success('Invitación cancelada correctamente.');
      invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error al cancelar: ' + err.message);
    } finally {
      setConfirmCancelInv({ isOpen: false, id: null });
    }
  };

  const handleRegisterPayment = async () => {
    if (!orgId || !organization?.pending_charge) return;

    setIsSubmittingPayment(true);
    try {
      const { error } = await supabase.rpc('superadmin_register_payment', {
        p_org_id: orgId,
        p_charge_id: organization.pending_charge.id,
        p_reference: 'Pago manual desde panel superadmin',
        p_notes: '',
      });
      if (error) throw error;
      toast.success('Pago registrado — se generó el siguiente cargo pendiente.');
      setIsPaymentOpen(false);
      invalidateOrgDetail();
    } catch (err: any) {
      toast.error('Error registrando pago: ' + err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles...</div>;
  if (!organization) return <div className="p-8 text-center text-red-500">Centro no encontrado</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-slate-500">ID: {organization.id.split('-')[0]}...</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              organization.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
              organization.subscription_status === 'past_due' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {organization.subscription_status === 'active' ? 'Activo' : 
               organization.subscription_status === 'past_due' ? 'Pago Pendiente' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('members')}
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'members' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Miembros
          </div>
          {activeTab === 'members' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('invitations')}
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'invitations' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Invitaciones Pendientes
            {invitations.filter(i => i.status === 'pending').length > 0 && (
              <span className="ml-1 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">
                {invitations.filter(i => i.status === 'pending').length}
              </span>
            )}
          </div>
          {activeTab === 'invitations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('payments')}
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'payments' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Suscripción y Pagos
          </div>
          {activeTab === 'payments' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-4 text-sm font-medium transition-colors relative ${activeTab === 'billing' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <FileKey2 className="w-4 h-4" />
            Facturación Electrónica
          </div>
          {activeTab === 'billing' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
      </div>

      {/* Contenido Tabs */}
      <div>
        {activeTab === 'members' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                Dueños y Administradores
              </h3>
            </div>
            {users.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>No hay miembros activos aún.</p>
                <button onClick={() => { setActiveTab('invitations'); setIsInviteOpen(true); }} className="mt-4 text-indigo-600 font-medium hover:underline">
                  Invitar al primer Dueño
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{u.first_name} {u.last_name}</div>
                          <div className="text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-indigo-100">
                            {u.role === 'owner' ? 'Dueño de Centro' : 'Administrador'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.status === 'active' ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                              <Check className="w-4 h-4" /> Activo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                              <AlertCircle className="w-4 h-4" /> Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {formatDate(u.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-500" />
                Historial de Invitaciones
              </h3>
              <button 
                onClick={() => setIsInviteOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                + Enviar Invitación
              </button>
            </div>
            {invitations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No hay invitaciones enviadas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Correo</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Enviado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitations.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{i.email}</td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium border border-slate-200">
                            {i.role === 'owner' ? 'Dueño de Centro' : i.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {i.status === 'pending' ? (
                            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                              <Clock className="w-4 h-4" /> Pendiente
                            </span>
                          ) : i.status === 'accepted' ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                              <Check className="w-4 h-4" /> Aceptada
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-600 font-medium">
                              <AlertCircle className="w-4 h-4" /> {i.status === 'expired' ? 'Expirada' : 'Cancelada'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {formatDate(i.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {i.status === 'pending' && (
                            <button
                              onClick={() => setConfirmCancelInv({ isOpen: true, id: i.id })}
                              className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Cancelar Invitación"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Plan actual */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-indigo-500" />
                  Plan Actual
                </h3>
                {organization.plan_id && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Ciclo actual: {organization.billing_cycle === 'annual' ? 'Anual' : 'Mensual'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Plan</p>
                  <p className="text-lg font-bold text-indigo-700">{organization.plan_name || 'Sin plan'}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Precio Mensual</p>
                  <p className="text-lg font-bold text-slate-900">${organization.plan_price ?? 0} USD</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Precio Anual</p>
                  <p className="text-lg font-bold text-slate-900">${organization.plan_price_annual ?? 0} USD</p>
                </div>
              </div>

              {/* Cambiar plan */}
              <div className="border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Cambiar Plan / Ciclo</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Selecciona un plan</option>
                    {availablePlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${p.price_monthly}/mes · ${p.price_annual}/año
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedBillingCycle}
                    onChange={(e) => setSelectedBillingCycle(e.target.value as 'monthly' | 'annual')}
                    className="bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                  </select>
                  <button
                    onClick={handleAssignPlan}
                    disabled={isAssigningPlan || (selectedPlanId === organization.plan_id && selectedBillingCycle === organization.billing_cycle)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap w-full sm:w-auto"
                  >
                    {isAssigningPlan ? 'Aplicando...' : 'Aplicar Plan'}
                  </button>
                </div>
                {(selectedPlanId !== organization.plan_id || selectedBillingCycle !== organization.billing_cycle) && selectedPlanId && (() => {
                  const plan = availablePlans.find(p => p.id === selectedPlanId);
                  const amount = plan ? (selectedBillingCycle === 'annual' ? plan.price_annual : plan.price_monthly) : 0;
                  return (
                    <p className="mt-2 text-xs text-amber-600 font-medium">
                      ⚠ Al aplicar, se generará un cargo pendiente de ${amount} USD ({selectedBillingCycle === 'annual' ? 'anual' : 'mensual'}) y se anulará cualquier cargo pendiente anterior.
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* Estado y cargo pendiente */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-500" />
                Estado Financiero
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                  <p className="text-sm text-slate-500 font-medium mb-1">Estado de Suscripción</p>
                  <p className={`text-xl font-bold mb-3 ${
                    organization.subscription_status === 'active' ? 'text-emerald-600' :
                    organization.subscription_status === 'trialing' ? 'text-indigo-600' :
                    organization.subscription_status === 'past_due' ? 'text-amber-600' :
                    organization.subscription_status === 'suspended' ? 'text-orange-600' :
                    organization.subscription_status === 'canceled' ? 'text-red-600' :
                    'text-slate-500'
                  }`}>
                    {organization.subscription_status === 'active' ? '✓ Al día' :
                     organization.subscription_status === 'trialing' ? '⏱ En prueba (Trial)' :
                     organization.subscription_status === 'past_due' ? '⚠ Pago Pendiente' :
                     organization.subscription_status === 'suspended' ? '⛔ Suspendido' :
                     organization.subscription_status === 'canceled' ? '✕ Cancelado' :
                     'Sin suscripción'}
                  </p>
                  {organization.subscription_status && (
                    <select
                      value={organization.subscription_status}
                      onChange={(e) => handleSetStatus(e.target.value)}
                      disabled={isUpdatingStatus}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <option value="trialing">En Prueba (Trialing)</option>
                      <option value="active">Activo (Active)</option>
                      <option value="past_due">Pago Pendiente (Past Due)</option>
                      <option value="suspended">Suspendido (Suspended)</option>
                      <option value="canceled">Cancelado (Canceled)</option>
                    </select>
                  )}
                </div>
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex items-center justify-between gap-3">
                  {organization.pending_charge ? (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500 font-medium mb-1">Cargo Pendiente</p>
                        <p className="text-xl font-bold text-slate-900">${Number(organization.pending_charge.amount).toFixed(2)} USD</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Vence {formatDate(organization.pending_charge.due_date)} · {organization.pending_charge.billing_cycle === 'annual' ? 'Anual' : 'Mensual'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsPaymentOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
                      >
                        Confirmar Pago
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No hay ningún cargo pendiente registrado{organization.plan_id ? ' — vuelve a aplicar el plan para generarlo.' : '.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Historial de pagos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  Historial de Pagos
                </h3>
              </div>
              {paymentHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Todavía no se ha registrado ningún pago para este centro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-6 py-3">Fecha</th>
                        <th className="px-6 py-3">Monto</th>
                        <th className="px-6 py-3">Ciclo</th>
                        <th className="px-6 py-3">Referencia</th>
                        <th className="px-6 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paymentHistory.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-slate-400 whitespace-nowrap">{formatDate(p.payment_date)}</td>
                          <td className="px-6 py-3 font-semibold text-slate-900">${Number(p.amount).toFixed(2)}</td>
                          <td className="px-6 py-3">{p.billing_cycle === 'annual' ? 'Anual' : p.billing_cycle === 'monthly' ? 'Mensual' : '—'}</td>
                          <td className="px-6 py-3 text-slate-500">{p.reference || '—'}</td>
                          <td className="px-6 py-3">
                            {p.status === 'completed' ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 font-medium"><Check className="w-4 h-4" /> Completado</span>
                            ) : p.status === 'refunded' ? (
                              <span className="flex items-center gap-1.5 text-amber-600 font-medium">Reembolsado</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertCircle className="w-4 h-4" /> Fallido</span>
                            )}
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

        {activeTab === 'billing' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-lg">
            <h3 className="font-semibold text-slate-800 text-lg mb-1 flex items-center gap-2">
              <FileKey2 className="w-5 h-5 text-indigo-500" />
              Ambiente SRI
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              Controla si las facturas de este centro se emiten contra el ambiente de pruebas o el de producción del SRI. El centro también puede editar esto temporalmente desde su Configuración mientras se validan las pruebas.
            </p>

            {!sriConfig ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                Este centro todavía no tiene ninguna configuración SRI guardada — el dueño debe entrar a{' '}
                <strong>Configuración → Facturación Electrónica</strong> dentro del centro y guardar al menos el establecimiento/punto de emisión (o subir su firma) una vez. Recién ahí aparece aquí el control de ambiente.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Establecimiento</label>
                    <input
                      type="text"
                      value={establecimientoDraft}
                      onChange={(e) => setEstablecimientoDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="001"
                      maxLength={3}
                      className="w-full font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Pto. Emisión</label>
                    <input
                      type="text"
                      value={puntoEmisionDraft}
                      onChange={(e) => setPuntoEmisionDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="001"
                      maxLength={3}
                      className="w-full font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveSriIds}
                  disabled={
                    savingSriIds ||
                    (establecimientoDraft === sriConfig.establecimiento && puntoEmisionDraft === sriConfig.punto_emision)
                  }
                  className="mb-5 inline-flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingSriIds && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {savingSriIds ? 'Guardando...' : 'Guardar Establecimiento / Pto. Emisión'}
                </button>
                <div className={`mb-5 text-xs font-bold px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 ${
                  sriConfig.cert_uploaded_at ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {sriConfig.cert_uploaded_at ? '✓ Firma electrónica subida' : '⚠ Sin firma electrónica subida'}
                </div>

                <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={sriEnvironment}
                    onChange={(e) => setSriEnvironment(e.target.value as 'pruebas' | 'produccion')}
                    className="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pruebas">Pruebas (celcer.sri.gob.ec)</option>
                    <option value="produccion">Producción (cel.sri.gob.ec)</option>
                  </select>
                  <button
                    onClick={handleSaveSriEnvironment}
                    disabled={savingSriEnv || sriEnvironment === sriConfig.environment}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap w-full sm:w-auto"
                  >
                    {savingSriEnv && <Loader2 className="w-4 h-4 animate-spin" />}
                    {savingSriEnv ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                {sriEnvironment === 'produccion' && (
                  <p className="mt-2 text-xs text-red-600 font-medium">⚠ Producción emite facturas reales y válidas ante el SRI — confirma que las pruebas ya quedaron autorizadas antes de activarlo.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Invitar Dueño */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Invitar Dueño de Centro</h3>
            <p className="text-sm text-slate-500 mb-6">
              Se enviará un correo de invitación con el rol de **Dueño de Centro** para administrar la organización seleccionada.
            </p>

            <form onSubmit={handleInviteOwner} className="space-y-4">
              {inviteStatus && (
                <div
                  className={`p-3 rounded-lg text-sm border ${
                    inviteStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {inviteStatus.msg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico del Dueño</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="dueno@centro.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setInviteStatus(null);
                    setInviteEmail('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingInvite && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmittingInvite ? 'Enviando...' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOGOS DE CONFIRMACIÓN */}
      <ConfirmDialog
        isOpen={confirmCancelInv.isOpen}
        title="Cancelar Invitación"
        message="¿Estás seguro de que deseas cancelar esta invitación pendiente? El enlace enviado dejará de funcionar."
        confirmText="Sí, Cancelar"
        cancelText="Volver"
        onConfirm={handleCancelInvitation}
        onCancel={() => setConfirmCancelInv({ isOpen: false, id: null })}
      />

      <ConfirmDialog
        isOpen={isPaymentOpen && Boolean(organization.pending_charge)}
        title="Confirmar Pago Recibido"
        message={
          organization.pending_charge
            ? `¿Confirmas que se recibió el pago de $${Number(organization.pending_charge.amount).toFixed(2)} USD (${organization.pending_charge.billing_cycle === 'annual' ? 'ciclo anual' : 'ciclo mensual'})? Esto marcará el cargo como pagado, avanzará la fecha de vencimiento de la suscripción, y generará automáticamente el siguiente cargo pendiente.`
            : ''
        }
        confirmText={isSubmittingPayment ? 'Registrando...' : 'Sí, Confirmar Pago'}
        cancelText="Cancelar"
        onConfirm={handleRegisterPayment}
        onCancel={() => setIsPaymentOpen(false)}
      />
    </div>
  );
}
