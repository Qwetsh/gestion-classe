/**
 * Classeur ouvert aux classes (PLAN_classeur_eleves.md, lot 4) : la grille de « Mes cours ». Une
 * ligne par activité (et par page seule), une colonne par classe du niveau ; dans chaque case,
 * « Activité » et « Correction ». C'est le second endroit où régler ce que chaque classe voit du
 * classeur : il écrit les mêmes lignes que la page `/classeur` (lib/binderRelease.ts), à partir du
 * même classeur (useBinderLibrary). Fermé par défaut. Les évaluations ne se règlent qu'ici, pour
 * tout le niveau à la fois (lot 5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import {
  bulkChanges, bulkState, bulkTargets, hasCorrection, itemStates, rowFor, staleRows, stateOf,
  type BinderItem, type BinderItemRow, type BulkKind, type BulkState, type ItemState,
} from '../../lib/binderRelease';
import { binderReleaseUnavailable, fetchBinderClasses, fetchBinderItemsOfClasses, saveBinderItems, type BinderClass } from '../../lib/binderReleaseQueries';
import { useBinderLibrary } from './useBinderLibrary';
import '../../styles/classeur-grille.css';

interface Group {
  key: string;
  title: string;
  /** Séquence du groupe : elle peut s'ouvrir d'un bloc. */
  chapter: string | null;
  items: BinderItem[];
}

/** Les éléments du classeur, rangés comme lui : mode d'emploi, séquences, fiches méthodes, « Je révise ». */
function groupItems(items: BinderItem[]): Group[] {
  const groups: Group[] = [];
  const push = (key: string, title: string, chapter: string | null, item: BinderItem) => {
    let group = groups.find((g) => g.key === key);
    if (!group) { group = { key, title, chapter, items: [] }; groups.push(group); }
    group.items.push(item);
  };
  for (const item of items) {
    if (item.role === 'guide') push('guide', 'Première page', null, item);
    else if (item.role === 'method') push('methods', 'Fiches méthodes', null, item);
    else if (item.role === 'memo') push('revise', 'Je révise', null, item);
    else push(`seq:${item.chapter ?? ''}`, item.chapter ?? 'Sans séquence', item.chapter, item);
  }
  return groups;
}

const rowTitle = (item: BinderItem): string => (
  item.role === 'activity' || item.role === 'evaluation' ? item.heading ?? item.label
    : item.role === 'memo' && item.chapter ? `${item.label} — ${item.chapter.split(' — ')[0]}`
    : item.label
);

/**
 * Évaluation (lot 5) : elle se règle pour toutes les classes du niveau à la fois, en deux temps (le
 * sujet, puis la correction), et chaque ouverture se confirme. Par classe, le sujet ouvert à la 4A
 * serait montré à la 4C avant qu'elle compose.
 */
