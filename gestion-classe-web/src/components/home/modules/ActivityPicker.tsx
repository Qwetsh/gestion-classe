/**
 * Tableau blanc improvisé depuis l'emploi du temps : « Quelle activité ? ».
 * Quelques suggestions en tête (suite logique de ce que la classe a vu, correction de la dernière
 * activité), la liste complète du niveau à un geste, et « Tableau vide » si rien ne convient.
 */
import { useEffect, useMemo, useState } from 'react';
import { listBoards, type Board } from '../../../lib/boardsQueries';
import { VARIANT_LABEL } from '../../../lib/courseLibrary';
import { pickableActivities, searchActivities, suggestActivities, type PickableSequence } from '../../../lib/activitySuggest';
import type { ActivityGroup } from '../../../lib/courseLibrary';

export interface PickedActivity {
  title: string;
  chapter: string;
  /** Cours de la bibliothèque qui composent l'activité (panneau « Activité » du tableau). */
  group: ActivityGroup;
}

interface Props {
  userId: string;
  /** Niveau de la classe (4e, 5e…), ou null. */
  level: string | null;
  /** Dernier tableau projeté avec cette classe. */
  last: { title: string } | null;
  busy: boolean;
  onPick: (activity: PickedActivity) => void;
  onEmpty: () => void;
  onCancel: () => void;
}

const variantsOf = (g: ActivityGroup) => g.members.filter((m) => m.variant !== 'copie').map((m) => VARIANT_LABEL[m.variant].toLowerCase()).join(' · ');

export function ActivityPicker({ userId, level, last, busy, onPick, onEmpty, onCancel }: Props) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBoards(userId).then((list) => { if (!cancelled) setBoards(list); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const sequences = useMemo<PickableSequence[]>(() => (boards ? pickableActivities(boards, level) : []), [boards, level]);
  const suggestions = useMemo(() => suggestActivities({ sequences, last }), [sequences, last]);
  const filtered = useMemo(() => searchActivities(sequences, query), [sequences, query]);
  const listing = all || query.trim() !== '';

  const choose = (group: ActivityGroup, chapter: string) => onPick({ title: group.title, chapter, group });

  return (
    <div className="wtt-pick">
      <div className="wtt-pick__head">
        <span className="wtt-pop__label">Quelle activité ?</span>
        <button type="button" className="wtt__link wtt__link--muted" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
      {!boards && !failed && <span className="wtt-pop__muted">Lecture de la bibliothèque…</span>}
      {failed && <span className="wtt-pop__muted">Bibliothèque illisible : vous pouvez ouvrir un tableau vide.</span>}
      {boards && suggestions.length > 0 && !listing && (
        <div className="wtt-pick__list">
          {suggestions.map((s) => (
            <button key={s.group.key} type="button" className="wtt-pop__board" onClick={() => choose(s.group, s.chapter)} disabled={busy}>
              <span className="wtt-pop__board-title">{s.group.title}</span>
              <span className="wtt-pop__muted">{s.label} · {s.chapter.replace(/^Séquence\s+\d+\s*[—–-]\s*/i, '')}</span>
            </button>
          ))}
        </div>
      )}
      {boards && sequences.length === 0 && <span className="wtt-pop__muted">Aucune activité{level ? ` en ${level}` : ''} dans la bibliothèque.</span>}
      {boards && sequences.length > 0 && (
        <input
          type="search"
          className="wtt-pick__search"
          placeholder="Chercher une activité…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Chercher une activité"
        />
      )}
      {boards && listing && (
        <div className="wtt-pick__all">
          {filtered.length === 0 && <span className="wtt-pop__muted">Aucune activité ne correspond.</span>}
          {filtered.map((s) => (
            <div key={s.chapter} className="wtt-pick__seq">
              <span className="wtt-pick__chapter">{s.chapter}</span>
              {s.groups.map((g) => (
                <button key={g.key} type="button" className="wtt-pick__row" onClick={() => choose(g, s.chapter)} disabled={busy}>
                  <span className="wtt-pick__title">{g.title}</span>
                  <span className="wtt-pop__muted">{variantsOf(g)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="wtt-pick__foot">
        {boards && sequences.length > 0 && query.trim() === '' && (
          <button type="button" className="wtt__link" onClick={() => setAll((v) => !v)}>{all ? 'Masquer la liste' : 'Toutes les activités'}</button>
        )}
        <button type="button" className="wtt__link" onClick={onEmpty} disabled={busy}>{busy ? 'Création…' : 'Tableau vide'}</button>
      </div>
    </div>
  );
}
