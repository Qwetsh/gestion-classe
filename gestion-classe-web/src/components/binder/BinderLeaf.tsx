/**
 * Classeur virtuel (lot 1) : une page du classeur, à sa taille réelle (A4, px CSS à 96 dpi).
 * Feuille perforée à grands carreaux (Seyès) portant une fiche A5 collée, ou intercalaire cartonné.
 * La page de droite est un recto (trous à gauche, contre les anneaux), celle de gauche un verso
 * (trous à droite).
 */
import type { BinderPage } from '../../lib/binder';
import { SECTION_LABEL } from '../../lib/binder';
import type { InkLine } from '../../lib/binderSummary';
import { MM, PAGE_H, PAGE_W } from '../../lib/course/coursePage';
import { GluedSheet } from './GluedSheet';
import { A5_SCALE, HOLES_MM } from './binderSheet';

/** Fiche A5 : à 34 mm du bord perforé, 30 mm du haut (au-dessus, le titre écrit à la main, sur la première ligne). */
const GLUE_FROM_HOLES = 34 * MM;
const GLUE_TOP = 30 * MM;

/** Première ligne du papier (haut du quadrillage) et interligne, en mm. */
const RULING_TOP = 22;
const LINE_MM = 8;
/** Haut de la bande des lignes d'écriture sous une fiche A5 collée à sa place habituelle (6 lignes). */
const UNDER_TOP = 238;

/** Lignes écrites à la main, une par ligne du papier à partir de `topMm` (haut de la première bande). */
function InkLines({ lines, topMm, side }: { lines: InkLine[]; topMm: number; side: 'left' | 'right' }) {
  return (
    <div className="bd-ink" style={{ top: topMm * MM, left: (side === 'right' ? 30 : 8) * MM }}>
      {lines.map((line, i) => (
        <div key={i} className="bd-ink__line" style={{ height: LINE_MM * MM }}>
          {line.map((run, j) => (run.underline ? <u key={j}>{run.text}</u> : <span key={j}>{run.text}</span>))}
        </div>
      ))}
    </div>
  );
}

interface Props {
  page: BinderPage;
  side: 'left' | 'right';
  onOpen?: (boardId: string) => void;
}

export function BinderLeaf({ page, side, onOpen }: Props) {
  const holes = (
    <div className={`bd-holes bd-holes--${side === 'right' ? 'left' : 'right'}`} aria-hidden>
      {HOLES_MM.map((y) => <span key={y} className="bd-hole" style={{ top: y * MM }} />)}
    </div>
  );

  if (page.kind === 'divider') {
    return (
      <div data-leaf-key={page.key} className={`bd-leaf bd-divider bd-divider--${page.section}`} style={{ width: PAGE_W, height: PAGE_H }}>
        {holes}
        <div className="bd-divider__title">{SECTION_LABEL[page.section]}</div>
      </div>
    );
  }

  if (page.kind === 'ruled') {
    return (
      <div data-leaf-key={page.key} className={`bd-leaf bd-paper bd-paper--${side}`} style={{ width: PAGE_W, height: PAGE_H }}>
        <div className="bd-paper__ruling" aria-hidden />
        {holes}
        {page.heading && (
          <div className="bd-heading" style={{ left: side === 'right' ? 31 * MM : 12 * MM, right: side === 'right' ? 8 * MM : 31 * MM }}>
            <span>{page.heading}</span>
          </div>
        )}
        <InkLines lines={page.lines} topMm={RULING_TOP + (page.heading ? LINE_MM : 0)} side={side} />
      </div>
    );
  }

  const sheetW = PAGE_W * A5_SCALE;
  const left = side === 'right' ? GLUE_FROM_HOLES : PAGE_W - GLUE_FROM_HOLES - sheetW;
  return (
    <div data-leaf-key={page.key} className={`bd-leaf bd-paper bd-paper--${side}`} style={{ width: PAGE_W, height: PAGE_H }}>
      <div className="bd-paper__ruling" aria-hidden />
      {holes}
      {page.heading && (
        <div className="bd-heading" style={{ left: side === 'right' ? 31 * MM : 12 * MM, right: side === 'right' ? 8 * MM : 31 * MM }}>
          <span>{page.heading}</span>
        </div>
      )}
      {page.above && <InkLines lines={page.above} topMm={RULING_TOP} side={side} />}
      <GluedSheet key={page.board.id} board={page.board} role={page.role} companion={page.companion} left={left} top={page.above ? (RULING_TOP + page.above.length * LINE_MM) * MM : GLUE_TOP} onOpen={onOpen ? () => onOpen(page.board.id) : undefined} />
      {page.summary && <InkLines lines={page.summary} topMm={UNDER_TOP} side={side} />}
    </div>
  );
}
