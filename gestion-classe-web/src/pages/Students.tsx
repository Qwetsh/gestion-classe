import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Student {
  id: string;
  pseudo: string;
  class_id: string;
  class_name: string;
  created_at: string;
}

interface Event {
  id: string;
  student_id: string;
  session_id: string;
  type: string;
  subtype: string | null;
  note: string | null;
  photo_path: string | null;
  timestamp: string;
  session_date: string;
  class_name: string;
}

interface SessionEvolutionData {
  sessionDate: string;
  label: string;
  participation: number;
  bavardage: number;
}

interface TrimesterSettings {
  current_trimester: number;
  school_year: string;
}

interface ClassConfig {
  class_id: string;
  target_participations: number;
  total_sessions_expected: number;
  bavardage_penalty: boolean;
  base_grade: number | null;
}

// TrimesterBoundary type inlined where needed

interface ArchivedGrade {
  trimester: number;
  school_year: string;
  participations: number;
  absences: number;
  target_participations: number;
  adjusted_target: number;
  grade: number;
  bonus: number;
  archived_at: string;
}

interface OralEvaluation {
  id: string;
  student_id: string;
  class_id: string;
  user_id: string;
  trimester: number;
  school_year: string;
  grade: number;
  evaluated_at: string;
}

const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Tres bien',
};

interface ManualParticipation {
  id: string;
  student_id: string;
  trimester: number;
  school_year: string;
  count: number;
  reason: string | null;
  created_at: string;
}

interface StudentGrade {
  student: Student;
  participations: number;
  manualParticipations: number;
  totalParticipations: number;
  bavardages: number;
  effectiveParticipations: number;
  absences: number;
  targetParticipations: number;
  totalSessionsExpected: number;
  adjustedTarget: number;
  bavardagePenalty: boolean;
  baseGrade: number | null;
  grade: number;
  bonus: number;
  events: Event[];
  manualParticipationsList: ManualParticipation[];
  archivedGrades: ArchivedGrade[];
  oralEvaluation: OralEvaluation | null;
}

interface ClassFilter {
  id: string;
  name: string;
}

interface ClassStats {
  id: string;
  name: string;
  studentCount: number;
  averageGrade: number;
  totalParticipations: number;
  totalAbsences: number;
}

type SortField = 'pseudo' | 'grade' | 'participations' | 'bonus';
type SortOrder = 'asc' | 'desc';

