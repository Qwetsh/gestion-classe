import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { Layout } from '../components/Layout';
import { RoomModal } from '../components/RoomModal';
import type { Room } from '../components/RoomModal';
import { getCurrentSchoolYear, GRADE_CONFIG } from '../lib/constants';
import * as XLSX from 'xlsx';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { ClassChip, Icon } from '../components/design-system';
import { fetchAcademyConfig, toggleAcademyModule } from '../lib/academyQueries';

interface Class {
  id: string;
  name: string;
  created_at: string;
  students_count: number;
}

interface Student {
  id: string;
  pseudo: string;
  created_at: string;
}

interface StudentGradeData {
  studentId: string;
  participations: number;
  malus: number;
  absences: number;
  grade: number;
  sparkHistory: (number | null)[];
  trend: 'up' | 'down' | 'flat';
  trendDelta: number;
}

interface ClassConfig {
  target_participations: number;
  total_sessions_expected: number;
  bavardage_penalty: boolean;
  base_grade: number | null;
}

// Positions format: "row-col" -> studentId (compatible with mobile app)
type Positions = Record<string, string>;

interface ClassRoomPlan {
  id: string;
  class_id: string;
  room_id: string;
  positions: Positions;
}

type DragItem = { studentId: string; fromCell?: { row: number; col: number } };

const COLOR_PALETTE = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6','#F97316','#06B6D4','#84CC16','#E879F9','#FB923C'];

function getClassLabel(name: string): string {
  return name.replace(/ème groupe /i, 'G').replace(/ème /i, '').substring(0, 3);
}

