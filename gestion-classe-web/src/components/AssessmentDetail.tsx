import { useRef, useState } from 'react';
import { CopyViewer } from './CopyViewer';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { ExportCorrectionsDialog, exportableSheets, type ExportableRow } from './ExportCorrectionsDialog';
import { PronoteColumnDialog } from './PronoteColumnDialog';
import { PublishDialog } from './PublishDialog';
import { isApiGrade, mentionsOtherVersion } from '../lib/aiCorrection';
import {
  COPY_RETENTION_DAYS,
  COPY_STAGE_LABEL,
  retentionState,
  type CopyOverview,
  type CopyStage,
} from '../lib/copyStatus';
import { describeKeptCopies } from '../lib/copyTranscript';
import { docxToPdf, isDocx } from '../lib/docConvert';
import {
  describeClassRow,
  formatSession,
  groupDocPath,
  hasCopies,
  hasCopyContent,
  neverScanned,
  pendingDrafts,
  publicationState,
  stageLabel,
  type AssessmentGroup,
} from '../lib/assessmentGroups';
import {
  clearSeriesAssessmentDocs,
  deleteAssessmentDoc,
  deleteSeriesDoc,
  extendCopiesRetention,
  fetchAssessmentGrades,
  fetchAssessmentTranscripts,
  fetchExpectedStudents,
  fetchLatestAiCorrections,
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
}

