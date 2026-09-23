import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import SettingsModal from './SettingsModal';
import { FeedbackButton } from './FeedbackButton';
import { AnnouncementBanner } from './AnnouncementBanner';
import { supabase } from '../lib/supabase';

const DEV_EMAIL = 'tomicharles@gmail.com';

interface LayoutProps {
  children: ReactNode;
  /** Set true for pages that handle their own max-width (e.g. Classes with sidebar) */
  fluid?: boolean;
  /** Set true for full-bleed pages with no max-width and no padding (e.g. Academy) */
  fullBleed?: boolean;
}

const primaryNavItems = [
  { path: '/', label: 'Accueil', icon: 'home' },
  { path: '/classes', label: 'Classes', icon: 'classes' },
  { path: '/students', label: 'Suivi élèves', icon: 'students' },
  { path: '/sessions', label: 'Séances', icon: 'sessions' },
  { path: '/analytics', label: 'Analyses', icon: 'analytics' },
];

/** Vie de classe — le quotidien avec les élèves */
const classLifeItems = [
  { path: '/rewards', label: 'Récompenses', icon: 'star' },
  { path: '/group-sessions', label: 'Groupes', icon: 'group' },
  { path: '/evaluations', label: 'Évaluations', icon: 'evaluations' },
  { path: '/academy', label: 'Académie', icon: 'academy' },
];

/** Ressources — ce que le prof prépare ou consulte */
const resourceItems = [
  { path: '/tp-templates', label: 'Mes TP', icon: 'flask' },
  { path: '/brevets', label: 'Annales', icon: 'book' },
  { path: '/clouds', label: 'Mes clouds', icon: 'cloud' },
  { path: '/tools', label: 'Outils', icon: 'wrench' },
  { path: '/pronote', label: 'Pronote', icon: 'link' },
];

/* ---- SVG icon component (from design handoff) ---- */
function NavIcon({ name, size = 15 }: { name: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>;
    case 'classes': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></svg>;
    case 'students': return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15 15c3-.5 6 1.5 7 5"/></svg>;
    case 'sessions': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'analytics': return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-6M22 19H2"/></svg>;
    case 'star': return <svg {...common}><path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5z"/></svg>;
    case 'group': return <svg {...common}><circle cx="8" cy="9" r="2.8"/><circle cx="16.5" cy="9" r="2.3"/><path d="M3 19c.4-3 2.6-5 5-5s4.6 2 5 5M14.5 16c.6-1.3 1.9-2 3-2 1.8 0 3.2 1.4 3.5 3"/></svg>;
    case 'evaluations': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8.5 12l2.2 2.2 4.5-4.5"/></svg>;
    case 'academy': return <svg {...common}><path d="M4 21V9l4-2.5V4l4 2 4-2v2.5L20 9v12"/><path d="M4 21h16M10 21v-5h4v5"/></svg>;
    case 'flask': return <svg {...common}><path d="M9.5 3v6L4.8 17.4A2 2 0 006.55 20.5h10.9a2 2 0 001.75-3.1L14.5 9V3"/><path d="M8.5 3h7M7.2 14.5h9.6"/></svg>;
    case 'book': return <svg {...common}><path d="M4 4.5A1.5 1.5 0 015.5 3H19v16H5.5A1.5 1.5 0 004 20.5V4.5z"/><path d="M4 17.5h15"/></svg>;
    case 'cloud': return <svg {...common}><path d="M7 18h10.5a3.5 3.5 0 000-7 5 5 0 00-9.7-1.3A3.85 3.85 0 007 18z"/></svg>;
    case 'wrench': return <svg {...common}><path d="M15.5 3.5a5 5 0 00-6.1 6.4l-6 6a2 2 0 102.8 2.8l6-6a5 5 0 006.4-6.1l-3 3-2.8-.3-.3-2.8 3-3z"/></svg>;
    case 'link': return <svg {...common}><path d="M10 13.5a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.4 1.4"/><path d="M14 10.5a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.4-1.4"/></svg>;
    case 'dev': return <svg {...common}><path d="M8.5 16.5L4 12l4.5-4.5M15.5 7.5L20 12l-4.5 4.5M13.5 4.5l-3 15"/></svg>;
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 0112 0v5l2 3H4l2-3V8z"/><path d="M10 20a2 2 0 004 0"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'info': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;
    default: return null;
  }
}