function MiniSpark({ history }: { history: (number | null)[] }) {
  const w = 38, h = 14;
  const max = 2, min = -2;
  const pts = history.map((v, i) => {
    if (v === null) return null;
    const x = (i / (history.length - 1)) * w;
    const y = h / 2 - ((v - 0) / (max - min)) * h;
    return { x, y };
  }).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return null;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block', opacity: 0.85 }}>
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="currentColor" opacity={0.25} strokeWidth={0.5} />
      <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Classes() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const isMobile = useIsMobile();
  const [classes, setClasses] = useState<Class[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [plan, setPlan] = useState<ClassRoomPlan | null>(null);
  const [positions, setPositions] = useState<Positions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drag state
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ row: number; col: number } | null>(null);

  // Student grades for visual display
  const [studentGrades, setStudentGrades] = useState<Map<string, StudentGradeData>>(new Map());
  const [showGrades] = useState(true);

  // Modal states
  const [showClassModal, setShowClassModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStudentsPanel, setShowStudentsPanel] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showRoomDeleteModal, setShowRoomDeleteModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'class' | 'student'; item: Class | Student } | null>(null);

  // Form states
  const [className, setClassName] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Academy module
  const [academyEnabled, setAcademyEnabled] = useState(false);
  const [academyLoading, setAcademyLoading] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load classes and rooms
  useEffect(() => {
    if (user) {
      loadClasses();
      loadRooms();
    }
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: classesData, error } = await supabase
        .from('classes')
        .select('id, name, created_at')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      if (classesData && classesData.length > 0) {
        const classIds = classesData.map(c => c.id);
        const { data: allStudents, error: studentsError } = await supabase
          .from('students')
          .select('class_id')
          .in('class_id', classIds);

        if (studentsError) throw studentsError;

        const countByClass = new Map<string, number>();
        (allStudents || []).forEach(s => {
          const count = countByClass.get(s.class_id) || 0;
          countByClass.set(s.class_id, count + 1);
        });

        const classesWithCounts = classesData.map((cls) => ({
          ...cls,
          students_count: countByClass.get(cls.id) || 0,
        }));
        setClasses(classesWithCounts);
      } else {
        setClasses([]);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
      setLoadError('Erreur lors du chargement des classes.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRooms = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      setRooms((data || []).map(r => ({
        ...r,
        disabled_cells: r.disabled_cells || []
      })));
    } catch (err) {
      console.error('Error loading rooms:', err);
      setLoadError('Erreur lors du chargement des salles.');
    }
  };

  // Load students and academy config when class changes
  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass.id);
      loadAcademyConfig(selectedClass.id);
    } else {
      setStudents([]);
      setAcademyEnabled(false);
    }
  }, [selectedClass]);

  const loadAcademyConfig = async (classId: string) => {
    const config = await fetchAcademyConfig(classId);
    setAcademyEnabled(config?.enabled ?? false);
  };

  const handleToggleAcademy = async () => {
    if (!selectedClass || !user) return;
    setAcademyLoading(true);
    try {
      const newValue = !academyEnabled;
      await toggleAcademyModule(selectedClass.id, user.id, newValue);
      setAcademyEnabled(newValue);
      toast(newValue ? 'Académie des Quatre Lumières activée' : 'Module Académie désactivé', 'success');
    } catch (err) {
      console.error('Error toggling academy:', err);
      toast('Erreur lors de la mise à jour', 'error');
    } finally {
      setAcademyLoading(false);
    }
  };

  // Auto-select first room when rooms load or class changes
  useEffect(() => {
    if (selectedClass && rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0]);
    }
  }, [selectedClass, rooms]);

  const loadStudents = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, pseudo, created_at')
        .eq('class_id', classId)
        .order('pseudo');

      if (error) throw error;
      setStudents(data || []);

      if (data && data.length > 0) {
        await loadStudentGrades(classId, data.map(s => s.id));
      } else {
        setStudentGrades(new Map());
      }
    } catch (err) {
      console.error('Error loading students:', err);
      setLoadError('Erreur lors du chargement des eleves.');
      setStudents([]);
    }
  };

  // Load student grades for visual display on seating chart
  const loadStudentGrades = async (classId: string, studentIds: string[]) => {
    if (!user || studentIds.length === 0) return;

    try {
      const { data: configData } = await supabase
        .from('class_trimester_config')
        .select('*')
        .eq('class_id', classId)
        .single();

      const config: ClassConfig = configData ? {
        target_participations: configData.target_participations,
        total_sessions_expected: configData.total_sessions_expected,
        bavardage_penalty: configData.bavardage_penalty ?? false,
        base_grade: configData.base_grade ?? null,
      } : {
        target_participations: GRADE_CONFIG.DEFAULT_TARGET_PARTICIPATIONS,
        total_sessions_expected: GRADE_CONFIG.DEFAULT_SESSIONS_EXPECTED,
        bavardage_penalty: false,
        base_grade: null,
      };

      const { data: settingsData } = await supabase
        .from('trimester_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const currentTrimester = settingsData?.current_trimester || 1;
      const currentSchoolYear = settingsData?.school_year || getCurrentSchoolYear();

      const { data: boundaryData } = await supabase
        .from('trimester_boundaries')
        .select('started_at')
        .eq('user_id', user.id)
        .eq('trimester', currentTrimester)
        .eq('school_year', currentSchoolYear)
        .single();

      const trimesterStartDate = boundaryData?.started_at || new Date(0).toISOString();

      // Paginate events query to bypass Supabase's 1000-row default limit
      const EVENTS_PAGE_SIZE = 1000;
      const allEventsData: any[] = [];
      let eventsFrom = 0;
      let hasMoreEvents = true;

      while (hasMoreEvents) {
        const { data, error: eventsError } = await supabase
          .from('events')
          .select('student_id, type, session_id')
          .in('student_id', studentIds)
          .gte('timestamp', trimesterStartDate)
          .range(eventsFrom, eventsFrom + EVENTS_PAGE_SIZE - 1);

        if (eventsError) {
          console.error('Error loading events:', eventsError);
          break;
        }

        if (data && data.length > 0) {
          allEventsData.push(...data);
        }

        hasMoreEvents = data !== null && data.length === EVENTS_PAGE_SIZE;
        eventsFrom += EVENTS_PAGE_SIZE;
      }

      const eventsData = allEventsData;

      const { data: manualData } = await supabase
        .from('manual_participations')
        .select('student_id, count')
        .in('student_id', studentIds)
        .eq('trimester', currentTrimester)
        .eq('school_year', currentSchoolYear);

      const gradesMap = new Map<string, StudentGradeData>();

      studentIds.forEach(studentId => {
        const studentEvents = (eventsData || []).filter(e => e.student_id === studentId);
        const participations = studentEvents.filter(e => e.type === 'participation').length;
        const malus = studentEvents.filter(e => e.type === 'bavardage').length;
        const absences = studentEvents.filter(e => e.type === 'absence').length;

        const manualCount = (manualData || [])
          .filter(m => m.student_id === studentId)
          .reduce((sum, m) => sum + m.count, 0);

        const totalParticipations = participations + manualCount;

        let grade: number;
        if (config.base_grade !== null && config.base_grade > 0) {
          const modifier = config.bavardage_penalty
            ? totalParticipations - malus
            : totalParticipations;
          grade = Math.min(20, Math.max(0, config.base_grade + modifier));
        } else {
          const effectiveParticipations = config.bavardage_penalty
            ? Math.max(0, totalParticipations - malus)
            : totalParticipations;
          const reductionPerAbsence = config.target_participations / config.total_sessions_expected;
          const adjustedTarget = Math.max(1, config.target_participations - (absences * reductionPerAbsence));
          grade = Math.min(20, Math.max(0, (effectiveParticipations / adjustedTarget) * 20));
        }

        // Compute sparkline history (last 10 sessions)
        const sessionGroups: Record<string, { pos: number; neg: number }> = {};
        studentEvents.forEach(e => {
          const sid = e.session_id;
          if (!sid) return;
          if (!sessionGroups[sid]) sessionGroups[sid] = { pos: 0, neg: 0 };
          if (e.type === 'participation') sessionGroups[sid].pos++;
          else if (e.type === 'bavardage') sessionGroups[sid].neg++;
        });
        const sessionScores = Object.values(sessionGroups).map(g => Math.max(-2, Math.min(2, g.pos - g.neg)));
        const sparkHistory: (number | null)[] = Array(10).fill(null);
        const last10 = sessionScores.slice(-10);
        last10.forEach((v, i) => { sparkHistory[10 - last10.length + i] = v; });

        // Compute trend
        const nonNull = sparkHistory.filter(v => v !== null) as number[];
        let trendDelta = 0;
        if (nonNull.length >= 2) {
          const mid = Math.floor(nonNull.length / 2);
          const first = nonNull.slice(0, mid);
          const second = nonNull.slice(mid);
          const avg1 = first.reduce((a, b) => a + b, 0) / first.length;
          const avg2 = second.reduce((a, b) => a + b, 0) / second.length;
          trendDelta = avg2 - avg1;
        }
        const trend: 'up' | 'down' | 'flat' = trendDelta > 0.15 ? 'up' : trendDelta < -0.15 ? 'down' : 'flat';

        gradesMap.set(studentId, { studentId, participations: totalParticipations, malus, absences, grade, sparkHistory, trend, trendDelta });
      });

      setStudentGrades(gradesMap);
    } catch (err) {
      console.error('Error loading student grades:', err);
    }
  };

  // Load plan when class+room changes
  useEffect(() => {
    if (selectedClass && selectedRoom) {
      loadPlan(selectedClass.id, selectedRoom.id);
    } else {
      setPlan(null);
      setPositions({});
    }
  }, [selectedClass, selectedRoom]);

  const loadPlan = async (classId: string, roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('class_room_plans')
        .select('*')
        .eq('class_id', classId)
        .eq('room_id', roomId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPlan(data);
        setPositions(data.positions || {});
      } else {
        setPlan(null);
        setPositions({});
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading plan:', err);
      setLoadError('Erreur lors du chargement du plan de classe.');
      setPlan(null);
      setPositions({});
    }
  };

  // Computed
  const placedStudentIds = new Set(Object.values(positions));
  const unplacedStudents = students.filter(s => !placedStudentIds.has(s.id));

  const getStudentAtCell = (row: number, col: number): Student | undefined => {
    const key = `${row}-${col}`;
    const studentId = positions[key];
    return studentId ? students.find(s => s.id === studentId) : undefined;
  };

  const isCellDisabled = (row: number, col: number): boolean => {
    return selectedRoom?.disabled_cells?.includes(`${row},${col}`) || false;
  };

  const getStudentGradeData = (studentId: string): StudentGradeData | undefined => {
    return studentGrades.get(studentId);
  };

  // Drag & Drop handlers
  const handleDragStart = (studentId: string, fromCell?: { row: number; col: number }) => {
    setDragItem({ studentId, fromCell });
  };

  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    setDragOverCell({ row, col });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (row: number, col: number) => {
    if (!dragItem) return;
    if (isCellDisabled(row, col)) {
      setDragItem(null);
      setDragOverCell(null);
      return;
    }

    const targetKey = `${row}-${col}`;
    const existingStudentAtTarget = getStudentAtCell(row, col);

    setPositions(prev => {
      const newPositions = { ...prev };
      for (const [key, studentId] of Object.entries(newPositions)) {
        if (studentId === dragItem.studentId) {
          if (existingStudentAtTarget) {
            newPositions[key] = existingStudentAtTarget.id;
          } else {
            delete newPositions[key];
          }
          break;
        }
      }
      if (existingStudentAtTarget && !dragItem.fromCell) {
        delete newPositions[targetKey];
      }
      newPositions[targetKey] = dragItem.studentId;
      return newPositions;
    });

    setHasChanges(true);
    setDragItem(null);
    setDragOverCell(null);
  };

  const handleDropToPool = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItem?.studentId) {
      handleRemoveFromSeat(dragItem.studentId);
    }
    setDragItem(null);
  };

  const handleRemoveFromSeat = (studentId: string) => {
    setPositions(prev => {
      const newPositions = { ...prev };
      for (const [key, id] of Object.entries(newPositions)) {
        if (id === studentId) {
          delete newPositions[key];
          break;
        }
      }
      return newPositions;
    });
    setHasChanges(true);
  };

  // Save plan
  const handleSavePlan = async () => {
    if (!selectedClass || !selectedRoom || !user) return;
    setIsSaving(true);

    try {
      if (plan) {
        const { error } = await supabase
          .from('class_room_plans')
          .update({ positions, updated_at: new Date().toISOString() })
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_room_plans').insert({
          class_id: selectedClass.id,
          room_id: selectedRoom.id,
          user_id: user.id,
          positions,
        });
        if (error) throw error;
      }

      await loadPlan(selectedClass.id, selectedRoom.id);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving plan:', error);
      toast('Erreur lors de la sauvegarde du plan de classe.');
    } finally {
      setIsSaving(false);
    }
  };

  // CRUD Classes
  const handleOpenClassModal = (cls?: Class) => {
    if (cls) {
      setEditingClass(cls);
      setClassName(cls.name);
    } else {
      setEditingClass(null);
      setClassName('');
    }
    setFormError('');
    setShowClassModal(true);
  };

  const handleSaveClass = async () => {
    const trimmedName = className.trim();
    if (!trimmedName) { setFormError('Le nom de la classe est requis'); return; }
    if (trimmedName.length > 50) { setFormError('Le nom de la classe ne peut pas depasser 50 caracteres'); return; }
    if (trimmedName.length < 2) { setFormError('Le nom de la classe doit contenir au moins 2 caracteres'); return; }
    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({ name: className.trim(), updated_at: new Date().toISOString() })
          .eq('id', editingClass.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert({ name: className.trim(), user_id: user!.id });
        if (error) throw error;
      }

      setShowClassModal(false);
      loadClasses();
    } catch (error) {
      console.error('Error saving class:', error);
      setFormError('Erreur lors de la sauvegarde. Veuillez reessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // CRUD Students
  const generatePseudo = (firstName: string, lastName: string) => {
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim().toUpperCase();
    return `${cleanFirst} ${cleanLast.substring(0, 2)}.`;
  };

  const handleOpenStudentModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
    } else {
      setEditingStudent(null);
    }
    setStudentFirstName('');
    setStudentLastName('');
    setFormError('');
    setShowStudentModal(true);
  };

  const handleSaveStudent = async () => {
    const trimmedFirst = studentFirstName.trim();
    const trimmedLast = studentLastName.trim();

    if (!trimmedFirst || !trimmedLast) { setFormError('Le prenom et le nom sont requis'); return; }
    if (trimmedFirst.length > 50 || trimmedLast.length > 50) { setFormError('Le prenom et le nom ne peuvent pas depasser 50 caracteres'); return; }
    if (trimmedFirst.length < 2) { setFormError('Le prenom doit contenir au moins 2 caracteres'); return; }
    if (!selectedClass) return;

    setIsSubmitting(true);
    const pseudo = generatePseudo(trimmedFirst, trimmedLast);

    try {
      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update({ pseudo, updated_at: new Date().toISOString() })
          .eq('id', editingStudent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('students').insert({
          pseudo,
          class_id: selectedClass.id,
          user_id: user!.id,
        });
        if (error) throw error;
      }

      setShowStudentModal(false);
      loadStudents(selectedClass.id);
      loadClasses();
    } catch (error) {
      console.error('Error saving student:', error);
      setFormError('Erreur lors de la sauvegarde. Veuillez reessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleOpenDeleteModal = (type: 'class' | 'student', item: Class | Student) => {
    setDeleteTarget({ type, item });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);

    try {
      if (deleteTarget.type === 'class') {
        const { error: studentsError } = await supabase.from('students').delete().eq('class_id', deleteTarget.item.id);
        if (studentsError) throw studentsError;
        const { error: plansError } = await supabase.from('class_room_plans').delete().eq('class_id', deleteTarget.item.id);
        if (plansError) throw plansError;
        const { error: classError } = await supabase.from('classes').delete().eq('id', deleteTarget.item.id);
        if (classError) throw classError;
        setSelectedClass(null);
        setSelectedRoom(null);
      } else {
        const { error } = await supabase.from('students').delete().eq('id', deleteTarget.item.id);
        if (error) throw error;
        const keyToDelete = Object.entries(positions).find(
          ([, studentId]) => studentId === deleteTarget.item.id
        )?.[0];
        if (keyToDelete) {
          setPositions(prev => {
            const newPos = { ...prev };
            delete newPos[keyToDelete];
            return newPos;
          });
          setHasChanges(true);
        }
        if (selectedClass) loadStudents(selectedClass.id);
      }

      setShowDeleteModal(false);
      setDeleteTarget(null);
      loadClasses();
    } catch (error) {
      console.error('Error deleting:', error);
      toast('Erreur lors de la suppression. Veuillez reessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Room management
  const handleOpenRoomModal = (room?: Room) => {
    setEditingRoom(room || null);
    setShowRoomModal(true);
  };

  const handleRoomSaved = async () => {
    await loadRooms();
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    setIsSubmitting(true);
    try {
      // Clean up plans referencing this room
      await supabase.from('class_room_plans').delete().eq('room_id', selectedRoom.id);
      const { error } = await supabase.from('rooms').delete().eq('id', selectedRoom.id);
      if (error) throw error;
      setSelectedRoom(null);
      setShowRoomDeleteModal(false);
      await loadRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      toast('Erreur lors de la suppression de la salle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse Pronote CSV format
  const parsePronoteNameField = (nameField: string): { firstName: string; lastName: string } | null => {
    const parts = nameField.trim().split(/\s+/);
    if (parts.length < 2) return null;
    let firstNameIndex = parts.findIndex(part => part !== part.toUpperCase());
    if (firstNameIndex === -1) firstNameIndex = parts.length - 1;
    const lastName = parts.slice(0, firstNameIndex).join(' ');
    const firstName = parts.slice(firstNameIndex).join(' ');
    if (!firstName || !lastName) return null;
    return { firstName, lastName };
  };

  // Import file
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClass) return;

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let studentsToInsert: { pseudo: string; class_id: string; user_id: string }[] = [];

        if (isCSV) {
          const text = e.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          for (const line of lines) {
            const fields = line.split(';');
            const nameField = fields[0]?.replace(/^"|"$/g, '').trim();
            if (!nameField) continue;
            const parsed = parsePronoteNameField(nameField);
            if (parsed) {
              studentsToInsert.push({
                pseudo: generatePseudo(parsed.firstName, parsed.lastName),
                class_id: selectedClass.id,
                user_id: user!.id,
              });
            }
          }
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<{ Prénom?: string; Prenom?: string; Nom?: string }>(worksheet);
          studentsToInsert = rows
            .filter((row) => (row.Prénom || row.Prenom) && row.Nom)
            .map((row) => ({
              pseudo: generatePseudo((row.Prénom || row.Prenom || '').trim(), (row.Nom || '').trim()),
              class_id: selectedClass.id,
              user_id: user!.id,
            }));
        }

        if (studentsToInsert.length > 0) {
          await supabase.from('students').insert(studentsToInsert);
          loadStudents(selectedClass.id);
          loadClasses();
        }
      } catch (error) {
        console.error('Import error:', error);
      }
    };

    if (isCSV) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  };

  if (isLoading) {
    return (
      <Layout fluid>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fluid>
      {/* Error banner */}
      {loadError && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>{loadError}</span>
          <button onClick={() => setLoadError(null)} style={{ color: 'var(--neg)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 18, flexWrap: 'wrap' as const }}>
        <div>
          <div className="breadcrumb">
            <a href="#">Accueil</a>
            <span>›</span>
            <span className="current">Plans de classe</span>
          </div>
          <h1 className="page-title">Plan de salle</h1>
          <p className="page-subtitle">Glissez-déposez les élèves depuis le panneau latéral. Survolez un bureau pour voir la fiche.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowStudentsPanel(!showStudentsPanel)} className="btn btn--ghost" style={{ fontSize: 13 }}>
            <Icon name="grid" size={14} /> Vue tableau
          </button>
          <button className="btn btn--ghost" style={{ fontSize: 13 }} onClick={() => window.print()}>
            Imprimer le plan
          </button>
          <button onClick={handleSavePlan} disabled={isSaving || !hasChanges} className="btn btn--accent" style={{ opacity: hasChanges ? 1 : 0.5 }}>
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: !isMobile ? '230px 1fr 280px' : '1fr', gap: 16, alignItems: 'start', minHeight: 'calc(100vh - 220px)' }}>
        {/* LEFT SIDEBAR - Classes pane */}
        {!isMobile ? (
          <div className="classes-pane">
            <div className="classes-pane__head">
              <span>CLASSES</span>
              <button
                onClick={() => handleOpenClassModal()}
                style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 6, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Nouvelle classe"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            <div className="classes-pane__list">
              {classes.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 13 }}>Aucune classe</p>
                  <button onClick={() => handleOpenClassModal()} className="btn btn--primary" style={{ marginTop: 12, fontSize: 12 }}>
                    Créer une classe
                  </button>
                </div>
              ) : (
                classes.map(cls => {
                  const isActive = selectedClass?.id === cls.id;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => {
                        setSelectedClass(cls);
                        setSelectedRoom(null);
                      }}
                      className={`class-row ${isActive ? 'is-active' : ''}`}
                    >
                      <ClassChip label={getClassLabel(cls.name)} color={COLOR_PALETTE[classes.indexOf(cls) % COLOR_PALETTE.length]} size={28} muted={!isActive} />
                      <div>
                        <div className="class-row__name">{cls.name}</div>
                        <div className="class-row__meta">{cls.students_count} élèves</div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {cls.students_count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Mobile: class selector dropdown */
          <div className="w-full mb-4 flex gap-2 items-center" style={{ position: 'relative' }}>
            <select
              value={selectedClass?.id || ''}
              onChange={(e) => {
                const cls = classes.find(c => c.id === e.target.value);
                setSelectedClass(cls || null);
                setSelectedRoom(null);
              }}
              className="flex-1 px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)]"
            >
              <option value="">Classe...</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name} ({cls.students_count})</option>
              ))}
            </select>
            <button
              onClick={() => handleOpenClassModal()}
              className="p-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90"
              title="Nouvelle classe"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}

        {/* MAIN AREA */}
        <main className={`flex-1 flex flex-col min-w-0 ${isMobile ? '' : ''}`}>
          {!selectedClass ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4">📚</div>
                <h2 className="text-lg font-medium text-[var(--text)]">
                  {classes.length === 0 ? 'Creez votre premiere classe' : 'Selectionnez une classe'}
                </h2>
                <p className="text-[var(--text-dim)] mt-2">
                  {classes.length === 0
                    ? 'Commencez par creer une classe dans le panneau de gauche'
                    : 'Choisissez une classe pour voir son plan de placement'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Room tabs + meta */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 10 }}>
                  {/* Room tabs (pill style) */}
                  <div style={{ display: 'flex', gap: 4, background: 'var(--surface-3)', padding: 3, borderRadius: 9 }}>
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                          color: selectedRoom?.id === room.id ? 'var(--text)' : 'var(--text-muted)',
                          background: selectedRoom?.id === room.id ? 'var(--surface)' : 'transparent',
                          boxShadow: selectedRoom?.id === room.id ? 'var(--shadow-1)' : 'none',
                          border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.12s',
                        }}
                      >
                        {room.name}
                      </button>
                    ))}
                    <button
                      onClick={() => handleOpenRoomModal()}
                      style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, color: 'var(--indigo)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      + Salle
                    </button>
                  </div>

                  {/* Meta info + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedRoom && selectedClass && (
                      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        <span style={{ marginRight: 6, verticalAlign: 'middle', display: 'inline-flex' }}>
                          <ClassChip label={getClassLabel(selectedClass.name)} color={COLOR_PALETTE[classes.indexOf(selectedClass) % COLOR_PALETTE.length]} size={22} />
                        </span>
                        {selectedClass.name} · <b>{students.length - unplacedStudents.length}/{students.length}</b> placés · {selectedRoom.name}
                      </span>
                    )}
                    {selectedRoom && (
                      <>
                        <button onClick={() => handleOpenRoomModal(selectedRoom)} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} title="Modifier la salle">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => setShowRoomDeleteModal(true)} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} title="Supprimer la salle">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Main content area */}
              {rooms.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🏫</div>
                    <h2 className="text-lg font-medium text-[var(--text)]">
                      Pas de salle disponible
                    </h2>
                    <p className="text-[var(--text-dim)] mt-2 mb-4">
                      Creez une salle pour commencer a placer vos eleves
                    </p>
                    <button
                      onClick={() => handleOpenRoomModal()}
                      className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90"
                    >
                      Creer une salle
                    </button>
                  </div>
                </div>
              ) : !selectedRoom ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🏫</div>
                    <h2 className="text-lg font-medium text-[var(--text)]">
                      Selectionnez une salle
                    </h2>
                    <p className="text-[var(--text-dim)] mt-2">
                      Choisissez une salle ci-dessus pour placer vos eleves
                    </p>
                  </div>
                </div>
              ) : (
                <div className="room-canvas" style={{ flex: 1, minHeight: 0 }}>
                  {/* Legend */}
                  <div className="room-legend" style={{ marginBottom: 12 }}>
                    <span className="leg"><i style={{ background: 'var(--pos)' }} /> 16-20</span>
                    <span className="leg"><i style={{ background: 'var(--indigo)' }} /> 12-16</span>
                    <span className="leg"><i style={{ background: 'var(--warn)' }} /> 8-12</span>
                    <span className="leg"><i style={{ background: 'var(--neg)' }} /> &lt;8</span>
                    <span className="leg" style={{ marginLeft: 12, color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em', fontWeight: 600 }}>Tendance</span>
                    <span className="leg"><span style={{ color: 'var(--pos)', fontWeight: 700, marginRight: 3 }}>↗</span> en hausse</span>
                    <span className="leg"><span style={{ color: 'var(--neg)', fontWeight: 700, marginRight: 3 }}>↘</span> en baisse</span>
                  </div>

                  {/* Seat grid */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', zIndex: 1 }}>
                    {Array.from({ length: selectedRoom.grid_rows }).map((_, rowIdx) => (
                      <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, 1fr)`, gap: 8, alignItems: 'start' }}>
                        {Array.from({ length: selectedRoom.grid_cols }).map((_, colIdx) => {
                          const student = getStudentAtCell(rowIdx, colIdx);
                          const isOver = dragOverCell?.row === rowIdx && dragOverCell?.col === colIdx;
                          const isDisabled = isCellDisabled(rowIdx, colIdx);

                          if (isDisabled) {
                            return <div key={`${rowIdx}-${colIdx}`} style={{ height: 112 }} />;
                          }

                          const gradeData = student && showGrades ? getStudentGradeData(student.id) : undefined;
                          const grade = gradeData?.grade ?? 10;
                          const barColor = grade >= 16 ? 'var(--pos)' : grade >= 12 ? 'var(--indigo)' : grade >= 8 ? 'var(--warn)' : 'var(--neg)';

                          return (
                            <div
                              key={`${rowIdx}-${colIdx}`}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: student ? 'grab' : 'default' }}
                              draggable={!!student}
                              onDragStart={() => student && handleDragStart(student.id, { row: rowIdx, col: colIdx })}
                              onDragOver={(e) => handleDragOver(e, rowIdx, colIdx)}
                              onDragLeave={handleDragLeave}
                              onDrop={() => handleDrop(rowIdx, colIdx)}
                            >
                              {/* Chair */}
                              <div className={student ? 'desk-3d__chair' : 'desk-3d--empty desk-3d__chair'} />

                              {/* Desk with pill inside */}
                              <div className={student ? 'desk-3d' : 'desk-3d desk-3d--empty'} style={{
                                outline: isOver ? '2px dashed var(--accent)' : 'none',
                                outlineOffset: isOver ? 2 : 0,
                              }}>
                                {!student && (
                                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', fontSize: 11, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', pointerEvents: 'none' }}>
                                    {rowIdx + 1}-{colIdx + 1}
                                  </div>
                                )}
                                {student && (
                                  <div className="student-pill" style={{ position: 'absolute', top: 6, left: 5, right: 5, bottom: 4, zIndex: 2 }}>
                                    <div className="student-pill__bar" style={{ background: barColor }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                          {student.pseudo.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase()}
                                        </span>
                                        {gradeData && (
                                          <span style={{ fontSize: 10, fontWeight: 700, color: gradeData.trend === 'up' ? 'var(--pos)' : gradeData.trend === 'down' ? 'var(--neg)' : 'var(--text-dim)' }}>
                                            {gradeData.trend === 'up' ? '↗' : gradeData.trend === 'down' ? '↘' : '→'}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '1px 0' }}>
                                        {student.pseudo}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                        {gradeData && (
                                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                            {gradeData.grade.toFixed(0)}<span style={{ fontSize: 9, color: 'var(--text-muted)' }}>/20</span>
                                          </span>
                                        )}
                                        {gradeData && <MiniSpark history={gradeData.sparkHistory} />}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Teacher desk */}
                  <div style={{ margin: '18px auto 0', width: 70, height: 24, borderRadius: 3, background: 'linear-gradient(180deg, #D4B089, #B68E67)', boxShadow: '0 2px 0 0 #8B6B51, 0 4px 8px rgba(0,0,0,0.12)', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>PROF</div>
                  </div>

                  {/* Chalkboard */}
                  <div style={{ margin: '16px auto 0', width: '60%', maxWidth: 500, height: 32, borderRadius: 4, background: 'linear-gradient(180deg, #2D3748, #1A202C)', boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>Tableau</span>
                  </div>

                  {/* Door indicator */}
                  <div style={{ position: 'absolute', bottom: 8, right: 16, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)', fontSize: 11 }}>
                    <Icon name="door" size={14} />
                    <span>Porte</span>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* RIGHT SIDEBAR - Pool (unplaced students) */}
        {selectedClass && selectedRoom && (
          <div className="pool" onDragOver={(e) => e.preventDefault()} onDrop={handleDropToPool}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="pool__title">Non placés</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {unplacedStudents.length} sur {students.length}
                </div>
              </div>
            </div>

            {unplacedStudents.length === 0 ? (
              <div className="pool__empty">
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pos)', color: '#fff', margin: '0 auto 8px', display: 'grid', placeItems: 'center', fontSize: 16 }}>✓</div>
                Tous les élèves sont placés.
                <small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400, marginTop: 4 }}>
                  Glissez ici un élève d'un bureau pour le retirer.
                </small>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unplacedStudents.map(student => {
                  const gradeData = showGrades ? getStudentGradeData(student.id) : undefined;
                  const grade = gradeData?.grade ?? 10;
                  const barColor = grade >= 16 ? 'var(--pos)' : grade >= 12 ? 'var(--indigo)' : grade >= 8 ? 'var(--warn)' : 'var(--neg)';

                  return (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={() => handleDragStart(student.id)}
                      style={{ padding: 4, borderRadius: 10, cursor: 'grab', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div className="student-pill" style={{ width: '100%' }}>
                        <div className="student-pill__bar" style={{ background: barColor }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                              {student.pseudo.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '1px 0' }}>
                            {student.pseudo}
                          </div>
                          {gradeData && showGrades && (
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                              {gradeData.grade.toFixed(0)}<span style={{ fontSize: 9, color: 'var(--text-muted)' }}>/20</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Academy toggle */}
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: 8,
                  background: academyEnabled ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                  cursor: academyLoading ? 'wait' : 'pointer',
                  transition: 'background 0.2s',
                  fontSize: 12, color: 'var(--text)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🏰</span>
                  <span style={{ fontWeight: 500 }}>Académie</span>
                </span>
                <div
                  onClick={handleToggleAcademy}
                  style={{
                    width: 34, height: 18, borderRadius: 9,
                    background: academyEnabled ? 'var(--indigo)' : 'var(--border)',
                    position: 'relative', cursor: academyLoading ? 'wait' : 'pointer',
                    transition: 'background 0.2s', flexShrink: 0,
                    opacity: academyLoading ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#fff', position: 'absolute', top: 2,
                    left: academyEnabled ? 18 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </label>

              <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".xlsx,.xls,.csv" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="btn btn--ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                Import CSV / Excel
              </button>
              <button onClick={() => handleOpenStudentModal()} className="btn btn--accent" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                + Ajouter un élève
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students management panel (modal) */}
      {showStudentsPanel && selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Eleves - {selectedClass.name}
              </h3>
              <button
                onClick={() => setShowStudentsPanel(false)}
                className="p-2 text-[var(--text-dim)] hover:bg-[var(--bg)] rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {students.length === 0 ? (
                <div className="text-center text-[var(--text-dim)] py-8">
                  Aucun eleve dans cette classe
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map(student => (
                    <div key={student.id} className="flex items-center gap-3 p-3 bg-[var(--bg)] rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-[var(--indigo)] flex items-center justify-center text-white font-semibold">
                        {student.pseudo.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--text)]">{student.pseudo}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          {placedStudentIds.has(student.id) ? 'Place' : 'Non place'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenStudentModal(student)}
                        className="p-2 text-[var(--indigo)] hover:bg-[var(--indigo)]/10 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenDeleteModal('student', student)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
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

            <div className="p-4 border-t border-[var(--border)] flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Import
              </button>
              <button
                onClick={() => handleOpenStudentModal()}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90"
              >
                + Ajouter un eleve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Modal */}
      <RoomModal
        isOpen={showRoomModal}
        onClose={() => { setShowRoomModal(false); setEditingRoom(null); }}
        onSaved={handleRoomSaved}
        editingRoom={editingRoom}
        userId={user!.id}
      />

      {/* Room Delete Modal */}
      {showRoomDeleteModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-[var(--text-muted)] mb-6">
              Supprimer la salle "{selectedRoom.name}" ? Les plans de classe associes seront aussi supprimes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRoomDeleteModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteRoom}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              {editingClass ? 'Modifier la classe' : 'Nouvelle classe'}
            </h3>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Nom de la classe (ex: 3eme B)"
              className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)] mb-4"
              autoFocus
            />
            {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClassModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveClass}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'En cours...' : editingClass ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              {editingStudent ? 'Modifier l\'eleve' : 'Nouvel eleve'}
            </h3>
            {editingStudent && (
              <p className="text-sm text-[var(--text-dim)] mb-4">
                Pseudo actuel: <strong>{editingStudent.pseudo}</strong>
              </p>
            )}
            <div className="space-y-4 mb-4">
              <input
                type="text"
                value={studentFirstName}
                onChange={(e) => setStudentFirstName(e.target.value)}
                placeholder="Prenom"
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                autoFocus
              />
              <input
                type="text"
                value={studentLastName}
                onChange={(e) => setStudentLastName(e.target.value)}
                placeholder="Nom"
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
              />
              {studentFirstName && studentLastName && (
                <p className="text-sm text-[var(--text-dim)]">
                  Pseudo: <strong>{generatePseudo(studentFirstName, studentLastName)}</strong>
                </p>
              )}
            </div>
            {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveStudent}
                className="px-4 py-2 bg-[var(--indigo)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'En cours...' : editingStudent ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-[var(--text-muted)] mb-6">
              {deleteTarget.type === 'class'
                ? `Supprimer la classe "${(deleteTarget.item as Class).name}" et tous ses eleves ?`
                : `Supprimer l'eleve "${(deleteTarget.item as Student).pseudo}" ?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
