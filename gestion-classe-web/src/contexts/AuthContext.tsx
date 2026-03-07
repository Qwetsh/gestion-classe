import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Token refresh interval (55 minutes - tokens expire at 60 min by default)
const TOKEN_REFRESH_INTERVAL = 55 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });

  // Track if initial session has been loaded to prevent race condition
  const initialLoadComplete = useRef(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Setup auth state change listener FIRST to catch any changes during initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session) => {
        if (!isMounted) return;

        // Only process events after initial load, OR if it's a sign out/sign in event
        // This prevents race condition where listener fires before getSession completes
        if (initialLoadComplete.current || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setState({
            user: session?.user ?? null,
            session,
            isLoading: false,
            error: null,
          });
        }

        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed successfully');
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      initialLoadComplete.current = true;

      if (error) {
        console.error('[Auth] Initial session error:', error);
        setState(prev => ({ ...prev, error: error.message, isLoading: false }));
      } else {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          error: null,
        });

        // Setup automatic token refresh if we have a session
        if (session) {
          setupTokenRefresh();
        }
      }
    });

    // Proactive token refresh to prevent expiry
    function setupTokenRefresh() {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      refreshIntervalRef.current = setInterval(async () => {
        if (!isMounted) return;

        try {
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('[Auth] Token refresh failed:', error);
            // Don't set error state - just log. User will be logged out on next API call.
          }
        } catch (err) {
          console.error('[Auth] Token refresh error:', err);
        }
      }, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, error: error.message, isLoading: false }));
      return false;
    }

    setState({
      user: data.user,
      session: data.session,
      isLoading: false,
      error: null,
    });
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
