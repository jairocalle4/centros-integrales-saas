import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { supabase } from '../../lib/supabase';

export function RequireAuth() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
          <p className="text-sm font-medium text-gray-500">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function RequireUnauth() {
  const { session, isLoading } = useAuth();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  useEffect(() => {
    if (session) {
      setCheckingAdmin(true);
      supabase.rpc('is_platform_admin').then(({ data }) => {
        if (data) {
          setTargetPath('/admin');
        } else {
          setTargetPath('/app');
        }
        setCheckingAdmin(false);
      });
    }
  }, [session]);

  if (isLoading || (session && (checkingAdmin || !targetPath))) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
          <p className="text-sm font-medium text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (session && targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  return <Outlet />;
}