function EvaluationCell({ item, level, classes, stateIn, stale, saving, onApply }: {
  item: BinderItem;
  level: string;
  classes: BinderClass[];
  stateIn: (classId: string) => ItemState;
  /** Des lignes ouvertes ne disent plus ce que dit le classeur (documents ajoutés, corrigé changé). */
  stale: boolean;
  saving: boolean;
  /** Nouvel état de chaque classe, ou null pour ne pas y toucher. Toutes les classes sont écrites d'un seul coup. */
  onApply: (next: (classId: string) => ItemState | null) => void;
}) {
  const [confirming, setConfirming] = useState<'subject' | 'correction' | null>(null);
  const open = classes.filter((c) => stateIn(c.id).visible);
  const corrected = classes.filter((c) => stateIn(c.id).correction);
  const allOpen = open.length === classes.length;
  const allCorrected = corrected.length === classes.length;
  const names = (list: BinderClass[]) => list.map((c) => c.name).join(', ');
  const said = (list: BinderClass[], closed: string, all: string, some: string) => (list.length === 0 ? closed : list.length === classes.length ? all : `${some} ${names(list)} seulement`);
  const apply = (next: (classId: string) => ItemState | null) => { setConfirming(null); onApply(next); };

  if (confirming) {
    const correction = confirming === 'correction';
    return (
      <div className="bg-eval">
        <span className="bg-eval__warn">
          {correction ? 'La correction' : 'Le sujet'} de cette évaluation sera visible par toutes les classes de {level} ({names(classes)}). À faire seulement quand toutes ont composé.
        </span>
        <button
          type="button"
          className="bg-all bg-all--go"
          disabled={saving}
          // Ouvrir le sujet ne touche pas à la correction d'une classe ; la correction ne s'ouvre que sujet ouvert partout
          onClick={() => apply((id) => (correction ? { visible: true, correction: true } : { visible: true, correction: stateIn(id).correction }))}
        >
          {correction ? 'Ouvrir la correction' : 'Ouvrir le sujet'}
        </button>
        <button type="button" className="bg-all" onClick={() => setConfirming(null)}>Annuler</button>
      </div>
    );
  }
  return (
    <div className="bg-eval">
      <span>Sujet : {said(open, 'fermé', `ouvert aux ${level}`, 'ouvert aux')}</span>
      {!allOpen && <button type="button" className="bg-all" disabled={saving} onClick={() => setConfirming('subject')}>Ouvrir aux {level}</button>}
      {/* Refermer ne fait que fermer : une classe où c'était fermé n'est pas touchée */}
      {open.length > 0 && <button type="button" className="bg-all" disabled={saving} onClick={() => apply((id) => (stateIn(id).visible ? { visible: false, correction: false } : null))}>Refermer</button>}
      {hasCorrection(item) && (
        <>
          <span className="bg-eval__sep">Correction : {said(corrected, 'fermée', `ouverte aux ${level}`, 'ouverte aux')}</span>
          {allOpen && !allCorrected && <button type="button" className="bg-all" disabled={saving} onClick={() => setConfirming('correction')}>Ouvrir aux {level}</button>}
          {corrected.length > 0 && <button type="button" className="bg-all" disabled={saving} onClick={() => apply((id) => (stateIn(id).correction ? { visible: true, correction: false } : null))}>Refermer</button>}
        </>
      )}
      {stale && open.length > 0 && (
        <button
          type="button"
          className="bg-all"
          disabled={saving}
          title="Le classeur a changé depuis l’ouverture (documents, corrigé). Récrit ce qui est ouvert, pour toutes les classes à la fois, sans rien ouvrir de plus."
          onClick={() => apply((id) => (stateIn(id).visible ? stateIn(id) : null))}
        >
          Mettre à jour
        </button>
      )}
    </div>
  );
}

