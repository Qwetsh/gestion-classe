import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { generateAnalysisReport, prepareReportData } from '../lib/generateReport';
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
  student_id: string;
}

interface StudentGender {
  id: string;
  gender: 'M' | 'F';
}

interface StudentData {
  id: string;
  pseudo: string;
  class_id: string;
}

interface GenderStats {
  garcons: { participations: number; malus: number; absences: number; count: number };
  filles: { participations: number; malus: number; absences: number; count: number };
}

interface DailyData {
  date: string;
  participations: number;
  malus: number;
  absences: number;
}

interface ClassStats {
  class_name: string;
  participations: number;
  malus: number;
  absences: number;
  ratio: number;
}

interface OralGradeData {
  student_id: string;
  class_id: string;
  grade: number; // 1-5
}

interface ClassOralStats {
  class_id: string;
  class_name: string;
  average: number;
  count: number;
}

const COLORS = {
  participation: '#22c55e',
  bavardage: '#ef4444',
  absence: '#f59e0b',
  sortie: '#3b82f6',
  remarque: '#8b5cf6',
  oral: '#6366f1',
};

export function Analytics() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [oralGrades, setOralGrades] = useState<OralGradeData[]>([]);
  const [studentGenders, setStudentGenders] = useState<StudentGender[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [genderMetric, setGenderMetric] = useState<'participations' | 'malus' | 'absences'>('participations');

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
          student_id,
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
          student_id: e.student_id,
          class_id: e.sessions.class_id,
          class_name: e.sessions.classes?.name || 'Inconnu',
        }));
        setEvents(mapped);
      }

      setIsLoading(false);
    }

    loadEvents();
  }, [user, selectedClasses, dateRange]);

  // Load oral evaluations - simple query on oral_evaluations table
  useEffect(() => {
    if (!user) {
      setOralGrades([]);
      return;
    }

    async function loadOralGrades() {
      try {
        const { data, error } = await supabase
          .from('oral_evaluations')
          .select('student_id, class_id, grade')
          .eq('user_id', user!.id);

        if (error) {
          console.error('Error loading oral evaluations:', error);
          setOralGrades([]);
          return;
        }

        setOralGrades(data || []);
      } catch (err) {
        console.error('Error loading oral grades:', err);
        setOralGrades([]);
      }
    }

    loadOralGrades();
  }, [user]);

  // Load student genders and student data
  useEffect(() => {
    if (!user) {
      setStudentGenders([]);
      setStudents([]);
      return;
    }

    async function loadStudentData() {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, pseudo, class_id, gender')
          .eq('user_id', user!.id);

        if (error) {
          console.error('Error loading students:', error);
          setStudentGenders([]);
          setStudents([]);
          return;
        }

        setStudentGenders((data || []).map(s => ({ id: s.id, gender: s.gender || 'M' })));
        setStudents((data || []).map(s => ({ id: s.id, pseudo: s.pseudo, class_id: s.class_id })));
      } catch (err) {
        console.error('Error loading students:', err);
        setStudentGenders([]);
        setStudents([]);
      }
    }

    loadStudentData();
  }, [user]);

  // Compute daily data for line chart
  const dailyData = useMemo(() => {
    const byDate = new Map<string, DailyData>();

    events.forEach((event) => {
      const date = event.timestamp.split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, { date, participations: 0, malus: 0, absences: 0 });
      }
      const entry = byDate.get(date)!;
      if (event.type === 'participation') entry.participations++;
      else if (event.type === 'bavardage') entry.malus++;
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
          malus: 0,
          absences: 0,
          ratio: 0,
        });
      }
      const entry = byClass.get(event.class_id)!;
      if (event.type === 'participation') entry.participations++;
      else if (event.type === 'bavardage') entry.malus++;
      else if (event.type === 'absence') entry.absences++;
    });

    // Calculate ratio
    byClass.forEach((entry) => {
      const total = entry.participations + entry.malus;
      entry.ratio = total > 0 ? Math.round((entry.participations / total) * 100) : 0;
    });

    return Array.from(byClass.values()).sort((a, b) => b.ratio - a.ratio);
  }, [events]);

  // Compute totals for pie chart
  const totals = useMemo(() => {
    const result = { participations: 0, malus: 0, absences: 0, sorties: 0, remarques: 0 };
    events.forEach((event) => {
      if (event.type === 'participation') result.participations++;
      else if (event.type === 'bavardage') result.malus++;
      else if (event.type === 'absence') result.absences++;
      else if (event.type === 'sortie') result.sorties++;
      else if (event.type === 'remarque') result.remarques++;
    });
    return result;
  }, [events]);

  const pieData = [
    { name: 'Participations', value: totals.participations, color: COLORS.participation },
    { name: 'Malus', value: totals.malus, color: COLORS.bavardage },
    { name: 'Absences', value: totals.absences, color: COLORS.absence },
    { name: 'Sorties', value: totals.sorties, color: COLORS.sortie },
    { name: 'Remarques', value: totals.remarques, color: COLORS.remarque },
  ].filter((d) => d.value > 0);

  // Compute gender statistics
  const genderStats = useMemo((): GenderStats | null => {
    if (events.length === 0 || studentGenders.length === 0) return null;

    const genderMap = new Map(studentGenders.map(s => [s.id, s.gender]));
    const studentsM = new Set<string>();
    const studentsF = new Set<string>();

    const stats: GenderStats = {
      garcons: { participations: 0, malus: 0, absences: 0, count: 0 },
      filles: { participations: 0, malus: 0, absences: 0, count: 0 },
    };

    events.forEach(event => {
      const gender = genderMap.get(event.student_id);
      if (!gender) return;

      const target = gender === 'F' ? stats.filles : stats.garcons;
      const studentSet = gender === 'F' ? studentsF : studentsM;

      studentSet.add(event.student_id);

      if (event.type === 'participation') target.participations++;
      else if (event.type === 'bavardage') target.malus++;
      else if (event.type === 'absence') target.absences++;
    });

    stats.garcons.count = studentsM.size;
    stats.filles.count = studentsF.size;

    return stats;
  }, [events, studentGenders]);

  // Compute oral grades statistics - filtered by selected classes
  const oralStats = useMemo(() => {
    // Filter by selected classes
    const filteredGrades = oralGrades.filter(g => selectedClasses.includes(g.class_id));

    if (filteredGrades.length === 0) {
      return { globalAverage: null, byClass: [] as ClassOralStats[] };
    }

    // Global average (already on 5)
    const globalSum = filteredGrades.reduce((sum, g) => sum + g.grade, 0);
    const globalAverage = globalSum / filteredGrades.length;

    // By class
    const byClassMap = new Map<string, { sum: number; count: number }>();

    filteredGrades.forEach(g => {
      if (!byClassMap.has(g.class_id)) {
        byClassMap.set(g.class_id, { sum: 0, count: 0 });
      }
      const entry = byClassMap.get(g.class_id)!;
      entry.sum += g.grade;
      entry.count++;
    });

    // Get class names
    const classNameMap = new Map(classes.map(c => [c.id, c.name]));

    const byClass: ClassOralStats[] = Array.from(byClassMap.entries()).map(([class_id, data]) => ({
      class_id,
      class_name: classNameMap.get(class_id) || 'Inconnu',
      average: data.sum / data.count,
      count: data.count,
    })).sort((a, b) => b.average - a.average);

    return { globalAverage, byClass };
  }, [oralGrades, selectedClasses, classes]);

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

  // Generate PDF report
  const handleGenerateReport = () => {
    if (selectedClasses.length === 0) return;

    setIsGeneratingReport(true);
    try {
      // Filter classes and students by selection
      const selectedClassObjects = classes.filter(c => selectedClasses.includes(c.id));
      const selectedStudents = students.filter(s => selectedClasses.includes(s.class_id));
      const selectedEvents = events.map(e => ({
        type: e.type,
        class_id: e.class_id,
        student_id: e.student_id,
      }));

      // Get current school year
      const now = new Date();
      const schoolYear = now.getMonth() >= 8
        ? `${now.getFullYear()}/${now.getFullYear() + 1}`
        : `${now.getFullYear() - 1}/${now.getFullYear()}`;

      // Estimate trimester from current month
      const month = now.getMonth();
      let trimester = 1;
      if (month >= 0 && month <= 2) trimester = 2;
      else if (month >= 3 && month <= 5) trimester = 3;

      const reportData = prepareReportData(
        selectedClassObjects,
        selectedEvents,
        selectedStudents,
        genderStats,
        trimester,
        schoolYear,
      );

      generateAnalysisReport(reportData);
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Erreur lors de la generation du rapport');
    } finally {
      setIsGeneratingReport(false);
    }
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Analyses</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Statistiques detaillees de vos classes
            </p>
          </div>
          {selectedClasses.length > 0 && (
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50"
            >
              <span>📄</span>
              {isGeneratingReport ? 'Generation...' : 'Generer rapport PDF'}
            </button>
          )}
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
                label="Malus"
                value={totals.malus}
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
                value={`${totals.participations + totals.malus > 0 ? Math.round((totals.participations / (totals.participations + totals.malus)) * 100) : 0}%`}
                color="var(--color-primary)"
                icon="%"
              />
            </div>

            {/* Oral grades section */}
            {oralStats.globalAverage !== null && (
              <div
                className="bg-[var(--color-surface)] p-5"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                  Notes d'oral
                </h3>
                <div className="flex gap-4">
                  {/* Left: Global average */}
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-secondary)] shrink-0" style={{ borderRadius: 'var(--radius-lg)' }}>
                    <div
                      className="w-14 h-14 flex items-center justify-center text-lg font-bold text-white"
                      style={{
                        background: oralStats.globalAverage >= 3.5 ? COLORS.participation : oralStats.globalAverage >= 2.5 ? COLORS.absence : COLORS.bavardage,
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      {oralStats.globalAverage.toFixed(1)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">Moyenne /5</div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {oralStats.byClass.reduce((sum, c) => sum + c.count, 0)} eleves
                      </div>
                    </div>
                  </div>

                  {/* Right: By class - vertical scrollable (max 3 visible) */}
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: '120px' }}>
                    <div className="space-y-2">
                      {oralStats.byClass.map((cls, idx) => (
                        <div
                          key={cls.class_id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-secondary)]"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        >
                          <span
                            className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{
                              backgroundColor: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#cd7f32' : COLORS.oral,
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-[var(--color-text)] flex-1">{cls.class_name}</span>
                          <span
                            className="text-sm font-bold px-1.5 py-0.5"
                            style={{
                              color: cls.average >= 3.5 ? COLORS.participation : cls.average >= 2.5 ? COLORS.absence : COLORS.bavardage,
                              backgroundColor: cls.average >= 3.5 ? `${COLORS.participation}20` : cls.average >= 2.5 ? `${COLORS.absence}20` : `${COLORS.bavardage}20`,
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {cls.average.toFixed(1)}/5
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Gender comparison card */}
            {genderStats && (genderStats.garcons.count > 0 || genderStats.filles.count > 0) && (
              <div
                className="bg-[var(--color-surface)] p-5"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    Comparaison Filles / Garcons
                  </h3>
                  <div className="flex gap-1">
                    {(['participations', 'malus', 'absences'] as const).map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setGenderMetric(metric)}
                        className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                          genderMetric === metric
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                        }`}
                      >
                        {metric === 'participations' ? 'Implic.' : metric === 'malus' ? 'Malus' : 'Absences'}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={[
                      {
                        name: `Filles (${genderStats.filles.count})`,
                        value: genderStats.filles.count > 0 ? +(genderStats.filles[genderMetric] / genderStats.filles.count).toFixed(1) : 0,
                      },
                      {
                        name: `Garcons (${genderStats.garcons.count})`,
                        value: genderStats.garcons.count > 0 ? +(genderStats.garcons[genderMetric] / genderStats.garcons.count).toFixed(1) : 0,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="name"
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
                      formatter={(value) => [`${value} / élève`]}
                    />
                    <Bar
                      dataKey="value"
                      name={genderMetric === 'participations' ? 'Participations' : genderMetric === 'malus' ? 'Malus' : 'Absences'}
                      fill={genderMetric === 'participations' ? COLORS.participation : genderMetric === 'malus' ? COLORS.bavardage : COLORS.absence}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

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
                        dataKey="malus"
                        name="Malus"
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
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
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
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={classStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="class_name"
                      stroke="var(--color-text-tertiary)"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="var(--color-text-tertiary)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="participations" name="Participations" fill={COLORS.participation} />
                    <Bar dataKey="malus" name="Malus" fill={COLORS.bavardage} />
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
                  Classement par ratio participation/malus
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
                        Malus
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
                            {cls.malus}
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
}: {
  label: string;
  value: number | string;
  color: string;
  icon: string;
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
