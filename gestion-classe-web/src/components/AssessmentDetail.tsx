import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyViewer } from './CopyViewer';
import {
  COPY_RETENTION_DAYS,
  COPY_STAGE_LABEL,
  describeCopyOverview,
  retentionState,
  type CopyOverview,
  type CopyStage,
} from '../lib/copyStatus';
import { describeKeptCopies } from '../lib/copyTranscript';
import { docxToPdf, isDocx } from '../lib/docConvert';
import {
  formatSession,
  groupDocPath,
  hasCopies,
  hasCopyContent,
  pendingDrafts,
  stageLabel,
  type AssessmentGroup,
} from '../lib/assessmentGroups';
import {
  clearSeriesAssessmentDocs,
  deleteAssessmentDoc,
  deleteSeriesDoc,
  extendCopiesRetention,
  getDocUrl,
  purgeCopiesNow,
  updateAssessment,
  uploadAssessmentDoc,
  uploadSeriesDoc,
  validateAllGrades,
  type AssessmentDocKind,
  type AssessmentRow,
} from '../lib/evaluationQueries';

/**
 * Le corps d'une évaluation, commun à la fiche (/evaluations/:id) et à l'onglet Éval :
 * sujet et corrigé, puis une ligne par classe avec l'état des copies et les trois gestes
 * qui s'enchaînent — voir les copies, valider la classe, publier — et la visionneuse de la
 * classe ouverte. La rétention des scans est dans un menu ⋯ : elle sert une fois par trimestre.
 */

const STAGE_COLORS: Record<CopyStage, [string, string]> = {
  vide: ['var(--surface-3)', 'var(--text-dim)'],
  scan: ['var(--warn-soft)', 'var(--warn)'],
  scannee: ['var(--indigo-soft)', 'var(--indigo)'],
  corrigee: ['var(--warn-soft)', 'var(--warn)'],
  validee: ['var(--pos-soft)', 'var(--pos)'],
  publiee: ['var(--pos)', '#fff'],
};

/** Pastille d'étape : avec l'état complet elle dit quoi faire (« À valider (3) »). */
export function StageChip({ stage, overview, title }: { stage: CopyStage; overview?: CopyOverview; title?: string }) {
  const [bg, fg] = STAGE_COLORS[stage];
  return (
    <span title={title} style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>
      {overview ? stageLabel(overview) : COPY_STAGE_LABEL[stage]}
    </span>
  );
}

/** Petit menu ⋯ : les actions rares d'une ligne, hors de vue tant qu'on ne les cherche pas. */
function RowMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; title?: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...btnGhost, padding: '4px 8px', fontSize: 12 }} title="Scans : conserver ou supprimer" aria-haspopup="menu" aria-expanded={open}>
        ⋯
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-2)', zIndex: 20, padding: 4 }}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => { setOpen(false); it.onClick(); }}
              title={it.title}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, borderRadius: 6, color: it.danger ? 'var(--neg)' : 'var(--text)' }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface AssessmentDetailProps {
  group: AssessmentGroup;
  overviews: Record<string, CopyOverview>;
  sessionStarts: Record<string, string>;
  userId: string;
  /** Classe (ligne d'éval) dont la visionneuse est ouverte. */
  openId: string | null;
  onOpen: (assessmentId: string | null) => void;
  onError: (message: string) => void;
  /** Recharge les évals et leur état (après un fichier déposé, une validation, une publication). */
  onReload: () => Promise<void>;
  /** Dans l'onglet Éval : lien vers la fiche complète. */
  sheetLink?: boolean;
}