/** Case « tout » d'un groupe : cochée si tout est ouvert, à moitié (tiret) si une partie l'est. Cliquer à moitié ouvre tout. */
function BulkCheck({ state, disabled, label, ariaLabel, title, onChange }: {
  state: BulkState;
  disabled: boolean;
  label: string;
  ariaLabel: string;
  title: string;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === 'some'; }, [state]);
  return (
    <label className="bg-check bg-check--bulk" title={title}>
      <input ref={ref} type="checkbox" checked={state === 'all'} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function mergeRows(rows: BinderItemRow[], next: BinderItemRow[]): BinderItemRow[] {
  const anchors = new Set(next.map((r) => r.anchor_board_id));
  return [...rows.filter((r) => !anchors.has(r.anchor_board_id)), ...next];
}

export function BinderGrid({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [wantedLevel, setWantedLevel] = useState<string | null>(null);
  const { boards, error, levels, level, items, texts, textsFailed } = useBinderLibrary(userId, wantedLevel);

  /** Classes du niveau et leurs réglages ; ils ne valent que pour ce niveau. */
  const [loaded, setLoaded] = useState<{ level: string; classes: BinderClass[]; rows: Map<string, BinderItemRow[]> } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const saving = pending > 0;

  useEffect(() => {
    if (!userId || !level) return;
    let cancelled = false;
    setLoadError(null);
    (async () => {
      const classes = await fetchBinderClasses(userId, level);
      const all = await fetchBinderItemsOfClasses(classes.map((c) => c.id));
      const rows = new Map<string, BinderItemRow[]>(classes.map((c) => [c.id, all.filter((r) => r.class_id === c.id)]));
      if (!cancelled) setLoaded({ level, classes, rows });
    })().catch((err: unknown) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Réglages illisibles'); });
    return () => { cancelled = true; };
  }, [userId, level]);

  const data = loaded && loaded.level === level ? loaded : null;
  const classes = useMemo(() => data?.classes ?? [], [data]);
  const groups = useMemo(() => groupItems(items), [items]);
  const statesOf = useMemo(() => new Map(classes.map((c) => [c.id, itemStates(data?.rows.get(c.id) ?? [])])), [classes, data]);
  /** Lignes ouvertes qui ne disent plus ce que dit le classeur, par classe : les cours d'ancrage concernés. */
  const staleOf = useMemo(
    () => new Map(classes.map((c) => [c.id, new Set(items.length > 0 && !textsFailed ? staleRows(items, data?.rows.get(c.id) ?? []).map((s) => s.row.anchor_board_id) : [])])),
    [classes, data, items, textsFailed],
  );

  /**
   * Ouvre ou ferme des éléments, pour une ou plusieurs classes : montré tout de suite, écrit en une
   * seule fois (une évaluation s'ouvre à toutes les classes ou à aucune), et défait si l'écriture
   * échoue : l'écran ne doit jamais montrer « ouvert » ou « fermé » ce que la base ne dit pas.
   */
  const apply = useCallback(async (changes: { classId: string; item: BinderItem; state: ItemState }[]) => {
    if (changes.length === 0) return;
    const next = changes.map(({ classId, item, state }) => rowFor(item, classId, state));
    const touched = [...new Set(next.map((r) => r.class_id))];
    // (seulement pour les classes encore à l'écran : le niveau a pu changer pendant l'écriture)
    const put = (rows: BinderItemRow[], merge: boolean) => setLoaded((cur) => {
      if (!cur) return cur;
      const map = new Map(cur.rows);
      for (const id of touched) {
        if (!map.has(id)) continue;
        const mine = rows.filter((r) => r.class_id === id);
        map.set(id, merge ? mergeRows(map.get(id) ?? [], mine) : mine);
      }
      return { ...cur, rows: map };
    });
    const before = touched.flatMap((id) => data?.rows.get(id) ?? []);
    put(next, true);
    setPending((n) => n + 1);
    setLoadError(null);
    try {
      put(await saveBinderItems(userId, next), true);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? `Réglage non enregistré : ${err.message}` : 'Réglage non enregistré');
      // On relit ce que dit la base ; si elle ne répond pas non plus, on revient à l'état d'avant
      const fresh = await fetchBinderItemsOfClasses(touched).catch(() => null);
      put(fresh ?? before, false);
    } finally {
      setPending((n) => n - 1);
    }
  }, [userId, data]);

  if (error) return <p className="mc-error" role="alert">{error}</p>;
  if (!boards) return <div className="mc-empty">Lecture du classeur…</div>;
  if (!level) {
    return (
      <div className="mc-empty">
        Pas encore de classeur : il se construit à partir des pages de garde des séquences (« Page de garde — Séquence 1 », rangée sous son niveau et sa séquence).
      </div>
    );
  }

  const unavailable = !!data && binderReleaseUnavailable();
  return (
    <div className="bg">
      <div className="bg-head">
        <p className="bg-intro">
          Ce que chaque classe voit du classeur. Tout est fermé au départ. « Correction » ouvre la copie modèle et le bilan de l’activité. Sur la ligne d’un groupe, « Tout » et « Corrections » règlent d’un coup tout le groupe pour la classe.
        </p>
        {levels.length > 1 && (
          <select className="bg-select" value={level} aria-label="Niveau" onChange={(e) => setWantedLevel(e.target.value)}>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <button type="button" className="btn" onClick={() => void navigate(`/classeur?niveau=${encodeURIComponent(level)}`)}>
          <BookOpen size={16} aria-hidden /> Classeur
        </button>
      </div>

      {loadError && <p className="mc-error" role="alert">{loadError}</p>}
      {textsFailed && <p className="mc-error" role="alert">Les bilans n’ont pas tous pu être lus : les corrections ne se règlent pas pour l’instant. Rechargez la page.</p>}
      {unavailable && <div className="mc-empty">Réglage par classe indisponible : la migration 085 n’est pas encore appliquée.</div>}
      {!unavailable && data && classes.length === 0 && <div className="mc-empty">Aucune classe de {level} : le niveau d’une classe est lu dans son nom (« 4A », « 4e B »).</div>}
      {!unavailable && (!data || !texts) && !loadError && <div className="mc-empty">Lecture des réglages…</div>}

      {!unavailable && data && texts && classes.length > 0 && (
        <div className="bg-scroll">
          <table className="bg-table">
            <thead>
              <tr>
                <th scope="col" className="bg-th-item">{saving ? 'Enregistrement…' : ''}</th>
                {classes.map((c) => (
                  <th key={c.id} scope="col">
                    <button type="button" className="bg-class" onClick={() => void navigate(`/classeur?niveau=${encodeURIComponent(level)}&classe=${c.id}`)} title={`Régler la ${c.name} dans le classeur`}>
                      {c.name}
                    </button>
                    {(staleOf.get(c.id)?.size ?? 0) > 0 && (
                      <span className="bg-stale" title="Des éléments ouverts ne correspondent plus au classeur : ouvrez le classeur de la classe pour les mettre à jour">
                        {staleOf.get(c.id)!.size} à mettre à jour
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.key}>
                <tr className="bg-group">
                  <th scope="rowgroup">{group.title}</th>
                  {classes.map((c) => {
                    const states = statesOf.get(c.id)!;
                    const toggle = (kind: BulkKind, on: boolean) => void apply(bulkChanges(group.items, states, kind, on).map(({ item, state }) => ({ classId: c.id, item, state })));
                    const correctionState = bulkState(group.items, states, 'corrections');
                    const anyCorrection = bulkTargets(group.items, 'corrections').length > 0
                      || group.items.some((i) => i.role === 'activity' && stateOf(states, i.anchor).correction);
                    return (
                      <td key={c.id}>
                        {bulkTargets(group.items, 'items').length > 1 && (
                          <BulkCheck
                            state={bulkState(group.items, states, 'items')}
                            disabled={saving}
                            label="Tout"
                            ariaLabel={`${group.title}, ${c.name} : tout`}
                            title={group.chapter
                              ? 'Ouvre ou ferme d’un coup la page de garde et les activités de la séquence. Pas l’évaluation, qui se règle pour tout le niveau. Fermer referme aussi les corrections.'
                              : 'Ouvre ou ferme d’un coup toutes les pages de ce groupe.'}
                            onChange={(on) => toggle('items', on)}
                          />
                        )}
                        {group.chapter && anyCorrection && (
                          <BulkCheck
                            state={correctionState}
                            // Ouvrir une correction demande les bilans ; refermer, jamais
                            disabled={saving || (textsFailed && correctionState === 'none')}
                            label="Corrections"
                            ariaLabel={`${group.title}, ${c.name} : toutes les corrections`}
                            title="Ouvre ou ferme d’un coup les corrections des activités de la séquence (copie modèle et bilan). Ouvrir une correction ouvre aussi son activité ; fermer les corrections laisse les activités ouvertes."
                            onChange={(on) => toggle('corrections', on && !textsFailed)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
                {group.items.map((item) => (item.role === 'evaluation' ? (
                  <tr key={item.anchor} className="bg-eval-row">
                    <th scope="row" className="bg-item">{rowTitle(item)}</th>
                    <td colSpan={classes.length}>
                      <EvaluationCell
                        item={item}
                        level={level}
                        classes={classes}
                        stateIn={(classId) => stateOf(statesOf.get(classId)!, item.anchor)}
                        stale={classes.some((c) => staleOf.get(c.id)?.has(item.anchor))}
                        saving={saving}
                        // Une seule écriture pour tout le niveau : ouverte à toutes les classes, ou à aucune
                        onApply={(next) => void apply(classes.flatMap((c) => { const state = next(c.id); return state ? [{ classId: c.id, item, state }] : []; }))}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.anchor}>
                    <th scope="row" className="bg-item">{rowTitle(item)}</th>
                    {classes.map((c) => {
                      const state = stateOf(statesOf.get(c.id)!, item.anchor);
                      const noCorrection = !hasCorrection(item);
                      return (
                        <td key={c.id}>
                          <label className="bg-check">
                            <input
                              type="checkbox"
                              checked={state.visible}
                              disabled={saving}
                              aria-label={`${rowTitle(item)}, ${c.name} : ${item.role === 'activity' ? 'activité' : 'visible'}`}
                              onChange={(e) => void apply([{ classId: c.id, item, state: { visible: e.target.checked, correction: e.target.checked && state.correction } }])}
                            />
                            {item.role === 'activity' ? 'Activité' : 'Visible'}
                          </label>
                          {item.role === 'activity' && (
                            <label className="bg-check" title={noCorrection ? 'Ni copie modèle ni bilan pour cette activité' : !state.visible ? 'Ouvrir d’abord l’activité' : 'La copie modèle et le bilan de l’activité'}>
                              <input
                                type="checkbox"
                                checked={state.correction}
                                aria-label={`${rowTitle(item)}, ${c.name} : correction`}
                                // Une correction déjà ouverte se referme toujours, même si l'activité n'en a plus
                                disabled={saving || !state.visible || (!state.correction && (noCorrection || textsFailed))}
                                onChange={(e) => void apply([{ classId: c.id, item, state: { visible: true, correction: e.target.checked } }])}
                              />
                              Correction
                            </label>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {!unavailable && data && classes.length > 0 && (
        <p className="bg-note">
          Une évaluation s’ouvre pour toutes les classes du niveau à la fois : un élève d’une classe peut montrer le sujet à une autre. Elle ne s’ouvre jamais avec la case « Tout » d’une séquence.
        </p>
      )}
    </div>
  );
}
