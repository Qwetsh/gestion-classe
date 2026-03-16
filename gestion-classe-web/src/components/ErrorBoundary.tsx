import { Component, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree.
 * Prevents the entire app from crashing on unhandled errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // Log error to Supabase for dev panel
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      supabase.from('error_logs').insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        error_message: error.message,
        error_stack: (error.stack || '').slice(0, 2000),
        page_url: window.location.href,
      }).then(({ error: logErr }) => {
        if (logErr) console.error('[ErrorBoundary] Failed to log error:', logErr);
      });
    });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback UI provided
      if (fallback) {
        return fallback;
      }

      const isDev = import.meta.env.DEV;

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6">&#9888;&#65039;</div>
            <h1 className="text-2xl font-semibold text-[var(--color-text)] mb-2">
              Oups, une erreur s'est produite
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-6">
              L'application a rencontre un probleme inattendu.
            </p>

            {isDev && error && (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 mb-6 text-left overflow-auto max-h-48">
                <p className="text-sm font-semibold text-red-500 mb-2">Erreur:</p>
                <p className="text-xs font-mono text-[var(--color-text)] mb-3">
                  {error.message}
                </p>
                {errorInfo?.componentStack && (
                  <>
                    <p className="text-sm font-semibold text-red-500 mb-2">Stack:</p>
                    <pre className="text-xs font-mono text-[var(--color-text-tertiary)] whitespace-pre-wrap">
                      {errorInfo.componentStack.slice(0, 500)}
                    </pre>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Reessayer
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-surface)] transition-colors font-medium"
              >
                Recharger la page
              </button>
            </div>

            <p className="text-sm text-[var(--color-text-tertiary)] mt-6">
              Si le probleme persiste, essayez de vider le cache de votre navigateur.
            </p>
          </div>
        </div>
      );
    }

    return children;
  }
}