export function AssessmentDetail({ group, overviews, sessionStarts, userId, openId, onOpen, onError, onReload, sheetLink }: AssessmentDetailProps) {
  const [uploading, setUploading] = useState<AssessmentDocKind | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  /** Incrémenté quand une action d'ici change les copies ou les notes : la visionneuse recharge. */
  const [viewerKey, setViewerKey] = useState(0);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  const reloadAll = async () => {
    await onReload();
    setViewerKey((k) => k + 1);
  };

  const openDoc = async (path: string) => {
    const url = await getDocUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  const handleFile = async (kind: AssessmentDocKind, file: File | undefined) => {
    if (!file) return;

    // Le stockage ne contient que des PDF ou des images : l'élève comme le prof ouvrent
    // toujours un format lisible sans Word. Un .docx doit donc être converti — mais la
    // conversion faite dans le navigateur (mammoth + jsPDF) ne garde que la STRUCTURE du
    // document : colonnes, zones de texte et position des images sont perdues. Word, lui,
    // exporte un PDF parfait en un clic. On le dit, plutôt que de rendre une fiche illisible.
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

    setUploading(kind);
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
      setUploading(null);
    }
  };

  const handleDeleteDoc = async (kind: AssessmentDocKind) => {
    const path = groupDocPath(group, kind);
    if (!path) return;
    const label = kind === 'subject' ? 'le sujet' : 'le corrigé';
    const scope = group.items.length > 1 ? ` pour les ${group.items.length} classes` : '';
    if (!window.confirm(`Supprimer ${label}${scope} ?`)) return;
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

  // Scans : supprimés automatiquement 30 j après la publication (migration 054). Le prof peut
  // les garder plus longtemps (contestation) ou les supprimer tout de suite.
  const handleExtend = async (a: AssessmentRow) => {
    try {
      await extendCopiesRetention(a);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Prolongation impossible');
    }
  };

  const handlePurgeNow = async (a: AssessmentRow) => {
    const cls = a.classes?.name ?? 'cette classe';
    // Une copie sans transcription garde ses scans (migration 056) : on le dit avant.
    const untranscribed = overviews[a.id]?.untranscribed ?? 0;
    const keptNote = untranscribed > 0
      ? `\n\n${untranscribed > 1 ? `${untranscribed} copies n’ont` : '1 copie n’a'} pas de transcription : leurs scans seront conservés.`
      : '';
    if (!window.confirm(`Supprimer définitivement les scans de « ${a.name} » (${cls}) ?\n\nLes notes, leur détail et les transcriptions restent.${keptNote}`)) return;
    try {
      const { kept } = await purgeCopiesNow(a.id);
      if (openId === a.id && kept === 0) onOpen(null);
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  // Valider la classe = tous les brouillons du Correcteur deviennent visibles à la publication.
  const handleValidateClass = async (a: AssessmentRow) => {
    const n = pendingDrafts(overviews[a.id]);
    const cls = a.classes?.name ?? 'cette classe';
    if (!window.confirm(`Valider les ${n} note${n > 1 ? 's' : ''} en brouillon de ${cls} ?`)) return;
    setValidating(a.id);
    try {
      await validateAllGrades(a.id);
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la validation');
    } finally {
      setValidating(null);
    }
  };

  // Publier = l'élève voit ses notes VALIDÉES, le sujet et le corrigé. Un brouillon reste caché
  // même après publication (migration 053) : on le dit avant, plutôt que de laisser croire
  // que toute la classe a sa note.
  const togglePublish = async (a: AssessmentRow) => {
    const pending = pendingDrafts(overviews[a.id]);
    const cls = a.classes?.name ?? 'cette classe';
    const message = a.published_to_students
      ? `Retirer « ${a.name} » de l’espace élève de ${cls} ? Les élèves ne verront plus leur note.`
      : pending > 0
        ? `${pending} note${pending > 1 ? 's sont' : ' est'} encore en brouillon : ${pending > 1 ? 'ces élèves ne verront pas leur note' : 'cet élève ne verra pas sa note'} tant qu’elle n’est pas validée.

Publier quand même pour ${cls} ?`
        : `Publier « ${a.name} » pour ${cls} ? Les élèves verront leur note, son détail, le sujet et le corrigé.`;
    if (!window.confirm(message)) return;
    try {
      await updateAssessment(a.id, { publishedToStudents: !a.published_to_students });
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Publication impossible');
    }
  };

  const withCopies = group.items.some(hasCopies);
  const target = group.items.find((a) => a.id === openId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sujet & corrigé */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {(['subject', 'correction'] as AssessmentDocKind[]).map((kind) => {
          const path = groupDocPath(group, kind);
          const label = kind === 'subject' ? 'Sujet' : 'Corrigé';
          const inputRef = kind === 'subject' ? subjectInputRef : correctionInputRef;
          return (
            <div key={kind} style={card}>
              <div style={cardTitle}>{label}</div>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/*,.docx"
                style={{ display: 'none' }}
                onChange={(e) => { void handleFile(kind, e.target.files?.[0]); e.target.value = ''; }}
              />
              {path ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => openDoc(path)} style={btnPrimary}>Ouvrir</button>
                  <button onClick={() => inputRef.current?.click()} style={btnGhost} disabled={uploading === kind}>
                    {uploading === kind ? '…' : 'Remplacer'}
                  </button>
                  <button onClick={() => handleDeleteDoc(kind)} style={btnDanger}>Supprimer</button>
                </div>
              ) : (
                <>
                  <button onClick={() => inputRef.current?.click()} style={btnPrimary} disabled={uploading === kind}>
                    {uploading === kind ? 'Envoi…' : `+ Ajouter le ${label.toLowerCase()} (PDF ou image)`}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
                    Document Word : dans Word, <strong>Fichier → Enregistrer sous → PDF</strong>.
                    La conversion automatique d’un .docx abîme la mise en page.
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Copies et notes : une ligne par classe, puis la visionneuse de la classe ouverte */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={cardTitle}>{withCopies ? 'Copies et notes' : 'Notes'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            {withCopies
              ? 'scan au téléphone → correction sur le PC (Correcteur) → valider → publier'
              : 'saisie dans le carnet (ou envoi depuis Productions) → publier'}
          </div>
          {sheetLink && group.items[0] && (
            <Link to={`/evaluations/${group.items[0].id}`} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--indigo)', fontWeight: 600 }}>
              Fiche complète ↗
            </Link>
          )}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {group.items.map((a) => {
              const o = overviews[a.id];
              const on = openId === a.id;
              const drafts = pendingDrafts(o);
              const r = o ? retentionState(a, o.pages) : null;
              const menu: { label: string; onClick: () => void; danger?: boolean; title?: string }[] = [];
              if (r?.kind === 'scheduled') menu.push({ label: `Garder les scans ${COPY_RETENTION_DAYS} j de plus`, onClick: () => handleExtend(a), title: 'En cas de contestation' });
              if (r?.kind === 'scheduled' || r?.kind === 'kept') menu.push({ label: 'Supprimer les scans maintenant', onClick: () => handlePurgeNow(a), danger: true });
              return (
                <tr key={a.id} style={{ borderTop: '1px solid var(--border)', background: on ? 'var(--indigo-soft)' : undefined }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {a.classes?.name ?? '—'}
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {sessionStarts[a.id] ? `séance du ${formatSession(sessionStarts[a.id])}` : a.date ? formatSession(a.date) : ''}
                  </td>
                  <td style={{ padding: '8px 6px' }}>{o && <StageChip stage={o.stage} overview={o} />}</td>
                  <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>
                    {o ? (hasCopies(a) ? describeCopyOverview(o) : `${o.graded}/${o.total} notée${o.graded > 1 ? 's' : ''}`) : '…'}
                    {o && r && r.kind !== 'none' && (
                      <div style={{ fontSize: 11.5, marginTop: 3, color: r.kind === 'scheduled' && r.days <= 7 ? 'var(--warn)' : 'var(--text-dim)' }}>
                        {r.kind === 'kept' && 'Scans conservés tant que l’éval n’est pas publiée'}
                        {r.kind === 'scheduled' && (r.days <= 0
                          ? (o.untranscribed > 0 ? describeKeptCopies(o.untranscribed) : 'Scans supprimés cette nuit')
                          : `Scans supprimés le ${formatSession(r.at)} (dans ${r.days} j)`)}
                        {r.kind === 'scheduled' && r.days > 0 && o.untranscribed > 0 && ` · ${describeKeptCopies(o.untranscribed)}`}
                        {r.kind === 'purged' && `Scans supprimés le ${formatSession(r.at)}`}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => onOpen(on ? null : a.id)}
                      disabled={!hasCopyContent(o)}
                      style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, opacity: hasCopyContent(o) ? 1 : 0.5 }}
                    >
                      {on ? 'Fermer' : o && o.scanned === 0 && o.transcribed === 0 ? 'Voir les notes' : 'Voir les copies'}
                    </button>
                    {drafts > 0 && (
                      <button
                        onClick={() => handleValidateClass(a)}
                        disabled={validating === a.id}
                        style={{ ...btnPrimary, padding: '4px 10px', fontSize: 12, marginLeft: 6 }}
                        title="Les brouillons du Correcteur deviennent des notes validées, visibles à la publication"
                      >
                        {validating === a.id ? 'Validation…' : `Valider la classe (${drafts})`}
                      </button>
                    )}
                    <button
                      onClick={() => togglePublish(a)}
                      style={{
                        ...(a.published_to_students || drafts > 0 ? btnGhost : btnPrimary),
                        padding: '4px 10px', fontSize: 12, marginLeft: 6,
                      }}
                      title={a.published_to_students ? 'Visible dans l’espace élève' : 'Rendre visible dans l’espace élève (notes validées, sujet et corrigé)'}
                    >
                      {a.published_to_students ? 'Dépublier' : 'Publier'}
                    </button>
                    <RowMenu items={menu} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {withCopies && group.items.every((a) => !hasCopyContent(overviews[a.id])) && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Les copies se scannent au téléphone, en séance : bouton « Copies ».
          </div>
        )}
        {target && (
          <div style={{ marginTop: 16 }}>
            <CopyViewer assessment={target} onError={onError} onChanged={onReload} refreshKey={viewerKey} />
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)' };
const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
const btnDanger: React.CSSProperties = { ...btnBase, background: 'var(--neg-soft)', color: 'var(--neg)' };
