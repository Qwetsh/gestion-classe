/**
 * Classeur virtuel (lot 1) : un cours imprimé en A5 et collé sur une feuille du classeur.
 *
 * Le cours est rendu comme dans l'éditeur (feuilles A4 empilées, lecture seule), puis réduit au
 * format A5 (148 / 210) : c'est exactement l'impression A5 d'une page A4. Une fenêtre de la taille
 * d'une page montre la page voulue : la première (le recto), ou la suivante quand on retourne la
 * fiche (un cours de deux pages est une fiche recto verso).
 * Lot 3 : la fiche de mémorisation porte ses volets (MemoFlaps), rabattus sur les réponses.
 * Lot 2 : la page de garde et la feuille de bilans sont montrées remplies par l'élève
 * (lib/binderInk.ts) ; un bouton rend la fiche vierge.
 * À monter avec `key` = l'identifiant du cours : l'état (fiche lue, face montrée) lui est propre.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import type { Board } from '../../lib/boardsQueries';
import type { SheetRole } from '../../lib/binder';
import { INK_BLUE, INK_GREEN, fillSheet, fillSummaries, modelAnswers, tickCover } from '../../lib/binderInk';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { courseExtensions } from '../course/courseExtensions';
import { CourseSheetChrome } from '../course/CourseSheetChrome';
import { CourseLayer } from '../course/CourseLayer';
import { flowStyle } from '../course/courseThemes';
import { A5_SCALE } from './binderSheet';
import { BinderSourceContext } from './binderSource';
import { MemoFlaps } from './MemoFlaps';
import '../course/course.css';

interface Props {
  board: Board;
  /** Rôle de la fiche dans le classeur : page de garde et feuille de bilans sont remplies par l'élève. */
  role?: SheetRole;
  /** Feuille de bilans : sa version corrigée ; fiche d'activité : sa copie modèle (les réponses). */
  companion?: Board;
  /** Position de la fiche sur la feuille du classeur, en px de la feuille A4. */
  left: number;
  top: number;
  /** Double-clic : ouvrir le cours dans « Mes cours ». */
  onOpen?: () => void;
  /** Vue de l'élève : la page de garde reste telle qu'elle est distribuée (cases non cochées). */
  student?: boolean;
}

export function GluedSheet({ board, role, companion, left, top, onOpen, student }: Props) {
  const { loadDoc } = useContext(BinderSourceContext);
  const [doc, setDoc] = useState<CourseDoc | null | undefined>(undefined);
  /** Copie modèle (ou feuille corrigée) lue, avec le cours dont elle vient : elle ne vaut que pour lui. */
  const [companionDoc, setCompanionDoc] = useState<{ id: string; doc: CourseDoc | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [face, setFace] = useState(0);
  /**
   * Fiche d'activité ou sujet : elle s'ouvre vierge, et « Afficher la correction » y écrit les
   * réponses de la copie modèle (Thomas, 22/11/2026). La page de garde, elle, est montrée remplie.
   */
  const answers = role === 'activity' || role === 'evaluation';
  /** Fiche montrée telle que l'élève l'a remplie (sinon : la fiche vierge, telle qu'imprimée). */
  const [filled, setFilled] = useState(!answers);

  // Feuille corrigée ou copie modèle : un plus ; sans elle, la fiche reste vierge
  useEffect(() => {
    if (!companion) return;
    let cancelled = false;
    loadDoc(companion).then((d) => { if (!cancelled) setCompanionDoc({ id: companion.id, doc: d }); }, () => { /* reste vierge */ });
    return () => { cancelled = true; };
  }, [companion, loadDoc]);
  // Plus de copie modèle (correction refermée pour la classe) : la fiche redevient vierge
  const corrected = companion && companionDoc?.id === companion.id ? companionDoc.doc : null;

  /** Ce que l'élève a écrit sur la fiche, ou null si le classeur n'y écrit rien. */
  const inked = useMemo<JSONContent | null>(() => {
    if (!doc) return null;
    if (role === 'cover') return student ? null : tickCover(doc.content);
    if (role === 'summaries' && corrected) {
      const next = fillSummaries(doc.content, corrected.content);
      return next === doc.content ? null : next;
    }
    if ((role === 'activity' || role === 'evaluation') && corrected) {
      // Sur une évaluation, ce que l'élève écrit après coup est la correction : au stylo vert
      const next = fillSheet(doc.content, modelAnswers(corrected.content), role === 'evaluation' ? INK_GREEN : INK_BLUE);
      return next === doc.content ? null : next;
    }
    return null;
  }, [doc, role, corrected, student]);
  const shownDoc = useMemo(() => (doc && inked && filled ? { ...doc, content: inked } : doc), [doc, inked, filled]);

  // Une autre fiche = un autre composant (la page du classeur porte la clé de la fiche)
  useEffect(() => {
    let cancelled = false;
    loadDoc(board).then((d) => { if (!cancelled) setDoc(d); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [board, loadDoc]);

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
      {shownDoc && <CourseFaces board={board} doc={shownDoc} face={face} onFace={setFace} flaps={role === 'memo'} />}
      {inked && (
        <button
          type="button"
          className={answers ? 'bd-glued__ink bd-glued__ink--answers' : 'bd-glued__ink'}
          aria-pressed={filled}
          onClick={(e) => { e.stopPropagation(); setFilled((f) => !f); }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={answers ? (filled ? 'Revenir à la fiche vierge' : 'Écrire les réponses sur la fiche') : filled ? 'Voir la fiche vierge, telle qu’elle est distribuée' : 'Voir la fiche remplie par l’élève'}
        >
          {answers ? (filled ? 'Masquer la correction' : 'Afficher la correction') : filled ? 'Voir la fiche vierge' : 'Voir la fiche remplie'}
        </button>
      )}
      {doc === null && <span className="bd-glued__note">Tableau blanc : pas de feuille à imprimer</span>}
      {doc === undefined && <span className="bd-glued__note">{!failed ? 'Chargement…' : student ? 'Cette page n’est plus disponible' : 'Fiche illisible'}</span>}
      <span className="bd-glued__glue" aria-hidden />
    </div>
  );
}

function CourseFaces({ board, doc, face, onFace, flaps }: { board: Board; doc: CourseDoc; face: number; onFace: (f: number) => void; flaps: boolean }) {
  const [pages, setPages] = useState(1);
  const sheetsRef = useRef<HTMLDivElement>(null);
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
          ref={sheetsRef}
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
          {editor && flaps && <MemoFlaps sheets={sheetsRef} layoutKey={pages} />}
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
