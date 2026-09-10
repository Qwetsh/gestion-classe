/**
 * Export PDF : choix des pages, version élève (caches et trous masqués) ou corrigée,
 * avec ou sans l'encre, une ou deux pages par feuille.
 */
import { useEffect, useState } from 'react';
import { BOARD_RATIO, renderPageToCanvas, type BoardPage } from '../../lib/boardRender';
import { exportBoardPdf } from '../../lib/boardExport';

interface Props {
  pages: BoardPage[];
  name: string;
  currentIndex?: number;
  onClose: () => void;
}

function Thumb({ page, mode }: { page: BoardPage; mode: 'covered' | 'revealed' }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    renderPageToCanvas(page, 320, { mode }).then((c) => { if (!cancelled) setUrl(c.toDataURL('image/jpeg', 0.7)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [page, mode]);
  return <div className="wbx__thumb" style={{ aspectRatio: `${BOARD_RATIO}` }}>{url && <img src={url} alt="" />}</div>;
}

export function BoardExportDialog({ pages, name, currentIndex, onClose }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(pages.map((_, i) => i)));
  const [mode, setMode] = useState<'covered' | 'revealed'>('revealed');
  const [hideInk, setHideInk] = useState(false);
  const [twoPerSheet, setTwoPerSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasReveal = pages.some((p) => (p.objects ?? []).some((o) => o.cover || (o.type === 'text' && o.html.includes('data-gap'))));

  const toggle = (i: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const run = async () => {
    setBusy(true);
    try {
      await exportBoardPdf(pages, name, { mode, hideInk, twoPerSheet, pageIndexes: [...selected].sort((a, b) => a - b) });
      onClose();
    } catch (err) {
      window.alert(`Export impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wbx" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="wbx__box" onClick={(e) => e.stopPropagation()}>
        <div className="wbx__head">
          <h2>Exporter en PDF</h2>
          <button type="button" className="wbx__close" onClick={onClose} title="Fermer">✕</button>
        </div>

        <div className="wbx__options">
          <label className={`wbx__opt ${mode === 'revealed' ? 'is-on' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'revealed'} onChange={() => setMode('revealed')} />
            <span><b>Corrigé</b><small>tout visible</small></span>
          </label>
          <label className={`wbx__opt ${mode === 'covered' ? 'is-on' : ''} ${!hasReveal ? 'is-muted' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'covered'} onChange={() => setMode('covered')} />
            <span><b>Version élève</b><small>{hasReveal ? 'rideaux, tickets et trous masqués' : 'aucun cache ni trou dans ce tableau'}</small></span>
          </label>
          <label className={`wbx__opt ${hideInk ? 'is-on' : ''}`}>
            <input type="checkbox" checked={hideInk} onChange={(e) => setHideInk(e.target.checked)} />
            <span><b>Sans l'encre</b><small>garder textes, formes et fonds</small></span>
          </label>
          <label className={`wbx__opt ${twoPerSheet ? 'is-on' : ''}`}>
            <input type="checkbox" checked={twoPerSheet} onChange={(e) => setTwoPerSheet(e.target.checked)} />
            <span><b>2 pages par feuille</b><small>économise le papier</small></span>
          </label>
        </div>

        <div className="wbx__pages-head">
          <span>{selected.size} / {pages.length} page{pages.length > 1 ? 's' : ''}</span>
          <button type="button" className="wbx__link" onClick={() => setSelected(new Set(pages.map((_, i) => i)))}>Toutes</button>
          <button type="button" className="wbx__link" onClick={() => setSelected(new Set())}>Aucune</button>
          {currentIndex !== undefined && <button type="button" className="wbx__link" onClick={() => setSelected(new Set([currentIndex]))}>Celle-ci</button>}
        </div>
        <div className="wbx__pages">
          {pages.map((p, i) => (
            <label key={p.id} className={`wbx__page ${selected.has(i) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
              <Thumb page={p} mode={mode} />
              <span>{i + 1}</span>
            </label>
          ))}
        </div>

        <div className="wbx__foot">
          <button type="button" className="wbx__btn" onClick={onClose}>Annuler</button>
          <button type="button" className="wbx__btn wbx__btn--primary" disabled={busy || selected.size === 0} onClick={() => void run()}>
            {busy ? 'Export…' : `Exporter ${selected.size} page${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbx { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.6); font: 400 15px/1.4 Inter, system-ui, sans-serif; }
.wbx__box { width: min(880px, calc(100vw - 32px)); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #111827; color: #F3F4F6; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.5); overflow: hidden; }
.wbx__head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 10px; }
.wbx__head h2 { margin: 0; font-size: 20px; font-weight: 600; }
.wbx__close { border: 0; background: #1F2937; color: #E5E7EB; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
.wbx__options { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; padding: 6px 22px 12px; }
.wbx__opt { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #1F2937; cursor: pointer; border: 2px solid transparent; }
.wbx__opt.is-on { border-color: #6366F1; }
.wbx__opt.is-muted { opacity: 0.5; }
.wbx__opt input { width: 18px; height: 18px; accent-color: #6366F1; }
.wbx__opt span { display: flex; flex-direction: column; }
.wbx__opt small { color: #9CA3AF; font-size: 12px; }
.wbx__pages-head { display: flex; align-items: center; gap: 14px; padding: 4px 22px; color: #9CA3AF; font-size: 13px; }
.wbx__link { border: 0; background: transparent; color: #A5B4FC; cursor: pointer; font: inherit; padding: 0; }
.wbx__pages { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 8px 22px 16px; }
.wbx__page { position: relative; display: block; border-radius: 10px; overflow: hidden; border: 2px solid #374151; cursor: pointer; }
.wbx__page.is-on { border-color: #6366F1; }
.wbx__page input { position: absolute; left: 8px; top: 8px; z-index: 1; width: 18px; height: 18px; accent-color: #6366F1; }
.wbx__page span { position: absolute; right: 8px; bottom: 6px; padding: 2px 7px; border-radius: 6px; background: rgba(17,24,39,0.85); font: 600 11px/1.3 "IBM Plex Mono", ui-monospace, monospace; }
.wbx__thumb { width: 100%; background: #FFFFFF; }
.wbx__thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.wbx__foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 22px 18px; border-top: 1px solid #1F2937; }
.wbx__btn { height: 42px; padding: 0 18px; border-radius: 11px; border: 0; background: #1F2937; color: #F3F4F6; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbx__btn--primary { background: #4F46E5; color: #FFFFFF; }
.wbx__btn:disabled { opacity: 0.4; cursor: default; }
`;
