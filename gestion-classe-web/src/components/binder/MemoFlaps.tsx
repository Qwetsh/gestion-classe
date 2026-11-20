/**
 * Classeur virtuel (lot 3) : les volets de la fiche de mémorisation.
 *
 * Sur le papier, l'élève découpe la colonne de droite (« ⟵ plie ») et rabat chaque volet sur la
 * réponse : il lit la question, répond de tête, puis soulève le volet. Ici, chaque réponse est
 * couverte par son volet ; un clic le soulève (il retourne à sa place, à droite), un autre le rabat.
 *
 * Les volets sont posés par-dessus le rendu du cours, à la place mesurée des cellules : le cours
 * lui-même n'est ni modifié ni transformé (la pagination mesure ses blocs à l'écran).
 */
import { useEffect, useState, type RefObject } from 'react';
import { PAGE_W } from '../../lib/course/coursePage';
import { flapRows, toSheet, type FlapBox } from '../../lib/binderFlaps';

interface Props {
  /** Les feuilles du cours (conteneur à l'échelle 1, largeur PAGE_W). */
  sheets: RefObject<HTMLDivElement | null>;
  /** Change quand la mise en page change (nombre de pages) : les volets sont remesurés. */
  layoutKey: number;
}

export function MemoFlaps({ sheets, layoutKey }: Props) {
  const [flaps, setFlaps] = useState<FlapBox[]>([]);
  /** Volets soulevés (rang de la ligne). Au départ tous rabattus : on révise. */
  const [open, setOpen] = useState<Set<number>>(new Set());

  // Mesuré dès la mise en page, puis quand les polices et les images ont fini d'arriver
  useEffect(() => {
    const measure = () => {
      const el = sheets.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.width === 0) return;
      const trs = [...el.querySelectorAll<HTMLTableRowElement>('.ce-doc tr')];
      const next = flapRows(trs.map((tr) => [...tr.children].map((c) => c.textContent ?? ''))).map((row): FlapBox => {
        const cells = trs[row].children;
        return {
          row,
          answer: toSheet(cells[1].getBoundingClientRect(), box, PAGE_W),
          hole: toSheet(cells[2].getBoundingClientRect(), box, PAGE_W),
        };
      });
      setFlaps((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const timers = [0, 150, 600, 1500].map((ms) => window.setTimeout(measure, ms));
    const doc = sheets.current?.querySelector('.ce-doc');
    const observer = doc && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (doc && observer) observer.observe(doc);
    return () => { timers.forEach(window.clearTimeout); observer?.disconnect(); };
  }, [sheets, layoutKey]);

  const toggle = (row: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(row)) next.delete(row); else next.add(row);
    return next;
  });

  return (
    <>
      {flaps.map(({ row, answer, hole }, i) => {
        const lifted = open.has(row);
        return (
          <span key={row}>
            <span className={`bd-flap__hole ${lifted ? 'is-open' : ''}`} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} aria-hidden />
            <button
              type="button"
              className={`bd-flap ${lifted ? 'is-open' : ''}`}
              style={{ left: answer.x, top: answer.y, width: answer.w, height: answer.h }}
              aria-pressed={lifted}
              aria-label={lifted ? `Rabattre le volet de la question ${i + 1}` : `Soulever le volet de la question ${i + 1}`}
              title={lifted ? 'Rabattre le volet' : 'Soulever le volet pour voir la réponse'}
              onClick={(e) => { e.stopPropagation(); toggle(row); }}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          </span>
        );
      })}
    </>
  );
}
