/**
 * Liens d'une activité vers un site ou une application (app maison, site de données…) :
 * un nom et une adresse par lien. Ils s'affichent en bouton sur la ligne de l'activité.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Board } from '../../lib/boardsQueries';
import { MAX_COURSE_LINKS, linkHost, normalizeUrl, type CourseLink } from '../../lib/course/courseLinks';

interface Props {
  board: Board;
  onSave: (links: CourseLink[]) => Promise<void>;
  onClose: () => void;
}

interface Row { label: string; url: string }

export function CourseLinksDialog({ board, onSave, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(() => (board.links?.length ? board.links.map((l) => ({ ...l })) : [{ label: '', url: '' }]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // Une ligne sans adresse est ignorée ; une adresse illisible bloque l'enregistrement
  const filled = rows.filter((r) => r.url.trim());
  const invalid = filled.findIndex((r) => !normalizeUrl(r.url));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid !== -1) { setError(`Adresse illisible : « ${filled[invalid].url.trim()} »`); return; }
    const links: CourseLink[] = [];
    for (const r of filled) {
      const url = normalizeUrl(r.url)!;
      if (!links.some((l) => l.url === url)) links.push({ label: r.label.trim() || linkHost(url), url });
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(links);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
      setBusy(false);
    }
  };

  const field: React.CSSProperties = { height: 40, padding: '0 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', minWidth: 0 };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-6" onClick={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className="w-full max-w-xl bg-[var(--surface)] p-6 space-y-4"
        style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2, var(--shadow-1))' }}
      >
        <h3 className="dash__card-title">Liens vers un site ou une app</h3>
        <p className="mc-place__what" style={{ margin: 0 }}>{board.title}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} className="mc-links__row">
              <input
                style={{ ...field, flex: '1 1 160px' }}
                value={r.label}
                placeholder="Nom (Hôpital virtuel)"
                aria-label={`Nom du lien ${i + 1}`}
                onChange={(e) => update(i, { label: e.target.value })}
                autoFocus={i === 0}
              />
              <input
                style={{ ...field, flex: '2 1 220px' }}
                value={r.url}
                placeholder="Adresse (hopital-virtuel.vercel.app)"
                aria-label={`Adresse du lien ${i + 1}`}
                inputMode="url"
                onChange={(e) => { update(i, { url: e.target.value }); setError(null); }}
              />
              <button
                type="button"
                className="btn btn--ghost"
                style={{ width: 40, padding: 0, justifyContent: 'center' }}
                onClick={() => setRows((prev) => (prev.length === 1 ? [{ label: '', url: '' }] : prev.filter((_, j) => j !== i)))}
                title="Retirer ce lien"
                aria-label={`Retirer le lien ${i + 1}`}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
          {rows.length < MAX_COURSE_LINKS && (
            <button type="button" className="btn btn--ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setRows((prev) => [...prev, { label: '', url: '' }])}>
              <Plus size={15} aria-hidden /> Ajouter un lien
            </button>
          )}
        </div>
        {error && <p className="mc-error" role="alert">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  );
}
