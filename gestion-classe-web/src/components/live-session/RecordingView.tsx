import { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, Mic, Pencil, MessageSquare, Shuffle, Trash2, X } from 'lucide-react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { SessionTimer } from './SessionTimer';
import { StudentCell, type StudentCounts } from './StudentCell';
import { WebRadialMenu } from './WebRadialMenu';
import { RemarqueInput } from './RemarqueInput';
import { DB, ACTION_LABELS } from './directionB';
import { MobileSheet, SheetTitle, SheetButton, SheetGhostButton } from './MobileSheet';
import { StudentPickerSheet } from './StudentPickerSheet';
import { UndoBanner, type UndoBannerState } from './UndoBanner';

const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Très bien',
};

const SORTIE_LABELS: Record<string, string> = {
  infirmerie: 'Infirmerie',
  toilettes: 'Toilettes',
  convocation: 'Convocation',
  exclusion: 'Exclusion',
};

interface MenuTarget {
  studentId: string;
  pseudo: string;
  position: { x: number; y: number };
}

export function RecordingView() {
  const {
    selectedClass, selectedRoom, students, positions, events,
    startedAt, notes, loading, error, activeSorties, oralEvaluations,
    addEvent, removeLastEvent, deleteEventById, endSession, cancelSessionAction,
    minimize, updateNotes, markReturn, addOralEvaluation, resetOralEvaluations,
    getAbsentStudentIds, getStudentWithSortie,
  } = useLiveSession();
  const { confirm: showConfirm } = useUIFeedback();

  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [remarqueTarget, setRemarqueTarget] = useState<{ studentId: string; pseudo: string } | null>(null);
  const [showRemarquePicker, setShowRemarquePicker] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Banniere verte de confirmation (undo 4 s)
  const [undoBanner, setUndoBanner] = useState<UndoBannerState | null>(null);

  // Tirage au sort (sheet 9a)
  const [randomPicked, setRandomPicked] = useState<string | null>(null);
  const [showRandomSheet, setShowRandomSheet] = useState(false);

  // Session notes (sheet 9c)
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [notesText, setNotesText] = useState(notes || '');

  // Oral evaluation (sheet 9b)
  const [showOralSheet, setShowOralSheet] = useState(false);
  const [showOralPicker, setShowOralPicker] = useState(false);
  const [oralStudent, setOralStudent] = useState<{ id: string; pseudo: string } | null>(null);
  const [oralGrade, setOralGrade] = useState<number | null>(null);

  // Event deletion
  const [showDeletePicker, setShowDeletePicker] = useState(false);
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);

  const studentMap = useMemo(
    () => new Map(students.map(s => [s.id, s])),
    [students]
  );

  const absentIds = useMemo(() => getAbsentStudentIds(), [getAbsentStudentIds, events]);

  // Pre-compute counts per student to avoid passing full events array to each cell
  const countsByStudent = useMemo(() => {
    const map = new Map<string, StudentCounts>();
    const typeMap: Record<string, keyof StudentCounts> = {
      participation: 'participation', bavardage: 'malus', absence: 'absence', sortie: 'sortie', remarque: 'remarque',
    };
    for (const e of events) {
      const key = typeMap[e.type];
      if (!key) continue;
      let c = map.get(e.student_id);
      if (!c) { c = { participation: 0, malus: 0, absence: 0, sortie: 0, remarque: 0 }; map.set(e.student_id, c); }
      c[key]++;
    }
    return map;
  }, [events]);

  const presentStudents = useMemo(
    () => students.filter(s => !absentIds.has(s.id) && !activeSorties[s.id]),
    [students, absentIds, activeSorties]
  );

  const handleStudentPress = useCallback((studentId: string, pseudo: string, rect: DOMRect) => {
    setMenuTarget({
      studentId,
      pseudo,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    });
  }, []);

  const handleMenuSelect = useCallback((type: string, subtype?: string | null) => {
    if (!menuTarget) return;
    const { studentId, pseudo } = menuTarget;
    addEvent(studentId, type, subtype);
    setMenuTarget(null);
    const label = subtype
      ? `${ACTION_LABELS[type] ?? type} · ${SORTIE_LABELS[subtype] ?? subtype}`
      : ACTION_LABELS[type] ?? type;
    setUndoBanner({
      message: `${pseudo} · ${label}`,
      variant: 'success',
      onUndo: () => removeLastEvent(studentId, type),
    });
  }, [menuTarget, addEvent, removeLastEvent]);

  const handleRemarqueSubmit = useCallback((note: string, photo?: File | null) => {
    if (!remarqueTarget) return;
    addEvent(remarqueTarget.studentId, 'remarque', null, note, photo);
    setUndoBanner({
      message: `${remarqueTarget.pseudo} · Remarque`,
      variant: 'success',
      onUndo: null,
    });
    setRemarqueTarget(null);
  }, [remarqueTarget, addEvent]);

  // Double-tap absence cancellation
  const handleAbsenceCancel = useCallback((studentId: string) => {
    removeLastEvent(studentId, 'absence');
  }, [removeLastEvent]);

  // Sortie return
  const handleSortieReturn = useCallback((studentId: string) => {
    markReturn(studentId);
  }, [markReturn]);

  // Tirage au sort (9a)
  const drawRandom = useCallback(() => {
    if (presentStudents.length === 0) {
      setRandomPicked(null);
      return;
    }
    const selected = presentStudents[Math.floor(Math.random() * presentStudents.length)];
    setRandomPicked(selected.pseudo);
    if (navigator.vibrate) navigator.vibrate([15]);
  }, [presentStudents]);

  const handleRandomOpen = useCallback(() => {
    drawRandom();
    setShowRandomSheet(true);
  }, [drawRandom]);

  // Notes (9c)
  const handleOpenNotes = useCallback(() => {
    setNotesText(notes || '');
    setShowNotesSheet(true);
  }, [notes]);

  const handleSaveNotes = useCallback(() => {
    updateNotes(notesText.trim() || null);
    setShowNotesSheet(false);
  }, [notesText, updateNotes]);

  // Oral evaluation (9b)
  const evaluatedStudentIds = useMemo(
    () => new Set(oralEvaluations.map(e => e.student_id)),
    [oralEvaluations]
  );

  const unevaluatedStudents = useMemo(
    () => students.filter(s => !absentIds.has(s.id) && !evaluatedStudentIds.has(s.id)),
    [students, absentIds, evaluatedStudentIds]
  );

  const drawOralStudent = useCallback(() => {
    if (unevaluatedStudents.length === 0) return;
    const selected = unevaluatedStudents[Math.floor(Math.random() * unevaluatedStudents.length)];
    setOralStudent({ id: selected.id, pseudo: selected.pseudo });
    setOralGrade(null);
  }, [unevaluatedStudents]);

  const handleOralButton = useCallback(async () => {
    if (unevaluatedStudents.length === 0) {
      const ok = await showConfirm({ title: 'Réinitialiser', message: 'Tous les élèves ont été évalués.\n\nRéinitialiser les évaluations ?', confirmLabel: 'Réinitialiser', variant: 'warning' });
      if (ok) resetOralEvaluations();
      return;
    }
    drawOralStudent();
    setShowOralSheet(true);
  }, [unevaluatedStudents, resetOralEvaluations, showConfirm, drawOralStudent]);

  const handleOralManual = useCallback((student: { id: string; pseudo: string }) => {
    setShowOralPicker(false);
    setOralStudent(student);
    setOralGrade(null);
    setShowOralSheet(true);
  }, []);

  const handleSaveOral = useCallback(() => {
    if (!oralStudent || oralGrade === null) return;
    addOralEvaluation(oralStudent.id, oralGrade);
    setShowOralSheet(false);
    setOralStudent(null);
    setOralGrade(null);
  }, [oralStudent, oralGrade, addOralEvaluation]);

  // Delete events
  const studentsWithEventsList = useMemo(() => {
    const eventsByStudent: Record<string, number> = {};
    for (const e of events) {
      eventsByStudent[e.student_id] = (eventsByStudent[e.student_id] || 0) + 1;
    }
    return students.filter(s => (eventsByStudent[s.id] || 0) > 0).map(s => ({
      id: s.id,
      pseudo: s.pseudo,
      badge: `${eventsByStudent[s.id]} evt${eventsByStudent[s.id] > 1 ? 's' : ''}`,
    }));
  }, [students, events]);

  const studentEventsForDelete = useMemo(() => {
    if (!deleteStudentId) return [];
    return events.filter(e => e.student_id === deleteStudentId);
  }, [deleteStudentId, events]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const ok = await showConfirm({ title: 'Supprimer', message: 'Supprimer cet événement ?', confirmLabel: 'Supprimer', variant: 'danger' });
    if (ok) deleteEventById(eventId);
  }, [deleteEventById, showConfirm]);

  if (!selectedRoom || !startedAt) return null;

  // Build grid
  const totalCells = selectedRoom.grid_rows * selectedRoom.grid_cols;
  const totalEvents = events.length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ overscrollBehavior: 'contain', background: DB.background }}>
      {/* Header blanc plat (6a) */}
      <div
        className="flex items-center shrink-0"
        style={{
          background: DB.surface,
          borderBottom: `1px solid ${DB.border}`,
          padding: '8px 12px',
          gap: 4,
        }}
      >
        <button
          onClick={minimize}
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-black/5 shrink-0"
          style={{ border: 'none', background: 'transparent' }}
          title="Retour au dashboard"
        >
          <ChevronLeft size={20} color={DB.text} strokeWidth={2} />
        </button>
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="shrink-0"
          style={{
            border: 'none',
            background: 'transparent',
            color: DB.error,
            fontSize: 13,
            fontWeight: 500,
            padding: '6px 4px',
          }}
        >
          Annuler
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="truncate" style={{ fontSize: 15, fontWeight: 700, color: DB.text }}>
            {selectedClass?.name}{selectedRoom ? ` · ${selectedRoom.name}` : ''}
          </div>
          <SessionTimer startedAt={startedAt} />
        </div>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="shrink-0 active:scale-[0.97] transition-transform"
          style={{
            background: DB.action,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            borderRadius: 9,
            padding: '8px 14px',
          }}
        >
          Terminer
        </button>
      </div>

      {/* Toolbar 5 cartes */}
      <div className="flex shrink-0" style={{ gap: 6, padding: '10px 12px 0' }}>
        <ToolbarButton icon={<Shuffle size={17} color={DB.text} strokeWidth={1.8} />} label="Aléatoire" onClick={handleRandomOpen} />
        <ToolbarButton
          icon={<Mic size={17} color={DB.text} strokeWidth={1.8} />}
          label="Oral"
          badge={`${evaluatedStudentIds.size}/${students.filter(s => !absentIds.has(s.id)).length}`}
          onClick={handleOralButton}
        />
        <ToolbarButton icon={<Pencil size={17} color={DB.text} strokeWidth={1.8} />} label="Note" indicator={!!notes} onClick={handleOpenNotes} />
        <ToolbarButton
          icon={<MessageSquare size={17} color={DB.text} strokeWidth={1.8} />}
          label="Remarque"
          onClick={() => setShowRemarquePicker(true)}
        />
        <ToolbarButton
          icon={<Trash2 size={17} color={DB.text} strokeWidth={1.8} />}
          label="Supprimer"
          onClick={() => {
            if (studentsWithEventsList.length === 0) return;
            setShowDeletePicker(true);
          }}
          disabled={studentsWithEventsList.length === 0}
        />
      </div>

      {/* Hint */}
      <p className="text-center shrink-0" style={{ fontSize: 12.5, color: DB.textTertiary, margin: '8px 0 0' }}>
        Appuyer sur un élève
      </p>

      {/* Banniere de confirmation / undo */}
      {error ? (
        <UndoBanner banner={{ message: error, variant: 'error' }} onDismiss={() => {}} />
      ) : undoBanner ? (
        <UndoBanner banner={undoBanner} onDismiss={() => setUndoBanner(null)} />
      ) : null}

      {/* Seating grid */}
      <div className="flex-1 overflow-auto" style={{ padding: 12 }}>
        <div
          className="grid mx-auto"
          style={{
            gap: 3,
            gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, 1fr)`,
            maxWidth: `${selectedRoom.grid_cols * 63}px`,
          }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const row = Math.floor(idx / selectedRoom.grid_cols);
            const col = idx % selectedRoom.grid_cols;
            const key = `${row}-${col}`;
            const isDisabled = selectedRoom.disabled_cells?.includes(`${row},${col}`);
            const studentId = positions[key];
            const student = studentId ? studentMap.get(studentId) : null;

            if (isDisabled || !student) {
              return <div key={key} style={{ minHeight: 52, borderRadius: 8, background: DB.surfaceDisabled }} />;
            }

            return (
              <StudentCell
                key={key}
                studentId={student.id}
                pseudo={student.pseudo}
                counts={countsByStudent.get(student.id) || { participation: 0, malus: 0, absence: 0, sortie: 0, remarque: 0 }}
                activeSortie={getStudentWithSortie(student.id)}
                onPress={(rect) => handleStudentPress(student.id, student.pseudo, rect)}
                onDoubleTap={() => handleAbsenceCancel(student.id)}
                onSortieReturn={() => handleSortieReturn(student.id)}
              />
            );
          })}
        </div>

        {/* Tableau */}
        <div
          className="mx-auto mt-3 text-center"
          style={{
            maxWidth: `${selectedRoom.grid_cols * 63}px`,
            background: DB.segmentTrack,
            borderRadius: 8,
            padding: '8px 0',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: DB.textSecondary,
          }}
        >
          Tableau
        </div>
      </div>

      {/* Radial menu */}
      {menuTarget && (
        <WebRadialMenu
          studentPseudo={menuTarget.pseudo}
          position={menuTarget.position}
          onSelect={handleMenuSelect}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {/* Remarque : selecteur d'eleve puis saisie */}
      {showRemarquePicker && (
        <StudentPickerSheet
          title="Remarque"
          subtitle="Sélectionner un élève"
          students={students.filter(s => !absentIds.has(s.id)).map(s => ({ id: s.id, pseudo: s.pseudo }))}
          onSelect={(s) => {
            setShowRemarquePicker(false);
            setRemarqueTarget({ studentId: s.id, pseudo: s.pseudo });
          }}
          onClose={() => setShowRemarquePicker(false)}
        />
      )}
      {remarqueTarget && (
        <RemarqueInput
          studentPseudo={remarqueTarget.pseudo}
          onSubmit={handleRemarqueSubmit}
          onCancel={() => setRemarqueTarget(null)}
        />
      )}

      {/* ========== SHEETS ========== */}

      {/* Tirage au sort (9a) */}
      {showRandomSheet && (
        <MobileSheet onClose={() => setShowRandomSheet(false)}>
          <div className="flex items-baseline justify-between mb-3">
            <SheetTitle>Tirage au sort</SheetTitle>
            <span style={{ fontSize: 13, fontWeight: 500, color: DB.textSecondary }}>
              {presentStudents.length} présent{presentStudents.length > 1 ? 's' : ''}
            </span>
          </div>
          <div
            className="text-center mb-4"
            style={{ background: DB.primarySoft, borderRadius: 16, padding: 24 }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: DB.primary, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Élève tiré
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: DB.text, margin: '6px 0' }}>
              {randomPicked ?? '—'}
            </p>
            <p style={{ fontSize: 13.5, color: DB.textSecondary, margin: 0 }}>
              Parmi les élèves présents
            </p>
          </div>
          <div className="flex gap-3">
            <SheetGhostButton onClick={drawRandom}>
              <span className="inline-flex items-center gap-2">
                <Shuffle size={16} color={DB.text} strokeWidth={1.8} /> Relancer
              </span>
            </SheetGhostButton>
            <SheetButton onClick={() => setShowRandomSheet(false)}>C'est lui !</SheetButton>
          </div>
        </MobileSheet>
      )}

      {/* Evaluation orale (9b) */}
      {showOralSheet && (
        <MobileSheet onClose={() => { setShowOralSheet(false); setOralStudent(null); }}>
          <SheetTitle
            right={
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: DB.primary,
                  background: DB.primarySoft,
                  borderRadius: 999,
                  padding: '4px 10px',
                }}
              >
                {evaluatedStudentIds.size}/{students.filter(s => !absentIds.has(s.id)).length} évalués
              </span>
            }
          >
            Évaluation orale
          </SheetTitle>
          <p style={{ fontSize: 13, color: DB.textSecondary, margin: '0 0 12px' }}>
            {unevaluatedStudents.length} restant{unevaluatedStudents.length > 1 ? 's' : ''}
          </p>

          {/* Eleve tire */}
          <div
            className="flex items-center gap-3 mb-4"
            style={{
              background: DB.background,
              border: `1px solid ${DB.border}`,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: DB.text }}
            >
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                {oralStudent ? oralStudent.pseudo.charAt(0).toUpperCase() : '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ fontSize: 16, fontWeight: 600, color: DB.text, margin: 0 }}>
                {oralStudent?.pseudo ?? '—'}
              </p>
              <p style={{ fontSize: 12, color: DB.textTertiary, margin: 0 }}>
                Tiré parmi les non-évalués
              </p>
            </div>
            <button
              onClick={() => { setShowOralSheet(false); setShowOralPicker(true); }}
              style={{ border: 'none', background: 'transparent', color: DB.primary, fontSize: 14, fontWeight: 600 }}
            >
              Choisir
            </button>
          </div>

          {/* Notes 0-5 */}
          <div className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map(grade => (
              <button
                key={grade}
                onClick={() => { setOralGrade(grade); if (navigator.vibrate) navigator.vibrate(8); }}
                style={{
                  height: 52,
                  borderRadius: 12,
                  fontSize: 17,
                  fontWeight: 700,
                  border: oralGrade === grade ? 'none' : `1px solid ${DB.border}`,
                  background: oralGrade === grade ? DB.primary : DB.surface,
                  color: oralGrade === grade ? '#fff' : DB.text,
                }}
              >
                {grade}
              </button>
            ))}
          </div>
          <p className="text-center" style={{ fontSize: 13, fontWeight: 500, color: DB.textSecondary, margin: '10px 0 14px', minHeight: 18 }}>
            {oralGrade !== null && ORAL_GRADE_LABELS[oralGrade] ? ORAL_GRADE_LABELS[oralGrade] : ' '}
          </p>

          <div className="flex">
            <SheetButton
              onClick={handleSaveOral}
              disabled={oralGrade === null || !oralStudent}
              color={DB.action}
            >
              Enregistrer {oralGrade !== null ? `${oralGrade}/5` : ''}
            </SheetButton>
          </div>
        </MobileSheet>
      )}

      {/* Oral : choisir un eleve */}
      {showOralPicker && (
        <StudentPickerSheet
          title="Choisir un élève"
          subtitle={`${unevaluatedStudents.length} élève${unevaluatedStudents.length > 1 ? 's' : ''} non évalué${unevaluatedStudents.length > 1 ? 's' : ''}`}
          students={unevaluatedStudents.map(s => ({ id: s.id, pseudo: s.pseudo }))}
          onSelect={(s) => handleOralManual({ id: s.id, pseudo: s.pseudo })}
          onClose={() => setShowOralPicker(false)}
        />
      )}

      {/* Note de seance (9c) */}
      {showNotesSheet && (
        <MobileSheet onClose={() => setShowNotesSheet(false)}>
          <SheetTitle>Note de séance</SheetTitle>
          <p style={{ fontSize: 13, color: DB.textSecondary, margin: '0 0 12px' }}>
            Notions incomprises, remarques générales, à reprendre la prochaine fois…
          </p>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Vos notes sur cette séance…"
            rows={4}
            maxLength={500}
            autoFocus
            className="w-full resize-none"
            style={{
              padding: 14,
              fontSize: 16,
              background: DB.background,
              color: DB.text,
              border: `1px solid ${DB.border}`,
              borderRadius: 12,
              outline: 'none',
              minHeight: 110,
            }}
          />
          <p className="text-right" style={{ fontSize: 11.5, color: DB.textTertiary, margin: '4px 0 14px' }}>
            {notesText.length}/500
          </p>
          <div className="flex gap-3">
            <SheetGhostButton onClick={() => setShowNotesSheet(false)}>Annuler</SheetGhostButton>
            <SheetButton onClick={handleSaveNotes}>Enregistrer</SheetButton>
          </div>
        </MobileSheet>
      )}

      {/* Suppression : selecteur d'eleve */}
      {showDeletePicker && (
        <StudentPickerSheet
          title="Supprimer un événement"
          subtitle="Sélectionner un élève"
          students={studentsWithEventsList}
          onSelect={(s) => {
            setShowDeletePicker(false);
            setDeleteStudentId(s.id);
          }}
          onClose={() => setShowDeletePicker(false)}
        />
      )}

      {/* Suppression : evenements de l'eleve */}
      {deleteStudentId && (
        <MobileSheet onClose={() => setDeleteStudentId(null)}>
          <SheetTitle>Événements — {studentMap.get(deleteStudentId)?.pseudo}</SheetTitle>
          <div className="overflow-y-auto my-3" style={{ maxHeight: 320 }}>
            {studentEventsForDelete.length === 0 ? (
              <p className="text-center py-4" style={{ fontSize: 14, color: DB.textTertiary }}>
                Aucun événement restant
              </p>
            ) : (
              studentEventsForDelete.map((evt, index) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '11px 4px',
                    borderTop: index > 0 ? `1px solid ${DB.borderLight}` : 'none',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span style={{ fontSize: 14, fontWeight: 600, color: DB.text }}>
                      {getEventLabel(evt.type)}
                      {evt.subtype ? ` · ${SORTIE_LABELS[evt.subtype] ?? evt.subtype}` : ''}
                    </span>
                    {evt.note && (
                      <span className="block truncate" style={{ fontSize: 12, color: DB.textTertiary }}>
                        {evt.note}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="w-8 h-8 flex items-center justify-center shrink-0 ml-2"
                    style={{
                      border: `1px solid ${DB.error}`,
                      borderRadius: 8,
                      background: 'transparent',
                    }}
                  >
                    <X size={14} color={DB.error} strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-3">
            <SheetGhostButton
              onClick={() => { setDeleteStudentId(null); setShowDeletePicker(true); }}
            >
              ← Autre élève
            </SheetGhostButton>
            <SheetButton onClick={() => setDeleteStudentId(null)}>Fermer</SheetButton>
          </div>
        </MobileSheet>
      )}

      {/* Terminer la seance */}
      {showEndConfirm && (
        <MobileSheet onClose={() => setShowEndConfirm(false)}>
          <SheetTitle>Terminer la séance ?</SheetTitle>
          <p style={{ fontSize: 13.5, color: DB.textSecondary, margin: '0 0 16px' }}>
            {totalEvents} événement{totalEvents !== 1 ? 's' : ''} enregistré{totalEvents !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-3">
            <SheetGhostButton onClick={() => setShowEndConfirm(false)}>Continuer</SheetGhostButton>
            <SheetButton
              onClick={() => { setShowEndConfirm(false); endSession(); }}
              disabled={loading}
              color={DB.action}
            >
              Terminer
            </SheetButton>
          </div>
        </MobileSheet>
      )}

      {/* Annuler la seance */}
      {showCancelConfirm && (
        <MobileSheet onClose={() => setShowCancelConfirm(false)}>
          <SheetTitle>Annuler la séance ?</SheetTitle>
          <p style={{ fontSize: 13.5, color: DB.textSecondary, margin: '0 0 16px' }}>
            La séance sera supprimée et aucun événement ne sera conservé.
          </p>
          <div className="flex gap-3">
            <SheetGhostButton onClick={() => setShowCancelConfirm(false)}>Non</SheetGhostButton>
            <SheetButton
              onClick={() => { setShowCancelConfirm(false); cancelSessionAction(); }}
              disabled={loading}
              color={DB.error}
            >
              Oui, annuler
            </SheetButton>
          </div>
        </MobileSheet>
      )}
    </div>
  );
}

// ========== Helper Components ==========

function ToolbarButton({
  icon,
  label,
  badge,
  indicator,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  indicator?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center relative transition-all ${disabled ? 'opacity-30' : 'active:scale-[0.97]'}`}
      style={{
        gap: 3,
        padding: '9px 2px',
        background: DB.surface,
        border: `1px solid ${DB.border}`,
        borderRadius: 10,
      }}
    >
      {icon}
      <span style={{ fontSize: 10.5, fontWeight: 600, color: DB.text }}>{label}</span>
      {badge && (
        <span
          className="absolute"
          style={{
            top: 3,
            right: 3,
            fontSize: 9,
            fontWeight: 600,
            color: DB.primary,
            background: DB.primarySoft,
            borderRadius: 999,
            padding: '1px 4px',
          }}
        >
          {badge}
        </span>
      )}
      {indicator && (
        <span
          className="absolute rounded-full"
          style={{ top: 5, right: 5, width: 7, height: 7, background: DB.primary }}
        />
      )}
    </button>
  );
}

function getEventLabel(type: string): string {
  const labels: Record<string, string> = {
    participation: 'Implication',
    bavardage: 'Malus',
    absence: 'Absence',
    remarque: 'Remarque',
    sortie: 'Sortie',
    retour: 'Retour',
  };
  return labels[type] || type;
}
