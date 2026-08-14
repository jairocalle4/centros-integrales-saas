import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';

export function RequirePlatformAdmin() {
  const { session, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!session) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      
      const { data, error } = await supabase.rpc('is_platform_admin');
      
      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
      
      setChecking(false);
    }

    if (!isLoading) {
      checkAdmin();
    }
  }, [session, isLoading]);

  if (isLoading || checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500"></div>
          <p className="text-sm font-medium text-slate-400">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
