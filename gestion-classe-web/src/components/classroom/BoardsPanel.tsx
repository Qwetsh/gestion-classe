/**
 * Mes tableaux : bibliothèque des tableaux préparés (table `boards`), rangés par niveau puis
 * chapitre, à ouvrir depuis l'accueil. Chaque tableau indique dans combien de séances il a servi
 * (table `session_boards`) ; le « Brouillon » local (sans compte ni migration) reste disponible.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BOARD_LEVELS,
  NO_LEVEL,
  boardsUnavailable,
  createBoard,
  deleteBoard,
  fetchBoardUsages,
  levelRank,
  listBoards,
  updateBoard,
  type Board,
  type BoardMeta,
  type BoardUsage,
} from '../../lib/boardsQueries';
import { Whiteboard } from './Whiteboard';

/** Clé de stockage local du tableau blanc libre (hors séance). */
export const FREE_BOARD_ID = 'tableau-libre';

const COLLAPSED_KEY = 'dash-boards-collapsed';

interface Props {
  userId: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function BoardsPanel({ userId }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [usages, setUsages] = useState<Map<string, BoardUsage[]>>(new Map());
  const [open, setOpen] = useState<Board | 'draft' | null>(null);
  const [editing, setEditing] = useState<Board | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
  });

  // Chargement puis rafraîchissement (retour de l'éditeur) : l'état n'est posé qu'à la réponse du serveur
  const refresh = useCallback(() => Promise.all([listBoards(userId), fetchBoardUsages(userId)])
    .then(([b, u]) => { setBoards(b); setUsages(u); setError(null); })
    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erreur')), [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = (level: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [level]: !prev[level] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  /** Niveau → chapitre → tableaux (les plus récents d'abord dans chaque chapitre). */
  const groups = useMemo(() => {
    const byLevel = new Map<string, Map<string, Board[]>>();
    for (const b of boards) {
      const lv = b.level ?? NO_LEVEL;
      const chapters = byLevel.get(lv) ?? new Map<string, Board[]>();
      const ch = b.chapter ?? '';
      chapters.set(ch, [...(chapters.get(ch) ?? []), b]);
      byLevel.set(lv, chapters);
    }
    return [...byLevel.entries()]
      .sort((a, b) => levelRank(a[0] === NO_LEVEL ? null : a[0]) - levelRank(b[0] === NO_LEVEL ? null : b[0]))
      .map(([level, chapters]) => ({
        level,
        count: [...chapters.values()].reduce((n, l) => n + l.length, 0),
        chapters: [...chapters.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'fr'))),
      }));
  }, [boards]);

  const save = async (meta: BoardMeta) => {
    if (editing === 'new') {
      const b = await createBoard(userId, meta);
      setBoards((prev) => [b, ...prev]);
      setEditing(null);
      setOpen(b);
    } else if (editing) {
      await updateBoard(editing.id, meta);
      setBoards((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...meta, updated_at: new Date().toISOString() } : x)));
      setEditing(null);
    }
  };

  const remove = async (b: Board) => {
    const used = usages.get(b.id)?.length ?? 0;
    const warn = used > 0 ? ` Les ${used} séance${used > 1 ? 's' : ''} qui en sont parties gardent leurs propres pages.` : '';
    if (!window.confirm(`Supprimer « ${b.title} » et toutes ses pages ?${warn}`)) return;
    try { await deleteBoard(b.id); setBoards((prev) => prev.filter((x) => x.id !== b.id)); }
    catch (err) { window.alert(err instanceof Error ? err.message : 'Suppression impossible'); }
  };

  const rowButton: React.CSSProperties = { flex: 1, font: 'inherit', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0, minWidth: 0 };
  const iconButton: React.CSSProperties = { padding: '4px 8px' };

  return (
    <div className="dash__card">
      <div className="dash__card-head">
        <div>
          <h2 className="dash__card-title">Mes tableaux</h2>
          <p className="dash__card-sub">Cours préparés à l'avance, rangés par niveau et chapitre ; à ouvrir en classe depuis Plus ⋯ › Fichier.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => setEditing('new')} disabled={boardsUnavailable()} title={boardsUnavailable() ? 'Migration add_boards.sql à appliquer' : 'Nouveau tableau préparé'}>
          + Nouveau
        </button>
      </div>

      <div className="dash__shortcuts" style={{ gridTemplateColumns: '1fr' }}>
        <button type="button" onClick={() => setOpen('draft')} className="dash__shortcut" style={{ font: 'inherit', textAlign: 'left', border: 'none', background: 'var(--surface)', cursor: 'pointer' }}>
          <span className="dash__shortcut-icon">🖊</span>
          <div>
            <div className="dash__shortcut-title">Brouillon</div>
            <div className="dash__shortcut-sub">Ardoise libre, gardée sur cet appareil</div>
          </div>
        </button>

        {groups.map(({ level, count, chapters }) => {
          const isCollapsed = !!collapsed[level];
          return (
            <div key={level} style={{ background: 'var(--surface)' }}>
              <button
                type="button"
                onClick={() => toggle(level)}
                className="dash__shortcut"
                style={{ width: '100%', font: 'inherit', border: 'none', cursor: 'pointer', padding: '10px 16px', background: 'var(--surface-2)' }}
                aria-expanded={!isCollapsed}
              >
                <span className="dash__shortcut-icon" style={{ fontSize: 12, width: 14, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .12s' }}>▼</span>
                <span className="dash__shortcut-title" style={{ flex: 1, textAlign: 'left' }}>{level}</span>
                <span className="dash__shortcut-sub">{count} tableau{count > 1 ? 'x' : ''}</span>
              </button>
              {!isCollapsed && chapters.map(([chapter, list]) => (
                <div key={chapter || '—'}>
                  {chapter && <div className="dash__shortcut-sub" style={{ padding: '8px 16px 0 40px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{chapter}</div>}
                  {list.map((b) => {
                    const used = usages.get(b.id) ?? [];
                    return (
                      <div key={b.id} className="dash__shortcut" style={{ alignItems: 'center', paddingLeft: 40 }}>
                        <span className="dash__shortcut-icon">📋</span>
                        <button type="button" onClick={() => setOpen(b)} style={rowButton} title="Ouvrir dans l'éditeur">
                          <div className="dash__shortcut-title">{b.title}</div>
                          <div className="dash__shortcut-sub">
                            modifié le {fmtDate(b.updated_at)}
                            {used.length > 0 && (
                              <>
                                {' · '}
                                <Link to={`/sessions/${used[0].session_id}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }} title={used.map((u) => `${u.class_name} · ${fmtDate(u.started_at)}`).join('\n')}>
                                  utilisé dans {used.length} séance{used.length > 1 ? 's' : ''}
                                </Link>
                              </>
                            )}
                          </div>
                        </button>
                        <button type="button" className="btn btn--ghost" onClick={() => setEditing(b)} title="Titre, niveau, chapitre" style={iconButton}>✎</button>
                        <button type="button" className="btn btn--ghost" onClick={() => void remove(b)} title="Supprimer" style={iconButton}>🗑</button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
        {error && <div style={{ color: 'var(--neg)', fontSize: 12, padding: '8px 16px', background: 'var(--surface)' }}>{error}</div>}
      </div>

      {editing && (
        <BoardMetaForm
          initial={editing === 'new' ? { title: '', level: null, chapter: null } : { title: editing.title, level: editing.level, chapter: editing.chapter }}
          isNew={editing === 'new'}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {open === 'draft' && (
        <Whiteboard sessionId={FREE_BOARD_ID} userId={userId} remote={false} title="Brouillon" onClose={() => setOpen(null)} />
      )}
      {open && open !== 'draft' && (
        <Whiteboard sessionId={`board:${open.id}`} boardId={open.id} userId={userId} title={open.title} onClose={() => { setOpen(null); void refresh(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

interface FormProps {
  initial: BoardMeta;
  isNew: boolean;
  onSave: (meta: BoardMeta) => Promise<void>;
  onClose: () => void;
}

/** Petit formulaire modal : titre, niveau, chapitre. Remplace les `window.prompt` d'avant. */
function BoardMetaForm({ initial, isNew, onSave, onClose }: FormProps) {
  const [title, setTitle] = useState(initial.title);
  const [level, setLevel] = useState(initial.level ?? '');
  const [chapter, setChapter] = useState(initial.chapter ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try { await onSave({ title: title.trim(), level: level || null, chapter: chapter.trim() || null }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible'); setBusy(false); }
  };

  const field: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit' };
  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flex: 1 };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--surface)] p-6 space-y-4"
        style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2, var(--shadow-1))' }}
      >
        <h3 className="dash__card-title">{isNew ? 'Nouveau tableau préparé' : 'Modifier le tableau'}</h3>
        <label style={label}>
          Titre
          <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fractions — introduction" autoFocus required />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={label}>
            Niveau
            <select style={field} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Sans niveau</option>
              {BOARD_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label style={label}>
            Chapitre
            <input style={field} value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Nombres, Thalès, Volcans…" />
          </label>
        </div>
        {error && <div style={{ color: 'var(--neg)', fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !title.trim()}>{busy ? 'Enregistrement…' : isNew ? 'Créer et ouvrir' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
