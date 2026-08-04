import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

import { AuthProvider } from './features/auth/AuthProvider';
import { RequireAuth, RequireUnauth } from './features/auth/RequireAuth';
import { Login } from './features/auth/Login';
import { RecoverPassword } from './features/auth/RecoverPassword';
import { ResetPassword } from './features/auth/ResetPassword';
import { UserLayout } from './layouts/UserLayout';
import { Dashboard } from './features/organizations/Dashboard';
import { AcceptInvitation } from './features/organizations/AcceptInvitation';
import App from './App';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route element={<RequireUnauth />}>
              <Route path="/login" element={<Login />} />
              <Route path="/recover-password" element={<RecoverPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<App />} />
            </Route>

            {/* Protected routes */}
            <Route element={<RequireAuth />}>
              <Route path="/accept-invite" element={<AcceptInvitation />} />
              <Route path="/app" element={<UserLayout />}>
                <Route index element={<Dashboard />} />
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
