import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AiCorrectionStartError,
  fetchAiCorrection,
  fetchAssessmentCopies,
  fetchAssessmentGrades,
  fetchAssessmentTranscripts,
  fetchExpectedStudents,
  fetchKitVersions,
  fetchLatestAiCorrections,
  getCopyUrls,
  hasCorrectionKit,
  startAiCorrection,
  validateAllGrades,
  validateGrade,
  type AssessmentRow,
  type CopyPageRow,
  type GradeRow,
  type RosterStudent,
} from '../lib/evaluationQueries';
import { parseGradeDetails } from '../lib/gradeDetails';
import { alignTranscript, parseTranscript, type TranscriptItem } from '../lib/copyTranscript';
import { GradeDetailsView } from './GradeDetailsView';
import { CopyTranscriptView } from './CopyTranscriptView';
import { AddCopyDialog } from './AddCopyDialog';
import { ExportCorrectionsDialog, downloadCorrectionsPdf, exportableSheets } from './ExportCorrectionsDialog';
import {
  COST_HINT,
  NO_KIT_MESSAGE,
  correctionMode,
  describeStartError,
  formatCost,
  isApiGrade,
  isRunActive,
  isRunInterrupted,
  mentionsOtherVersion,
  type AiCorrectionRun,
} from '../lib/aiCorrection';

type RowState = 'scanned' | 'absent' | 'missing';
type Filter = 'all' | RowState;

interface Row {
  student: RosterStudent;
  pages: CopyPageRow[];
  grade: GradeRow | null;
  /** Transcription du Correcteur (migration 056) : reste quand les scans sont supprimés. */
  transcript: TranscriptItem[] | null;
  state: RowState;
}

const NO_COPY = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);

/** On ouvre un élève s'il y a une copie à regarder ou une correction à relire. */
function isSelectable(r: Row): boolean {
  return r.state === 'scanned' || r.grade?.grade != null || !!r.grade?.details || !!r.transcript;
}

const FILTERS: [Filter, string][] = [
  ['all', 'Tous'],
  ['scanned', 'Scannées'],
  ['missing', 'Manquantes'],
  ['absent', 'Absents'],
];

interface CopyViewerProps {
  assessment: AssessmentRow;
  onError: (message: string) => void;
  /** Appelé après une validation, pour rafraîchir l'état affiché ailleurs. */
  onChanged?: () => void;
}

/**
 * Copies scannées d'une classe pour une éval : tous les élèves attendus (scannés, absents,
 * manquants), et la copie de l'élève choisi en grand, page par page.
 * Clavier : ← → pages, ↑ ↓ élèves.
 */
