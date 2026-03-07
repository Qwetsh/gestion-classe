import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-[var(--color-text-secondary)]">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check both user existence AND valid session
  // This prevents stale user objects from granting access when session has expired
  if (!user || !session) {
    return <Navigate to="/login" replace />;
  }

  // Additional check: verify session hasn't expired
  // Supabase tokens have an expires_at field
  if (session.expires_at) {
    const expiresAt = new Date(session.expires_at * 1000); // expires_at is in seconds
    if (expiresAt <= new Date()) {
      console.warn('[ProtectedRoute] Session expired, redirecting to login');
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
