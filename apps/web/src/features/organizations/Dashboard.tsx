import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ElectronicBillingSettings } from '../billing/ElectronicBillingSettings';

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

const createOrgSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
});
type CreateOrgForm = z.infer<typeof createOrgSchema>;

const inviteSchema = z.object({
  email: z.string().email('Correo inválido'),
  role: z.enum(['admin', 'professional', 'staff']),
});
type InviteForm = z.infer<typeof inviteSchema>;


export function Dashboard() {
  const { currentOrg, organizations, isLoading, refreshOrgs, hasElectronicBilling } = useOrg();
  // removed unused user from useAuth
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CreateOrgForm>({
    resolver: zodResolver(createOrgSchema)
  });

  const { 
    register: registerInvite, 
    handleSubmit: handleInviteSubmit, 
    formState: { errors: inviteErrors, isSubmitting: isInvitingSubmitting }, 
    reset: resetInvite 
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' }
  });

  useEffect(() => {
    if (currentOrg) {
      loadMembers(currentOrg.id);
    }
  }, [currentOrg]);

  const loadMembers = async (orgId: string) => {
    setLoadingMembers(true);
    // Note: We use a join with profiles to get the user names and emails.
    // The RLS policy for profiles should allow reading profiles of members in the same organization, 
    // or we might only have access to our own profile if not configured. For Sprint 1, we show what we can.
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        status,
        profiles (
          first_name,
          last_name,
          email
        )
      `)
      .eq('organization_id', orgId);

    if (!error && data) {
      // @ts-ignore - The types from supabase might need an override for joined tables in some versions
      setMembers(data as Member[]);
    }
    setLoadingMembers(false);
  };

  const onCreateOrg = async (data: CreateOrgForm) => {
    const { error } = await supabase.rpc('create_organization', { org_name: data.name });
    
    if (!error) {
      toast.success('Organización creada exitosamente.');
      setIsCreating(false);
      reset();
      await refreshOrgs();
    } else {
      toast.error('Error creando organización: ' + error.message);
    }
  };

  const onInvite = async (data: InviteForm) => {
    if (!currentOrg) return;
    
    // Invocamos la Edge Function para procesar la invitación de forma segura
    const { error } = await supabase.functions.invoke('invite-user', {
      body: {
        organization_id: currentOrg.id,
        email: data.email,
        role: data.role,
      }
    });
    
    if (!error) {
      toast.success('Invitación procesada exitosamente.');
      setIsInviting(false);
      resetInvite();
      // Opcionalmente recargar miembros si queremos ver los invitados pendientes, 
      // pero por ahora solo se listan miembros activos (status = active).
    } else {
      let errorMsg = error.message;
      if (error.context && typeof error.context === 'object') {
         // Si es un FunctionsHttpError, tratamos de sacar el body
         try {
           const body = await (error.context as any).text();
           const parsed = JSON.parse(body);
           errorMsg = parsed.error || body;
         } catch(e) {}
      }
      toast.error('Error enviando invitación: ' + errorMsg);
    }
  };

  if (isLoading) {
    return <div>Cargando dashboard...</div>;
  }

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-md mt-10">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sin Organización Asignada</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            No tienes acceso a ningún centro registrado actualmente. Para acceder, debes recibir una invitación del dueño o administrador de tu centro integral.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{currentOrg?.name}</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gestiona los miembros y configuraciones de esta organización.
          </p>
        </div>
      </div>

      {isCreating && (
        <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Crear nueva organización</h3>
          <form onSubmit={handleSubmit(onCreateOrg)} className="flex items-start space-x-4">
            <div className="flex-grow">
              <input 
                placeholder="Nombre de la organización"
                {...register('name')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" 
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              Crear
            </button>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        <div className="border-b border-gray-200 px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Integrantes</h3>
          <button 
            onClick={() => setIsInviting(!isInviting)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            {isInviting ? 'Cancelar' : 'Invitar miembro'}
          </button>
        </div>
        
        {isInviting && (
          <div className="px-4 py-5 sm:p-6 border-b border-gray-100 bg-gray-50">
            <form onSubmit={handleInviteSubmit(onInvite)} className="flex items-start space-x-4">
              <div className="flex-grow">
                <input 
                  placeholder="Correo electrónico"
                  {...registerInvite('email')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" 
                />
                {inviteErrors.email && <p className="mt-1 text-sm text-red-600">{inviteErrors.email.message}</p>}
              </div>
              <div>
                <select 
                  {...registerInvite('role')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white"
                >
                  <option value="admin">Administrador</option>
                  <option value="professional">Profesional</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={isInvitingSubmitting}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {isInvitingSubmitting ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>
        )}

        <div className="px-4 py-5 sm:p-6">
          {loadingMembers ? (
            <div className="text-center py-4 text-gray-500">Cargando integrantes...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No se encontraron integrantes.</div>
          ) : (
            <ul role="list" className="divide-y divide-gray-100">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-x-6 py-5">
                  <div className="min-w-0">
                    <div className="flex items-start gap-x-3">
                      <p className="text-sm font-semibold leading-6 text-gray-900">
                        {member.profiles?.first_name || 'Usuario'} {member.profiles?.last_name || ''}
                      </p>
                      <p className={`rounded-md whitespace-nowrap mt-0.5 px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        member.role === 'owner' ? 'bg-purple-50 text-purple-700 ring-purple-600/20' : 
                        member.role === 'admin' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 
                        'bg-green-50 text-green-700 ring-green-600/20'
                      }`}>
                        {member.role}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-x-2 text-xs leading-5 text-gray-500">
                      <p className="truncate">{member.profiles?.email || 'Sin correo público'}</p>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-x-4">
                    <span className="text-xs leading-5 text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      Estado: {member.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {currentOrg && (
        <div className="mt-8">
          <ElectronicBillingSettings orgId={currentOrg.id} hasElectronicBilling={hasElectronicBilling} />
        </div>
      )}
    </div>
  );
}
