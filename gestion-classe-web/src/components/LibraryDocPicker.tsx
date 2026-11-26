import { useEffect, useMemo, useState } from 'react';
import { listBoards, type Board } from '../lib/boardsQueries';
import { pickableActivities, searchActivities } from '../lib/activitySuggest';
import { groupsForAssessment, pickableMembers } from '../lib/assessmentLibrary';
import { VARIANT_LABEL, type ActivityGroup } from '../lib/courseLibrary';

/**
 * « Choisir dans Mes cours » : le sujet ou le corrigé d'une évaluation pris dans la bibliothèque
 * plutôt qu'importé depuis l'ordinateur. Séquences du niveau de la classe (ou de tous les
 * niveaux), évaluations en tête, recherche ; chaque activité montre ses cours (fiche, documents,
 * correction…), le rôle attendu mis en avant.
 */
export function LibraryDocPicker({
  userId,
  level,
  kind,
  onPick,
  onClose,
}: {
  userId: string;
  /** Niveau de la classe (4e…), ou null. */
  level: string | null;
  kind: 'subject' | 'correction';
  onPick: (board: Board, group: ActivityGroup) => Promise<void> | void;
  onClose: () => void;
}) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [allLevels, setAllLevels] = useState(level === null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBoards(userId).then((list) => { if (!cancelled) setBoards(list); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const sequences = useMemo(
    () => (boards ? searchActivities(pickableActivities(boards, allLevels ? null : level), query) : []),
    [boards, allLevels, level, query],
  );
  const label = kind === 'subject' ? 'sujet' : 'corrigé';

  const pick = async (board: Board, group: ActivityGroup) => {
    setBusy(true);
    try {
      await onPick(board, group);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div
        role="dialog"
        aria-label={`Choisir le ${label} dans Mes cours`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 560, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: 'var(--shadow-2)' }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          Choisir le {label} dans Mes cours
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher une activité ou une séquence…"
            aria-label="Chercher une activité"
            autoFocus
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
          />
          {level && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={allLevels} onChange={(e) => setAllLevels(e.target.checked)} />
              Tous les niveaux
            </label>
          )}
        </div>

        <div style={{ overflowY: 'auto', marginTop: 12, flex: 1, minHeight: 120 }}>
          {!boards && !failed && <div style={muted}>Lecture de Mes cours…</div>}
          {failed && <div style={muted}>Mes cours est illisible pour le moment.</div>}
          {boards && sequences.length === 0 && (
            <div style={muted}>{query.trim() ? 'Aucune activité ne correspond.' : `Aucune activité${level && !allLevels ? ` en ${level}` : ''} dans Mes cours.`}</div>
          )}
          {sequences.map((s) => (
            <div key={s.chapter} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '4px 0 6px' }}>{s.chapter}</div>
              {groupsForAssessment(s).map((g) => {
                const members = pickableMembers(g, kind);
                return (
                  <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', minWidth: 0 }}>{g.title}</span>
                    {members.map(({ variant, board, preferred }) => (
                      <button
                        key={board.id}
                        type="button"
                        disabled={busy}
                        onClick={() => { void pick(board, g); }}
                        title={`Prendre « ${board.title} » comme ${label}`}
                        style={preferred ? chipPreferred : chip}
                      >
                        {g.evaluation && variant === 'fiche' ? 'Sujet' : VARIANT_LABEL[variant]}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Le cours reste dans Mes cours : une retouche s’y voit aussi depuis l’évaluation.
          </span>
          <button type="button" onClick={onClose} style={chip}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' };
const chip: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)', whiteSpace: 'nowrap',
};
const chipPreferred: React.CSSProperties = { ...chip, background: 'var(--indigo-ink)', color: '#fff', border: '1px solid var(--indigo-ink)' };
