/**
 * Verso d'une page jouée en classe (« Tableau blanc ») : une page blanche liée à la page préparée
 * affichée, pour écrire ou dessiner en direct. Elle est rangée dans la séance (`board_pages`,
 * identifiant `verso:<id de la page>`), et la page jouée garde dans `origin` la page préparée
 * qu'elle copie : on retrouve ce qui a été écrit en revenant sur la page, ou plus tard.
 *
 * Ici : la vignette de la page préparée, posée dans un coin du verso ; un toucher y ramène.
 * Elle est dessinée « côté élève » (caches et trous fermés) : rien n'est dévoilé au tableau.
 */
import { useEffect, useState } from 'react';
import { pageRatio, renderPageToCanvas, type BoardPage } from '../../lib/boardRender';

const THUMB_W = 220;

export function VersoBackThumb({ page, onBack }: { page: BoardPage; onBack: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    renderPageToCanvas(page, THUMB_W * 2, { mode: 'covered' })
      .then((canvas) => { if (!cancelled) setUrl(canvas.toDataURL('image/jpeg', 0.75)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [page]);

  return (
    <button
      type="button"
      className="wb__back"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onBack}
      title="Revenir à la page (ce qui est écrit ici reste avec elle)"
    >
      <span className="wb__back-img" style={{ aspectRatio: `${pageRatio(page)}` }}>
        {url && <img src={url} alt="" draggable={false} />}
      </span>
      <span className="wb__back-label">↩ Revenir à la page</span>
    </button>
  );
}

/** Styles de la vignette (injectés avec ceux du tableau blanc). */
export const VERSO_CSS = `
.wb__back { position: absolute; left: 14px; bottom: 14px; z-index: 5; display: flex; flex-direction: column; gap: 6px; width: ${THUMB_W}px; padding: 6px; border: 1px solid #CBD5E1; border-radius: 12px; background: rgba(255,255,255,0.96); box-shadow: 0 4px 16px rgba(15,23,42,0.16); cursor: pointer; }
.wb__back:hover { border-color: #818CF8; }
.wb__back-img { display: block; width: 100%; max-height: 160px; overflow: hidden; border-radius: 7px; background: #F1F5F9; }
.wb__back-img img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.wb__back-label { font: 600 13px/1.2 Inter, system-ui, sans-serif; color: #3730A3; text-align: center; }
`;
