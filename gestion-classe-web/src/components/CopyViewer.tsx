import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAssessmentCopies,
  fetchAssessmentGrades,
  fetchExpectedStudents,
  getCopyUrls,
  validateAllGrades,
  validateGrade,
  type AssessmentRow,
  type CopyPageRow,
  type GradeRow,
  type RosterStudent,
} from '../lib/evaluationQueries';
import { parseGradeDetails } from '../lib/gradeDetails';
import { GradeDetailsView } from './GradeDetailsView';

type RowState = 'scanned' | 'absent' | 'missing';
type Filter = 'all' | RowState;

interface Row {
  student: RosterStudent;
  pages: CopyPageRow[];
  grade: GradeRow | null;
  state: RowState;
}

const NO_COPY = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);

/** On ouvre un élève s'il y a une copie à regarder ou une correction à relire. */
function isSelectable(r: Row): boolean {
  return r.state === 'scanned' || r.grade?.grade != null || !!r.grade?.details;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roster, copies, grades] = await Promise.all([
        fetchExpectedStudents([assessment]),
        fetchAssessmentCopies(assessment.id),
        fetchAssessmentGrades(assessment.id),
      ]);
      const gradeBy = new Map(grades.map((g) => [g.student_id, g]));
      const next: Row[] = (roster[assessment.id] ?? []).map((student) => {
        const pages = copies
          .filter((c) => c.student_id === student.id)
          .sort((a, b) => a.page_order - b.page_order);
        const grade = gradeBy.get(student.id) ?? null;
        const state: RowState =
          pages.length > 0 ? 'scanned' : grade && NO_COPY.has(grade.status) ? 'absent' : 'missing';
        return { student, pages, grade, state };
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
  const drafts = rows.filter((r) => r.grade && r.grade.grade != null && !r.grade.is_validated).length;
  const [validatingAll, setValidatingAll] = useState(false);

  const handleValidateAll = async () => {
    if (!window.confirm(`Valider les ${drafts} note${drafts > 1 ? 's' : ''} en brouillon de cette classe ?`)) return;
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
                disabled={!isSelectable(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 'none', borderBottom: '1px solid var(--border)',
                  background: on ? 'var(--indigo-soft)' : 'transparent',
                  cursor: isSelectable(r) ? 'pointer' : 'default', fontFamily: 'inherit',
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
                {r.grade?.subject_version && <Badge>{r.grade.subject_version}</Badge>}
                {r.grade?.is_adapted && <Badge tone="info">Adaptée</Badge>}
                {r.grade?.copy_annotated && <Badge tone="info">Annotée</Badge>}
                {r.state === 'scanned' ? (
                  <Badge tone="ok">{r.pages.length} p.</Badge>
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
              {page && urls[page.storage_path] && (
                <a href={urls[page.storage_path]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--indigo)' }}>
                  Ouvrir ↗
                </a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: details && selected.pages.length > 0 ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
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
              ) : !details ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
                  Pas de copie scannée pour cet élève.
                </div>
              ) : null}
              {details && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' }}>
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
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
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
