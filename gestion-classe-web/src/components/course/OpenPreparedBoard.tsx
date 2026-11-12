/**
 * Ouvre un tableau préparé dans le bon éditeur : un cours rédigé (boards.doc, migration 071)
 * dans l'éditeur de cours, un tableau classique dans le tableau blanc.
 */
import { useEffect, useState } from 'react';
import { CourseEditor } from './CourseEditor';
import { BoardWorkspace } from '../classroom/BoardWorkspace';
import { boardIsCourse } from '../../lib/course/courseDoc';
import { boardTab } from '../../lib/boardTabs';

interface Props {
  board: { id: string; title: string };
  userId: string;
  /** Type déjà connu (évite une requête) ; sinon lu en base. */
  kind?: 'course' | 'board';
  onClose: () => void;
}

export function OpenPreparedBoard({ board, userId, kind: knownKind, onClose }: Props) {
  const [fetched, setFetched] = useState<{ id: string; kind: 'course' | 'board' } | null>(null);

  useEffect(() => {
    if (knownKind) return;
    let cancelled = false;
    boardIsCourse(board.id).then((isCourse) => { if (!cancelled) setFetched({ id: board.id, kind: isCourse ? 'course' : 'board' }); });
    return () => { cancelled = true; };
  }, [board.id, knownKind]);

  const kind = knownKind ?? (fetched?.id === board.id ? fetched.kind : null);

  if (kind === 'course') return <CourseEditor boardId={board.id} title={board.title} userId={userId} onClose={onClose} />;
  if (kind === 'board') return <BoardWorkspace initial={boardTab(board)} userId={userId} chrome="ribbon" onClose={onClose} />;
  return null;
}
