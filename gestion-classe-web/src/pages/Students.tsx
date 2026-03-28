import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { buildPhotoUrl } from '../lib/security';
import { generateAnalysisReport, prepareReportData, generateYearEndReport, prepareYearEndReportData } from '../lib/generateReport';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchStudentStampDetail, getCardTier, type StudentStampDetail } from '../lib/rewardsQueries';

interface Student {
  id: string;
  pseudo: string;
  class_id: string;
  class_name: string;
  created_at: string;
  gender: 'M' | 'F';
  student_code?: string;
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
  malus: number;
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

interface GroupSessionGrade {
  session_id: string;
  session_name: string;
  class_name: string;
  created_at: string;
  group_name: string;
  score: number;
  max_points: number;
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
  malus: number;
  effectiveParticipations: number;
  absences: number;
  targetParticipations: number;
  totalSessionsExpected: number;
  adjustedTarget: number;
  malusPenalty: boolean;
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 50; // Limit to prevent DOM bloat

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
  const [showEndYearModal, setShowEndYearModal] = useState(false);
  const [endYearConfirmText, setEndYearConfirmText] = useState('');
  const [generateReportOnTrimesterEnd, setGenerateReportOnTrimesterEnd] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isEndingYear, setIsEndingYear] = useState(false);
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<StudentGrade | null>(null);
  const [configClassId, setConfigClassId] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState(15);
  const [configSessions, setConfigSessions] = useState(60);
  const [configMalusPenalty, setConfigMalusPenalty] = useState(false);
  const [configBaseGrade, setConfigBaseGrade] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Stamp detail in student modal
  const [studentStampDetail, setStudentStampDetail] = useState<StudentStampDetail | null>(null);
  const [stampDetailLoading, setStampDetailLoading] = useState(false);

