/**
 * Fichiers d'une séquence, sous ses cours (lot F1 de PLAN_mes_cours.md) : un clic ouvre le fichier
 * dans la visionneuse, le menu « ⋯ » porte Télécharger, Renommer, Supprimer.
 */
import { useState } from 'react';
import { Image as ImageIcon, Music, Paperclip } from 'lucide-react';
import { courseFileKind, formatBytes, type CourseFile } from '../../lib/courseFiles';
import { MoreMenu } from '../MoreMenu';

interface Props {
  files: CourseFile[];
  /** Un envoi est en cours dans cette séquence. */
  uploading: boolean;
  onOpen: (file: CourseFile) => void;
  onDownload: (file: CourseFile) => void;
  onRename: (file: CourseFile, name: string) => Promise<void>;
  onDelete: (file: CourseFile) => void;
}

function FileIcon({ name }: { name: string }) {
  const kind = courseFileKind(name);
  if (kind === 'audio') return <Music size={16} className="mc-row__icon" aria-label="Son" />;
  if (kind === 'image') return <ImageIcon size={16} className="mc-row__icon" aria-label="Image" />;
  return <Paperclip size={16} className="mc-row__icon" aria-label="Fichier" />;
}

export function SequenceFiles({ files, uploading, onOpen, onDownload, onRename, onDelete }: Props) {
  /** Fichier en cours de renommage et sa saisie. */
  const [renaming, setRenaming] = useState<{ id: string; value: string; busy: boolean } | null>(null);

  if (files.length === 0 && !uploading) return null;

  const commit = async (file: CourseFile) => {
    if (!renaming || renaming.busy) return;
    const typed = renaming.value.trim();
    if (!typed || typed === file.name) { setRenaming(null); return; }
    setRenaming({ ...renaming, busy: true });
    try { await onRename(file, typed); }
    finally { setRenaming(null); }
  };

  return (
    <ul className="mc-rows mc-files" aria-label="Fichiers de la séquence">
      {files.map((file) => (
        <li key={file.id} className="mc-row mc-row--file">
          {renaming?.id === file.id ? (
            <input
              className="mc-seq__input mc-file__input"
              value={renaming.value}
              autoFocus
              disabled={renaming.busy}
              aria-label={`Nouveau nom de ${file.name}`}
              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
              onBlur={() => void commit(file)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void commit(file); }
                if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
              }}
            />
          ) : (
            <button type="button" className="mc-row__open" onClick={() => onOpen(file)} title="Ouvrir le fichier">
              <FileIcon name={file.name} />
              <span className="mc-row__title">{file.name}</span>
              <span className="mc-file__size">{formatBytes(file.size)}</span>
            </button>
          )}
          <MoreMenu
            compact
            title={`Actions de ${file.name}`}
            items={[
              { label: 'Télécharger', onClick: () => onDownload(file) },
              { label: 'Renommer', onClick: () => setRenaming({ id: file.id, value: file.name, busy: false }) },
              { label: 'Supprimer', onClick: () => onDelete(file), danger: true },
            ]}
          />
        </li>
      ))}
      {uploading && <li className="mc-row mc-row--file mc-file__busy">Envoi en cours…</li>}
    </ul>
  );
}
