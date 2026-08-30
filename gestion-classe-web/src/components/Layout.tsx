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

const secondaryNavItems = [
  { path: '/rewards', label: 'Récompenses', icon: '⭐' },
  { path: '/group-sessions', label: 'Groupes', icon: '👥' },
  { path: '/evaluations', label: 'Évaluations', icon: '📄' },
  { path: '/academy', label: 'Académie', icon: '🏰' },
  { path: '/tp-templates', label: 'Mes TP', icon: '📋' },
  { path: '/brevets', label: 'Annales', icon: '📚' },
  { path: '/tools', label: 'Outils', icon: '🧰' },
  { path: '/pronote', label: 'Pronote', icon: '🔗' },
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
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 0112 0v5l2 3H4l2-3V8z"/><path d="M10 20a2 2 0 004 0"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    default: return null;
  }
}

export function Layout({ children, fluid, fullBleed }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { settings, isTabVisible } = useSettings();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<{id: string; message: string; type: string; created_at: string}[]>([]);
  const [feedbacks, setFeedbacks] = useState<{id: string; user_email: string; type: string; message: string; created_at: string}[]>([]);
  const [lastRead, setLastRead] = useState<string>(() => localStorage.getItem('gc_notifications_last_read') || '');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const isDev = user?.email === DEV_EMAIL;
  const visibleSecondaryItems = secondaryNavItems.filter(item => isTabVisible(item.path.slice(1)));
  const allSecondaryItems = isDev
    ? [...visibleSecondaryItems, { path: '/dev', label: 'Dev', icon: '🛠️' }]
    : visibleSecondaryItems;
  const allNavItems = [...primaryNavItems, ...allSecondaryItems];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications data
  useEffect(() => {
    if (!user) return;

    supabase
      .from('announcements')
      .select('id, message, type, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setAnnouncements(data); });

    if (user.email === DEV_EMAIL) {
      supabase
        .from('feedbacks')
        .select('id, user_email, type, message, created_at')
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (data) setFeedbacks(data); });
    }
  }, [user]);

  const allNotifs = [
    ...announcements.map(a => ({ id: a.id, created_at: a.created_at, kind: 'announcement' as const })),
    ...(isDev ? feedbacks.map(f => ({ id: f.id, created_at: f.created_at, kind: 'feedback' as const })) : []),
  ];
  const unreadCount = lastRead ? allNotifs.filter(n => n.created_at > lastRead).length : allNotifs.length;

  const handleOpenNotif = () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen) {
      const now = new Date().toISOString();
      setLastRead(now);
      localStorage.setItem('gc_notifications_last_read', now);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: fullBleed ? 'transparent' : 'var(--bg)' }}>
      {/* ---- Top nav ---- */}
      <header style={{
        background: fullBleed ? 'oklch(0.08 0.01 50 / 0.85)' : 'var(--surface)',
        borderBottom: fullBleed ? '1px solid oklch(0.35 0.04 60 / 0.3)' : '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        ...(fullBleed ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
      }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 24,
          padding: '10px 28px',
        }}>
          {/* Brand */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg width="32" height="32" viewBox="0 0 32 32">
              <defs>
                <linearGradient id="gc-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366F1" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="15" fill="url(#gc-grad)" />
              <text x="16" y="21" textAnchor="middle" fontFamily="var(--font-display)" fontSize="13" fontWeight="700" fill="#fff">GC</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: fullBleed ? 'oklch(0.85 0.04 60)' : 'var(--text)' }}>
                Gestion Classe
              </span>
              <span style={{ fontSize: 11, color: fullBleed ? 'oklch(0.55 0.03 60)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                T{settings.schoolYear.trimestre} · {settings.schoolYear.label}
              </span>
            </div>
          </Link>

          {/* Center nav (pill-style) */}
          <nav className="hidden md:flex" style={{
            alignItems: 'center',
            gap: 2,
            justifySelf: 'center',
            background: fullBleed ? 'oklch(0.15 0.02 50 / 0.6)' : 'var(--surface-3)',
            padding: 4,
            borderRadius: 10,
          }}>
            {allNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const isPrimary = primaryNavItems.some(p => p.path === item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 10px',
                    borderRadius: 7,
                    fontSize: 12.5,
                    color: fullBleed
                      ? (isActive ? 'oklch(0.90 0.06 60)' : 'oklch(0.60 0.03 60)')
                      : (isActive ? 'var(--text)' : 'var(--text-muted)'),
                    fontWeight: 500,
                    background: isActive ? (fullBleed ? 'oklch(0.20 0.03 50 / 0.8)' : 'var(--surface)') : 'transparent',
                    boxShadow: isActive ? (fullBleed ? 'none' : 'var(--shadow-1)') : 'none',
                    textDecoration: 'none',
                    transition: 'all 0.12s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isPrimary ? <NavIcon name={item.icon} size={14} /> : <span style={{ fontSize: 13 }}>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={handleOpenNotif}
                style={{
                  width: 32, height: 32, display: 'grid', placeItems: 'center',
                  borderRadius: 8, color: 'var(--text-muted)', border: 'none', background: 'none',
                  cursor: 'pointer', position: 'relative',
                }}
                title="Notifications"
              >
                <NavIcon name="bell" size={16} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--neg)', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'grid', placeItems: 'center',
                    lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div style={{
                  position: 'absolute', right: 0, marginTop: 8,
                  width: 360, maxHeight: 480, overflowY: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: 0, boxShadow: 'var(--shadow-2)', zIndex: 60,
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
                      {/* Announcements section */}
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
                                  transition: 'background 0.15s',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <span style={{ fontSize: 14, marginTop: 1 }}>
                                    {a.type === 'info' ? '\u2139\uFE0F' : a.type === 'warning' ? '\u26A0\uFE0F' : '\u2705'}
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

                      {/* Feedbacks section - dev only */}
                      {isDev && feedbacks.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-dim)', borderTop: announcements.length > 0 ? '2px solid var(--border)' : 'none' }}>
                            Retours utilisateurs
                          </div>
                          {feedbacks.map(f => {
                            const isNew = !lastRead || f.created_at > lastRead;
                            const typeIcon = f.type === 'bug' ? '\uD83D\uDC1B' : f.type === 'suggestion' ? '\uD83D\uDCA1' : '\uD83D\uDCAC';
                            return (
                              <div
                                key={f.id}
                                style={{
                                  padding: '10px 16px',
                                  borderBottom: '1px solid var(--border)',
                                  background: isNew ? 'var(--indigo-soft)' : 'transparent',
                                  transition: 'background 0.15s',
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
              )}
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                width: 32, height: 32, display: 'grid', placeItems: 'center',
                borderRadius: 8, color: 'var(--text-muted)', border: 'none', background: 'none',
                cursor: 'pointer',
              }}
              title="Réglages"
            >
              <NavIcon name="settings" size={16} />
            </button>

            {/* User avatar */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                  fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
                }}
              >
                {user?.email?.charAt(0).toUpperCase()}
              </button>
              {isUserMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, marginTop: 8,
                  width: 260, background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: 4, boxShadow: 'var(--shadow-2)', zIndex: 60,
                }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Connecté en tant que</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={() => { setIsUserMenuOpen(false); signOut(); }}
                    style={{
                      width: '100%', padding: '8px 14px', textAlign: 'left',
                      fontSize: 12.5, fontWeight: 500, color: 'var(--neg)',
                      background: 'none', border: 'none', borderRadius: 7,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.1s',
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
        </div>

      </header>

      <AnnouncementBanner />

      {/* Main content */}
      <main
        className="gc-main"
        style={{
          maxWidth: fullBleed ? 'none' : fluid ? 1600 : 1400,
          margin: '0 auto',
          padding: fullBleed ? 0 : 28,
        }}
      >
        {children}
      </main>

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
                  <span style={{ fontSize: 18, width: 24, display: 'grid', placeItems: 'center' }}>
                    {/* Les items principaux portent un nom d'icone SVG, les secondaires un emoji */}
                    {/^[a-z]+$/.test(item.icon) ? <NavIcon name={item.icon} size={18} /> : item.icon}
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
