import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Users, UserPlus, CheckCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';

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

const CHANGEABLE_ROLES = ['admin', 'professional', 'staff'] as const;

const inviteSchema = z.object({
  email: z.string().email('Correo inválido'),
  role: z.enum(['admin', 'professional', 'staff']),
});
type InviteForm = z.infer<typeof inviteSchema>;

export function EquipoModule() {
  const { currentOrg, currentRole } = useOrg();
  const { session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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
    }
  }, [currentOrg]);

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

  const onRemoveMember = async (member: Member) => {
    if (!currentOrg) return;
    setRemovingId(member.id);
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', member.id);
    setRemovingId(null);
    setConfirmRemoveId(null);

    if (error) {
      toast.error('No se pudo quitar al integrante: ' + error.message);
      return;
    }
    toast.success('Integrante removido del centro.');
    loadMembers(currentOrg.id);
  };

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

      {/* Members Section */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Integrantes del Centro
          </h3>
          {canManageMembers && (
            <button
              onClick={() => setIsInviting(!isInviting)}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
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
                // Only an owner may touch another owner's row; nobody edits their own row here.
                const canEditThisMember = canManageMembers && !isSelf && (!isOwner || currentRole === 'owner');

                return (
                  <li key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-x-6 py-4">
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
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {member.status}
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

                          {confirmRemoveId === member.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onRemoveMember(member)}
                                disabled={removingId === member.id}
                                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer"
                              >
                                {removingId === member.id ? 'Quitando...' : 'Confirmar'}
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
                              className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Quitar
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
    </div>
  );
}
