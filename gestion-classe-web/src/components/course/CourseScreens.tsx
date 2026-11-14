/**
 * Face écran d'un cours (PLAN_preparation_semaine.md, étape 2).
 *
 * Un cours a deux faces : le document, qui s'imprime, et une suite d'écrans 16:9 à projeter.
 * Les écrans sont des pages de tableau blanc rangées dans le cours lui-même (`board_pages` avec
 * son `board_id`) ; leur liste ordonnée est écrite dans le document (`doc.screens`). Une page du
 * cours absente de cette liste est une page d'encart.
 *
 * - `ScreensEditor` : préparer les écrans (tableau blanc avec ruban, enregistré dans le cours).
 * - `ScreensTest` : les essayer comme en classe ; rien n'est gardé en quittant.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Whiteboard } from '../classroom/Whiteboard';
import { copyBoardPages } from '../../lib/boardsQueries';
import type { BoardPage } from '../../lib/boardRender';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';

/** Une page compte comme écran dès qu'elle porte quelque chose (trait, objet ou image de fond). */
const hasContent = (p: BoardPage) => p.strokes.length > 0 || (p.objects ?? []).length > 0 || !!p.image;

interface EditorProps {
  boardId: string;
  userId: string;
  title: string;
  /** Liste actuelle des écrans (lue une fois, à l'ouverture). */
  screens: string[];
  /** Nouvelle liste, à chaque changement puis à la fermeture. */
  onChange: (ids: string[]) => void;
  onClose: () => void;
}

export function ScreensEditor({ boardId, userId, title, screens, onChange, onClose }: EditorProps) {
  // Figée à l'ouverture : le tableau blanc gère ensuite ses pages et signale leur liste
  const [initial] = useState(screens);
  return createPortal(
    <Whiteboard
      sessionId={`ecrans:${boardId}`}
      boardId={boardId}
      pageIds={initial}
      onPageIdsChange={onChange}
      userId={userId}
      title={`${title} — écrans`}
      chrome="ribbon"
      remote
      onClose={(pages) => { onChange(pages.filter(hasContent).map((p) => p.id)); onClose(); }}
    />,
    document.body,
  );
}

interface TestProps {
  boardId: string;
  userId: string;
  title: string;
  screens: string[];
  onClose: () => void;
}

export function ScreensTest({ boardId, userId, title, screens, onClose }: TestProps) {
  const { toast } = useUIFeedback();
  const [pages, setPages] = useState<BoardPage[] | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const sessionId = `ecrans-essai:${boardId}`;
  const list = screens.join('|');

  useEffect(() => {
    let cancelled = false;
    // Un essai repart toujours de zéro : rien de révélé, rien de joué
    try { localStorage.removeItem(`classroom-board-reveal:${sessionId}`); } catch { /* stockage indisponible */ }
    copyBoardPages(boardId, list ? list.split('|') : [])
      .then((copies) => {
        if (cancelled) return;
        if (copies.length === 0) { toast('Les écrans de ce cours ne sont pas encore enregistrés.'); closeRef.current(); return; }
        setPages(copies);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast(err instanceof Error ? err.message : 'Écrans illisibles');
        closeRef.current();
      });
    return () => { cancelled = true; };
  }, [boardId, list, sessionId, toast]);

  if (!pages) return null;
  return createPortal(
    <Whiteboard
      sessionId={sessionId}
      userId={userId}
      title={`${title} — essai`}
      remote={false}
      localKey={null}
      initialPages={pages}
      chrome="ribbon"
      inClass
      onClose={onClose}
    />,
    document.body,
  );
}
