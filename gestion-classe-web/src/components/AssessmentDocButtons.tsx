import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { LibraryDocPicker } from './LibraryDocPicker';
import { docxToPdf, isDocx } from '../lib/docConvert';
import { groupDocPath, type AssessmentGroup } from '../lib/assessmentGroups';
import { documentsOf, linkedDocBoardId } from '../lib/assessmentLibrary';
import { levelFromClassName } from '../lib/boardsQueries';
import { courseHref } from '../lib/courseLibrary';
import {
  clearSeriesAssessmentDocs,
  deleteAssessmentDoc,
  deleteSeriesDoc,
  fetchBoardTitles,
  getDocUrl,
  setAssessmentLibraryDoc,
  uploadAssessmentDoc,
  uploadSeriesDoc,
  type AssessmentDocKind,
} from '../lib/evaluationQueries';

/**
 * Sujet et corrigé, dans l'en-tête de la fiche : un bouton qui ouvre le document, et une
 * flèche pour le changer — des gestes rares, qui n'ont pas à occuper une carte entière.
 *
 * Le document est un fichier déposé à la main, ou un cours de Mes cours relié à l'éval
 * (migration 095) : la fiche et la correction de l'activité tiennent lieu de sujet et de
 * corrigé tant qu'aucun fichier n'est ajouté. Sans rien, le bouton propose les deux.
 */
