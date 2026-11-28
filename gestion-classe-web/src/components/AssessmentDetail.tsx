import { useEffect, useRef, useState } from 'react';
import { CopyViewer } from './CopyViewer';
import type { MoreMenuItem } from './MoreMenu';
import { ExportCorrectionsDialog, exportableSheets, type ExportableRow } from './ExportCorrectionsDialog';
import { PronoteColumnDialog } from './PronoteColumnDialog';
import { PublishDialog } from './PublishDialog';
import { AssessmentStatsBody } from './AssessmentStatsPanel';
import { SeriesOverview, StatsStrip } from './AssessmentOverview';
import type { ClassGradeSummary } from '../lib/seriesSummary';
import { isApiGrade, mentionsOtherVersion } from '../lib/aiCorrection';
import {
  COPY_RETENTION_DAYS,
  COPY_STAGE_LABEL,
  retentionState,
  type CopyOverview,
  type CopyStage,
} from '../lib/copyStatus';
import { describeKeptCopies } from '../lib/copyTranscript';
import {
  describeClassRow,
  formatSession,
  hasCopies,
  hasCopyContent,
  neverScanned,
  pendingDrafts,
  publicationState,
  stageLabel,
  type AssessmentGroup,
} from '../lib/assessmentGroups';
import { formatGrade, type GradeEntry, type GradeStats } from '../lib/gradeStats';
import {
  extendCopiesRetention,
  fetchAssessmentGrades,
  fetchAssessmentTranscripts,
  fetchExpectedStudents,
  fetchLatestAiCorrections,
  purgeCopiesNow,
  updateAssessment,
  validateAllGrades,
  type AssessmentRow,
} from '../lib/evaluationQueries';

/**
 * Le corps de la fiche d'une évaluation (/evaluations/:id) : un onglet par classe — et, pour
 * une série, un onglet « Ensemble » qui compare les classes — puis, pour la classe choisie,
 * une ligne de statistiques et la visionneuse des copies.
 *
 * Principe : à l'écran, seulement ce qui demande une action. L'état d'une classe se lit à la
 * pastille de son onglet ; le détail (copies scannées, manquantes, rétention des scans) et les
 * actions rares sont dans le menu de la classe. Seule l'action de l'étape en cours (Valider,
 * Publier…) reste visible, à côté de ce menu.
 */

export const ALL_CLASSES = 'all';

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

type Tone = 'done' | 'todo' | 'empty';
const TONE_COLOR: Record<Tone, string> = { done: 'var(--pos)', todo: 'var(--warn)', empty: 'var(--border-strong)' };

/** La pastille d'un onglet : publiée, en cours, ou rien encore — et son libellé au survol. */
function classTone(a: AssessmentRow, o: CopyOverview | undefined): { tone: Tone; label: string } {
  const pub = publicationState(a);
  if (pub === 'all') return { tone: 'done', label: 'Publiée' };
  if (pub === 'notes') return { tone: 'done', label: 'Notes publiées, corrections retenues' };
  if (!hasCopyContent(o)) return { tone: 'empty', label: hasCopies(a) ? 'Pas encore de copie' : 'Pas encore de note' };
  if (o!.stage === 'validee') return { tone: 'todo', label: 'À publier' };
  return { tone: 'todo', label: stageLabel(o!) };
}

export interface SeriesSummary {
  classes: ClassGradeSummary[];
  level: GradeStats | null;
  total: number;
  loading: boolean;
  error: string | null;
}

interface AssessmentDetailProps {
  group: AssessmentGroup;
  overviews: Record<string, CopyOverview>;
  sessionStarts: Record<string, string>;
  userId: string;
  /** L'éval de la classe affichée, ou `ALL_CLASSES` pour l'onglet Ensemble. */
  selected: string;
  onSelect: (key: string) => void;
  /** Moyenne de chaque classe (par id d'éval), pour les onglets. */
  classMeans: Record<string, number | null>;
  /** Statistiques de la classe affichée, une fois ses notes chargées. */
  focusStats: { stats: GradeStats; entries: GradeEntry[] } | null;
  /** Comparaison des classes d'une série (onglet Ensemble). */
  series: SeriesSummary | null;
  onError: (message: string) => void;
  /** Recharge les évals et leur état (après une validation, une publication, des copies ajoutées). */
  onReload: () => Promise<void>;
}

