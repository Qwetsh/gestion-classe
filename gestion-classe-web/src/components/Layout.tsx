import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Tableau de bord', icon: '📊' },
  { path: '/classes', label: 'Classes', icon: '📚' },
  { path: '/students', label: 'Eleves', icon: '👥' },
  { path: '/rooms', label: 'Salles', icon: '🏫' },
  { path: '/sessions', label: 'Seances', icon: '📅' },
];

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-10" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              {/* Logo with gradient */}
              <Link to="/" className="flex items-center gap-3 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg transition-transform group-hover:scale-105"
                  style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
                >
                  GC
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-transparent hidden sm:block">
                  Gestion Classe
                </span>
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                        isActive
                          ? 'text-white'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                      }`}
                      style={isActive ? {
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-sm)'
                      } : undefined}
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[var(--color-surface-secondary)] rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
                  <span className="text-[var(--color-primary)] text-sm font-semibold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-[var(--color-text-secondary)] max-w-[150px] truncate">
                  {user?.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)] rounded-xl transition-colors"
              >
                Deconnexion
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden border-t border-[var(--color-border)] px-4 py-2 flex gap-2 overflow-x-auto bg-[var(--color-surface-secondary)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-surface)]'
                }`}
                style={isActive ? {
                  background: 'var(--gradient-primary)',
                  boxShadow: 'var(--shadow-xs)'
                } : undefined}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
