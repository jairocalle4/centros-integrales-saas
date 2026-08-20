import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { Building2, ArrowLeft, Users, Mail, CreditCard, Trash2, ShieldCheck, Check, Clock, AlertCircle, PackageCheck, FileKey2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatDate } from '../../lib/formatDate';

type SriConfig = {
  environment: 'pruebas' | 'produccion';
  establecimiento: string;
  punto_emision: string;
  cert_uploaded_at: string | null;
};

type Organization = {
  id: string;
  name: string;
  created_at: string;
  subscription_status?: string;
  plan_id?: string;
  plan_name?: string;
  plan_price?: number;
  plan_price_annual?: number;
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

export function PlatformOrganizationDetail() {
  const { id: orgId } = useParams<{ id: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'payments' | 'billing'>('members');

  // Facturación electrónica SRI
  const [sriConfig, setSriConfig] = useState<SriConfig | null>(null);
  const [sriEnvironment, setSriEnvironment] = useState<'pruebas' | 'produccion'>('pruebas');
  const [savingSriEnv, setSavingSriEnv] = useState(false);

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
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentCycle, setPaymentCycle] = useState<'monthly' | 'annual'>('monthly');

  // Planes
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isAssigningPlan, setIsAssigningPlan] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
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
          subscription_plans (
            id,
            name,
            price_monthly,
            price_annual
          )
        `)
        .eq('organization_id', orgId)
        .single();

      const planData = subData?.subscription_plans as any;
      const org: Organization = {
        ...orgData,
        subscription_status: subData?.status,
        plan_id: subData?.plan_id,
        plan_name: planData?.name,
        plan_price: planData?.price_monthly,
        plan_price_annual: planData?.price_annual,
      };
      setOrganization(org);
      setSelectedPlanId(subData?.plan_id || '');

      // 3. Obtener planes disponibles
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('id, name, price_monthly, price_annual')
        .order('price_monthly', { ascending: true });
      setAvailablePlans((plansData as SubscriptionPlan[]) || []);

      // 4. Obtener usuarios
      const { data: usersData, error: usersError } = await supabase.rpc('get_organization_users', { p_organization_id: orgId });
      if (usersError) throw usersError;
      setUsers((usersData as unknown as OrgUser[]) || []);

      // 5. Obtener invitaciones
      const { data: invData, error: invError } = await supabase.rpc('get_organization_invitations', { p_organization_id: orgId });
      if (invError) throw invError;
      setInvitations((invData as unknown as OrgInvitation[]) || []);

      // 6. Obtener configuración SRI (si el centro ya la configuró)
      const { data: sriData } = await supabase
        .from('sri_configurations')
        .select('environment, establecimiento, punto_emision, cert_uploaded_at')
        .eq('organization_id', orgId)
        .maybeSingle();
      setSriConfig((sriData as SriConfig) || null);
      if (sriData) setSriEnvironment((sriData as SriConfig).environment);

    } catch (err: any) {
      console.error('Error loading details:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const handleAssignPlan = async () => {
    if (!orgId || !selectedPlanId) return;
    setIsAssigningPlan(true);
    try {
      const { error } = await supabase.rpc('superadmin_assign_plan', {
        p_org_id: orgId,
        p_plan_id: selectedPlanId,
      });
      if (error) throw error;
      toast.success('Plan actualizado correctamente.');
      await loadDetails();
    } catch (err: any) {
      toast.error('Error al asignar plan: ' + err.message);
    } finally {
      setIsAssigningPlan(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

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
      await loadDetails();
    } catch (err: any) {
      toast.error('Error al guardar el ambiente: ' + err.message);
    } finally {
      setSavingSriEnv(false);
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
      loadDetails();
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
      loadDetails();
    } catch (err: any) {
      toast.error('Error al cancelar: ' + err.message);
    } finally {
      setConfirmCancelInv({ isOpen: false, id: null });
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !paymentAmount) return;
    
    setIsSubmittingPayment(true);
    try {
      const { error } = await supabase.rpc('superadmin_register_payment', {
        p_org_id: orgId,
        p_amount: Number(paymentAmount),
        p_billing_cycle: paymentCycle,
        p_reference: 'Pago manual desde panel superadmin',
        p_notes: '',
      });
      if (error) throw error;
      toast.success('Pago registrado exitosamente.');
      setIsPaymentOpen(false);
      loadDetails();
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
                          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <Check className="w-4 h-4" /> Activo
                          </span>
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
              <h3 className="font-semibold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-500" />
                Plan Actual
              </h3>
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
                <p className="text-sm font-semibold text-slate-700 mb-3">Cambiar Plan</p>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Selecciona un plan</option>
                    {availablePlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${p.price_monthly}/mes · ${p.price_annual}/año
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignPlan}
                    disabled={isAssigningPlan || selectedPlanId === organization.plan_id}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isAssigningPlan ? 'Aplicando...' : 'Aplicar Plan'}
                  </button>
                </div>
                {selectedPlanId !== organization.plan_id && selectedPlanId && (
                  <p className="mt-2 text-xs text-amber-600 font-medium">⚠ El cambio de plan no genera cobro automático. El monto del próximo pago debe corresponder al precio del nuevo plan.</p>
                )}
              </div>
            </div>

            {/* Estado y registro de pago */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-500" />
                Estado Financiero
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                  <p className="text-sm text-slate-500 font-medium mb-1">Estado de Suscripción</p>
                  <p className={`text-xl font-bold ${
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
                </div>
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium mb-1">Precio del Plan Actual</p>
                    <p className="text-xl font-bold text-slate-900">${organization.plan_price ?? 0} USD / mes</p>
                  </div>
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    disabled={organization.subscription_status === 'canceled'}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-40"
                  >
                    Registrar Pago
                  </button>
                </div>
              </div>
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
                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Establecimiento</p>
                    <p className="font-bold text-slate-900">{sriConfig.establecimiento}</p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Pto. Emisión</p>
                    <p className="font-bold text-slate-900">{sriConfig.punto_emision}</p>
                  </div>
                </div>
                <div className={`mb-5 text-xs font-bold px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 ${
                  sriConfig.cert_uploaded_at ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {sriConfig.cert_uploaded_at ? '✓ Firma electrónica subida' : '⚠ Sin firma electrónica subida'}
                </div>

                <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
                <div className="flex items-center gap-3">
                  <select
                    value={sriEnvironment}
                    onChange={(e) => setSriEnvironment(e.target.value as 'pruebas' | 'produccion')}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pruebas">Pruebas (celcer.sri.gob.ec)</option>
                    <option value="produccion">Producción (cel.sri.gob.ec)</option>
                  </select>
                  <button
                    onClick={handleSaveSriEnvironment}
                    disabled={savingSriEnv || sriEnvironment === sriConfig.environment}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingInvite ? 'Enviando...' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Pago */}
      {isPaymentOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Registrar Pago</h3>
            <p className="text-sm text-slate-500 mb-6">
              El pago debe ser por el monto exacto del ciclo seleccionado.
            </p>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ciclo a pagar</label>
                <select
                  value={paymentCycle}
                  onChange={(e) => setPaymentCycle(e.target.value as 'monthly' | 'annual')}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="Ej: 30.00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Registrando...' : 'Confirmar Pago'}
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
    </div>
  );
}
