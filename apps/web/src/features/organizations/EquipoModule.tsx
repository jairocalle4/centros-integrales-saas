import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Users, UserPlus, CheckCircle } from 'lucide-react';

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

const inviteSchema = z.object({
  email: z.string().email('Correo inválido'),
  role: z.enum(['admin', 'professional', 'staff']),
});
type InviteForm = z.infer<typeof inviteSchema>;

export function EquipoModule() {
  const { currentOrg } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

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
          <button
            onClick={() => setIsInviting(!isInviting)}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            {isInviting ? 'Cancelar' : 'Invitar miembro'}
          </button>
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
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {isInvitingSubmitting ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </form>
          </div>
        )}

        <div className="p-6">
          {loadingMembers ? (
            <div className="text-center py-6 text-slate-400 animate-pulse">Cargando integrantes...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-slate-500">No se encontraron integrantes en este centro.</div>
          ) : (
            <ul role="list" className="divide-y divide-slate-100">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-x-6 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-x-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {member.profiles?.first_name || 'Usuario'} {member.profiles?.last_name || ''}
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
                  <div className="flex items-center gap-x-3">
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {member.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
