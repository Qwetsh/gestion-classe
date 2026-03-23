import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

const DEV_EMAIL = 'tomicharles@gmail.com';

type Tab = 'feedbacks' | 'users' | 'devices' | 'stats' | 'errors' | 'announcements';

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
        <div className="text-center py-20 text-[var(--color-text-secondary)]">
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
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Panel Dev</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">Outils d'administration</p>
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
                  : 'text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
              style={{
                borderRadius: 'var(--radius-lg)',
                ...(tab === t.key ? { background: 'var(--gradient-primary)' } : {}),
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
      </div>
    </Layout>
  );
}

// ============================================
// Feedbacks Tab
// ============================================
function FeedbacksTab() {
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
    await supabase.from('feedbacks').update({ archived: !archived }).eq('id', id);
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
    bug: { label: '🐛 Bug', color: 'var(--color-error)', bg: 'var(--color-error-soft)' },
    suggestion: { label: '💡 Suggestion', color: 'var(--color-primary)', bg: 'var(--color-primary-soft)' },
    autre: { label: '💬 Autre', color: 'var(--color-text-secondary)', bg: 'var(--color-surface-secondary)' },
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
                  ? 'text-white bg-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)]'
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
              ? 'text-white bg-[var(--color-text-tertiary)]'
              : 'text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)]'
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
                    <span className="text-sm text-[var(--color-text-secondary)]">{fb.user_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-tertiary)]">{formatDate(fb.created_at)}</span>
                    <button
                      onClick={() => handleArchive(fb.id, !!fb.archived)}
                      disabled={archivingId === fb.id}
                      className="px-2 py-1 text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius-md)' }}
                      title={fb.archived ? 'Desarchiver' : 'Archiver'}
                    >
                      {fb.archived ? '📥 Restaurer' : '📦 Archiver'}
                    </button>
                  </div>
                </div>
                <p className="text-[var(--color-text)] whitespace-pre-wrap">{fb.message}</p>
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
                        <span className="font-medium text-[var(--color-text)]">{u.user_email}</span>
                        {device.icon && (
                          <span
                            className="px-2 py-0.5 text-xs font-medium"
                            style={{ background: 'var(--color-surface-secondary)', borderRadius: 'var(--radius-md)' }}
                            title={device.full}
                          >
                            {device.icon} {device.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {u.login_count} connexion{u.login_count > 1 ? 's' : ''} · {sessions} seance{sessions > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {days === 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `Il y a ${days}j`}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{formatDate(u.last_seen_at)}</div>
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
                ? 'text-white bg-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)]'
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
          <h3 className="font-semibold text-[var(--color-text)] mb-4">Connexions par appareil</h3>
          <div className="space-y-3">
            {sortedDevices.map(([label, data]) => {
              const pct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
              const users = deviceUsers.get(label)?.size || 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{data.icon}</span>
                      <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        ({users} utilisateur{users > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-text)]">{data.count}</span>
                  </div>
                  <div className="h-6 bg-[var(--color-surface-secondary)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                    <div
                      className="h-full transition-all flex items-center pl-2"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        background: 'var(--gradient-primary)',
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
        <h3 className="font-semibold text-[var(--color-text)] mb-3">Dernieres connexions</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.slice(0, 20).map(c => {
            const device = parseDevice(c.device_info);
            return (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 text-xs font-medium"
                    style={{
                      background: c.platform === 'mobile' ? 'var(--color-primary-soft)' : 'var(--color-surface-secondary)',
                      color: c.platform === 'mobile' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    {c.platform === 'mobile' ? '📱' : '🌐'} {c.platform}
                  </span>
                  <span className="text-sm text-[var(--color-text)]">{device.icon} {device.label}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">- {c.user_email}</span>
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">{formatDate(c.created_at)}</span>
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
        <h3 className="font-semibold text-[var(--color-text)] mb-3">Rows par table</h3>
        <div className="space-y-2">
          {tableStats.sort((a, b) => b.row_count - a.row_count).map(t => {
            const pct = totalRows > 0 ? (t.row_count / totalRows) * 100 : 0;
            return (
              <div key={t.table_name} className="flex items-center gap-3">
                <span className="text-sm font-mono text-[var(--color-text-secondary)] w-32">{t.table_name}</span>
                <div className="flex-1 h-5 bg-[var(--color-surface-secondary)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.max(pct, 1)}%`, background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <span className="text-sm font-semibold text-[var(--color-text)] w-16 text-right">{t.row_count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-[var(--color-text)] mb-2">Estimation stockage</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          ~{(totalRows * 0.5 / 1024).toFixed(1)} MB utilises (estimation) / 500 MB free plan
        </p>
        <div className="mt-2 h-4 bg-[var(--color-surface-secondary)] overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.min((totalRows * 0.5 / 1024 / 500) * 100, 100)}%`,
              background: (totalRows * 0.5 / 1024) > 400 ? 'var(--color-error)' : 'var(--gradient-primary)',
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
                <span className="text-sm text-[var(--color-text-secondary)]">{err.user_email || 'Anonyme'}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">{formatDate(err.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-[var(--color-error)] mb-1">{err.error_message}</p>
              {err.page_url && (
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Page: {err.page_url}</p>
              )}
              {err.error_stack && (
                <details className="mt-2">
                  <summary className="text-xs text-[var(--color-text-tertiary)] cursor-pointer hover:text-[var(--color-text-secondary)]">
                    Voir la stack trace
                  </summary>
                  <pre className="mt-1 text-xs font-mono text-[var(--color-text-tertiary)] whitespace-pre-wrap bg-[var(--color-surface-secondary)] p-2 overflow-auto max-h-32" style={{ borderRadius: 'var(--radius-md)' }}>
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
      alert('Erreur lors de la creation');
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
    { value: 'info' as const, label: 'ℹ️ Info', color: 'var(--color-primary)' },
    { value: 'warning' as const, label: '⚠️ Alerte', color: '#d97706' },
    { value: 'success' as const, label: '✅ Succes', color: 'var(--color-success)' },
  ];

  return (
    <div className="space-y-4">
      {/* Create new */}
      <Card>
        <h3 className="font-semibold text-[var(--color-text)] mb-3">Nouvelle annonce</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setNewType(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium border-2 transition-all ${
                  newType === opt.value
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] border-[var(--color-border)]'
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
              className="flex-1 px-3 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              style={{ borderRadius: 'var(--radius-lg)' }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={isSaving || !newMessage.trim()}
              className="px-4 py-2 text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
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
                  <span className={`text-sm ${a.active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-tertiary)] line-through'}`}>
                    {a.type === 'info' ? 'ℹ️' : a.type === 'warning' ? '⚠️' : '✅'} {a.message}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-xs text-[var(--color-text-tertiary)]">{formatDate(a.created_at)}</span>
                  <button
                    onClick={() => toggleActive(a.id, a.active)}
                    className="px-2 py-1 text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    style={{ borderRadius: 'var(--radius-md)' }}
                  >
                    {a.active ? 'Desactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="px-2 py-1 text-xs font-medium text-[var(--color-error)] border border-[var(--color-error-soft)] hover:bg-[var(--color-error-soft)] transition-colors"
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
// Shared UI components
// ============================================
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--color-surface)] p-4"
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      {children}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-center text-[var(--color-text-tertiary)] py-4">{text}</p>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="bg-[var(--color-surface)] p-4 text-center"
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
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
