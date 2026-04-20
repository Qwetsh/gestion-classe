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
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <p className="text-[var(--text-muted)]">Chargement...</p>
        </div>
      </div>
    );
  }

  // Check both user existence AND valid session
  if (!user || !session) {
    return <Navigate to="/login" replace />;
  }

  // Verify session hasn't expired
  if (session.expires_at) {
    const expiresAt = new Date(session.expires_at * 1000);
    if (expiresAt <= new Date()) {
      console.warn('[ProtectedRoute] Session expired, redirecting to login');
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
