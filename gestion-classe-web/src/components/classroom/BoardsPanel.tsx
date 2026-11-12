/**
 * Mes tableaux : bibliothèque des tableaux préparés (table `boards`), rangés par niveau puis
 * chapitre, à ouvrir depuis l'accueil. Chaque tableau indique dans combien de séances il a servi
 * (table `session_boards`) ; le « Brouillon » local (sans compte ni migration) reste disponible.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BoardWorkspace } from './BoardWorkspace';
import { draftTab } from '../../lib/boardTabs';
import { OpenPreparedBoard } from '../course/OpenPreparedBoard';
import { coursesUnavailable, createCourse, duplicateCourse, listTemplates, type CourseTemplateRow } from '../../lib/course/courseDoc';
import { BUILTIN_TEMPLATES } from '../course/courseTemplates';

/** Modèle choisi pour un nouveau cours : fourni (courseTemplates.ts) ou personnel (boards.is_template). */
type TemplateChoice = { from: 'builtin'; id: string } | { from: 'mine'; id: string };

/** Clé de stockage local du tableau blanc libre (hors séance). */

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

  const save = async (meta: BoardMeta, kind: 'course' | 'board', template: TemplateChoice) => {
    if (editing === 'new') {
      let b: Board;
      if (kind === 'board') b = await createBoard(userId, meta);
      else if (template.from === 'mine') b = await duplicateCourse(userId, template.id, meta);
      else b = { ...(await createCourse(userId, meta, null, (BUILTIN_TEMPLATES.find((t) => t.id === template.id) ?? BUILTIN_TEMPLATES[0]).build())), is_course: true };
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
          <h2 className="dash__card-title" title="Tableaux préparés à l'avance, rangés par niveau et chapitre ; à ouvrir en classe depuis Plus ⋯ › Fichier">Mes tableaux</h2>
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
                    // Date de modification et séances d'utilisation : dans l'infobulle, pas dans la liste
                    const used = usages.get(b.id) ?? [];
                    const hint = [
                      `modifié le ${fmtDate(b.updated_at)}`,
                      used.length > 0 ? `utilisé dans ${used.length} séance${used.length > 1 ? 's' : ''}` : null,
                      ...used.map((u) => `${u.class_name} · ${fmtDate(u.started_at)}`),
                    ].filter(Boolean).join('\n');
                    return (
                      <div key={b.id} className="dash__shortcut" style={{ alignItems: 'center', paddingLeft: 40 }}>
                        <span className="dash__shortcut-icon" title={b.is_course ? 'Cours rédigé' : 'Tableau blanc'}>{b.is_course ? '📄' : '📋'}</span>
                        <button type="button" onClick={() => setOpen(b)} style={rowButton} title={hint}>
                          <div className="dash__shortcut-title">{b.title}</div>
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
          userId={userId}
          initial={editing === 'new' ? { title: '', level: null, chapter: null } : { title: editing.title, level: editing.level, chapter: editing.chapter }}
          isNew={editing === 'new'}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {open === 'draft' && (
        <BoardWorkspace initial={draftTab()} userId={userId} chrome="ribbon" onClose={() => setOpen(null)} />
      )}
      {open && open !== 'draft' && (
        <OpenPreparedBoard key={open.id} board={open} kind={open.is_course === undefined ? undefined : open.is_course ? 'course' : 'board'} userId={userId} onClose={() => { setOpen(null); void refresh(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

interface FormProps {
  userId: string;
  initial: BoardMeta;
  isNew: boolean;
  onSave: (meta: BoardMeta, kind: 'course' | 'board', template: TemplateChoice) => Promise<void>;
  onClose: () => void;
}

/** Petit formulaire modal : titre, niveau, chapitre. Remplace les `window.prompt` d'avant. */
function BoardMetaForm({ userId, initial, isNew, onSave, onClose }: FormProps) {
  const [title, setTitle] = useState(initial.title);
  const [level, setLevel] = useState(initial.level ?? '');
  const [chapter, setChapter] = useState(initial.chapter ?? '');
  const [kind, setKind] = useState<'course' | 'board'>(coursesUnavailable() ? 'board' : 'course');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateChoice>({ from: 'builtin', id: 'vierge' });
  const [mine, setMine] = useState<CourseTemplateRow[]>([]);

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    listTemplates(userId).then((t) => { if (!cancelled) setMine(t); }).catch(() => { /* pas de modèles personnels */ });
    return () => { cancelled = true; };
  }, [isNew, userId]);

  const removeTemplate = async (t: CourseTemplateRow) => {
    if (!window.confirm(`Supprimer le modèle « ${t.title} » ? Les cours créés à partir de lui ne changent pas.`)) return;
    try {
      await deleteBoard(t.id);
      setMine((prev) => prev.filter((x) => x.id !== t.id));
      if (template.from === 'mine' && template.id === t.id) setTemplate({ from: 'builtin', id: 'vierge' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Suppression impossible'); }
  };

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
    try { await onSave({ title: title.trim(), level: level || null, chapter: chapter.trim() || null }, kind, template); }
    catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible'); setBusy(false); }
  };

  const field: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit' };
  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flex: 1 };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${isNew && kind === 'course' ? 'max-w-xl' : 'max-w-md'} bg-[var(--surface)] p-6 space-y-4`}
        style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2, var(--shadow-1))' }}
      >
        <h3 className="dash__card-title">{isNew ? 'Nouveau tableau préparé' : 'Modifier le tableau'}</h3>
        {isNew && (
          <div role="radiogroup" aria-label="Type" style={{ display: 'flex', gap: 8 }}>
            {([
              ['course', '📄 Cours rédigé', 'Rédigé comme dans Word, imprimable en A4'],
              ['board', '📋 Tableau blanc', 'Pages 16:9 à dessiner, comme avant'],
            ] as const).map(([k, l, sub]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                disabled={k === 'course' && coursesUnavailable()}
                style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius)', border: `1px solid ${kind === k ? 'var(--indigo)' : 'var(--border)'}`, background: kind === k ? 'var(--indigo-soft)' : 'var(--surface)', cursor: 'pointer', font: 'inherit' }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{l}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
              </button>
            ))}
          </div>
        )}
        {isNew && kind === 'course' && (
          <div role="radiogroup" aria-label="Modèle" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Partir de</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
              {[
                ...BUILTIN_TEMPLATES.map((t) => ({ choice: { from: 'builtin', id: t.id } as TemplateChoice, label: t.label, hint: t.hint, emoji: t.emoji, row: null as CourseTemplateRow | null })),
                ...mine.map((t) => ({ choice: { from: 'mine', id: t.id } as TemplateChoice, label: t.title, hint: 'Mon modèle', emoji: '⭐', row: t })),
              ].map(({ choice, label: l, hint, emoji, row }) => {
                const on = template.from === choice.from && template.id === choice.id;
                return (
                  <div key={`${choice.from}:${choice.id}`} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTemplate(choice)}
                      title={hint}
                      style={{ width: '100%', height: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', border: `1px solid ${on ? 'var(--indigo)' : 'var(--border)'}`, background: on ? 'var(--indigo-soft)' : 'var(--surface)', cursor: 'pointer', font: 'inherit', display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      <span aria-hidden style={{ fontSize: 18 }}>{emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: row ? 16 : 0 }}>{l}</span>
                    </button>
                    {row && (
                      <button type="button" onClick={() => void removeTemplate(row)} title="Supprimer ce modèle" aria-label={`Supprimer le modèle ${row.title}`} style={{ position: 'absolute', top: 4, right: 4, border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 2 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
