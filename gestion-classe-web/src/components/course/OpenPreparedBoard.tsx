/**
 * Ouvre un tableau préparé dans le bon éditeur : un cours rédigé (boards.doc, migration 071)
 * dans l'éditeur de cours, un tableau classique dans le tableau blanc.
 * Avec `present`, un cours s'ouvre directement « En classe » (mode test, lot 4d).
 */
import { useEffect, useRef, useState } from 'react';
import { CourseEditor } from './CourseEditor';
import { CoursePresenter } from './CoursePresenter';
import { BoardWorkspace } from '../classroom/BoardWorkspace';
import { boardIsCourse, fetchCourse, type CourseDoc } from '../../lib/course/courseDoc';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { boardTab } from '../../lib/boardTabs';

interface Props {
  board: { id: string; title: string };
  userId: string;
  /** Type déjà connu (évite une requête) ; sinon lu en base. */
  kind?: 'course' | 'board';
  /** Cours rédigé : ouvrir la présentation En classe (test, encre perdue en quittant) plutôt que l'éditeur. */
  present?: boolean;
  onClose: () => void;
}

export function OpenPreparedBoard({ board, userId, kind: knownKind, present, onClose }: Props) {
  const [fetched, setFetched] = useState<{ id: string; kind: 'course' | 'board' } | null>(null);

  useEffect(() => {
    if (knownKind) return;
    let cancelled = false;
    boardIsCourse(board.id).then((isCourse) => { if (!cancelled) setFetched({ id: board.id, kind: isCourse ? 'course' : 'board' }); });
    return () => { cancelled = true; };
  }, [board.id, knownKind]);

  const kind = knownKind ?? (fetched?.id === board.id ? fetched.kind : null);

  if (kind === 'course' && present) return <PresentCourse board={board} onClose={onClose} />;
  if (kind === 'course') return <CourseEditor boardId={board.id} title={board.title} userId={userId} onClose={onClose} />;
  if (kind === 'board') return <BoardWorkspace initial={boardTab(board)} userId={userId} chrome="ribbon" onClose={onClose} />;
  return null;
}

/** Présentation En classe d'un cours enregistré, ouverte depuis le calendrier de l'accueil. */
function PresentCourse({ board, onClose }: { board: { id: string; title: string }; onClose: () => void }) {
  const { toast } = useUIFeedback();
  const [course, setCourse] = useState<{ doc: CourseDoc; title: string } | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    let cancelled = false;
    fetchCourse(board.id)
      .then((c) => {
        if (cancelled) return;
        if (!c.doc) { toast('Ce tableau n’est pas un cours rédigé.'); closeRef.current(); return; }
        setCourse({ doc: c.doc, title: c.title });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast(err instanceof Error ? err.message : 'Cours illisible');
        closeRef.current();
      });
    return () => { cancelled = true; };
  }, [board.id, toast]);

  if (!course) return null;
  return <CoursePresenter boardId={board.id} doc={course.doc} title={course.title} onClose={onClose} />;
}
