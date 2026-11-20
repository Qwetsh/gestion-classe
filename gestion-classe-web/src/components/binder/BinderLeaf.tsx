/**
 * Classeur virtuel (lot 1) : une page du classeur, à sa taille réelle (A4, px CSS à 96 dpi).
 * Feuille perforée à grands carreaux (Seyès) portant une fiche A5 collée, ou intercalaire cartonné.
 * La page de droite est un recto (trous à gauche, contre les anneaux), celle de gauche un verso
 * (trous à droite).
 */
import type { BinderPage } from '../../lib/binder';
import { SECTION_LABEL } from '../../lib/binder';
import { MM, PAGE_H, PAGE_W } from '../../lib/course/coursePage';
import { GluedSheet } from './GluedSheet';
import { A5_SCALE, HOLES_MM } from './binderSheet';

/** Fiche A5 : à 34 mm du bord perforé, 38 mm du haut (au-dessus, le titre écrit à la main). */
const GLUE_FROM_HOLES = 34 * MM;
const GLUE_TOP = 38 * MM;

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
      <div className={`bd-leaf bd-divider bd-divider--${page.section}`} style={{ width: PAGE_W, height: PAGE_H }}>
        {holes}
        <div className="bd-divider__title">{SECTION_LABEL[page.section]}</div>
      </div>
    );
  }

  const sheetW = PAGE_W * A5_SCALE;
  const left = side === 'right' ? GLUE_FROM_HOLES : PAGE_W - GLUE_FROM_HOLES - sheetW;
  return (
    <div className={`bd-leaf bd-paper bd-paper--${side}`} style={{ width: PAGE_W, height: PAGE_H }}>
      <div className="bd-paper__ruling" aria-hidden />
      {holes}
      {page.heading && (
        <div className="bd-heading" style={{ left: side === 'right' ? 31 * MM : 12 * MM, right: side === 'right' ? 8 * MM : 31 * MM }}>
          <span>{page.heading}</span>
        </div>
      )}
      <GluedSheet key={page.board.id} board={page.board} role={page.role} companion={page.companion} left={left} top={GLUE_TOP} onOpen={onOpen ? () => onOpen(page.board.id) : undefined} />
    </div>
  );
}