/* ---- Notifications (données partagées entre sidebar et topbar) ---- */

interface NotifData {
  announcements: { id: string; message: string; type: string; created_at: string }[];
  feedbacks: { id: string; user_email: string; type: string; message: string; created_at: string }[];
  isDev: boolean;
  lastRead: string;
  unreadCount: number;
  markRead: () => void;
}

function useNotifications(userId: string | undefined, email: string | undefined): NotifData {
  const [announcements, setAnnouncements] = useState<NotifData['announcements']>([]);
  const [feedbacks, setFeedbacks] = useState<NotifData['feedbacks']>([]);
  const [lastRead, setLastRead] = useState<string>(() => localStorage.getItem('gc_notifications_last_read') || '');
  const isDev = email === DEV_EMAIL;

  useEffect(() => {
    if (!userId) return;

    supabase
      .from('announcements')
      .select('id, message, type, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setAnnouncements(data); });

    if (email === DEV_EMAIL) {
      supabase
        .from('feedbacks')
        .select('id, user_email, type, message, created_at')
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (data) setFeedbacks(data); });
    }
  }, [userId, email]);

  const allNotifs = [
    ...announcements.map(a => a.created_at),
    ...(isDev ? feedbacks.map(f => f.created_at) : []),
  ];
  const unreadCount = lastRead ? allNotifs.filter(d => d > lastRead).length : allNotifs.length;

  const markRead = () => {
    const now = new Date().toISOString();
    setLastRead(now);
    localStorage.setItem('gc_notifications_last_read', now);
  };

  return { announcements, feedbacks, isDev, lastRead, unreadCount, markRead };
}

/* ---- Panneau de notifications (contenu du dropdown) ---- */