export function CopyViewer({ assessment, onError, onChanged }: CopyViewerProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  // Bouton « Corriger » (migration 057) : kit envoyé par le Correcteur, dernier appel par élève.
  const [hasKit, setHasKit] = useState(false);
  // Versions du sujet qui ont un kit (une copie d'une autre version n'a pas le bon barème).
  const [kitVersions, setKitVersions] = useState<string[]>([]);
  const [aiRuns, setAiRuns] = useState<Record<string, AiCorrectionRun>>({});
  const [startingId, setStartingId] = useState<string | null>(null);
  // « Ajouter une copie » (migration 058) : élève dont la fenêtre est ouverte.
  const [addingId, setAddingId] = useState<string | null>(null);
  // Export PDF des corrections (fiches à imprimer).
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roster, copies, grades, transcripts, kit, runs, versions] = await Promise.all([
        fetchExpectedStudents([assessment]),
        fetchAssessmentCopies(assessment.id),
        fetchAssessmentGrades(assessment.id),
        fetchAssessmentTranscripts(assessment.id),
        hasCorrectionKit(assessment.id),
        fetchLatestAiCorrections(assessment.id),
        fetchKitVersions(assessment.id),
      ]);
      setHasKit(kit);
      setKitVersions(versions);
      setAiRuns(runs);
      const gradeBy = new Map(grades.map((g) => [g.student_id, g]));
      const next: Row[] = (roster[assessment.id] ?? []).map((student) => {
        const pages = copies
          .filter((c) => c.student_id === student.id)
          .sort((a, b) => a.page_order - b.page_order);
        const grade = gradeBy.get(student.id) ?? null;
        const transcript = parseTranscript(transcripts[student.id]);
        // Une copie dont les scans sont supprimés reste « scannée » : sa transcription la remplace.
        const state: RowState =
          pages.length > 0 || transcript ? 'scanned' : grade && NO_COPY.has(grade.status) ? 'absent' : 'missing';
        return { student, pages, grade, transcript, state };
      });
      setRows(next);
      setSelectedId((cur) => cur ?? next.find(isSelectable)?.student.id ?? null);
      setUrls(await getCopyUrls(copies.map((c) => c.storage_path)));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Copies introuvables');
    } finally {
      setLoading(false);
    }
  }, [assessment, onError]);

  useEffect(() => {
    setSelectedId(null);
    load();
  }, [load]);

  const visible = useMemo(
    () => rows.filter((r) => filter === 'all' || r.state === filter),
    [rows, filter],
  );
  const selected = rows.find((r) => r.student.id === selectedId) ?? null;
  const page = selected?.pages[pageIndex] ?? null;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setPageIndex(0);
    setZoom(false);
  }, []);

  const moveStudent = useCallback(
    (delta: 1 | -1) => {
      const candidates = visible.filter(isSelectable);
      if (candidates.length === 0) return;
      const i = candidates.findIndex((r) => r.student.id === selectedId);
      const next = candidates[(i + delta + candidates.length) % candidates.length];
      select(next.student.id);
    },
    [visible, selectedId, select],
  );

  const details = useMemo(() => parseGradeDetails(selected?.grade?.details), [selected]);
  const transcriptBlocks = useMemo(
    () => (selected?.transcript ? alignTranscript(selected.transcript, details?.questions ?? []) : null),
    [selected, details],
  );
  // Avec des scans, la transcription est un onglet à côté de la correction ; sans scan, elle
  // prend la place des pages.
  const [sideTab, setSideTab] = useState<'correction' | 'transcription'>('correction');
  const drafts = rows.filter((r) => r.grade && r.grade.grade != null && !r.grade.is_validated).length;
  const [validatingAll, setValidatingAll] = useState(false);

  const handleValidateAll = async () => {
    const flagged = rows.filter((r) => {
      const run = aiRuns[r.student.id];
      return r.grade && !r.grade.is_validated && run?.status === 'done' && isApiGrade(r.grade.details) && mentionsOtherVersion(run.a_arbitrer);
    });
    const warning = flagged.length
      ? `

⚠ Dont ${flagged.map((r) => r.student.pseudo).join(', ')} : Claude signale une copie faite sur une autre version du sujet.`
      : '';
    if (!window.confirm(`Valider les ${drafts} note${drafts > 1 ? 's' : ''} en brouillon de cette classe ?${warning}`)) return;
    setValidatingAll(true);
    try {
      await validateAllGrades(assessment.id);
      setRows((prev) =>
        prev.map((r) =>
          r.grade && r.grade.grade != null && !r.grade.is_validated
            ? { ...r, grade: { ...r.grade, is_validated: true } }
            : r,
        ),
      );
      onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la validation');
    } finally {
      setValidatingAll(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight' && selected) setPageIndex((p) => Math.min(p + 1, selected.pages.length - 1));
      else if (e.key === 'ArrowLeft') setPageIndex((p) => Math.max(p - 1, 0));
      else if (e.key === 'ArrowDown') moveStudent(1);
      else if (e.key === 'ArrowUp') moveStudent(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, moveStudent]);

  const handleValidate = async (g: GradeRow) => {
    // Claude a signalé une copie faite sur une autre version du sujet : la note vient d'un autre barème.
    const run = aiRuns[g.student_id];
    if (
      run?.status === 'done' &&
      isApiGrade(g.details) &&
      mentionsOtherVersion(run.a_arbitrer) &&
      !window.confirm('Claude signale que cette copie semble faite sur une autre version du sujet : la note a pu être calculée sur le mauvais barème. Valider quand même ?')
    ) {
      return;
    }
    try {
      await validateGrade(g.id);
      setRows((prev) =>
        prev.map((r) => (r.grade?.id === g.id ? { ...r, grade: { ...g, is_validated: true } } : r)),
      );
      onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la validation');
    }
  };

  // Suit les corrections en cours ; à la fin, recharge les notes et la transcription.
  const activeRunIds = Object.values(aiRuns).filter((r) => isRunActive(r)).map((r) => r.id).join(',');
  useEffect(() => {
    if (!activeRunIds) return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await Promise.all(activeRunIds.split(',').map((id) => fetchAiCorrection(id)));
        const finished = fresh.filter((r): r is AiCorrectionRun => !!r && r.status !== 'running');
        if (finished.length === 0) return;
        setAiRuns((prev) => ({ ...prev, ...Object.fromEntries(finished.map((r) => [r.student_id, r])) }));
        if (finished.some((r) => r.status === 'done')) {
          await load();
          onChanged?.();
        }
      } catch {
        // réseau : on réessaie au prochain tour
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeRunIds, load, onChanged]);

  const handleCorrect = async (r: Row) => {
    const mode = correctionMode({ pages: r.pages.length, grade: r.grade });
    if (!mode) return;
    const validated = mode === 'recorriger' && !!r.grade?.is_validated;
    const question = validated
      ? `La note de ${r.student.pseudo} est validée. La recorriger la repasse en brouillon (invisible pour l’élève) jusqu’à ce que tu la valides de nouveau.\n\nRecorriger avec Claude (${COST_HINT} de crédits API) ?`
      : mode === 'recorriger'
        ? `Recorriger la copie de ${r.student.pseudo} avec Claude (${COST_HINT} de crédits API) ? La note actuelle sera remplacée (en brouillon).`
        : `Corriger la copie de ${r.student.pseudo} avec Claude (${COST_HINT} de crédits API) ? La note arrive en brouillon.`;
    if (!window.confirm(question)) return;
    setStartingId(r.student.id);
    try {
      const runId = await startAiCorrection({
        assessmentId: assessment.id,
        studentId: r.student.id,
        mode,
        confirmValidated: validated,
      });
      const run = await fetchAiCorrection(runId);
      if (run) setAiRuns((prev) => ({ ...prev, [run.student_id]: run }));
    } catch (e) {
      onError(e instanceof AiCorrectionStartError ? describeStartError(e.code, e.info) : e instanceof Error ? e.message : 'Correction impossible');
      if (e instanceof AiCorrectionStartError && e.code === 'already_running') load();
    } finally {
      setStartingId(null);
    }
  };

  const knownVersions = useMemo(
    () => Array.from(new Set([...rows.map((r) => r.grade?.subject_version), ...kitVersions].filter((v): v is string => !!v))).sort(),
    [rows, kitVersions],
  );
  const adding = rows.find((r) => r.student.id === addingId) ?? null;

  const counts = {
    all: rows.length,
    scanned: rows.filter((r) => r.state === 'scanned').length,
    missing: rows.filter((r) => r.state === 'missing').length,
    absent: rows.filter((r) => r.state === 'absent').length,
  };

  if (loading && rows.length === 0) {
    return <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 12 }}>Chargement des copies…</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      {/* ---- Élèves ---- */}
      <div>
        {drafts > 0 && (
          <button
            onClick={handleValidateAll}
            disabled={validatingAll}
            style={{ ...btn, width: '100%', marginBottom: 8, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}
          >
            {validatingAll ? 'Validation…' : `Valider toute la classe (${drafts} brouillon${drafts > 1 ? 's' : ''})`}
          </button>
        )}
        {rows.some((r) => r.grade?.details) && (
          <button onClick={() => setExportOpen(true)} style={{ ...btn, width: '100%', marginBottom: 8 }}>
            Exporter les corrections (PDF)
          </button>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              style={{
                ...chip,
                background: filter === id ? 'var(--text)' : 'var(--surface-3)',
                color: filter === id ? 'var(--surface)' : 'var(--text-muted)',
              }}
            >
              {label} {counts[id]}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: 640, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          {visible.length === 0 && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>Personne ici.</div>
          )}
          {visible.map((r) => {
            const on = r.student.id === selectedId;
            return (
              <button
                key={r.student.id}
                onClick={() => select(r.student.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: on ? 'var(--indigo-soft)' : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: isSelectable(r) ? 'var(--text)' : 'var(--text-dim)' }}>
                  {r.student.pseudo}
                </span>
                {r.grade && r.grade.grade != null && (
                  <span
                    title={r.grade.is_validated ? 'Note validée' : 'Brouillon du correcteur, invisible pour l’élève'}
                    style={{ fontSize: 11.5, fontWeight: 700, color: r.grade.is_validated ? 'var(--pos)' : 'var(--warn)' }}
                  >
                    {r.grade.grade}{r.grade.is_validated ? '' : '*'}
                  </span>
                )}
                {isRunActive(aiRuns[r.student.id]) && <Badge tone="info">Correction…</Badge>}
                {aiRuns[r.student.id]?.status === 'done' && isApiGrade(r.grade?.details) && aiRuns[r.student.id].a_arbitrer.length > 0 && (
                  <Badge tone="warn">⚑ {aiRuns[r.student.id].a_arbitrer.length}</Badge>
                )}
                {r.grade?.subject_version && <Badge>{r.grade.subject_version}</Badge>}
                {r.grade?.is_adapted && <Badge tone="info">Adaptée</Badge>}
                {r.grade?.copy_annotated && <Badge tone="info">Annotée</Badge>}
                {r.state === 'scanned' ? (
                  r.pages.length > 0 ? (
                    <Badge tone="ok">{r.pages.length} p.</Badge>
                  ) : (
                    <Badge tone="info">Texte</Badge>
                  )
                ) : r.state === 'absent' ? (
                  <Badge tone="neg">Absent</Badge>
                ) : (
                  <Badge tone="warn">Manquante</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Copie ---- */}
      <div>
        {!selected ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
            {rows.some(isSelectable) ? 'Choisis un élève.' : 'Aucune copie ni correction pour cette classe.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button onClick={() => moveStudent(-1)} style={btn} title="Élève précédent (↑)">↑</button>
              <button onClick={() => moveStudent(1)} style={btn} title="Élève suivant (↓)">↓</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{selected.student.pseudo}</span>
              {selected.pages.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  page {pageIndex + 1}/{selected.pages.length}
                </span>
              )}
              <span style={{ flex: 1 }} />
              {selected.grade && selected.grade.grade != null && (
                <span style={{ fontSize: 13, fontWeight: 700, color: selected.grade.is_validated ? 'var(--pos)' : 'var(--warn)' }}>
                  {selected.grade.grade}/20{selected.grade.is_validated ? ' ✓' : ' (brouillon)'}
                </span>
              )}
              {selected.grade && selected.grade.grade != null && !selected.grade.is_validated && (
                <button onClick={() => handleValidate(selected.grade!)} style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}>
                  Valider la note
                </button>
              )}
              {details && (
                <button
                  onClick={() => {
                    const sheet = exportableSheets([selected]);
                    if (sheet.length) downloadCorrectionsPdf(assessment, sheet, false, selected.student.pseudo);
                  }}
                  style={btn}
                  title="Fiche de correction de cet élève, à imprimer"
                >
                  PDF
                </button>
              )}
              <button
                onClick={() => setAddingId(selected.student.id)}
                style={btn}
                title="Importer des photos ou un PDF, la webcam, ou un QR code pour le téléphone"
              >
                Ajouter une copie
              </button>
              {(() => {
                const mode = correctionMode({ pages: selected.pages.length, grade: selected.grade });
                if (!mode) return null;
                const busy = startingId === selected.student.id || isRunActive(aiRuns[selected.student.id]);
                return (
                  <button
                    onClick={() => handleCorrect(selected)}
                    disabled={!hasKit || busy}
                    title={hasKit ? `Correction par Claude Opus 5.5, en brouillon (${COST_HINT})` : NO_KIT_MESSAGE}
                    style={{ ...btn, opacity: !hasKit || busy ? 0.55 : 1, cursor: !hasKit || busy ? 'default' : 'pointer' }}
                  >
                    {busy ? 'Correction en cours…' : mode === 'corriger' ? 'Corriger' : 'Recorriger'}
                  </button>
                );
              })()}
              {page && urls[page.storage_path] && (
                <a href={urls[page.storage_path]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--indigo)' }}>
                  Ouvrir ↗
                </a>
              )}
            </div>
            {!hasKit && correctionMode({ pages: selected.pages.length, grade: selected.grade }) === 'corriger' && (
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 8 }}>
                {NO_KIT_MESSAGE} : le bouton « Corriger » s’active quand le kit de l’éval est envoyé (push_grades.py --kit).
              </div>
            )}
            <AiRunPanel run={aiRuns[selected.student.id]} apiGrade={isApiGrade(selected.grade?.details)} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  (selected.pages.length > 0 && (details || transcriptBlocks)) || (details && transcriptBlocks)
                    ? 'minmax(0, 1fr) 380px'
                    : 'minmax(0, 1fr)',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {selected.pages.length > 0 ? (
                <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {selected.pages.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => { setPageIndex(i); setZoom(false); }}
                      style={{
                        padding: 0, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-3)',
                        border: `2px solid ${i === pageIndex ? 'var(--indigo)' : 'var(--border)'}`,
                      }}
                      title={`Page ${p.page_order}`}
                    >
                      {urls[p.storage_path] ? (
                        <img src={urls[p.storage_path]} alt={`p${p.page_order}`} style={{ width: 48, height: 64, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: 48, height: 64, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>p{p.page_order}</div>
                      )}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-3)',
                    maxHeight: 760, overflow: 'auto', textAlign: 'center',
                  }}
                >
                  {page && urls[page.storage_path] ? (
                    <img
                      src={urls[page.storage_path]}
                      alt={`${selected.student.pseudo}, page ${page.page_order}`}
                      onClick={() => setZoom((z) => !z)}
                      style={{
                        display: 'block', margin: '0 auto', cursor: zoom ? 'zoom-out' : 'zoom-in',
                        width: zoom ? '180%' : 'auto', maxWidth: zoom ? 'none' : '100%',
                        maxHeight: zoom ? 'none' : 740,
                      }}
                    />
                  ) : (
                    <div style={{ padding: 60, color: 'var(--text-dim)', fontSize: 13 }}>Chargement de la page…</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  Clic sur la page : zoom · ← → pages · ↑ ↓ élèves
                </div>
                </div>
              ) : transcriptBlocks ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Copie transcrite
                    <span style={{ fontWeight: 500 }}>
                      {assessment.copies_purged_at ? ' · scans supprimés' : ' · pas de scan'}, visible par toi seul
                    </span>
                  </div>
                  <CopyTranscriptView blocks={transcriptBlocks} />
                </div>
              ) : !details ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
                  Pas de copie scannée pour cet élève.
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => setAddingId(selected.student.id)} style={btn}>Ajouter une copie</button>
                  </div>
                </div>
              ) : null}
              {(details || (transcriptBlocks && selected.pages.length > 0)) && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}>
                  {transcriptBlocks && selected.pages.length > 0 && details && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                      {(['correction', 'transcription'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSideTab(t)}
                          style={{
                            ...chip,
                            background: sideTab === t ? 'var(--text)' : 'var(--surface-3)',
                            color: sideTab === t ? 'var(--surface)' : 'var(--text-muted)',
                          }}
                        >
                          {t === 'correction' ? 'Correction' : 'Transcription'}
                        </button>
                      ))}
                    </div>
                  )}
                  {transcriptBlocks && selected.pages.length > 0 && (!details || sideTab === 'transcription') ? (
                    <>
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 8 }}>
                        Transcription du correcteur, gardée après la suppression des scans. Visible par toi seul.
                      </div>
                      <div style={{ maxHeight: 700, overflowY: 'auto' }}>
                        <CopyTranscriptView blocks={transcriptBlocks} />
                      </div>
                    </>
                  ) : details ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Correction{details.version ? ` · sujet ${details.version}` : ''}
                        {selected.grade && !selected.grade.is_validated && (
                          <span style={{ color: 'var(--warn)', fontWeight: 600 }}> · brouillon, invisible pour l’élève</span>
                        )}
                      </div>
                      <GradeDetailsView details={details} />
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                        Une retouche se fait dans le Correcteur (JSON), puis on renvoie avec push_grades.py.
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {exportOpen && <ExportCorrectionsDialog assessment={assessment} rows={rows} onClose={() => setExportOpen(false)} />}
      {adding && (
        <AddCopyDialog
          assessment={assessment}
          student={{ id: adding.student.id, pseudo: adding.student.pseudo }}
          existingPages={adding.pages.length}
          graded={adding.grade?.grade != null}
          subjectVersion={adding.grade?.subject_version ?? null}
          isAdapted={!!adding.grade?.is_adapted}
          knownVersions={knownVersions}
          onError={onError}
          onClose={(changed) => {
            setAddingId(null);
            if (changed) {
              load();
              onChanged?.();
            }
          }}
        />
      )}
    </div>
  );
}

