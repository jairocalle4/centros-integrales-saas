import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router';
import { Building2, Pencil, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';

const resetSchema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
    .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
    .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo o carácter especial'),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  orgName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPassword() {
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { markOnboardingComplete } = useAuth();
  const isFirstTime = location.state?.isFirstTime || false;
  // Cuando llega desde la navegación original de AcceptInvitation.tsx,
  // location.state ya trae esto. Cuando llega en cambio porque
  // RequireAuth.tsx lo mandó de vuelta aquí (botón atrás, URL directa,
  // refresh — sin ese state), se resuelve solo desde la base más abajo.
  const [orgNameFromState, setOrgNameFromState] = useState(location.state?.orgName || '');
  const [orgIdFromState, setOrgIdFromState] = useState(location.state?.orgId || '');
  const [userRole, setUserRole] = useState(location.state?.userRole || 'staff');
  const isOwner = userRole === 'owner';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      orgName: orgNameFromState
    }
  });

  useEffect(() => {
    // Check if we actually have a session (the user came from a reset link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If no session, they shouldn't be on this page
        navigate('/login', { replace: true });
      } else {
        setSessionChecked(true);
      }
    });
  }, [navigate]);

  useEffect(() => {
    // Si isFirstTime llegó sin los datos del centro (porque RequireAuth
    // mandó de vuelta aquí sin el location.state original de
    // AcceptInvitation), resolverlo directo — accept_invitation ya creó
    // la membresía real, así que ya existe de dónde leerlo.
    if (!isFirstTime || orgIdFromState) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role, organization_id, organizations ( name )')
        .eq('user_id', user.id)
        .maybeSingle();
      if (membership) {
        setOrgIdFromState((membership as any).organization_id || '');
        setOrgNameFromState((membership as any).organizations?.name || '');
        setUserRole((membership as any).role || 'staff');
      }
    })();
  }, [isFirstTime, orgIdFromState]);

  useEffect(() => {
    if (orgNameFromState) {
      setValue('orgName', orgNameFromState);
    }
  }, [orgNameFromState, setValue]);

  const onSubmit = async (data: ResetForm) => {
    setError(null);

    if (isFirstTime) {
      if (!data.firstName?.trim()) {
        setError('Por favor, ingresa tu nombre.');
        return;
      }
      if (!data.lastName?.trim()) {
        setError('Por favor, ingresa tu apellido.');
        return;
      }
      if (isOwner && !data.orgName?.trim()) {
        setError('El nombre del centro no puede estar vacío.');
        return;
      }
    }

    try {
      const { data: userData, error: authError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (authError) throw authError;

      if (isFirstTime && userData.user) {
        // Upsert profile (creates row if it doesn't exist yet). Marca
        // onboarding_completed = true — esto es lo que apaga el candado
        // de RequireAuth.tsx para esta persona de aquí en adelante.
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userData.user.id,
            first_name: data.firstName?.trim() || '',
            last_name: data.lastName?.trim() || '',
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          });

        if (profileError) throw profileError;
        // Corrige el candado en el contexto al instante — no esperar al
        // re-fetch disparado por USER_UPDATED, que puede llegar antes que
        // este mismo upsert y quedarse con el valor viejo (ver comentario
        // en AuthProvider.tsx).
        markOnboardingComplete();

        // Update organization name if owner changed it
        if (isOwner && data.orgName !== orgNameFromState && orgIdFromState) {
          const { error: orgError } = await supabase
            .from('organizations')
            .update({ name: data.orgName?.trim() })
            .eq('id', orgIdFromState);

          if (orgError) throw orgError;
        }
      } else if (userData.user) {
        // Recuperación normal (no isFirstTime): igual cuenta como
        // "puso su propia contraseña" — por si alguien llega aquí sin
        // haber completado nunca el flujo de primera vez.
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq('id', userData.user.id);
        markOnboardingComplete();
      }

      toast.success(isFirstTime ? 'Cuenta configurada con éxito' : 'Contraseña actualizada');

      const { data: isAdmin } = await supabase.rpc('is_platform_admin');
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al guardar los datos.');
    }
  };

  if (!sessionChecked) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white">
            <span className="text-base font-bold tracking-tighter">NK</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">NexoKids</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 p-7 sm:p-9">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {isFirstTime ? 'Crea tu Contraseña' : 'Actualizar Contraseña'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {isFirstTime
                ? 'Para terminar de configurar tu cuenta en NexoKids, ingresa tus datos y establece una contraseña segura.'
                : 'Ingresa tu nueva contraseña para acceder a NexoKids.'}
            </p>
          </div>

          {isFirstTime && orgNameFromState && (
            <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">Te estás uniendo a</p>
                {isEditingOrg && isOwner ? (
                  <input
                    type="text"
                    {...register('orgName')}
                    className="mt-1 block w-full rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nombre de la empresa"
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-bold text-indigo-900 truncate">{orgNameFromState}</p>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setIsEditingOrg(true)}
                        className="p-1 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors shrink-0 cursor-pointer"
                        title="Modificar nombre de empresa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3.5">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {isFirstTime && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    {...register('firstName')}
                    className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Apellido
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    {...register('lastName')}
                    className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {isFirstTime ? 'Contraseña Segura' : 'Nueva Contraseña'}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-400 transition-colors cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Guardando...' : (isFirstTime ? 'Comenzar a usar NexoKids' : 'Actualizar contraseña')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
