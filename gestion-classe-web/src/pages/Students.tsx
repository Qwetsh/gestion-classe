import { classColor } from '../lib/classColors';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { generateAnalysisReport, prepareReportData, generateYearEndReport, prepareYearEndReportData } from '../lib/generateReport';
import { generateBulletinContext, downloadBulletinContext, getOralLabel } from '../lib/generateBulletinContext';
import { fetchStudentStampDetail, getCardTier, type StudentStampDetail } from '../lib/rewardsQueries';
import { fetchStudentGradeReport, fetchCurrentPeriod, type StudentGradeReport } from '../lib/evaluationQueries';
import { fetchTeacherEvents } from '../lib/eventsQueries';
import { fetchConnectionStats, fetchStudentConnections, type ConnectionStat } from '../lib/connectionQueries';
import { transferStudent, describeTransfer } from '../lib/studentTransferQueries';
import QRCode from 'qrcode';
import { generateStudentQrCardsPdf } from '../lib/generateStudentQrCards';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { ClassChip, Sparkline, TrendBadge, Distribution, Icon } from '../components/design-system';
import '../styles/refonte-eleves.css';
import { AccommodationBadges } from '../components/AccommodationBadges';
import { MoreMenu } from '../components/MoreMenu';
import { useIsNarrowViewport } from '../hooks/useIsMobile';
import type { AccommodationKey } from '../lib/accommodations';
import { StudentDetailModal } from '../components/StudentDetailModal';
import { engagementInfo } from '../lib/engagement';
import { loadStudentsPage } from '../lib/studentsPageQueries';
import type { ClassConfig, ImplicationEvent as Event, StudentGrade, TrimesterSettings } from '../lib/implicationGrades';

export type { StudentGrade };

// Seuil de malus a partir duquel un eleve est signale dans le filtre "A suivre"
const MALUS_ALERT_THRESHOLD = 5;


export interface GroupSessionGrade {
  session_id: string;
  session_name: string;
  class_name: string;
  created_at: string;
  group_name: string;
  score: number;
  max_points: number;
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

type SortField = 'pseudo' | 'grade' | 'participations' | 'bonus' | 'abs';
type SortOrder = 'asc' | 'desc';

export function Students() {
  const { user } = useAuth();
  const { toast, confirm: showConfirm } = useUIFeedback();
  const isNarrow = useIsNarrowViewport();
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [classConfigs, setClassConfigs] = useState<Map<string, ClassConfig>>(new Map());
  // Lien direct depuis l'accueil : /students?class=<id>&student=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => searchParams.get('class'));
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
  // Classes "sortantes" (3e) : leurs élèves seront supprimés ; les autres détachés/conservés.
  const [leavingClassIds, setLeavingClassIds] = useState<Set<string>>(new Set());
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

  // Notes du carnet dans la fiche eleve (lot 6 du carnet de notes)
  const [studentGradeReport, setStudentGradeReport] = useState<StudentGradeReport | null>(null);
  const [examGradesLoading, setExamGradesLoading] = useState(false);

  // Métriques de connexion à l'espace élève
  const [connectionStats, setConnectionStats] = useState<Map<string, ConnectionStat>>(new Map());
  const [studentConnections, setStudentConnections] = useState<string[]>([]);

  // Manual participation modal state
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualReason, setManualReason] = useState('');
  const [manualCount, setManualCount] = useState(1);

