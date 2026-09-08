import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  // null mientras se está consultando; una vez resuelto, false significa
  // que a esta persona todavía le falta terminar "Crea tu Contraseña"
  // (ver profiles.onboarding_completed) — RequireAuth usa esto para no
  // dejarla entrar a /app aunque ya tenga una sesión válida.
  onboardingCompleted: boolean | null;
  // Marca el onboarding como completo en el contexto al instante, sin
  // depender de un re-fetch. Necesario porque supabase.auth.updateUser()
  // dispara un evento USER_UPDATED que hace que este mismo Provider
  // vuelva a leer profiles.onboarding_completed desde la base — y ese
  // re-fetch puede ganarle en la carrera a la escritura que el propio
  // formulario de "Crea tu Contraseña" hace unas líneas después (un
  // UPDATE de tabla normal no dispara ningún evento de auth que lo
  // vuelva a corregir). Sin esto, el contexto se queda pegado en false
  // y RequireAuth rebota de vuelta al formulario aunque ya se guardó todo.
  markOnboardingComplete: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const applySession = async (newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setOnboardingCompleted(null);
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', newSession.user.id)
        .maybeSingle();
      // Ante cualquier duda (fila todavía no existe, error de red) se
      // asume completo — el candado nunca debe bloquear a alguien por
      // un problema de lectura ajeno a su propio onboarding real.
      setOnboardingCompleted(error || !data ? true : (data as any).onboarding_completed);
      setIsLoading(false);
    };

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error fetching session:', error.message);
      }
      applySession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const markOnboardingComplete = () => setOnboardingCompleted(true);

  return (
    <AuthContext.Provider value={{ session, user, isLoading, onboardingCompleted, markOnboardingComplete, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
