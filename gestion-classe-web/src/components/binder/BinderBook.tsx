/**
 * Classeur virtuel : le classeur qui se feuillette, quelle que soit sa source (la bibliothèque du
 * professeur dans `/classeur`, ou ce qu'une classe a le droit de voir dans la page des élèves).
 *
 * Double page sur un grand écran (comme un classeur ouvert), page seule sur un écran étroit.
 * Flèches du clavier, onglets des intercalaires, sommaire, page qui se tourne. La page affichée est
 * dans l'adresse (`?page=3`).
 *
 * Lecture (PLAN_classeur_eleves.md, lot 2) : en page seule, la fiche peut être cadrée sur toute la
 * largeur de l'écran, sans ses marges. Sur un téléphone, la page entière est illisible (texte à
 * moins de 5 px) : la lecture y est le mode de départ, et on se déplace sur la page au doigt.
 * Limite connue : le bilan écrit sous une fiche est plus large que le texte de la fiche ; en
 * lecture, il faut le faire glisser pour le lire en entier (une feuille de bilan seule, elle, est
 * cadrée sur ses lignes).
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Columns2, List, RectangleVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { SECTION_LABEL, SECTION_ORDER, binderToc, dividerIndex, sectionAt, spreadOf, turn, type BinderPage, type BinderSection } from '../../lib/binder';
import { turnDirection } from '../../lib/binderFlaps';
import { planFlip } from '../../lib/binderFlip';
import { bilanPrintPages, printPages } from '../../lib/binderPrint';
import { INK_WIDTH_MM, summaryAt } from '../../lib/binderSummary';
import { COL_W, MARGIN, MM, PAGE_H, PAGE_W } from '../../lib/course/coursePage';
import { BinderLeaf, GLUE_FROM_HOLES } from './BinderLeaf';
import { PageFlip, type FlipView } from './PageFlip';
import { A5_SCALE, HOLES_MM } from './binderSheet';
import { BinderSourceContext } from './binderSource';
// Polices des cours (chargées d'habitude avec l'éditeur) : une fiche peut s'en servir
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '@fontsource/playwrite-fr-moderne/400.css';
import '../../styles/classeur.css';
import '../../styles/classeur-eleves.css';

/** Largeur d'écran à partir de laquelle le classeur s'ouvre en double page. */
const DOUBLE_MIN_W = 1000;
/** Place des onglets qui dépassent de chaque côté, en px de feuille. */
const TAB_W = 70;
/** Hauteur de la barre du haut. */
const BAR_H = 56;
/** Lecture : marge laissée de chaque côté du texte de la fiche, en px d'écran, et agrandissement maximal. */
const READ_PAD = 10;
const READ_MAX = 1.5;
/** Échelle de la page entière sous laquelle la lecture est le mode de départ (texte d'une fiche sous 7 px). */
const READ_BELOW = 0.6;

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

interface Props {
  pages: BinderPage[];
  /** Les pages sont prêtes à être montrées (bilans lus, police d'écriture chargée). */
  ready: boolean;
  /** Message à la place du classeur (lecture en cours, erreur, classeur vide). */
  message?: ReactNode;
  /** Message d'erreur, à la place de tout. */
  error?: string | null;
  /** Début de la barre (bouton de retour) et suite du titre (niveau, classe, réglages). */
  barStart?: ReactNode;
  barEnd?: ReactNode;
  /** Bandeau sous la barre, et sa hauteur. */
  notice?: ReactNode;
  noticeH?: number;
  /** Paramètres d'adresse à garder à chaque changement de page. */
  keepParams?: Record<string, string>;
  /** Vue de l'élève : pas de lien vers l'espace du professeur, page de garde non cochée. */
  student?: boolean;
  /**
   * Classeur ouvert par-dessus une autre page (espace élève) : il ne touche pas à l'adresse (la page
   * affichée reste dans son état à lui) et passe au-dessus de tout.
   */
  embedded?: boolean;
  /** Double-clic sur une fiche. */
  onOpen?: (boardId: string) => void;
  /** Réglage d'une classe : la page est fermée pour elle (voilée, grisée au sommaire). */
  veiled?: (page: BinderPage) => boolean;
  /** Réglage d'une classe : le bilan écrit sur la page est estompé. */
  inkClosed?: (page: BinderPage) => boolean;
  /** Réglage d'une classe : bandeau posé en haut de la page. */
  strip?: (page: BinderPage) => ReactNode;
}

