/**
 * Formulaire d'un cours de la bibliothèque : à la création, le type (cours rédigé ou tableau
 * blanc) et le modèle de départ ; toujours le titre, le niveau et la séquence.
 * Repris de l'ancien panneau « Mes tableaux » de l'accueil (lot C1 de PLAN_mes_cours.md).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { BOARD_LEVELS, deleteBoard, type Board, type BoardMeta } from '../../lib/boardsQueries';
import { coursesUnavailable, listTemplates, type CourseTemplateRow } from '../../lib/course/courseDoc';
import { isDocxFile } from '../../lib/course/courseImport';
import { chaptersOfLevel } from '../../lib/courseLibrary';
import { BUILTIN_TEMPLATES } from '../course/courseTemplates';

/** Modèle choisi pour un nouveau cours : fourni (courseTemplates.ts) ou personnel (boards.is_template). */
export type TemplateChoice = { from: 'builtin'; id: string } | { from: 'mine'; id: string } | { from: 'word'; file: File };
/** Modèle de la liste (fourni ou personnel), par opposition au fichier Word choisi. */
type ListedChoice = Extract<TemplateChoice, { id: string }>;

interface FormProps {
  userId: string;
  initial: BoardMeta;
  isNew: boolean;
  /** Cours de la bibliothèque : leurs séquences sont proposées à la saisie, pour éviter les doublons de frappe. */
  boards: Board[];
  onSave: (meta: BoardMeta, kind: 'course' | 'board', template: TemplateChoice) => Promise<void>;
  onClose: () => void;
}

/** Petit formulaire modal : titre, niveau, séquence. */
export function BoardMetaForm({ userId, initial, isNew, boards, onSave, onClose }: FormProps) {
  const chaptersId = useId();
  const [title, setTitle] = useState(initial.title);
  const [level, setLevel] = useState(initial.level ?? '');
  const [chapter, setChapter] = useState(initial.chapter ?? '');
  const [kind, setKind] = useState<'course' | 'board'>(coursesUnavailable() ? 'board' : 'course');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateChoice>({ from: 'builtin', id: 'vierge' });
  const [mine, setMine] = useState<CourseTemplateRow[]>([]);
  const wordRef = useRef<HTMLInputElement>(null);

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
        <h3 className="dash__card-title">{isNew ? 'Nouveau cours' : 'Renommer, ranger'}</h3>
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
                ...BUILTIN_TEMPLATES.map((t) => ({ choice: { from: 'builtin', id: t.id } as ListedChoice, label: t.label, hint: t.hint, emoji: t.emoji, row: null as CourseTemplateRow | null })),
                ...mine.map((t) => ({ choice: { from: 'mine', id: t.id } as ListedChoice, label: t.title, hint: 'Mon modèle', emoji: '⭐', row: t })),
              ].map(({ choice, label: l, hint, emoji, row }) => {
                const on = template.from === choice.from && 'id' in template && template.id === choice.id;
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
              {/* Lot T10a : reprendre un cours Word existant */}
              <button
                type="button"
                role="radio"
                aria-checked={template.from === 'word'}
                onClick={() => wordRef.current?.click()}
                title="Reprendre un cours Word (.docx) : titres, listes, tableaux, images et gras sont gardés ; à relire ensuite"
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', border: `1px solid ${template.from === 'word' ? 'var(--indigo)' : 'var(--border)'}`, background: template.from === 'word' ? 'var(--indigo-soft)' : 'var(--surface)', cursor: 'pointer', font: 'inherit', display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <span aria-hidden style={{ fontSize: 18 }}>📥</span>
                <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {template.from === 'word' ? template.file.name : 'Fichier Word…'}
                </span>
              </button>
              <input
                ref={wordRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (!isDocxFile(f)) { setError('Seuls les fichiers Word récents (.docx) peuvent être repris. Un .doc s’enregistre en .docx depuis Word ou LibreOffice.'); return; }
                  setError(null);
                  setTemplate({ from: 'word', file: f });
                  if (!title.trim()) setTitle(f.name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim());
                }}
              />
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
            Séquence
            <input style={field} value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Séquence 1 — Volcans" list={chaptersId} />
            <datalist id={chaptersId}>
              {chaptersOfLevel(boards, level || null).map((c) => <option key={c} value={c} />)}
            </datalist>
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
