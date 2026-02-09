import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import * as XLSX from 'xlsx';

interface Class {
  id: string;
  name: string;
  created_at: string;
  students_count: number;
}

interface Room {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  disabled_cells: string[];
}

interface Student {
  id: string;
  pseudo: string;
  created_at: string;
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

  // Modal states
  const [showClassModal, setShowClassModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStudentsPanel, setShowStudentsPanel] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
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

      if (classesData) {
        const classesWithCounts = await Promise.all(
          classesData.map(async (cls) => {
            const { count } = await supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id);
            return { ...cls, students_count: count || 0 };
          })
        );
        setClasses(classesWithCounts);
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

  const loadStudents = async (classId: string) => {
    const { data } = await supabase
      .from('students')
      .select('id, pseudo, created_at')
      .eq('class_id', classId)
      .order('pseudo');
    setStudents(data || []);
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
    const { data } = await supabase
      .from('class_room_plans')
      .select('*')
      .eq('class_id', classId)
      .eq('room_id', roomId)
      .single();

    if (data) {
      setPlan(data);
      setPositions(data.positions || {});
    } else {
      setPlan(null);
      setPositions({});
    }
    setHasChanges(false);
  };

  // Computed: students not placed (check if student ID is in any position value)
  const placedStudentIds = new Set(Object.values(positions));
  const unplacedStudents = students.filter(s => !placedStudentIds.has(s.id));

  // Computed: grid with placed students (key is "row-col", value is studentId)
  const getStudentAtCell = (row: number, col: number): Student | undefined => {
    const key = `${row}-${col}`;
    const studentId = positions[key];
    return studentId ? students.find(s => s.id === studentId) : undefined;
  };

