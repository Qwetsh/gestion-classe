import { useState, useCallback, useMemo } from 'react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { SessionTimer } from './SessionTimer';
import { StudentCell } from './StudentCell';
import { WebRadialMenu } from './WebRadialMenu';
import { RemarqueInput } from './RemarqueInput';

const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Tres bien',
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

  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [remarqueTarget, setRemarqueTarget] = useState<{ studentId: string; pseudo: string } | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Random student picker
  const [randomStudent, setRandomStudent] = useState<string | null>(null);

  // Session notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesText, setNotesText] = useState(notes || '');

  // Oral evaluation
  const [showOralModal, setShowOralModal] = useState(false);
  const [showOralPicker, setShowOralPicker] = useState(false);
  const [oralStudent, setOralStudent] = useState<{ id: string; pseudo: string } | null>(null);
  const [oralGrade, setOralGrade] = useState<number | null>(null);

  // Event deletion
  const [showDeletePicker, setShowDeletePicker] = useState(false);
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
  const [showDeleteEvents, setShowDeleteEvents] = useState(false);

  const studentMap = useMemo(
    () => new Map(students.map(s => [s.id, s])),
    [students]
  );

  const absentIds = useMemo(() => getAbsentStudentIds(), [getAbsentStudentIds, events]);

  const handleStudentTap = useCallback((studentId: string, pseudo: string, rect: DOMRect) => {
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
    addEvent(menuTarget.studentId, type, subtype);
    setMenuTarget(null);
  }, [menuTarget, addEvent]);

  const handleRemarqueRequest = useCallback(() => {
    if (!menuTarget) return;
    setRemarqueTarget({ studentId: menuTarget.studentId, pseudo: menuTarget.pseudo });
    setMenuTarget(null);
  }, [menuTarget]);

  const handleRemarqueSubmit = useCallback((note: string, photo?: File | null) => {
    if (!remarqueTarget) return;
    addEvent(remarqueTarget.studentId, 'remarque', null, note, photo);
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

  // Random student
  const handleRandomStudent = useCallback(() => {
    const presentStudents = students.filter(s => !absentIds.has(s.id) && !activeSorties[s.id]);
    if (presentStudents.length === 0) {
      setRandomStudent('Aucun eleve present');
      setTimeout(() => setRandomStudent(null), 2000);
      return;
    }
    const selected = presentStudents[Math.floor(Math.random() * presentStudents.length)];
    setRandomStudent(selected.pseudo);
    if (navigator.vibrate) navigator.vibrate([15, 50, 15]);
    setTimeout(() => setRandomStudent(null), 3000);
  }, [students, absentIds, activeSorties]);

  // Notes
  const handleOpenNotes = useCallback(() => {
    setNotesText(notes || '');
    setShowNotesModal(true);
  }, [notes]);

  const handleSaveNotes = useCallback(() => {
    updateNotes(notesText.trim() || null);
    setShowNotesModal(false);
  }, [notesText, updateNotes]);

  // Oral evaluation
  const evaluatedStudentIds = useMemo(
    () => new Set(oralEvaluations.map(e => e.student_id)),
    [oralEvaluations]
  );

  const unevaluatedStudents = useMemo(
    () => students.filter(s => !absentIds.has(s.id) && !evaluatedStudentIds.has(s.id)),
    [students, absentIds, evaluatedStudentIds]
  );

  const handleOralRandom = useCallback(() => {
    if (unevaluatedStudents.length === 0) return;
    const selected = unevaluatedStudents[Math.floor(Math.random() * unevaluatedStudents.length)];
    setOralStudent({ id: selected.id, pseudo: selected.pseudo });
    setOralGrade(null);
    setShowOralModal(true);
  }, [unevaluatedStudents]);

  const handleOralManual = useCallback((studentId: string, pseudo: string) => {
    setShowOralPicker(false);
    setOralStudent({ id: studentId, pseudo });
    setOralGrade(null);
    setShowOralModal(true);
  }, []);

  const handleSaveOral = useCallback(() => {
    if (!oralStudent || oralGrade === null) return;
    addOralEvaluation(oralStudent.id, oralGrade);
    setShowOralModal(false);
    setOralStudent(null);
    setOralGrade(null);
  }, [oralStudent, oralGrade, addOralEvaluation]);

  const handleOralButton = useCallback(() => {
    if (unevaluatedStudents.length === 0) {
      // All evaluated — propose reset
      if (confirm('Tous les eleves ont ete evalues.\n\nReinitialiser les evaluations ?')) {
        resetOralEvaluations();
      }
      return;
    }
    setShowOralPicker(true);
  }, [unevaluatedStudents, resetOralEvaluations]);

  // Delete events
  const studentsWithEventsList = useMemo(() => {
    const eventsByStudent: Record<string, number> = {};
    for (const e of events) {
      eventsByStudent[e.student_id] = (eventsByStudent[e.student_id] || 0) + 1;
    }
    return students.filter(s => (eventsByStudent[s.id] || 0) > 0).map(s => ({
      ...s,
      eventCount: eventsByStudent[s.id],
    }));
  }, [students, events]);

  const studentEventsForDelete = useMemo(() => {
    if (!deleteStudentId) return [];
    return events.filter(e => e.student_id === deleteStudentId);
  }, [deleteStudentId, events]);

  const handleDeleteSelectStudent = useCallback((studentId: string) => {
    setDeleteStudentId(studentId);
    setShowDeletePicker(false);
    setShowDeleteEvents(true);
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    if (confirm('Supprimer cet evenement ?')) {
      deleteEventById(eventId);
      // If last event for this student, close modal
    }
  }, [deleteEventById]);

  const handleEndSession = useCallback(() => {
    setShowEndConfirm(true);
  }, []);

  if (!selectedRoom || !startedAt) return null;

  // Build grid
  const totalCells = selectedRoom.grid_rows * selectedRoom.grid_cols;

  // Event summary counts
  const totalEvents = events.length;
  const participations = events.filter(e => e.type === 'participation').length;
  const malus = events.filter(e => e.type === 'bavardage').length;
  const absences = absentIds.size;
  const sortiesCount = Object.keys(activeSorties).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ overscrollBehavior: 'contain' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 text-white shrink-0"
        style={{ background: 'var(--gradient-header)' }}
      >
        <div className="flex items-center gap-2">
          {/* Minimize button */}
          <button
            onClick={minimize}
            className="w-8 h-8 flex items-center justify-center bg-white/15 rounded-lg text-white/80 text-sm"
            style={{ border: 'none' }}
            title="Retour au dashboard"
          >
            ←
          </button>
          <SessionTimer startedAt={startedAt} />
          <span className="text-white/30">|</span>
          <span className="text-xs text-white/70">{selectedClass?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="px-3 py-1.5 text-white/70 text-xs font-medium"
            style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-full)', background: 'transparent' }}
          >
            Annuler
          </button>
          <button
            onClick={handleEndSession}
            className="px-4 py-1.5 bg-white/20 text-white font-semibold text-sm rounded-full"
            style={{ border: 'none' }}
          >
            Terminer
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="flex items-center justify-center gap-3 py-1.5 px-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
        <span className="text-xs text-[var(--color-text-tertiary)]">{totalEvents} evt</span>
        <span className="text-xs font-bold" style={{ color: 'var(--color-participation)' }}>+{participations}</span>
        <span className="text-xs font-bold" style={{ color: 'var(--color-bavardage)' }}>-{malus}</span>
        {absences > 0 && <span className="text-xs font-bold" style={{ color: 'var(--color-absence)' }}>A:{absences}</span>}
        {sortiesCount > 0 && <span className="text-xs font-bold" style={{ color: 'var(--color-sortie)' }}>S:{sortiesCount}</span>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-around py-2 px-2 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)] shrink-0">
        <ToolbarButton icon="🎲" label="Aleatoire" onClick={handleRandomStudent} />
        <div className="w-px h-6 bg-[var(--color-border)]" />
        <ToolbarButton
          icon="🎤"
          label="Oral"
          badge={`${evaluatedStudentIds.size}/${students.filter(s => !absentIds.has(s.id)).length}`}
          onClick={handleOralButton}
        />
        <div className="w-px h-6 bg-[var(--color-border)]" />
        <ToolbarButton icon="📝" label="Note" indicator={!!notes} onClick={handleOpenNotes} />
        <div className="w-px h-6 bg-[var(--color-border)]" />
        <ToolbarButton
          icon="🗑"
          label="Supprimer"
          onClick={() => {
            if (studentsWithEventsList.length === 0) return;
            setShowDeletePicker(true);
          }}
          disabled={studentsWithEventsList.length === 0}
        />
      </div>

      {/* Random student popup */}
      {randomStudent && (
        <div className="mx-4 mt-2 p-3 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-xl text-center font-bold text-lg shrink-0 animate-bounce">
          🎲 {randomStudent}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-[var(--color-error-soft)] text-[var(--color-error)] rounded-lg text-xs text-center shrink-0">
          {error}
        </div>
      )}

      {/* Seating grid */}
      <div className="flex-1 overflow-auto p-3">
        <div
          className="grid gap-1.5 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, 1fr)`,
            maxWidth: `${selectedRoom.grid_cols * 65}px`,
          }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const row = Math.floor(idx / selectedRoom.grid_cols);
            const col = idx % selectedRoom.grid_cols;
            const key = `${row}-${col}`;
            const isDisabled = selectedRoom.disabled_cells?.includes(`${row},${col}`);
            const studentId = positions[key];
            const student = studentId ? studentMap.get(studentId) : null;

            if (isDisabled) {
              return <div key={key} className="h-[52px] rounded-lg bg-[var(--color-border-light)]" />;
            }

            if (!student) {
              return <div key={key} className="h-[52px] rounded-lg bg-[var(--color-surface-secondary)]" />;
            }

            return (
              <StudentCell
                key={key}
                studentId={student.id}
                pseudo={student.pseudo}
                events={events}
                activeSortie={getStudentWithSortie(student.id)}
                onTap={(rect) => handleStudentTap(student.id, student.pseudo, rect)}
                onDoubleTap={() => handleAbsenceCancel(student.id)}
                onSortieReturn={() => handleSortieReturn(student.id)}
              />
            );
          })}
        </div>

        {/* Teacher desk */}
        <div className="mt-3 text-center">
          <div className="inline-block px-4 py-1.5 bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] text-xs font-medium rounded-lg">
            Bureau
          </div>
        </div>
      </div>

      {/* Radial menu */}
      {menuTarget && (
        <WebRadialMenu
          studentPseudo={menuTarget.pseudo}
          position={menuTarget.position}
          onSelect={handleMenuSelect}
          onRemarque={handleRemarqueRequest}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {/* Remarque input */}
      {remarqueTarget && (
        <RemarqueInput
          studentPseudo={remarqueTarget.pseudo}
          onSubmit={handleRemarqueSubmit}
          onCancel={() => setRemarqueTarget(null)}
        />
      )}

      {/* ========== MODALS ========== */}

      {/* End session confirmation */}
      {showEndConfirm && (
        <ModalBackdrop onClose={() => setShowEndConfirm(false)}>
          <h3 className="font-bold text-lg text-[var(--color-text)] text-center">
            Terminer la seance ?
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            {totalEvents} evenement{totalEvents !== 1 ? 's' : ''} enregistre{totalEvents !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowEndConfirm(false)}
              className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Continuer
            </button>
            <button
              onClick={() => { setShowEndConfirm(false); endSession(); }}
              disabled={loading}
              className="flex-1 py-3 font-bold text-white"
              style={{
                background: 'var(--gradient-error)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
              }}
            >
              Terminer
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* Cancel session confirmation */}
      {showCancelConfirm && (
        <ModalBackdrop onClose={() => setShowCancelConfirm(false)}>
          <h3 className="font-bold text-lg text-[var(--color-text)] text-center">
            Annuler la seance ?
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            La seance sera supprimee et aucun evenement ne sera conserve.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Non
            </button>
            <button
              onClick={() => { setShowCancelConfirm(false); cancelSessionAction(); }}
              disabled={loading}
              className="flex-1 py-3 font-bold text-white"
              style={{
                background: 'var(--gradient-error)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
              }}
            >
              Oui, annuler
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* Session notes modal */}
      {showNotesModal && (
        <ModalBackdrop onClose={() => setShowNotesModal(false)}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[var(--color-text)]">Note de seance</h3>
            <button onClick={() => setShowNotesModal(false)} className="text-[var(--color-text-tertiary)] text-lg">✕</button>
          </div>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Commentaire sur la seance..."
            rows={4}
            autoFocus
            className="w-full p-3 border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface-secondary)] resize-none"
            style={{ borderRadius: 'var(--radius-lg)', fontSize: '16px' }}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowNotesModal(false)}
              className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Annuler
            </button>
            <button
              onClick={handleSaveNotes}
              className="flex-1 py-3 font-bold text-white"
              style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Enregistrer
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* Oral: mode picker (random vs manual) */}
      {showOralPicker && (
        <ModalBackdrop onClose={() => setShowOralPicker(false)}>
          <h3 className="font-bold text-lg text-[var(--color-text)] text-center">
            Evaluation orale
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            {unevaluatedStudents.length} eleve{unevaluatedStudents.length > 1 ? 's' : ''} non evalue{unevaluatedStudents.length > 1 ? 's' : ''}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowOralPicker(false); handleOralRandom(); }}
              className="flex-1 py-4 font-bold text-white text-center"
              style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              🎲 Hasard
            </button>
            <button
              onClick={() => setShowOralPicker(false)}
              className="flex-1 py-4 font-bold text-white text-center"
              style={{ background: 'var(--color-remarque)', borderRadius: 'var(--radius-lg)', border: 'none' }}
              // This opens the student list instead
              onClickCapture={(e) => {
                e.stopPropagation();
                setShowOralPicker(false);
                // Show inline student picker via a second state
                setTimeout(() => setShowOralPicker(false), 0);
              }}
            >
              🎯 Choisir
            </button>
          </div>
          {/* Student list for manual selection */}
          <div className="max-h-60 overflow-auto space-y-1 mt-2">
            <p className="text-xs text-[var(--color-text-tertiary)] font-medium px-1">Ou selectionnez un eleve :</p>
            {unevaluatedStudents.map(s => (
              <button
                key={s.id}
                onClick={() => handleOralManual(s.id, s.pseudo)}
                className="w-full text-left px-3 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary-soft)] transition-colors"
                style={{ borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-surface-secondary)' }}
              >
                {s.pseudo}
              </button>
            ))}
          </div>
        </ModalBackdrop>
      )}

      {/* Oral: grade modal */}
      {showOralModal && oralStudent && (
        <ModalBackdrop onClose={() => { setShowOralModal(false); setOralStudent(null); }}>
          <h3 className="font-bold text-lg text-[var(--color-text)] text-center">
            {oralStudent.pseudo}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] text-center">
            Evaluation orale — selectionnez une note
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map(grade => (
              <button
                key={grade}
                onClick={() => setOralGrade(grade)}
                className={`py-3 font-bold text-center transition-all ${
                  oralGrade === grade ? 'text-white scale-105' : 'text-[var(--color-text)]'
                }`}
                style={{
                  background: oralGrade === grade ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  border: oralGrade === grade ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {grade}
              </button>
            ))}
          </div>
          {oralGrade !== null && (
            <p className="text-center text-sm font-medium text-[var(--color-primary)]">
              {ORAL_GRADE_LABELS[oralGrade]}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setShowOralModal(false); setOralStudent(null); }}
              className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Annuler
            </button>
            <button
              onClick={handleSaveOral}
              disabled={oralGrade === null}
              className="flex-1 py-3 font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              Enregistrer
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* Delete: student picker */}
      {showDeletePicker && (
        <ModalBackdrop onClose={() => setShowDeletePicker(false)}>
          <h3 className="font-bold text-[var(--color-text)]">Supprimer un evenement</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Selectionnez un eleve :</p>
          <div className="max-h-72 overflow-auto space-y-1">
            {studentsWithEventsList.map(s => (
              <button
                key={s.id}
                onClick={() => handleDeleteSelectStudent(s.id)}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-error-soft)] transition-colors"
                style={{ borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-surface-secondary)' }}
              >
                <span>{s.pseudo}</span>
                <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-2 py-0.5 rounded-full">
                  {s.eventCount} evt
                </span>
              </button>
            ))}
          </div>
        </ModalBackdrop>
      )}

      {/* Delete: events list for selected student */}
      {showDeleteEvents && deleteStudentId && (
        <ModalBackdrop onClose={() => { setShowDeleteEvents(false); setDeleteStudentId(null); }}>
          <h3 className="font-bold text-[var(--color-text)]">
            Evenements — {studentMap.get(deleteStudentId)?.pseudo}
          </h3>
          <div className="max-h-72 overflow-auto space-y-1">
            {studentEventsForDelete.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                Aucun evenement restant
              </p>
            ) : (
              studentEventsForDelete.map(evt => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-surface-secondary)]"
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getEventEmoji(evt.type)}</span>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {getEventLabel(evt.type)}
                      {evt.subtype ? ` (${evt.subtype})` : ''}
                    </span>
                    {evt.note && (
                      <span className="text-xs text-[var(--color-text-tertiary)] truncate max-w-[100px]">
                        {evt.note}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="text-[var(--color-error)] text-xs font-bold px-2 py-1"
                    style={{ border: '1px solid var(--color-error)', borderRadius: 'var(--radius-md)', background: 'transparent' }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => { setShowDeleteEvents(false); setShowDeletePicker(true); setDeleteStudentId(null); }}
            className="w-full py-2.5 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)]"
            style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
          >
            ← Autre eleve
          </button>
        </ModalBackdrop>
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
  icon: string;
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
      className={`flex flex-col items-center gap-0.5 px-3 py-1 relative transition-opacity ${disabled ? 'opacity-30' : 'active:opacity-60'}`}
      style={{ border: 'none', background: 'transparent' }}
    >
      <span className="text-base">{icon}</span>
      <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{label}</span>
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-white bg-[var(--color-primary)] px-1 rounded-full min-w-[16px] text-center">
          {badge}
        </span>
      )}
      {indicator && (
        <span className="absolute top-0 right-1 w-2 h-2 bg-[var(--color-remarque)] rounded-full" />
      )}
    </button>
  );
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] p-5 mx-4 space-y-4 max-w-sm w-full"
        style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
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

function getEventEmoji(type: string): string {
  const emojis: Record<string, string> = {
    participation: '✋',
    bavardage: '💬',
    absence: '❌',
    remarque: '📝',
    sortie: '🚪',
    retour: '↩️',
  };
  return emojis[type] || '•';
}
