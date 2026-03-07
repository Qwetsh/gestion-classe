import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ClassOption {
  id: string;
  name: string;
}

interface EventData {
  id: string;
  type: string;
  timestamp: string;
  session_id: string;
  class_id: string;
  class_name: string;
}

interface DailyData {
  date: string;
  participations: number;
  bavardages: number;
  absences: number;
}

interface ClassStats {
  class_name: string;
  participations: number;
  bavardages: number;
  absences: number;
  ratio: number;
}

const COLORS = {
  participation: '#22c55e',
  bavardage: '#ef4444',
  absence: '#f59e0b',
  sortie: '#3b82f6',
  remarque: '#8b5cf6',
};

export function Analytics() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Load classes
  useEffect(() => {
    if (!user) return;

    async function loadClasses() {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', user!.id)
        .order('name');

      if (data) {
        setClasses(data);
        setSelectedClasses(data.map((c) => c.id)); // Select all by default
      }
    }

    loadClasses();
  }, [user]);

  // Load events
  useEffect(() => {
    if (!user || selectedClasses.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    async function loadEvents() {
      setIsLoading(true);

      // Calculate date filter
      let dateFilter: string | null = null;
      const now = new Date();
      if (dateRange === '7d') {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === '30d') {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === '90d') {
        dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      let query = supabase
        .from('events')
        .select(`
          id,
          type,
          timestamp,
          session_id,
          sessions!inner (
            class_id,
            user_id,
            classes (name)
          )
        `)
        .eq('sessions.user_id', user!.id)
        .in('sessions.class_id', selectedClasses);

      if (dateFilter) {
        query = query.gte('timestamp', dateFilter);
      }

      const { data, error } = await query.order('timestamp', { ascending: true });

      if (error) {
        console.error('Error loading events:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        const mapped = data.map((e: any) => ({
          id: e.id,
          type: e.type,
          timestamp: e.timestamp,
          session_id: e.session_id,
          class_id: e.sessions.class_id,
          class_name: e.sessions.classes?.name || 'Inconnu',
        }));
        setEvents(mapped);
      }

      setIsLoading(false);
    }

    loadEvents();
  }, [user, selectedClasses, dateRange]);

  // Compute daily data for line chart
  const dailyData = useMemo(() => {
    const byDate = new Map<string, DailyData>();

    events.forEach((event) => {
      const date = event.timestamp.split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, { date, participations: 0, bavardages: 0, absences: 0 });
      }
      const entry = byDate.get(date)!;
      if (event.type === 'participation') entry.participations++;
      else if (event.type === 'bavardage') entry.bavardages++;
      else if (event.type === 'absence') entry.absences++;
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Compute class stats for bar chart
  const classStats = useMemo(() => {
    const byClass = new Map<string, ClassStats>();

    events.forEach((event) => {
      if (!byClass.has(event.class_id)) {
        byClass.set(event.class_id, {
          class_name: event.class_name,
          participations: 0,
          bavardages: 0,
          absences: 0,
          ratio: 0,
        });
      }
      const entry = byClass.get(event.class_id)!;
      if (event.type === 'participation') entry.participations++;
      else if (event.type === 'bavardage') entry.bavardages++;
      else if (event.type === 'absence') entry.absences++;
    });

    // Calculate ratio
    byClass.forEach((entry) => {
      const total = entry.participations + entry.bavardages;
      entry.ratio = total > 0 ? Math.round((entry.participations / total) * 100) : 0;
    });

    return Array.from(byClass.values()).sort((a, b) => b.ratio - a.ratio);
  }, [events]);

  // Compute totals for pie chart
  const totals = useMemo(() => {
    const result = { participations: 0, bavardages: 0, absences: 0, sorties: 0, remarques: 0 };
    events.forEach((event) => {
      if (event.type === 'participation') result.participations++;
      else if (event.type === 'bavardage') result.bavardages++;
      else if (event.type === 'absence') result.absences++;
      else if (event.type === 'sortie') result.sorties++;
      else if (event.type === 'remarque') result.remarques++;
    });
    return result;
  }, [events]);

  const pieData = [
    { name: 'Participations', value: totals.participations, color: COLORS.participation },
    { name: 'Bavardages', value: totals.bavardages, color: COLORS.bavardage },
    { name: 'Absences', value: totals.absences, color: COLORS.absence },
    { name: 'Sorties', value: totals.sorties, color: COLORS.sortie },
    { name: 'Remarques', value: totals.remarques, color: COLORS.remarque },
  ].filter((d) => d.value > 0);

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const selectAllClasses = () => {
    setSelectedClasses(classes.map((c) => c.id));
  };

  const deselectAllClasses = () => {
    setSelectedClasses([]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  if (isLoading && classes.length === 0) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--color-text-secondary)]">Chargement...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Analyses</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Statistiques detaillees de vos classes
          </p>
        </div>

        {/* Filters */}
        <div
          className="bg-[var(--color-surface)] p-5"
          style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Periode:</span>
              <div className="flex gap-1">
                {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      dateRange === range
                        ? 'text-white'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                    }`}
                    style={
                      dateRange === range
                        ? { background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }
                        : { borderRadius: 'var(--radius-lg)' }
                    }
                  >
                    {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : range === '90d' ? '90 jours' : 'Tout'}
                  </button>
                ))}
              </div>
            </div>

            {/* Class filter */}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Classes:</span>
                <button
                  onClick={selectAllClasses}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  Toutes
                </button>
                <span className="text-[var(--color-text-tertiary)]">|</span>
                <button
                  onClick={deselectAllClasses}
                  className="text-xs text-[var(--color-primary)] hover:underline"
                >
                  Aucune
                </button>
                <div className="flex gap-2 flex-wrap">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      className={`px-3 py-1 text-sm font-medium transition-colors ${
                        selectedClasses.includes(cls.id)
                          ? 'text-white'
                          : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]'
                      }`}
                      style={
                        selectedClasses.includes(cls.id)
                          ? { background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }
                          : { borderRadius: 'var(--radius-lg)' }
                      }
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedClasses.length === 0 ? (
          <div
            className="bg-[var(--color-surface)] p-8 text-center"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div
              className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] flex items-center justify-center"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-[var(--color-text-tertiary)]">
              Selectionnez au moins une classe pour afficher les statistiques
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryCard
                label="Participations"
                value={totals.participations}
                color={COLORS.participation}
                icon="+"
              />
              <SummaryCard
                label="Bavardages"
                value={totals.bavardages}
                color={COLORS.bavardage}
                icon="-"
              />
              <SummaryCard
                label="Absences"
                value={totals.absences}
                color={COLORS.absence}
                icon="A"
              />
              <SummaryCard
                label="Sorties"
                value={totals.sorties}
                color={COLORS.sortie}
                icon="S"
              />
              <SummaryCard
                label="Ratio +/-"
                value={`${totals.participations + totals.bavardages > 0 ? Math.round((totals.participations / (totals.participations + totals.bavardages)) * 100) : 0}%`}
                color="var(--color-primary)"
                icon="%"
                isPercentage
              />
            </div>

            {/* Charts grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Evolution chart */}
              <div
                className="bg-[var(--color-surface)] p-5"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                  Evolution dans le temps
                </h3>
                {dailyData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-[var(--color-text-tertiary)]">
                    Aucune donnee pour cette periode
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        stroke="var(--color-text-tertiary)"
                        fontSize={12}
                      />
                      <YAxis stroke="var(--color-text-tertiary)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('fr-FR')}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="participations"
                        name="Participations"
                        stroke={COLORS.participation}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bavardages"
                        name="Bavardages"
                        stroke={COLORS.bavardage}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="absences"
                        name="Absences"
                        stroke={COLORS.absence}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Distribution pie chart */}
              <div
                className="bg-[var(--color-surface)] p-5"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                  Repartition des evenements
                </h3>
                {pieData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-[var(--color-text-tertiary)]">
                    Aucune donnee
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Class comparison */}
            <div
              className="bg-[var(--color-surface)] p-5"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                Comparaison par classe
              </h3>
              {classStats.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-[var(--color-text-tertiary)]">
                  Aucune donnee
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, classStats.length * 50)}>
                  <BarChart data={classStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" stroke="var(--color-text-tertiary)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="class_name"
                      stroke="var(--color-text-tertiary)"
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="participations" name="Participations" fill={COLORS.participation} />
                    <Bar dataKey="bavardages" name="Bavardages" fill={COLORS.bavardage} />
                    <Bar dataKey="absences" name="Absences" fill={COLORS.absence} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Class ranking table */}
            <div
              className="bg-[var(--color-surface)] overflow-hidden"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="p-5 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  Classement par ratio participation/bavardage
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                      <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                        Classe
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                        Participations
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                        Bavardages
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                        Absences
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-secondary)]">
                        Ratio
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStats.map((cls, index) => (
                      <tr
                        key={cls.class_name}
                        className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-6 h-6 flex items-center justify-center text-xs font-bold text-white"
                              style={{
                                backgroundColor: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#cd7f32' : 'var(--color-primary)',
                                borderRadius: 'var(--radius-md)',
                              }}
                            >
                              {index + 1}
                            </span>
                            <span className="font-medium text-[var(--color-text)]">{cls.class_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="px-2 py-1 text-sm font-medium"
                            style={{
                              backgroundColor: `${COLORS.participation}20`,
                              color: COLORS.participation,
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            {cls.participations}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="px-2 py-1 text-sm font-medium"
                            style={{
                              backgroundColor: `${COLORS.bavardage}20`,
                              color: COLORS.bavardage,
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            {cls.bavardages}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="px-2 py-1 text-sm font-medium"
                            style={{
                              backgroundColor: `${COLORS.absence}20`,
                              color: COLORS.absence,
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            {cls.absences}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="w-16 h-2 bg-[var(--color-surface-secondary)] overflow-hidden"
                              style={{ borderRadius: 'var(--radius-full)' }}
                            >
                              <div
                                className="h-full"
                                style={{
                                  width: `${cls.ratio}%`,
                                  backgroundColor: cls.ratio >= 60 ? COLORS.participation : cls.ratio >= 40 ? COLORS.absence : COLORS.bavardage,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-[var(--color-text)]">
                              {cls.ratio}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
  isPercentage = false,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: string;
  isPercentage?: boolean;
}) {
  return (
    <div
      className="bg-[var(--color-surface)] p-4 transition-transform hover:scale-[1.02]"
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="w-10 h-10 flex items-center justify-center text-lg font-bold mb-3"
        style={{
          backgroundColor: `${color}20`,
          color: color,
          borderRadius: 'var(--radius-lg)',
        }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-sm text-[var(--color-text-tertiary)]">{label}</div>
    </div>
  );
}