export function AssessmentDetail({
  group, overviews, sessionStarts, userId, selected, onSelect, classMeans, focusStats, series, onError, onReload,
}: AssessmentDetailProps) {
  const [validating, setValidating] = useState<string | null>(null);
  /** « Exporter » : classe et fiches chargées pour la fenêtre d'export. */
  const [exporting, setExporting] = useState<{ assessment: AssessmentRow; rows: ExportableRow[] } | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  /** Publier : la fenêtre « notes et corrections, ou notes seules » de cette classe. */
  const [publishing, setPublishing] = useState<AssessmentRow | null>(null);
  /** Copier pour Pronote : la colonne de cette classe. */
  const [pronoteFor, setPronoteFor] = useState<AssessmentRow | null>(null);
  /** Incrémenté quand une action d'ici change les copies ou les notes : la visionneuse recharge. */
  const [viewerKey, setViewerKey] = useState(0);
  /** « Ajouter les copies de la classe » : ouvre la visionneuse et sa fenêtre d'ajout. */
  const [classAddFor, setClassAddFor] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const reloadAll = async () => {
    await onReload();
    setViewerKey((k) => k + 1);
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
      await purgeCopiesNow(a.id);
      await reloadAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  /** Élèves et notes d'une classe, dans l'ordre de la liste : pour l'export et l'avertissement « autre version ». */
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

  // Exporter = les fiches de correction de la classe à imprimer (récapitulatif + une par élève).
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

  const isSeries = group.items.length > 1;
  const showAll = isSeries && selected === ALL_CLASSES;
  const target = showAll ? null : group.items.find((a) => a.id === selected) ?? group.items[0];
  const o = target ? overviews[target.id] : undefined;

  // ---- L'action de l'étape en cours et le menu de la classe affichée ----
  let primary: { label: string; onClick: () => void; title: string; busy?: boolean } | null = null;
  const menu: MoreMenuItem[] = [];
  if (target) {
    const a = target;
    const drafts = pendingDrafts(o);
    const r = o ? retentionState(a, o.pages) : null;
    const pub = publicationState(a);
    const addCopies: MoreMenuItem = {
      label: 'Ajouter les copies de la classe…',
      onClick: () => setClassAddFor(a.id),
      title: 'Le PDF du photocopieur ou les photos de toutes les copies, découpés et attribués dans l’ordre de la liste',
    };
    // Rien encore (ni scan ni note) : la suite logique est d'ajouter les copies.
    const addFirst = !!o && hasCopies(a) && neverScanned(o) && o.graded + o.absent === 0 && !a.copies_purged_at;
    primary = addFirst
      ? { label: 'Ajouter les copies', onClick: addCopies.onClick, title: addCopies.title ?? '' }
      : drafts > 0
        ? { label: validating === a.id ? 'Validation…' : `Valider (${drafts})`, onClick: () => handleValidateClass(a), busy: validating === a.id, title: 'Les brouillons du Correcteur deviennent des notes validées, visibles à la publication' }
        : pub === 'none' && hasCopyContent(o)
          ? { label: 'Publier…', onClick: () => setPublishing(a), title: 'Rendre visible dans l’espace élève : les notes, avec ou sans les corrections' }
          : pub === 'notes'
            ? { label: 'Publier les corrections', onClick: () => setCorrections(a, true), title: 'Le détail, le commentaire, le corrigé et la copie corrigée deviennent visibles' }
            : null;

    if (hasCopies(a) && !addFirst) menu.push(addCopies);
    if (pub === 'none' && drafts > 0) {
      menu.push({ label: 'Publier…', onClick: () => setPublishing(a), title: 'Rendre visible dans l’espace élève : les notes, avec ou sans les corrections' });
    }
    if (o && o.graded > 0 && hasCopies(a)) {
      menu.push({
        label: exportLoading === a.id ? 'Préparation…' : 'Exporter les corrections…',
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
  }

  const showViewer = !!target && (hasCopyContent(o) || classAddFor === target.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ---- Onglets : Ensemble, puis une classe par onglet ; l'action en cours et le menu au bout ---- */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, borderBottom: '1px solid var(--border)' }}>
        <div role="tablist" aria-label="Classes" style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
          {isSeries && (
            <Tab
              on={showAll}
              onClick={() => onSelect(ALL_CLASSES)}
              label="Ensemble"
              sub={series?.level ? formatGrade(series.level.mean) : '…'}
              title="Comparer les classes"
            />
          )}
          {group.items.map((a) => {
            const t = classTone(a, overviews[a.id]);
            const mean = classMeans[a.id];
            return (
              <Tab
                key={a.id}
                on={!showAll && target?.id === a.id}
                onClick={() => onSelect(a.id)}
                label={a.classes?.name ?? '—'}
                sub={mean === undefined ? '…' : mean === null ? '—' : formatGrade(mean)}
                dot={TONE_COLOR[t.tone]}
                title={t.label}
              />
            );
          })}
        </div>
        {target && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, flexShrink: 0 }}>
            {primary && (
              <button onClick={primary.onClick} disabled={primary.busy} style={btnPrimary} title={primary.title}>
                {primary.label}
              </button>
            )}
            <ClassMenu
              assessment={target}
              overview={o}
              sessionStart={sessionStarts[target.id]}
              items={menu}
            />
          </div>
        )}
      </div>

      {/* ---- Ensemble : comparaison des classes ---- */}
      {showAll && series && (
        <SeriesOverview
          classes={series.classes}
          level={series.level}
          total={series.total}
          loading={series.loading}
          error={series.error}
          onOpenClass={onSelect}
        />
      )}

      {/* ---- Une classe : statistiques en une ligne, puis les copies ---- */}
      {target && (
        <>
          {focusStats ? (
            <StatsStrip stats={focusStats.stats} open={statsOpen} onToggle={() => setStatsOpen((v) => !v)} />
          ) : (
            <div style={{ padding: '8px 2px', fontSize: 13, color: 'var(--text-dim)' }}>…</div>
          )}
          {statsOpen && focusStats && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <AssessmentStatsBody assessment={target} entries={focusStats.entries} stats={focusStats.stats} userId={userId} showComparison={false} />
            </div>
          )}
          {showViewer ? (
            <CopyViewer
              key={target.id}
              assessment={target}
              onError={onError}
              onChanged={onReload}
              refreshKey={viewerKey}
              openClassAdd={classAddFor === target.id}
              onClassAddClosed={() => setClassAddFor(null)}
              showClassAddButton={false}
            />
          ) : (
            <EmptyClass assessment={target} onAdd={() => setClassAddFor(target.id)} />
          )}
        </>
      )}

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

function Tab({ on, onClick, label, sub, dot, title }: {
  on: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  dot?: string;
  title?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={on}
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '6px 14px 7px',
        background: 'none', border: 'none', borderBottom: `2px solid ${on ? 'var(--indigo)' : 'transparent'}`, marginBottom: -1,
        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 700, color: on ? 'var(--indigo-ink)' : 'var(--text)' }}>
        {label}
        {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>
    </button>
  );
}

/**
 * Le menu d'une classe : son état détaillé en tête (avancement des copies, publication,
 * rétention des scans), puis les actions rares. Tout ce qui n'a pas à rester à l'écran.
 */
function ClassMenu({ assessment: a, overview: o, sessionStart, items }: {
  assessment: AssessmentRow;
  overview: CopyOverview | undefined;
  sessionStart: string | undefined;
  items: MoreMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const cls = a.classes?.name ?? '—';
  const when = sessionStart ? `séance du ${formatSession(sessionStart)}` : a.date ? formatSession(a.date) : null;
  const pub = publicationState(a);
  const r = o ? retentionState(a, o.pages) : null;
  const scannedFlow = !!o && hasCopies(a) && !neverScanned(o);
  const progress = o && o.total > 0 ? (scannedFlow ? o.scanned : o.graded + o.absent) / o.total : 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="État des copies et actions de la classe"
        style={btnMenu}
      >
        {cls} ▾
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 300, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-2)',
          }}
        >
          <div style={{ padding: 12, borderBottom: items.length ? '1px solid var(--border)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{cls}{when ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {when}</span> : null}</span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: pub === 'all' ? 'var(--pos)' : pub === 'notes' ? 'var(--warn)' : 'var(--text-dim)' }}>
                {pub === 'all' ? '✓ Publiée' : pub === 'notes' ? 'Notes publiées' : 'Non publiée'}
              </span>
            </div>
            {o && o.total > 0 && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--indigo)' }} />
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {o ? describeClassRow(o, hasCopies(a)) : 'Chargement…'}
              {pub === 'notes' && <div style={{ color: 'var(--warn)' }}>Corrections retenues : les élèves ne voient que leur note</div>}
              {o && r && r.kind !== 'none' && (
                <div style={{ color: r.kind === 'scheduled' && r.days <= 7 ? 'var(--warn)' : 'var(--text-dim)' }}>
                  {r.kind === 'kept' && 'Scans conservés tant que l’éval n’est pas publiée'}
                  {r.kind === 'scheduled' && (r.days <= 0
                    ? (o.untranscribed > 0 ? describeKeptCopies(o.untranscribed) : 'Scans supprimés cette nuit')
                    : `Scans supprimés le ${formatSession(r.at)} (dans ${r.days} j)`)}
                  {r.kind === 'scheduled' && r.days > 0 && o.untranscribed > 0 && ` · ${describeKeptCopies(o.untranscribed)}`}
                  {r.kind === 'purged' && `Scans supprimés le ${formatSession(r.at)}`}
                </div>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <div style={{ padding: 4 }}>
              {items.map((it) => (
                <button
                  key={it.label}
                  role="menuitem"
                  disabled={it.disabled}
                  onClick={() => { setOpen(false); it.onClick(); }}
                  title={it.title}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none',
                    background: 'none', cursor: it.disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13,
                    borderRadius: 6, color: it.danger ? 'var(--neg)' : 'var(--text)', opacity: it.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = 'var(--surface-3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Une classe sans copie ni note : une ligne, et le geste qui démarre. */
function EmptyClass({ assessment: a, onAdd }: { assessment: AssessmentRow; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px 16px', border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-dim)' }}>
      <span style={{ flex: 1, minWidth: 240 }}>
        {hasCopies(a)
          ? 'Aucune copie pour l’instant. Elles se scannent au téléphone, en séance (bouton « Copies »), ou s’ajoutent ici.'
          : a.kind === 'groupe'
            ? 'Notation en séance, par groupe et sur critères : le détail est plus bas.'
            : 'Pas encore de note. Elles se saisissent dans le carnet, ou viennent d’une production numérique (plus bas).'}
      </span>
      {hasCopies(a) && <button onClick={onAdd} style={btnPrimary}>Ajouter les copies</button>}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit', whiteSpace: 'nowrap',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo-ink)', color: '#fff' };
const btnMenu: React.CSSProperties = { ...btnBase, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)' };
