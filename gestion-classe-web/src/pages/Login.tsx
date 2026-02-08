import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { user, isLoading, error, signIn, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  if (user && !isLoading) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    clearError();
    await signIn(email, password);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, var(--color-background) 0%, #E8F4FD 100%)' }}>
      <div className="w-full max-w-md">
        {/* Card with shadow */}
        <div
          className="bg-[var(--color-surface)] p-8"
          style={{
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="w-20 h-20 mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold"
              style={{
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              GC
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              Gestion Classe
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Connectez-vous a votre compte
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)' }}
                placeholder="votre@email.com"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Password input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)' }}
                placeholder="••••••••"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                className="bg-[var(--color-error-soft)] text-[var(--color-error)] px-4 py-3 text-sm flex items-center gap-2"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* Submit button with gradient */}
            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full text-white py-3.5 px-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:opacity-90 hover:translate-y-[-1px] active:translate-y-0"
              style={{
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: isSubmitting ? 'none' : 'var(--shadow-glow)'
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Footer */}
          <div
            className="mt-6 pt-6 text-center"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Creez votre compte depuis l'application mobile
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-8 text-center text-xs text-[var(--color-text-tertiary)]">
          Gestion Classe v1.0
        </div>
      </div>
    </div>
  );
}
