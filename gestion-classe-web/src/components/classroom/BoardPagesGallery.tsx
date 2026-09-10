/**
 * Relecture des pages du tableau blanc d'une séance (détail de séance) :
 * vignettes, agrandissement, export PDF pour les absents.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchBoardPages } from '../../lib/boardQueries';
import { renderPageToCanvas, BOARD_RATIO, type BoardPage } from '../../lib/boardRender';
import { BoardExportDialog } from './BoardExportDialog';

interface BoardPagesGalleryProps {
  sessionId: string;
  /** Nom de fichier (sans extension) pour l'export PDF. */
  exportName: string;
}

// Les pages sont dessinées sur un écran 16:9 ; on garde ce ratio à la relecture.
const THUMB_W = 480;
const FULL_W = 1920;

function PageCanvas({ page, width, className }: { page: BoardPage; width: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width / BOARD_RATIO);
  useEffect(() => {
    let cancelled = false;
    renderPageToCanvas(page, width).then((rendered) => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (cancelled || !canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(rendered, 0, 0);
    });
    return () => { cancelled = true; };
  }, [page, width, height]);
  return <canvas ref={ref} width={width} height={height} className={className} style={{ width: '100%', height: 'auto', display: 'block' }} />;
}

export function BoardPagesGallery({ sessionId, exportName }: BoardPagesGalleryProps) {
  const [pages, setPages] = useState<BoardPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBoardPages(sessionId)
      .then((b) => { if (!cancelled) setPages(b.pages); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement'); });
    return () => { cancelled = true; };
  }, [sessionId]);

  const inkPages = (pages || []).filter((p) => p.strokes.length > 0 || p.image || (p.objects ?? []).length > 0);
  if (pages === null && !error) return null;
  if (error) return <div className="p-5 text-sm text-[var(--neg)]">Tableau : {error}</div>;
  if (inkPages.length === 0) return null;

  return (
    <div
      className="bg-[var(--surface)] overflow-hidden"
      style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
    >
      <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
        <div
          className="w-10 h-10 flex items-center justify-center text-xl"
          style={{ background: 'var(--indigo-soft)', borderRadius: 'var(--radius)' }}
        >
          🖊️
        </div>
        <h2 className="font-semibold text-[var(--text)] flex-1">
          Tableau ({inkPages.length} page{inkPages.length > 1 ? 's' : ''})
        </h2>
        <button className="btn btn--ghost" onClick={() => setExporting(true)} title="Télécharger les pages en PDF (pour les absents)">
          PDF
        </button>
        {exporting && <BoardExportDialog pages={inkPages} name={exportName} onClose={() => setExporting(false)} />}
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {inkPages.map((page, i) => (
          <button
            key={page.id}
            className="text-left rounded-xl overflow-hidden border border-[var(--border)] hover:border-[var(--indigo)] transition-colors"
            onClick={() => setOpenIndex(i)}
            title="Agrandir"
          >
            <PageCanvas page={page} width={THUMB_W} />
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">Page {i + 1}</div>
          </button>
        ))}
      </div>

      {openIndex !== null && inkPages[openIndex] && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6" onClick={() => setOpenIndex(null)}>
          <div className="w-full max-w-6xl bg-white rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <PageCanvas page={inkPages[openIndex]} width={FULL_W} />
            <div className="flex items-center justify-between px-4 py-2 text-sm text-[var(--text-muted)] bg-[var(--surface-2)]">
              <button className="btn btn--ghost" onClick={() => setOpenIndex((i) => Math.max(0, (i ?? 0) - 1))} disabled={openIndex === 0}>← Précédente</button>
              <span>Page {openIndex + 1} / {inkPages.length}</span>
              <button className="btn btn--ghost" onClick={() => setOpenIndex((i) => Math.min(inkPages.length - 1, (i ?? 0) + 1))} disabled={openIndex >= inkPages.length - 1}>Suivante →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