export function AssessmentDetail({ group, overviews, sessionStarts, userId, openId, onOpen, onError, onReload }: AssessmentDetailProps) {
  const [uploading, setUploading] = useState<AssessmentDocKind | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  /** « Exporter en PDF » : classe et fiches chargées pour la fenêtre d'export. */
  const [exporting, setExporting] = useState<{ assessment: AssessmentRow; rows: ExportableRow[] } | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  /** Publier : la fenêtre « notes et corrections, ou notes seules » de cette classe. */
  const [publishing, setPublishing] = useState<AssessmentRow | null>(null);
  /** Copier pour Pronote : la colonne de cette classe. */
  const [pronoteFor, setPronoteFor] = useState<AssessmentRow | null>(null);
  /** Incrémenté quand une action d'ici change les copies ou les notes : la visionneuse recharge. */
  const [viewerKey, setViewerKey] = useState(0);
  // « Ajouter les copies » sur une classe sans rien encore : ouvre la vue et la fenêtre de la classe.
  const [classAddFor, setClassAddFor] = useState<string | null>(null);
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

  /** Élèves et notes d'une classe, dans l'ordre de la liste : pour l'export PDF et l'avertissement « autre version ». */
  const loadRows = async (a: AssessmentRow): Promise<ExportableRow[]> => {
    const [roster, grades, transcripts] = await Promise.all([
      fetchExpectedStudents([a]), fetchAssessmentGrades(a.id), fetchAssessmentTranscripts(a.id),
    ]);
    const gradeBy = new Map(grades.map((g) => [g.student_id, g]));
    return (roster[a.id] ?? []).map((student) => ({ student, grade: gradeBy.get(student.id) ?? null, transcript: transcripts[student.id] }));
  };

  // Valider la classe = tous les brouillons du Correcteur deviennent visibles à la publication.
  const handleValidateClass = async (a: AssessmentRow) => {
    const n = pendingDrafts(overviews[a.id]);
    const cls = a.classes?.name ?? 'cette classe';
    setValidating(a.id);
    try {
      // Claude a signalé une copie faite sur une autre version du sujet : sa note vient d'un
      // autre barème, on le dit avant de valider en bloc (même garde-fou que par élève).
      const [rows, runs] = await Promise.all([loadRows(a), fetchLatestAiCorrections(a.id)]);
      const flagged = rows.filter((r) => {
        const run = runs[r.student.id];
        return r.grade && !r.grade.is_validated && run?.status === 'done' && isApiGrade(r.grade.details) && mentionsOtherVersion(run.a_arbitrer);
      });
      const warning = flagged.length
        ? `\n\n⚠ Dont ${flagged.map((r) => r.student.pseudo).join(', ')} : Claude signale une copie faite sur une autre version du sujet.`
        : '';
      if (!window.confirm(`Valider les ${n} note${n > 1 ? 's' : ''} en brouillon de ${cls} ?${warning}`)) return;
      await validateAllGrades(a.id);
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la validation');
    } finally {
      setValidating(null);
    }
  };

  // Exporter en PDF = les fiches de correction de la classe à imprimer (récapitulatif + une par élève).
  const handleExport = async (a: AssessmentRow) => {
    setExportLoading(a.id);
    try {
      const rows = await loadRows(a);
      if (exportableSheets(rows).length === 0) {
        onError(`Aucune correction détaillée pour ${a.classes?.name ?? 'cette classe'} : rien à exporter.`);
        return;
      }
      setExporting({ assessment: a, rows });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExportLoading(null);
    }
  };

  // Publier = l'élève voit ses notes VALIDÉES (un brouillon reste caché, migration 053), avec
  // ou sans les corrections (migration 064) : la fenêtre PublishDialog fait choisir.
  const publish = async (a: AssessmentRow, withCorrections: boolean) => {
    try {
      await updateAssessment(a.id, {
        publishedToStudents: true,
        ...(withCorrections ? (a.corrections_withheld ? { correctionsWithheld: false } : {}) : { correctionsWithheld: true }),
      });
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Publication impossible');
    }
  };

  /** Second temps : les corrections retenues deviennent visibles, ou l'inverse. */
  const setCorrections = async (a: AssessmentRow, visible: boolean) => {
    const cls = a.classes?.name ?? 'cette classe';
    const message = visible
      ? `Publier les corrections de « ${a.name} » pour ${cls} ? Les élèves verront le détail, le commentaire, le corrigé et leur copie corrigée.`
      : `Retenir les corrections de « ${a.name} » pour ${cls} ? Les élèves garderont leur note, sans le détail, le commentaire, le corrigé ni leur copie corrigée.`;
    if (!window.confirm(message)) return;
    try {
      await updateAssessment(a.id, { correctionsWithheld: !visible });
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Publication impossible');
    }
  };

  const unpublish = async (a: AssessmentRow) => {
    const cls = a.classes?.name ?? 'cette classe';
    if (!window.confirm(`Retirer « ${a.name} » de l’espace élève de ${cls} ? Les élèves ne verront plus leur note.`)) return;
    try {
      // Republier repartira de « tout » : on ne garde pas une retenue oubliée.
      await updateAssessment(a.id, { publishedToStudents: false, ...(a.corrections_withheld ? { correctionsWithheld: false } : {}) });
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Publication impossible');
    }
  };

  const withCopies = group.items.some(hasCopies);
  /** Des copies sont passées par le scan quelque part dans la série : la chaîne « copies » s'applique. */
  const anyScanned = group.items.some((a) => overviews[a.id] && !neverScanned(overviews[a.id]));
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
              : group.items.some((a) => a.kind === 'groupe')
                ? 'notation en séance, par groupe et sur critères (détail plus bas) → publier'
                : 'saisie dans le carnet, ou note d’une production numérique (section Activité plus bas) → publier'}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {group.items.map((a) => {
              const o = overviews[a.id];
              const on = openId === a.id;
              const drafts = pendingDrafts(o);
              const r = o ? retentionState(a, o.pages) : null;
              const pub = publicationState(a);
              // Une seule action principale par ligne, celle de l'étape en cours ; le reste passe dans « ⋯ ».
              // Toutes les lignes gardent ainsi la même forme : Voir · action · ⋯.
              const canAddCopies = !!o && hasCopies(a) && o.scanned === 0 && o.transcribed === 0 && !a.copies_purged_at;
              const addCopies = {
                label: 'Ajouter les copies',
                onClick: () => { setClassAddFor(a.id); onOpen(a.id); },
                title: 'Le PDF du photocopieur ou les photos de toutes les copies, découpés et attribués dans l’ordre de la liste',
              };
              // Déjà des notes sans scan (saisies au carnet) : la suite logique est de publier, pas d'ajouter des copies.
              const addFirst = canAddCopies && o!.graded + o!.absent === 0;
              const primary: { label: string; onClick: () => void; title: string; busy?: boolean } | null =
                addFirst
                  ? addCopies
                  : drafts > 0
                    ? { label: validating === a.id ? 'Validation…' : `Valider (${drafts})`, onClick: () => handleValidateClass(a), busy: validating === a.id, title: 'Les brouillons du Correcteur deviennent des notes validées, visibles à la publication' }
                    : pub === 'none'
                      ? { label: 'Publier…', onClick: () => setPublishing(a), title: 'Rendre visible dans l’espace élève : les notes, avec ou sans les corrections' }
                      : pub === 'notes'
                        ? { label: 'Publier les corrections', onClick: () => setCorrections(a, true), title: 'Le détail, le commentaire, le corrigé et la copie corrigée deviennent visibles' }
                        : null;
              const menu: MoreMenuItem[] = [];
              if (canAddCopies && !addFirst) menu.push(addCopies);
              if (pub === 'none' && (addFirst || drafts > 0)) {
                menu.push({ label: 'Publier…', onClick: () => setPublishing(a), title: 'Rendre visible dans l’espace élève : les notes, avec ou sans les corrections' });
              }
              if (o && o.graded > 0 && hasCopies(a)) {
                menu.push({
                  label: exportLoading === a.id ? 'Préparation…' : 'Exporter…',
                  onClick: () => handleExport(a),
                  disabled: exportLoading === a.id,
                  title: 'Fiches de correction : PDF à imprimer, Word modifiable, ou Markdown sans nom pour Claude',
                });
              }
              if (o && o.graded + o.absent > 0) {
                menu.push({ label: 'Copier pour Pronote', onClick: () => setPronoteFor(a), title: 'La colonne des notes, dans l’ordre de la liste Pronote' });
              }
              if (pub === 'all') menu.push({ label: 'Retenir les corrections', onClick: () => setCorrections(a, false), title: 'Les élèves gardent leur note, sans le détail ni le corrigé' });
              if (r?.kind === 'scheduled') menu.push({ label: `Garder les scans ${COPY_RETENTION_DAYS} j de plus`, onClick: () => handleExtend(a), title: 'En cas de contestation' });
              if (r?.kind === 'scheduled' || r?.kind === 'kept') menu.push({ label: 'Supprimer les scans maintenant', onClick: () => handlePurgeNow(a), danger: true });
              if (pub !== 'none') menu.push({ label: 'Dépublier', onClick: () => unpublish(a), title: 'Retirer de l’espace élève' });
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
                    {o ? describeClassRow(o, hasCopies(a)) : '…'}
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
                    {pub === 'notes' && (
                      <div style={{ fontSize: 11.5, marginTop: 3, color: 'var(--warn)' }}>
                        Notes publiées · corrections retenues
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', width: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        onClick={() => onOpen(on ? null : a.id)}
                        disabled={!hasCopyContent(o)}
                        style={{ ...btnGhost, ...rowBtn, opacity: hasCopyContent(o) ? 1 : 0.5 }}
                      >
                        {on ? 'Fermer' : o && o.scanned === 0 && o.transcribed === 0 ? 'Voir les notes' : 'Voir les copies'}
                      </button>
                      {primary ? (
                        <button onClick={primary.onClick} disabled={primary.busy} style={{ ...btnPrimary, ...rowBtn, width: 168 }} title={primary.title}>
                          {primary.label}
                        </button>
                      ) : (
                        <span style={{ ...rowBtn, width: 168, color: 'var(--pos)', fontWeight: 700, textAlign: 'center' }} title="Notes et corrections visibles dans l’espace élève">
                          ✓ Publiée
                        </span>
                      )}
                      <span style={{ width: 30, display: 'inline-flex', justifyContent: 'center' }}>
                        {menu.length > 0 && <MoreMenu items={menu} compact title="Plus d’actions : export, Pronote, scans, dépublier" />}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {withCopies && !anyScanned && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Aucune copie scannée pour cette éval. Les copies se scannent au téléphone, en séance (bouton « Copies »),
            ou s’ajoutent ici, élève par élève (« Ajouter une copie ») ou pour toute la classe d’un coup (« Ajouter les copies de la classe »).
          </div>
        )}
        {target && (
          <div style={{ marginTop: 16 }}>
            <CopyViewer
              assessment={target}
              onError={onError}
              onChanged={onReload}
              refreshKey={viewerKey}
              openClassAdd={classAddFor === target.id}
              onClassAddClosed={() => setClassAddFor(null)}
            />
          </div>
        )}
      </div>
      {publishing && (
        <PublishDialog
          assessment={publishing}
          drafts={pendingDrafts(overviews[publishing.id])}
          onClose={() => setPublishing(null)}
          onConfirm={(withCorrections) => publish(publishing, withCorrections)}
        />
      )}
      {pronoteFor && <PronoteColumnDialog assessment={pronoteFor} onClose={() => setPronoteFor(null)} />}
      {exporting && (
        <ExportCorrectionsDialog assessment={exporting.assessment} rows={exporting.rows} onClose={() => setExporting(null)} />
      )}
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
/** Boutons d'une ligne de classe : largeur fixe pour que les colonnes s'alignent d'une classe à l'autre. */
const rowBtn: React.CSSProperties = { padding: '4px 10px', fontSize: 12, width: 120, boxSizing: 'border-box', display: 'inline-block' };
