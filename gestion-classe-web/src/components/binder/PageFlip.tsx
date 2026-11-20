/**
 * Classeur virtuel : la feuille qui se tourne, avec son contenu.
 *
 * La feuille est faite de copies figées des pages (leur DOM déjà mis en page, copié avant le
 * changement de vue) : son recto est la page qu'on quitte, son verso la page qu'on découvre de
 * l'autre côté. Des copies, jamais les vraies pages : la mise en page d'un cours se mesure à
 * l'écran et ne supporte aucune transformation. Dessous, la nouvelle page est déjà en place ;
 * l'ancienne page de l'autre côté reste en copie jusqu'à ce que la feuille la couvre.
 */
import { useLayoutEffect, useRef } from 'react';
import { PAGE_H, PAGE_W } from '../../lib/course/coursePage';
import type { FlipKind } from '../../lib/binderFlip';

/** Une page figée : le nœud copié est posé tel quel. */
function Ghost({ node }: { node: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { ref.current?.replaceChildren(node); }, [node]);
  return <div ref={ref} className="bd-ghost" />;
}

export interface FlipView {
  id: number;
  kind: FlipKind;
  front: HTMLElement | null;
  back: HTMLElement | null;
  /** Ancienne page restée en place de ce côté (null : l'intérieur de la couverture). */
  under: { side: 'left' | 'right'; node: HTMLElement | null } | null;
}

interface Props {
  flip: FlipView;
  /** Abscisse de la page de gauche / de droite dans la vue, en px de feuille. */
  slotX: (side: 'left' | 'right') => number;
  onDone: () => void;
}

export function PageFlip({ flip, slotX, onDone }: Props) {
  const startSide = flip.kind === 'prev-double' ? 'left' : 'right';
  return (
    <>
      {flip.under && (
        <div className={`bd-slot bd-slot--${flip.under.side} bd-flip-under`} style={{ left: slotX(flip.under.side), width: PAGE_W, height: PAGE_H }} aria-hidden>
          {flip.under.node ? <Ghost node={flip.under.node} /> : <div className="bd-cover-inside" />}
        </div>
      )}
      <div
        className={`bd-flip bd-flip--${flip.kind}`}
        style={{ left: slotX(startSide), width: PAGE_W, height: PAGE_H }}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) onDone(); }}
        aria-hidden
      >
        <div className="bd-flip__face">
          {flip.front ? <Ghost node={flip.front} /> : <div className="bd-flip__blank" />}
          <span className="bd-flip__shade" />
        </div>
        <div className="bd-flip__face bd-flip__face--back">
          {flip.back ? <Ghost node={flip.back} /> : <div className="bd-flip__blank" />}
          <span className="bd-flip__shade" />
        </div>
      </div>
    </>
  );
}
