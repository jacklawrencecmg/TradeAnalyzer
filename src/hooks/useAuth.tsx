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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

    const timeout = setTimeout(() => finish(null), 2000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeout);
        finish(session);
      })
      .catch(() => {
        clearTimeout(timeout);
        finish(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'Session:', session ? 'exists' : 'null');

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle sign out event
      if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setSession(null);
        setUser(null);
        return;
      }

      // If a new user just signed up, ensure they have a subscription
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check if user has a subscription, if not create one
          const { data: existingSub } = await supabase
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!existingSub) {
            console.log('Creating trial subscription for new user');
            // Call the function to create subscription
            await supabase.rpc('create_trial_subscription', {
              p_user_id: session.user.id
            });
            console.log('Trial subscription created');
          }
        } catch (error) {
          console.error('Error ensuring subscription:', error);
          // Don't block the user if subscription creation fails
        }
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
