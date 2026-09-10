/**
 * Mes tableaux : tableaux nommés hors séance (table `boards`), à ouvrir depuis l'accueil.
 * Le « Brouillon » local (sans compte ni migration) reste toujours disponible.
 */
import { useCallback, useEffect, useState } from 'react';
import { createBoard, deleteBoard, listBoards, renameBoard, boardsUnavailable, type Board } from '../../lib/boardsQueries';
import { Whiteboard } from './Whiteboard';

/** Clé de stockage local du tableau blanc libre (hors séance). */
export const FREE_BOARD_ID = 'tableau-libre';

interface Props {
  userId: string;
}

export function BoardsPanel({ userId }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [open, setOpen] = useState<{ id: string; title: string } | 'draft' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setBoards(await listBoards(userId)); setError(null); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    const title = window.prompt('Titre du tableau', 'Nouveau tableau');
    if (!title?.trim()) return;
    setBusy(true);
    try {
      const b = await createBoard(userId, title.trim());
      setBoards((prev) => [b, ...prev]);
      setOpen({ id: b.id, title: b.title });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Création impossible');
    } finally { setBusy(false); }
  };

  const rename = async (b: Board) => {
    const title = window.prompt('Nouveau titre', b.title);
    if (!title?.trim() || title.trim() === b.title) return;
    try { await renameBoard(b.id, title.trim()); setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, title: title.trim() } : x))); }
    catch (err) { window.alert(err instanceof Error ? err.message : 'Renommage impossible'); }
  };

  const remove = async (b: Board) => {
    if (!window.confirm(`Supprimer « ${b.title} » et toutes ses pages ?`)) return;
    try { await deleteBoard(b.id); setBoards((prev) => prev.filter((x) => x.id !== b.id)); }
    catch (err) { window.alert(err instanceof Error ? err.message : 'Suppression impossible'); }
  };

  return (
    <div className="dash__card">
      <div className="dash__card-head">
        <h2 className="dash__card-title">Mes tableaux</h2>
        <button type="button" className="btn btn--ghost" onClick={() => void create()} disabled={busy || boardsUnavailable()} title={boardsUnavailable() ? 'Migration add_boards.sql à appliquer' : 'Nouveau tableau nommé'}>
          + Nouveau
        </button>
      </div>
      <div className="dash__shortcuts">
        <button type="button" onClick={() => setOpen('draft')} className="dash__shortcut" style={{ font: 'inherit', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="dash__shortcut-icon">🖊</span>
          <div>
            <div className="dash__shortcut-title">Brouillon</div>
            <div className="dash__shortcut-sub">Ardoise libre, gardée sur cet appareil</div>
          </div>
        </button>
        {boards.map((b) => (
          <div key={b.id} className="dash__shortcut" style={{ alignItems: 'center' }}>
            <span className="dash__shortcut-icon">📋</span>
            <button type="button" onClick={() => setOpen({ id: b.id, title: b.title })} style={{ flex: 1, font: 'inherit', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
              <div className="dash__shortcut-title">{b.title}</div>
              <div className="dash__shortcut-sub">modifié le {new Date(b.updated_at).toLocaleDateString('fr-FR')}</div>
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => void rename(b)} title="Renommer" style={{ padding: '4px 8px' }}>✎</button>
            <button type="button" className="btn btn--ghost" onClick={() => void remove(b)} title="Supprimer" style={{ padding: '4px 8px' }}>🗑</button>
          </div>
        ))}
        {error && <div style={{ color: 'var(--neg)', fontSize: 12 }}>{error}</div>}
      </div>
      {open === 'draft' && (
        <Whiteboard sessionId={FREE_BOARD_ID} userId={userId} remote={false} title="Brouillon" onClose={() => setOpen(null)} />
      )}
      {open && open !== 'draft' && (
        <Whiteboard sessionId={`board:${open.id}`} boardId={open.id} userId={userId} title={open.title} onClose={() => { setOpen(null); void refresh(); }} />
      )}
    </div>
  );
}
