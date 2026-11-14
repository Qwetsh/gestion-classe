/**
 * Mode En classe (PLAN_cours_editeur.md, lot 4, tranche 4a) : le cours projeté.
 *
 * L'écran montre une **bande de la largeur de la colonne de texte** (un texte 12 pt fait ≈ 34 px
 * sur un TBI de 1280 px), qui descend le long du cours : Suivant / Précédent (flèches, espace,
 * Page suivante des télécommandes, boutons à l'écran), molette pour un réglage fin. Un encart
 * 16:9 atteint en descendant est calé en haut de l'écran : il le remplit exactement. La vue
 * d'ensemble montre tout le cours ; un clic y ramène la bande à cet endroit.
 *
 * Pas de pages en classe : les sauts de page deviennent un trait discret. Les annotations du
 * mode Tableau s'affichent ; l'encre de la séance se pose au-dessus (mode test : elle n'est
 * jamais enregistrée et disparaît en quittant).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import { courseExtensions } from './courseExtensions';
import { CourseLayer } from './CourseLayer';
import { themeStyle } from './courseThemes';
import type { CourseDoc } from '../../lib/course/courseDoc';
import type { LayerItem } from '../../lib/course/courseLayer';
import { COL_W, MARGIN, PAGE_W } from '../../lib/course/coursePage';
import { Icon } from './courseIcons';
import type { DrawTool } from './courseDraw';
import type { ClassroomBus } from '../../lib/classroomBus';

interface Props {
  boardId: string;
  doc: CourseDoc;
  title: string;
  /** Absent dans l'écran de classe (on revient au plan avec B). */
  onClose?: () => void;
  /**
   * Séance réelle (lot 4b, écran /classe) : l'encre part de `initialInk` et chaque changement est
   * remonté par `onInkChange` (rangé dans la séance). Sans : mode test, encre perdue en quittant.
   */
  session?: { initialInk: LayerItem[]; onInkChange: (items: LayerItem[]) => void };
  /** Canal de la séance (lot 4c) : le téléphone envoie Suivant / Précédent / Vue d'ensemble. */
  bus?: ClassroomBus | null;
}

/** Marge visible de chaque côté de la colonne (les annotations posées au bord restent visibles). */
const BAND_PAD = 18;
/** Haut de la bande au-dessus du premier bloc. */
const TOP_PAD = 24;
/** Recouvrement entre deux écrans : la dernière ligne lue reste visible. */
const OVERLAP = 56;
const INK_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#111827'];

type InkTool = 'none' | Extract<DrawTool, 'pen' | 'highlighter' | 'eraser'>;