function NotifPanel({ data, placement }: { data: NotifData; placement: 'up' | 'down' }) {
  const { announcements, feedbacks, isDev, lastRead, unreadCount } = data;
  return (
    <div style={{
      position: 'absolute',
      ...(placement === 'up' ? { bottom: '100%', left: 0, marginBottom: 8 } : { top: '100%', right: 0, marginTop: 8 }),
      width: 340, maxHeight: 480, overflowY: 'auto',
      background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 12,
      padding: 0, boxShadow: 'var(--shadow-2)', zIndex: 90,
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Notifications</span>
        {unreadCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}</span>
        )}
      </div>

      {announcements.length === 0 && feedbacks.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          Aucune notification
        </div>
      ) : (
        <div>
          {announcements.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                Annonces
              </div>
              {announcements.map(a => {
                const isNew = !lastRead || a.created_at > lastRead;
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: isNew ? 'var(--indigo-soft)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, marginTop: 1 }}>
                        {a.type === 'info' ? 'ℹ️' : a.type === 'warning' ? '⚠️' : '✅'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{a.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                          {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {isNew && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0, marginTop: 5 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {isDev && feedbacks.length > 0 && (
            <>
              <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-dim)', borderTop: announcements.length > 0 ? '2px solid var(--border)' : 'none' }}>
                Retours utilisateurs
              </div>
              {feedbacks.map(f => {
                const isNew = !lastRead || f.created_at > lastRead;
                const typeIcon = f.type === 'bug' ? '🐛' : f.type === 'suggestion' ? '💡' : '💬';
                return (
                  <div
                    key={f.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: isNew ? 'var(--indigo-soft)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, marginTop: 1 }}>{typeIcon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{f.user_email}</div>
                        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{f.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                          {new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {isNew && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0, marginTop: 5 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Rangée de comptes : notifications, réglages, avatar ---- */

function AccountRow({
  notifs,
  email,
  onSignOut,
  onOpenSettings,
  placement,
}: {
  notifs: NotifData;
  email: string | undefined;
  onSignOut: () => void;
  onOpenSettings: () => void;
  placement: 'up' | 'down';
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotif = () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen) notifs.markRead();
  };

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, display: 'grid', placeItems: 'center',
    borderRadius: 8, color: 'var(--text-muted)', border: 'none', background: 'none',
    cursor: 'pointer', position: 'relative',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative' }} ref={notifRef}>
        <button onClick={handleOpenNotif} style={iconBtn} title="Notifications">
          <NavIcon name="bell" size={16} />
          {notifs.unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: 'var(--neg)', color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'grid', placeItems: 'center', lineHeight: 1,
            }}>
              {notifs.unreadCount > 9 ? '9+' : notifs.unreadCount}
            </span>
          )}
        </button>
        {isNotifOpen && <NotifPanel data={notifs} placement={placement} />}
      </div>

      <button onClick={onOpenSettings} style={{ ...iconBtn, position: 'static' }} title="Réglages">
        <NavIcon name="settings" size={16} />
      </button>

      <div style={{ position: 'relative' }} ref={userMenuRef}>
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff', display: 'grid', placeItems: 'center',
            fontWeight: 600, fontSize: 12.5, border: 'none', cursor: 'pointer',
          }}
          title={email}
        >
          {email?.charAt(0).toUpperCase()}
        </button>
        {isUserMenuOpen && (
          <div style={{
            position: 'absolute',
            ...(placement === 'up' ? { bottom: '100%', right: 0, marginBottom: 8 } : { top: '100%', right: 0, marginTop: 8 }),
            width: 240, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 12,
            padding: 4, boxShadow: 'var(--shadow-2)', zIndex: 90,
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Connecté en tant que</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
            </div>
            <button
              onClick={() => { setIsUserMenuOpen(false); onSignOut(); }}
              style={{
                width: '100%', padding: '8px 14px', textAlign: 'left',
                fontSize: 12.5, fontWeight: 500, color: 'var(--neg)',
                background: 'none', border: 'none', borderRadius: 7,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--neg-soft)'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'none'}
            >
              🚪 Déconnexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Marque (logo + année scolaire) ---- */

function Brand({ trimestre, year }: { trimestre: number | string; year: string }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
        <defs>
          <linearGradient id="gc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366F1" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#gc-grad)" />
        <text x="16" y="21" textAnchor="middle" fontFamily="var(--font-display)" fontSize="13" fontWeight="700" fill="#fff">GC</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.01em', color: 'var(--text)' }}>
          Gestion Classe
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          T{trimestre} · {year}
        </span>
      </div>
    </Link>
  );
}

export function Layout({ children, fluid, fullBleed }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { settings, isTabVisible } = useSettings();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const notifs = useNotifications(user?.id, user?.email);
  const isDev = user?.email === DEV_EMAIL;

  const visibleClassLife = classLifeItems.filter(item => isTabVisible(item.path.slice(1)));
  const visibleResources = resourceItems.filter(item => isTabVisible(item.path.slice(1)));
  const devItems = isDev ? [{ path: '/dev', label: 'Dev', icon: 'dev' }] : [];
  const allNavItems = [...primaryNavItems, ...visibleClassLife, ...visibleResources, ...devItems];

  // État Pronote (encart bas de sidebar) — même clé que le Dashboard
  const pronoteConnected = typeof window !== 'undefined' && !!localStorage.getItem('pronote_session');

  const renderNavLink = (item: { path: string; label: string; icon: string }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`gc-sidenav__item ${isActive ? 'gc-sidenav__item--active' : ''}`}
      >
        <NavIcon name={item.icon} size={16} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="gc-shell" style={{ background: fullBleed ? 'transparent' : 'var(--bg)' }}>
      {/* ---- Barre latérale (desktop) ---- */}
      <aside className="gc-sidebar">
        <div className="gc-sidebar__brand">
          <Brand trimestre={settings.schoolYear.trimestre} year={settings.schoolYear.label} />
        </div>

        <nav className="gc-sidenav">
          {primaryNavItems.map(renderNavLink)}

          {visibleClassLife.length > 0 && (
            <>
              <div className="gc-sidenav__section">Vie de classe</div>
              {visibleClassLife.map(renderNavLink)}
            </>
          )}

          {visibleResources.length > 0 && (
            <>
              <div className="gc-sidenav__section">Ressources</div>
              {visibleResources.map(renderNavLink)}
            </>
          )}

          {devItems.length > 0 && (
            <>
              <div className="gc-sidenav__section">Développement</div>
              {devItems.map(renderNavLink)}
            </>
          )}
        </nav>

        <div className="gc-sidebar__foot">
          {!pronoteConnected && (
            <Link to="/pronote" className="gc-pronote-card">
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <NavIcon name="info" size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>Pronote non connecté</span>
              <span className="gc-pronote-card__cta">Connecter</span>
            </Link>
          )}

          <div className="gc-sidebar__account">
            <AccountRow
              notifs={notifs}
              email={user?.email}
              onSignOut={signOut}
              onOpenSettings={() => setIsSettingsOpen(true)}
              placement="up"
            />
          </div>
        </div>
      </aside>

      {/* ---- Colonne de contenu ---- */}
      <div className="gc-shell__main">
        {/* Barre du haut — mobile / tablette uniquement */}
        <header className="gc-topbar">
          <Brand trimestre={settings.schoolYear.trimestre} year={settings.schoolYear.label} />
          <AccountRow
            notifs={notifs}
            email={user?.email}
            onSignOut={signOut}
            onOpenSettings={() => setIsSettingsOpen(true)}
            placement="down"
          />
        </header>

        <AnnouncementBanner />

        <main
          className="gc-main"
          style={{
            maxWidth: fullBleed ? 'none' : fluid ? 1600 : 1320,
            margin: '0 auto',
            padding: fullBleed ? 0 : 28,
          }}
        >
          {children}
        </main>
      </div>

      {/* Tab bar mobile (reskin Direction B) — masquee sur desktop via .mobile-nav */}
      <MobileTabBar
        items={allNavItems}
        currentPath={location.pathname}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <FeedbackButton />
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

/* ============================================================
   Tab bar mobile — 4 onglets + "Plus" (reskin Direction B)
   ============================================================ */

const TAB_BAR_PATHS = ['/', '/classes', '/sessions', '/students'];

const TAB_LABELS: Record<string, string> = {
  '/': 'Accueil',
  '/classes': 'Classes',
  '/sessions': 'Séances',
  '/students': 'Élèves',
};

function MobileTabBar({
  items,
  currentPath,
  onOpenSettings,
}: {
  items: { path: string; label: string; icon: string }[];
  currentPath: string;
  onOpenSettings: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const tabs = TAB_BAR_PATHS.map(path => items.find(i => i.path === path)).filter(Boolean) as typeof items;
  const moreItems = items.filter(i => !TAB_BAR_PATHS.includes(i.path));
  const isMoreActive = moreItems.some(i => i.path === currentPath);

  return (
    <>
      <nav
        className="mobile-nav"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          background: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map(item => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '8px 2px 7px',
                textDecoration: 'none',
                color: isActive ? '#4F46E5' : '#9CA3AF',
              }}
            >
              <NavIcon name={item.icon} size={22} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}>
                {TAB_LABELS[item.path] ?? item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '8px 2px 7px',
            background: 'none',
            border: 'none',
            color: isMoreActive ? '#4F46E5' : '#9CA3AF',
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
            <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: isMoreActive ? 600 : 500 }}>Plus</span>
        </button>
      </nav>

      {/* Sheet "Plus" : les autres pages + reglages */}
      {showMore && (
        <div
          className="mobile-nav-sheet"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(15,23,42,0.35)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setShowMore(false)}
        >
          <div
            style={{
              width: '100%',
              background: '#FFFFFF',
              borderRadius: '20px 20px 0 0',
              padding: '10px 20px 20px',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 38, height: 4, borderRadius: 2, background: '#E5E7EB', margin: '0 auto 16px' }} />
            {moreItems.map(item => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 12px',
                    borderRadius: 12,
                    textDecoration: 'none',
                    color: isActive ? '#4F46E5' : '#1F2433',
                    background: isActive ? '#EEF0FF' : 'transparent',
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ width: 24, display: 'grid', placeItems: 'center' }}>
                    <NavIcon name={item.icon} size={18} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setShowMore(false); onOpenSettings(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '13px 12px',
                marginTop: 4,
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                color: '#1F2433',
                fontSize: 15,
                fontWeight: 500,
                textAlign: 'left',
              }}
            >
              <span style={{ width: 24, display: 'grid', placeItems: 'center' }}>
                <NavIcon name="settings" size={18} />
              </span>
              Réglages
            </button>
          </div>
        </div>
      )}
    </>
  );
}