export function BinderBook({ pages, ready, message, error, barStart, barEnd, notice, noticeH = 0, keepParams, student, embedded, onOpen, veiled, inkClosed, strip }: Props) {
  /** Page affichée d'un classeur embarqué (1 = la première). */
  const [localPage, setLocalPage] = useState(1);
  const { loadDoc } = useContext(BinderSourceContext);
  const [params, setParams] = useSearchParams();
  const viewport = useViewport();
  const [tocOpen, setTocOpen] = useState(() => window.innerWidth >= 1280);
  /** Choix de l'utilisateur ; null = selon la largeur de l'écran. */
  const [doubleChoice, setDoubleChoice] = useState<boolean | null>(null);
  const [readChoice, setReadChoice] = useState<boolean | null>(null);
  /** Feuille en train de se tourner, avec le contenu de ses deux faces. */
  const [flipState, setFlip] = useState<{ view: FlipView; pages: BinderPage[] } | null>(null);
  /** La feuille tourne pour un classeur donné : si ses pages changent (aperçu, réglage), elle s'efface. */
  const flip = flipState && flipState.pages === pages ? flipState.view : null;
  const spreadRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Début d'un glissement du doigt (tourner les pages sur téléphone). */
  const swipeX = useRef<number | null>(null);

  const count = pages.length;
  const index = Math.max(0, Math.min(count - 1, (embedded ? localPage : Number(params.get('page')) || 1) - 1));

  const tocW = tocOpen && viewport.w >= 900 ? 260 : 0;
  const narrow = viewport.w < 640;
  const double = doubleChoice ?? viewport.w - tocW >= DOUBLE_MIN_W;
  // Mise à l'échelle : la vue entière tient dans l'écran ; en lecture, le texte prend la largeur
  const stageW = viewport.w - tocW;
  // Sur téléphone, les flèches sont posées sur la page (et le doigt tourne les pages)
  const availW = Math.max(200, stageW - (narrow ? 8 : 2 * 56));
  const availH = Math.max(200, viewport.h - BAR_H - noticeH - 32);
  const spreadW = PAGE_W * (double ? 2 : 1) + 2 * TAB_W;
  const fitScale = Math.min(availW / spreadW, availH / PAGE_H);
  /**
   * Lecture demandée : la fiche cadrée sur la largeur de l'écran (page seule seulement). C'est le
   * mode de départ quand la page entière serait illisible (téléphone, debout ou couché), sauf en
   * réglage : les bandeaux se lisent sur la page entière.
   */
  const readWanted = !double && (readChoice ?? (fitScale < READ_BELOW && !strip));
  const shownPage: BinderPage | undefined = pages[index];
  /** Un intercalaire n'a rien à lire : il reste montré en entier. */
  const read = readWanted && !!shownPage && shownPage.kind !== 'divider';
  /** Ce qu'on lit sur la page (début et largeur, en px de feuille) : le texte de la fiche collée, ou les lignes d'une feuille de bilan. */
  const readX = shownPage?.kind === 'ruled' ? 30 * MM : GLUE_FROM_HOLES + MARGIN * A5_SCALE;
  const readW = shownPage?.kind === 'ruled' ? INK_WIDTH_MM * MM : COL_W * A5_SCALE;
  const readScale = Math.max(fitScale, Math.min(READ_MAX, (stageW - 2 * READ_PAD) / readW));
  const scale = read ? readScale : fitScale;
  const [leftIdx, rightIdx] = spreadOf(index, count, double);

  /** Copie figée d'une page affichée ou voisine (déjà mise en page), avant qu'elle ne change de place. */
  const ghost = useCallback((i: number | null): HTMLElement | null => {
    const key = i === null ? undefined : pages[i]?.key;
    const el = key === undefined ? null : spreadRef.current?.querySelector<HTMLElement>(`[data-leaf-key="${CSS.escape(key)}"]`);
    if (!el) return null;
    const copy = el.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-leaf-key');
    return copy;
  }, [pages]);

  /** `turnPage` : tourner la feuille (flèches, clavier, doigt) ; sinon, simple changement de vue (sommaire, onglet). */
  const go = useCallback((next: number, turnPage = false) => {
    const q = new URLSearchParams(params);
    for (const [k, v] of Object.entries(keepParams ?? {})) q.set(k, v);
    const target = Math.max(0, Math.min(count - 1, next));
    q.set('page', String(target + 1));
    const dir = turnDirection(index, target);
    // En lecture la page est agrandie et déplacée : pas de feuille qui tourne
    const plan = turnPage && !read && dir !== 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? planFlip(spreadOf(index, count, double), spreadOf(target, count, double), dir, double, index, target)
      : null;
    // Les copies sont prises avant le changement de vue : après, les pages ont changé de place
    if (plan) {
      setFlip({
        pages,
        view: {
          id: Date.now(),
          kind: plan.kind,
          front: ghost(plan.front),
          back: plan.back === null ? null : ghost(plan.back),
          under: plan.under && { side: plan.under.side, node: ghost(plan.under.page) },
        },
      });
    } else setFlip(null);
    // Embarqué, l'adresse appartient à la page qui porte le classeur (elle peut avoir été nettoyée
    // d'un code d'élève) : on n'y écrit rien
    if (embedded) setLocalPage(target + 1);
    else setParams(q, { replace: true });
  }, [params, setParams, keepParams, count, index, double, read, ghost, pages, embedded]);

  // Clavier : flèches, Page précédente / suivante, Début / Fin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(turn(index, count, double, 1), true); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(turn(index, count, double, -1), true); }
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
        if (p?.kind === 'sheet') loadDoc(p.board).catch(() => { /* relu à l'affichage */ });
      }
    }
  }, [index, count, double, pages, loadDoc]);

  // Lecture : à chaque page, on repart du haut, le texte calé à gauche de l'écran
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !read) return;
    el.scrollLeft = Math.max(0, (TAB_W + readX) * scale - READ_PAD);
    el.scrollTop = 0;
  }, [read, index, scale, readX]);

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

  /** Abscisse d'une page dans la vue, en px de feuille. */
  const slotX = (side: 'left' | 'right') => TAB_W + (double && side === 'right' ? PAGE_W : 0);
  /** Côté d'une page : en double page, les pages impaires sont à gauche (la première est seule, à droite). */
  const sideOf = (i: number): 'left' | 'right' => (double && i % 2 === 1 ? 'left' : 'right');

  // Les pages voisines sont montées un instant après la vue (cachées) : mises en page d'avance, elles
  // servent de verso à la feuille qu'on tourne et apparaissent sans attendre quand on arrive
  const spreadKey = `${leftIdx}:${rightIdx}:${double}`;
  const [warmFor, setWarmFor] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setWarmFor(spreadKey), 450);
    return () => window.clearTimeout(timer);
  }, [spreadKey]);
  const shown = [leftIdx, rightIdx].filter((i): i is number => i !== null);
  const reach = warmFor === spreadKey ? (double ? 2 : 1) : 0;
  const aliveFrom = shown.length ? Math.max(0, Math.min(...shown) - reach) : 0;
  const aliveTo = shown.length ? Math.min(count - 1, Math.max(...shown) + reach) : -1;
  const alive = Array.from({ length: aliveTo - aliveFrom + 1 }, (_, k) => aliveFrom + k);

  /** Imprime le bilan écrit sur la page `i`, en entier : il peut continuer sur les pages suivantes. */
  const printBilan = (i: number) => {
    const bilan = summaryAt(pages, i);
    if (bilan) printPages(bilanPrintPages(bilan.title, bilan.lines), `Bilan — ${bilan.title}`);
  };

  const toc = useMemo(() => binderToc(pages), [pages]);
  const visible = new Set([leftIdx, rightIdx].filter((i): i is number => i !== null));

  const pageNumber = (i: number | null) => (i === null ? '' : String(i + 1));
  const shownLabel = leftIdx !== null && rightIdx !== null ? `Pages ${pageNumber(leftIdx)}-${pageNumber(rightIdx)}` : `Page ${pageNumber(firstShown)}`;
  /** Entrée du sommaire qui est la page elle-même (pas le nom de sa séquence) et qui est fermée pour la classe. */
  const tocClosed = (i: number, label: string) => {
    const p = pages[i];
    return !!veiled && p.kind !== 'divider' && p.label === label && veiled(p);
  };

  return (
    <div className={embedded ? 'bd-root bd-root--over' : 'bd-root'}>
      <header className="bd-bar">
        {barStart}
        <button type="button" className="bd-btn" aria-pressed={tocOpen} onClick={() => setTocOpen((o) => !o)} title="Sommaire">
          <List size={18} aria-hidden />
        </button>
        <h1 className="bd-title"><BookOpen size={18} aria-hidden /> <span className={barEnd ? 'bd-hide-sm' : undefined}>Classeur de SVT</span></h1>
        {barEnd}
        <span className="bd-spacer" />
        {count > 0 && <span className="bd-count">{shownLabel} sur {count}</span>}
        {!double && count > 0 && (
          <button type="button" className="bd-btn" aria-pressed={readWanted} onClick={() => setReadChoice(!readWanted)} title={readWanted ? 'Voir la page entière' : 'Agrandir la fiche pour la lire'}>
            {readWanted ? <ZoomOut size={18} aria-hidden /> : <ZoomIn size={18} aria-hidden />}
          </button>
        )}
        {!narrow && (
          <button
            type="button"
            className="bd-btn"
            onClick={() => { setDoubleChoice(!double); setFlip(null); }}
            title={double ? 'Afficher une page à la fois' : 'Afficher le classeur ouvert (double page)'}
          >
            {double ? <RectangleVertical size={18} aria-hidden /> : <Columns2 size={18} aria-hidden />}
          </button>
        )}
      </header>

      {notice}

      <div className="bd-body">
        {tocOpen && (
          <nav className={`bd-toc ${viewport.w < 900 ? 'bd-toc--over' : ''}`} aria-label="Sommaire du classeur" style={viewport.w >= 900 ? { width: tocW } : undefined}>
            <ul>
              {toc.map((e) => (
                <li key={`${e.index}:${e.label}`}>
                  <button
                    type="button"
                    className={`bd-toc__item bd-toc__item--d${e.depth} ${tocClosed(e.index, e.label) ? 'is-closed' : ''}`}
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
          className={`bd-stage ${read ? 'bd-stage--read' : ''}`}
          // Le doigt tourne les pages, partout sur le bureau ; en lecture il déplace la page
          onTouchStart={(e) => { swipeX.current = !read && e.touches.length === 1 ? e.touches[0].clientX : null; }}
          onTouchEnd={(e) => {
            const start = swipeX.current;
            swipeX.current = null;
            if (start === null || count === 0) return;
            const dx = e.changedTouches[0].clientX - start;
            if (Math.abs(dx) > 60) go(turn(index, count, double, dx < 0 ? 1 : -1), true);
          }}
        >
          {error && <p className="bd-message" role="alert">{error}</p>}
          {!error && message && <p className="bd-message">{message}</p>}
          {!error && count > 0 && ready && (
            <>
              <button type="button" className="bd-arrow bd-arrow--prev" onClick={() => go(turn(index, count, double, -1), true)} disabled={firstShown === 0} aria-label="Page précédente">
                <ChevronLeft size={28} aria-hidden />
              </button>
              <div ref={scrollerRef} className="bd-scroller">
                <div className="bd-spread-outer" style={{ width: spreadW * scale, height: PAGE_H * scale }}>
                  <div
                    ref={spreadRef}
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
                    {/* Intérieur de la couverture, là où il n'y a pas de page */}
                    {double && leftIdx === null && <div className="bd-slot bd-slot--left" style={{ left: slotX('left'), width: PAGE_W, height: PAGE_H }}><div className="bd-cover-inside" /></div>}
                    {rightIdx === null && <div className="bd-slot bd-slot--right" style={{ left: slotX('right'), width: PAGE_W, height: PAGE_H }}><div className="bd-cover-inside" /></div>}
                    {/* Les pages visibles, et leurs voisines déjà montées (cachées) : elles sont mises en page avant d'être tournées */}
                    {alive.map((i) => {
                      const side = sideOf(i);
                      const page = pages[i];
                      return (
                        <div
                          key={page.key}
                          className={`bd-slot bd-slot--${side} ${veiled?.(page) ? 'bd-slot--veiled' : ''}`}
                          style={{ left: slotX(side), width: PAGE_W, height: PAGE_H, visibility: i === leftIdx || i === rightIdx ? 'visible' : 'hidden' }}
                        >
                          <BinderLeaf page={page} side={side} onOpen={onOpen} inkClosed={inkClosed?.(page)} student={student} onPrintBilan={() => printBilan(i)} />
                        </div>
                      );
                    })}
                    {double && (
                      <div className="bd-rings" style={{ left: TAB_W + PAGE_W }} aria-hidden>
                        {HOLES_MM.map((y) => <span key={y} className="bd-ring" style={{ top: y * MM }} />)}
                      </div>
                    )}
                    {flip && <PageFlip key={flip.id} flip={flip} slotX={slotX} onDone={() => setFlip(null)} />}
                  </div>
                  {/* Bandeaux de réglage : hors de la vue réduite, pour rester lisibles */}
                  {strip && [leftIdx, rightIdx].map((i) => {
                    const content = i === null ? null : strip(pages[i]);
                    if (i === null || !content) return null;
                    return (
                      <div key={pages[i].key} className="bd-strip" style={{ left: slotX(sideOf(i)) * scale, width: PAGE_W * scale }}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button type="button" className="bd-arrow bd-arrow--next" onClick={() => go(turn(index, count, double, 1), true)} disabled={(rightIdx ?? firstShown) >= count - 1} aria-label="Page suivante">
                <ChevronRight size={28} aria-hidden />
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
