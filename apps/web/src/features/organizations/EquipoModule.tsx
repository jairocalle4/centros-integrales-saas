import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Users, UserPlus, CheckCircle, Loader2, Mail, X } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatDate';

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

const CHANGEABLE_ROLES = ['admin', 'professional', 'staff'] as const;

const INVITATION_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'Aceptada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expired: { label: 'Vencida', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelada', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const inviteSchema = z.object({
  email: z.string().email('Correo inválido'),
  role: z.enum(['admin', 'professional', 'staff']),
});
type InviteForm = z.infer<typeof inviteSchema>;

export function EquipoModule() {
  const { currentOrg, currentRole, maxMembers } = useOrg();
  const { session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'invitations'>('members');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canManageMembers = currentRole === 'owner' || currentRole === 'admin';
  const myUserId = session?.user.id;

  const {
    register: registerInvite,
    handleSubmit: handleInviteSubmit,
    formState: { errors: inviteErrors, isSubmitting: isInvitingSubmitting },
    reset: resetInvite,
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  });

  useEffect(() => {
    if (currentOrg) {
      loadMembers(currentOrg.id);
      loadInvitations(currentOrg.id);
    }
  }, [currentOrg]);

  const loadInvitations = async (orgId: string) => {
    setLoadingInvitations(true);
    const { data, error } = await (supabase as any)
      .from('invitations')
      .select('id, email, role, status, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvitations(data as Invitation[]);
    }
    setLoadingInvitations(false);
  };

  const handleCancelInvitation = async (invId: string) => {
    if (!currentOrg) return;
    setCancellingId(invId);
    const { error } = await (supabase as any)
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invId);
    setCancellingId(null);

    if (error) {
      toast.error('No se pudo cancelar la invitación: ' + error.message);
      return;
    }
    toast.success('Invitación cancelada.');
    loadInvitations(currentOrg.id);
  };

  const loadMembers = async (orgId: string) => {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        status,
        profiles (
          first_name,
          last_name
        )
      `)
      .eq('organization_id', orgId);

    if (!error && data) {
      setMembers(data as Member[]);
    }
    setLoadingMembers(false);
  };

  const onInvite = async (data: InviteForm) => {
    if (!currentOrg) return;

    const { error } = await supabase.functions.invoke('invite-user', {
      body: {
        organization_id: currentOrg.id,
        email: data.email,
        role: data.role,
      },
    });

    if (!error) {
      toast.success('Invitación enviada exitosamente.');
      setIsInviting(false);
      resetInvite();
      loadMembers(currentOrg.id);
      loadInvitations(currentOrg.id);
    } else {
      let errorMsg = error.message;
      if (error.context && typeof error.context === 'object') {
        try {
          const body = await (error.context as any).text();
          const parsed = JSON.parse(body);
          errorMsg = parsed.error || body;
        } catch (e) {}
      }
      toast.error('Error enviando invitación: ' + errorMsg);
    }
  };

  const onChangeRole = async (member: Member, newRole: string) => {
    if (!currentOrg || newRole === member.role) return;
    setSavingRoleFor(member.id);
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole as 'admin' | 'professional' | 'staff' })
      .eq('id', member.id);
    setSavingRoleFor(null);

    if (error) {
      toast.error('No se pudo cambiar el rol: ' + error.message);
      return;
    }
    toast.success('Rol actualizado.');
    loadMembers(currentOrg.id);
  };

  // Desactivar, nunca borrar — mismo criterio de dominio ya aplicado a
  // beneficiarios/is_active: se pierde el acceso al instante (todas las
  // políticas de RLS ya exigen status = 'active'), pero el historial de
  // quién hizo qué mientras fue miembro no desaparece. Reactivar hace lo
  // mismo al revés.
  const onToggleMemberActive = async (member: Member) => {
    if (!currentOrg) return;
    const activating = member.status !== 'active';
    setRemovingId(member.id);
    const { error } = await supabase
      .from('organization_members')
      .update({ status: activating ? 'active' : 'inactive' })
      .eq('id', member.id);
    setRemovingId(null);
    setConfirmRemoveId(null);

    if (error) {
      toast.error(`No se pudo ${activating ? 'reactivar' : 'desactivar'} al integrante: ` + error.message);
      return;
    }
    toast.success(activating ? 'Integrante reactivado.' : 'Integrante desactivado — ya no tiene acceso al centro.');
    loadMembers(currentOrg.id);
  };

  // Mismo conteo que create_invitation en la base: activos + invitaciones
  // pendientes cuentan contra el cupo del plan — así el número que se ve
  // aquí siempre coincide con lo que el servidor realmente va a permitir.
  const activeMembersCount = members.filter((m) => m.status === 'active').length;
  const pendingInvitationsCount = invitations.filter((i) => i.status === 'pending').length;
  const usedSeats = activeMembersCount + pendingInvitationsCount;
  const seatsLimitReached = maxMembers > 0 && usedSeats >= maxMembers;

  if (!currentOrg) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipo de Trabajo</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona los especialistas y colaboradores con acceso a {currentOrg.name}.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('members')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            activeSubTab === 'members'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Integrantes
        </button>
        <button
          onClick={() => setActiveSubTab('invitations')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'invitations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Invitaciones
          {invitations.some((i) => i.status === 'pending') && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {invitations.filter((i) => i.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Members Section */}
      {activeSubTab === 'members' && (
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Integrantes del Centro
            </h3>
            <p className={`text-xs mt-1 ${seatsLimitReached ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
              {maxMembers > 0
                ? seatsLimitReached
                  ? `Usaste los ${maxMembers} usuarios de tu plan — sube de plan para invitar más.`
                  : `${usedSeats} de ${maxMembers} usuarios de tu plan — puedes invitar ${maxMembers - usedSeats} más.`
                : `${usedSeats} usuario${usedSeats === 1 ? '' : 's'} — tu plan no tiene límite.`}
            </p>
          </div>
          {canManageMembers && (
            <button
              onClick={() => setIsInviting(!isInviting)}
              disabled={!isInviting && seatsLimitReached}
              title={!isInviting && seatsLimitReached ? 'Llegaste al límite de usuarios de tu plan' : undefined}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              <UserPlus className="w-4 h-4" />
              {isInviting ? 'Cancelar' : 'Invitar miembro'}
            </button>
          )}
        </div>

        {isInviting && (
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
            <form onSubmit={handleInviteSubmit(onInvite)} className="flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-grow w-full">
                <input
                  placeholder="Correo electrónico del invitad@"
                  {...registerInvite('email')}
                  className="block w-full rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3.5 py-2.5 border bg-white"
                />
                {inviteErrors.email && <p className="mt-1 text-xs text-red-600">{inviteErrors.email.message}</p>}
              </div>
              <div className="w-full sm:w-48">
                <select
                  {...registerInvite('role')}
                  className="block w-full rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3.5 py-2.5 border bg-white"
                >
                  <option value="admin">Administrador</option>
                  <option value="professional">Profesional</option>
                  <option value="staff">Staff / Auxiliar</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isInvitingSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isInvitingSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isInvitingSubmitting ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </form>
          </div>
        )}

        <div className="p-6">
          {loadingMembers ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-slate-500">No se encontraron integrantes en este centro.</div>
          ) : (
            <ul role="list" className="divide-y divide-slate-100">
              {members.map((member) => {
                const isSelf = member.user_id === myUserId;
                const isOwner = member.role === 'owner';
                const isActiveMember = member.status === 'active';
                // Only an owner may touch another owner's row; nobody edits their own row here.
                const canEditThisMember = canManageMembers && !isSelf && (!isOwner || currentRole === 'owner');
                // No tiene sentido reactivar si ya no cabe en el plan — mismo
                // conteo que el aviso de arriba y que create_invitation.
                const reactivateBlocked = !isActiveMember && seatsLimitReached;

                return (
                  <li key={member.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-x-6 py-4 ${!isActiveMember ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-x-3 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.profiles?.first_name || 'Usuario'} {member.profiles?.last_name || ''}
                          {isSelf && <span className="text-slate-400 font-normal"> (tú)</span>}
                        </p>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            member.role === 'owner'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : member.role === 'admin'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {member.role === 'owner' ? 'Dueño' : member.role}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                        isActiveMember
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 bg-slate-100 border-slate-200'
                      }`}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {isActiveMember ? 'Activo' : 'Inactivo'}
                      </span>

                      {canEditThisMember && (
                        <>
                          <select
                            value={member.role}
                            disabled={savingRoleFor === member.id}
                            onChange={(e) => onChangeRole(member, e.target.value)}
                            className="text-xs rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 py-1.5 pl-2 pr-7 border bg-white disabled:opacity-50"
                          >
                            {CHANGEABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>

                          {!isActiveMember ? (
                            <button
                              onClick={() => onToggleMemberActive(member)}
                              disabled={removingId === member.id || reactivateBlocked}
                              title={reactivateBlocked ? 'Llegaste al límite de usuarios de tu plan' : undefined}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {removingId === member.id ? 'Reactivando...' : 'Reactivar'}
                            </button>
                          ) : confirmRemoveId === member.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onToggleMemberActive(member)}
                                disabled={removingId === member.id}
                                className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                              >
                                {removingId === member.id ? 'Desactivando...' : 'Confirmar'}
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-2 py-1.5 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRemoveId(member.id)}
                              title="Le quita el acceso al centro sin borrar su historial — se puede reactivar después"
                              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Desactivar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      )}

      {/* Invitations Section */}
      {activeSubTab === 'invitations' && (
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-5 flex items-center gap-2 bg-slate-50/50">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Invitaciones de {currentOrg.name}</h3>
          </div>
          <div className="p-6">
            {loadingInvitations ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-6 text-slate-500">Todavía no se ha enviado ninguna invitación desde este centro.</div>
            ) : (
              <ul role="list" className="divide-y divide-slate-100">
                {invitations.map((inv) => {
                  const st = INVITATION_STATUS_LABEL[inv.status] || { label: inv.status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
                  return (
                    <li key={inv.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{inv.email}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Rol: <span className="capitalize">{inv.role}</span> · Enviada el {formatDate(inv.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.cls}`}>{st.label}</span>
                        {canManageMembers && inv.status === 'pending' && (
                          <button
                            onClick={() => handleCancelInvitation(inv.id)}
                            disabled={cancellingId === inv.id}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {cancellingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            Cancelar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
