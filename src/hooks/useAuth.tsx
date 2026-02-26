import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialSession(): { user: User | null; session: Session | null; loading: boolean } {
  try {
    const raw = localStorage.getItem('fdp-auth-token');
    if (raw) {
      const parsed = JSON.parse(raw);
      const sess = parsed?.access_token ? parsed : null;
      if (sess) {
        const exp = sess.expires_at ?? 0;
        if (exp > Date.now() / 1000) {
          return { user: sess.user ?? null, session: sess, loading: false };
        }
      }
    }
  } catch {
  }
  return { user: null, session: null, loading: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = getInitialSession();
  const [user, setUser] = useState<User | null>(initial.user);
  const [session, setSession] = useState<Session | null>(initial.session);
  const [loading, setLoading] = useState(initial.loading);

  useEffect(() => {
    let resolved = false;

    const finish = (sess: typeof session) => {
      if (!resolved) {
        resolved = true;
        setSession(sess);
        setUser(sess?.user ?? null);
        setLoading(false);
      }
    };

    const timeout = setTimeout(() => {
      if (!resolved && !initial.user) {
        finish(null);
      } else if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    }, 2000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeout);
        finish(session);
      })
      .catch(() => {
        clearTimeout(timeout);
        finish(initial.session);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        (async () => {
          try {
            const { data: existingSub } = await supabase
              .from('user_subscriptions')
              .select('id')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!existingSub) {
              await supabase.rpc('create_trial_subscription', {
                p_user_id: session.user.id
              });
            }
          } catch (error) {
            console.error('Error ensuring subscription:', error);
          }
        })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };
      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('Attempting signup for:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Signup error:', error);
        return { error: error.message };
      }

      console.log('Signup successful:', data);
      return {};
    } catch (error) {
      console.error('Unexpected signup error:', error);
      return {
        error: error instanceof Error
          ? error.message
          : 'An unexpected error occurred during signup'
      };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        throw error;
      }

      // Clear local state immediately
      setUser(null);
      setSession(null);

      // Clear auth-related storage
      localStorage.removeItem('fdp-auth-token');
      sessionStorage.clear();

      console.log('Sign out successful, redirecting...');

      // Small delay to ensure state updates, then redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error) {
      console.error('Error during sign out:', error);
      // Force clear auth data and redirect anyway
      setUser(null);
      setSession(null);
      localStorage.removeItem('fdp-auth-token');
      sessionStorage.clear();
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, loading }}>
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
