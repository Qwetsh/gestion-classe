import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Mode = 'login' | 'signup' | 'reset';

export function Login() {
  const { user, isLoading, error, signIn, signUp, resetPassword, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already logged in
  if (user && !isLoading) {
    return <Navigate to="/" replace />;
  }

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setSuccessMessage(null);
    setConfirmPassword('');
    clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (mode !== 'reset' && !password) return;

    if (mode === 'signup') {
      if (password !== confirmPassword) return;
      if (password.length < 6) return;
    }

    setIsSubmitting(true);
    clearError();

    if (mode === 'signup') {
      const success = await signUp(email, password);
      if (success) {
        setSuccessMessage('signup');
      }
    } else if (mode === 'reset') {
      const success = await resetPassword(email);
      if (success) {
        setSuccessMessage('reset');
      }
    } else {
      await signIn(email, password);
    }

    setIsSubmitting(false);
  };

  const passwordMismatch = mode === 'signup' && confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = mode === 'signup' && password.length > 0 && password.length < 6;

  const titles: Record<Mode, string> = {
    login: 'Connectez-vous à votre compte',
    signup: 'Créer un compte',
    reset: 'Réinitialiser le mot de passe',
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, var(--color-background) 0%, #E8F4FD 100%)' }}>
      <div className="w-full max-w-md">
        {/* Card */}
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
              {titles[mode]}
            </p>
          </div>

          {/* Success messages */}
          {successMessage === 'signup' && (
            <div className="text-center space-y-4">
              <div
                className="px-4 py-5 text-sm"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  background: '#E8F5E9',
                  color: '#2E7D32',
                }}
              >
                <div className="text-3xl mb-3">✉️</div>
                <p className="font-semibold text-base mb-2">Compte créé !</p>
                <p className="mb-2">
                  Un email de confirmation a été envoyé à <strong>{email}</strong>.
                </p>
                <p>
                  Cliquez sur le lien dans cet email pour activer votre compte, puis revenez ici pour vous connecter.
                </p>
                <p className="mt-3 text-xs opacity-75">
                  Pensez à vérifier vos spams si vous ne le trouvez pas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[var(--color-primary)] font-semibold hover:underline"
              >
                Retour à la connexion
              </button>
            </div>
          )}

          {successMessage === 'reset' && (
            <div className="text-center space-y-4">
              <div
                className="px-4 py-5 text-sm"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  background: '#E3F2FD',
                  color: '#1565C0',
                }}
              >
                <div className="text-3xl mb-3">📧</div>
                <p className="font-semibold text-base mb-2">Email envoyé !</p>
                <p className="mb-2">
                  Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien pour réinitialiser votre mot de passe.
                </p>
                <p className="mt-3 text-xs opacity-75">
                  Pensez à vérifier vos spams si vous ne le trouvez pas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[var(--color-primary)] font-semibold hover:underline"
              >
                Retour à la connexion
              </button>
            </div>
          )}

          {/* Form */}
          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
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

              {/* Password (not for reset mode) */}
              {mode !== 'reset' && (
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
                    minLength={mode === 'signup' ? 6 : undefined}
                    disabled={isSubmitting}
                  />
                  {passwordTooShort && (
                    <p className="text-xs text-[var(--color-error)] mt-1">
                      6 caractères minimum
                    </p>
                  )}
                  {/* Forgot password link (login mode only) */}
                  {mode === 'login' && (
                    <div className="text-right mt-1">
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:underline"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm password (signup only) */}
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
                  >
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-0 focus:outline-none focus:ring-2 transition-all ${
                      passwordMismatch
                        ? 'focus:ring-[var(--color-error)] ring-2 ring-[var(--color-error)]'
                        : 'focus:ring-[var(--color-primary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)' }}
                    placeholder="••••••••"
                    required
                    disabled={isSubmitting}
                  />
                  {passwordMismatch && (
                    <p className="text-xs text-[var(--color-error)] mt-1">
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                </div>
              )}

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

              {/* Submit button */}
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !email ||
                  (mode !== 'reset' && !password) ||
                  (mode === 'signup' && (passwordMismatch || passwordTooShort || !confirmPassword))
                }
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
                    {mode === 'signup' ? 'Création...' : mode === 'reset' ? 'Envoi...' : 'Connexion...'}
                  </span>
                ) : (
                  mode === 'signup' ? 'Créer mon compte' : mode === 'reset' ? 'Envoyer le lien' : 'Se connecter'
                )}
              </button>
            </form>
          )}

          {/* Footer links */}
          {!successMessage && (
            <div
              className="mt-6 pt-6 text-center space-y-2"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              {mode === 'login' && (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-[var(--color-primary)] font-semibold hover:underline"
                  >
                    Créer un compte
                  </button>
                </p>
              )}
              {mode === 'signup' && (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Déjà un compte ?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[var(--color-primary)] font-semibold hover:underline"
                  >
                    Se connecter
                  </button>
                </p>
              )}
              {mode === 'reset' && (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-[var(--color-primary)] font-semibold hover:underline"
                  >
                    Retour à la connexion
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="mt-8 text-center text-xs text-[var(--color-text-tertiary)]">
          Gestion Classe v1.0
        </div>
      </div>
    </div>
  );
}