export function AssessmentDocButtons({ group, userId, onReload, onError }: {
  group: AssessmentGroup;
  userId: string;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const linkedSubject = linkedDocBoardId(group.items, 'subject');
  const linkedCorrection = linkedDocBoardId(group.items, 'correction');
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<AssessmentDocKind | null>(null);

  useEffect(() => {
    const ids = [linkedSubject, linkedCorrection].filter((x): x is string => !!x);
    if (ids.length === 0) return;
    let cancelled = false;
    fetchBoardTitles(ids).then((t) => { if (!cancelled) setTitles(t); }, () => {});
    return () => { cancelled = true; };
  }, [linkedSubject, linkedCorrection]);

  /** Retire le fichier ajouté à la main (celui de la série, ou celui de l'éval). */
  const removeFile = async (kind: AssessmentDocKind, path: string) => {
    if (group.seriesId) {
      const series = group.items[0]?.assessment_series ?? null;
      const shared = kind === 'subject' ? series?.subject_path : series?.correction_path;
      if (shared) await deleteSeriesDoc(group.seriesId, kind, shared);
      await clearSeriesAssessmentDocs(group.seriesId, kind);
    } else {
      await deleteAssessmentDoc(group.items[0].id, kind, path);
    }
  };

  const pickLibraryDoc = async (kind: AssessmentDocKind, board: { id: string; documentsId?: string | null }) => {
    const path = groupDocPath(group, kind);
    const label = kind === 'subject' ? 'Le sujet' : 'Le corrigé';
    // Le fichier ajouté à la main passe avant le cours : il est retiré pour laisser la place.
    if (path && !window.confirm(`${label} déposé en fichier sera retiré et remplacé par ce cours de Mes cours. Continuer ?`)) return;
    try {
      if (path) await removeFile(kind, path);
      await setAssessmentLibraryDoc(group.items.map((a) => a.id), kind, board);
      setPicking(null);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Cours non relié');
    }
  };

  const common = { group, userId, onReload, onError, removeFile, onPick: setPicking };

  return (
    <>
      <DocButton kind="subject" linkedId={linkedSubject} linkedTitle={linkedSubject ? titles[linkedSubject] : undefined} {...common} />
      <DocButton kind="correction" linkedId={linkedCorrection} linkedTitle={linkedCorrection ? titles[linkedCorrection] : undefined} {...common} />
      {picking && (
        <LibraryDocPicker
          userId={userId}
          level={levelFromClassName(group.items[0]?.classes?.name ?? '')}
          kind={picking}
          onClose={() => setPicking(null)}
          onPick={(board, g) => pickLibraryDoc(picking, {
            id: board.id,
            // Le sujet emporte les documents de son activité (lus par « Corriger avec Claude »).
            documentsId: picking === 'subject' ? documentsOf(g) : null,
          })}
        />
      )}
    </>
  );
}

function DocButton({ kind, group, userId, linkedId, linkedTitle, onReload, onError, removeFile, onPick }: {
  kind: AssessmentDocKind;
  group: AssessmentGroup;
  userId: string;
  /** Cours de Mes cours relié, utilisé tant qu'aucun fichier n'est déposé. */
  linkedId: string | null;
  linkedTitle: string | undefined;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
  removeFile: (kind: AssessmentDocKind, path: string) => Promise<void>;
  onPick: (kind: AssessmentDocKind) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const path = groupDocPath(group, kind);
  const label = kind === 'subject' ? 'Sujet' : 'Corrigé';
  const lower = label.toLowerCase();

  const openFile = async () => {
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

  const handleDeleteFile = async () => {
    if (!path) return;
    const scope = group.items.length > 1 ? ` pour les ${group.items.length} classes` : '';
    if (!window.confirm(`Supprimer le ${lower}${scope} ?`)) return;
    try {
      await removeFile(kind, path);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la suppression');
    }
  };

  const unlink = async () => {
    const what = kind === 'subject' ? 'la fiche' : 'la correction';
    if (!window.confirm(`Ne plus utiliser ${what} de Mes cours pour cette évaluation ? Le cours lui-même n’est pas touché.`)) return;
    try {
      await setAssessmentLibraryDoc(group.items.map((a) => a.id), kind, null);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Lien non retiré');
    }
  };

  const fileHint = 'PDF ou image. Un document Word : dans Word, Fichier → Enregistrer sous → PDF (la conversion automatique abîme la mise en page)';
  const importFile: MoreMenuItem = { label: 'Importer un fichier…', onClick: () => inputRef.current?.click(), title: fileHint };
  const fromLibrary: MoreMenuItem = { label: 'Choisir dans Mes cours…', onClick: () => onPick(kind) };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,image/*,.docx"
      style={{ display: 'none' }}
      onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }}
    />
  );

  // Rien encore : le bouton propose Mes cours ou un fichier.
  if (!path && !linkedId) {
    return (
      <>
        {input}
        {uploading
          ? <span style={{ ...btn, color: 'var(--text-muted)', cursor: 'default' }}>Envoi…</span>
          : <MoreMenu label={`+ ${label}`} title={`Ajouter le ${lower}`} items={[fromLibrary, importFile]} />}
      </>
    );
  }

  const items: MoreMenuItem[] = path
    ? [
        { ...importFile, label: 'Remplacer par un autre fichier…' },
        { ...fromLibrary, label: 'Remplacer par un cours de Mes cours…' },
        { label: `Supprimer le ${lower}`, onClick: () => { void handleDeleteFile(); }, danger: true },
      ]
    : [
        { ...fromLibrary, label: 'Autre cours de Mes cours…' },
        { ...importFile, label: 'Un fichier à la place…' },
        { label: 'Retirer le lien', onClick: () => { void unlink(); }, danger: true },
      ];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {input}
      {uploading ? (
        <span style={{ ...btn, color: 'var(--text-muted)', cursor: 'default' }}>Envoi…</span>
      ) : path ? (
        <button onClick={openFile} style={btn} title={`Ouvrir le ${lower}`}>{label}</button>
      ) : (
        <Link
          to={courseHref(linkedId!)}
          target="_blank"
          rel="noopener"
          style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}
          title={`${kind === 'subject' ? 'Fiche' : 'Correction'} de Mes cours : « ${linkedTitle ?? '…'} »`}
        >
          {label}
        </Link>
      )}
      <MoreMenu label="▾" compact title={`${label} : changer ou retirer`} items={items} />
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
};
