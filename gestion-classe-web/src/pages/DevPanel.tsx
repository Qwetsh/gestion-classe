import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { pronoteFetcher } from '../lib/pronoteFetcher';

const DEV_EMAIL = 'tomicharles@gmail.com';

type Tab = 'feedbacks' | 'users' | 'devices' | 'stats' | 'errors' | 'announcements' | 'pronote';

interface Feedback {
  id: string;
  user_email: string;
  type: 'bug' | 'suggestion' | 'autre';
  message: string;
  created_at: string;
  archived?: boolean;
}

interface UserActivity {
  user_id: string;
  user_email: string;
  last_seen_at: string;
  login_count: number;
  device_info: string | null;
}

interface ErrorLog {
  id: string;
  user_email: string | null;
  error_message: string;
  error_stack: string | null;
  page_url: string | null;
  created_at: string;
}

interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  created_at: string;
}

interface DeviceConnection {
  id: string;
  user_email: string;
  device_info: string;
  platform: 'web' | 'mobile';
  created_at: string;
}

interface TableStat {
  table_name: string;
  row_count: number;
}

export function DevPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('feedbacks');

  if (user?.email !== DEV_EMAIL) {
    return (
      <Layout>
        <div className="text-center py-20 text-[var(--text-muted)]">
          Acces non autorise.
        </div>
      </Layout>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'feedbacks', label: 'Retours', icon: '💬' },
    { key: 'users', label: 'Utilisateurs', icon: '👥' },
    { key: 'devices', label: 'Appareils', icon: '📱' },
    { key: 'stats', label: 'Stats DB', icon: '📊' },
    { key: 'errors', label: 'Erreurs', icon: '🐛' },
    { key: 'announcements', label: 'Annonces', icon: '📢' },
    { key: 'pronote', label: 'Pronote API', icon: '🔌' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Panel Dev</h1>
          <p style={{ color: 'var(--text-muted)' }} className="mt-1">Outils d'administration</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                tab === t.key
                  ? 'text-white'
                  : 'text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--indigo)]'
              }`}
              style={{
                borderRadius: 'var(--radius)',
                ...(tab === t.key ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}),
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'feedbacks' && <FeedbacksTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'devices' && <DevicesTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'errors' && <ErrorsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'pronote' && <PronoteTab />}
      </div>
    </Layout>
  );
}

// ============================================
// Feedbacks Tab
// ============================================
function FeedbacksTab() {
  const { toast } = useUIFeedback();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'bug' | 'suggestion' | 'autre'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const loadFeedbacks = async () => {
    const { data } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });
    setFeedbacks(data || []);
    setIsLoading(false);
  };

  useEffect(() => { loadFeedbacks(); }, []);

  const handleArchive = async (id: string, archived: boolean) => {
    setArchivingId(id);
    const { data, error } = await supabase
      .from('feedbacks')
      .update({ archived: !archived })
      .eq('id', id)
      .select('id, archived');
    if (error) {
      console.error('Error archiving feedback:', error);
      toast('Erreur: colonne "archived" manquante ou probleme de migration.');
      setArchivingId(null);
      return;
    }
    if (!data || data.length === 0) {
      toast('Erreur: mise a jour refusee. Verifiez la policy RLS UPDATE sur la table feedbacks.');
      setArchivingId(null);
      return;
    }
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, archived: !archived } : f));
    setArchivingId(null);
  };

  const activeFeedbacks = feedbacks.filter(f => !f.archived);
  const archivedFeedbacks = feedbacks.filter(f => f.archived);
  const displayFeedbacks = showArchived ? archivedFeedbacks : activeFeedbacks;
  const filtered = filter === 'all' ? displayFeedbacks : displayFeedbacks.filter(f => f.type === filter);
  const counts = {
    all: displayFeedbacks.length,
    bug: displayFeedbacks.filter(f => f.type === 'bug').length,
    suggestion: displayFeedbacks.filter(f => f.type === 'suggestion').length,
    autre: displayFeedbacks.filter(f => f.type === 'autre').length,
  };

  const typeConfig = {
    bug: { label: '🐛 Bug', color: 'var(--neg)', bg: 'var(--neg-soft)' },
    suggestion: { label: '💡 Suggestion', color: 'var(--indigo)', bg: 'var(--indigo-soft)' },
    autre: { label: '💬 Autre', color: 'var(--text-muted)', bg: 'var(--surface-3)' },
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Archive toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'bug', 'suggestion', 'autre'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f
                  ? 'text-white bg-[var(--indigo)]'
                  : 'text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)]'
              }`}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {f === 'all' ? '📋 Tous' : typeConfig[f].label} ({counts[f]})
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${
            showArchived
              ? 'text-white bg-[var(--text-dim)]'
              : 'text-[var(--text-dim)] bg-[var(--surface)] border border-[var(--border)]'
          }`}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          📦 Archives ({archivedFeedbacks.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={showArchived ? "Aucun retour archive." : "Aucun retour pour ce filtre."} />
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const tc = typeConfig[fb.type];
            return (
              <Card key={fb.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 text-xs font-semibold"
                      style={{ background: tc.bg, color: tc.color, borderRadius: 'var(--radius-md)' }}
                    >
                      {tc.label}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">{fb.user_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-dim)]">{formatDate(fb.created_at)}</span>
                    <button
                      onClick={() => handleArchive(fb.id, !!fb.archived)}
                      disabled={archivingId === fb.id}
                      className="px-2 py-1 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius-md)' }}
                      title={fb.archived ? 'Desarchiver' : 'Archiver'}
                    >
                      {fb.archived ? '📥 Restaurer' : '📦 Archiver'}
                    </button>
                  </div>
                </div>
                <p className="text-[var(--text)] whitespace-pre-wrap">{fb.message}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Users Tab
// ============================================
function UsersTab() {
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionCounts, setSessionCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    Promise.all([
      supabase
        .from('user_activity')
        .select('*')
        .order('last_seen_at', { ascending: false }),
      supabase
        .from('sessions')
        .select('user_id'),
    ]).then(([actRes, sessRes]) => {
      setUsers(actRes.data || []);

      // Count sessions per user
      const counts = new Map<string, number>();
      (sessRes.data || []).forEach((s: { user_id: string }) => {
        counts.set(s.user_id, (counts.get(s.user_id) || 0) + 1);
      });
      setSessionCounts(counts);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Total utilisateurs" value={users.length} />
        <MiniStat label="Actifs (7j)" value={users.filter(u => daysSince(u.last_seen_at) <= 7).length} />
        <MiniStat label="Inactifs (30j+)" value={users.filter(u => daysSince(u.last_seen_at) > 30).length} />
      </div>

      {users.length === 0 ? (
        <EmptyState text="Aucun utilisateur enregistre." />
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const days = daysSince(u.last_seen_at);
            const isRecent = days <= 7;
            const sessions = sessionCounts.get(u.user_id) || 0;
            const device = parseDevice(u.device_info);
            return (
              <Card key={u.user_id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${isRecent ? 'bg-green-500' : days <= 30 ? 'bg-yellow-500' : 'bg-gray-400'}`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text)]">{u.user_email}</span>
                        {device.icon && (
                          <span
                            className="px-2 py-0.5 text-xs font-medium"
                            style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-md)' }}
                            title={device.full}
                          >
                            {device.icon} {device.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {u.login_count} connexion{u.login_count > 1 ? 's' : ''} · {sessions} seance{sessions > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[var(--text-muted)]">
                      {days === 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `Il y a ${days}j`}
                    </div>
                    <div className="text-xs text-[var(--text-dim)]">{formatDate(u.last_seen_at)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Devices Tab
// ============================================
function DevicesTab() {
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'web' | 'mobile'>('all');

  useEffect(() => {
    supabase
      .from('device_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setConnections(data || []);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <Loader />;

  const filtered = platformFilter === 'all'
    ? connections
    : connections.filter(c => c.platform === platformFilter);

  // Aggregate by device type
  const deviceCounts = new Map<string, { count: number; icon: string; platform: Set<string> }>();
  filtered.forEach(c => {
    const device = parseDevice(c.device_info);
    const key = device.label || 'Inconnu';
    const existing = deviceCounts.get(key);
    if (existing) {
      existing.count++;
      existing.platform.add(c.platform);
    } else {
      deviceCounts.set(key, { count: 1, icon: device.icon || '?', platform: new Set([c.platform]) });
    }
  });

  const sortedDevices = [...deviceCounts.entries()].sort((a, b) => b[1].count - a[1].count);
  const maxCount = sortedDevices.length > 0 ? sortedDevices[0][1].count : 0;

  // Platform counts
  const webCount = connections.filter(c => c.platform === 'web').length;
  const mobileCount = connections.filter(c => c.platform === 'mobile').length;

  // Unique users per device type
  const deviceUsers = new Map<string, Set<string>>();
  filtered.forEach(c => {
    const device = parseDevice(c.device_info);
    const key = device.label || 'Inconnu';
    if (!deviceUsers.has(key)) deviceUsers.set(key, new Set());
    deviceUsers.get(key)!.add(c.user_email);
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Total connexions" value={connections.length} />
        <MiniStat label="Web" value={webCount} />
        <MiniStat label="Mobile" value={mobileCount} />
      </div>

      {/* Platform filter */}
      <div className="flex gap-2">
        {(['all', 'web', 'mobile'] as const).map(f => (
          <button
            key={f}
            onClick={() => setPlatformFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium transition-all ${
              platformFilter === f
                ? 'text-white bg-[var(--indigo)]'
                : 'text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)]'
            }`}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            {f === 'all' ? 'Tous' : f === 'web' ? '🌐 Web' : '📱 Mobile'}
          </button>
        ))}
      </div>

      {/* Device list */}
      {sortedDevices.length === 0 ? (
        <EmptyState text="Aucune connexion enregistree." />
      ) : (
        <Card>
          <h3 className="font-semibold text-[var(--text)] mb-4">Connexions par appareil</h3>
          <div className="space-y-3">
            {sortedDevices.map(([label, data]) => {
              const pct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
              const users = deviceUsers.get(label)?.size || 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{data.icon}</span>
                      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
                      <span className="text-xs text-[var(--text-dim)]">
                        ({users} utilisateur{users > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--text)]">{data.count}</span>
                  </div>
                  <div className="h-6 bg-[var(--surface-3)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                    <div
                      className="h-full transition-all flex items-center pl-2"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {((data.count / filtered.length) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent connections */}
      <Card>
        <h3 className="font-semibold text-[var(--text)] mb-3">Dernieres connexions</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.slice(0, 20).map(c => {
            const device = parseDevice(c.device_info);
            return (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      background: c.platform === 'mobile' ? 'var(--indigo-soft)' : 'var(--surface-3)',
                      color: c.platform === 'mobile' ? 'var(--indigo)' : 'var(--text-muted)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    {c.platform === 'mobile' ? '📱' : '🌐'} {c.platform}
                  </span>
                  <span className="text-sm text-[var(--text)]">{device.icon} {device.label}</span>
                  <span className="text-xs text-[var(--text-dim)]">- {c.user_email}</span>
                </div>
                <span className="text-xs text-[var(--text-dim)]">{formatDate(c.created_at)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Stats Tab (DB)
// ============================================
function StatsTab() {
  const [tableStats, setTableStats] = useState<TableStat[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<{ sessions: number; events: number }>({ sessions: 0, events: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase.rpc('get_table_row_counts'),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('started_at', oneWeekAgo),
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
    ]).then(([statsRes, sessRes, evtRes]) => {
      setTableStats(statsRes.data || []);
      setWeeklyStats({
        sessions: sessRes.count || 0,
        events: evtRes.count || 0,
      });
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return <Loader />;

  const totalRows = tableStats.reduce((sum, t) => sum + t.row_count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Total rows" value={totalRows} />
        <MiniStat label="Seances (7j)" value={weeklyStats.sessions} />
        <MiniStat label="Events (7j)" value={weeklyStats.events} />
      </div>

      <Card>
        <h3 className="font-semibold text-[var(--text)] mb-3">Rows par table</h3>
        <div className="space-y-2">
          {tableStats.sort((a, b) => b.row_count - a.row_count).map(t => {
            const pct = totalRows > 0 ? (t.row_count / totalRows) * 100 : 0;
            return (
              <div key={t.table_name} className="flex items-center gap-3">
                <span className="text-sm font-mono text-[var(--text-muted)] w-32">{t.table_name}</span>
                <div className="flex-1 h-5 bg-[var(--surface-3)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.max(pct, 1)}%`, background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <span className="text-sm font-semibold text-[var(--text)] w-16 text-right">{t.row_count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-[var(--text)] mb-2">Estimation stockage</h3>
        <p className="text-sm text-[var(--text-muted)]">
          ~{(totalRows * 0.5 / 1024).toFixed(1)} MB utilises (estimation) / 500 MB free plan
        </p>
        <div className="mt-2 h-4 bg-[var(--surface-3)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.min((totalRows * 0.5 / 1024 / 500) * 100, 100)}%`,
              background: (totalRows * 0.5 / 1024) > 400 ? 'var(--neg)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              borderRadius: 'var(--radius-md)',
            }}
          />
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Errors Tab
// ============================================
function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setErrors(data || []);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MiniStat label="Erreurs totales" value={errors.length} />
      </div>

      {errors.length === 0 ? (
        <EmptyState text="Aucune erreur enregistree. Bonne nouvelle !" />
      ) : (
        <div className="space-y-3">
          {errors.map(err => (
            <Card key={err.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-muted)]">{err.user_email || 'Anonyme'}</span>
                <span className="text-xs text-[var(--text-dim)]">{formatDate(err.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-[var(--neg)] mb-1">{err.error_message}</p>
              {err.page_url && (
                <p className="text-xs text-[var(--text-dim)] mb-1">Page: {err.page_url}</p>
              )}
              {err.error_stack && (
                <details className="mt-2">
                  <summary className="text-xs text-[var(--text-dim)] cursor-pointer hover:text-[var(--text-muted)]">
                    Voir la stack trace
                  </summary>
                  <pre className="mt-1 text-xs font-mono text-[var(--text-dim)] whitespace-pre-wrap bg-[var(--surface-3)] p-2 overflow-auto max-h-32" style={{ borderRadius: 'var(--radius-md)' }}>
                    {err.error_stack}
                  </pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Announcements Tab
// ============================================
function AnnouncementsTab() {
  const { toast } = useUIFeedback();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState<'info' | 'warning' | 'success'>('info');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements(data || []);
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!newMessage.trim()) return;
    setIsSaving(true);
    const { error } = await supabase.from('announcements').insert({
      message: newMessage.trim(),
      type: newType,
      active: true,
    });
    if (error) {
      console.error('Error creating announcement:', error);
      toast('Erreur lors de la creation');
    } else {
      setNewMessage('');
      loadAnnouncements();
    }
    setIsSaving(false);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('announcements').update({ active: !currentActive }).eq('id', id);
    loadAnnouncements();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  };

  if (isLoading) return <Loader />;

  const typeOptions = [
    { value: 'info' as const, label: 'ℹ️ Info', color: 'var(--indigo)' },
    { value: 'warning' as const, label: '⚠️ Alerte', color: '#d97706' },
    { value: 'success' as const, label: '✅ Succes', color: 'var(--pos)' },
  ];

  return (
    <div className="space-y-4">
      {/* Create new */}
      <Card>
        <h3 className="font-semibold text-[var(--text)] mb-3">Nouvelle annonce</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setNewType(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium border-2 transition-all ${
                  newType === opt.value
                    ? 'text-white'
                    : 'text-[var(--text-muted)] border-[var(--border)]'
                }`}
                style={{
                  borderRadius: 'var(--radius-md)',
                  ...(newType === opt.value ? { background: opt.color, borderColor: opt.color } : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Message de l'annonce..."
              className="flex-1 px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] text-sm"
              style={{ borderRadius: 'var(--radius)' }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={isSaving || !newMessage.trim()}
              className="px-4 py-2 text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}
            >
              Publier
            </button>
          </div>
        </div>
      </Card>

      {/* List */}
      {announcements.length === 0 ? (
        <EmptyState text="Aucune annonce." />
      ) : (
        <div className="space-y-2">
          {announcements.map(a => (
            <Card key={a.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${a.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={`text-sm ${a.active ? 'text-[var(--text)]' : 'text-[var(--text-dim)] line-through'}`}>
                    {a.type === 'info' ? 'ℹ️' : a.type === 'warning' ? '⚠️' : '✅'} {a.message}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs text-[var(--text-dim)]">{formatDate(a.created_at)}</span>
                  <button
                    onClick={() => toggleActive(a.id, a.active)}
                    className="px-2 py-1 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    {a.active ? 'Desactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="px-2 py-1 text-xs font-medium text-[var(--neg)] border border-[var(--neg-soft)] hover:bg-[var(--neg-soft)] transition-colors"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    Suppr
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Pronote API Explorer Tab
// ============================================

const PRONOTE_STORAGE_KEY = 'pronote_session';

interface StoredPronoteSession {
  token: string;
  username: string;
  url: string;
  kind: number;
  deviceUUID: string;
}

function loadStoredPronoteSession(): StoredPronoteSession | null {
  try {
    const raw = localStorage.getItem(PRONOTE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

interface PronoteEndpoint {
  id: string;
  label: string;
  icon: string;
  category: string;
  description: string;
  run: (pw: any, sess: any) => Promise<any>;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function PronoteTab() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, { data: any; loading: boolean; error: string | null; timestamp: Date | null }>>(new Map());
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [sessionDump, setSessionDump] = useState<string | null>(null);
  const [showSessionDump, setShowSessionDump] = useState(false);
  const sessRef = useRef<any>(null);
  const pwRef = useRef<any>(null);

  // Available periods (filled after connection)
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(0);

  const endpoints: PronoteEndpoint[] = [
    // Emploi du temps
    {
      id: 'timetable_week', label: 'Emploi du temps (semaine)', icon: '📅', category: 'Emploi du temps',
      description: 'EDT de la semaine en cours',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const weekStart = getMonday(new Date());
        const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
        return await pw.timetableFromWeek(sess, weekNum);
      },
    },
    {
      id: 'timetable_next', label: 'EDT semaine prochaine', icon: '📅', category: 'Emploi du temps',
      description: 'EDT de la semaine prochaine',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const nextMonday = getMonday(new Date());
        nextMonday.setDate(nextMonday.getDate() + 7);
        const weekNum = pw.translateToWeekNumber(nextMonday, new Date(startDay));
        return await pw.timetableFromWeek(sess, weekNum);
      },
    },
    {
      id: 'frequency', label: 'Fréquence semaine', icon: '🔄', category: 'Emploi du temps',
      description: 'Semaine A/B et infos de fréquence',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const weekStart = getMonday(new Date());
        const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
        return await pw.frequency(sess, weekNum);
      },
    },
    // Notes
    {
      id: 'grades_overview', label: 'Notes (overview)', icon: '📊', category: 'Notes',
      description: 'Vue d\'ensemble des notes + moyennes',
      run: async (pw, sess) => {
        const p = periods[selectedPeriod];
        if (!p) throw new Error(`Aucune période disponible (${periods.length} trouvées). Voir "Infos session" pour debug.`);
        return await pw.gradesOverview(sess, p);
      },
    },
    {
      id: 'gradebook', label: 'Bulletin (gradebook)', icon: '📋', category: 'Notes',
      description: 'Bulletin détaillé avec matières et graphique',
      run: async (pw, sess) => {
        const p = periods[selectedPeriod];
        if (!p) throw new Error(`Aucune période disponible (${periods.length} trouvées). Voir "Infos session" pour debug.`);
        return await pw.gradebook(sess, p);
      },
    },
    {
      id: 'evaluations', label: 'Évaluations', icon: '✅', category: 'Notes',
      description: 'Évaluations par compétences',
      run: async (pw, sess) => {
        const p = periods[selectedPeriod];
        if (!p) throw new Error(`Aucune période disponible (${periods.length} trouvées). Voir "Infos session" pour debug.`);
        return await pw.evaluations(sess, p);
      },
    },
    // Devoirs
    {
      id: 'assignments_week', label: 'Devoirs (semaine)', icon: '📝', category: 'Devoirs',
      description: 'Devoirs de la semaine en cours',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const weekStart = getMonday(new Date());
        const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
        return await pw.assignmentsFromWeek(sess, weekNum);
      },
    },
    {
      id: 'assignments_next', label: 'Devoirs (sem. prochaine)', icon: '📝', category: 'Devoirs',
      description: 'Devoirs de la semaine prochaine',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const nextMonday = getMonday(new Date());
        nextMonday.setDate(nextMonday.getDate() + 7);
        const weekNum = pw.translateToWeekNumber(nextMonday, new Date(startDay));
        return await pw.assignmentsFromWeek(sess, weekNum);
      },
    },
    // Vie scolaire
    {
      id: 'notebook', label: 'Cahier de textes / Vie scolaire', icon: '📓', category: 'Vie scolaire',
      description: 'Absences, retards, observations, punitions',
      run: async (pw, sess) => {
        const p = periods[selectedPeriod];
        if (!p) throw new Error(`Aucune période disponible (${periods.length} trouvées). Voir "Infos session" pour debug.`);
        return await pw.notebook(sess, p);
      },
    },
    // Messagerie
    {
      id: 'discussions', label: 'Messagerie', icon: '💬', category: 'Messagerie',
      description: 'Liste de toutes les discussions',
      run: async (pw, sess) => {
        return await pw.discussions(sess);
      },
    },
    // Actualités
    {
      id: 'news', label: 'Actualités', icon: '📰', category: 'Actualités',
      description: 'Annonces, sondages, informations',
      run: async (pw, sess) => {
        return await pw.news(sess);
      },
    },
    // Ressources
    {
      id: 'resources_week', label: 'Ressources (semaine)', icon: '📁', category: 'Ressources',
      description: 'Ressources pédagogiques de la semaine',
      run: async (pw, sess) => {
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        const weekStart = getMonday(new Date());
        const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
        return await pw.resourcesFromWeek(sess, weekNum);
      },
    },
    // Homepage
    {
      id: 'homepage', label: 'Page d\'accueil Pronote', icon: '🏠', category: 'Divers',
      description: 'Données du dashboard Pronote',
      run: async (pw, sess) => {
        return await pw.homepage(sess);
      },
    },
    // Compte
    {
      id: 'account', label: 'Compte utilisateur', icon: '👤', category: 'Divers',
      description: 'Infos profil (adresse, email, INE...)',
      run: async (pw, sess) => {
        return await pw.account(sess);
      },
    },
    // Menus
    {
      id: 'menus', label: 'Menus cantine', icon: '🍽️', category: 'Divers',
      description: 'Menus de la semaine avec allergènes',
      run: async (pw, sess) => {
        return await pw.menus(sess);
      },
    },
    // Session info brute
    {
      id: 'session_info', label: 'Infos session (brut)', icon: '🔧', category: 'Debug',
      description: 'Données brutes de la session Pronote',
      run: async (_pw, sess) => {
        return {
          user: sess.user,
          userResource: sess.userResource,
          instance: sess.instance,
          isReady: sess.isReady,
        };
      },
    },
  ];

  // Connect to Pronote
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const stored = loadStoredPronoteSession();
      if (!stored) throw new Error('Aucune session Pronote sauvegardée. Connectez-vous d\'abord via l\'onglet Pronote.');

      const pw = await import('pawnote');
      const sess = pw.createSessionHandle(pronoteFetcher);
      const refreshInfo = await pw.loginToken(sess, {
        url: stored.url,
        kind: stored.kind as typeof pw.AccountKind[keyof typeof pw.AccountKind],
        username: stored.username,
        token: stored.token,
        deviceUUID: stored.deviceUUID,
      });

      // Save refreshed token
      localStorage.setItem(PRONOTE_STORAGE_KEY, JSON.stringify({
        token: refreshInfo.token,
        username: refreshInfo.username,
        url: refreshInfo.url,
        kind: refreshInfo.kind,
        deviceUUID: stored.deviceUUID,
      }));

      sessRef.current = sess;
      pwRef.current = pw;

      // Deep-search for periods in the session object
      const s = sess as any;
      let foundPeriods: any[] = [];

      // Try all known paths
      const paths = [
        s.user?.resources?.[0]?.periods,
        s.userResource?.periods,
        s.periods,
        s.user?.periods,
        s.information?.periods,
        s.instance?.periods,
      ];
      for (const p of paths) {
        if (Array.isArray(p) && p.length > 0) { foundPeriods = p; break; }
      }

      // If still empty, walk the object to find any array named "periods"
      if (foundPeriods.length === 0) {
        const searchPeriods = (obj: any, depth = 0): any[] | null => {
          if (depth > 4 || !obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj)) return null;
          for (const key of Object.keys(obj)) {
            if (key === 'periods' && Array.isArray(obj[key]) && obj[key].length > 0) return obj[key];
            const found = searchPeriods(obj[key], depth + 1);
            if (found) return found;
          }
          return null;
        };
        foundPeriods = searchPeriods(s) || [];
      }

      setPeriods(foundPeriods);
      setSessionDump(JSON.stringify({
        keys: Object.keys(s),
        user_keys: s.user ? Object.keys(s.user) : null,
        userResource_keys: s.userResource ? Object.keys(s.userResource) : null,
        instance_keys: s.instance ? Object.keys(s.instance) : null,
        periodsFound: foundPeriods.length,
        periodsPreview: foundPeriods.slice(0, 3).map((p: any) => ({ name: p.name, id: p.id, kind: p.kind })),
      }, null, 2));

      setConnected(true);
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setConnecting(false);
    }
  };

  // Run an endpoint
  const runEndpoint = async (ep: PronoteEndpoint) => {
    if (!pwRef.current || !sessRef.current) return;

    setResults(prev => {
      const next = new Map(prev);
      next.set(ep.id, { data: null, loading: true, error: null, timestamp: null });
      return next;
    });

    try {
      const data = await ep.run(pwRef.current, sessRef.current);
      // Deep serialize (dates, etc.)
      const serialized = JSON.parse(JSON.stringify(data, (_key, value) => {
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'bigint') return value.toString();
        return value;
      }));
      setResults(prev => {
        const next = new Map(prev);
        next.set(ep.id, { data: serialized, loading: false, error: null, timestamp: new Date() });
        return next;
      });
      setExpandedResult(ep.id);
    } catch (err: any) {
      const errorDetail = [
        err.message || 'Erreur inconnue',
        err.code ? `Code: ${err.code}` : '',
        err.name && err.name !== 'Error' ? `Type: ${err.name}` : '',
        err.stack ? `\n--- Stack ---\n${err.stack}` : '',
      ].filter(Boolean).join('\n');
      setResults(prev => {
        const next = new Map(prev);
        next.set(ep.id, { data: null, loading: false, error: errorDetail, timestamp: new Date() });
        return next;
      });
      setExpandedResult(ep.id);
    }
  };

  // Run all endpoints
  const runAll = async () => {
    for (const ep of endpoints) {
      await runEndpoint(ep);
    }
  };

  // Group endpoints by category
  const categories = [...new Set(endpoints.map(e => e.category))];

  if (!connected) {
    return (
      <div className="space-y-4">
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
            <h3 className="font-semibold text-[var(--text)] mb-2" style={{ fontSize: 16 }}>
              Explorateur API Pronote
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Testez chaque endpoint Pronote et visualisez les données brutes JSON.
            </p>
            {error && (
              <p className="text-sm text-[var(--neg)] mb-4">{error}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-6 py-2.5 text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}
            >
              {connecting ? 'Connexion...' : 'Se connecter à Pronote'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-[var(--text)]">Pronote connecté</span>
            {periods.length > 0 ? (
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(Number(e.target.value))}
                className="px-2 py-1 text-xs bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)]"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                {periods.map((p: any, i: number) => (
                  <option key={i} value={i}>{p.name || `Période ${i + 1}`}</option>
                ))}
              </select>
            ) : (
              <span className="px-2 py-0.5 text-xs font-semibold text-[var(--warn)]" style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', borderRadius: 'var(--radius-md)' }}>
                0 périodes trouvées
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSessionDump(!showSessionDump)}
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {showSessionDump ? 'Masquer session' : 'Debug session'}
            </button>
            <button
              onClick={runAll}
              className="px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius-md)' }}
            >
              Tout tester
            </button>
          </div>
        </div>
        {showSessionDump && sessionDump && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Structure de la session Pronote</span>
              <button
                onClick={() => navigator.clipboard.writeText(sessionDump)}
                className="px-2 py-0.5 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                Copier
              </button>
            </div>
            <pre className="text-xs font-mono text-[var(--text)] whitespace-pre-wrap p-3 bg-[var(--surface-3)] overflow-auto max-h-64" style={{ borderRadius: 'var(--radius-md)' }}>
              {sessionDump}
            </pre>
          </div>
        )}
      </Card>

      {/* Endpoints by category */}
      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wider">{cat}</h3>
          <div className="space-y-2">
            {endpoints.filter(e => e.category === cat).map(ep => {
              const result = results.get(ep.id);
              const isExpanded = expandedResult === ep.id;
              const hasData = result && !result.loading && (result.data || result.error);
              const dataSize = result?.data ? JSON.stringify(result.data).length : 0;

              return (
                <Card key={ep.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span style={{ fontSize: 18 }}>{ep.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-[var(--text)]">{ep.label}</div>
                        <div className="text-xs text-[var(--text-dim)]">{ep.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result?.loading && (
                        <div className="w-4 h-4 border-2 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
                      )}
                      {result?.error && (
                        <span className="px-2 py-0.5 text-xs font-semibold text-[var(--neg)] bg-[var(--neg-soft)]" style={{ borderRadius: 'var(--radius-md)' }}>
                          Erreur
                        </span>
                      )}
                      {result?.data && !result.loading && (
                        <span className="px-2 py-0.5 text-xs font-semibold text-[var(--pos)]" style={{ background: 'color-mix(in srgb, var(--pos) 10%, transparent)', borderRadius: 'var(--radius-md)' }}>
                          OK · {dataSize > 1024 ? `${(dataSize / 1024).toFixed(1)}KB` : `${dataSize}B`}
                        </span>
                      )}
                      {hasData && (
                        <button
                          onClick={() => setExpandedResult(isExpanded ? null : ep.id)}
                          className="px-2 py-1 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        >
                          {isExpanded ? 'Réduire' : 'Voir'}
                        </button>
                      )}
                      <button
                        onClick={() => runEndpoint(ep)}
                        disabled={result?.loading}
                        className="px-3 py-1 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius-md)' }}
                      >
                        {result?.data ? 'Relancer' : 'Tester'}
                      </button>
                    </div>
                  </div>

                  {/* Result panel */}
                  {isExpanded && hasData && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      {result.error ? (
                        <pre className="text-xs font-mono text-[var(--neg)] whitespace-pre-wrap p-3 bg-[var(--surface-3)] overflow-auto max-h-96" style={{ borderRadius: 'var(--radius-md)' }}>
                          {result.error}
                        </pre>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--text-dim)]">
                              {result.timestamp?.toLocaleTimeString('fr-FR')}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
                              }}
                              className="px-2 py-0.5 text-xs font-medium border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
                              style={{ borderRadius: 'var(--radius-md)' }}
                            >
                              Copier JSON
                            </button>
                          </div>
                          <pre className="text-xs font-mono text-[var(--text)] whitespace-pre-wrap p-3 bg-[var(--surface-3)] overflow-auto max-h-96" style={{ borderRadius: 'var(--radius-md)' }}>
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Shared UI components
// ============================================
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--surface)] p-4"
      style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
    >
      {children}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-8 h-8 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-center text-[var(--text-dim)] py-4">{text}</p>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="bg-[var(--surface)] p-4 text-center"
      style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
    >
      <div className="text-2xl font-bold text-[var(--text)]">{value}</div>
      <div className="text-xs text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysSince(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
}

function parseDevice(ua: string | null): { icon: string; label: string; full: string } {
  if (!ua) return { icon: '', label: '', full: 'Inconnu' };

  // Mobile app format: "android / 35 / SM-S926B / Samsung / ..."
  if (ua.includes(' / ') && !ua.includes('Mozilla')) {
    const parts = ua.split(' / ').map(p => p.trim());
    const os = parts[0]?.toLowerCase();
    const model = parts[2] || '';
    if (os === 'ios') return { icon: '📱', label: model || 'iPhone', full: ua };
    if (os === 'android') return { icon: '📱', label: model || 'Android', full: ua };
    return { icon: '📱', label: model || os || 'Mobile', full: ua };
  }

  // Browser user-agent
  const isIphone = /iPhone/i.test(ua);
  const isIpad = /iPad/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  let icon = '🖥️';
  let label = 'Desktop';

  if (isIphone) { icon = '📱'; label = 'iPhone'; }
  else if (isIpad) { icon = '📱'; label = 'iPad'; }
  else if (isAndroid) {
    icon = '📱';
    const match = ua.match(/Android[^;]*;\s*([^)]+)/);
    label = match ? match[1].trim().split(' Build')[0] : 'Android';
  }
  else if (isMac) { icon = '💻'; label = 'Mac'; }
  else if (isWindows) { icon = '🖥️'; label = 'Windows'; }
  else if (isLinux) { icon = '🐧'; label = 'Linux'; }

  return { icon, label, full: ua };
}
