/**
 * Classeur virtuel (lot 1) : un cours imprimé en A5 et collé sur une feuille du classeur.
 *
 * Le cours est rendu comme dans l'éditeur (feuilles A4 empilées, lecture seule), puis réduit au
 * format A5 (148 / 210) : c'est exactement l'impression A5 d'une page A4. Une fenêtre de la taille
 * d'une page montre la page voulue : la première (le recto), ou la suivante quand on retourne la
 * fiche (un cours de deux pages est une fiche recto verso).
 * À monter avec `key` = l'identifiant du cours : l'état (fiche lue, face montrée) lui est propre.
 */
import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Board } from '../../lib/boardsQueries';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { courseExtensions } from '../course/courseExtensions';
import { CourseSheetChrome } from '../course/CourseSheetChrome';
import { CourseLayer } from '../course/CourseLayer';
import { flowStyle } from '../course/courseThemes';
import { A5_SCALE, loadSheetDoc } from './binderSheet';
import '../course/course.css';

interface Props {
  board: Board;
  /** Position de la fiche sur la feuille du classeur, en px de la feuille A4. */
  left: number;
  top: number;
  /** Double-clic : ouvrir le cours dans « Mes cours ». */
  onOpen?: () => void;
}

export function GluedSheet({ board, left, top, onOpen }: Props) {
  const [doc, setDoc] = useState<CourseDoc | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [face, setFace] = useState(0);

  // Une autre fiche = un autre composant (la page du classeur porte la clé de la fiche)
  useEffect(() => {
    let cancelled = false;
    loadSheetDoc(board).then((d) => { if (!cancelled) setDoc(d); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [board]);

  const width = PAGE_W * A5_SCALE;
  const height = PAGE_H * A5_SCALE;

  return (
    <div
      className="bd-glued"
      // Pas d'angle de collage : la pagination mesure les blocs à l'écran, une rotation fausserait
      // ses mesures (et le nombre de pages de la fiche)
      style={{ left, top, width, height }}
      onDoubleClick={onOpen}
      title={onOpen ? `${board.title} — double-clic pour l’ouvrir dans Mes cours` : board.title}
    >
      {doc && <CourseFaces board={board} doc={doc} face={face} onFace={setFace} />}
      {doc === null && <span className="bd-glued__note">Tableau blanc : pas de feuille à imprimer</span>}
      {doc === undefined && <span className="bd-glued__note">{failed ? 'Fiche illisible' : 'Chargement…'}</span>}
      <span className="bd-glued__glue" aria-hidden />
    </div>
  );
}

function CourseFaces({ board, doc, face, onFace }: { board: Board; doc: CourseDoc; face: number; onFace: (f: number) => void }) {
  const [pages, setPages] = useState(1);
  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId: board.id, onEdit: () => { /* lecture seule */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [board.id]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

  const shown = Math.min(face, pages - 1);
  const sheetsH = pages * PAGE_H + (pages - 1) * SHEET_GAP;
  const numbering = doc.settings?.numbering;
  const label = pages === 2 ? (shown === 0 ? 'Voir le verso' : 'Voir le recto') : `Page ${shown + 1} / ${pages}`;

  return (
    <>
      <div className="bd-glued__window">
        <div
          className="ce-sheets bd-glued__sheets"
          style={{ width: PAGE_W, height: sheetsH, transform: `scale(${A5_SCALE}) translateY(${-shown * (PAGE_H + SHEET_GAP)}px)` }}
        >
          {Array.from({ length: pages }).map((_, i) => (
            <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + SHEET_GAP), width: PAGE_W, height: PAGE_H, boxShadow: 'none' }}>
              <CourseSheetChrome page={i + 1} pages={pages} settings={doc.settings ?? {}} values={{ titre: board.title, classe: '', date: '' }} />
            </div>
          ))}
          <div
            className="ce-flow"
            style={{ left: MARGIN, top: MARGIN, width: COL_W, ...flowStyle(doc.settings) }}
            data-numbering={numbering && numbering !== 'none' ? numbering : undefined}
            data-hyphens={doc.settings?.hyphens ? '' : undefined}
            data-caption={doc.settings?.captionLabel ?? 'document'}
          >
            {editor && <EditorContent editor={editor} />}
          </div>
          {editor && (doc.layer?.items?.length ?? 0) > 0 && (
            <CourseLayer editor={editor} items={doc.layer?.items ?? []} height={sheetsH} active={false} readOnly
              style={{ tool: 'select', color: '#000', size: 'M' }} selected={null} onSelect={() => {}} onChange={() => {}} />
          )}
        </div>
      </div>
      {pages > 1 && (
        <button
          type="button"
          className="bd-glued__turn"
          onClick={(e) => { e.stopPropagation(); onFace((shown + 1) % pages); }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={pages === 2 ? 'Retourner la fiche' : 'Page suivante de la fiche'}
        >
          {label} ↻
        </button>
      )}
    </>
  );
}