export function Students() {
  const { user } = useAuth();
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [classConfigs, setClassConfigs] = useState<Map<string, ClassConfig>>(new Map());
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trimester state
  const [trimesterSettings, setTrimesterSettings] = useState<TrimesterSettings>({
    current_trimester: 1,
    school_year: getCurrentSchoolYear(),
  });

  // Sort state
  const [sortField, setSortField] = useState<SortField>('pseudo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Search state (with debounce)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search query (300ms delay)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showNextTrimesterModal, setShowNextTrimesterModal] = useState(false);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentGrade | null>(null);
  const [configClassId, setConfigClassId] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState(15);
  const [configSessions, setConfigSessions] = useState(60);
  const [configBavardagePenalty, setConfigBavardagePenalty] = useState(false);
  const [configBaseGrade, setConfigBaseGrade] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Manual participation modal state
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualReason, setManualReason] = useState('');
  const [manualCount, setManualCount] = useState(1);

  // Sidebar collapsed state for mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 8) {
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  }

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
    // Load trimester settings
    const { data: settingsData } = await supabase
      .from('trimester_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsData) {
      setTrimesterSettings({
        current_trimester: settingsData.current_trimester,
        school_year: settingsData.school_year,
      });
    } else {
      const defaultSettings = {
        user_id: user.id,
        current_trimester: 1,
        school_year: getCurrentSchoolYear(),
      };
      await supabase.from('trimester_settings').insert(defaultSettings);
      setTrimesterSettings({
        current_trimester: defaultSettings.current_trimester,
        school_year: defaultSettings.school_year,
      });
    }

    // Load trimester boundaries
    const { data: boundariesData } = await supabase
      .from('trimester_boundaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('school_year', settingsData?.school_year || getCurrentSchoolYear())
      .order('trimester');

    const currentBoundary = boundariesData?.find(
      b => b.trimester === (settingsData?.current_trimester || 1)
    );
    if (!currentBoundary) {
      await supabase.from('trimester_boundaries').insert({
        user_id: user.id,
        trimester: settingsData?.current_trimester || 1,
        school_year: settingsData?.school_year || getCurrentSchoolYear(),
        started_at: new Date().toISOString(),
      });
    }

    // Load classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    setClasses(classesData || []);

    // Auto-select first class if none selected (use ref to avoid dependency)
    if (classesData && classesData.length > 0) {
      setSelectedClassId(prev => prev || classesData[0].id);
    }

    // Load class configs
    const { data: configsData } = await supabase
      .from('class_trimester_config')
      .select('*');

    const configMap = new Map<string, ClassConfig>();
    (configsData || []).forEach(c => {
      configMap.set(c.class_id, {
        class_id: c.class_id,
        target_participations: c.target_participations,
        total_sessions_expected: c.total_sessions_expected,
        bavardage_penalty: c.bavardage_penalty ?? false,
        base_grade: c.base_grade ?? null,
      });
    });
    setClassConfigs(configMap);

    // Load students
    const { data: studentsData } = await supabase
      .from('students')
      .select(`
        id,
        pseudo,
        class_id,
        created_at,
        classes (name)
      `)
      .eq('user_id', user.id)
      .order('pseudo');

    if (!studentsData) {
      setStudentGrades([]);
      setIsLoading(false);
      return;
    }

    // Get current trimester boundary
    const currentTrimesterBoundary = boundariesData?.find(
      b => b.trimester === (settingsData?.current_trimester || 1) &&
           b.school_year === (settingsData?.school_year || getCurrentSchoolYear())
    );
    const trimesterStartDate = currentTrimesterBoundary?.started_at || new Date(0).toISOString();

    // Load events for current trimester only
    const studentIds = studentsData.map(s => s.id);
    let eventsQuery = supabase
      .from('events')
      .select(`
        id,
        student_id,
        session_id,
        type,
        subtype,
        note,
        photo_path,
        timestamp,
        sessions (
          started_at,
          classes (name)
        )
      `)
      .in('student_id', studentIds)
      .gte('timestamp', trimesterStartDate)
      .order('timestamp', { ascending: false });

    const { data: eventsData } = await eventsQuery;

    // Load manual participations for current trimester
    const currentTrimester = settingsData?.current_trimester || 1;
    const currentSchoolYear = settingsData?.school_year || getCurrentSchoolYear();

    const { data: manualParticipationsData } = await supabase
      .from('manual_participations')
      .select('*')
      .in('student_id', studentIds)
      .eq('trimester', currentTrimester)
      .eq('school_year', currentSchoolYear)
      .order('created_at', { ascending: false });

    // Load archived grades for all students
    const { data: archivedGradesData } = await supabase
      .from('trimester_grades')
      .select('*')
      .in('student_id', studentIds)
      .order('school_year', { ascending: false });

    // Load oral evaluations for current trimester
    const { data: oralEvaluationsData } = await supabase
      .from('oral_evaluations')
      .select('*')
      .in('student_id', studentIds)
      .eq('trimester', currentTrimester)
      .eq('school_year', currentSchoolYear);

    // Build grades for each student
    const grades: StudentGrade[] = studentsData.map(student => {
      const studentEvents = (eventsData || [])
        .filter(e => e.student_id === student.id)
        .map(e => ({
          id: e.id,
          student_id: e.student_id,
          session_id: e.session_id,
          type: e.type,
          subtype: e.subtype,
          note: e.note,
          photo_path: e.photo_path,
          timestamp: e.timestamp,
          session_date: (e.sessions as any)?.started_at || e.timestamp,
          class_name: (e.sessions as any)?.classes?.name || 'Classe inconnue',
        }));

      const participations = studentEvents.filter(e => e.type === 'participation').length;
      const bavardages = studentEvents.filter(e => e.type === 'bavardage').length;
      const absences = studentEvents.filter(e => e.type === 'absence').length;

      const studentManualParticipations = (manualParticipationsData || [])
        .filter(mp => mp.student_id === student.id);
      const manualParticipationsCount = studentManualParticipations.reduce((sum, mp) => sum + mp.count, 0);
      const totalParticipations = participations + manualParticipationsCount;

      const config = configMap.get(student.class_id);
      const targetParticipations = config?.target_participations || 15;
      const totalSessionsExpected = config?.total_sessions_expected || 60;
      const bavardagePenalty = config?.bavardage_penalty ?? false;
      const baseGrade = config?.base_grade ?? null;

      const effectiveParticipations = bavardagePenalty
        ? Math.max(0, totalParticipations - bavardages)
        : totalParticipations;

      const reductionPerAbsence = targetParticipations / totalSessionsExpected;
      const adjustedTarget = Math.max(1, targetParticipations - (absences * reductionPerAbsence));

      // Calculate grade based on mode: base_grade or target-based
      let rawGrade: number;
      let grade: number;
      let bonus: number;

      if (baseGrade !== null && baseGrade > 0) {
        // Mode "note de base" : note = base + participations - bavardages (si pénalité active)
        const modifier = bavardagePenalty
          ? totalParticipations - bavardages
          : totalParticipations;
        rawGrade = baseGrade + modifier;
        grade = Math.min(20, Math.max(0, rawGrade));
        bonus = rawGrade > 20 ? rawGrade - 20 : 0;
      } else {
        // Mode "objectif" : note = (participations / objectif) * 20
        rawGrade = (effectiveParticipations / adjustedTarget) * 20;
        grade = Math.min(20, Math.max(0, rawGrade));
        bonus = rawGrade > 20 ? effectiveParticipations - adjustedTarget : 0;
      }

      const studentArchivedGrades = (archivedGradesData || [])
        .filter(g => g.student_id === student.id)
        .map(g => ({
          trimester: g.trimester,
          school_year: g.school_year,
          participations: g.participations,
          absences: g.absences,
          target_participations: g.target_participations,
          adjusted_target: parseFloat(g.adjusted_target),
          grade: parseFloat(g.grade),
          bonus: parseFloat(g.bonus),
          archived_at: g.archived_at,
        }));

      const studentOralEvaluation = (oralEvaluationsData || [])
        .find(oe => oe.student_id === student.id) || null;

      return {
        student: {
          id: student.id,
          pseudo: student.pseudo,
          class_id: student.class_id,
          class_name: (student.classes as any)?.name || 'Classe inconnue',
          created_at: student.created_at,
        },
        participations,
        manualParticipations: manualParticipationsCount,
        totalParticipations,
        bavardages,
        effectiveParticipations,
        absences,
        targetParticipations,
        totalSessionsExpected,
        adjustedTarget,
        bavardagePenalty,
        baseGrade,
        grade,
        bonus,
        events: studentEvents,
        manualParticipationsList: studentManualParticipations,
        archivedGrades: studentArchivedGrades,
        oralEvaluation: studentOralEvaluation,
      };
    });

    setStudentGrades(grades);
    } catch (err) {
      console.error('Error loading students data:', err);
      setError('Erreur lors du chargement des donnees.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate stats for each class
  const classStats = useMemo((): ClassStats[] => {
    return classes.map(cls => {
      const classStudents = studentGrades.filter(s => s.student.class_id === cls.id);
      const studentCount = classStudents.length;
      const averageGrade = studentCount > 0
        ? classStudents.reduce((sum, s) => sum + s.grade, 0) / studentCount
        : 0;
      const totalParticipations = classStudents.reduce((sum, s) => sum + s.totalParticipations, 0);
      const totalAbsences = classStudents.reduce((sum, s) => sum + s.absences, 0);

      return {
        id: cls.id,
        name: cls.name,
        studentCount,
        averageGrade,
        totalParticipations,
        totalAbsences,
      };
    });
  }, [classes, studentGrades]);

  // Filter and sort students for selected class
  const filteredAndSortedGrades = useMemo(() => {
    let filtered = studentGrades;

    if (selectedClassId) {
      filtered = filtered.filter(s => s.student.class_id === selectedClassId);
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.student.pseudo.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'pseudo':
          comparison = a.student.pseudo.localeCompare(b.student.pseudo);
          break;
        case 'grade':
          comparison = a.grade - b.grade;
          break;
        case 'participations':
          comparison = a.totalParticipations - b.totalParticipations;
          break;
        case 'bonus':
          comparison = a.bonus - b.bonus;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [studentGrades, selectedClassId, debouncedSearchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'pseudo' ? 'asc' : 'desc');
    }
  };

  const openConfigModal = (classId: string) => {
    const config = classConfigs.get(classId);
    setConfigClassId(classId);
    setConfigTarget(config?.target_participations || 15);
    setConfigSessions(config?.total_sessions_expected || 60);
    setConfigBavardagePenalty(config?.bavardage_penalty ?? false);
    setConfigBaseGrade(config?.base_grade ?? null);
    setShowConfigModal(true);
  };

  const saveClassConfig = async () => {
    if (!configClassId) return;
    setIsSaving(true);

    try {
      const existing = classConfigs.get(configClassId);
      if (existing) {
        const { error } = await supabase
          .from('class_trimester_config')
          .update({
            target_participations: configTarget,
            total_sessions_expected: configSessions,
            bavardage_penalty: configBavardagePenalty,
            base_grade: configBaseGrade,
            updated_at: new Date().toISOString(),
          })
          .eq('class_id', configClassId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_trimester_config').insert({
          class_id: configClassId,
          target_participations: configTarget,
          total_sessions_expected: configSessions,
          bavardage_penalty: configBavardagePenalty,
          base_grade: configBaseGrade,
        });
        if (error) throw error;
      }

      setShowConfigModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Erreur lors de la sauvegarde de la configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextTrimester = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const gradesToArchive = studentGrades.map(sg => ({
        student_id: sg.student.id,
        class_id: sg.student.class_id,
        user_id: user.id,
        trimester: trimesterSettings.current_trimester,
        school_year: trimesterSettings.school_year,
        participations: sg.totalParticipations,
        absences: sg.absences,
        target_participations: sg.targetParticipations,
        adjusted_target: sg.adjustedTarget,
        grade: sg.grade,
        bonus: sg.bonus,
      }));

      if (gradesToArchive.length > 0) {
        const { error: archiveError } = await supabase.from('trimester_grades').upsert(gradesToArchive, {
          onConflict: 'student_id,trimester,school_year',
        });
        if (archiveError) throw archiveError;
      }

      let nextTrimester = trimesterSettings.current_trimester + 1;
      let nextSchoolYear = trimesterSettings.school_year;

      if (nextTrimester > 3) {
        nextTrimester = 1;
        const [startYear] = trimesterSettings.school_year.split('-').map(Number);
        nextSchoolYear = `${startYear + 1}-${startYear + 2}`;
      }

      const { error: settingsError } = await supabase
        .from('trimester_settings')
        .update({
          current_trimester: nextTrimester,
          school_year: nextSchoolYear,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (settingsError) throw settingsError;

      const { error: boundaryError } = await supabase.from('trimester_boundaries').insert({
        user_id: user.id,
        trimester: nextTrimester,
        school_year: nextSchoolYear,
        started_at: new Date().toISOString(),
      });
      if (boundaryError) throw boundaryError;

      setShowNextTrimesterModal(false);
      loadData();
    } catch (error) {
      console.error('Error advancing trimester:', error);
      alert('Erreur lors du passage au trimestre suivant.');
    } finally {
      setIsSaving(false);
    }
  };

  const openStudentDetail = (studentGrade: StudentGrade) => {
    setSelectedStudentForDetail(studentGrade);
    setShowStudentDetailModal(true);
  };

  const openAddManualModal = () => {
    setManualReason('');
    setManualCount(1);
    setShowAddManualModal(true);
  };

  const addManualParticipation = async () => {
    if (!user || !selectedStudentForDetail) return;
    setIsSaving(true);

    try {
      await supabase.from('manual_participations').insert({
        student_id: selectedStudentForDetail.student.id,
        user_id: user.id,
        trimester: trimesterSettings.current_trimester,
        school_year: trimesterSettings.school_year,
        count: manualCount,
        reason: manualReason.trim() || null,
      });

      setShowAddManualModal(false);
      setShowStudentDetailModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to add manual participation:', error);
      alert('Erreur lors de l\'ajout de l\'implication manuelle.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteManualParticipation = async (mpId: string) => {
    if (!confirm('Supprimer cette implication manuelle ?')) return;

    try {
      const { error } = await supabase.from('manual_participations').delete().eq('id', mpId);
      if (error) throw error;
      loadData();
      setShowStudentDetailModal(false);
    } catch (error) {
      console.error('Failed to delete manual participation:', error);
      alert('Erreur lors de la suppression.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 16) return 'text-green-600';
    if (grade >= 12) return 'text-blue-600';
    if (grade >= 8) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBgColor = (grade: number) => {
    if (grade >= 16) return 'bg-green-100';
    if (grade >= 12) return 'bg-blue-100';
    if (grade >= 8) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getGradeBorderColor = (grade: number) => {
    if (grade >= 16) return 'border-green-300';
    if (grade >= 12) return 'border-blue-300';
    if (grade >= 8) return 'border-orange-300';
    return 'border-red-300';
  };

  const getEventTypeLabel = (type: string, subtype: string | null) => {
    const labels: Record<string, string> = {
      participation: 'Implication',
      bavardage: 'Bavardage',
      absence: 'Absence',
      remarque: 'Remarque',
      sortie: 'Sortie',
    };
    const subtypeLabels: Record<string, string> = {
      infirmerie: 'Infirmerie',
      toilettes: 'Toilettes',
      convocation: 'Convocation',
      exclusion: 'Exclusion',
    };
    const label = labels[type] || type;
    if (subtype && subtypeLabels[subtype]) {
      return `${label} (${subtypeLabels[subtype]})`;
    }
    return label;
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      participation: 'bg-green-100 text-green-700',
      bavardage: 'bg-orange-100 text-orange-700',
      absence: 'bg-red-100 text-red-700',
      remarque: 'bg-blue-100 text-blue-700',
      sortie: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // Calculate session-by-session evolution data for chart
  const getSessionEvolution = (events: Event[]): SessionEvolutionData[] => {
    const sessions: Map<string, { date: string; participation: number; bavardage: number }> = new Map();

    // Group events by session
    events.forEach(event => {
      const sessionId = event.session_id;
      const sessionDate = event.session_date;

      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { date: sessionDate, participation: 0, bavardage: 0 });
      }

      const sessionData = sessions.get(sessionId)!;
      if (event.type === 'participation') sessionData.participation++;
      if (event.type === 'bavardage') sessionData.bavardage++;
    });

    // Sort by date and take last 12 sessions
    const sortedSessions = Array.from(sessions.entries())
      .sort((a, b) => new Date(a[1].date).getTime() - new Date(b[1].date).getTime())
      .slice(-12);

    return sortedSessions.map(([, data]) => ({
      sessionDate: data.date,
      label: new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      participation: data.participation,
      bavardage: data.bavardage,
    }));
  };

  // Get remarks with photos
  const getRemarks = (events: Event[]) => {
    return events.filter(e => e.type === 'remarque');
  };

  const selectedClassStats = classStats.find(c => c.id === selectedClassId);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-[var(--color-text-secondary)]">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Error banner */}
      {error && (
        <div
          className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 mb-4 flex items-center justify-between"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-[var(--color-error)] hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Notes d'implication</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Trimestre {trimesterSettings.current_trimester} - {trimesterSettings.school_year}
            </p>
          </div>
          <button
            onClick={() => setShowNextTrimesterModal(true)}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors whitespace-nowrap"
          >
            Passer au trimestre suivant
          </button>
        </div>

        {/* Main content - Two columns */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Sidebar - Classes */}
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} flex-shrink-0 bg-[var(--color-surface)] rounded-xl overflow-hidden flex flex-col transition-all duration-200`}>
            {/* Sidebar header */}
            <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
              {!sidebarCollapsed && (
                <h2 className="font-semibold text-[var(--color-text)]">Classes</h2>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 hover:bg-[var(--color-background)] rounded text-[var(--color-text-secondary)]"
                title={sidebarCollapsed ? 'Agrandir' : 'Reduire'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>

            {/* Classes list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {classStats.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`w-full text-left rounded-lg transition-colors ${
                    selectedClassId === cls.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'hover:bg-[var(--color-background)] text-[var(--color-text)]'
                  } ${sidebarCollapsed ? 'p-2' : 'p-3'}`}
                >
                  {sidebarCollapsed ? (
                    <div className="text-center font-medium text-sm" title={cls.name}>
                      {cls.name.substring(0, 2)}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{cls.name}</span>
                        <span className={`text-xs ${selectedClassId === cls.id ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'}`}>
                          {cls.studentCount}
                        </span>
                      </div>
                      <div className={`text-sm mt-1 ${selectedClassId === cls.id ? 'text-white/80' : 'text-[var(--color-text-secondary)]'}`}>
                        Moy: {cls.averageGrade.toFixed(1)}/20
                      </div>
                    </>
                  )}
                </button>
              ))}

              {classes.length === 0 && !sidebarCollapsed && (
                <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                  Aucune classe
                </div>
              )}
            </div>

            {/* Sidebar footer - Stats */}
            {!sidebarCollapsed && (
              <div className="p-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
                <div>{studentGrades.length} eleves au total</div>
              </div>
            )}
          </div>

          {/* Main content - Students */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)] rounded-xl overflow-hidden">
            {selectedClassId ? (
              <>
                {/* Class header */}
                <div className="p-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {selectedClassStats?.name}
                      </h2>
                      <button
                        onClick={() => openConfigModal(selectedClassId)}
                        className="p-1.5 hover:bg-[var(--color-background)] rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                        title="Configurer"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className={`text-2xl font-bold ${getGradeColor(selectedClassStats?.averageGrade || 0)}`}>
                      {selectedClassStats?.averageGrade.toFixed(1)}/20
                    </div>
                  </div>

                  {/* Search and sort */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Rechercher un eleve..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex gap-1">
                      {(['pseudo', 'grade', 'participations', 'bonus'] as SortField[]).map((field) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            sortField === field
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          {field === 'pseudo' ? 'Nom' : field === 'grade' ? 'Note' : field === 'participations' ? 'Part.' : 'Bonus'}
                          {sortField === field && (
                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Class config summary */}
                  {classConfigs.get(selectedClassId) && (
                    <div className="mt-3 text-sm text-[var(--color-text-tertiary)]">
                      {classConfigs.get(selectedClassId)?.base_grade !== null ? (
                        <>
                          Note de base: {classConfigs.get(selectedClassId)?.base_grade}/20
                          {classConfigs.get(selectedClassId)?.bavardage_penalty && ' · Penalite bavardages active'}
                        </>
                      ) : (
                        <>
                          Objectif: {classConfigs.get(selectedClassId)?.target_participations} implications
                          {classConfigs.get(selectedClassId)?.bavardage_penalty && ' · Penalite bavardages active'}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Students grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {filteredAndSortedGrades.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-4">👥</div>
                      <h3 className="text-lg font-medium text-[var(--color-text)]">
                        {searchQuery ? 'Aucun resultat' : 'Aucun eleve'}
                      </h3>
                      <p className="text-[var(--color-text-tertiary)] mt-2">
                        {searchQuery ? 'Essayez une autre recherche' : 'Ajoutez des eleves dans la section Classes'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredAndSortedGrades.map((sg) => (
                        <button
                          key={sg.student.id}
                          onClick={() => openStudentDetail(sg)}
                          className={`p-4 rounded-xl border-2 ${getGradeBorderColor(sg.grade)} ${getGradeBgColor(sg.grade)}/30 hover:${getGradeBgColor(sg.grade)}/50 transition-all text-left group`}
                        >
                          {/* Grade circle */}
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-12 h-12 rounded-full ${getGradeBgColor(sg.grade)} flex flex-col items-center justify-center`}>
                              <span className={`text-lg font-bold ${getGradeColor(sg.grade)}`}>
                                {sg.grade.toFixed(1)}
                              </span>
                            </div>
                            {sg.bonus > 0 && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                +{sg.bonus.toFixed(1)}
                              </span>
                            )}
                          </div>

                          {/* Student name */}
                          <div className="font-medium text-[var(--color-text)] truncate mb-2">
                            {sg.student.pseudo}
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-600 font-medium">
                              {sg.bavardagePenalty ? sg.effectiveParticipations : sg.totalParticipations}/{Math.round(sg.adjustedTarget)}
                            </span>
                            {sg.bavardagePenalty && sg.bavardages > 0 && (
                              <span className="text-orange-600">-{sg.bavardages}</span>
                            )}
                            {sg.absences > 0 && (
                              <span className="text-red-600">{sg.absences} abs</span>
                            )}
                            {sg.oralEvaluation && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                Oral: {sg.oralEvaluation.grade}/5
                              </span>
                            )}
                          </div>

                          {/* Hover indicator */}
                          <div className="mt-2 text-xs text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                            Cliquer pour details
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer stats */}
                {filteredAndSortedGrades.length > 0 && (
                  <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-background)]">
                    <div className="flex flex-wrap gap-6 justify-center text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-[var(--color-primary)]">
                          {filteredAndSortedGrades.length}
                        </div>
                        <div className="text-[var(--color-text-tertiary)]">eleves</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          {filteredAndSortedGrades.reduce((sum, s) => sum + s.totalParticipations, 0)}
                        </div>
                        <div className="text-[var(--color-text-tertiary)]">implications</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">
                          {filteredAndSortedGrades.reduce((sum, s) => sum + s.absences, 0)}
                        </div>
                        <div className="text-[var(--color-text-tertiary)]">absences</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600">
                          {filteredAndSortedGrades.reduce((sum, s) => sum + s.bonus, 0).toFixed(1)}
                        </div>
                        <div className="text-[var(--color-text-tertiary)]">bonus total</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
                <div className="text-center">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-medium text-[var(--color-text)]">Selectionnez une classe</h3>
                  <p className="mt-2">Choisissez une classe dans la liste a gauche</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {showConfigModal && configClassId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Configuration - {classes.find(c => c.id === configClassId)?.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Implications pour avoir 20/20
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={configTarget}
                  onChange={(e) => setConfigTarget(parseInt(e.target.value) || 15)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Nombre de seances prevues par trimestre
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={configSessions}
                  onChange={(e) => setConfigSessions(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Reduction par absence: {(configTarget / configSessions).toFixed(2)} implication
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--color-background)] rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)]">
                    Penalite bavardages
                  </label>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    1 bavardage = -1 implication
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigBavardagePenalty(!configBavardagePenalty)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    configBavardagePenalty ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      configBavardagePenalty ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Note de base */}
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-indigo-900">
                      Mode "Note de base"
                    </label>
                    <p className="text-xs text-indigo-600">
                      Chaque eleve commence avec cette note
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigBaseGrade(configBaseGrade === null ? 10 : null)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      configBaseGrade !== null ? 'bg-indigo-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        configBaseGrade !== null ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {configBaseGrade !== null && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-indigo-700 mb-1">
                      Note de depart (/20)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={configBaseGrade}
                      onChange={(e) => setConfigBaseGrade(parseFloat(e.target.value) || 10)}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-white text-[var(--color-text)] text-sm"
                    />
                    <p className="text-xs text-indigo-600 mt-2">
                      Note = {configBaseGrade} + participations {configBavardagePenalty ? '- bavardages' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Annuler
              </button>
              <button
                onClick={saveClassConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Next Trimester Modal */}
      {showNextTrimesterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Passer au trimestre suivant
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Attention :</strong> Cette action va archiver les notes actuelles
                et reinitialiser les compteurs d'implication pour le nouveau trimestre.
              </p>
            </div>

            <p className="text-[var(--color-text-secondary)] mb-4">
              Trimestre actuel: <strong>{trimesterSettings.current_trimester}</strong> ({trimesterSettings.school_year})
              <br />
              Prochain trimestre: <strong>
                {trimesterSettings.current_trimester === 3 ? '1' : trimesterSettings.current_trimester + 1}
              </strong>
              {trimesterSettings.current_trimester === 3 && (
                <span className="text-[var(--color-text-tertiary)]">
                  {' '}(nouvelle annee scolaire)
                </span>
              )}
            </p>

            <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
              {studentGrades.length} eleve{studentGrades.length > 1 ? 's' : ''} seront archives.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNextTrimesterModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Annuler
              </button>
              <button
                onClick={handleNextTrimester}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
              >
                {isSaving ? 'Archivage...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudentForDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--color-text)]">
                    {selectedStudentForDetail.student.pseudo}
                  </h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    {selectedStudentForDetail.student.class_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowStudentDetailModal(false)}
                  className="p-2 hover:bg-[var(--color-background)] rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Current Grade Card */}
              <div className={`${getGradeBgColor(selectedStudentForDetail.grade)} rounded-xl p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Trimestre {trimesterSettings.current_trimester}
                    </p>
                    <p className={`text-4xl font-bold ${getGradeColor(selectedStudentForDetail.grade)}`}>
                      {selectedStudentForDetail.grade.toFixed(2)}/20
                    </p>
                    {selectedStudentForDetail.bonus > 0 && (
                      <p className="text-sm text-yellow-700 mt-1">
                        +{selectedStudentForDetail.bonus.toFixed(1)} points bonus a redistribuer
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">
                      <span className="text-green-600 font-semibold">{selectedStudentForDetail.totalParticipations}</span>
                      <span className="text-[var(--color-text-tertiary)]"> implications totales</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      ({selectedStudentForDetail.participations} seance + {selectedStudentForDetail.manualParticipations} manuelles)
                    </p>
                    {selectedStudentForDetail.bavardages > 0 && (
                      <p className="text-sm">
                        <span className="text-orange-600 font-semibold">{selectedStudentForDetail.bavardages}</span>
                        <span className="text-[var(--color-text-tertiary)]"> bavardages</span>
                        {selectedStudentForDetail.bavardagePenalty && (
                          <span className="text-orange-600"> (-{selectedStudentForDetail.bavardages})</span>
                        )}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="text-red-600 font-semibold">{selectedStudentForDetail.absences}</span>
                      <span className="text-[var(--color-text-tertiary)]"> absences</span>
                    </p>
                    {selectedStudentForDetail.baseGrade === null && (
                      <p className="text-sm text-[var(--color-text-tertiary)]">
                        Objectif ajuste: {selectedStudentForDetail.adjustedTarget.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="mt-4 pt-4 border-t border-black/10 text-sm">
                  {selectedStudentForDetail.baseGrade !== null ? (
                    <>
                      <p className="text-[var(--color-text-secondary)]">
                        <strong>Mode note de base:</strong> {selectedStudentForDetail.baseGrade}/20
                      </p>
                      <p className="text-[var(--color-text-secondary)]">
                        Note = {selectedStudentForDetail.baseGrade} + {selectedStudentForDetail.totalParticipations} part.
                        {selectedStudentForDetail.bavardagePenalty && selectedStudentForDetail.bavardages > 0 && (
                          <> - {selectedStudentForDetail.bavardages} bav.</>
                        )}
                        {' '}= <strong>{(selectedStudentForDetail.baseGrade + (selectedStudentForDetail.bavardagePenalty ? selectedStudentForDetail.totalParticipations - selectedStudentForDetail.bavardages : selectedStudentForDetail.totalParticipations)).toFixed(1)}</strong>
                        {selectedStudentForDetail.grade === 20 && <> → plafonne a <strong>20/20</strong></>}
                        {selectedStudentForDetail.grade === 0 && <> → minimum <strong>0/20</strong></>}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[var(--color-text-secondary)]">
                        <strong>Calcul:</strong> Objectif de base = {selectedStudentForDetail.targetParticipations}
                        {selectedStudentForDetail.absences > 0 && (
                          <> - ({selectedStudentForDetail.absences} abs × {(selectedStudentForDetail.targetParticipations / selectedStudentForDetail.totalSessionsExpected).toFixed(2)}) = {selectedStudentForDetail.adjustedTarget.toFixed(1)}</>
                        )}
                      </p>
                      {selectedStudentForDetail.bavardagePenalty && selectedStudentForDetail.bavardages > 0 && (
                        <p className="text-[var(--color-text-secondary)]">
                          Implications effectives = {selectedStudentForDetail.totalParticipations} - {selectedStudentForDetail.bavardages} bavardages = <strong>{selectedStudentForDetail.effectiveParticipations}</strong>
                        </p>
                      )}
                      <p className="text-[var(--color-text-secondary)]">
                        Note = ({selectedStudentForDetail.effectiveParticipations} / {selectedStudentForDetail.adjustedTarget.toFixed(1)}) × 20 = {((selectedStudentForDetail.effectiveParticipations / selectedStudentForDetail.adjustedTarget) * 20).toFixed(2)}
                        {selectedStudentForDetail.grade === 20 && <> → plafonne a <strong>20/20</strong></>}
                        {selectedStudentForDetail.grade === 0 && <> → minimum <strong>0/20</strong></>}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">+{selectedStudentForDetail.participations}</div>
                  <div className="text-xs text-green-700">Participations</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">-{selectedStudentForDetail.bavardages}</div>
                  <div className="text-xs text-orange-700">Bavardages</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{selectedStudentForDetail.absences}</div>
                  <div className="text-xs text-red-700">Absences</div>
                </div>
                <div className={`rounded-xl p-4 text-center ${
                  (selectedStudentForDetail.participations - selectedStudentForDetail.bavardages) >= 0
                    ? 'bg-green-100'
                    : 'bg-orange-100'
                }`}>
                  <div className={`text-2xl font-bold ${
                    (selectedStudentForDetail.participations - selectedStudentForDetail.bavardages) >= 0
                      ? 'text-green-700'
                      : 'text-orange-700'
                  }`}>
                    {selectedStudentForDetail.participations - selectedStudentForDetail.bavardages >= 0 ? '+' : ''}
                    {selectedStudentForDetail.participations - selectedStudentForDetail.bavardages}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">Score global</div>
                </div>
              </div>

              {/* Session Evolution Chart */}
              {selectedStudentForDetail.events.length > 0 && (
                <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
                  <h4 className="font-medium text-[var(--color-text)] mb-4 flex items-center gap-2">
                    <span>📈</span> Evolution par seance
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={getSessionEvolution(selectedStudentForDetail.events)}>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                        axisLine={{ stroke: 'var(--color-border)' }}
                        tickLine={false}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'var(--color-text-tertiary)' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(label) => `Seance du ${label}`}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="participation"
                        name="Participation"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#22c55e' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bavardage"
                        name="Bavardage"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#f97316' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Oral Evaluation Section */}
              <div className="bg-purple-50 rounded-xl p-4">
                <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                  <span>🎤</span> Evaluation orale
                </h4>
                {selectedStudentForDetail.oralEvaluation ? (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-purple-700">
                        {selectedStudentForDetail.oralEvaluation.grade}/5
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-purple-700">
                        {ORAL_GRADE_LABELS[selectedStudentForDetail.oralEvaluation.grade]}
                      </p>
                      <p className="text-sm text-purple-600">
                        Evalue le {formatDate(selectedStudentForDetail.oralEvaluation.evaluated_at)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-purple-600 text-sm">
                    Pas encore evalue ce trimestre
                  </p>
                )}
              </div>

              {/* Remarks Section */}
              {(() => {
                const remarks = getRemarks(selectedStudentForDetail.events);
                if (remarks.length === 0) return null;
                return (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <span>📝</span> Remarques ({remarks.length})
                    </h4>
                    <div className="space-y-3">
                      {remarks.map((remark) => (
                        <div key={remark.id} className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="text-xs text-blue-600 font-medium mb-1">
                            {formatDate(remark.timestamp)}
                          </div>
                          {remark.note && (
                            <p className="text-sm text-[var(--color-text)]">{remark.note}</p>
                          )}
                          {remark.photo_path && (
                            <div className="mt-2">
                              <img
                                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/student-photos/${remark.photo_path}`}
                                alt="Photo remarque"
                                className="rounded-lg max-h-40 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Manual Implications Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-[var(--color-text)]">
                    Implications manuelles ({selectedStudentForDetail.manualParticipations})
                  </h4>
                  <button
                    onClick={openAddManualModal}
                    className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:bg-[var(--color-primary)]/90"
                  >
                    + Ajouter
                  </button>
                </div>
                {selectedStudentForDetail.manualParticipationsList.length === 0 ? (
                  <p className="text-[var(--color-text-tertiary)] text-sm text-center py-3 bg-[var(--color-background)] rounded-lg">
                    Aucune implication manuelle ce trimestre
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudentForDetail.manualParticipationsList.map((mp) => (
                      <div key={mp.id} className="flex items-center justify-between bg-[var(--color-background)] rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-medium">
                            +{mp.count}
                          </span>
                          <div>
                            <span className="text-sm text-[var(--color-text)]">
                              {mp.reason || 'Implication manuelle'}
                            </span>
                            <span className="text-xs text-[var(--color-text-tertiary)] block">
                              {formatDate(mp.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteManualParticipation(mp.id)}
                          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Archived Grades */}
              {selectedStudentForDetail.archivedGrades.length > 0 && (
                <div>
                  <h4 className="font-medium text-[var(--color-text)] mb-3">Historique des notes</h4>
                  <div className="space-y-2">
                    {selectedStudentForDetail.archivedGrades.map((ag, idx) => (
                      <div key={idx} className="bg-[var(--color-background)] rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-[var(--color-text)]">
                            Trimestre {ag.trimester}
                          </span>
                          <span className="text-[var(--color-text-tertiary)] ml-2">
                            ({ag.school_year})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {ag.participations} part. / {ag.absences} abs.
                          </span>
                          <span className={`font-bold ${getGradeColor(ag.grade)}`}>
                            {ag.grade.toFixed(1)}/20
                          </span>
                          {ag.bonus > 0 && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              +{ag.bonus.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Events */}
              <div>
                <h4 className="font-medium text-[var(--color-text)] mb-3">
                  Evenements du trimestre ({selectedStudentForDetail.events.length})
                </h4>
                {selectedStudentForDetail.events.length === 0 ? (
                  <p className="text-[var(--color-text-tertiary)] text-center py-4">
                    Aucun evenement ce trimestre
                  </p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {selectedStudentForDetail.events.map((event) => (
                      <div key={event.id} className="flex items-center gap-3 p-2 hover:bg-[var(--color-background)] rounded">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(event.type)}`}>
                          {getEventTypeLabel(event.type, event.subtype)}
                        </span>
                        <span className="text-sm text-[var(--color-text-tertiary)] flex-1">
                          {formatDateTime(event.timestamp)}
                        </span>
                        {event.note && (
                          <span className="text-sm text-[var(--color-text-secondary)] italic truncate max-w-[200px]">
                            "{event.note}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Implication Modal */}
      {showAddManualModal && selectedStudentForDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Ajouter une implication manuelle
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Pour: <strong>{selectedStudentForDetail.student.pseudo}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Nombre d'implications
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={manualCount}
                  onChange={(e) => setManualCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Raison (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Oral en classe, Expose..."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  maxLength={255}
                  className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowAddManualModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Annuler
              </button>
              <button
                onClick={addManualParticipation}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
              >
                {isSaving ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