  // Student codes modal
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [studentCodes, setStudentCodes] = useState<{ pseudo: string; code: string }[]>([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isExportingQrCards, setIsExportingQrCards] = useState(false);

  // QR code modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Group session grades
  const [groupSessionGrades, setGroupSessionGrades] = useState<GroupSessionGrade[]>([]);
  const [isLoadingGroupGrades, setIsLoadingGroupGrades] = useState(false);

  // Sidebar collapsed state for mobile

  // Layout and filter state
  // Vue liste par défaut (direction C) ; le choix de l'enseignant est mémorisé sur cet appareil.
  const [layout, setLayoutState] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('gc-students-layout') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  });
  const setLayout = (next: 'grid' | 'list') => {
    setLayoutState(next);
    try { localStorage.setItem('gc-students-layout', next); } catch { /* stockage indisponible */ }
  };
  const [filter, setFilter] = useState<'all' | 'attention' | 'top'>('all');

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
      const data = await loadStudentsPage(user.id, getCurrentSchoolYear());
      setTrimesterSettings(data.settings);
      setClasses(data.classes);
      // Auto-select first class if none selected
      if (data.classes.length > 0) {
        setSelectedClassId(prev => prev || data.classes[0].id);
      }
      setClassConfigs(data.classConfigs);
      setStudentGrades(data.studentGrades);
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

  // Charger les métriques de connexion de la classe sélectionnée
  useEffect(() => {
    if (selectedClassId) {
      fetchConnectionStats(selectedClassId).then(setConnectionStats);
    } else {
      setConnectionStats(new Map());
    }
  }, [selectedClassId]);

  // À l'ouverture du modal fin d'année, pré-cocher les classes "3e" (sortantes)
  useEffect(() => {
    if (showEndYearModal) {
      setLeavingClassIds(new Set(classes.filter(c => /3\s*[eè]/i.test(c.name)).map(c => c.id)));
    }
  }, [showEndYearModal, classes]);

  // Class colors for visual identification

  // Calculate stats for each class
  const classStats = useMemo((): ClassStats[] => {
    return classes.map(cls => {
      const classStudents = studentGrades.filter(s => s.student.class_id === cls.id && !s.student.is_witness);
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

  const filterCounts = useMemo(() => {
    const classStudents = studentGrades.filter(s => (!selectedClassId || s.student.class_id === selectedClassId) && !s.student.is_witness);
    return {
      all: classStudents.length,
      attention: classStudents.filter(s => s.grade < 8 || s.malus >= MALUS_ALERT_THRESHOLD).length,
      top: classStudents.filter(s => s.grade >= 12).length,
    };
  }, [studentGrades, selectedClassId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, debouncedSearchQuery, sortField, sortOrder, filter]);

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

    if (filter === 'attention') filtered = filtered.filter(s => s.grade < 8 || s.malus >= MALUS_ALERT_THRESHOLD);
    if (filter === 'top') filtered = filtered.filter(s => s.grade >= 12);

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
        case 'abs':
          comparison = a.absences - b.absences;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [studentGrades, selectedClassId, debouncedSearchQuery, sortField, sortOrder, filter]);

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
      toast('Erreur lors de la sauvegarde de la configuration.');
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
          const events = (await fetchTeacherEvents(user.id)).map((e) => ({
            type: e.type,
            class_id: e.class_id,
            student_id: e.student_id,
          }));

          // Prepare students data
          const allStudents = studentGrades.map(sg => ({
            id: sg.student.id,
            pseudo: sg.student.pseudo,
            class_id: sg.student.class_id ?? '',
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
      toast('Erreur lors du passage au trimestre suivant.');
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
          const events = (await fetchTeacherEvents(user.id)).map((e) => ({
            type: e.type,
            class_id: e.class_id,
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
            class_id: sg.student.class_id ?? '',
          }));

          const allTrimesterGrades = [
            ...(archivedGradesData || []).map(g => ({ ...g, class_id: g.class_id ?? '' })),
            ...t3Grades,
          ];

          const allStudents = studentGrades.map(sg => ({
            id: sg.student.id,
            pseudo: sg.student.pseudo,
            class_id: sg.student.class_id ?? '',
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

      // 2. Archiver les notes du trimestre courant (T3) avec le nom de classe,
      //    pour les élèves conservés uniquement (les sortants vont être supprimés).
      const gradesToArchive = studentGrades
        .filter(sg => !leavingClassIds.has(sg.student.class_id ?? ''))
        .map(sg => ({
          student_id: sg.student.id,
          class_id: sg.student.class_id,
          class_name: sg.student.class_name,
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
        const classEvents = await fetchTeacherEvents(user.id, classId ?? undefined);

        const stats = {
          participations: 0,
          malus: 0,
          absences: 0,
          sorties: 0,
        };
        classEvents.forEach((e) => {
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

      // 4. Élèves sortants (classes cochées) vs conservés
      const leavingStudentIds = studentGrades
        .filter(sg => leavingClassIds.has(sg.student.class_id ?? ''))
        .map(sg => sg.student.id);
      const keptStudentIds = studentGrades
        .filter(sg => !leavingClassIds.has(sg.student.class_id ?? ''))
        .map(sg => sg.student.id);

      // 5. Supprimer définitivement les élèves sortants (cascade : notes, tampons, événements, maison…)
      if (leavingStudentIds.length > 0) {
        const { error: delErr } = await supabase.from('students').delete().in('id', leavingStudentIds);
        if (delErr) throw delErr;
      }

      // 6. Remise à zéro des maisons pour les élèves conservés (re-tri chaque année)
      if (keptStudentIds.length > 0) {
        await supabase.from('academy_responses').delete().in('student_id', keptStudentIds);
        await supabase.from('academy_preferences').delete().in('student_id', keptStudentIds);
      }

      // 7. Remise à zéro de l'activité quotidienne (événements, séances, oral, sessions de groupe)
      const { data: userSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id);
      const sessionIds = (userSessions || []).map(s => s.id);
      if (sessionIds.length > 0) {
        await supabase.from('events').delete().in('session_id', sessionIds);
      }
      await supabase.from('sessions').delete().eq('user_id', user.id);
      await supabase.from('oral_evaluations').delete().eq('user_id', user.id);

      const { data: groupSessions } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('user_id', user.id);
      const groupSessionIds = (groupSessions || []).map(gs => gs.id);
      if (groupSessionIds.length > 0) {
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

      // 8. Supprimer toutes les classes.
      //    → Les élèves conservés se DÉTACHENT (class_id NULL) au lieu d'être supprimés (FK SET NULL).
      //    → Leurs notes se détachent aussi mais survivent (class_name déjà enregistré).
      //    → academy_config / assignments / house_bonuses (FK classe) sont effacés en cascade (maisons réinitialisées).
      await supabase.from('classes').delete().eq('user_id', user.id);

      // 9. Reset trimestre/année
      await supabase.from('trimester_boundaries').delete()
        .eq('user_id', user.id)
        .eq('school_year', trimesterSettings.school_year);

      const [startYear] = trimesterSettings.school_year.split('-').map(Number);
      const nextSchoolYear = `${startYear + 1}-${startYear + 2}`;

      await supabase.from('trimester_settings').update({
        current_trimester: 1,
        school_year: nextSchoolYear,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      await supabase.from('trimester_boundaries').insert({
        user_id: user.id,
        trimester: 1,
        school_year: nextSchoolYear,
        started_at: new Date().toISOString(),
      });

      setShowEndYearModal(false);
      setEndYearConfirmText('');
      toast(
        `Annee cloturee. ${leavingStudentIds.length} eleve(s) sortant(s) supprime(s), ${keptStudentIds.length} conserve(s) pour l'an prochain.`,
        'success',
      );
      loadData();
    } catch (error) {
      console.error('Error ending year:', error);
      toast('Erreur lors de la cloture de l\'annee. Verifiez la console pour plus de details.');
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

  // Export PDF : cartes QR + code d'accès pour toutes les classes (une classe par page)
  const exportQrCardsPdf = async () => {
    if (!user) return;
    setIsExportingQrCards(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('pseudo, student_code, class_id')
        .eq('user_id', user.id)
        .not('class_id', 'is', null);
      if (error) throw error;

      const byClass = new Map<string, { pseudo: string; code: string | null }[]>();
      for (const s of data || []) {
        const list = byClass.get(s.class_id ?? '') || [];
        list.push({ pseudo: s.pseudo, code: s.student_code || null });
        byClass.set(s.class_id ?? '', list);
      }
      const sortedClasses = [...classes]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .filter(c => byClass.has(c.id))
        .map(c => ({ name: c.name, students: byClass.get(c.id)! }));
      if (sortedClasses.length === 0) {
        toast('Aucun élève à exporter', 'info');
        return;
      }

      const doc = await generateStudentQrCardsPdf(sortedClasses, `${window.location.origin}/gestion-classe/eleve`);
      doc.save(`cartes-acces-eleves-${trimesterSettings.school_year || new Date().getFullYear()}.pdf`);
      toast('PDF des cartes QR exporté !', 'success');
    } catch (err) {
      console.error('QR cards export error:', err);
      toast("Erreur lors de l'export des cartes QR", 'error');
    } finally {
      setIsExportingQrCards(false);
    }
  };

  const openQrModal = async () => {
    const url = `${window.location.origin}/gestion-classe/eleve`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, errorCorrectionLevel: 'M' });
      setQrDataUrl(dataUrl);
      setShowQrModal(true);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  // Ouvre la fiche demandée par le lien, une fois les élèves chargés (puis oublie le paramètre)
  const requestedStudentId = searchParams.get('student');
  useEffect(() => {
    if (!requestedStudentId || studentGrades.length === 0) return;
    const target = studentGrades.find(sg => sg.student.id === requestedStudentId);
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('student'); return next; }, { replace: true });
    if (target) void openStudentDetail(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedStudentId, studentGrades]);

  // Fiche demandée en dernier : avec « précédent / suivant », une réponse lente
  // ne doit pas réécrire la fiche d'un élève qu'on a déjà quitté.
  const detailRequestRef = useRef<string | null>(null);

  const openStudentDetail = async (studentGrade: StudentGrade) => {
    const studentId = studentGrade.student.id;
    detailRequestRef.current = studentId;
    const isCurrent = () => detailRequestRef.current === studentId;
    setSelectedStudentForDetail(studentGrade);
    setShowStudentDetailModal(true);
    setGroupSessionGrades([]);
    setIsLoadingGroupGrades(true);
    setStudentStampDetail(null);
    setStampDetailLoading(true);
    setStudentGradeReport(null);
    setExamGradesLoading(true);
    setStudentConnections([]);

    // Connexions de l'élève (fire and forget)
    fetchStudentConnections(studentGrade.student.id)
      .then(rows => { if (isCurrent()) setStudentConnections(rows); })
      .catch(() => {});

    // Load stamp detail in parallel (fire and forget, update state when ready)
    fetchStudentStampDetail(studentGrade.student.id)
      .then(detail => { if (isCurrent()) setStudentStampDetail(detail); })
      .catch(() => {})
      .finally(() => { if (isCurrent()) setStampDetailLoading(false); });

    // Notes du carnet (toutes, pas seulement les validees : voir fetchStudentGradeReport)
    if (user) {
      const classIdForReport = studentGrade.student.class_id ?? null;
      fetchCurrentPeriod(user.id)
        .then(({ schoolYear }) =>
          fetchStudentGradeReport(user.id, studentGrade.student.id, classIdForReport, schoolYear))
        .then(report => { if (isCurrent()) setStudentGradeReport(report); })
        .catch(() => {})
        .finally(() => { if (isCurrent()) setExamGradesLoading(false); });
    } else {
      setExamGradesLoading(false);
    }

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

      if (!isCurrent()) return;
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

      if (!isCurrent()) return;
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
        if (isCurrent()) setGroupSessionGrades(grades);
      }
    } catch (err) {
      console.error('Error loading group session grades:', err);
    } finally {
      if (isCurrent()) setIsLoadingGroupGrades(false);
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
      toast('Erreur lors de l\'ajout de l\'implication manuelle.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteManualParticipation = async (mpId: string) => {
    const confirmed = await showConfirm({
      title: 'Supprimer cette implication',
      message: 'Supprimer cette implication manuelle ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('manual_participations').delete().eq('id', mpId);
      if (error) throw error;
      loadData();
      setShowStudentDetailModal(false);
    } catch (error) {
      console.error('Failed to delete manual participation:', error);
      toast('Erreur lors de la suppression.');
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
      toast('Erreur lors de la mise a jour.');
    }
  };

  // Changement de classe en cours d'année (historique, tampons et code conservés)
  const changeStudentClass = async (newClassId: string) => {
    if (!selectedStudentForDetail) return;
    const { student } = selectedStudentForDetail;
    if (!newClassId || newClassId === student.class_id) return;
    const target = classes.find(c => c.id === newClassId);
    if (!target) return;

    const ok = await showConfirm({
      title: 'Changer de classe',
      message: `Transférer ${student.pseudo} de ${student.class_name || 'sans classe'} vers ${target.name} ?`,
      details: "Son historique, sa carte à tampons et son code de connexion sont conservés. Sa place dans l'ancien plan de classe est libérée et sa maison est reprise si le module est actif dans la nouvelle classe.",
      confirmLabel: 'Transférer',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      const r = await transferStudent(student.id, newClassId, student.class_id || null);
      toast(describeTransfer(student.pseudo, target.name, r), 'success');
      setShowStudentDetailModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to transfer student:', error);
      toast('Erreur lors du changement de classe.');
    }
  };

  const toggleWitness = async () => {
    if (!selectedStudentForDetail) return;

    const newValue = !selectedStudentForDetail.student.is_witness;

    try {
      const { error } = await supabase
        .from('students')
        .update({ is_witness: newValue })
        .eq('id', selectedStudentForDetail.student.id);

      if (error) throw error;

      setSelectedStudentForDetail({
        ...selectedStudentForDetail,
        student: { ...selectedStudentForDetail.student, is_witness: newValue },
      });

      setStudentGrades(prev => prev.map(sg =>
        sg.student.id === selectedStudentForDetail.student.id
          ? { ...sg, student: { ...sg.student, is_witness: newValue } }
          : sg
      ));

      toast(newValue
        ? 'Élève témoin : exclu des classements et métriques'
        : 'Élève redevenu normal', 'success');
    } catch (error) {
      console.error('Failed to update witness flag:', error);
      toast('Erreur lors de la mise a jour.');
    }
  };

  /** Bascule un dispositif PAP / PPRE / PAI (indicateur seul, aucun détail stocké). */
  const toggleAccommodation = async (key: AccommodationKey) => {
    if (!selectedStudentForDetail) return;

    const newValue = !selectedStudentForDetail.student[key];
    const studentId = selectedStudentForDetail.student.id;

    try {
      const { error } = await supabase
        .from('students')
        .update({ [key]: newValue })
        .eq('id', studentId);

      if (error) throw error;

      setSelectedStudentForDetail({
        ...selectedStudentForDetail,
        student: { ...selectedStudentForDetail.student, [key]: newValue },
      });

      setStudentGrades(prev => prev.map(sg =>
        sg.student.id === studentId
          ? { ...sg, student: { ...sg.student, [key]: newValue } }
          : sg
      ));
    } catch (error) {
      console.error('Failed to update accommodation flag:', error);
      toast('Erreur lors de la mise a jour.');
    }
  };

  // Compute sparkline history (last 10 sessions) for a student
  const getSparklineHistory = (events: Event[]): (number | null)[] => {
    const sessions: Map<string, { date: string; score: number }> = new Map();
    events.forEach(event => {
      const sid = event.session_id;
      if (!sessions.has(sid)) {
        sessions.set(sid, { date: event.session_date || event.timestamp, score: 0 });
      }
      const s = sessions.get(sid)!;
      if (event.type === 'participation') s.score += 1;
      if (event.type === 'bavardage') s.score -= 1;
    });
    const sorted = Array.from(sessions.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
    // Pad to 10 entries
    const history: (number | null)[] = new Array(10).fill(null);
    sorted.forEach((s, i) => {
      const idx = 10 - sorted.length + i;
      history[idx] = Math.max(-2, Math.min(2, s.score));
    });
    return history;
  };

  // Compute delta (trend) for sparkline
  const getSparklineDelta = (history: (number | null)[]): number => {
    const vals = history.filter(v => v !== null) as number[];
    if (vals.length < 2) return 0;
    const mid = Math.floor(vals.length / 2);
    const first = vals.slice(0, mid);
    const last = vals.slice(mid);
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgLast = last.reduce((a, b) => a + b, 0) / last.length;
    return avgLast - avgFirst;
  };

  const selectedClassStats = classStats.find(c => c.id === selectedClassId);

  // Export bulletin context for Claude
  const exportBulletinContext = async () => {
    if (!selectedClassId || !user) return;
    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) return;

    const classStudents = studentGrades.filter(sg => sg.student.class_id === selectedClassId);
    if (classStudents.length === 0) {
      toast('Aucun eleve dans cette classe', 'error');
      return;
    }

    toast('Generation du fichier bulletin...', 'info');

    // Load stamp data and group grades in parallel for all students
    const studentIds = classStudents.map(sg => sg.student.id);

    const [stampCardsResult, membershipsResult] = await Promise.all([
      supabase
        .from('stamp_cards')
        .select('student_id, card_number, status, id')
        .in('student_id', studentIds)
        .eq('status', 'active'),
      supabase
        .from('session_group_members')
        .select(`
          student_id,
          group_id,
          session_groups (
            id, name, conduct_malus, session_id,
            group_sessions ( id, name, class_id )
          )
        `)
        .in('student_id', studentIds),
    ]);

    // Load stamps count per active card
    const activeCards = stampCardsResult.data || [];
    const cardIds = activeCards.map(c => c.id);
    let stampCounts = new Map<string, number>();
    if (cardIds.length > 0) {
      const { data: stamps } = await supabase
        .from('stamps')
        .select('card_id')
        .in('card_id', cardIds);
      (stamps || []).forEach(s => {
        stampCounts.set(s.card_id, (stampCounts.get(s.card_id) || 0) + 1);
      });
    }

    // Load group grades
    const memberships = membershipsResult.data || [];
    const groupIds = [...new Set(memberships.map(m => (m.session_groups as any)?.id).filter(Boolean))];
    const sessionIds = [...new Set(memberships.map(m => (m.session_groups as any)?.session_id).filter(Boolean))];

    let gradesMap = new Map<string, number>();
    let criteriaMaxMap = new Map<string, number>();
    if (groupIds.length > 0) {
      const [{ data: gradesData }, { data: criteriaData }] = await Promise.all([
        supabase.from('group_grades').select('group_id, points_awarded').in('group_id', groupIds),
        supabase.from('grading_criteria').select('id, session_id, max_points').in('session_id', sessionIds),
      ]);
      (gradesData || []).forEach(g => {
        gradesMap.set(g.group_id, (gradesMap.get(g.group_id) || 0) + g.points_awarded);
      });
      (criteriaData || []).forEach(c => {
        criteriaMaxMap.set(c.session_id, (criteriaMaxMap.get(c.session_id) || 0) + c.max_points);
      });
    }

    const bulletinStudents = classStudents.map(sg => {
      // Remarques
      const remarques = sg.events
        .filter(e => e.type === 'remarque' && e.note)
        .map(e => e.note!);

      // Sorties by subtype
      const sortieEvents = sg.events.filter(e => e.type === 'sortie');
      const sortieMap = new Map<string, number>();
      sortieEvents.forEach(e => {
        const sub = e.subtype || 'autre';
        sortieMap.set(sub, (sortieMap.get(sub) || 0) + 1);
      });
      const sorties = Array.from(sortieMap.entries()).map(([subtype, count]) => ({ subtype, count }));

      // Stamp progress
      const card = activeCards.find(c => c.student_id === sg.student.id);
      const stampProgress = card ? {
        cardNumber: card.card_number,
        stampCount: stampCounts.get(card.id) || 0,
        tier: getCardTier(card.card_number).name,
      } : null;

      // Group grades
      const studentMemberships = memberships.filter(m => m.student_id === sg.student.id);
      const groupGrades = studentMemberships
        .map(m => {
          const group = m.session_groups as any;
          if (!group?.group_sessions) return null;
          const session = group.group_sessions;
          if (session.class_id !== selectedClassId) return null;
          const score = (gradesMap.get(group.id) || 0) - (group.conduct_malus || 0);
          const maxPoints = criteriaMaxMap.get(session.id) || 20;
          return { sessionName: session.name, score: Math.max(0, score), maxPoints };
        })
        .filter(Boolean) as { sessionName: string; score: number; maxPoints: number }[];

      return {
        pseudo: sg.student.pseudo,
        gender: sg.student.gender,
        participations: sg.participations,
        manualParticipations: sg.manualParticipations,
        totalParticipations: sg.totalParticipations,
        malus: sg.malus,
        absences: sg.absences,
        grade: sg.grade,
        bonus: sg.bonus,
        oralGrade: sg.oralEvaluation?.grade ?? null,
        oralLabel: sg.oralEvaluation ? getOralLabel(sg.oralEvaluation.grade) : null,
        remarques,
        sorties,
        stampProgress,
        groupGrades,
      };
    });

    const content = generateBulletinContext({
      className: cls.name,
      trimester: trimesterSettings.current_trimester,
      schoolYear: trimesterSettings.school_year,
      classAverage: selectedClassStats?.averageGrade || 0,
      students: bulletinStudents,
    });

    downloadBulletinContext(content, cls.name, trimesterSettings.current_trimester);
    toast('Fichier bulletin exporte !', 'success');
  };

  // Élèves détachés (class_id NULL) : conservés d'une année mais pas encore réaffectés.
  const detachedStudents = studentGrades.filter(sg => !sg.student.class_id);
  // Rappel « anciens élèves non réaffectés » : masquable pour la session de navigation
  const [detachedHintHidden, setDetachedHintHidden] = useState(() => {
    try { return sessionStorage.getItem('gc_detached_hint_hidden') === '1'; } catch { return false; }
  });
  const hideDetachedHint = () => {
    setDetachedHintHidden(true);
    try { sessionStorage.setItem('gc_detached_hint_hidden', '1'); } catch { /* stockage indisponible */ }
  };

  const handlePurgeDetached = async () => {
    if (!user || detachedStudents.length === 0) return;
    const ok = await showConfirm({
      title: 'Supprimer les anciens élèves',
      message: `${detachedStudents.length} élève(s) non réaffecté(s) à une classe seront définitivement supprimés (avec leur historique). Continuer ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('students').delete().eq('user_id', user.id).is('class_id', null);
      if (error) throw error;
      toast('Anciens élèves supprimés.', 'success');
      loadData();
    } catch (e) {
      console.error('Error purging detached students:', e);
      toast('Erreur lors de la suppression.');
    }
  };

  if (isLoading) {
    return (
      <Layout fluid>
        <div className="flex justify-center items-center h-64">
          <div className="text-[var(--text-muted)]">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fluid>
      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: 16, marginBottom: 16, borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ color: 'var(--neg)' }}>&#10005;</button>
        </div>
      )}

      <main className="page--tracking rf-eleves">
        {/* Header : titre de page + action globale (le trimestre concerne toutes les classes) */}
        <header className="track-header">
          <div>
            <div className="track-header__eyebrow">
              <span>Accueil</span>
              <Icon name="chevron-right" size={12} />
              <span>Suivi élèves</span>
              <Icon name="chevron-right" size={12} />
              <span className="is-current">Notes d'implication</span>
            </div>
            <h1>Notes d'implication</h1>
          </div>
          <div className="track-header__actions">
            <button className="btn btn--danger" onClick={() => trimesterSettings.current_trimester === 3 ? setShowEndYearModal(true) : setShowNextTrimesterModal(true)}>
              {trimesterSettings.current_trimester === 3 ? "Finir l'année scolaire" : 'Passer au trimestre suivant'}
            </button>
          </div>
        </header>

        <div className="track-body">
          {/* Sidebar: classes — puce de niveau + moyenne en texte (direction C) */}
          <aside className="classes-pane">
            <div className="classes-pane__head">
              <span>Classes</span>
            </div>
            <div className="classes-pane__list">
              {classStats.map(cls => {
                const label = cls.name.replace(/ème groupe /i, 'G').replace(/ème /i, '').substring(0, 3);
                return (
                  <button key={cls.id}
                    className={`class-row ${cls.id === selectedClassId ? 'is-active' : ''}`}
                    onClick={() => setSelectedClassId(cls.id)}>
                    <ClassChip label={label} color={classColor(cls.name)} size={26} />
                    <div className="class-row__main" style={{ minWidth: 0 }}>
                      {/* Le nom complet seulement s'il dit plus que la puce (« 3ème groupe 1 ») */}
                      {cls.name !== label && <div className="class-row__name">{cls.name}</div>}
                    </div>
                    {/* La moyenne aide à choisir ; l'effectif non */}
                    <span className="class-row__avg">
                      {cls.studentCount > 0 ? cls.averageGrade.toFixed(1).replace('.', ',') : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
            {detachedStudents.length > 0 && !detachedHintHidden && (
              <div
                style={{ padding: '8px 10px 8px 14px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}
                title="Anciens élèves conservés de l'an dernier ; repris automatiquement à l'import s'ils reviennent."
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  {detachedStudents.length} ancien{detachedStudents.length > 1 ? 's' : ''} élève{detachedStudents.length > 1 ? 's' : ''} non réaffecté{detachedStudents.length > 1 ? 's' : ''}
                  {' · '}
                  <button type="button" onClick={handlePurgeDetached} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--neg)', fontWeight: 600, cursor: 'pointer' }}>
                    Supprimer
                  </button>
                </span>
                <button
                  type="button"
                  onClick={hideDetachedHint}
                  aria-label="Masquer pour cette session"
                  title="Masquer pour cette session"
                  style={{ background: 'none', border: 0, padding: '2px 4px', font: 'inherit', fontSize: 14, lineHeight: 1, color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            )}
          </aside>

          {/* Main: class detail */}
          {selectedClassId && selectedClassStats ? (
            <section className="class-detail">
              {/* En-tête de classe compact sur une ligne : nom + méta, actions de la classe à droite (direction C) */}
              <div className="class-detail__head">
                <div className="class-detail__title">
                  <h2>
                    {selectedClassStats.name}
                    <button className="rf-eleves__config" onClick={() => openConfigModal(selectedClassId)} title="Paramètres de la classe" aria-label="Paramètres de la classe">
                      <Icon name="settings" size={14} />
                    </button>
                  </h2>
                  <div className="class-detail__meta">
                    <span>moyenne {selectedClassStats.averageGrade.toFixed(1).replace('.', ',')} / 20</span>
                    {/* Seul indicateur qui appelle une décision (il reste des oraux à faire) ; les cumuls sont dans Analyses */}
                    <span>· oral fait {filteredAndSortedGrades.filter(s => s.oralEvaluation).length} / {filteredAndSortedGrades.length}</span>
                    {/* Effectif seulement quand un filtre ou une recherche réduit la liste */}
                    {filteredAndSortedGrades.length !== selectedClassStats.studentCount && (
                      <span>· {filteredAndSortedGrades.length} affiché{filteredAndSortedGrades.length > 1 ? 's' : ''} sur {selectedClassStats.studentCount}</span>
                    )}
                  </div>
                </div>
                <div className="class-detail__actions">
                  {isNarrow ? (
                    <MoreMenu
                      touch
                      title="Autres actions"
                      items={[
                        { label: 'Bulletin IA', onClick: exportBulletinContext, disabled: !selectedClassId, title: 'Exporter les données pour générer les appréciations de bulletin avec Claude' },
                        { label: 'QR code de la classe', onClick: openQrModal, disabled: !selectedClassId },
                        { label: isExportingQrCards ? 'Export…' : 'Cartes QR (PDF)', onClick: () => { void exportQrCardsPdf(); }, disabled: isExportingQrCards || classes.length === 0 },
                        { label: 'Codes élèves', onClick: () => { void loadStudentCodes(); }, disabled: isLoadingCodes || !selectedClassId },
                      ]}
                    />
                  ) : (
                    <>
                      <button className="btn btn--ghost" onClick={exportBulletinContext} disabled={!selectedClassId} title="Exporter les données pour générer les appréciations de bulletin avec Claude">
                        <Icon name="download" size={14} /> Bulletin IA
                      </button>
                      <button className="btn btn--ghost" onClick={openQrModal} disabled={!selectedClassId}>
                        <Icon name="qr" size={14} /> QR
                      </button>
                      <button className="btn btn--ghost" onClick={exportQrCardsPdf} disabled={isExportingQrCards || classes.length === 0} title="PDF à imprimer : une carte par élève (QR code + code d'accès), classées par classe">
                        <Icon name="download" size={14} /> {isExportingQrCards ? 'Export…' : 'Cartes QR'}
                      </button>
                      <button className="btn btn--ghost" onClick={loadStudentCodes} disabled={isLoadingCodes || !selectedClassId}>
                        Codes élèves
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Toolbar */}
              <div className="toolbar">
                <div className="search">
                  <Icon name="search" size={14} />
                  <input placeholder="Rechercher un élève…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="search__clear"><Icon name="x" size={12} /></button>}
                </div>
                <div className="chips">
                  <button className={`chip ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>Tous <span className="chip__count">{filterCounts.all}</span></button>
                  <button className={`chip chip--warn ${filter === 'attention' ? 'is-on' : ''}`} onClick={() => setFilter('attention')} title={`Note d'implication < 8 ou au moins ${MALUS_ALERT_THRESHOLD} malus`}>À suivre <span className="chip__count">{filterCounts.attention}</span></button>
                  <button className={`chip chip--good ${filter === 'top' ? 'is-on' : ''}`} onClick={() => setFilter('top')}>En tête <span className="chip__count">{filterCounts.top}</span></button>
                </div>
                <div className="toolbar__spacer" />
                <div className="segbtn">
                  <button className={`segbtn__b ${sortField === 'pseudo' ? 'is-on' : ''}`} onClick={() => handleSort('pseudo')}>A‑Z</button>
                  <button className={`segbtn__b ${sortField === 'grade' ? 'is-on' : ''}`} onClick={() => handleSort('grade')}>Note</button>
                  <button className={`segbtn__b ${sortField === 'participations' ? 'is-on' : ''}`} onClick={() => handleSort('participations')}>Tendance</button>
                  <button className={`segbtn__b ${sortField === 'abs' ? 'is-on' : ''}`} onClick={() => handleSort('abs')}>Absences</button>
                </div>
                <div className="segbtn">
                  <button className={`segbtn__b ${layout === 'grid' ? 'is-on' : ''}`} onClick={() => setLayout('grid')}><Icon name="grid" size={14} /></button>
                  <button className={`segbtn__b ${layout === 'list' ? 'is-on' : ''}`} onClick={() => setLayout('list')}><Icon name="list" size={14} /></button>
                </div>
              </div>

              {/* Distribution des notes, aplatie (l'« Oral fait » est passé dans la méta de l'en-tête) */}
              <div className="class-strip">
                <Distribution grades={filteredAndSortedGrades.map(s => s.grade)} color="var(--indigo)" />
              </div>

              {/* Student grid or list */}
              {layout === 'grid' ? (
                <div className="sgrid">
                  {paginatedGrades.map(sg => {
                    const mk = sg.grade;
                    const tone = mk < 6 ? 'crit' : mk < 8 ? 'warn' : mk < 12 ? 'neutral' : 'good';
                    const initials = sg.student.pseudo.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
                    const history = getSparklineHistory(sg.events);
                    const delta = getSparklineDelta(history);
                    return (
                      <div key={sg.student.id} className={`scard scard--${tone}`} onClick={() => openStudentDetail(sg)} style={{ cursor: 'pointer' }}>
                        <div className="scard__head">
                          <div className="scard__id">
                            {/* Avatar neutre : la couleur de classe n'apporte rien dans une classe déjà choisie */}
                            <div className="scard__avatar">
                              {initials}
                            </div>
                            <div>
                              <div className="scard__name">
                                {sg.student.pseudo}
                                {sg.student.is_witness && <span title="Élève témoin (hors classements/métriques)" style={{ marginLeft: 6, fontSize: 11 }}>👁️</span>}
                                <AccommodationBadges student={sg.student} bg="var(--indigo-soft)" fg="var(--indigo)" style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                              </div>
                            </div>
                          </div>
                          <div className="scard__markbox">
                            <div className="scard__mark">
                              <span>{sg.grade.toFixed(1)}</span>
                              <small>/20</small>
                            </div>
                            {sg.malus > 0 && (
                              <div className={`scard__malus ${sg.malus >= 5 ? 'is-high' : ''}`} title="Malus (bavardages) ce trimestre">
                                −{sg.malus} malus
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sparkline des 10 dernières séances ; le delta n'apparaît que s'il est significatif */}
                        <div className="scard__trend" title="Évolution sur les 10 dernières séances">
                          <Sparkline history={history} w={168} h={28} color="var(--text)" />
                          {Math.abs(delta) >= 0.15 && (
                            <div className="scard__trend-meta">
                              <TrendBadge delta={delta} />
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                  {filteredAndSortedGrades.length === 0 && <div className="empty">Aucun élève avec ces filtres.</div>}
                </div>
              ) : (
                <div className="slist">
                  {/* Tableau façon maquette : Élève · Note · Bonus · Malus · Abs · Tendance · Oral */}
                  <div className="slist__head">
                    <span>Élève</span>
                    <span>Note</span>
                    <span>Bonus</span>
                    <span>Malus</span>
                    <span>Abs.</span>
                    <span>Tendance</span>
                    <span>Oral</span>
                  </div>
                  {paginatedGrades.map(sg => {
                    const history = getSparklineHistory(sg.events);
                    const delta = getSparklineDelta(history);
                    const significant = Math.abs(delta) >= 0.15;
                    const eng = engagementInfo(connectionStats.get(sg.student.id)?.last ?? null);
                    return (
                      <div key={sg.student.id} className="srow" onClick={() => openStudentDetail(sg)} style={{ cursor: 'pointer' }}>
                        <div className="srow__id">
                          <div className="srow__name">
                            <span className="srow__dot" style={{ background: eng.color }} title={`Connexion espace élève : ${eng.label}`} />
                            <span className="srow__pseudo">{sg.student.pseudo}</span>
                            {sg.student.is_witness && <span title="Élève témoin (hors classements/métriques)" style={{ fontSize: 11 }}>👁️</span>}
                            <AccommodationBadges student={sg.student} bg="var(--indigo-soft)" fg="var(--indigo-ink)" />
                          </div>
                        </div>
                        <div className={`srow__n srow__note ${sg.grade < 8 ? 'is-low' : ''}`}>{sg.grade.toFixed(1).replace('.', ',')}</div>
                        {/* « — » pour vide, jamais de « 0 » */}
                        <div className={`srow__n ${sg.totalParticipations > 0 ? '' : 'is-empty'}`}>{sg.totalParticipations > 0 ? sg.totalParticipations : '—'}</div>
                        <div className={`srow__n ${sg.malus > 0 ? 'srow__n--neg' : 'is-empty'}`}>{sg.malus > 0 ? sg.malus : '—'}</div>
                        <div className={`srow__n ${sg.absences > 0 ? '' : 'is-empty'}`}>{sg.absences > 0 ? sg.absences : '—'}</div>
                        <div className={`srow__n ${significant ? (delta > 0 ? 'srow__n--pos' : 'srow__n--neg') : 'is-empty'}`} title="Évolution sur les 10 dernières séances">
                          {significant ? `${delta > 0 ? '↗' : '↘'} ${Math.abs(delta).toFixed(1).replace('.', ',')}` : '—'}
                        </div>
                        <div className={`srow__n ${sg.oralEvaluation ? '' : 'is-empty'}`}>{sg.oralEvaluation ? `${sg.oralEvaluation.grade}/5` : '—'}</div>
                      </div>
                    );
                  })}
                  {filteredAndSortedGrades.length === 0 && <div className="empty">Aucun élève avec ces filtres.</div>}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <button className="btn btn--ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Précédent</button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {currentPage} / {totalPages}</span>
                  <button className="btn btn--ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Suivant</button>
                </div>
              )}
            </section>
          ) : (
            <section className="class-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                <h3 style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>Sélectionnez une classe</h3>
                <p style={{ marginTop: 8 }}>Choisissez une classe dans la liste à gauche</p>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Config Modal */}
      {showConfigModal && configClassId && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Configuration - {classes.find(c => c.id === configClassId)?.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Implications pour avoir 20/20
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={configTarget}
                  onChange={(e) => setConfigTarget(parseInt(e.target.value) || 15)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Nombre de seances prevues par trimestre
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={configSessions}
                  onChange={(e) => setConfigSessions(parseInt(e.target.value) || 60)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                />
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  Reduction par absence: {(configTarget / configSessions).toFixed(2)} implication
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)]">
                    Penalite malus
                  </label>
                  <p className="text-xs text-[var(--text-dim)]">
                    1 malus = -1 implication
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigMalusPenalty(!configMalusPenalty)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    configMalusPenalty ? 'bg-[var(--indigo)]' : 'bg-[var(--border-strong)]'
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
              <div className="p-3 bg-[var(--indigo-soft)] rounded-lg border border-[var(--indigo)]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--indigo-ink)]">
                      Mode "Note de base"
                    </label>
                    <p className="text-xs text-[var(--indigo-ink)]">
                      Chaque eleve commence avec cette note
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigBaseGrade(configBaseGrade === null ? 10 : null)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      configBaseGrade !== null ? 'bg-[var(--indigo)]' : 'bg-[var(--border-strong)]'
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
                    <label className="block text-xs font-medium text-[var(--indigo-ink)] mb-1">
                      Note de depart (/20)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={configBaseGrade}
                      onChange={(e) => setConfigBaseGrade(parseFloat(e.target.value) || 10)}
                      className="w-full px-3 py-2 border border-[var(--indigo)] rounded-lg bg-white text-[var(--text)] text-sm"
                    />
                    <p className="text-xs text-[var(--indigo-ink)] mt-2">
                      Note = {configBaseGrade} + participations {configMalusPenalty ? '- malus' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Annuler
              </button>
              <button
                onClick={saveClassConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:bg-[var(--indigo)]/90 disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Next Trimester Modal */}
      {showNextTrimesterModal && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Passer au trimestre suivant
            </h3>

            <div className="bg-[var(--warn-soft)] border border-[var(--warn)] rounded-lg p-4 mb-4">
              <p className="text-sm text-[var(--warn)]">
                <strong>Attention :</strong> Cette action va archiver les notes actuelles
                et reinitialiser les compteurs d'implication pour le nouveau trimestre.
              </p>
            </div>

            <p className="text-[var(--text-muted)] mb-4">
              Trimestre actuel: <strong>{trimesterSettings.current_trimester}</strong> ({trimesterSettings.school_year})
              <br />
              Prochain trimestre: <strong>
                {trimesterSettings.current_trimester === 3 ? '1' : trimesterSettings.current_trimester + 1}
              </strong>
              {trimesterSettings.current_trimester === 3 && (
                <span className="text-[var(--text-dim)]">
                  {' '}(nouvelle annee scolaire)
                </span>
              )}
            </p>

            <p className="text-sm text-[var(--text-dim)] mb-4">
              {studentGrades.length} eleve{studentGrades.length > 1 ? 's' : ''} seront archives.
            </p>

            {/* Generate report option */}
            <div className="bg-[var(--indigo-soft)] border border-[var(--indigo)] rounded-lg p-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateReportOnTrimesterEnd}
                  onChange={(e) => setGenerateReportOnTrimesterEnd(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--indigo)] rounded"
                />
                <div>
                  <span className="text-sm font-medium text-[var(--indigo-ink)]">
                    Generer un rapport PDF du trimestre
                  </span>
                  <p className="text-xs text-[var(--indigo-ink)] mt-1">
                    Inclut l'analyse par classe, par niveau, l'equilibre filles/garcons et les points forts/faibles.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNextTrimesterModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Annuler
              </button>
              <button
                onClick={handleNextTrimester}
                disabled={isSaving || isGeneratingReport}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:bg-[var(--indigo)]/90 disabled:opacity-50"
              >
                {isGeneratingReport ? 'Generation du rapport...' : isSaving ? 'Archivage...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Year Modal */}
      {showEndYearModal && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Finir l'annee scolaire
            </h3>

            <div className="bg-[var(--neg-soft)] border border-[var(--neg)] rounded-lg p-4 mb-4">
              <p className="text-sm text-[var(--neg)]">
                <strong>Coche les classes qui partent</strong> (les 3e). Leurs élèves seront
                <strong> supprimés définitivement</strong>. Les autres sont conservés (notes + tampons)
                et réattachés à leurs nouvelles classes à la rentrée, par rapprochement du pseudo.
              </p>
              <div className="mt-3 space-y-1">
                {classes.map(c => {
                  const count = studentGrades.filter(sg => sg.student.class_id === c.id && !sg.student.is_witness).length;
                  const leaving = leavingClassIds.has(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-[var(--neg-soft)]/60">
                      <input
                        type="checkbox"
                        checked={leaving}
                        onChange={() => setLeavingClassIds(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        })}
                        className="w-4 h-4"
                      />
                      <span className={leaving ? 'text-[var(--neg)] font-medium' : 'text-[var(--text)]'}>{c.name}</span>
                      <span className="text-xs text-[var(--text-dim)]">· {count} él.</span>
                      <span className="ml-auto text-xs">{leaving ? '🗑️ supprimée' : '↪ conservée'}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {(() => {
              const leavingCount = studentGrades.filter(sg => leavingClassIds.has(sg.student.class_id ?? '') && !sg.student.is_witness).length;
              const keptCount = studentGrades.filter(sg => !leavingClassIds.has(sg.student.class_id ?? '') && !sg.student.is_witness).length;
              const [startYear] = trimesterSettings.school_year.split('-').map(Number);
              return (
                <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-4 text-sm">
                  <div className="text-[var(--text-muted)]">
                    Année <strong>{trimesterSettings.school_year}</strong> → <strong>{startYear + 1}-{startYear + 2}</strong>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-[var(--text)]">
                    <li>🗑️ <strong>{leavingCount}</strong> élève(s) sortant(s) supprimé(s) définitivement</li>
                    <li>↪ <strong>{keptCount}</strong> élève(s) conservé(s) (notes + tampons), détachés puis réattachés à la rentrée</li>
                    <li>♻️ Séances, événements et maisons remis à zéro</li>
                  </ul>
                </div>
              );
            })()}

            {/* Generate report option */}
            <div className="bg-[var(--indigo-soft)] border border-[var(--indigo)] rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateReportOnTrimesterEnd}
                  onChange={(e) => setGenerateReportOnTrimesterEnd(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[var(--indigo)] rounded"
                />
                <div>
                  <span className="text-sm font-medium text-[var(--indigo-ink)]">
                    Generer un rapport PDF de fin d'annee
                  </span>
                  <p className="text-xs text-[var(--indigo-ink)] mt-1">
                    Rapport complet du T3 avec analyse par classe et par niveau.
                  </p>
                </div>
              </label>
            </div>

            {/* Confirmation input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                Pour confirmer, tapez <strong className="text-[var(--neg)]">VACANCES</strong> :
              </label>
              <input
                type="text"
                value={endYearConfirmText}
                onChange={(e) => setEndYearConfirmText(e.target.value.toUpperCase())}
                placeholder="VACANCES"
                className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--neg)]"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEndYearModal(false);
                  setEndYearConfirmText('');
                }}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Annuler
              </button>
              <button
                onClick={handleEndYear}
                disabled={endYearConfirmText !== 'VACANCES' || isEndingYear || isGeneratingReport}
                className="px-4 py-2 bg-[var(--neg)] text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingReport ? 'Generation rapport...' : isEndingYear ? 'Cloture en cours...' : 'Terminer l\'annee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {showStudentDetailModal && selectedStudentForDetail && (() => {
        // Précédent / suivant suivent la liste affichée (classe, recherche, filtre, tri)
        const detailIndex = filteredAndSortedGrades.findIndex(g => g.student.id === selectedStudentForDetail.student.id);
        const previousStudent = detailIndex > 0 ? filteredAndSortedGrades[detailIndex - 1] : null;
        const nextStudent = detailIndex >= 0 && detailIndex < filteredAndSortedGrades.length - 1
          ? filteredAndSortedGrades[detailIndex + 1]
          : null;
        return (
          <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-50 p-4">
            <StudentDetailModal
              sg={selectedStudentForDetail}
              classes={classes}
              trimester={trimesterSettings.current_trimester}
              onClose={() => setShowStudentDetailModal(false)}
              onPrev={previousStudent ? () => void openStudentDetail(previousStudent) : null}
              onNext={nextStudent ? () => void openStudentDetail(nextStudent) : null}
              onChangeClass={(classId) => void changeStudentClass(classId)}
              onToggleGender={() => void toggleGender()}
              onToggleWitness={() => void toggleWitness()}
              onToggleAccommodation={(key) => void toggleAccommodation(key)}
              connection={connectionStats.get(selectedStudentForDetail.student.id)}
              connectionTimestamps={studentConnections}
              groupGrades={groupSessionGrades}
              groupGradesLoading={isLoadingGroupGrades}
              gradeReport={studentGradeReport}
              gradeReportLoading={examGradesLoading}
              stampDetail={studentStampDetail}
              stampDetailLoading={stampDetailLoading}
              onAddManual={openAddManualModal}
              onDeleteManual={(id) => void deleteManualParticipation(id)}
            />
          </div>
        );
      })()}

      {/* Add Manual Implication Modal */}
      {showAddManualModal && selectedStudentForDetail && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Ajouter une implication manuelle
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Pour: <strong>{selectedStudentForDetail.student.pseudo}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Nombre d'implications
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={manualCount}
                  onChange={(e) => setManualCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Raison (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Oral en classe, Expose..."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  maxLength={255}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowAddManualModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Annuler
              </button>
              <button
                onClick={addManualParticipation}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:bg-[var(--indigo)]/90 disabled:opacity-50"
              >
                {isSaving ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Student Codes Modal */}
      {showQrModal && qrDataUrl && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-sm flex flex-col items-center">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Acces eleve</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4 text-center">
              Scannez ce QR code pour acceder a l'interface eleve
            </p>
            <div className="bg-white p-4 rounded-xl mb-4">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
            </div>
            <code className="text-xs text-[var(--text-dim)] mb-4 bg-[var(--bg)] px-2 py-1 rounded">
              {window.location.origin}/gestion-classe/eleve
            </code>
            <button
              onClick={() => setShowQrModal(false)}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)] text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showCodesModal && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Codes d'acces eleves
              </h3>
              <button
                onClick={() => setShowCodesModal(false)}
                className="p-1 hover:bg-[var(--bg)] rounded text-[var(--text-muted)]"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-2">
              Lien : <code className="bg-[var(--bg)] px-1 rounded text-xs">/gestion-classe/eleve</code>
            </p>
            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {studentCodes.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-[var(--bg)]">
                  <span className="text-sm text-[var(--text)]">{s.pseudo}</span>
                  <code className="text-sm font-mono font-bold text-[var(--indigo)] tracking-widest">{s.code}</code>
                </div>
              ))}
              {studentCodes.length === 0 && (
                <p className="text-center text-[var(--text-dim)] py-4">Aucun eleve</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAllCodes}
                className="flex-1 px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:bg-[var(--indigo)]/90 text-sm"
              >
                Copier tous les codes
              </button>
              <button
                onClick={() => setShowCodesModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)] text-sm"
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
