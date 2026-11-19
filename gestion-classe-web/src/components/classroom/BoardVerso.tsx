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
import { fetchCourseVersos, previousVersos, versoLabel, type ClassVerso, type CourseVersos } from '../../lib/boardVersos';
import { fetchSessionSourceBoard } from '../../lib/boardsQueries';

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

/** Image d'une page (rendu canvas), à la largeur donnée. */
export function PageImage({ page, width, mode = 'revealed', className }: { page: BoardPage; width: number; mode?: 'revealed' | 'covered'; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    renderPageToCanvas(page, width, { mode })
      .then((canvas) => { if (!cancelled) setUrl(canvas.toDataURL('image/jpeg', 0.8)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [page, width, mode]);
  return (
    <span className={className} style={{ aspectRatio: `${pageRatio(page)}` }}>
      {url && <img src={url} alt="" draggable={false} />}
    </span>
  );
}

/** Versos d'un cours, lus une fois par cours le temps de la séance (les autres séances ne bougent pas). */
const courseVersosCache = new Map<string, Promise<CourseVersos>>();

/** Ce que le verso ouvert sait de sa page : le cours joué, la séance, la page préparée copiée. */
export interface VersoContext {
  /** Cours (tableau préparé) ; absent : celui de la séance, lu dans `session_boards`. */
  boardId?: string;
  sessionId: string;
  /** Page préparée que la page jouée copie (`origin`). */
  origin?: string;
}

/**
 * Tableaux blancs des séances précédentes sur la même page du cours (même classe d'abord) : un
 * bouton à côté de la vignette, une liste, et l'aperçu en grand. « Reprendre ici » recopie un
 * ancien tableau blanc sur celui-ci, s'il est encore vide.
 */
export function VersoHistory({ context, canTake, onTake }: { context: VersoContext; canTake: boolean; onTake: (verso: BoardPage) => void }) {
  const [list, setList] = useState<ClassVerso[]>([]);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<ClassVerso | null>(null);
  const { boardId, sessionId, origin } = context;

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    (async () => {
      const id = boardId ?? (await fetchSessionSourceBoard(sessionId))?.id;
      if (!id || cancelled) return;
      let pending = courseVersosCache.get(id);
      if (!pending) { pending = fetchCourseVersos(id); courseVersosCache.set(id, pending); }
      const all = await pending;
      if (!cancelled) setList(previousVersos(all, all.keyOf(origin), sessionId));
    })();
    return () => { cancelled = true; };
  }, [boardId, sessionId, origin]);

  if (list.length === 0) return null;
  return (
    <>
      <div className="wb__hist" onPointerDown={(e) => e.stopPropagation()}>
        {open && (
          <div className="wb__hist-list" role="menu">
            {list.map((v) => (
              <button key={`${v.sessionId}|${v.pageId}`} type="button" role="menuitem" className="wb__hist-item" onClick={() => { setShown(v); setOpen(false); }}>
                <PageImage page={v.verso} width={240} className="wb__hist-img" />
                <span>{versoLabel(v)}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className={`wb__hist-btn ${open ? 'is-on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}
          title="Ce qui a été écrit sur cette page lors des séances précédentes">
          🕘 Séances précédentes ({list.length})
        </button>
      </div>
      {shown && (
        <div className="wb__hist-view" role="dialog" aria-label={`Tableau blanc — ${versoLabel(shown)}`} onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setShown(null); }}>
          <div className="wb__hist-card">
            <div className="wb__hist-head">
              <b>Tableau blanc — {versoLabel(shown)}</b>
              <span className="wb__hist-sp" />
              <button type="button" className="wb__hist-take" disabled={!canTake} onClick={() => { onTake(shown.verso); setShown(null); }}
                title={canTake ? 'Recopier ce tableau blanc ici pour continuer dessus' : 'Ce tableau blanc a déjà quelque chose : effacez-le d’abord pour reprendre l’ancien'}>
                Reprendre ici
              </button>
              <button type="button" className="wb__hist-close" onClick={() => setShown(null)}>Fermer</button>
            </div>
            <PageImage page={shown.verso} width={1600} className="wb__hist-big" />
          </div>
        </div>
      )}
    </>
  );
}

/** Styles de la vignette (injectés avec ceux du tableau blanc). */
export const VERSO_CSS = `
.wb__back { position: absolute; left: 14px; bottom: 14px; z-index: 5; display: flex; flex-direction: column; gap: 6px; width: ${THUMB_W}px; padding: 6px; border: 1px solid #CBD5E1; border-radius: 12px; background: rgba(255,255,255,0.96); box-shadow: 0 4px 16px rgba(15,23,42,0.16); cursor: pointer; }
.wb__back:hover { border-color: #818CF8; }
.wb__back-img { display: block; width: 100%; max-height: 160px; overflow: hidden; border-radius: 7px; background: #F1F5F9; }
.wb__back-img img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
.wb__back-label { font: 600 13px/1.2 Inter, system-ui, sans-serif; color: #3730A3; text-align: center; }
.wb__hist { position: absolute; left: ${THUMB_W + 28}px; bottom: 14px; z-index: 5; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.wb__hist-btn { height: 44px; padding: 0 16px; border: 1px solid #CBD5E1; border-radius: 12px; background: rgba(255,255,255,0.96); color: #1F2937; font: 600 14px/1 Inter, system-ui, sans-serif; box-shadow: 0 2px 10px rgba(15,23,42,0.12); cursor: pointer; }
.wb__hist-btn:hover, .wb__hist-btn.is-on { border-color: #818CF8; color: #3730A3; }
.wb__hist-list { display: flex; flex-direction: column; gap: 6px; max-height: 60vh; overflow: auto; padding: 8px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF; box-shadow: 0 8px 24px rgba(15,23,42,0.18); }
.wb__hist-item { display: flex; align-items: center; gap: 10px; padding: 6px; border: 1px solid transparent; border-radius: 9px; background: none; font: 600 14px/1.2 Inter, system-ui, sans-serif; color: #1F2937; text-align: left; cursor: pointer; }
.wb__hist-item:hover { border-color: #C7D2FE; background: #EEF2FF; }
.wb__hist-img { display: block; width: 120px; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; background: #FFFFFF; }
.wb__hist-img img, .wb__hist-big img { display: block; width: 100%; height: 100%; object-fit: contain; }
.wb__hist-view { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,0.55); }
.wb__hist-card { display: flex; flex-direction: column; gap: 10px; width: min(1200px, 100%); max-height: 100%; padding: 12px; border-radius: 14px; background: #FFFFFF; box-shadow: 0 16px 48px rgba(15,23,42,0.3); }
.wb__hist-head { display: flex; align-items: center; gap: 8px; font: 15px/1.2 Inter, system-ui, sans-serif; color: #0F172A; }
.wb__hist-sp { flex: 1; }
.wb__hist-take, .wb__hist-close { height: 40px; padding: 0 16px; border-radius: 10px; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wb__hist-take { border: 0; background: #4F46E5; color: #FFFFFF; }
.wb__hist-take:disabled { background: #C7D2FE; cursor: not-allowed; }
.wb__hist-close { border: 1px solid #CBD5E1; background: #FFFFFF; color: #1F2937; }
.wb__hist-big { display: block; width: 100%; min-height: 0; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; }
`;
