import { useAuth } from '../auth/AuthProvider';

export function SuspendedTenant() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Acceso Suspendido</h1>
        
        <p className="text-slate-600 mb-8 leading-relaxed">
          El acceso operativo a este centro de desarrollo se encuentra temporalmente suspendido debido a un pago pendiente o cancelación de la suscripción. Tus datos están a salvo y se conservan intactos.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-500 mb-8">
          Por favor, contacta al administrador principal del centro o al soporte de NexoKids para reactivar el servicio.
        </div>

        <button 
          onClick={() => signOut()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-sm w-full"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
