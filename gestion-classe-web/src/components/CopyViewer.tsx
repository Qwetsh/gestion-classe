import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCopyUrls, type AssessmentRow } from '../lib/evaluationQueries';
import { assignUnnamedCopy, deleteCopyPage, deleteUnnamedCopy, fetchUnnamedCopies, moveCopyPage, type UnnamedCopy } from '../lib/copyUpload';
import { parseGradeDetails } from '../lib/gradeDetails';
import { alignTranscript } from '../lib/copyTranscript';
import { GradeDetailsView } from './GradeDetailsView';
import { CopyTranscriptView } from './CopyTranscriptView';
import { AddCopyDialog } from './AddCopyDialog';
import { ClassCopiesDialog } from './ClassCopiesDialog';
import { downloadCorrectionsPdf, exportableSheets } from './ExportCorrectionsDialog';
import { AiRunPanel, Badge } from './AiRunPanel';
import { AiBatchPanel } from './AiBatchPanel';
import { isSelectable, useAssessmentCopies, type CopyRow, type CopyRowState } from '../hooks/useAssessmentCopies';
import { COST_HINT, NO_KIT_MESSAGE, correctionMode, isApiGrade, isRunActive } from '../lib/aiCorrection';

type Filter = 'all' | CopyRowState;

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
  /** Change quand le parent a modifié les copies ou les notes (validation de la classe, purge…) : on recharge sans perdre l'élève affiché. */
  refreshKey?: number;
  /** Ouvrir « Ajouter les copies de la classe » dès que la liste est chargée. */
  openClassAdd?: boolean;
  /** La fenêtre « Ajouter les copies de la classe » ouverte par `openClassAdd` vient d'être fermée. */
  onClassAddClosed?: () => void;
  /** Élève affiché à l'ouverture ; sinon le premier qui a une copie. */
  initialStudentId?: string | null;
}

/**
 * Copies scannées d'une classe pour une éval : tous les élèves attendus (scannés, absents,
 * manquants), et la copie de l'élève choisi en grand, page par page.
 * Clavier : ← → pages, ↑ ↓ élèves. Données et gestes : hooks/useAssessmentCopies.ts (partagés
 * avec la modale élève × éval du carnet).
 */
