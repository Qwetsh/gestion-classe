import { useRef, useState } from 'react';
import { MoreMenu } from './MoreMenu';
import { docxToPdf, isDocx } from '../lib/docConvert';
import { groupDocPath, type AssessmentGroup } from '../lib/assessmentGroups';
import {
  clearSeriesAssessmentDocs,
  deleteAssessmentDoc,
  deleteSeriesDoc,
  getDocUrl,
  uploadAssessmentDoc,
  uploadSeriesDoc,
  type AssessmentDocKind,
} from '../lib/evaluationQueries';

/**
 * Sujet et corrigé, dans l'en-tête de la fiche : un bouton qui ouvre le fichier, et une
 * flèche pour le remplacer ou le supprimer — des gestes rares, qui n'ont pas à occuper
 * une carte entière. Sans fichier, le bouton propose de l'ajouter.
 */
export function AssessmentDocButtons({ group, userId, onReload, onError }: {
  group: AssessmentGroup;
  userId: string;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <>
      <DocButton kind="subject" group={group} userId={userId} onReload={onReload} onError={onError} />
      <DocButton kind="correction" group={group} userId={userId} onReload={onReload} onError={onError} />
    </>
  );
}

function DocButton({ kind, group, userId, onReload, onError }: {
  kind: AssessmentDocKind;
  group: AssessmentGroup;
  userId: string;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const path = groupDocPath(group, kind);
  const label = kind === 'subject' ? 'Sujet' : 'Corrigé';

  const open = async () => {
    if (!path) return;
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    // Le stockage ne contient que des PDF ou des images : l'élève comme le prof ouvrent
    // toujours un format lisible sans Word. La conversion d'un .docx dans le navigateur ne
    // garde que la structure du document (colonnes, zones de texte, images déplacées) :
    // Word exporte un PDF parfait en un clic, on le dit avant de convertir.
    if (isDocx(file.name)) {
      const ok = window.confirm(
        [
          `« ${file.name} » est un document Word.`,
          'La conversion automatique ne respecte pas la mise en page : colonnes, zones de '
            + 'texte et placement des images seront approximatifs.',
          'Le mieux : dans Word, Fichier → Enregistrer sous → PDF, puis déposer ce PDF ici.',
          'OK : convertir quand même · Annuler : je dépose un PDF.',
        ].join('\n\n'),
      );
      if (!ok) return;
    }
    setUploading(true);
    try {
      const toUpload = isDocx(file.name) ? await docxToPdf(file) : file;
      if (group.seriesId) {
        // Un seul fichier pour toutes les classes de la série, et on efface les copies
        // propres qui le masqueraient (cf. effectiveDocPath).
        const series = group.items[0]?.assessment_series ?? null;
        const prev = kind === 'subject' ? series?.subject_path ?? null : series?.correction_path ?? null;
        await uploadSeriesDoc(userId, group.seriesId, kind, toUpload, prev);
        await clearSeriesAssessmentDocs(group.seriesId, kind);
      } else {
        const a = group.items[0];
        const prev = kind === 'subject' ? a.subject_path : a.correction_path;
        await uploadAssessmentDoc(userId, a.id, kind, toUpload, prev);
      }
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!path) return;
    const what = kind === 'subject' ? 'le sujet' : 'le corrigé';
    const scope = group.items.length > 1 ? ` pour les ${group.items.length} classes` : '';
    if (!window.confirm(`Supprimer ${what}${scope} ?`)) return;
    try {
      if (group.seriesId) {
        const series = group.items[0]?.assessment_series ?? null;
        const shared = kind === 'subject' ? series?.subject_path : series?.correction_path;
        if (shared) await deleteSeriesDoc(group.seriesId, kind, shared);
        await clearSeriesAssessmentDocs(group.seriesId, kind);
      } else {
        await deleteAssessmentDoc(group.items[0].id, kind, path);
      }
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la suppression');
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*,.docx"
        style={{ display: 'none' }}
        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />
      {path ? (
        <>
          <button onClick={open} style={btn} title={`Ouvrir le ${label.toLowerCase()}`} disabled={uploading}>
            {uploading ? 'Envoi…' : label}
          </button>
          <MoreMenu
            label="▾"
            compact
            title={`${label} : remplacer ou supprimer`}
            items={[
              { label: `Remplacer le ${label.toLowerCase()}…`, onClick: () => inputRef.current?.click(), title: 'PDF ou image. Un document Word : dans Word, Fichier → Enregistrer sous → PDF' },
              { label: `Supprimer le ${label.toLowerCase()}`, onClick: () => { void handleDelete(); }, danger: true },
            ]}
          />
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          style={{ ...btn, color: 'var(--text-muted)', borderStyle: 'dashed' }}
          disabled={uploading}
          title="PDF ou image. Un document Word : dans Word, Fichier → Enregistrer sous → PDF (la conversion automatique abîme la mise en page)"
        >
          {uploading ? 'Envoi…' : `+ ${label}`}
        </button>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
};
