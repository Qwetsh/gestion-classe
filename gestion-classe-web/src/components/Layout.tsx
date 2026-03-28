import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FeedbackButton } from './FeedbackButton';
import { AnnouncementBanner } from './AnnouncementBanner';

const DEV_EMAIL = 'tomicharles@gmail.com';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Accueil', icon: '📊' },
  { path: '/analytics', label: 'Analyses', icon: '📈' },
  { path: '/classes', label: 'Classes', icon: '📚' },
  { path: '/students', label: 'Suivi élèves', icon: '👥' },
  { path: '/rewards', label: 'Récompenses', icon: '⭐' },
  { path: '/sessions', label: 'Séances', icon: '📅' },
  { path: '/group-sessions', label: 'Groupes', icon: '👥' },
  { path: '/tp-templates', label: 'Mes TP', icon: '📋' },
  { path: '/tools', label: 'Outils', icon: '🧰' },
];

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isDev = user?.email === DEV_EMAIL;
  const allNavItems = isDev ? [...navItems, { path: '/dev', label: 'Dev', icon: '🛠️' }] : navItems;

  // Fermer le menu si on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
              <nav className="hidden md:flex items-center gap-1 h-full">
                {allNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 h-full flex items-center gap-1.5 text-sm font-medium transition-all duration-200 border-b-2 ${
                        isActive
                          ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {user?.email?.charAt(0).toUpperCase()}
              </button>

              {/* Dropdown menu */}
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] py-2"
                  style={{ boxShadow: 'var(--shadow-lg)' }}
                >
                  <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-text)]">Connecté en tant que</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden border-t border-[var(--color-border)] px-4 py-2 flex gap-2 overflow-x-auto bg-[var(--color-surface-secondary)]">
          {allNavItems.map((item) => {
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

      <AnnouncementBanner />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <FeedbackButton />
    </div>
  );
}
