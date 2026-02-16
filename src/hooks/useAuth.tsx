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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

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
    await supabase.auth.signOut();
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
