/**
 * Choisir une activité de la bibliothèque depuis l'emploi du temps, en deux usages :
 * - tableau blanc improvisé (« Quelle activité ? ») : l'activité donne son nom au tableau vide,
 *   et « Tableau vide » reste possible si rien ne convient ;
 * - « Lier une activité » : on choisit l'activité puis son rôle (activité ou correction) ; le cours
 *   reçoit une copie de ce document de la bibliothèque, écrans compris.
 * Quelques suggestions en tête (suite logique de ce que la classe a vu, correction de la dernière
 * activité), la liste complète du niveau à un geste.
 */
import { useEffect, useMemo, useState } from 'react';
import { listBoards, type Board } from '../../../lib/boardsQueries';
import { VARIANT_LABEL, variantLabel, type CourseVariant } from '../../../lib/courseLibrary';
import { pickableActivities, searchActivities, suggestActivities, type PickableSequence } from '../../../lib/activitySuggest';
import type { ActivityGroup } from '../../../lib/courseLibrary';

export interface PickedActivity {
  title: string;
  chapter: string;
  /** Cours de la bibliothèque qui composent l'activité (panneau « Activité » du tableau). */
  group: ActivityGroup;
}

/** Document de la bibliothèque à lier au cours (mode « Lier une activité »). */
export interface LinkedActivity {
  board: Board;
  chapter: string;
  variant: CourseVariant;
}

interface Props {
  userId: string;
  /** Niveau de la classe (4e, 5e…), ou null. */
  level: string | null;
  /** Dernier tableau projeté avec cette classe. */
  last: { title: string } | null;
  busy: boolean;
  /** Tableau improvisé : l'activité choisie nomme le tableau. */
  onPick?: (activity: PickedActivity) => void;
  /** Tableau improvisé : rien ne convient. */
  onEmpty?: () => void;
  /** Mode « Lier une activité » : présent = on choisit ensuite activité ou correction. */
  onLink?: (target: LinkedActivity) => void;
  onCancel: () => void;
}

/** Rôles qu'on peut lier à un cours : ce qui se projette en classe. */
const LINKABLE: CourseVariant[] = ['fiche', 'correction'];

const variantsOf = (g: ActivityGroup) => g.members.filter((m) => m.variant !== 'copie').map((m) => VARIANT_LABEL[m.variant].toLowerCase()).join(' · ');

const shortChapter = (chapter: string) => chapter.replace(/^Séquence\s+\d+\s*[—–-]\s*/i, '');

export function ActivityPicker({ userId, level, last, busy, onPick, onEmpty, onLink, onCancel }: Props) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  /** Mode lier : activité choisie, en attente du rôle (activité ou correction). */
  const [chosen, setChosen] = useState<{ group: ActivityGroup; chapter: string; open: CourseVariant } | null>(null);
  const [sent, setSent] = useState<CourseVariant | null>(null);
  const linking = !!onLink;

  useEffect(() => {
    let cancelled = false;
    listBoards(userId).then((list) => { if (!cancelled) setBoards(list); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const sequences = useMemo<PickableSequence[]>(() => (boards ? pickableActivities(boards, level) : []), [boards, level]);
  const suggestions = useMemo(() => suggestActivities({ sequences, last }), [sequences, last]);
  const filtered = useMemo(() => searchActivities(sequences, query), [sequences, query]);
  const listing = all || query.trim() !== '';

  const choose = (group: ActivityGroup, chapter: string, open: CourseVariant = 'fiche') => {
    if (linking) setChosen({ group, chapter, open });
    else onPick?.({ title: group.title, chapter, group });
  };

  if (chosen && onLink) {
    const { group, chapter, open } = chosen;
    return (
      <div className="wtt-pick">
        <div className="wtt-pick__head">
          <span className="wtt-pop__label">Quel tableau ?</span>
          <button type="button" className="wtt__link wtt__link--muted" onClick={onCancel} disabled={busy}>Annuler</button>
        </div>
        <div className="wtt-pick__chosen">
          <span className="wtt-pop__board-title">{group.title}</span>
          <span className="wtt-pop__muted">{shortChapter(chapter)}</span>
        </div>
        <div className="wtt-pick__variants">
          {LINKABLE.map((variant) => {
            const member = group.members.find((m) => m.variant === variant);
            const label = variant === 'fiche' ? (group.evaluation ? 'Sujet' : 'Activité') : variantLabel(variant, group.evaluation);
            return (
              <button
                key={variant}
                type="button"
                className={`wtt-pop__btn wtt-pop__btn--block ${member && variant === open ? 'wtt-pop__btn--primary' : ''}`}
                onClick={() => { if (!member) return; setSent(variant); onLink({ board: member.board, chapter, variant }); }}
                disabled={busy || !member}
                title={member ? `Lier « ${member.board.title} » à ce cours` : `Pas de ${label.toLowerCase()} dans la bibliothèque pour cette activité`}
              >
                {busy && sent === variant ? 'Liaison…' : label}
              </button>
            );
          })}
        </div>
        <span className="wtt-pop__muted">Le cours reçoit sa propre copie, écrans compris : la bibliothèque n’est pas touchée.</span>
        <div className="wtt-pick__foot">
          <button type="button" className="wtt__link" onClick={() => setChosen(null)} disabled={busy}>◀ Autre activité</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wtt-pick">
      <div className="wtt-pick__head">
        <span className="wtt-pop__label">{linking ? 'Quelle activité lier ?' : 'Quelle activité ?'}</span>
        <button type="button" className="wtt__link wtt__link--muted" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
      {!boards && !failed && <span className="wtt-pop__muted">Lecture de la bibliothèque…</span>}
      {failed && <span className="wtt-pop__muted">{linking ? 'Bibliothèque illisible pour le moment.' : 'Bibliothèque illisible : vous pouvez ouvrir un tableau vide.'}</span>}
      {boards && suggestions.length > 0 && !listing && (
        <div className="wtt-pick__list">
          {suggestions.map((s) => (
            <button key={s.group.key} type="button" className="wtt-pop__board" onClick={() => choose(s.group, s.chapter, s.open)} disabled={busy}>
              <span className="wtt-pop__board-title">{s.group.title}</span>
              <span className="wtt-pop__muted">{s.label} · {shortChapter(s.chapter)}</span>
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
        {onEmpty && <button type="button" className="wtt__link" onClick={onEmpty} disabled={busy}>{busy ? 'Création…' : 'Tableau vide'}</button>}
      </div>
    </div>
  );
}
