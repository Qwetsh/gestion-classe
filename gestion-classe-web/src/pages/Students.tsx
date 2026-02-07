import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

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
  timestamp: string;
  session_date: string;
  class_name: string;
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
}

interface TrimesterBoundary {
  trimester: number;
  school_year: string;
  started_at: string;
}

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
  grade: number;
  bonus: number;
  events: Event[];
  manualParticipationsList: ManualParticipation[];
  archivedGrades: ArchivedGrade[];
}

interface ClassFilter {
  id: string;
  name: string;
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
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Trimester state
  const [trimesterSettings, setTrimesterSettings] = useState<TrimesterSettings>({
    current_trimester: 1,
    school_year: getCurrentSchoolYear(),
  });
  const [trimesterBoundaries, setTrimesterBoundaries] = useState<TrimesterBoundary[]>([]);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('pseudo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showNextTrimesterModal, setShowNextTrimesterModal] = useState(false);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentGrade | null>(null);
  const [configClassId, setConfigClassId] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState(15);
  const [configSessions, setConfigSessions] = useState(60);
  const [configBavardagePenalty, setConfigBavardagePenalty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manual participation modal state
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualReason, setManualReason] = useState('');
  const [manualCount, setManualCount] = useState(1);

  function getCurrentSchoolYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // School year starts in September
    if (month >= 8) {
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  }

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

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
      // Create default settings
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

    setTrimesterBoundaries(boundariesData || []);

    // Create boundary for current trimester if not exists
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
          timestamp: e.timestamp,
          session_date: (e.sessions as any)?.started_at || e.timestamp,
          class_name: (e.sessions as any)?.classes?.name || 'Classe inconnue',
        }));

      const participations = studentEvents.filter(e => e.type === 'participation').length;
      const bavardages = studentEvents.filter(e => e.type === 'bavardage').length;
      const absences = studentEvents.filter(e => e.type === 'absence').length;

      // Get manual participations for this student
      const studentManualParticipations = (manualParticipationsData || [])
        .filter(mp => mp.student_id === student.id);
      const manualParticipationsCount = studentManualParticipations.reduce((sum, mp) => sum + mp.count, 0);
      const totalParticipations = participations + manualParticipationsCount;

      // Get class config
      const config = configMap.get(student.class_id);
      const targetParticipations = config?.target_participations || 15;
      const totalSessionsExpected = config?.total_sessions_expected || 60;
      const bavardagePenalty = config?.bavardage_penalty ?? false;

      // Calculate effective participations (with bavardage penalty if enabled)
      const effectiveParticipations = bavardagePenalty
        ? Math.max(0, totalParticipations - bavardages)
        : totalParticipations;

      // Calculate adjusted target based on absences
      const reductionPerAbsence = targetParticipations / totalSessionsExpected;
      const adjustedTarget = Math.max(1, targetParticipations - (absences * reductionPerAbsence));

      // Calculate grade using effective participations
      const rawGrade = (effectiveParticipations / adjustedTarget) * 20;
      const grade = Math.min(20, Math.max(0, rawGrade));
      const bonus = rawGrade > 20 ? effectiveParticipations - adjustedTarget : 0;

      // Get archived grades for this student
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
        grade,
        bonus,
        events: studentEvents,
        manualParticipationsList: studentManualParticipations,
        archivedGrades: studentArchivedGrades,
      };
    });

    setStudentGrades(grades);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter and sort students
  const filteredAndSortedGrades = useMemo(() => {
    let filtered = studentGrades;

    if (selectedClassId) {
      filtered = filtered.filter(s => s.student.class_id === selectedClassId);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.student.pseudo.toLowerCase().includes(query) ||
        s.student.class_name.toLowerCase().includes(query)
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
  }, [studentGrades, selectedClassId, searchQuery, sortField, sortOrder]);

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
    setShowConfigModal(true);
  };

  const saveClassConfig = async () => {
    if (!configClassId) return;
    setIsSaving(true);

    const existing = classConfigs.get(configClassId);
    if (existing) {
      await supabase
        .from('class_trimester_config')
        .update({
          target_participations: configTarget,
          total_sessions_expected: configSessions,
          bavardage_penalty: configBavardagePenalty,
          updated_at: new Date().toISOString(),
        })
        .eq('class_id', configClassId);
    } else {
      await supabase.from('class_trimester_config').insert({
        class_id: configClassId,
        target_participations: configTarget,
        total_sessions_expected: configSessions,
        bavardage_penalty: configBavardagePenalty,
      });
    }

    setShowConfigModal(false);
    setIsSaving(false);
    loadData();
  };

  const handleNextTrimester = async () => {
    if (!user) return;
    setIsSaving(true);

    // Archive current grades for all students (totalParticipations includes manual)
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
      await supabase.from('trimester_grades').upsert(gradesToArchive, {
        onConflict: 'student_id,trimester,school_year',
      });
    }

    // Calculate next trimester
    let nextTrimester = trimesterSettings.current_trimester + 1;
    let nextSchoolYear = trimesterSettings.school_year;

    if (nextTrimester > 3) {
      nextTrimester = 1;
      // Increment school year
      const [startYear] = trimesterSettings.school_year.split('-').map(Number);
      nextSchoolYear = `${startYear + 1}-${startYear + 2}`;
    }

    // Update trimester settings
    await supabase
      .from('trimester_settings')
      .update({
        current_trimester: nextTrimester,
        school_year: nextSchoolYear,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Create new trimester boundary
    await supabase.from('trimester_boundaries').insert({
      user_id: user.id,
      trimester: nextTrimester,
      school_year: nextSchoolYear,
      started_at: new Date().toISOString(),
    });

    setShowNextTrimesterModal(false);
    setIsSaving(false);
    loadData();
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
    } finally {
      setIsSaving(false);
    }
  };

  const deleteManualParticipation = async (mpId: string) => {
    if (!confirm('Supprimer cette participation manuelle ?')) return;

    try {
      await supabase.from('manual_participations').delete().eq('id', mpId);
      loadData();
      // Close and reopen to refresh data
      setShowStudentDetailModal(false);
    } catch (error) {
      console.error('Failed to delete manual participation:', error);
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

  const getEventTypeLabel = (type: string, subtype: string | null) => {
    const labels: Record<string, string> = {
      participation: 'Participation',
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

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        sortField === field
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]'
      }`}
    >
      {label}
      {sortField === field && (
        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  );

  // Calculate class average grade
  const classAverageGrade = useMemo(() => {
    if (filteredAndSortedGrades.length === 0) return 0;
    const sum = filteredAndSortedGrades.reduce((acc, s) => acc + s.grade, 0);
    return sum / filteredAndSortedGrades.length;
  }, [filteredAndSortedGrades]);

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
      <div className="space-y-6">
        {/* Header with Trimester Info */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Notes de participation</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Trimestre {trimesterSettings.current_trimester} - {trimesterSettings.school_year}
            </p>
          </div>
          <button
            onClick={() => setShowNextTrimesterModal(true)}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 transition-colors"
          >
            Passer au trimestre suivant
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-[var(--color-surface)] rounded-xl p-4 space-y-4">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Rechercher un eleve..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Class filter with config buttons */}
          {classes.length > 0 && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm text-[var(--color-text-secondary)] py-1.5">Classe:</span>
              <button
                onClick={() => setSelectedClassId(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedClassId === null
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                }`}
              >
                Toutes
              </button>
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-3 py-1.5 rounded-l-full text-sm font-medium transition-colors ${
                      selectedClassId === cls.id
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                    }`}
                  >
                    {cls.name}
                  </button>
                  <button
                    onClick={() => openConfigModal(cls.id)}
                    className={`px-2 py-1.5 rounded-r-full text-sm transition-colors ${
                      selectedClassId === cls.id
                        ? 'bg-[var(--color-primary)]/80 text-white'
                        : 'bg-[var(--color-background)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-border)]'
                    }`}
                    title="Configurer la classe"
                  >
                    ⚙️
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sort options */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-[var(--color-text-secondary)]">Trier par:</span>
            <SortButton field="pseudo" label="Nom" />
            <SortButton field="grade" label="Note" />
            <SortButton field="participations" label="Participations" />
            <SortButton field="bonus" label="Bonus" />
          </div>
        </div>

        {/* Class summary if one is selected */}
        {selectedClassId && (
          <div className="bg-[var(--color-surface)] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[var(--color-text)]">
                  {classes.find(c => c.id === selectedClassId)?.name}
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {filteredAndSortedGrades.length} eleve{filteredAndSortedGrades.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${getGradeColor(classAverageGrade)}`}>
                  {classAverageGrade.toFixed(1)}/20
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">Moyenne de classe</p>
              </div>
            </div>
            {classConfigs.get(selectedClassId) && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                Objectif: {classConfigs.get(selectedClassId)?.target_participations} participations
                pour 20/20 ({classConfigs.get(selectedClassId)?.total_sessions_expected} seances prevues)
              </div>
            )}
          </div>
        )}

        {/* Students List */}
        {filteredAndSortedGrades.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              Aucun eleve
            </h2>
            <p className="text-[var(--color-text-tertiary)] mt-2">
              {searchQuery ? 'Aucun resultat pour cette recherche' : 'Ajoutez des eleves dans la section Classes'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedGrades.map((sg) => (
              <div
                key={sg.student.id}
                className="bg-[var(--color-surface)] rounded-xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => openStudentDetail(sg)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-[var(--color-background)] transition-colors text-left"
                >
                  {/* Grade circle */}
                  <div className={`w-14 h-14 rounded-full ${getGradeBgColor(sg.grade)} flex flex-col items-center justify-center flex-shrink-0`}>
                    <span className={`text-lg font-bold ${getGradeColor(sg.grade)}`}>
                      {sg.grade.toFixed(1)}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">/20</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--color-text)] truncate">
                      {sg.student.pseudo}
                    </div>
                    <div className="text-sm text-[var(--color-text-tertiary)]">
                      {sg.student.class_name}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {sg.bavardagePenalty ? sg.effectiveParticipations : sg.totalParticipations}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        /{Math.round(sg.adjustedTarget)}
                      </div>
                    </div>
                    {sg.bavardagePenalty && sg.bavardages > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-medium text-orange-600">-{sg.bavardages}</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">bav.</div>
                      </div>
                    )}
                    {sg.absences > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-medium text-red-600">{sg.absences}</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">abs.</div>
                      </div>
                    )}
                    {sg.bonus > 0 && (
                      <div className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-sm font-medium">
                        +{sg.bonus.toFixed(1)} bonus
                      </div>
                    )}
                  </div>

                  <span className="text-xl text-[var(--color-text-tertiary)]">›</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Global Summary */}
        {filteredAndSortedGrades.length > 0 && !selectedClassId && (
          <div className="bg-[var(--color-surface)] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Resume global - Trimestre {trimesterSettings.current_trimester}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-primary)]">
                  {classAverageGrade.toFixed(1)}/20
                </div>
                <div className="text-sm text-[var(--color-text-tertiary)]">Moyenne generale</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredAndSortedGrades.reduce((sum, s) => sum + s.totalParticipations, 0)}
                </div>
                <div className="text-sm text-[var(--color-text-tertiary)]">Participations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {filteredAndSortedGrades.reduce((sum, s) => sum + s.absences, 0)}
                </div>
                <div className="text-sm text-[var(--color-text-tertiary)]">Absences</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {filteredAndSortedGrades.reduce((sum, s) => sum + s.bonus, 0).toFixed(1)}
                </div>
                <div className="text-sm text-[var(--color-text-tertiary)]">Total bonus</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfigModal && configClassId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Configuration - {classes.find(c => c.id === configClassId)?.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Participations pour avoir 20/20
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
                  Reduction par absence: {(configTarget / configSessions).toFixed(2)} participation
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--color-background)] rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)]">
                    Penalite bavardages
                  </label>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    1 bavardage = -1 participation
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Passer au trimestre suivant
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Attention :</strong> Cette action va archiver les notes actuelles
                et reinitialiser les compteurs de participation pour le nouveau trimestre.
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
                  className="text-2xl text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                >
                  ×
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
                      <span className="text-[var(--color-text-tertiary)]"> participations totales</span>
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
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      Objectif ajuste: {selectedStudentForDetail.adjustedTarget.toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="mt-4 pt-4 border-t border-black/10 text-sm">
                  <p className="text-[var(--color-text-secondary)]">
                    <strong>Calcul:</strong> Objectif de base = {selectedStudentForDetail.targetParticipations}
                    {selectedStudentForDetail.absences > 0 && (
                      <> - ({selectedStudentForDetail.absences} abs × {(selectedStudentForDetail.targetParticipations / selectedStudentForDetail.totalSessionsExpected).toFixed(2)}) = {selectedStudentForDetail.adjustedTarget.toFixed(1)}</>
                    )}
                  </p>
                  {selectedStudentForDetail.bavardagePenalty && selectedStudentForDetail.bavardages > 0 && (
                    <p className="text-[var(--color-text-secondary)]">
                      Participations effectives = {selectedStudentForDetail.totalParticipations} - {selectedStudentForDetail.bavardages} bavardages = <strong>{selectedStudentForDetail.effectiveParticipations}</strong>
                    </p>
                  )}
                  <p className="text-[var(--color-text-secondary)]">
                    Note = ({selectedStudentForDetail.effectiveParticipations} / {selectedStudentForDetail.adjustedTarget.toFixed(1)}) × 20 = {((selectedStudentForDetail.effectiveParticipations / selectedStudentForDetail.adjustedTarget) * 20).toFixed(2)}
                    {selectedStudentForDetail.grade === 20 && <> → plafonne a <strong>20/20</strong></>}
                    {selectedStudentForDetail.grade === 0 && <> → minimum <strong>0/20</strong></>}
                  </p>
                </div>
              </div>

              {/* Manual Participations Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-[var(--color-text)]">
                    Participations manuelles ({selectedStudentForDetail.manualParticipations})
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
                    Aucune participation manuelle ce trimestre
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
                              {mp.reason || 'Participation manuelle'}
                            </span>
                            <span className="text-xs text-[var(--color-text-tertiary)] block">
                              {formatDate(mp.created_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteManualParticipation(mp.id)}
                          className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                          title="Supprimer"
                        >
                          🗑️
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

      {/* Add Manual Participation Modal */}
      {showAddManualModal && selectedStudentForDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Ajouter une participation manuelle
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Pour: <strong>{selectedStudentForDetail.student.pseudo}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Nombre de participations
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
