import { Navigate, Outlet } from 'react-router';
import { useOrg } from './OrgContext';

// Mismo patrón que RequirePlatformAdmin.tsx, pero para el rol de
// organización (no el de plataforma): Configuración, Facturas, Reportes
// y Gastos son solo para Dueño/Administrador. Ocultar el link del menú
// (UserLayout.tsx) no alcanza por sí solo — sin este guard, cualquier
// rol podía entrar igual escribiendo la URL a mano, que es exactamente
// lo que se confirmó que pasaba antes de este cambio.
export function RequireOwnerOrAdmin() {
  const { currentRole, isLoading } = useOrg();

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (currentRole !== 'owner' && currentRole !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