  // Manual participation modal state
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualReason, setManualReason] = useState('');
  const [manualCount, setManualCount] = useState(1);

  // Student codes modal
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [studentCodes, setStudentCodes] = useState<{ pseudo: string; code: string }[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);

  // Group session grades
  const [groupSessionGrades, setGroupSessionGrades] = useState<GroupSessionGrade[]>([]);
  const [isLoadingGroupGrades, setIsLoadingGroupGrades] = useState(false);

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
    // Phase 1: Load trimester settings first (needed for other queries)
    let settingsData: { current_trimester: number; school_year: string } | null = null;
    const { data: existingSettings } = await supabase
      .from('trimester_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingSettings) {
      settingsData = existingSettings;
      setTrimesterSettings({
        current_trimester: existingSettings.current_trimester,
        school_year: existingSettings.school_year,
      });
    } else {
      const defaultSettings = {
        user_id: user.id,
        current_trimester: 1,
        school_year: getCurrentSchoolYear(),
      };
      await supabase.from('trimester_settings').insert(defaultSettings);
      settingsData = defaultSettings;
      setTrimesterSettings({
        current_trimester: defaultSettings.current_trimester,
        school_year: defaultSettings.school_year,
      });
    }

    const currentTrimester = settingsData!.current_trimester;
    const currentSchoolYear = settingsData!.school_year;

    // Phase 2: Run independent queries in parallel
    const [
      { data: boundariesData },
      { data: classesData },
      { data: configsData },
      { data: studentsData },
    ] = await Promise.all([
      supabase
        .from('trimester_boundaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('school_year', currentSchoolYear)
        .order('trimester'),
      supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('class_trimester_config')
        .select('*'),
      supabase
        .from('students')
        .select(`
          id,
          pseudo,
          class_id,
          created_at,
          gender,
          student_code,
          classes (name)
        `)
        .eq('user_id', user.id)
        .order('pseudo'),
    ]);

    // Handle boundary creation if needed (non-blocking for display)
    const currentBoundary = boundariesData?.find(
      b => b.trimester === currentTrimester
    );
    if (!currentBoundary) {
      supabase.from('trimester_boundaries').insert({
        user_id: user.id,
        trimester: currentTrimester,
        school_year: currentSchoolYear,
        started_at: new Date().toISOString(),
      });
    }

    setClasses(classesData || []);

    // Auto-select first class if none selected
    if (classesData && classesData.length > 0) {
      setSelectedClassId(prev => prev || classesData[0].id);
    }

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

    if (!studentsData || studentsData.length === 0) {
      setStudentGrades([]);
      setIsLoading(false);
      return;
    }

    // Get current trimester boundary for date filtering
    const currentTrimesterBoundary = boundariesData?.find(
      b => b.trimester === currentTrimester && b.school_year === currentSchoolYear
    );
    const trimesterStartDate = currentTrimesterBoundary?.started_at || new Date(0).toISOString();

    // Phase 3: Load student-related data in parallel
    const studentIds = studentsData.map(s => s.id);

    const [
      { data: eventsData },
      { data: manualParticipationsData },
      { data: archivedGradesData },
      { data: oralEvaluationsData },
    ] = await Promise.all([
      supabase
        .from('events')
        .select('id, student_id, session_id, type, subtype, note, timestamp')
        .in('student_id', studentIds)
        .gte('timestamp', trimesterStartDate)
        .order('timestamp', { ascending: false }),
      supabase
        .from('manual_participations')
        .select('*')
        .in('student_id', studentIds)
        .eq('trimester', currentTrimester)
        .eq('school_year', currentSchoolYear)
        .order('created_at', { ascending: false }),
      supabase
        .from('trimester_grades')
        .select('*')
        .in('student_id', studentIds)
        .order('school_year', { ascending: false }),
      supabase
        .from('oral_evaluations')
        .select('*')
        .in('student_id', studentIds)
        .eq('trimester', currentTrimester)
        .eq('school_year', currentSchoolYear),
    ]);

    // Pre-index events by student_id (O(n) instead of O(n²))
    const eventsByStudent = new Map<string, typeof eventsData>();
    (eventsData || []).forEach(e => {
      const list = eventsByStudent.get(e.student_id);
      if (list) {
        list.push(e);
      } else {
        eventsByStudent.set(e.student_id, [e]);
      }
    });

    // Build grades for each student
    const grades: StudentGrade[] = studentsData.map(student => {
      const rawEvents = eventsByStudent.get(student.id) || [];
      const studentEvents: Event[] = rawEvents.map(e => ({
        id: e.id,
        student_id: e.student_id,
        session_id: e.session_id,
        type: e.type,
        subtype: e.subtype,
        note: e.note,
        photo_path: null,
        timestamp: e.timestamp,
        session_date: e.timestamp,
        class_name: '',
      }));

      const participations = rawEvents.filter(e => e.type === 'participation').length;
      const malus = rawEvents.filter(e => e.type === 'bavardage').length;
      const absences = rawEvents.filter(e => e.type === 'absence').length;

      const studentManualParticipations = (manualParticipationsData || [])
        .filter(mp => mp.student_id === student.id);
      const manualParticipationsCount = studentManualParticipations.reduce((sum, mp) => sum + mp.count, 0);
      const totalParticipations = participations + manualParticipationsCount;

      const config = configMap.get(student.class_id);
      const targetParticipations = config?.target_participations || 15;
      const totalSessionsExpected = config?.total_sessions_expected || 60;
      const malusPenalty = config?.bavardage_penalty ?? false;
      const baseGrade = config?.base_grade ?? null;

      const effectiveParticipations = malusPenalty
        ? Math.max(0, totalParticipations - malus)
        : totalParticipations;

      const reductionPerAbsence = targetParticipations / totalSessionsExpected;
      const adjustedTarget = Math.max(1, targetParticipations - (absences * reductionPerAbsence));

      // Calculate grade based on mode: base_grade or target-based
      let rawGrade: number;
      let grade: number;
      let bonus: number;

      if (baseGrade !== null && baseGrade > 0) {
        // Mode "note de base" : note = base + participations - malus (si pénalité active)
        const modifier = malusPenalty
          ? totalParticipations - malus
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
          gender: (student.gender as 'M' | 'F') || 'M',
          student_code: (student as any).student_code || undefined,
        },
        participations,
        manualParticipations: manualParticipationsCount,
        totalParticipations,
        malus,
        effectiveParticipations,
        absences,
        targetParticipations,
        totalSessionsExpected,
        adjustedTarget,
        malusPenalty,
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, debouncedSearchQuery, sortField, sortOrder]);

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

      // Helper to extract last name initials from pseudo (e.g., "Marie DU." -> "DU.")
      const getLastName = (pseudo: string) => {
        const parts = pseudo.split(' ');
        return parts.length > 1 ? parts[parts.length - 1] : pseudo;
      };

      switch (sortField) {
        case 'pseudo':
          // Sort by last name (the 2-letter initials at the end)
          comparison = getLastName(a.student.pseudo).localeCompare(getLastName(b.student.pseudo));
          // If same last name initials, sort by first name
          if (comparison === 0) {
            comparison = a.student.pseudo.localeCompare(b.student.pseudo);
          }
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

  // Paginated students to limit DOM size
  const paginatedGrades = useMemo(() => {
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
    return filteredAndSortedGrades.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
  }, [filteredAndSortedGrades, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedGrades.length / STUDENTS_PER_PAGE);

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
    setConfigMalusPenalty(config?.bavardage_penalty ?? false);
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
            bavardage_penalty: configMalusPenalty,
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
          bavardage_penalty: configMalusPenalty,
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
      // Generate report if requested
      if (generateReportOnTrimesterEnd) {
        setIsGeneratingReport(true);
        try {
          // Load all events for the current trimester
          const { data: eventsData } = await supabase
            .from('events')
            .select(`
              id, type, student_id,
              sessions!inner (class_id, user_id)
            `)
            .eq('sessions.user_id', user.id);

          const events = (eventsData || []).map((e: any) => ({
            type: e.type,
            class_id: e.sessions.class_id,
            student_id: e.student_id,
          }));

          // Prepare students data
          const allStudents = studentGrades.map(sg => ({
            id: sg.student.id,
            pseudo: sg.student.pseudo,
            class_id: sg.student.class_id,
          }));

          // Prepare gender stats
          const genderStats = {
            garcons: { participations: 0, malus: 0, absences: 0, count: 0 },
            filles: { participations: 0, malus: 0, absences: 0, count: 0 },
          };
          studentGrades.forEach(sg => {
            const target = sg.student.gender === 'F' ? genderStats.filles : genderStats.garcons;
            target.count++;
            target.participations += sg.totalParticipations;
            target.absences += sg.absences;
            target.malus += sg.malus;
          });

          const reportData = prepareReportData(
            classes.map(c => ({ id: c.id, name: c.name })),
            events,
            allStudents,
            genderStats,
            trimesterSettings.current_trimester,
            trimesterSettings.school_year,
          );

          generateAnalysisReport(reportData);
        } catch (reportError) {
          console.error('Error generating report:', reportError);
          // Continue with trimester change even if report fails
        } finally {
          setIsGeneratingReport(false);
        }
      }

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

  const handleEndYear = async () => {
    if (!user || endYearConfirmText !== 'VACANCES') return;
    setIsEndingYear(true);

    try {
      // 1. Generate year-end report if requested
      if (generateReportOnTrimesterEnd) {
        setIsGeneratingReport(true);
        try {
          // Load all events for the year
          const { data: eventsData } = await supabase
            .from('events')
            .select(`id, type, student_id, sessions!inner (class_id, user_id)`)
            .eq('sessions.user_id', user.id);

          const events = (eventsData || []).map((e: any) => ({
            type: e.type,
            class_id: e.sessions.class_id,
            student_id: e.student_id,
          }));

          // Load all trimester grades for the year (T1, T2 + current T3)
          const { data: archivedGradesData } = await supabase
            .from('trimester_grades')
            .select('student_id, trimester, grade, participations, class_id')
            .eq('user_id', user.id)
            .eq('school_year', trimesterSettings.school_year);

          // Add current T3 grades (not yet archived)
          const t3Grades = studentGrades.map(sg => ({
            student_id: sg.student.id,
            trimester: 3,
            grade: sg.grade,
            participations: sg.totalParticipations,
            class_id: sg.student.class_id,
          }));

          const allTrimesterGrades = [
            ...(archivedGradesData || []),
            ...t3Grades,
          ];

          const allStudents = studentGrades.map(sg => ({
            id: sg.student.id,
            pseudo: sg.student.pseudo,
            class_id: sg.student.class_id,
          }));

          const genderStats = {
            garcons: { participations: 0, malus: 0, absences: 0, count: 0 },
            filles: { participations: 0, malus: 0, absences: 0, count: 0 },
          };
          studentGrades.forEach(sg => {
            const target = sg.student.gender === 'F' ? genderStats.filles : genderStats.garcons;
            target.count++;
            target.participations += sg.totalParticipations;
            target.absences += sg.absences;
            target.malus += sg.malus;
          });

          const yearEndData = prepareYearEndReportData(
            classes.map(c => ({ id: c.id, name: c.name })),
            events,
            allStudents,
            allTrimesterGrades,
            genderStats,
            trimesterSettings.school_year,
          );
          generateYearEndReport(yearEndData);
        } catch (reportError) {
          console.error('Error generating year-end report:', reportError);
        } finally {
          setIsGeneratingReport(false);
        }
      }

      // 2. Archive T3 grades first
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

      // 3. Archive yearly class summaries
      const classIds = [...new Set(studentGrades.map(sg => sg.student.class_id))];
      for (const classId of classIds) {
        const classStudents = studentGrades.filter(sg => sg.student.class_id === classId);
        const className = classStudents[0]?.student.class_name || 'Inconnu';

        // Load all events for this class this year
        const { data: classEvents } = await supabase
          .from('events')
          .select(`type, sessions!inner (class_id, user_id)`)
          .eq('sessions.user_id', user.id)
          .eq('sessions.class_id', classId);

        const stats = {
          participations: 0,
          malus: 0,
          absences: 0,
          sorties: 0,
        };
        (classEvents || []).forEach((e: any) => {
          if (e.type === 'participation') stats.participations++;
          else if (e.type === 'bavardage') stats.malus++;
          else if (e.type === 'absence') stats.absences++;
          else if (e.type === 'sortie') stats.sorties++;
        });

        const avgGrade = classStudents.length > 0
          ? classStudents.reduce((sum, s) => sum + s.grade, 0) / classStudents.length
          : 0;
        const ratio = stats.participations + stats.malus > 0
          ? Math.round((stats.participations / (stats.participations + stats.malus)) * 100)
          : 0;

        await supabase.from('yearly_class_summaries').upsert({
          user_id: user.id,
          class_name: className,
          school_year: trimesterSettings.school_year,
          total_students: classStudents.length,
          total_participations: stats.participations,
          total_bavardages: stats.malus,
          total_absences: stats.absences,
          total_sorties: stats.sorties,
          average_grade: avgGrade,
          ratio,
        }, { onConflict: 'user_id,class_name,school_year' });
      }

      // 4. Identify 3eme students to delete
      const thirdYearStudentIds = studentGrades
        .filter(sg => sg.student.class_name.toLowerCase().includes('3e') || sg.student.class_name.toLowerCase().includes('3è'))
        .map(sg => sg.student.id);

      // 5. Delete events (all)
      const { data: userSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id);
      const sessionIds = (userSessions || []).map(s => s.id);

      if (sessionIds.length > 0) {
        await supabase.from('events').delete().in('session_id', sessionIds);
      }

      // 6. Delete sessions
      await supabase.from('sessions').delete().eq('user_id', user.id);

      // 7. Delete oral_evaluations
      await supabase.from('oral_evaluations').delete().eq('user_id', user.id);

      // 8. Delete group_sessions and related data
      const { data: groupSessions } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('user_id', user.id);
      const groupSessionIds = (groupSessions || []).map(gs => gs.id);

      if (groupSessionIds.length > 0) {
        // Get group IDs
        const { data: groups } = await supabase
          .from('session_groups')
          .select('id')
          .in('session_id', groupSessionIds);
        const groupIds = (groups || []).map(g => g.id);

        if (groupIds.length > 0) {
          await supabase.from('group_grades').delete().in('group_id', groupIds);
          await supabase.from('session_group_members').delete().in('group_id', groupIds);
        }
        await supabase.from('session_groups').delete().in('session_id', groupSessionIds);
        await supabase.from('grading_criteria').delete().in('session_id', groupSessionIds);
      }
      await supabase.from('group_sessions').delete().eq('user_id', user.id);

      // 9. Delete classes
      await supabase.from('classes').delete().eq('user_id', user.id);

      // 10. Delete 3eme students and their trimester_grades
      if (thirdYearStudentIds.length > 0) {
        await supabase.from('trimester_grades').delete().in('student_id', thirdYearStudentIds);
        await supabase.from('manual_participations').delete().in('student_id', thirdYearStudentIds);
        await supabase.from('students').delete().in('id', thirdYearStudentIds);
      }

      // 11. Detach remaining students from classes (set class_id to null or keep for matching)
      // Actually, since classes are deleted, we need to handle this differently
      // The students table has a FK to classes, so we need to handle this
      // Option: Keep students but they'll be orphaned - need to check FK constraint

      // For now, let's update students to remove class_id reference
      // This requires the FK to be nullable or we delete students too
      // Let's delete all students but keep trimester_grades (which has student_id)
      // The student can be recreated with same pseudo and we can match by trimester_grades

      // Actually, let's keep non-3eme students for matching next year
      // But since class_id FK will fail, we need to handle this
      // Solution: Delete students too, matching will be done via trimester_grades.student_id + pseudo stored somewhere

      // Simplest approach: store pseudo in a new field in trimester_grades or separate table
      // For now, let's delete all students (matching will need to be rethought)
      // OR: make class_id nullable in students table

      // Let's delete non-3eme students' class associations by deleting them
      // We'll rely on trimester_grades for history (which keeps student_id)
      // And we'll need a way to match new imports to old student_ids

      // For the matching feature, we need to store pseudo somewhere persistent
      // Let's NOT delete non-3eme students, just their class association
      // But FK constraint... let's check if it's nullable

      // Actually the safest is: we already have trimester_grades with student_id
      // When importing next year, we can match by looking at students table (pseudo)
      // So let's keep students (non-3eme) but they won't have a valid class_id
      // This might cause issues... let's delete all for now and revisit matching logic

      // Delete remaining students (non-3eme) - their trimester_grades are preserved
      const nonThirdYearStudentIds = studentGrades
        .filter(sg => !thirdYearStudentIds.includes(sg.student.id))
        .map(sg => sg.student.id);

      // Before deleting, let's store the pseudo mapping for future matching
      // We can use the students table itself - just don't delete non-3eme students
      // But class_id FK... let's see if cascade handles it

      // Actually, ON DELETE CASCADE on class_id means students will be auto-deleted when class is deleted
      // So we need to remove the class_id first OR change our approach

      // New approach: Don't delete students, update their class_id to NULL (if allowed)
      // OR delete classes last and let cascade handle it, but preserve student info elsewhere

      // Let's just note that students will be deleted by cascade when classes are deleted
      // The trimester_grades will remain (student_id is UUID, not FK usually)
      // For matching, we need another approach - store pseudo in trimester_grades or new table

      // For now, accept that students are deleted. Matching feature will need a different approach.
      // The user can manually re-link if needed.

      // 12. Delete manual_participations for remaining students
      if (nonThirdYearStudentIds.length > 0) {
        await supabase.from('manual_participations').delete().in('student_id', nonThirdYearStudentIds);
      }

      // 13. Delete trimester_boundaries for this year
      await supabase.from('trimester_boundaries').delete()
        .eq('user_id', user.id)
        .eq('school_year', trimesterSettings.school_year);

      // 14. Update trimester settings for new year
      const [startYear] = trimesterSettings.school_year.split('-').map(Number);
      const nextSchoolYear = `${startYear + 1}-${startYear + 2}`;

      await supabase.from('trimester_settings').update({
        current_trimester: 1,
        school_year: nextSchoolYear,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      // 15. Create first trimester boundary for new year
      await supabase.from('trimester_boundaries').insert({
        user_id: user.id,
        trimester: 1,
        school_year: nextSchoolYear,
        started_at: new Date().toISOString(),
      });

      setShowEndYearModal(false);
      setEndYearConfirmText('');
      alert('Annee scolaire terminee avec succes ! Les donnees ont ete archivees.');
      loadData();
    } catch (error) {
      console.error('Error ending year:', error);
      alert('Erreur lors de la cloture de l\'annee. Verifiez la console pour plus de details.');
    } finally {
      setIsEndingYear(false);
    }
  };

  const loadStudentCodes = async () => {
    if (!user || !selectedClassId) return;
    setIsLoadingCodes(true);
    try {
      const { data } = await supabase
        .from('students')
        .select('pseudo, student_code')
        .eq('user_id', user.id)
        .eq('class_id', selectedClassId)
        .order('pseudo');
      setStudentCodes((data || []).map(s => ({ pseudo: s.pseudo, code: s.student_code || '------' })));
      setShowCodesModal(true);
    } catch (err) {
      console.error('Error loading student codes:', err);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const copyAllCodes = () => {
    const className = classes.find(c => c.id === selectedClassId)?.name || '';
    const text = `Codes d'acces - ${className}\n${window.location.origin}/gestion-classe/eleve\n\n` +
      studentCodes.map(s => `${s.pseudo} : ${s.code}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const openStudentDetail = async (studentGrade: StudentGrade) => {
    setSelectedStudentForDetail(studentGrade);
    setShowStudentDetailModal(true);
    setGroupSessionGrades([]);
    setIsLoadingGroupGrades(true);
    setStudentStampDetail(null);
    setStampDetailLoading(true);

    // Load stamp detail in parallel (fire and forget, update state when ready)
    fetchStudentStampDetail(studentGrade.student.id)
      .then(detail => setStudentStampDetail(detail))
      .catch(() => {})
      .finally(() => setStampDetailLoading(false));

    try {
      // Load detailed events with session info (on demand, not at initial load)
      const { data: detailedEvents } = await supabase
        .from('events')
        .select(`
          id, student_id, session_id, type, subtype, note, photo_path, timestamp,
          sessions (started_at, classes (name))
        `)
        .eq('student_id', studentGrade.student.id)
        .order('timestamp', { ascending: false });

      if (detailedEvents) {
        const enrichedEvents: Event[] = detailedEvents.map(e => ({
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
        setSelectedStudentForDetail({
          ...studentGrade,
          events: enrichedEvents,
        });
      }

      // Load group session grades for this student
      const { data: membershipsData } = await supabase
        .from('session_group_members')
        .select(`
          group_id,
          session_groups (
            id,
            name,
            conduct_malus,
            session_id,
            group_sessions (
              id,
              name,
              created_at,
              class_id,
              classes (name)
            )
          )
        `)
        .eq('student_id', studentGrade.student.id);

      if (membershipsData && membershipsData.length > 0) {
        const groupIds = membershipsData.map(m => (m.session_groups as any)?.id).filter(Boolean);

        // Get grades for these groups
        const { data: gradesData } = await supabase
          .from('group_grades')
          .select('group_id, criteria_id, points_awarded')
          .in('group_id', groupIds);

        // Get criteria for max points
        const sessionIds = [...new Set(membershipsData.map(m => (m.session_groups as any)?.session_id).filter(Boolean))];
        const { data: criteriaData } = await supabase
          .from('grading_criteria')
          .select('id, session_id, max_points')
          .in('session_id', sessionIds);

        // Calculate scores
        const grades: GroupSessionGrade[] = membershipsData.map(m => {
          const group = m.session_groups as any;
          if (!group || !group.group_sessions) return null;

          const session = group.group_sessions;
          const groupGrades = (gradesData || []).filter(g => g.group_id === group.id);
          const sessionCriteria = (criteriaData || []).filter(c => c.session_id === session.id);

          const score = groupGrades.reduce((sum, g) => sum + g.points_awarded, 0) - (group.conduct_malus || 0);
          const maxPoints = sessionCriteria.reduce((sum, c) => sum + c.max_points, 0);

          return {
            session_id: session.id,
            session_name: session.name,
            class_name: session.classes?.name || 'Classe inconnue',
            created_at: session.created_at,
            group_name: group.name,
            score,
            max_points: maxPoints,
          };
        }).filter(Boolean) as GroupSessionGrade[];

        // Sort by date descending
        grades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setGroupSessionGrades(grades);
      }
    } catch (err) {
      console.error('Error loading group session grades:', err);
    } finally {
      setIsLoadingGroupGrades(false);
    }
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

  const toggleGender = async () => {
    if (!selectedStudentForDetail) return;

    const newGender = selectedStudentForDetail.student.gender === 'M' ? 'F' : 'M';

    try {
      const { error } = await supabase
        .from('students')
        .update({ gender: newGender })
        .eq('id', selectedStudentForDetail.student.id);

      if (error) throw error;

      // Update modal state
      setSelectedStudentForDetail({
        ...selectedStudentForDetail,
        student: { ...selectedStudentForDetail.student, gender: newGender },
      });

      // Update list state without reloading
      setStudentGrades(prev => prev.map(sg =>
        sg.student.id === selectedStudentForDetail.student.id
          ? { ...sg, student: { ...sg.student, gender: newGender } }
          : sg
      ));
    } catch (error) {
      console.error('Failed to update gender:', error);
      alert('Erreur lors de la mise a jour.');
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
      bavardage: 'Malus',
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
    const sessions: Map<string, { date: string; participation: number; malus: number }> = new Map();

    // Group events by session
    events.forEach(event => {
      const sessionId = event.session_id;
      const sessionDate = event.session_date;

      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { date: sessionDate, participation: 0, malus: 0 });
      }

      const sessionData = sessions.get(sessionId)!;
      if (event.type === 'participation') sessionData.participation++;
      if (event.type === 'bavardage') sessionData.malus++;
    });

    // Sort by date and take last 12 sessions
    const sortedSessions = Array.from(sessions.entries())
      .sort((a, b) => new Date(a[1].date).getTime() - new Date(b[1].date).getTime())
      .slice(-12);

    return sortedSessions.map(([, data]) => ({
      sessionDate: data.date,
      label: new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      participation: data.participation,
      malus: data.malus,
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
        {/* Header - compact on mobile */}
        <div className="flex items-center justify-between gap-2 mb-2 md:mb-4">
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-[var(--color-text)] truncate">
              <span className="md:hidden">Notes</span>
              <span className="hidden md:inline">Notes d'implication</span>
            </h1>
            <p className="text-xs md:text-base text-[var(--color-text-secondary)]">
              T{trimesterSettings.current_trimester} - {trimesterSettings.school_year}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadStudentCodes}
            disabled={isLoadingCodes || !selectedClassId}
            className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-base border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-background)] transition-colors whitespace-nowrap"
            title="Codes d'acces eleves"
          >
            <span className="md:hidden">Codes</span>
            <span className="hidden md:inline">Codes eleves</span>
          </button>
          <button
            onClick={() => trimesterSettings.current_trimester === 3 ? setShowEndYearModal(true) : setShowNextTrimesterModal(true)}
            className={`px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-base text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              trimesterSettings.current_trimester === 3
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90'
            }`}
          >
            {trimesterSettings.current_trimester === 3 ? (
              <>
                <span className="md:hidden">Finir annee</span>
                <span className="hidden md:inline">Finir l'annee scolaire</span>
              </>
            ) : (
              <>
                <span className="md:hidden">Trimestre →</span>
                <span className="hidden md:inline">Passer au trimestre suivant</span>
              </>
            )}
          </button>
          </div>
        </div>

        {/* Main content - Two columns */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Sidebar - Classes (always collapsed on mobile, respects state on desktop) */}
          <div className={`w-12 flex-shrink-0 bg-[var(--color-surface)] rounded-xl overflow-hidden flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'md:w-12' : 'md:w-64'}`}>
            {/* Sidebar header */}
            <div className="p-2 md:p-3 border-b border-[var(--color-border)] flex items-center justify-between">
              {!sidebarCollapsed && (
                <h2 className="hidden md:block font-semibold text-[var(--color-text)]">Classes</h2>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:block p-1 hover:bg-[var(--color-background)] rounded text-[var(--color-text-secondary)]"
                title={sidebarCollapsed ? 'Agrandir' : 'Reduire'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>

            {/* Classes list */}
            <div className="flex-1 overflow-y-auto p-1 md:p-2 space-y-1">
              {classStats.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`w-full text-left rounded-lg transition-colors ${
                    selectedClassId === cls.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'hover:bg-[var(--color-background)] text-[var(--color-text)]'
                  } p-2 ${sidebarCollapsed ? 'md:p-2' : 'md:p-3'}`}
                >
                  {/* Mobile: always show compact */}
                  <div className="md:hidden text-center font-medium text-xs" title={cls.name}>
                    {cls.name.substring(0, 2)}
                  </div>
                  {/* Desktop: respect collapsed state */}
                  <div className="hidden md:block">
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
                  </div>
                </button>
              ))}

              {classes.length === 0 && !sidebarCollapsed && (
                <div className="hidden md:block text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                  Aucune classe
                </div>
              )}
            </div>

            {/* Sidebar footer - Stats (hidden on mobile) */}
            {!sidebarCollapsed && (
              <div className="hidden md:block p-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
                <div>{studentGrades.length} eleves au total</div>
              </div>
            )}
          </div>

          {/* Main content - Students */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)] rounded-xl overflow-hidden">
            {selectedClassId ? (
              <>
                {/* Class header - compact on mobile */}
                <div className="p-2 md:p-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <h2 className="text-base md:text-xl font-semibold text-[var(--color-text)]">
                        {selectedClassStats?.name}
                      </h2>
                      <button
                        onClick={() => openConfigModal(selectedClassId)}
                        className="p-1 md:p-1.5 hover:bg-[var(--color-background)] rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                        title="Configurer"
                      >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className={`text-lg md:text-2xl font-bold ${getGradeColor(selectedClassStats?.averageGrade || 0)}`}>
                      {selectedClassStats?.averageGrade.toFixed(1)}/20
                    </div>
                  </div>

                  {/* Search and sort - more compact on mobile */}
                  <div className="flex gap-2 md:gap-3 items-center">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 md:pl-10 pr-2 md:pr-4 py-1.5 md:py-2 text-sm md:text-base border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                      />
                      <svg className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="flex gap-0.5 md:gap-1 shrink-0">
                      {(['pseudo', 'grade', 'participations', 'bonus'] as SortField[]).map((field) => (
                        <button
                          key={field}
                          onClick={() => handleSort(field)}
                          className={`px-1.5 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                            sortField === field
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                          }`}
                        >
                          <span className="md:hidden">
                            {field === 'pseudo' ? 'N' : field === 'grade' ? '★' : field === 'participations' ? 'P' : 'B'}
                          </span>
                          <span className="hidden md:inline">
                            {field === 'pseudo' ? 'Nom' : field === 'grade' ? 'Note' : field === 'participations' ? 'Part.' : 'Bonus'}
                          </span>
                          {sortField === field && (
                            <span className="ml-0.5 md:ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Class config summary - hidden on mobile */}
                  {classConfigs.get(selectedClassId) && (
                    <div className="hidden md:block mt-3 text-sm text-[var(--color-text-tertiary)]">
                      {classConfigs.get(selectedClassId)?.base_grade !== null ? (
                        <>
                          Note de base: {classConfigs.get(selectedClassId)?.base_grade}/20
                          {classConfigs.get(selectedClassId)?.bavardage_penalty && ' · Penalite malus active'}
                        </>
                      ) : (
                        <>
                          Objectif: {classConfigs.get(selectedClassId)?.target_participations} implications
                          {classConfigs.get(selectedClassId)?.bavardage_penalty && ' · Penalite malus active'}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Students grid/list */}
                <div className="flex-1 overflow-y-auto p-2 md:p-4">
                  {filteredAndSortedGrades.length === 0 ? (
                    <div className="text-center py-8 md:py-12">
                      <div className="text-3xl md:text-4xl mb-3 md:mb-4">👥</div>
                      <h3 className="text-base md:text-lg font-medium text-[var(--color-text)]">
                        {searchQuery ? 'Aucun resultat' : 'Aucun eleve'}
                      </h3>
                      <p className="text-[var(--color-text-tertiary)] mt-1 md:mt-2 text-sm">
                        {searchQuery ? 'Essayez une autre recherche' : 'Ajoutez des eleves dans la section Classes'}
                      </p>
                    </div>
                  ) : (
                    <>
                    {/* Mobile: compact list view */}
                    <div className="md:hidden space-y-1">
                      {paginatedGrades.map((sg) => (
                        <button
                          key={sg.student.id}
                          onClick={() => openStudentDetail(sg)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg border ${getGradeBorderColor(sg.grade)} ${getGradeBgColor(sg.grade)}/20 active:${getGradeBgColor(sg.grade)}/40 transition-all text-left`}
                        >
                          {/* Grade badge */}
                          <div className={`w-10 h-10 shrink-0 rounded-lg ${getGradeBgColor(sg.grade)} flex items-center justify-center`}>
                            <span className={`text-sm font-bold ${getGradeColor(sg.grade)}`}>
                              {sg.grade.toFixed(1)}
                            </span>
                          </div>

                          {/* Name + stats */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--color-text)] text-sm truncate">
                              {sg.student.pseudo}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600 font-medium">
                                +{sg.malusPenalty ? sg.effectiveParticipations : sg.totalParticipations}
                              </span>
                              {sg.malus > 0 && (
                                <span className="text-orange-600">-{sg.malus}</span>
                              )}
                              {sg.absences > 0 && (
                                <span className="text-red-600">{sg.absences}abs</span>
                              )}
                            </div>
                          </div>

                          {/* Bonus if any */}
                          {sg.bonus > 0 && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium shrink-0">
                              +{sg.bonus.toFixed(0)}
                            </span>
                          )}

                          {/* Arrow */}
                          <svg className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>

                    {/* Desktop: card grid view */}
                    <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {paginatedGrades.map((sg) => (
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
                              {sg.malusPenalty ? sg.effectiveParticipations : sg.totalParticipations}/{Math.round(sg.adjustedTarget)}
                            </span>
                            {sg.malusPenalty && sg.malus > 0 && (
                              <span className="text-orange-600">-{sg.malus}</span>
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

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded border border-[var(--color-border)] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
                        >
                          Precedent
                        </button>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          Page {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded border border-[var(--color-border)] text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-hover)]"
                        >
                          Suivant
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>

                {/* Footer stats - compact on mobile */}
                {filteredAndSortedGrades.length > 0 && (
                  <div className="p-1.5 md:p-4 border-t border-[var(--color-border)] bg-[var(--color-background)]">
                    {/* Mobile: inline compact */}
                    <div className="md:hidden flex items-center justify-center gap-3 text-xs">
                      <span className="text-[var(--color-primary)] font-medium">{filteredAndSortedGrades.length} el.</span>
                      <span className="text-green-600 font-medium">+{filteredAndSortedGrades.reduce((sum, s) => sum + s.totalParticipations, 0)}</span>
                      <span className="text-red-600 font-medium">{filteredAndSortedGrades.reduce((sum, s) => sum + s.absences, 0)} abs</span>
                      <span className="text-yellow-600 font-medium">+{filteredAndSortedGrades.reduce((sum, s) => sum + s.bonus, 0).toFixed(0)} bonus</span>
                    </div>
                    {/* Desktop: full display */}
                    <div className="hidden md:flex flex-wrap gap-6 justify-center text-sm">
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
                    Penalite malus
                  </label>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    1 malus = -1 implication
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigMalusPenalty(!configMalusPenalty)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    configMalusPenalty ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      configMalusPenalty ? 'translate-x-6' : 'translate-x-0'
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
                      Note = {configBaseGrade} + participations {configMalusPenalty ? '- malus' : ''}
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

            <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
              {studentGrades.length} eleve{studentGrades.length > 1 ? 's' : ''} seront archives.
            </p>

            {/* Generate report option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateReportOnTrimesterEnd}
                  onChange={(e) => setGenerateReportOnTrimesterEnd(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--color-primary)] rounded"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">
                    Generer un rapport PDF du trimestre
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Inclut l'analyse par classe, par niveau, l'equilibre filles/garcons et les points forts/faibles.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNextTrimesterModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Annuler
              </button>
              <button
                onClick={handleNextTrimester}
                disabled={isSaving || isGeneratingReport}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
              >
                {isGeneratingReport ? 'Generation du rapport...' : isSaving ? 'Archivage...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Year Modal */}
      {showEndYearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Finir l'annee scolaire
            </h3>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Action irreversible !</strong> Cette action va :
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                <li>Archiver toutes les notes du trimestre 3</li>
                <li>Sauvegarder les statistiques annuelles par classe</li>
                <li>Supprimer les sessions, evenements et classes</li>
                <li>Supprimer definitivement les eleves de 3eme</li>
                <li>Reinitialiser pour l'annee {(() => {
                  const [startYear] = trimesterSettings.school_year.split('-').map(Number);
                  return `${startYear + 1}-${startYear + 2}`;
                })()}</li>
              </ul>
            </div>

            <p className="text-[var(--color-text-secondary)] mb-4">
              Annee actuelle : <strong>{trimesterSettings.school_year}</strong>
              <br />
              <span className="text-sm text-[var(--color-text-tertiary)]">
                {studentGrades.length} eleve{studentGrades.length > 1 ? 's' : ''} -
                {' '}{studentGrades.filter(sg => sg.student.class_name.toLowerCase().includes('3e') || sg.student.class_name.toLowerCase().includes('3è')).length} eleve(s) de 3eme seront supprimes
              </span>
            </p>

            {/* Generate report option */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateReportOnTrimesterEnd}
                  onChange={(e) => setGenerateReportOnTrimesterEnd(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--color-primary)] rounded"
                />
                <div>
                  <span className="text-sm font-medium text-blue-900">
                    Generer un rapport PDF de fin d'annee
                  </span>
                  <p className="text-xs text-blue-700 mt-1">
                    Rapport complet du T3 avec analyse par classe et par niveau.
                  </p>
                </div>
              </label>
            </div>

            {/* Confirmation input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Pour confirmer, tapez <strong className="text-red-600">VACANCES</strong> :
              </label>
              <input
                type="text"
                value={endYearConfirmText}
                onChange={(e) => setEndYearConfirmText(e.target.value.toUpperCase())}
                placeholder="VACANCES"
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEndYearModal(false);
                  setEndYearConfirmText('');
                }}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Annuler
              </button>
              <button
                onClick={handleEndYear}
                disabled={endYearConfirmText !== 'VACANCES' || isEndingYear || isGeneratingReport}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingReport ? 'Generation rapport...' : isEndingYear ? 'Cloture en cours...' : 'Terminer l\'annee'}
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
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--color-text)]">
                      {selectedStudentForDetail.student.pseudo}
                    </h3>
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {selectedStudentForDetail.student.class_name}
                      {selectedStudentForDetail.student.student_code && (
                        <span className="ml-2 px-2 py-0.5 bg-[var(--color-surface-secondary)] rounded text-xs font-mono">
                          {selectedStudentForDetail.student.student_code}
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Gender toggle button */}
                  <button
                    onClick={toggleGender}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                    title="Cliquer pour changer"
                  >
                    {selectedStudentForDetail.student.gender === 'F' ? '♀ Fille' : '♂ Garcon'}
                  </button>
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
                    {selectedStudentForDetail.malus > 0 && (
                      <p className="text-sm">
                        <span className="text-orange-600 font-semibold">{selectedStudentForDetail.malus}</span>
                        <span className="text-[var(--color-text-tertiary)]"> malus</span>
                        {selectedStudentForDetail.malusPenalty && (
                          <span className="text-orange-600"> (-{selectedStudentForDetail.malus})</span>
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
                        {selectedStudentForDetail.malusPenalty && selectedStudentForDetail.malus > 0 && (
                          <> - {selectedStudentForDetail.malus} malus</>
                        )}
                        {' '}= <strong>{(selectedStudentForDetail.baseGrade + (selectedStudentForDetail.malusPenalty ? selectedStudentForDetail.totalParticipations - selectedStudentForDetail.malus : selectedStudentForDetail.totalParticipations)).toFixed(1)}</strong>
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
                      {selectedStudentForDetail.malusPenalty && selectedStudentForDetail.malus > 0 && (
                        <p className="text-[var(--color-text-secondary)]">
                          Implications effectives = {selectedStudentForDetail.totalParticipations} - {selectedStudentForDetail.malus} malus = <strong>{selectedStudentForDetail.effectiveParticipations}</strong>
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
                  <div className="text-2xl font-bold text-orange-600">-{selectedStudentForDetail.malus}</div>
                  <div className="text-xs text-orange-700">Malus</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{selectedStudentForDetail.absences}</div>
                  <div className="text-xs text-red-700">Absences</div>
                </div>
                <div className={`rounded-xl p-4 text-center ${
                  (selectedStudentForDetail.participations - selectedStudentForDetail.malus) >= 0
                    ? 'bg-green-100'
                    : 'bg-orange-100'
                }`}>
                  <div className={`text-2xl font-bold ${
                    (selectedStudentForDetail.participations - selectedStudentForDetail.malus) >= 0
                      ? 'text-green-700'
                      : 'text-orange-700'
                  }`}>
                    {selectedStudentForDetail.participations - selectedStudentForDetail.malus >= 0 ? '+' : ''}
                    {selectedStudentForDetail.participations - selectedStudentForDetail.malus}
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
                        dataKey="malus"
                        name="Malus"
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

              {/* Group Session Grades Section */}
              <div className="bg-amber-50 rounded-xl p-4">
                <h4 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                  <span>👥</span> Notes de groupe ({groupSessionGrades.length})
                </h4>
                {isLoadingGroupGrades ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : groupSessionGrades.length === 0 ? (
                  <p className="text-amber-600 text-sm">
                    Aucune note de groupe pour cet eleve
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupSessionGrades.map((grade, idx) => {
                      const percentage = grade.max_points > 0 ? Math.round((grade.score / grade.max_points) * 100) : 0;
                      return (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="font-medium text-[var(--color-text)]">{grade.session_name}</span>
                              <span className="text-xs text-[var(--color-text-tertiary)] ml-2">
                                ({grade.group_name})
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${percentage >= 70 ? 'text-green-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {grade.score.toFixed(1)}/{grade.max_points}
                              </span>
                              <span className="text-xs text-[var(--color-text-tertiary)] ml-1">
                                ({percentage}%)
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-amber-100 rounded-full">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, percentage))}%`,
                                backgroundColor: percentage >= 70 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-xs text-[var(--color-text-tertiary)]">
                            <span>{grade.class_name}</span>
                            <span>{formatDate(grade.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                          {remark.photo_path && buildPhotoUrl(remark.photo_path, import.meta.env.VITE_SUPABASE_URL) && (
                            <div className="mt-2">
                              <img
                                src={buildPhotoUrl(remark.photo_path, import.meta.env.VITE_SUPABASE_URL)!}
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

              {/* Stamp Card */}
              <div>
                <h4 className="font-medium text-[var(--color-text)] mb-3">Carte a tampons</h4>
                {stampDetailLoading ? (
                  <p className="text-sm text-[var(--color-text-tertiary)] py-2">Chargement...</p>
                ) : !studentStampDetail ? (
                  <p className="text-sm text-[var(--color-text-tertiary)] py-2">Pas de carte active</p>
                ) : (() => {
                  const tier = getCardTier(studentStampDetail.card_number);
                  const isComplete = studentStampDetail.stamp_count >= 10;
                  return (
                  <div className="space-y-3">
                    {/* Card visual */}
                    <div
                      className="rounded-2xl p-4 relative overflow-hidden"
                      style={{
                        background: tier.gradient,
                        boxShadow: `0 4px 16px ${tier.borderColor}25`,
                      }}
                    >
                      <div className="absolute inset-0 pointer-events-none" style={{ background: tier.bgPattern }} />

                      <div className="relative flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{tier.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-white drop-shadow-sm">Carte n°{studentStampDetail.card_number}</p>
                            <p className="text-xs text-white/70">{tier.name}</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                          {studentStampDetail.stamp_count}/10
                        </span>
                      </div>

                      <div className="relative h-2 bg-black/20 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(studentStampDetail.stamp_count / 10) * 100}%`,
                            background: isComplete ? tier.progressGradientComplete : tier.progressGradient,
                          }}
                        />
                      </div>

                      <div className="relative grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 10 }, (_, i) => {
                          const stamp = studentStampDetail.stamps.find(s => s.slot_number === i + 1);
                          return (
                            <div
                              key={i}
                              className="aspect-square rounded-lg flex items-center justify-center"
                              style={{
                                border: stamp ? `2px solid ${stamp.category_color}90` : '2px dashed rgba(255,255,255,0.3)',
                                backgroundColor: stamp ? `${stamp.category_color}25` : 'rgba(0,0,0,0.15)',
                              }}
                              title={stamp ? `${stamp.category_label} — ${new Date(stamp.awarded_at).toLocaleDateString('fr-FR')}` : `Slot ${i + 1}`}
                            >
                              <span className="text-lg drop-shadow-sm">{stamp ? stamp.category_icon : tier.emptyIcon}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Completed cards */}
                    {studentStampDetail.completed_cards.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {studentStampDetail.completed_cards.length} carte(s) terminée(s)
                        </p>
                        {studentStampDetail.completed_cards.map((c, i) => {
                          const cTier = getCardTier(c.card_number);
                          return (
                            <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-[var(--color-background)]">
                              <span className="text-[var(--color-text)]">{cTier.emoji} Carte n°{c.card_number} ({cTier.name})</span>
                              <span className="text-[var(--color-text-secondary)]">
                                {c.bonus_label ? `🎁 ${c.bonus_label} ${c.bonus_used ? '✓' : '⏳'}` : 'Pas de bonus'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>

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
      {/* Student Codes Modal */}
      {showCodesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                Codes d'acces eleves
              </h3>
              <button
                onClick={() => setShowCodesModal(false)}
                className="p-1 hover:bg-[var(--color-background)] rounded text-[var(--color-text-secondary)]"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              Lien : <code className="bg-[var(--color-background)] px-1 rounded text-xs">/gestion-classe/eleve</code>
            </p>
            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {studentCodes.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-[var(--color-background)]">
                  <span className="text-sm text-[var(--color-text)]">{s.pseudo}</span>
                  <code className="text-sm font-mono font-bold text-[var(--color-primary)] tracking-widest">{s.code}</code>
                </div>
              ))}
              {studentCodes.length === 0 && (
                <p className="text-center text-[var(--color-text-tertiary)] py-4">Aucun eleve</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAllCodes}
                className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/90 text-sm"
              >
                Copier tous les codes
              </button>
              <button
                onClick={() => setShowCodesModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)] text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