export function CoursePresenter({ boardId, doc, title, onClose, session, bus }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [flowH, setFlowH] = useState(800);
  const [y, setY] = useState(0);
  const [overview, setOverview] = useState(false);
  const [stops, setStops] = useState<number[]>([]);
  const [ink, setInkState] = useState<LayerItem[]>(() => session?.initialInk ?? []);
  const onInkChange = session?.onInkChange;
  const setInk = useCallback((items: LayerItem[]) => { setInkState(items); onInkChange?.(items); }, [onInkChange]);
  const [tool, setTool] = useState<InkTool>('none');
  const [color, setColor] = useState(INK_COLORS[0]);

  const extensions = useMemo(() => courseExtensions(
    () => { /* pas de pages en classe */ },
    { boardId, onEdit: () => { /* les encarts se dessinent en classe dans une tranche suivante */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

  // ---- Géométrie : la colonne (et un peu de marge) remplit la largeur de l'écran ----
  const bandW = COL_W + 2 * BAND_PAD;
  const scale = vp.w / bandW;
  const screenH = vp.h / scale;
  const step = Math.max(80, screenH - OVERLAP);
  const pageH = TOP_PAD + flowH + 120;
  const maxY = Math.max(0, pageH - screenH);
  const clampY = useCallback((v: number) => Math.min(maxY, Math.max(0, v)), [maxY]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    document.body.classList.add('ce-presenting');
    return () => { window.removeEventListener('resize', onResize); document.body.classList.remove('ce-presenting'); };
  }, []);

  // Hauteur du cours et positions des encarts (arrêts de la descente)
  useLayoutEffect(() => {
    const flow = flowRef.current;
    const page = pageRef.current;
    if (!flow || !page) return;
    const measure = () => {
      const pr = page.getBoundingClientRect();
      const s = pr.width / PAGE_W || 1;
      setFlowH(flow.offsetHeight);
      setStops([...flow.querySelectorAll('.ce-encart')].map((el) => (el.getBoundingClientRect().top - pr.top) / s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(flow);
    return () => ro.disconnect();
  }, [editor]);

  // ---- Navigation ----
  const next = useCallback(() => {
    setY((cur) => {
      let target = cur + step;
      // Un encart pas encore en haut de l'écran : on s'arrête dessus (il remplit alors l'écran),
      // même s'il faut descendre d'un quart d'écran de plus pour le caler
      const encart = stops.find((s) => s > cur + 8 && s - 6 < target + screenH / 4);
      if (encart !== undefined) target = encart - 6;
      return clampY(target);
    });
  }, [step, stops, clampY, screenH]);
  const prev = useCallback(() => {
    setY((cur) => {
      let target = cur - step;
      const encart = [...stops].reverse().find((s) => s - 6 < cur - 8 && s - 6 > target);
      if (encart !== undefined) target = encart - 6;
      return clampY(target);
    });
  }, [step, stops, clampY]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => { /* refusé par le navigateur */ });
  }, []);

  const close = useCallback(() => {
    if (!onClose) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    onClose();
  }, [onClose]);
  const embedded = !!session;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      const k = e.key;
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); if (overview) setOverview(false); else next(); }
      else if (['ArrowUp', 'ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (!overview) prev(); }
      else if (k === 'Home') { e.preventDefault(); setY(0); }
      else if (k === 'End') { e.preventDefault(); setY(maxY); }
      else if (k === 'o' || k === 'O' || k === 'z' || k === 'Z') { e.preventDefault(); setOverview((v) => !v); }
      // Dans l'écran de classe, F (plein écran) et B (plan) appartiennent à la page /classe
      else if ((k === 'f' || k === 'F') && !embedded) { e.preventDefault(); toggleFullscreen(); }
      else if (k === 'Escape') { e.preventDefault(); if (overview) setOverview(false); else if (!document.fullscreenElement) close(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, prev, overview, maxY, close, toggleFullscreen, embedded]);

  // Télécommande du téléphone (lot 4c)
  const navRef = useRef({ next, prev });
  useEffect(() => { navRef.current = { next, prev }; });
  useEffect(() => {
    if (!bus) return;
    return bus.subscribe((cmd) => {
      if (cmd.kind !== 'nav') return;
      if (cmd.action === 'overview') { setOverview((v) => !v); return; }
      setOverview(false);
      if (cmd.action === 'next') navRef.current.next();
      else navRef.current.prev();
    });
  }, [bus]);

  const onWheel = (e: React.WheelEvent) => {
    if (overview) return;
    setY((cur) => clampY(cur + e.deltaY / scale));
  };

  // ---- Vue d'ensemble : tout le cours, la bande actuelle encadrée ----
  const ovScale = Math.min((vp.h * 0.92) / pageH, (vp.w * 0.92) / PAGE_W, scale * 0.6);
  const ovX = (vp.w - PAGE_W * ovScale) / 2;
  const ovY = Math.max(16, (vp.h - pageH * ovScale) / 2);

  const transform = overview
    ? `translate(${ovX}px, ${ovY}px) scale(${ovScale})`
    : `translate(${-(MARGIN - BAND_PAD) * scale}px, ${-y * scale}px) scale(${scale})`;

  const onPageClick = (e: React.MouseEvent) => {
    if (!overview) return;
    const pr = pageRef.current!.getBoundingClientRect();
    const docY = (e.clientY - pr.top) / ovScale;
    setY(clampY(docY - screenH / 3));
    setOverview(false);
  };

  const screens = Math.max(1, Math.ceil(maxY / step) + 1);
  const screenNo = Math.min(screens, Math.round(y / step) + 1);
  const settings = doc.settings ?? {};

  return createPortal(
    <div ref={rootRef} className={`ce-pres ${embedded ? 'ce-pres--embedded' : ''} ${overview ? 'is-overview' : ''}`} role="dialog" aria-label={`En classe : ${title}`} onWheel={onWheel}>
      <div
        ref={pageRef}
        className="ce-pres__page"
        style={{ width: PAGE_W, height: pageH, transform }}
        onClick={onPageClick}
      >
        <div
          ref={flowRef}
          className="ce-flow"
          style={{ left: MARGIN, top: TOP_PAD, width: COL_W, ...themeStyle(settings.theme) }}
          data-numbering={settings.numbering && settings.numbering !== 'none' ? settings.numbering : undefined}
          data-hyphens={settings.hyphens ? '' : undefined}
          data-caption={settings.captionLabel ?? 'document'}
        >
          {editor && <EditorContent editor={editor} />}
        </div>
        {editor && (
          <>
            {/* Annotations préparées (mode Tableau), en lecture seule */}
            <CourseLayer editor={editor} items={doc.layer?.items ?? []} height={pageH} active={false} readOnly
              style={{ tool: 'select', color: '#000', size: 'M' }} selected={null} onSelect={() => {}} onChange={() => {}} />
            {/* Encre de la séance (mode test : jamais enregistrée) */}
            <CourseLayer editor={editor} items={ink} height={pageH} active={tool !== 'none' && !overview}
              style={{ tool: tool === 'none' ? 'select' : tool, color, size: 'M' }} selected={null} onSelect={() => {}}
              onChange={(items) => setInk(items)} />
          </>
        )}
        {overview && <div className="ce-pres__band" style={{ left: MARGIN - BAND_PAD, top: y, width: bandW, height: screenH }} />}
      </div>

      <div className="ce-pres__bar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="ce-pres__btn" onClick={prev} disabled={y <= 0 || overview} title="Précédent (↑, Page précédente)" aria-label="Écran précédent">◀</button>
        <span className="ce-pres__count">{overview ? 'Vue d’ensemble' : `Écran ${screenNo} / ${screens}`}</span>
        <button type="button" className="ce-pres__btn" onClick={next} disabled={y >= maxY || overview} title="Suivant (↓, espace, Page suivante)" aria-label="Écran suivant">▶</button>
        <span className="ce-pres__sep" />
        <button type="button" className={`ce-pres__btn ${tool === 'none' ? 'is-on' : ''}`} onClick={() => setTool('none')} title="Main : rien ne s'écrit" aria-label="Main"><Icon name="select" size={18} /></button>
        <button type="button" className={`ce-pres__btn ${tool === 'pen' ? 'is-on' : ''}`} onClick={() => setTool('pen')} title="Stylo" aria-label="Stylo"><Icon name="pen" size={18} /></button>
        <button type="button" className={`ce-pres__btn ${tool === 'highlighter' ? 'is-on' : ''}`} onClick={() => setTool('highlighter')} title="Surligneur" aria-label="Surligneur"><Icon name="highlighter" size={18} /></button>
        <button type="button" className={`ce-pres__btn ${tool === 'eraser' ? 'is-on' : ''}`} onClick={() => setTool('eraser')} title="Gomme" aria-label="Gomme"><Icon name="eraser" size={18} /></button>
        {INK_COLORS.map((c) => (
          <button key={c} type="button" className={`ce-pres__color ${color === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'none' || tool === 'eraser') setTool('pen'); }} aria-label={`Couleur ${c}`} />
        ))}
        <button type="button" className="ce-pres__btn" onClick={() => setInk([])} disabled={ink.length === 0} title="Effacer toute l'encre de la séance" aria-label="Effacer l'encre"><Icon name="clearPage" size={18} /></button>
        <span className="ce-pres__sep" />
        <button type="button" className={`ce-pres__btn ${overview ? 'is-on' : ''}`} onClick={() => setOverview((v) => !v)} title="Vue d'ensemble (O)" aria-label="Vue d'ensemble"><Icon name="fitPage" size={18} /></button>
        {!embedded && <button type="button" className="ce-pres__btn" onClick={toggleFullscreen} title="Plein écran (F)" aria-label="Plein écran"><Icon name="present" size={18} /></button>}
        {embedded
          ? <span className="ce-pres__test ce-pres__test--live" title="L'encre est gardée dans la séance, jamais dans le cours préparé">Séance</span>
          : <span className="ce-pres__test" title="L'encre n'est pas gardée : elle disparaît en quittant">Test</span>}
        {onClose && <button type="button" className="ce-pres__quit" onClick={close} title="Quitter (Échap)">Quitter</button>}
      </div>
    </div>,
    document.body,
  );
}
