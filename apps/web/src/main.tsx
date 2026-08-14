import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './features/auth/AuthProvider';
import { RequireAuth, RequireUnauth } from './features/auth/RequireAuth';
import { Login } from './features/auth/Login';
import { RecoverPassword } from './features/auth/RecoverPassword';
import { ResetPassword } from './features/auth/ResetPassword';
import { UserLayout } from './layouts/UserLayout';
import { AppDashboard } from './features/organizations/AppDashboard';
import { AcceptInvitation } from './features/organizations/AcceptInvitation';
import { PlatformDashboard } from './features/platform/PlatformDashboard';
import { PlatformOrganizationDetail } from './features/platform/PlatformOrganizationDetail';
import { RequirePlatformAdmin } from './features/platform/RequirePlatformAdmin';
import { PlatformLayout } from './layouts/PlatformLayout';
import App from './App';

import { MatriculaWizard } from './features/organizations/MatriculaWizard';
import { BeneficiariosModule } from './features/organizations/BeneficiariosModule';
import { RepresentantesModule } from './features/organizations/RepresentantesModule';
import { AsistenciaModule } from './features/organizations/AsistenciaModule';
import { CobrosModule } from './features/organizations/CobrosModule';
import { EquipoModule } from './features/organizations/EquipoModule';
import { ConfiguracionModule } from './features/organizations/ConfiguracionModule';
import { BeneficiaryDetailPage } from './features/organizations/BeneficiaryDetailPage';
import { FinancialDashboard } from './features/organizations/FinancialDashboard';

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center h-48 text-slate-400 text-sm animate-pulse">
    Cargando módulo...
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            {/* Public routes */}
            <Route element={<RequireUnauth />}>
              <Route path="/login" element={<Login />} />
              <Route path="/recover-password" element={<RecoverPassword />} />
              <Route path="/" element={<App />} />
            </Route>

            {/* Requires Session (Handled internally by ResetPassword) */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route element={<RequireAuth />}>
              <Route path="/accept-invite" element={<AcceptInvitation />} />
              <Route path="/app" element={<UserLayout />}>
                <Route index element={<AppDashboard />} />
                <Route
                  path="matricula"
                  element={<MatriculaWizard />}
                />
                <Route
                  path="beneficiarios"
                  element={<BeneficiariosModule />}
                />
                <Route
                  path="beneficiarios/:id"
                  element={<BeneficiaryDetailPage />}
                />
                <Route
                  path="representantes"
                  element={<RepresentantesModule />}
                />
                <Route
                  path="asistencia"
                  element={<AsistenciaModule />}
                />
                <Route
                  path="cobros"
                  element={<CobrosModule />}
                />
                <Route
                  path="equipo"
                  element={<EquipoModule />}
                />
                <Route
                  path="configuracion"
                  element={<ConfiguracionModule />}
                />
                <Route
                  path="finanzas"
                  element={<FinancialDashboard />}
                />
              </Route>
            </Route>

            {/* Superadmin routes */}
            <Route element={<RequirePlatformAdmin />}>
              <Route element={<PlatformLayout />}>
                <Route path="/admin" element={<PlatformDashboard />} />
                <Route path="/admin/organizations/:id" element={<PlatformOrganizationDetail />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
