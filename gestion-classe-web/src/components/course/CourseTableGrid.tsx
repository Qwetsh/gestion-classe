/**
 * Choix de la taille d'un tableau à l'insertion : on survole une grille, on clique (comme dans
 * Word). Jusqu'à 8 lignes × 8 colonnes ; on en ajoute ensuite depuis l'onglet Tableau.
 */
import { useEffect, useRef, useState } from 'react';

const MAX = 8;

interface Props {
  left: number;
  top: number;
  onPick: (rows: number, cols: number) => void;
  onClose: () => void;
}

export function CourseTableGrid({ left, top, onPick, onClose }: Props) {
  const [hover, setHover] = useState({ rows: 3, cols: 3 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div ref={ref} className="ce-tgrid" style={{ left: Math.max(8, Math.min(left, window.innerWidth - 220)), top }} role="dialog" aria-label="Taille du tableau" onMouseDown={(e) => e.preventDefault()}>
      <div className="ce-tgrid__label">{hover.rows} ligne{hover.rows > 1 ? 's' : ''} × {hover.cols} colonne{hover.cols > 1 ? 's' : ''}</div>
      <div className="ce-tgrid__cells" style={{ gridTemplateColumns: `repeat(${MAX}, 20px)` }}>
        {Array.from({ length: MAX * MAX }).map((_, i) => {
          const r = Math.floor(i / MAX) + 1;
          const c = (i % MAX) + 1;
          return (
            <button
              key={i}
              type="button"
              className={`ce-tgrid__cell ${r <= hover.rows && c <= hover.cols ? 'is-on' : ''}`}
              aria-label={`${r} lignes, ${c} colonnes`}
              onMouseEnter={() => setHover({ rows: r, cols: c })}
              onFocus={() => setHover({ rows: r, cols: c })}
              onClick={() => { onPick(r, c); onClose(); }}
            />
          );
        })}
      </div>
    </div>
  );
}
