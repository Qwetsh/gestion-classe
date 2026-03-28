import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { Layout } from '../components/Layout';
import { RoomModal } from '../components/RoomModal';
import type { Room } from '../components/RoomModal';
import { getCurrentSchoolYear, GRADE_CONFIG } from '../lib/constants';
import * as XLSX from 'xlsx';

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

export function Classes() {
  const { user } = useAuth();
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
  const [showGrades, setShowGrades] = useState(true);

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

  // Load students when class changes
  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass.id);
    } else {
      setStudents([]);
    }
  }, [selectedClass]);

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

      const { data: eventsData } = await supabase
        .from('events')
        .select('student_id, type')
        .in('student_id', studentIds)
        .gte('timestamp', trimesterStartDate);

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

        gradesMap.set(studentId, { studentId, participations: totalParticipations, malus, absences, grade });
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

  // Grade color helpers
  const getGradeColor = (grade: number): { bg: string; border: string; avatar: string; text: string } => {
    if (grade >= 16) return { bg: 'from-green-50 to-green-100', border: 'border-green-400', avatar: 'from-green-500 to-green-600', text: 'text-green-700' };
    if (grade >= 12) return { bg: 'from-blue-50 to-blue-100', border: 'border-blue-400', avatar: 'from-blue-500 to-blue-600', text: 'text-blue-700' };
    if (grade >= 8) return { bg: 'from-orange-50 to-orange-100', border: 'border-orange-400', avatar: 'from-orange-500 to-orange-600', text: 'text-orange-700' };
    return { bg: 'from-red-50 to-red-100', border: 'border-red-400', avatar: 'from-red-500 to-red-600', text: 'text-red-700' };
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
      alert('Erreur lors de la sauvegarde du plan de classe.');
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
      alert('Erreur lors de la suppression. Veuillez reessayer.');
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
      alert('Erreur lors de la suppression de la salle.');
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
      {loadError && (
        <div
          className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 mb-4 flex items-center justify-between"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <span>{loadError}</span>
          <button onClick={() => setLoadError(null)} className="text-[var(--color-error)] hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* LEFT SIDEBAR - Class list */}
        {!isMobile ? (
          <aside className="w-64 shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-[var(--color-text)]">Classes</h1>
              <button
                onClick={() => handleOpenClassModal()}
                className="p-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                title="Nouvelle classe"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {classes.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                  <div className="text-3xl mb-2">📚</div>
                  <p className="text-sm">Aucune classe</p>
                  <button
                    onClick={() => handleOpenClassModal()}
                    className="mt-3 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                  >
                    Creer une classe
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
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 group ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-white shadow-md'
                          : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{cls.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                        }`}>
                          {cls.students_count}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
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
              className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)]"
            >
              <option value="">Classe...</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name} ({cls.students_count})</option>
              ))}
            </select>
            <button
              onClick={() => handleOpenClassModal()}
              className="p-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
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
                <h2 className="text-lg font-medium text-[var(--color-text)]">
                  {classes.length === 0 ? 'Creez votre premiere classe' : 'Selectionnez une classe'}
                </h2>
                <p className="text-[var(--color-text-tertiary)] mt-2">
                  {classes.length === 0
                    ? 'Commencez par creer une classe dans le panneau de gauche'
                    : 'Choisissez une classe pour voir son plan de placement'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Room tab bar + actions */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* Room tabs */}
                <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0">
                  {rooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        selectedRoom?.id === room.id
                          ? 'bg-[var(--color-primary)] text-white shadow-sm'
                          : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {room.name}
                    </button>
                  ))}
                  <button
                    onClick={() => handleOpenRoomModal()}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors whitespace-nowrap"
                  >
                    + Salle
                  </button>
                </div>

                {/* Edit/delete current room */}
                {selectedRoom && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenRoomModal(selectedRoom)}
                      className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
                      title="Modifier la salle"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowRoomDeleteModal(true)}
                      className="p-1.5 text-[var(--color-text-tertiary)] hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="Supprimer la salle"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowStudentsPanel(!showStudentsPanel)}
                    className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Eleves ({students.length})
                  </button>

                  {selectedRoom && (
                    <button
                      onClick={() => setShowGrades(!showGrades)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                        showGrades
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
                      }`}
                      title={showGrades ? 'Masquer les notes' : 'Afficher les notes'}
                    >
                      Notes
                    </button>
                  )}

                  {selectedRoom && hasChanges && (
                    <button
                      onClick={handleSavePlan}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1.5 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                  )}

                  {/* Edit class */}
                  <button
                    onClick={() => handleOpenClassModal(selectedClass)}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
                    title="Modifier la classe"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal('class', selectedClass)}
                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title="Supprimer la classe"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Main content area */}
              {rooms.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🏫</div>
                    <h2 className="text-lg font-medium text-[var(--color-text)]">
                      Pas de salle disponible
                    </h2>
                    <p className="text-[var(--color-text-tertiary)] mt-2 mb-4">
                      Creez une salle pour commencer a placer vos eleves
                    </p>
                    <button
                      onClick={() => handleOpenRoomModal()}
                      className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                    >
                      Creer une salle
                    </button>
                  </div>
                </div>
              ) : !selectedRoom ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">🏫</div>
                    <h2 className="text-lg font-medium text-[var(--color-text)]">
                      Selectionnez une salle
                    </h2>
                    <p className="text-[var(--color-text-tertiary)] mt-2">
                      Choisissez une salle ci-dessus pour placer vos eleves
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 flex-1 min-h-0">
                  {/* Seating grid */}
                  <div className="flex-1 backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-[var(--color-text)]">
                        {selectedClass.name} — {selectedRoom.name}
                      </h2>
                      <span className="text-sm text-[var(--color-text-tertiary)]">
                        {students.length - unplacedStudents.length}/{students.length} places
                      </span>
                    </div>

                    {/* Grade legend */}
                    {showGrades && studentGrades.size > 0 && (
                      <div className="mb-4 flex items-center gap-4 text-xs">
                        <span className="text-[var(--color-text-tertiary)]">Legende:</span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-green-500 to-green-600" />
                          <span className="text-green-700">16-20</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
                          <span className="text-blue-700">12-16</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-orange-600" />
                          <span className="text-orange-700">8-12</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-red-600" />
                          <span className="text-red-700">&lt;8</span>
                        </span>
                      </div>
                    )}

                    {/* Grid */}
                    <div
                      className="grid gap-2 justify-center w-full"
                      style={{ gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, 1fr)`, maxWidth: `${selectedRoom.grid_cols * 100}px` }}
                    >
                      {Array.from({ length: selectedRoom.grid_rows * selectedRoom.grid_cols }).map((_, i) => {
                        const row = Math.floor(i / selectedRoom.grid_cols);
                        const col = i % selectedRoom.grid_cols;
                        const student = getStudentAtCell(row, col);
                        const isOver = dragOverCell?.row === row && dragOverCell?.col === col;
                        const isDisabled = isCellDisabled(row, col);

                        if (isDisabled) {
                          return (
                            <div
                              key={`${row}-${col}`}
                              className="aspect-square rounded-xl border border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-200 dark:bg-slate-700"
                              style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)'
                              }}
                              title="Allee (non disponible)"
                            />
                          );
                        }

                        const gradeData = student && showGrades ? getStudentGradeData(student.id) : undefined;
                        const gradeColors = gradeData ? getGradeColor(gradeData.grade) : null;

                        return (
                          <div
                            key={`${row}-${col}`}
                            className={`
                              aspect-square rounded-xl border-2 flex items-center justify-center
                              transition-all duration-200
                              ${student
                                ? `bg-gradient-to-br ${gradeColors ? gradeColors.bg : 'from-blue-50 to-blue-100'} ${gradeColors ? gradeColors.border : 'border-blue-300'} cursor-grab border-solid`
                                : 'bg-slate-50 border-slate-200 border-dashed hover:border-blue-300 hover:bg-blue-50'
                              }
                              ${isOver ? 'border-blue-500 bg-blue-100 scale-105' : ''}
                            `}
                            draggable={!!student}
                            onDragStart={() => student && handleDragStart(student.id, { row, col })}
                            onDragOver={(e) => handleDragOver(e, row, col)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(row, col)}
                          >
                            {student ? (
                              <div className="text-center p-1 relative group w-full">
                                <div className={`w-9 h-9 mx-auto rounded-full bg-gradient-to-br ${gradeColors ? gradeColors.avatar : 'from-blue-400 to-blue-600'} flex items-center justify-center text-white font-bold text-sm mb-0.5 relative`}>
                                  {student.pseudo.charAt(0)}
                                  {gradeData && showGrades && (
                                    <span className={`absolute -bottom-1 -right-1 min-w-[20px] h-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-white shadow-sm ${gradeColors?.text}`}>
                                      {gradeData.grade.toFixed(0)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-medium text-[var(--color-text)] truncate max-w-[75px] mx-auto leading-tight">
                                  {student.pseudo}
                                </div>
                                {gradeData && showGrades && (
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                      +{gradeData.participations} / -{gradeData.malus}
                                    </div>
                                  </div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveFromSeat(student.id); }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">{row + 1},{col + 1}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Teacher desk indicator */}
                    <div className="mt-6 flex justify-center">
                      <div className="px-8 py-2 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg text-slate-600 text-sm font-medium">
                        Tableau
                      </div>
                    </div>
                  </div>

                  {/* Unplaced students panel */}
                  <div className="w-72 backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-4 shadow-lg max-h-[calc(100vh-200px)] flex flex-col shrink-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-[var(--color-text)]">
                        Non places ({unplacedStudents.length})
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                      {unplacedStudents.map(student => {
                        const gradeData = showGrades ? getStudentGradeData(student.id) : undefined;
                        const gradeColors = gradeData ? getGradeColor(gradeData.grade) : null;

                        return (
                          <div
                            key={student.id}
                            draggable
                            onDragStart={() => handleDragStart(student.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-grab hover:shadow-md transition-shadow border ${
                              gradeColors
                                ? `bg-gradient-to-br ${gradeColors.bg} ${gradeColors.border}`
                                : 'bg-white/80 border-white/50'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradeColors ? gradeColors.avatar : 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-sm relative`}>
                              {student.pseudo.charAt(0)}
                              {gradeData && showGrades && (
                                <span className={`absolute -bottom-1 -right-1 min-w-[18px] h-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-white shadow-sm ${gradeColors?.text}`}>
                                  {gradeData.grade.toFixed(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-[var(--color-text)] truncate block">
                                {student.pseudo}
                              </span>
                              {gradeData && showGrades && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                  +{gradeData.participations} / -{gradeData.malus}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {unplacedStudents.length === 0 && (
                        <div className="text-center text-[var(--color-text-tertiary)] py-8">
                          Tous les eleves sont places
                        </div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="mt-4 pt-4 border-t border-white/30 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center justify-center gap-2"
                      >
                        Import CSV/Excel
                      </button>
                      <button
                        onClick={() => handleOpenStudentModal()}
                        className="w-full px-3 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                      >
                        + Ajouter un eleve
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Students management panel (modal) */}
      {showStudentsPanel && selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                Eleves - {selectedClass.name}
              </h3>
              <button
                onClick={() => setShowStudentsPanel(false)}
                className="p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background)] rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {students.length === 0 ? (
                <div className="text-center text-[var(--color-text-tertiary)] py-8">
                  Aucun eleve dans cette classe
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map(student => (
                    <div key={student.id} className="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold">
                        {student.pseudo.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[var(--color-text)]">{student.pseudo}</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          {placedStudentIds.has(student.id) ? 'Place' : 'Non place'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenStudentModal(student)}
                        className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded"
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

            <div className="p-4 border-t border-[var(--color-border)] flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
              >
                Import
              </button>
              <button
                onClick={() => handleOpenStudentModal()}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
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
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Supprimer la salle "{selectedRoom.name}" ? Les plans de classe associes seront aussi supprimes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRoomDeleteModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
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
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              {editingClass ? 'Modifier la classe' : 'Nouvelle classe'}
            </h3>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Nom de la classe (ex: 3eme B)"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)] mb-4"
              autoFocus
            />
            {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClassModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveClass}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
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
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              {editingStudent ? 'Modifier l\'eleve' : 'Nouvel eleve'}
            </h3>
            {editingStudent && (
              <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
                Pseudo actuel: <strong>{editingStudent.pseudo}</strong>
              </p>
            )}
            <div className="space-y-4 mb-4">
              <input
                type="text"
                value={studentFirstName}
                onChange={(e) => setStudentFirstName(e.target.value)}
                placeholder="Prenom"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                autoFocus
              />
              <input
                type="text"
                value={studentLastName}
                onChange={(e) => setStudentLastName(e.target.value)}
                placeholder="Nom"
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
              />
              {studentFirstName && studentLastName && (
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  Pseudo: <strong>{generatePseudo(studentFirstName, studentLastName)}</strong>
                </p>
              )}
            </div>
            {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveStudent}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
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
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-6">
              {deleteTarget.type === 'class'
                ? `Supprimer la classe "${(deleteTarget.item as Class).name}" et tous ses eleves ?`
                : `Supprimer l'eleve "${(deleteTarget.item as Student).pseudo}" ?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
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
