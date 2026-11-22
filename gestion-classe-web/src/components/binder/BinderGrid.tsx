/**
 * Classeur ouvert aux classes (PLAN_classeur_eleves.md, lot 4) : la grille de « Mes cours ». Une
 * ligne par activité (et par page seule), une colonne par classe du niveau ; dans chaque case,
 * « Activité » et « Correction ». C'est le second endroit où régler ce que chaque classe voit du
 * classeur : il écrit les mêmes lignes que la page `/classeur` (lib/binderRelease.ts), à partir du
 * même classeur (useBinderLibrary). Fermé par défaut. Les évaluations ne se règlent qu'ici, pour
 * tout le niveau à la fois (lot 5).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import {
  hasCorrection, itemStates, rowFor, sequenceAnchors, staleRows, stateOf,
  type BinderItem, type BinderItemRow, type ItemState,
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
function EvaluationCell({ item, level, classes, stateIn, saving, onApply }: {
  item: BinderItem;
  level: string;
  classes: BinderClass[];
  stateIn: (classId: string) => ItemState;
  saving: boolean;
  onApply: (state: ItemState) => void;
}) {
  const [confirming, setConfirming] = useState<'subject' | 'correction' | null>(null);
  const open = classes.filter((c) => stateIn(c.id).visible);
  const corrected = classes.filter((c) => stateIn(c.id).correction);
  const allOpen = open.length === classes.length;
  const allCorrected = corrected.length === classes.length;
  const names = (list: BinderClass[]) => list.map((c) => c.name).join(', ');
  const said = (list: BinderClass[], closed: string, all: string, some: string) => (list.length === 0 ? closed : list.length === classes.length ? all : `${some} ${names(list)} seulement`);
  const apply = (state: ItemState) => { setConfirming(null); onApply(state); };

  if (confirming) {
    const correction = confirming === 'correction';
    return (
      <div className="bg-eval">
        <span className="bg-eval__warn">
          {correction ? 'La correction' : 'Le sujet'} de cette évaluation sera visible par toutes les classes de {level} ({names(classes)}). À faire seulement quand toutes ont composé.
        </span>
        <button type="button" className="bg-all bg-all--go" disabled={saving} onClick={() => apply({ visible: true, correction })}>
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
      {open.length > 0 && <button type="button" className="bg-all" disabled={saving} onClick={() => apply({ visible: false, correction: false })}>Refermer</button>}
      {hasCorrection(item) && (
        <>
          <span className="bg-eval__sep">Correction : {said(corrected, 'fermée', `ouverte aux ${level}`, 'ouverte aux')}</span>
          {allOpen && !allCorrected && <button type="button" className="bg-all" disabled={saving} onClick={() => setConfirming('correction')}>Ouvrir aux {level}</button>}
          {corrected.length > 0 && <button type="button" className="bg-all" disabled={saving} onClick={() => apply({ visible: true, correction: false })}>Refermer</button>}
        </>
      )}
    </div>
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
  const itemByAnchor = useMemo(() => new Map(items.map((i) => [i.anchor, i])), [items]);
  const statesOf = useMemo(() => new Map(classes.map((c) => [c.id, itemStates(data?.rows.get(c.id) ?? [])])), [classes, data]);
  const staleOf = useMemo(
    () => new Map(classes.map((c) => [c.id, items.length > 0 && !textsFailed ? staleRows(items, data?.rows.get(c.id) ?? []).length : 0])),
    [classes, data, items, textsFailed],
  );

  /** Ouvre ou ferme des éléments pour une classe : montré tout de suite, relu en base si l'écriture échoue. */
  const apply = useCallback(async (classId: string, changes: { item: BinderItem; state: ItemState }[]) => {
    if (changes.length === 0) return;
    const next = changes.map(({ item, state }) => rowFor(item, classId, state));
    // (seulement si la classe est toujours à l'écran : le niveau a pu changer pendant l'écriture)
    const patch = (rows: BinderItemRow[]) => setLoaded((cur) => (cur?.rows.has(classId) ? { ...cur, rows: new Map(cur.rows).set(classId, mergeRows(cur.rows.get(classId) ?? [], rows)) } : cur));
    patch(next);
    setPending((n) => n + 1);
    setLoadError(null);
    try {
      patch(await saveBinderItems(userId, next));
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? `Réglage non enregistré : ${err.message}` : 'Réglage non enregistré');
      // L'écran ne doit jamais montrer « ouvert » ce que la base n'a pas : on relit ce qu'elle dit
      const fresh = await fetchBinderItemsOfClasses([classId]).catch(() => null);
      if (fresh) setLoaded((cur) => (cur?.rows.has(classId) ? { ...cur, rows: new Map(cur.rows).set(classId, fresh) } : cur));
    } finally {
      setPending((n) => n - 1);
    }
  }, [userId]);

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
          Ce que chaque classe voit du classeur. Tout est fermé au départ. « Correction » ouvre la copie modèle et le bilan de l’activité.
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
                    {(staleOf.get(c.id) ?? 0) > 0 && (
                      <span className="bg-stale" title="Des éléments ouverts ne correspondent plus au classeur : ouvrez le classeur de la classe pour les mettre à jour">
                        {staleOf.get(c.id)} à mettre à jour
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
                    const closed = group.chapter ? sequenceAnchors(items, group.chapter).filter((a) => !stateOf(states, a).visible).flatMap((a) => itemByAnchor.get(a) ?? []) : [];
                    return (
                      <td key={c.id}>
                        {closed.length > 0 && (
                          <button
                            type="button"
                            className="bg-all"
                            disabled={saving}
                            aria-label={`Tout ouvrir : ${group.title}, ${c.name}`}
                            title="La page de garde et les activités de la séquence. Ni les corrections, ni la fiche de mémorisation, ni l’évaluation."
                            onClick={() => void apply(c.id, closed.map((item) => ({ item, state: { visible: true, correction: stateOf(states, item.anchor).correction } })))}
                          >
                            Tout ouvrir
                          </button>
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
                        saving={saving}
                        onApply={(state) => { for (const c of classes) void apply(c.id, [{ item, state }]); }}
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
                              onChange={(e) => void apply(c.id, [{ item, state: { visible: e.target.checked, correction: e.target.checked && state.correction } }])}
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
                                onChange={(e) => void apply(c.id, [{ item, state: { visible: true, correction: e.target.checked } }])}
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
          Une évaluation s’ouvre pour toutes les classes du niveau à la fois : un élève d’une classe peut montrer le sujet à une autre. Elle ne s’ouvre jamais avec « Tout ouvrir ».
        </p>
      )}
    </div>
  );
}
