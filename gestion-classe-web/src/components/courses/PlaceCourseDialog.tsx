/**
 * « Placer sur un cours… » : pose une copie d'un cours de la bibliothèque sur des créneaux à venir
 * (lot C3 de PLAN_mes_cours.md). On choisit une classe, on coche ses prochains cours ; les créneaux
 * qui ont déjà un document sont montrés mais ne peuvent pas être cochés : rien n'est écrasé.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { levelFromClassName, type Board } from '../../lib/boardsQueries';
import { classTone } from '../../lib/classColors';
import { fetchClasses, fetchUpcomingLessons, formatSlot, type ClassRef } from '../../lib/coursePlacements';
import { boardForLesson, createLessonBoard, fetchLessonBoards, indexLessonBoards, lessonDisplayName, type LessonBoard } from '../../lib/timetable/lessonBoardsQueries';
import { lessonNoteKey } from '../../lib/timetable/lessonNotesQueries';
import type { TimetableLesson } from '../../lib/timetable/weekView';

/** Jusqu'où l'on propose des créneaux : assez pour une séquence, sans noyer la liste. */
const WEEKS_AHEAD = 5;

interface Props {
  userId: string;
  board: Board;
  onClose: () => void;
  /** Des copies ont été créées : la page relit ses pastilles. */
  onPlaced: () => void;
}

interface Loaded {
  classes: ClassRef[];
  lessons: TimetableLesson[];
  taken: Map<string, LessonBoard>;
}

const slotKey = (l: Pick<TimetableLesson, 'start' | 'label'>) => lessonNoteKey(l.start, l.label);

export function PlaceCourseDialog({ userId, board, onClose, onPlaced }: Props) {
  const { toast } = useUIFeedback();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const from = new Date();
    const to = new Date(from.getTime() + WEEKS_AHEAD * 7 * 24 * 3600 * 1000);
    void (async () => {
      try {
        const classes = await fetchClasses(userId);
        const [lessons, boards] = await Promise.all([
          fetchUpcomingLessons(userId, from, to, classes),
          fetchLessonBoards(userId, from, to),
        ]);
        if (!cancelled) setLoaded({ classes, lessons, taken: indexLessonBoards(boards) });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'L’emploi du temps ne répond pas.');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  /** Classes qui ont au moins un cours à venir, dans l'ordre de la liste des classes. */
  const classesWithLessons = useMemo(() => {
    if (!loaded) return [];
    const ids = new Set(loaded.lessons.map((l) => l.classId));
    return loaded.classes.filter((c) => ids.has(c.id));
  }, [loaded]);

  // Classe montrée d'abord : la première du niveau du cours, sinon la première de la liste
  const shownClass = activeClass
    ?? classesWithLessons.find((c) => board.level !== null && levelFromClassName(c.name) === board.level)?.id
    ?? classesWithLessons[0]?.id
    ?? null;

  const lessonsOfClass = useMemo(
    () => (loaded && shownClass ? loaded.lessons.filter((l) => l.classId === shownClass) : []),
    [loaded, shownClass],
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const place = async () => {
    if (!loaded || selected.size === 0 || busy) return;
    setBusy(true);
    const targets = loaded.lessons.filter((l) => selected.has(slotKey(l)));
    let done = 0;
    const failed: string[] = [];
    for (const lesson of targets) {
      try {
        await createLessonBoard(userId, lesson, board.id, 'board', board.title);
        done++;
      } catch (err) {
        console.warn('[PlaceCourseDialog] placement :', err);
        failed.push(`${lessonDisplayName(lesson)} (${formatSlot(lesson.start)})`);
      }
    }
    if (done > 0) onPlaced();
    if (failed.length > 0) toast(`Non placé : ${failed.join(', ')}. Le créneau a peut-être déjà un document.`);
    else toast(done > 1 ? `« ${board.title} » est placé sur ${done} cours.` : `« ${board.title} » est placé.`, 'success');
    setBusy(false);
    onClose();
  };

  const count = selected.size;

  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      title="Placer sur un cours"
      size="lg"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="button" className="btn btn--primary" onClick={() => void place()} disabled={count === 0 || busy}>
            {busy ? 'Placement…' : count > 1 ? `Placer sur ${count} cours` : 'Placer'}
          </button>
        </div>
      )}
    >
      <p className="mc-place__what">« {board.title} » — une copie par cours coché ; l’original ne bouge pas.</p>

      {error && <p className="mc-error" role="alert">{error}</p>}
      {!loaded && !error && <p className="mc-place__note">Lecture de l’emploi du temps…</p>}

      {loaded && classesWithLessons.length === 0 && (
        <p className="mc-place__note">
          Aucun cours à venir dans l’emploi du temps enregistré pour les {WEEKS_AHEAD} prochaines semaines.
          Il s’importe dans Réglages › Emploi du temps ; depuis le calendrier de l’accueil, un cours reçoit aussi son document à la main.
        </p>
      )}

      {loaded && classesWithLessons.length > 0 && (
        <>
          <div className="mc-place__classes" role="tablist" aria-label="Classe">
            {classesWithLessons.map((c) => {
              const tone = classTone(c.name);
              const on = c.id === shownClass;
              const picked = loaded.lessons.filter((l) => l.classId === c.id && selected.has(slotKey(l))).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="mc-place__class"
                  style={{ background: on ? tone.soft : 'var(--surface)', color: on ? tone.ink : 'var(--text)', borderColor: on ? tone.solid : 'var(--border)' }}
                  onClick={() => setActiveClass(c.id)}
                >
                  {c.name}
                  {picked > 0 && <span className="mc-place__picked" style={{ background: tone.solid }}>{picked}</span>}
                </button>
              );
            })}
          </div>

          <ul className="mc-place__slots">
            {lessonsOfClass.map((l) => {
              const key = slotKey(l);
              const existing = boardForLesson(loaded.taken, l);
              return (
                <li key={key}>
                  <label className={`mc-place__slot${existing ? ' mc-place__slot--taken' : ''}`}>
                    <input type="checkbox" checked={selected.has(key)} disabled={!!existing || busy} onChange={() => toggle(key)} />
                    <span className="mc-place__when">{formatSlot(l.start)}{l.groupName ? ` · ${l.groupName}` : ''}</span>
                    {existing && <span className="mc-place__taken">déjà un document : {existing.title}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
