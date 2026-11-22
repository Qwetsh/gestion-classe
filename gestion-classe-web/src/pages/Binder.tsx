/**
 * Classeur virtuel (PLAN_classeur_virtuel.md, lot 1) : page `/classeur?niveau=4e&page=3`.
 *
 * Le classeur d'un élève « parfait », assemblé à la volée depuis la bibliothèque de « Mes cours »
 * (lib/binder.ts) : modifier une fiche dans « Mes cours » modifie le classeur. Le classeur lui-même
 * (pages, sommaire, feuille qui tourne) est dans components/binder/BinderBook.tsx.
 *
 * Réglage par classe (PLAN_classeur_eleves.md, lot 1) : `&classe=<id>` montre le même classeur avec,
 * sur chaque page, ce que cette classe en voit (fermé par défaut) et de quoi l'ouvrir ; « Aperçu
 * élève » ne garde que ce qui est ouvert. Lot 2 : « Lien pour Pronote » donne l'adresse où la classe
 * retrouve son classeur, sans compte.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { listBoards, type Board } from '../lib/boardsQueries';
import { courseHref } from '../lib/courseLibrary';
import { binderLevels, binderScreenSources, binderSummarySources, buildBinder, type BinderPage } from '../lib/binder';
import { INK_PX, INK_WIDTH_MM, SUMMARY_LEAD, mergeSummaries, summaryRuns, withSummaries, wrapInk, type SummaryRuns } from '../lib/binderSummary';
import { loadScreenSummaries } from '../lib/binderScreens';
import {
  binderItems, hasCorrection, itemStates, pageAccess, pagesFromReleased, rowEntries, rowFor, sequenceAnchors, staleRows, stateOf,
  type BinderItem, type BinderItemRow, type ItemState,
} from '../lib/binderRelease';
import { binderReleaseUnavailable, deleteBinderItems, fetchBinderClasses, fetchBinderItems, saveBinderItems, type BinderClass } from '../lib/binderReleaseQueries';
import { MM } from '../lib/course/coursePage';
import { BinderBook } from '../components/binder/BinderBook';
import { BinderLinkButton } from '../components/binder/BinderLinkButton';
import { loadSheetDoc } from '../components/binder/binderSheet';

/** Hauteur du bandeau affiché sous la barre quand une classe est choisie. */
const NOTICE_H = 44;

/** Remplace, par cours d'ancrage, les lignes de `rows` par celles de `next`. */
function mergeRows(rows: BinderItemRow[], next: BinderItemRow[]): BinderItemRow[] {
  const anchors = new Set(next.map((r) => r.anchor_board_id));
  return [...rows.filter((r) => !anchors.has(r.anchor_board_id)), ...next];
}

