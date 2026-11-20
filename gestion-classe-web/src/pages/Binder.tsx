/**
 * Classeur virtuel (PLAN_classeur_virtuel.md, lot 1) : page `/classeur?niveau=4e&page=3`.
 *
 * Le classeur d'un élève « parfait », assemblé à la volée depuis la bibliothèque de « Mes cours »
 * (lib/binder.ts) : modifier une fiche dans « Mes cours » modifie le classeur. Double page sur un
 * grand écran (comme un classeur ouvert), page seule sur un écran étroit. Flèches du clavier,
 * onglets des intercalaires, sommaire. Pour l'instant, pour le professeur seul.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Columns2, List, RectangleVertical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { listBoards, type Board } from '../lib/boardsQueries';
import { courseHref } from '../lib/courseLibrary';
import {
  SECTION_LABEL, SECTION_ORDER, binderLevels, binderToc, buildBinder, dividerIndex, sectionAt, spreadOf, turn,
  type BinderSection,
} from '../lib/binder';
import { turnDirection } from '../lib/binderFlaps';
import { INK_PX, INK_WIDTH_MM, SUMMARY_LEAD, summaryRuns, withSummaries, wrapInk, type SummaryRuns } from '../lib/binderSummary';
import { MM, PAGE_H, PAGE_W } from '../lib/course/coursePage';
import { BinderLeaf } from '../components/binder/BinderLeaf';
import { HOLES_MM, loadSheetDoc } from '../components/binder/binderSheet';
// Polices des cours (chargées d'habitude avec l'éditeur) : une fiche peut s'en servir
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '@fontsource/playwrite-fr-moderne/400.css';
import '../styles/classeur.css';

/** Largeur d'écran à partir de laquelle le classeur s'ouvre en double page. */
const DOUBLE_MIN_W = 1000;
/** Place des onglets qui dépassent de chaque côté, en px de feuille. */
const TAB_W = 70;

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function Binder() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewport = useViewport();
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 1280);
  /** Choix de l'utilisateur ; null = selon la largeur de l'écran. */
  const [doubleChoice, setDoubleChoice] = useState<boolean | null>(null);
  /** Page en train de se tourner : une feuille passe d'un côté à l'autre (lot 3). */
  const [turning, setTurning] = useState<{ dir: 1 | -1; id: number } | null>(null);
  /** Début d'un glissement du doigt (tourner les pages sur téléphone). */
  const swipeX = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listBoards(userId)
      .then((list) => { if (!cancelled) setBoards(list); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Bibliothèque illisible'); });
    return () => { cancelled = true; };
  }, [userId]);

  const levels = useMemo(() => (boards ? binderLevels(boards) : []), [boards]);
  const level = params.get('niveau') && levels.includes(params.get('niveau')!) ? params.get('niveau')! : levels[0] ?? null;
  const basePages = useMemo(() => (boards && level ? buildBinder(boards, level) : []), [boards, level]);

  // Les bilans de « L'essentiel » (feuilles de bilans corrigées) et la police d'écriture : lus avant
  // d'ouvrir le classeur, pour que les pages ne changent plus de numéro ensuite
  const [inkReady, setInkReady] = useState<{ texts: Map<string, SummaryRuns>; measure: (text: string) => number } | null>(null);
  useEffect(() => {
    if (basePages.length === 0) return;
    let cancelled = false;
    const sources = basePages.flatMap((p) => (p.kind === 'sheet' && p.role === 'summaries' && p.chapter && p.companion ? [{ chapter: p.chapter, board: p.companion }] : []));
    const font = `${INK_PX}px "Playwrite FR Moderne"`;
    Promise.all([
      Promise.all(sources.map(({ chapter, board }) => loadSheetDoc(board).then((d) => [chapter, d ? summaryRuns(d.content) : new Map()] as const, () => [chapter, new Map()] as const))),
      document.fonts.load(font).catch(() => []),
    ]).then(([lists]) => {
      if (cancelled) return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) ctx.font = font;
      setInkReady({ texts: new Map(lists), measure: (text) => (ctx ? ctx.measureText(text).width : text.length * INK_PX * 0.6) });
    });
    return () => { cancelled = true; };
  }, [basePages]);
  const pages = useMemo(() => {
    if (!inkReady) return basePages;
    const width = INK_WIDTH_MM * MM * 0.97;
    return withSummaries(basePages, inkReady.texts, (paragraphs) => wrapInk(paragraphs, width, inkReady.measure, SUMMARY_LEAD));
  }, [basePages, inkReady]);
  const count = pages.length;
  const index = Math.max(0, Math.min(count - 1, (Number(params.get('page')) || 1) - 1));

  const tocW = tocOpen && viewport.w >= 900 ? 260 : 0;
  const double = doubleChoice ?? viewport.w - tocW >= DOUBLE_MIN_W;
  const [leftIdx, rightIdx] = spreadOf(index, count, double);

  const go = useCallback((next: number) => {
    const q = new URLSearchParams(params);
    if (level) q.set('niveau', level);
    const target = Math.max(0, Math.min(count - 1, next));
    q.set('page', String(target + 1));
    setParams(q, { replace: true });
    const dir = turnDirection(index, target);
    if (dir !== 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setTurning({ dir, id: Date.now() });
  }, [params, setParams, level, count, index]);

  // Clavier : flèches, Page précédente / suivante, Début / Fin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(turn(index, count, double, 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(turn(index, count, double, -1)); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(count - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, count, double]);

  // Fiches de la vue suivante et de la précédente lues d'avance : la page se tourne sans attendre
  useEffect(() => {
    for (const dir of [1, -1] as const) {
      const [l, r] = spreadOf(turn(index, count, double, dir), count, double);
      for (const i of [l, r]) {
        const p = i === null ? null : pages[i];
        if (p?.kind === 'sheet') loadSheetDoc(p.board).catch(() => { /* relu à l'affichage */ });
      }
    }
  }, [index, count, double, pages]);

  const openCourse = useCallback((id: string) => { void navigate(courseHref(id)); }, [navigate]);

  // Mise à l'échelle : la vue entière tient dans l'écran
  const BAR_H = 56;
  // Sur téléphone, les flèches sont posées sur la page (et le doigt tourne les pages)
  const narrow = viewport.w < 640;
  const availW = Math.max(200, viewport.w - tocW - (narrow ? 8 : 2 * 56));
  const availH = Math.max(200, viewport.h - BAR_H - 32);
  const spreadW = PAGE_W * (double ? 2 : 1) + 2 * TAB_W;
  const scale = Math.min(availW / spreadW, availH / PAGE_H);

  // Onglets des intercalaires : à gauche s'ils sont déjà passés, à droite sinon
  const firstShown = leftIdx ?? rightIdx ?? 0;
  const rightShown = rightIdx ?? leftIdx ?? 0;
  const tabs = SECTION_ORDER.map((section, rank) => {
    const at = dividerIndex(pages, section);
    // Déjà tourné : avant la page de droite (ou c'est la page de gauche)
    const side: 'left' | 'right' = at < (rightIdx ?? firstShown + 1) ? 'left' : 'right';
    return { section, rank, at, side };
  }).filter((t) => t.at >= 0);
  const current = sectionAt(pages, rightShown);

  const toc = useMemo(() => binderToc(pages), [pages]);
  const visible = new Set([leftIdx, rightIdx].filter((i): i is number => i !== null));

  const pageNumber = (i: number | null) => (i === null ? '' : String(i + 1));
  const shownLabel = leftIdx !== null && rightIdx !== null ? `Pages ${pageNumber(leftIdx)}-${pageNumber(rightIdx)}` : `Page ${pageNumber(firstShown)}`;

  return (
    <div className="bd-root">
      <header className="bd-bar">
        <button type="button" className="bd-btn" onClick={() => void navigate('/cours')} title="Retour à Mes cours">
          <ArrowLeft size={18} aria-hidden /> <span className="bd-hide-sm">Mes cours</span>
        </button>
        <button type="button" className="bd-btn" aria-pressed={tocOpen} onClick={() => setTocOpen((o) => !o)} title="Sommaire">
          <List size={18} aria-hidden />
        </button>
        <h1 className="bd-title"><BookOpen size={18} aria-hidden /> Classeur de SVT</h1>
        {levels.length > 1 ? (
          <select
            className="bd-select"
            value={level ?? ''}
            aria-label="Niveau"
            onChange={(e) => { const q = new URLSearchParams(); q.set('niveau', e.target.value); setParams(q, { replace: true }); }}
          >
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        ) : level && <span className="bd-level">{level}</span>}
        <span className="bd-spacer" />
        {count > 0 && <span className="bd-count">{shownLabel} sur {count}</span>}
        <button
          type="button"
          className="bd-btn"
          onClick={() => setDoubleChoice(!double)}
          title={double ? 'Afficher une page à la fois' : 'Afficher le classeur ouvert (double page)'}
        >
          {double ? <RectangleVertical size={18} aria-hidden /> : <Columns2 size={18} aria-hidden />}
        </button>
      </header>

      <div className="bd-body">
        {tocOpen && (
          <nav className={`bd-toc ${viewport.w < 900 ? 'bd-toc--over' : ''}`} aria-label="Sommaire du classeur" style={viewport.w >= 900 ? { width: tocW } : undefined}>
            <ul>
              {toc.map((e) => (
                <li key={`${e.index}:${e.label}`}>
                  <button
                    type="button"
                    className={`bd-toc__item bd-toc__item--d${e.depth}`}
                    aria-current={visible.has(e.index) && e.depth === 2 ? 'page' : undefined}
                    onClick={() => { go(e.index); if (viewport.w < 900) setTocOpen(false); }}
                  >
                    {e.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main
          className="bd-stage"
          onTouchStart={(e) => { swipeX.current = e.touches.length === 1 ? e.touches[0].clientX : null; }}
          onTouchEnd={(e) => {
            const start = swipeX.current;
            swipeX.current = null;
            if (start === null || count === 0) return;
            const dx = e.changedTouches[0].clientX - start;
            if (Math.abs(dx) > 60) go(turn(index, count, double, dx < 0 ? 1 : -1));
          }}
        >
          {error && <p className="bd-message" role="alert">{error}</p>}
          {!error && (!boards || (basePages.length > 0 && !inkReady)) && <p className="bd-message">Ouverture du classeur…</p>}
          {!error && boards && !level && (
            <p className="bd-message">
              Pas encore de classeur : il se construit à partir des pages de garde des séquences (« Page de garde — Séquence 1 »
              dans « Mes cours », rangée sous son niveau et sa séquence).
            </p>
          )}
          {count > 0 && inkReady && (
            <>
              <button type="button" className="bd-arrow bd-arrow--prev" onClick={() => go(turn(index, count, double, -1))} disabled={firstShown === 0} aria-label="Page précédente">
                <ChevronLeft size={28} aria-hidden />
              </button>
              <div className="bd-spread-outer" style={{ width: spreadW * scale, height: PAGE_H * scale }}>
                <div
                  className={`bd-spread ${double ? 'bd-spread--double' : ''}`}
                  style={{ width: spreadW, height: PAGE_H, transform: `scale(${scale})` }}
                >
                  {tabs.map((t) => (
                    <button
                      key={t.section}
                      type="button"
                      className={`bd-tab bd-tab--${t.section} bd-tab--${t.side} ${current === t.section ? 'is-current' : ''}`}
                      style={{
                        top: 90 + t.rank * 230,
                        ...(t.side === 'left' ? { left: 0 } : { left: TAB_W + PAGE_W * (double ? 2 : 1) - 6 }),
                      }}
                      onClick={() => go(t.at)}
                      title={`Aller à l’intercalaire « ${SECTION_LABEL[t.section as BinderSection]} »`}
                    >
                      <span>{SECTION_LABEL[t.section]}</span>
                    </button>
                  ))}
                  {double && (
                    <div className="bd-slot bd-slot--left" style={{ left: TAB_W, width: PAGE_W, height: PAGE_H }}>
                      {leftIdx !== null
                        ? <BinderLeaf key={pages[leftIdx].key} page={pages[leftIdx]} side="left" onOpen={openCourse} />
                        : <div className="bd-cover-inside" />}
                    </div>
                  )}
                  <div className="bd-slot bd-slot--right" style={{ left: TAB_W + (double ? PAGE_W : 0), width: PAGE_W, height: PAGE_H }}>
                    {rightIdx !== null
                      ? <BinderLeaf key={pages[rightIdx].key} page={pages[rightIdx]} side="right" onOpen={openCourse} />
                      : <div className="bd-cover-inside" />}
                  </div>
                  {double && (
                    <div className="bd-rings" style={{ left: TAB_W + PAGE_W }} aria-hidden>
                      {HOLES_MM.map((y) => <span key={y} className="bd-ring" style={{ top: y * MM }} />)}
                    </div>
                  )}
                  {turning && (
                    // Une feuille vierge passe par-dessus : les vraies pages ne bougent pas (leur mise en page se mesure à l'écran)
                    <div
                      key={turning.id}
                      className={`bd-turn bd-turn--${turning.dir > 0 ? 'next' : 'prev'}`}
                      style={{ left: TAB_W + (double ? PAGE_W : 0), width: PAGE_W, height: PAGE_H }}
                      onAnimationEnd={() => setTurning(null)}
                      aria-hidden
                    />
                  )}
                </div>
              </div>
              <button type="button" className="bd-arrow bd-arrow--next" onClick={() => go(turn(index, count, double, 1))} disabled={(rightIdx ?? firstShown) >= count - 1} aria-label="Page suivante">
                <ChevronRight size={28} aria-hidden />
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
