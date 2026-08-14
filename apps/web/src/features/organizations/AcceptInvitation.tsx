import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { session, isLoading: isAuthLoading } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Wait for auth to finish loading
    if (isAuthLoading) return;

    // If not authenticated after loading, redirect to login
    // Note: The user should have been authenticated by clicking the magic link / invite link,
    // which sets the session before this component mounts (or during).
    if (!session) {
      // Save the token to return here after login if needed, though Magic Links handle this.
      // If we are here and no session, something went wrong with the Magic Link or they need to login.
      navigate('/login', { replace: true, state: { from: `/accept-invite?token=${token}` } });
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMessage('Token de invitación no proporcionado.');
      return;
    }

    // Process the invitation
    const processInvitation = async () => {
      setStatus('loading');
      
      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      
      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
      } else {
        setStatus('success');
        
        // Fetch organization name and user role
        let orgName = '';
        let userRole = 'staff';
        
        // data from rpc is the orgId
        if (data) {
          try {
            const [{ data: org }, { data: member }] = await Promise.all([
              supabase.from('organizations').select('name').eq('id', data).single(),
              supabase.from('organization_members').select('role').eq('organization_id', data).eq('user_id', session.user.id).single()
            ]);
            if (org) orgName = (org as any).name;
            if (member) userRole = (member as any).role;
          } catch (e) {
            console.error('Error fetching org info:', e);
          }
        }

        // Wait a brief moment and redirect to app
        setTimeout(() => {
          navigate('/reset-password', { 
            replace: true, 
            state: { 
              isFirstTime: true,
              orgId: data,
              orgName,
              userRole
            } 
          });
        }, 2000);
      }
    };

    processInvitation();
  }, [isAuthLoading, session, token, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Invitación a NexoKids</h2>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 mb-4"></div>
            <p className="text-gray-600">Procesando tu invitación, por favor espera...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 text-green-500 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-700 font-medium mb-2">¡Invitación aceptada con éxito!</p>
            <p className="text-gray-500 text-sm">Redirigiendo a tu espacio de trabajo...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 text-red-500 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-700 font-medium mb-4">Error procesando la invitación</p>
            <p className="text-gray-600 text-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/app')}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Ir al Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