export function CopyViewer({ assessment, onError, onChanged, refreshKey = 0, openClassAdd = false, onClassAddClosed, initialStudentId = null }: CopyViewerProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // L'élève affiché, pour une éval donnée : changer d'éval repart du premier élève sans effet à part.
  const [sel, setSel] = useState<{ assessmentId: string; studentId: string } | null>(null);
  const selectedId = sel && sel.assessmentId === assessment.id ? sel.studentId : null;
  const setSelectedId = useCallback(
    (id: string | null) => setSel(id ? { assessmentId: assessment.id, studentId: id } : null),
    [assessment.id],
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  // « Ajouter une copie » (migration 058) : élève dont la fenêtre est ouverte.
  const [addingId, setAddingId] = useState<string | null>(null);
  // « Ajouter les copies de la classe » : le paquet entier d'un coup.
  const [addingClass, setAddingClass] = useState(false);
  // Copies « Pas de nom » (migration 062), à identifier : la liste, et celle qu'on regarde.
  const [unnamed, setUnnamed] = useState<UnnamedCopy[]>([]);
  const [unnamedUrls, setUnnamedUrls] = useState<Record<string, string>>({});
  const [unnamedId, setUnnamedId] = useState<string | null>(null);
  const showUnnamed = useCallback(async (copies: UnnamedCopy[]) => {
    setUnnamed(copies);
    setUnnamedId((cur) => (cur && copies.some((c) => c.copyId === cur) ? cur : null));
    try {
      setUnnamedUrls(await getCopyUrls(copies.flatMap((c) => c.pages.map((p) => p.storage_path))));
    } catch {
      // vignettes indisponibles : la liste reste utilisable
    }
  }, []);
  const loadUnnamed = useCallback(
    async () => showUnnamed(await fetchUnnamedCopies(assessment.id)),
    [assessment.id, showUnnamed],
  );
  useEffect(() => {
    let alive = true;
    fetchUnnamedCopies(assessment.id).then((copies) => {
      if (alive) showUnnamed(copies);
    });
    return () => {
      alive = false;
    };
  }, [assessment.id, refreshKey, showUnnamed]);
  /** TP de groupe (migration 063) : noté en séance, sans copie papier. */
  const paperless = assessment.kind === 'groupe';

  // L'élève demandé ne sert qu'à l'ouverture : on le fige au premier rendu.
  const [initialStudent] = useState(initialStudentId);
  // Après chaque chargement : on garde l'élève affiché, sinon celui demandé, sinon le premier qui a une copie.
  const onLoaded = useCallback((next: CopyRow[]) => {
    setSel((cur) => {
      if (cur && cur.assessmentId === assessment.id) return cur;
      const id = initialStudent && next.some((r) => r.student.id === initialStudent)
        ? initialStudent
        : next.find(isSelectable)?.student.id ?? null;
      return id ? { assessmentId: assessment.id, studentId: id } : null;
    });
  }, [initialStudent, assessment.id]);
  const { rows, urls, loading, hasKit, aiRuns, startingId, knownVersions, anyScanned, load, validate, correct, trackRun } =
    useAssessmentCopies(assessment, { onError, onChanged, refreshKey, onLoaded });

  const visible = useMemo(
    () => rows.filter((r) => filter === 'all' || r.state === filter),
    [rows, filter],
  );
  const selected = rows.find((r) => r.student.id === selectedId) ?? null;
  const page = selected?.pages[pageIndex] ?? null;

  const select = useCallback((id: string) => {
    setUnnamedId(null);
    setSelectedId(id);
    setPageIndex(0);
    setZoom(false);
  }, [setSelectedId]);

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

  const adding = rows.find((r) => r.student.id === addingId) ?? null;
  const unnamedCopy = unnamed.find((c) => c.copyId === unnamedId) ?? null;

  const handleAssignUnnamed = async (copy: UnnamedCopy, studentId: string) => {
    const r = rows.find((x) => x.student.id === studentId);
    if (!r) return;
    const question = r.pages.length > 0
      ? `${r.student.pseudo} a déjà ${r.pages.length} page(s) : ces ${copy.pages.length} page(s) passeront après. Continuer ?`
      : `Donner cette copie (${copy.pages.length} page(s)) à ${r.student.pseudo} ?`;
    if (!window.confirm(question)) return;
    try {
      await assignUnnamedCopy(copy.copyId, studentId);
      setUnnamedId(null);
      select(studentId);
      await Promise.all([load(), loadUnnamed()]);
      onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Attribution impossible');
    }
  };

  const handleDeleteUnnamed = async (copy: UnnamedCopy) => {
    if (!window.confirm(`Supprimer cette copie sans nom (${copy.pages.length} page(s)) ? Les scans sont effacés.`)) return;
    try {
      await deleteUnnamedCopy(copy);
      setUnnamedId(null);
      await loadUnnamed();
      onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Suppression impossible');
    }
  };

  // Une page de la copie affichée : supprimée, ou rangée chez un autre élève (scan en double, mauvais élève).
  const [pageBusy, setPageBusy] = useState(false);
  /** Ce que dit la correction déjà faite, si la copie change. */
  const staleNote = (r: CopyRow) =>
    r.grade?.details || r.transcript ? '\n\nLa correction et la transcription déjà faites ne changent pas : relance-les si besoin.' : '';

  const afterPageChange = async (remaining: number) => {
    setPageIndex((i) => Math.max(0, Math.min(i, remaining - 1)));
    setZoom(false);
    await load();
    onChanged?.();
  };

  const handleDeletePage = async (r: CopyRow, index: number) => {
    const p = r.pages[index];
    if (!p) return;
    const question = `Supprimer la page ${index + 1}/${r.pages.length} de ${r.student.pseudo} ? Le scan est effacé, les pages suivantes remontent.${staleNote(r)}`;
    if (!window.confirm(question)) return;
    setPageBusy(true);
    try {
      await deleteCopyPage(p, r.pages);
      await afterPageChange(r.pages.length - 1);
    } catch (e) {
      onError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Suppression impossible');
      load();
    } finally {
      setPageBusy(false);
    }
  };

  const handleMovePage = async (r: CopyRow, index: number, toStudentId: string) => {
    const p = r.pages[index];
    const to = rows.find((x) => x.student.id === toStudentId);
    if (!p || !to) return;
    const after = to.pages.length > 0 ? `, après ses ${to.pages.length} page(s)` : '';
    const question = `Ranger la page ${index + 1}/${r.pages.length} de ${r.student.pseudo} chez ${to.student.pseudo}${after} ?${staleNote(r)}`;
    if (!window.confirm(question)) return;
    setPageBusy(true);
    try {
      await moveCopyPage(p, r.pages, toStudentId);
      await afterPageChange(r.pages.length - 1);
    } catch (e) {
      onError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Déplacement impossible');
      load();
    } finally {
      setPageBusy(false);
    }
  };

  // Ouverte par un geste ici, ou demandée par la fiche (« Ajouter les copies » sur la ligne de la classe).
  const classAddOpen = addingClass || (openClassAdd && !loading && rows.length > 0);

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
        {!paperless && (
          <button
            onClick={() => setAddingClass(true)}
            style={{ ...btn, width: '100%', marginBottom: 8 }}
            title="Le PDF du photocopieur ou les photos de toutes les copies, découpés et attribués dans l’ordre de la liste"
          >
            Ajouter les copies de la classe
          </button>
        )}
        {!paperless && (
          <AiBatchPanel assessmentId={assessment.id} rows={rows} aiRuns={aiRuns} hasKit={hasKit} trackRun={trackRun} />
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {FILTERS.filter(([id]) => anyScanned || (id !== 'scanned' && id !== 'missing')).map(([id, label]) => (
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
        {unnamed.length > 0 && (
          <div style={{ border: '1px dashed var(--warn)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-soft)' }}>
              Pas de nom · {unnamed.length} copie(s) à identifier
            </div>
            {unnamed.map((c, i) => (
              <button
                key={c.copyId}
                onClick={() => { setUnnamedId(c.copyId); setSelectedId(null); setPageIndex(0); setZoom(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '7px 10px',
                  border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                  background: c.copyId === unnamedId ? 'var(--indigo-soft)' : 'transparent',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Copie sans nom {i + 1}</span>
                <Badge tone="warn">{c.pages.length} p.</Badge>
              </button>
            ))}
          </div>
        )}
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
                    style={{ fontSize: 12, fontWeight: 700, color: r.grade.is_validated ? 'var(--pos)' : 'var(--warn)' }}
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
                ) : anyScanned ? (
                  <Badge tone="warn">Manquante</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Copie ---- */}
      <div>
        {unnamedCopy ? (
          <UnnamedCopyPanel
            key={unnamedCopy.copyId}
            copy={unnamedCopy}
            index={unnamed.indexOf(unnamedCopy)}
            urls={unnamedUrls}
            rows={rows}
            onAssign={(studentId) => handleAssignUnnamed(unnamedCopy, studentId)}
            onDelete={() => handleDeleteUnnamed(unnamedCopy)}
          />
        ) : !selected ? (
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
                <button onClick={() => validate(selected.grade!)} style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}>
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
              {!paperless && (
                <button
                  onClick={() => setAddingId(selected.student.id)}
                  style={btn}
                  title="Importer des photos ou un PDF, la webcam, ou un QR code pour le téléphone"
                >
                  Ajouter une copie
                </button>
              )}
              {(() => {
                const mode = correctionMode({ pages: selected.pages.length, grade: selected.grade });
                if (!mode) return null;
                const busy = startingId === selected.student.id || isRunActive(aiRuns[selected.student.id]);
                return (
                  <button
                    onClick={() => correct(selected)}
                    disabled={!hasKit || busy}
                    title={hasKit ? `Correction par Claude Opus 5.5, en brouillon (${COST_HINT})` : NO_KIT_MESSAGE}
                    style={{ ...btn, opacity: !hasKit || busy ? 0.55 : 1, cursor: !hasKit || busy ? 'default' : 'pointer' }}
                  >
                    {busy ? 'Correction en cours…' : mode === 'corriger' ? 'Corriger avec Claude' : 'Recorriger avec Claude'}
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
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                {NO_KIT_MESSAGE} : le bouton « Corriger avec Claude » s’active quand le kit de l’éval est envoyé (push_grades.py --kit).
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
                {page && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {pageIndex + 1} :</span>
                    <select
                      key={page.id}
                      value=""
                      disabled={pageBusy}
                      onChange={(e) => e.target.value && handleMovePage(selected, pageIndex, e.target.value)}
                      title="Page rangée chez le mauvais élève"
                      style={{ padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
                    >
                      <option value="">Déplacer vers…</option>
                      {rows
                        .filter((x) => x.student.id !== selected.student.id)
                        .map((x) => (
                          <option key={x.student.id} value={x.student.id}>
                            {x.student.pseudo}
                            {x.pages.length > 0 ? ` (${x.pages.length} p.)` : x.state === 'absent' ? ' (absent)' : ''}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => handleDeletePage(selected, pageIndex)}
                      disabled={pageBusy}
                      style={{ ...btn, color: 'var(--neg)', opacity: pageBusy ? 0.55 : 1 }}
                      title="Scan en double ou raté : la page part, les suivantes remontent"
                    >
                      {pageBusy ? '…' : 'Supprimer cette page'}
                    </button>
                  </div>
                )}

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
              ) : !details && paperless ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
                  Noté en séance de groupe, sans copie. Les critères du groupe sont plus bas, dans « Séance de groupe ».
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
                <div
                  style={{
                    border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)',
                    // Défilement propre et colonne collée : on fait défiler la correction en gardant la copie sous les yeux.
                    position: 'sticky', top: 16, maxHeight: 'min(840px, calc(100vh - 32px))', overflowY: 'auto',
                  }}
                >
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
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                        Transcription du correcteur, gardée après la suppression des scans. Visible par toi seul.
                      </div>
                      <CopyTranscriptView blocks={transcriptBlocks} />
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
      {classAddOpen && (
        <ClassCopiesDialog
          assessment={assessment}
          students={rows.map((r) => ({
            id: r.student.id,
            pseudo: r.student.pseudo,
            existingPages: r.pages.length,
            grade: r.grade,
            absent: r.state === 'absent',
          }))}
          knownVersions={knownVersions}
          onError={onError}
          onClose={(changed) => {
            setAddingClass(false);
            if (openClassAdd) onClassAddClosed?.();
            if (changed) {
              load();
              loadUnnamed();
              onChanged?.();
            }
          }}
        />
      )}
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

/** Une copie « Pas de nom » : ses pages en grand, et à qui la donner (ou la supprimer). */
function UnnamedCopyPanel({
  copy,
  index,
  urls,
  rows,
  onAssign,
  onDelete,
}: {
  copy: UnnamedCopy;
  index: number;
  urls: Record<string, string>;
  rows: CopyRow[];
  onAssign: (studentId: string) => void;
  onDelete: () => void;
}) {
  const [page, setPage] = useState(0);
  const [studentId, setStudentId] = useState('');
  const current = copy.pages[Math.min(page, copy.pages.length - 1)];
  // Sans copie d'abord : c'est le plus souvent l'un d'eux.
  const sorted = [...rows.filter((r) => r.state === 'missing'), ...rows.filter((r) => r.state !== 'missing')];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Copie sans nom {index + 1}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>page {page + 1}/{copy.pages.length}</span>
        <span style={{ flex: 1 }} />
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
        >
          <option value="">C’est la copie de…</option>
          {sorted.map((r) => (
            <option key={r.student.id} value={r.student.id}>
              {r.student.pseudo}
              {r.state === 'missing' ? '' : r.state === 'absent' ? ' (absent)' : ` (déjà ${r.pages.length} p.)`}
            </option>
          ))}
        </select>
        <button
          onClick={() => studentId && onAssign(studentId)}
          disabled={!studentId}
          style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: studentId ? 1 : 0.55 }}
        >
          Attribuer
        </button>
        <button onClick={onDelete} style={btn} title="Supprimer cette copie et ses scans">Supprimer</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
        Rangée sans élève (nom illisible ou absent). Une fois attribuée, elle rejoint les copies de l’élève.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {copy.pages.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setPage(i)}
            style={{ padding: 0, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-3)', border: `2px solid ${i === page ? 'var(--indigo)' : 'var(--border)'}` }}
          >
            {urls[p.storage_path] ? (
              <img src={urls[p.storage_path]} alt={`p${i + 1}`} style={{ width: 48, height: 64, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: 48, height: 64, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>p{i + 1}</div>
            )}
          </button>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-3)', maxHeight: 760, overflow: 'auto', textAlign: 'center' }}>
        {current && urls[current.storage_path] ? (
          <img src={urls[current.storage_path]} alt={`Copie sans nom, page ${page + 1}`} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: 740 }} />
        ) : (
          <div style={{ padding: 60, color: 'var(--text-dim)', fontSize: 13 }}>Chargement de la page…</div>
        )}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  border: 'none', borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
