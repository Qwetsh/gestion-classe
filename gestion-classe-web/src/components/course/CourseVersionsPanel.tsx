/**
 * Volet « Historique des versions » de l'éditeur de cours (lot T6), comme dans Word : la liste
 * des instantanés du cours, regroupés par jour ; un clic en affiche l'aperçu, d'où on peut la
 * restaurer. Les versions se nomment (elles ne sont alors plus jamais effacées) ou se suppriment.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  VERSION_KIND_LABELS, deleteVersion, listVersions, renameVersion, type CourseVersion,
} from '../../lib/course/courseVersions';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { Icon } from './courseIcons';

interface Props {
  boardId: string;
  /** Change à chaque nouvelle version (la liste se relit). */
  refreshKey: number;
  previewId: string | null;
  onPreview: (v: CourseVersion) => void;
  onSaveVersion: () => void;
  onClose: () => void;
}

const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Aujourd’hui';
  if (same(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

export function CourseVersionsPanel({ boardId, refreshKey, previewId, onPreview, onSaveVersion, onClose }: Props) {
  const { toast, confirm } = useUIFeedback();
  const [versions, setVersions] = useState<CourseVersion[] | null | undefined>(undefined);
  const [renaming, setRenaming] = useState<string | null>(null);

  const load = useCallback(() => {
    listVersions(boardId)
      .then(setVersions)
      .catch((err: unknown) => { console.warn('[versions]', err); setVersions([]); toast('Historique illisible pour le moment.'); });
  }, [boardId, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const rename = async (v: CourseVersion, label: string) => {
    setRenaming(null);
    if (label.trim() === (v.label ?? '')) return;
    try { await renameVersion(v.id, label); load(); }
    catch { toast('Impossible de renommer cette version.'); }
  };

  const remove = async (v: CourseVersion) => {
    const ok = await confirm({ title: 'Supprimer cette version ?', message: 'Elle disparaîtra de l’historique. Le cours lui-même ne change pas.', confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await deleteVersion(v.id); load(); }
    catch { toast('Impossible de supprimer cette version.'); }
  };

  // Regroupement par jour (la liste arrive triée, la plus récente d'abord)
  const groups: { day: string; items: CourseVersion[] }[] = [];
  for (const v of versions ?? []) {
    const day = dayLabel(new Date(v.created_at));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(v);
    else groups.push({ day, items: [v] });
  }

  return (
    <aside className="ce-versions" aria-label="Historique des versions">
      <header className="ce-versions__head">
        <h2>Historique des versions</h2>
        <button type="button" className="ce-versions__x" onClick={onClose} aria-label="Fermer l’historique" title="Fermer">✕</button>
      </header>
      {versions === null ? (
        <p className="ce-versions__note">L’historique des versions demande la migration 072.</p>
      ) : (
        <>
          <div className="ce-versions__actions">
            <button type="button" className="ce-btn" onClick={onSaveVersion}>Enregistrer une version…</button>
          </div>
          <p className="ce-versions__note">
            Une version est gardée à chaque ouverture et toutes les 10 minutes de travail. Restaurer
            une version ne touche que le texte : les dessins des encarts restent comme ils sont.
          </p>
          {versions === undefined && <p className="ce-versions__note">Chargement…</p>}
          {versions && versions.length === 0 && <p className="ce-versions__note">Pas encore de version : la première sera prise à la prochaine ouverture ou dans quelques minutes.</p>}
          <div className="ce-versions__list">
            {groups.map((g) => (
              <section key={g.day}>
                <h3 className="ce-versions__day">{g.day}</h3>
                {g.items.map((v) => {
                  const at = new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={v.id} className={`ce-version ${previewId === v.id ? 'is-on' : ''}`}>
                      {renaming === v.id ? (
                        <input
                          className="ce-version__input"
                          defaultValue={v.label ?? ''}
                          placeholder="Nom de la version"
                          autoFocus
                          onBlur={(e) => void rename(v, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
                          }}
                        />
                      ) : (
                        <button type="button" className="ce-version__main" onClick={() => onPreview(v)} title="Afficher cette version">
                          <span className="ce-version__time">{at}</span>
                          <span className="ce-version__label">{v.label || VERSION_KIND_LABELS[v.kind]}</span>
                          <span className="ce-version__meta">
                            {v.label && v.kind !== 'manual' ? `${VERSION_KIND_LABELS[v.kind]} · ` : ''}
                            {v.words != null ? `${v.words} mot${v.words > 1 ? 's' : ''}` : ''}
                          </span>
                        </button>
                      )}
                      <div className="ce-version__tools">
                        <button type="button" title="Nommer cette version (elle sera gardée)" aria-label="Nommer" onClick={() => setRenaming(v.id)}><Icon name="rename" size={14} /></button>
                        <button type="button" title="Supprimer cette version" aria-label="Supprimer" onClick={() => void remove(v)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