  // Check if a cell is disabled (aisle)
  const isCellDisabled = (row: number, col: number): boolean => {
    return selectedRoom?.disabled_cells?.includes(`${row},${col}`) || false;
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

    // Don't allow dropping on disabled cells (aisles)
    if (isCellDisabled(row, col)) {
      setDragItem(null);
      setDragOverCell(null);
      return;
    }

    const targetKey = `${row}-${col}`;
    const existingStudentAtTarget = getStudentAtCell(row, col);

    setPositions(prev => {
      const newPositions = { ...prev };

      // Remove the dragged student from their previous position (if any)
      for (const [key, studentId] of Object.entries(newPositions)) {
        if (studentId === dragItem.studentId) {
          // If swapping with existing student at target, move them to this position
          if (existingStudentAtTarget) {
            newPositions[key] = existingStudentAtTarget.id;
          } else {
            delete newPositions[key];
          }
          break;
        }
      }

      // If there was a student at target and we're NOT swapping (dragging from unplaced), remove them
      if (existingStudentAtTarget && !dragItem.fromCell) {
        // Don't remove - they were moved to dragged student's old position or removed above
        delete newPositions[targetKey];
      }

      // Place the dragged student at target
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
      // Find and remove the key that has this student ID as value
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
        // Update existing
        const { error } = await supabase
          .from('class_room_plans')
          .update({ positions, updated_at: new Date().toISOString() })
          .eq('id', plan.id);
        if (error) throw error;
      } else {
        // Create new
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
    if (!className.trim()) {
      setFormError('Le nom de la classe est requis');
      return;
    }
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
    if (!studentFirstName.trim() || !studentLastName.trim()) {
      setFormError('Le prenom et le nom sont requis');
      return;
    }
    if (!selectedClass) return;

    setIsSubmitting(true);
    const pseudo = generatePseudo(studentFirstName, studentLastName);

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
        // Remove from positions if placed (positions are keyed by "row-col", value is student ID)
        // Find the key first, then update state separately
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
          <button
            onClick={() => setLoadError(null)}
            className="text-[var(--color-error)] hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Classes</h1>

          {/* Class selector */}
          <select
            value={selectedClass?.id || ''}
            onChange={(e) => {
              const cls = classes.find(c => c.id === e.target.value);
              setSelectedClass(cls || null);
              setSelectedRoom(null);
            }}
            className="px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)]"
          >
            <option value="">Sélectionner une classe</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name} ({cls.students_count})</option>
            ))}
          </select>

          {/* Room selector */}
          {selectedClass && (
            <select
              value={selectedRoom?.id || ''}
              onChange={(e) => {
                const room = rooms.find(r => r.id === e.target.value);
                setSelectedRoom(room || null);
              }}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-text)]"
            >
              <option value="">Sélectionner une salle</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {/* Actions */}
          {selectedClass && (
            <button
              onClick={() => setShowStudentsPanel(!showStudentsPanel)}
              className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)] flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Élèves ({students.length})
            </button>
          )}

          {selectedClass && selectedRoom && hasChanges && (
            <button
              onClick={handleSavePlan}
              disabled={isSaving}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          )}

          <button
            onClick={() => handleOpenClassModal()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <span>+</span> Nouvelle classe
          </button>
        </div>

        {/* Main content */}
        {!selectedClass ? (
          <div className="bg-[var(--color-surface)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              Sélectionnez une classe
            </h2>
            <p className="text-[var(--color-text-tertiary)] mt-2">
              {classes.length === 0 ? 'Créez votre première classe pour commencer' : 'Choisissez une classe dans le menu ci-dessus'}
            </p>
          </div>
        ) : !selectedRoom ? (
          <div className="bg-[var(--color-surface)] rounded-xl p-12 text-center">
            <div className="text-4xl mb-4">🏫</div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">
              Sélectionnez une salle
            </h2>
            <p className="text-[var(--color-text-tertiary)] mt-2">
              {rooms.length === 0 ? 'Créez d\'abord une salle dans l\'onglet Salles' : 'Choisissez une salle pour placer vos élèves'}
            </p>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Seating grid */}
            <div className="flex-1 backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[var(--color-text)]">
                  Plan de classe - {selectedClass.name} / {selectedRoom.name}
                </h2>
                <span className="text-sm text-[var(--color-text-tertiary)]">
                  {students.length - unplacedStudents.length}/{students.length} placés
                </span>
              </div>

              {/* Grid */}
              <div
                className="grid gap-3 justify-center"
                style={{ gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, minmax(80px, 100px))` }}
              >
                {Array.from({ length: selectedRoom.grid_rows * selectedRoom.grid_cols }).map((_, i) => {
                  const row = Math.floor(i / selectedRoom.grid_cols);
                  const col = i % selectedRoom.grid_cols;
                  const student = getStudentAtCell(row, col);
                  const isOver = dragOverCell?.row === row && dragOverCell?.col === col;
                  const isDisabled = isCellDisabled(row, col);

                  // Disabled cell (aisle)
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

                  return (
                    <div
                      key={`${row}-${col}`}
                      className={`
                        aspect-square rounded-xl border-2 border-dashed flex items-center justify-center
                        transition-all duration-200
                        ${student
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 cursor-grab'
                          : 'bg-slate-50 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
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
                        <div className="text-center p-2 relative group">
                          <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm mb-1">
                            {student.pseudo.charAt(0)}
                          </div>
                          <div className="text-xs font-medium text-[var(--color-text)] truncate max-w-[80px]">
                            {student.pseudo}
                          </div>
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
            <div className="w-72 backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-4 shadow-lg max-h-[calc(100vh-200px)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--color-text)]">
                  Non placés ({unplacedStudents.length})
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {unplacedStudents.map(student => (
                  <div
                    key={student.id}
                    draggable
                    onDragStart={() => handleDragStart(student.id)}
                    className="flex items-center gap-3 p-3 bg-white/80 rounded-xl cursor-grab hover:shadow-md transition-shadow border border-white/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white font-bold text-sm">
                      {student.pseudo.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-medium text-[var(--color-text)] truncate">
                      {student.pseudo}
                    </span>
                  </div>
                ))}
                {unplacedStudents.length === 0 && (
                  <div className="text-center text-[var(--color-text-tertiary)] py-8">
                    Tous les élèves sont placés
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
                  📥 Import CSV/Excel
                </button>
                <button
                  onClick={() => handleOpenStudentModal()}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                >
                  + Ajouter un élève
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Students management panel (modal-like) */}
        {showStudentsPanel && selectedClass && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-surface)] rounded-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">
                  Élèves - {selectedClass.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenClassModal(selectedClass)}
                    className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded"
                    title="Modifier la classe"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal('class', selectedClass)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                    title="Supprimer la classe"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowStudentsPanel(false)}
                    className="p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background)] rounded"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {students.length === 0 ? (
                  <div className="text-center text-[var(--color-text-tertiary)] py-8">
                    Aucun élève dans cette classe
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
                            {placedStudentIds.has(student.id) ? 'Placé' : 'Non placé'}
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
                  📥 Import
                </button>
                <button
                  onClick={() => handleOpenStudentModal()}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                >
                  + Ajouter un élève
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
                placeholder="Nom de la classe (ex: 3ème B)"
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
                  {isSubmitting ? 'En cours...' : editingClass ? 'Modifier' : 'Créer'}
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
                {editingStudent ? 'Modifier l\'élève' : 'Nouvel élève'}
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
                  placeholder="Prénom"
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
                  ? `Supprimer la classe "${(deleteTarget.item as Class).name}" et tous ses élèves ?`
                  : `Supprimer l'élève "${(deleteTarget.item as Student).pseudo}" ?`}
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
      </div>
    </Layout>
  );
}