function Switch({ checked, disabled, title, onChange, children }: { checked: boolean; disabled?: boolean; title?: string; onChange: (next: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="bd-switch" disabled={disabled} title={title} onClick={() => onChange(!checked)}>
      <span className="bd-switch__track" aria-hidden />
      <span>{children}</span>
    </button>
  );
}

export function Binder() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Les bilans (écran « Bilan » de chaque activité, à défaut feuille de bilans corrigée) et la police
  // d'écriture : lus avant d'ouvrir le classeur, pour que les pages ne changent plus de numéro ensuite
  const [inkReady, setInkReady] = useState<{ texts: Map<string, SummaryRuns>; measure: (text: string) => number; failed: boolean } | null>(null);
  useEffect(() => {
    if (basePages.length === 0) return;
    let cancelled = false;
    // L'écran Bilan prime ; la feuille de bilans corrigée (plus une page) sert aux activités sans écran
    const sources = boards && level ? binderSummarySources(boards, level) : [];
    const screenSources = boards && level ? binderScreenSources(boards, level) : [];
    const font = `${INK_PX}px "Playwrite FR Moderne"`;
    // Une lecture ratée n'est pas « pas de bilan » : on le retient, pour ne rien proposer de faux
    let failed = false;
    const lost = <T,>(fallback: T) => () => { failed = true; return fallback; };
    Promise.all([
      Promise.all(sources.map(({ chapter, board }) => loadSheetDoc(board).then((d) => [chapter, d ? summaryRuns(d.content) : new Map()] as const, lost([chapter, new Map()] as const)))),
      loadScreenSummaries(screenSources).catch(lost(new Map<string, SummaryRuns>())),
      document.fonts.load(font).catch(() => []),
    ]).then(([lists, screens]) => {
      if (cancelled) return;
      const sheets = new Map<string, SummaryRuns>(lists);
      const texts = new Map<string, SummaryRuns>();
      for (const chapter of new Set([...sheets.keys(), ...screens.keys()])) {
        texts.set(chapter, mergeSummaries(screens.get(chapter) ?? new Map(), sheets.get(chapter)));
      }
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) ctx.font = font;
      setInkReady({ texts, failed, measure: (text) => (ctx ? ctx.measureText(text).width : text.length * INK_PX * 0.6) });
    });
    return () => { cancelled = true; };
  }, [basePages, boards, level]);

  // ---- Réglage par classe : ce que chaque classe du niveau voit du classeur ----
  const [classes, setClasses] = useState<BinderClass[]>([]);
  useEffect(() => {
    if (!userId || !level) return;
    let cancelled = false;
    fetchBinderClasses(userId, level).then((list) => { if (!cancelled) setClasses(list); }, () => { if (!cancelled) setClasses([]); });
    return () => { cancelled = true; };
  }, [userId, level]);
  const selectedClass = classes.find((c) => c.id === params.get('classe')) ?? null;
  const classId = selectedClass?.id ?? null;
  /** Réglages lus pour une classe ; ils ne valent que pour elle. */
  const [loaded, setLoaded] = useState<{ classId: string; rows: BinderItemRow[] } | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  /** Écritures en cours (plusieurs interrupteurs peuvent être touchés à la suite). */
  const [pending, setPending] = useState(0);
  const saving = pending > 0;
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    fetchBinderItems(classId).then(
      (list) => { if (!cancelled) { setLoaded({ classId, rows: list }); setReleaseError(null); } },
      (err: unknown) => { if (!cancelled) setReleaseError(err instanceof Error ? err.message : 'Réglages de la classe illisibles'); },
    );
    return () => { cancelled = true; };
  }, [classId]);
  const rows = classId && loaded?.classId === classId ? loaded.rows : null;
  /** Migration 085 pas encore appliquée : le classeur reste celui du professeur seul. */
  const unavailable = !!classId && rows !== null && binderReleaseUnavailable();
  /** Vue de réglage : le classeur complet, avec l'état de chaque page pour la classe. */
  const tuning = !!classId && rows !== null && !unavailable && !preview;
  /** Aperçu élève : seulement ce qui est ouvert à la classe. */
  const previewing = !!classId && rows !== null && !unavailable && preview;

  const items = useMemo(() => (inkReady ? binderItems(basePages, inkReady.texts) : []), [basePages, inkReady]);
  const itemByAnchor = useMemo(() => new Map(items.map((i) => [i.anchor, i])), [items]);
  const states = useMemo(() => itemStates(rows ?? []), [rows]);
  /** Les bilans n'ont pas tous pu être lus : les corrections ne se règlent pas, et rien n'est dit périmé. */
  const bilansLost = !!inkReady?.failed;
  const stale = useMemo(() => (rows && items.length > 0 && !bilansLost ? staleRows(items, rows) : []), [items, rows, bilansLost]);
  const boardById = useMemo(() => new Map((boards ?? []).map((b) => [b.id, b])), [boards]);

  const pages = useMemo(() => {
    if (!inkReady) return basePages;
    const width = INK_WIDTH_MM * MM * 0.97;
    const wrap = (paragraphs: Parameters<typeof wrapInk>[0]) => wrapInk(paragraphs, width, inkReady.measure, SUMMARY_LEAD);
    if (previewing && rows) {
      // Ce que la classe voit : ses lignes ouvertes, suivies par identifiant comme le fera le serveur
      // (un cours renommé depuis reste montré tant que la ligne n'a pas été mise à jour)
      const released = pagesFromReleased(rowEntries(rows), (id) => boardById.get(id));
      return withSummaries(released.pages, released.texts, wrap);
    }
    return withSummaries(basePages, inkReady.texts, wrap);
  }, [basePages, inkReady, previewing, rows, boardById]);

  /** Ouvre ou ferme des éléments pour la classe : montré tout de suite, relu en base si l'écriture échoue. */
  const applyStates = useCallback(async (changes: { item: BinderItem; state: ItemState }[]) => {
    if (!classId || changes.length === 0) return;
    const next = changes.map(({ item, state }) => rowFor(item, classId, state));
    setLoaded((cur) => (cur?.classId === classId ? { classId, rows: mergeRows(cur.rows, next) } : cur));
    setPending((n) => n + 1);
    setReleaseError(null);
    try {
      const saved = await saveBinderItems(userId, next);
      setLoaded((cur) => (cur?.classId === classId ? { classId, rows: mergeRows(cur.rows, saved) } : cur));
    } catch (err: unknown) {
      setReleaseError(err instanceof Error ? `Réglage non enregistré : ${err.message}` : 'Réglage non enregistré');
      // L'écran ne doit jamais montrer « ouvert » ce que la base n'a pas : on relit ce qu'elle dit
      const fresh = await fetchBinderItems(classId).catch(() => null);
      if (fresh) setLoaded((cur) => (cur?.classId === classId ? { classId, rows: fresh } : cur));
    } finally {
      setPending((n) => n - 1);
    }
  }, [classId, userId]);

  /** Récrit les lignes ouvertes qui ne disent plus ce que dit le classeur ; retire celles dont le cours en est sorti. */
  const refreshStale = useCallback(async () => {
    if (!classId) return;
    await applyStates(stale.flatMap((s) => (s.item ? [{ item: s.item, state: { visible: true, correction: s.row.correction_visible } }] : [])));
    const ids = stale.flatMap((s) => (!s.item && s.row.id ? [s.row.id] : []));
    if (ids.length === 0) return;
    try {
      await deleteBinderItems(ids);
      setLoaded((cur) => (cur?.classId === classId ? { classId, rows: cur.rows.filter((r) => !r.id || !ids.includes(r.id)) } : cur));
    } catch (err: unknown) {
      setReleaseError(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  }, [applyStates, classId, stale]);

  /** Choisit la classe réglée (null : le classeur complet du professeur). */
  const pickClass = useCallback((id: string | null) => {
    const q = new URLSearchParams(params);
    if (id) q.set('classe', id); else q.delete('classe');
    // Quitter l'aperçu change les pages : on repart de la première
    if (preview) q.set('page', '1');
    setPreview(false);
    setParams(q, { replace: true });
  }, [params, setParams, preview]);
  /** L'aperçu n'a pas les mêmes pages que le classeur complet : on repart de la première. */
  const togglePreview = useCallback(() => {
    const q = new URLSearchParams(params);
    q.set('page', '1');
    setPreview((p) => !p);
    setParams(q, { replace: true });
  }, [params, setParams]);

  const openCourse = useCallback((id: string) => { void navigate(courseHref(id)); }, [navigate]);

  /** Bandeau de réglage posé en haut d'une page : ce que la classe en voit, et de quoi l'ouvrir. */
  const strip = (page: BinderPage): ReactNode => {
    if (!selectedClass || page.kind === 'divider') return null;
    const access = pageAccess(page, states);
    const item = page.anchor ? itemByAnchor.get(page.anchor) : undefined;
    if (access === 'locked' || !item) {
      const why = page.kind === 'ruled' ? 'Bilan sans fiche : ne s’ouvre pas aux classes'
        : page.role === 'evaluation' || page.role === 'correction' || /^Évaluation/.test(page.label) ? 'Évaluation : ne s’ouvre pas encore aux classes'
        : 'Titre ambigu (correction, copie modèle ou évaluation ?) : ne s’ouvre pas aux classes';
      return <span className="bd-strip__note">{why}</span>;
    }
    const state = stateOf(states, item.anchor);
    if (page.kind === 'ruled') {
      return <span className="bd-strip__note">Suite du bilan de « {item.label} » : {state.correction ? 'ouverte avec la correction' : 'fermée avec la correction'}</span>;
    }
    if (page.board.id !== item.anchor) {
      return <span className="bd-strip__note">Suit « {item.label} » : {state.visible ? `visible pour la ${selectedClass.name}` : 'fermée'}</span>;
    }
    const closedInSequence = item.role === 'cover' && item.chapter
      ? sequenceAnchors(items, item.chapter).filter((a) => !stateOf(states, a).visible).flatMap((a) => itemByAnchor.get(a) ?? [])
      : [];
    return (
      <>
        <Switch checked={state.visible} disabled={saving} onChange={(visible) => void applyStates([{ item, state: { visible, correction: visible && state.correction } }])}>
          Visible pour la {selectedClass.name}
        </Switch>
        {item.role === 'activity' && (
          <Switch
            checked={state.correction}
            // Une correction déjà ouverte se referme toujours, même si l'activité n'en a plus
            disabled={saving || !state.visible || (!state.correction && (!hasCorrection(item) || bilansLost))}
            title={bilansLost && !state.correction ? 'Les bilans n’ont pas pu être lus : rechargez la page' : !hasCorrection(item) ? 'Ni copie modèle ni bilan pour cette activité' : !state.visible ? 'Ouvrir d’abord l’activité' : 'La copie modèle et le bilan de l’activité'}
            onChange={(correction) => void applyStates([{ item, state: { visible: true, correction } }])}
          >
            Correction
          </Switch>
        )}
        {closedInSequence.length > 0 && (
          <button
            type="button"
            className="bd-strip__btn"
            disabled={saving}
            title="La page de garde et les activités de la séquence. Ni les corrections, ni la fiche de mémorisation, ni l’évaluation."
            onClick={() => void applyStates(closedInSequence.map((it) => ({ item: it, state: { visible: true, correction: stateOf(states, it.anchor).correction } })))}
          >
            Ouvrir toute la séquence
          </button>
        )}
      </>
    );
  };

  const staleLine = (s: (typeof stale)[number]) => `${s.label} : ${s.reason === 'gone' ? 'retiré du classeur' : s.reason === 'correction' ? 'correction modifiée' : 'pages modifiées'}`;
  const notice = selectedClass && (
    <div className="bd-notice" role="status" style={{ minHeight: NOTICE_H }}>
      {releaseError && <span className="bd-notice__error">{releaseError}</span>}
      {rows === null ? (!releaseError && <span>Lecture des réglages de la {selectedClass.name}…</span>)
        : unavailable ? <span>Réglage par classe indisponible : la migration 085 n’est pas encore appliquée.</span>
        : (
          <>
            {!releaseError && stale.length === 0 && (
              <span>{previewing ? `Aperçu : ce que voit la ${selectedClass.name}.` : `Réglage de la ${selectedClass.name} : une page voilée est fermée pour cette classe.`}</span>
            )}
            {bilansLost && <span className="bd-notice__error">Les bilans n’ont pas tous pu être lus : les corrections ne se règlent pas pour l’instant. Rechargez la page.</span>}
            {stale.length > 0 && (
              <>
                <span title={stale.map(staleLine).join('\n')}>
                  {previewing ? 'Aperçu. ' : ''}
                  {stale.length === 1 ? '1 élément ouvert ne correspond plus' : `${stale.length} éléments ouverts ne correspondent plus`} au classeur
                  {' '}({stale.slice(0, 3).map(staleLine).join(' ; ')}{stale.length > 3 ? '…' : ''}).
                  {' '}La {selectedClass.name} garde l’ancienne version tant que vous n’avez pas validé.
                </span>
                <button type="button" className="bd-strip__btn" disabled={saving} onClick={() => void refreshStale()}>Mettre à jour</button>
              </>
            )}
          </>
        )}
      {saving && <span className="bd-notice__saving">Enregistrement…</span>}
    </div>
  );

  const message = error ? null
    : !boards || (basePages.length > 0 && !inkReady) ? 'Ouverture du classeur…'
    : !level ? 'Pas encore de classeur : il se construit à partir des pages de garde des séquences (« Page de garde — Séquence 1 » dans « Mes cours », rangée sous son niveau et sa séquence).'
    : null;

  return (
    <BinderBook
      pages={pages}
      ready={!!inkReady}
      error={error}
      message={message}
      keepParams={level ? { niveau: level } : undefined}
      student={previewing}
      onOpen={previewing ? undefined : openCourse}
      veiled={tuning ? (page) => pageAccess(page, states) !== 'open' : undefined}
      // Le bilan écrit sur une feuille suit la correction : estompé tant qu'elle est fermée
      inkClosed={tuning ? (page) => page.kind === 'sheet' && !stateOf(states, page.anchor).correction : undefined}
      strip={tuning ? strip : undefined}
      notice={notice}
      noticeH={selectedClass ? NOTICE_H : 0}
      barStart={(
        <button type="button" className="bd-btn" onClick={() => void navigate('/cours')} title="Retour à Mes cours">
          <ArrowLeft size={18} aria-hidden /> <span className="bd-hide-sm">Mes cours</span>
        </button>
      )}
      barEnd={(
        <>
          {levels.length > 1 ? (
            <select
              className="bd-select"
              value={level ?? ''}
              aria-label="Niveau"
              onChange={(e) => { const q = new URLSearchParams(); q.set('niveau', e.target.value); setPreview(false); setParams(q, { replace: true }); }}
            >
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          ) : level && <span className="bd-level">{level}</span>}
          {classes.length > 0 && (
            <select
              className="bd-select"
              value={classId ?? ''}
              aria-label="Classe réglée"
              title="Choisir une classe pour régler ce qu’elle voit du classeur"
              onChange={(e) => pickClass(e.target.value || null)}
            >
              <option value="">Mon classeur (tout)</option>
              {classes.map((c) => <option key={c.id} value={c.id}>Réglage : {c.name}</option>)}
            </select>
          )}
          {(tuning || previewing) && (
            <button type="button" className="bd-btn" aria-pressed={previewing} onClick={togglePreview} title="Ne montrer que ce que la classe voit">
              <Eye size={18} aria-hidden /> <span className="bd-hide-sm">Aperçu élève</span>
            </button>
          )}
          {(tuning || previewing) && selectedClass && <BinderLinkButton userId={userId} classId={selectedClass.id} className={selectedClass.name} />}
        </>
      )}
    />
  );
}