/** État du dernier appel « Corriger » de l'élève : en cours, erreur, ou points à arbitrer et coût. */
function AiRunPanel({ run, apiGrade }: { run: AiCorrectionRun | undefined; apiGrade: boolean }) {
  if (!run) return null;
  const box: React.CSSProperties = { borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 12.5 };
  const when = new Date(run.finished_at ?? run.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const cost = run.cost_usd != null ? ` · coût estimé ${formatCost(run.cost_usd)}` : '';
  if (isRunActive(run)) {
    return (
      <div style={{ ...box, background: 'var(--indigo-soft)', color: 'var(--indigo)', fontWeight: 600 }}>
        Correction en cours par Claude… (1 à 2 minutes, tu peux changer d’élève)
      </div>
    );
  }
  if (isRunInterrupted(run) || run.status === 'error') {
    return (
      <div style={{ ...box, background: 'var(--neg-soft)', color: 'var(--neg)' }}>
        <strong>Correction automatique échouée</strong> ({when}{cost}) :{' '}
        {run.error ?? 'appel interrompu (délai dépassé). Rien n’a été enregistré ; tu peux relancer.'}
      </div>
    );
  }
  // Une note renvoyée depuis par le Correcteur remplace celle de l'API : le journal n'est plus d'actualité.
  if (!apiGrade) return null;
  const otherVersion = mentionsOtherVersion(run.a_arbitrer);
  return (
    <>
    {otherVersion && (
      <div style={{ ...box, background: 'var(--neg-soft)', color: 'var(--neg)', fontWeight: 600 }}>
        ⚠ Claude signale que cette copie semble faite sur une autre version du sujet : la note a pu être
        calculée sur le mauvais barème. Vérifie la version (« Ajouter une copie ») et recorrige avant de valider.
      </div>
    )}
    <div style={{ ...box, background: run.a_arbitrer.length ? 'var(--warn-soft)' : 'var(--surface-3)', border: '1px solid var(--border)' }}>
      {run.a_arbitrer.length > 0 ? (
        <>
          <div style={{ fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>
            ⚑ À arbitrer ({run.a_arbitrer.length}) : vérifie avant de valider
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text)' }}>
            {run.a_arbitrer.map((a, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                <strong>{a.question}</strong> · note mise {String(a.note_mise).replace('.', ',')} — {a.raison}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)' }}>Claude ne signale rien à arbitrer.</div>
      )}
      {run.error && <div style={{ color: 'var(--neg)', marginTop: 6 }}>{run.error}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
        Corrigée par Claude ({run.model ?? '?'}) le {when}
        {cost}
        {run.input_tokens != null &&
          ` · ${((run.input_tokens + (run.cache_creation_tokens ?? 0) + (run.cache_read_tokens ?? 0)) / 1000).toFixed(0)} k tokens lus, ${((run.output_tokens ?? 0) / 1000).toFixed(1).replace('.', ',')} k écrits`}
        {run.attempts > 1 && ` · ${run.attempts} essais`}
      </div>
    </div>
    </>
  );
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'neg' | 'info' }) {
  const colors = {
    neutral: ['var(--surface-3)', 'var(--text-muted)'],
    ok: ['var(--pos-soft)', 'var(--pos)'],
    warn: ['var(--warn-soft)', 'var(--warn)'],
    neg: ['var(--neg-soft)', 'var(--neg)'],
    info: ['var(--indigo-soft)', 'var(--indigo)'],
  }[tone];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: colors[0], color: colors[1], whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

const chip: React.CSSProperties = {
  border: 'none', borderRadius: 999, padding: '3px 9px', fontSize: 11.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
