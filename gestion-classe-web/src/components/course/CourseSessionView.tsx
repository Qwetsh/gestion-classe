/**
 * Un cours rédigé dans l'écran de classe (lot 4b) : `/classe` l'affiche à la place du tableau
 * blanc quand la séance part d'un cours. Le présentateur montre le cours (bande de colonne,
 * Suivant / Précédent, vue d'ensemble) ; l'encre de la séance est rangée dans la séance
 * (`session_boards.course_ink`, copie sur l'ordinateur), jamais dans le cours préparé.
 */
import { useEffect, useRef, useState } from 'react';
import { CoursePresenter } from './CoursePresenter';
import { fetchCourse, type CourseDoc } from '../../lib/course/courseDoc';
import { fetchSessionCourseInk, linkSessionBoard, saveSessionCourseInk } from '../../lib/boardsQueries';
import type { LayerItem } from '../../lib/course/courseLayer';
import type { ClassroomBus } from '../../lib/classroomBus';

interface Props {
  sessionId: string;
  boardId: string;
  userId: string;
  /** Canal de la séance : Suivant / Précédent / Vue d'ensemble envoyés du téléphone (lot 4c). */
  bus?: ClassroomBus | null;
}

const SAVE_DELAY_MS = 1200;

export function CourseSessionView({ sessionId, boardId, userId, bus }: Props) {
  const [state, setState] = useState<{ doc: CourseDoc; title: string; ink: LayerItem[] } | { error: string } | null>(null);
  const pending = useRef<LayerItem[] | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [course, ink] = await Promise.all([fetchCourse(boardId), fetchSessionCourseInk(sessionId)]);
        if (cancelled) return;
        if (!course.doc) { setState({ error: 'Ce tableau n’est pas un cours rédigé.' }); return; }
        setState({ doc: course.doc, title: course.title, ink: ink as LayerItem[] });
        // La séance garde la trace du cours dont elle est partie (sans copier ses encarts)
        void linkSessionBoard(userId, sessionId, boardId);
      } catch (err) {
        if (!cancelled) setState({ error: err instanceof Error ? err.message : 'Cours illisible' });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, boardId, userId]);

  const flush = () => {
    window.clearTimeout(timer.current);
    const items = pending.current;
    if (!items) return;
    pending.current = null;
    void saveSessionCourseInk(userId, sessionId, boardId, items);
  };
  const flushRef = useRef(flush);
  useEffect(() => { flushRef.current = flush; });
  // Quitter la vue (B, fin de séance) enregistre ce qui reste
  useEffect(() => () => flushRef.current(), []);

  const onInkChange = (items: LayerItem[]) => {
    pending.current = items;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  };

  if (!state) return <div className="classroom__waiting"><p>Ouverture du cours…</p></div>;
  if ('error' in state) return <div className="classroom__waiting"><p>{state.error}</p></div>;
  return <CoursePresenter boardId={boardId} doc={state.doc} title={state.title} session={{ initialInk: state.ink, onInkChange }} bus={bus} />;
}
