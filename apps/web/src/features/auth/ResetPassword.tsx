import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router';
import { Building2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const isFirstTime = location.state?.isFirstTime || false;
  const orgNameFromState = location.state?.orgName || '';
  const orgIdFromState = location.state?.orgId || '';
  const userRole = location.state?.userRole || 'staff';
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
        // Upsert profile (creates row if it doesn't exist yet)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userData.user.id,
            first_name: data.firstName?.trim() || '',
            last_name: data.lastName?.trim() || '',
            updated_at: new Date().toISOString()
          });
          
        if (profileError) throw profileError;

        // Update organization name if owner changed it
        if (isOwner && data.orgName !== orgNameFromState && orgIdFromState) {
          const { error: orgError } = await supabase
            .from('organizations')
            .update({ name: data.orgName?.trim() })
            .eq('id', orgIdFromState);
            
          if (orgError) throw orgError;
        }
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
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          {isFirstTime ? 'Crea tu Contraseña' : 'Actualizar Contraseña'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isFirstTime 
            ? 'Para terminar de configurar tu cuenta en NexoKids, ingresa tus datos y establece una contraseña segura.' 
            : 'Ingresa tu nueva contraseña para acceder a NexoKids.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {isFirstTime && orgNameFromState && (
            <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-start gap-3">
              <Building2 className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900">Te estás uniendo al centro:</p>
                {isEditingOrg && isOwner ? (
                  <div className="mt-2">
                    <input
                      type="text"
                      {...register('orgName')}
                      className="block w-full rounded-md border border-indigo-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-indigo-800 font-bold">{orgNameFromState}</p>
                    {isOwner && (
                      <button 
                        type="button" 
                        onClick={() => setIsEditingOrg(true)}
                        className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors"
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

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            {isFirstTime && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <div className="mt-1">
                    <input
                      id="firstName"
                      type="text"
                      {...register('firstName')}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Apellido
                  </label>
                  <div className="mt-1">
                    <input
                      id="lastName"
                      type="text"
                      {...register('lastName')}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {isFirstTime ? 'Contraseña Segura' : 'Nueva Contraseña'}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
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
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 pr-10 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2.5 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Guardando...' : (isFirstTime ? 'Comenzar a usar NexoKids' : 'Actualizar contraseña')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
