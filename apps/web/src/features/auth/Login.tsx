import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router';

const loginSchema = z.object({
  email: z.string().email('Por favor ingresa un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function Login() {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      setError(authError.message === 'Invalid login credentials' 
        ? 'Correo o contraseña incorrectos.'
        : authError.message);
    } else {
      const { data: isAdmin } = await supabase.rpc('is_platform_admin');
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sección Izquierda: Marca y Mensaje Premium */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg shadow-lg flex items-center justify-center">
              <span className="text-xl font-bold tracking-tighter">NK</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">NexoKids</span>
          </div>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Gestión Inteligente para Centros de Desarrollo y Guarderías.
          </h1>
          <p className="text-slate-300 text-lg max-w-md leading-relaxed">
            NexoKids proporciona a tu equipo las herramientas necesarias para escalar, gestionar pagos y agilizar la comunicación con los representantes de manera centralizada.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          © {new Date().getFullYear()} NexoKids Inc. Plataforma Exclusiva B2B.
        </div>
      </div>

      {/* Sección Derecha: Formulario */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-12 lg:px-24 bg-white shadow-[0_0_40px_rgba(0,0,0,0.03)] z-10">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo solo en móvil */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg shadow flex items-center justify-center text-white">
              <span className="text-xl font-bold tracking-tighter">NK</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">NexoKids</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            Bienvenido
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Ingresa a tu espacio de trabajo para continuar.
          </p>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                {...register('email')}
                className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
                placeholder="tu@correo.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-3 pr-11 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
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
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <div className="text-sm">
                <Link to="/recover-password" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-indigo-400 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Ingresar al panel'}
            </button>
          </form>
          <div className="mt-10 text-center">
            <p className="text-xs text-gray-400">
              El acceso es restringido y gestionado de manera centralizada.<br/>
              Si no tienes una cuenta, contacta a la administración de tu centro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
