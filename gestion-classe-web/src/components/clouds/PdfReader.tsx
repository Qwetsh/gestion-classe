/**
 * Lecteur PDF (pdfjs) : pages rendues à la demande quand elles entrent dans l'écran, zoom, page
 * courante, ouverture dans un onglet. Fonctionne partout, y compris sur téléphone où l'iframe PDF
 * native ne s'affiche pas.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { getPdfjs } from '../../lib/pdfjs';

interface Props { file: File }

interface PageSize { width: number; height: number }

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Identifiant stable par objet File (clé React : un lecteur neuf par fichier). */
const fileIds = new WeakMap<File, number>();
let nextFileId = 0;
function fileId(f: File): number {
  let id = fileIds.get(f);
  if (id === undefined) { id = ++nextFileId; fileIds.set(f, id); }
  return id;
}

/** Un lecteur neuf par fichier : tout l'état (document, zoom, page) repart de zéro. */
export function PdfReader({ file }: Props) {
  return <PdfReaderInner key={fileId(file)} file={file} />;
}

function PdfReaderInner({ file }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** 'fit' = largeur de l'écran ; sinon facteur par rapport à la taille réelle (72 dpi). */
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2]));
  const [containerWidth, setContainerWidth] = useState(800);
  const scrollRef = useRef<HTMLDivElement>(null);
  const blobUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        const data = await file.arrayBuffer();
        doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) { await doc.destroy(); return; }
        const list: PageSize[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const v = (await doc.getPage(i)).getViewport({ scale: 1 });
          list.push({ width: v.width, height: v.height });
        }
        if (cancelled) return;
        setSizes(list);
        setPdf(doc);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PDF illisible');
      }
    })();
    return () => { cancelled = true; void doc?.destroy(); };
  }, [file]);

  // Largeur disponible (réagit au redimensionnement)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const widest = sizes.reduce((m, s) => Math.max(m, s.width), 1);
  const cssWidthOf = (s: PageSize) => (zoom === 'fit' ? (Math.max(200, containerWidth - 32) * s.width) / widest : s.width * zoom * (96 / 72));

  // Pages à rendre : celles visibles et leurs voisines
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || sizes.length === 0) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'));
    const io = new IntersectionObserver((entries) => {
      setVisible((prev) => {
        const next = new Set(prev);
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) { next.add(n); next.add(n - 1); next.add(n + 1); }
        }
        return next.size === prev.size && [...next].every((n) => prev.has(n)) ? prev : next;
      });
    }, { root, rootMargin: '400px 0px' });
    nodes.forEach((n) => io.observe(n));
    // Page courante = celle qui occupe le centre de l'écran
    const onScroll = () => {
      const mid = root.scrollTop + root.clientHeight / 2;
      let best = 1;
      for (const n of nodes) { if (n.offsetTop <= mid) best = Number(n.dataset.page); }
      setCurrent(best);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); root.removeEventListener('scroll', onScroll); };
  }, [sizes]);

  const goTo = (n: number) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${Math.min(sizes.length, Math.max(1, n))}"]`);
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const zoomIndex = zoom === 'fit' ? -1 : ZOOMS.indexOf(zoom);
  const effective = zoom === 'fit' ? Math.max(200, containerWidth - 32) / (widest * (96 / 72)) : zoom;
  const zoomBy = (dir: 1 | -1) => {
    const idx = zoomIndex >= 0 ? zoomIndex + dir : dir > 0 ? ZOOMS.findIndex((z) => z > effective) : ZOOMS.length - 1 - [...ZOOMS].reverse().findIndex((z) => z < effective);
    if (idx < 0 || idx >= ZOOMS.length) return;
    setZoom(ZOOMS[idx]);
  };

  return (
    <div className="pdfr">
      <div className="pdfr__bar">
        <button type="button" onClick={() => goTo(current - 1)} disabled={current <= 1} title="Page précédente">‹</button>
        <span className="pdfr__count">
          <input type="number" min={1} max={sizes.length || 1} value={current} onChange={(e) => goTo(Number(e.target.value))} onKeyDown={(e) => e.stopPropagation()} />
          / {sizes.length || '…'}
        </span>
        <button type="button" onClick={() => goTo(current + 1)} disabled={current >= sizes.length} title="Page suivante">›</button>
        <span className="pdfr__sep" />
        <button type="button" onClick={() => zoomBy(-1)} title="Réduire">−</button>
        <button type="button" className={zoom === 'fit' ? 'is-on' : ''} onClick={() => setZoom('fit')} title="Adapter à la largeur">{zoom === 'fit' ? 'Largeur' : `${Math.round(effective * 100)} %`}</button>
        <button type="button" onClick={() => zoomBy(1)} title="Agrandir">+</button>
        <span className="pdfr__spacer" />
        <a href={blobUrl} target="_blank" rel="noreferrer" title="Ouvrir dans un nouvel onglet (lecteur du navigateur)">Nouvel onglet ↗</a>
      </div>
      <div className="pdfr__scroll" ref={scrollRef}>
        {error && <p className="pdfr__msg">PDF illisible : {error}</p>}
        {!error && !pdf && <p className="pdfr__msg">Chargement du PDF…</p>}
        {pdf && sizes.map((s, i) => {
          const w = cssWidthOf(s);
          const h = (w * s.height) / s.width;
          return (
            <div key={i} className="pdfr__page" data-page={i + 1} style={{ width: w, height: h }}>
              {visible.has(i + 1) && <PdfPageCanvas pdf={pdf} index={i + 1} cssWidth={w} baseWidth={s.width} />}
            </div>
          );
        })}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function PdfPageCanvas({ pdf, index, cssWidth, baseWidth }: { pdf: PDFDocumentProxy; index: number; cssWidth: number; baseWidth: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(index);
      if (cancelled) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (cssWidth / baseWidth) * dpr });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // pdfjs-dist v5 : le type RenderParameters exige un cast (voir mémoire projet)
      task = page.render({ canvasContext: ctx, viewport, canvas } as never);
      try { await task.promise; } catch { /* rendu annulé (zoom ou fermeture) */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, index, cssWidth, baseWidth]);

  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

const CSS = `
.pdfr { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #52525B; }
.pdfr__bar { display: flex; align-items: center; gap: 4px; padding: 6px 10px; background: #27272A; color: #E4E4E7; font: 500 13px/1 Inter, system-ui, sans-serif; flex-wrap: wrap; }
.pdfr__bar button, .pdfr__bar a { height: 32px; min-width: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: #3F3F46; color: #F4F4F5; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.pdfr__bar button:disabled { opacity: 0.4; cursor: default; }
.pdfr__bar button.is-on { background: #4F46E5; }
.pdfr__count { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; }
.pdfr__count input { width: 44px; height: 30px; text-align: center; border: 1px solid #52525B; border-radius: 6px; background: #18181B; color: #F4F4F5; font: 600 13px/1 Inter, system-ui, sans-serif; }
.pdfr__sep { width: 1px; height: 22px; background: #52525B; margin: 0 6px; }
.pdfr__spacer { flex: 1; }
.pdfr__scroll { flex: 1; overflow: auto; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.pdfr__page { flex: none; background: #FFFFFF; box-shadow: 0 4px 18px rgba(0,0,0,0.35); }
.pdfr__msg { color: #E4E4E7; font: 500 14px/1.4 Inter, system-ui, sans-serif; }
`;
