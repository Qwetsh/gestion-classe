import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { AssessmentDetail } from '../components/AssessmentDetail';
import { AssessmentModal } from '../components/AssessmentModal';
import { AssessmentStatsBody } from '../components/AssessmentStatsPanel';
import { groupOf, hasCopyContent } from '../lib/assessmentGroups';
import { sequencesPresent } from '../lib/carnetView';
import type { CopyOverview } from '../lib/copyStatus';
import { describeGrades, type GradeEntry, type GradeStatus } from '../lib/gradeStats';
import {
  ASSESSMENT_KIND_LABEL,
  fetchAssessmentGrades,
  fetchAssessments,
  fetchCarnetStudents,
  fetchCopyOverviews,
  rescaleGradesForBareme,
  setGradeAdapted,
  softDeleteAssessment,
  updateAssessment,
  updateSeriesAssessments,
  type AssessmentRow,
  type CarnetStudent,
  type GradeRow,
} from '../lib/evaluationQueries';

/**
 * La fiche d'une évaluation : tout ce qui la concerne, au même endroit (cf.
 * PLAN_ergonomie_evaluations.md). En-tête et réglages (Modifier, Supprimer), sujet et corrigé,
 * copies et notes classe par classe avec voir / valider / publier, la visionneuse, puis les
 * statistiques. L'URL porte l'éval d'une classe ; une série montre toutes ses classes, et
 * Modifier comme Statistiques portent sur la classe dont la visionneuse est ouverte.
 */
export function AssessmentSheet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [overviews, setOverviews] = useState<Record<string, CopyOverview>>({});
  const [sessionStarts, setSessionStarts] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  /** Élèves et notes de la classe en cours : pour Modifier (aménagements, barème) et les stats. */
  const [students, setStudents] = useState<CarnetStudent[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);

  const handleError = useCallback((message: string) => setError(message), []);

  const group = useMemo(() => (rows && id ? groupOf(rows, id) : null), [rows, id]);
  /** La classe en cours : celle dont la visionneuse est ouverte, sinon celle de l'URL. */
  const focus = useMemo(
    () => group?.items.find((a) => a.id === openId) ?? group?.items.find((a) => a.id === id) ?? null,
    [group, openId, id],
  );

  /** À l'arrivée seulement : la visionneuse de la classe de l'URL s'ouvre si elle a quelque chose à montrer. */
  const openedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const all = await fetchAssessments(user.id);
      setRows(all);
      const g = groupOf(all, id);
      if (!g) return;
      const d = await fetchCopyOverviews(g.items);
      setOverviews(d.overviews);
      setSessionStarts(d.sessionStarts);
      if (!openedOnce.current) {
        openedOnce.current = true;
        if (hasCopyContent(d.overviews[id])) setOpenId(id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
  }, [user, id]);

  useEffect(() => { void load(); }, [load]);

  const loadFocus = useCallback(async () => {
    if (!user || !focus) return;
    try {
      const [st, gr] = await Promise.all([fetchCarnetStudents(user.id, focus.class_id), fetchAssessmentGrades(focus.id)]);
      setStudents(st);
      setGrades(gr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notes introuvables');
    }
  }, [user, focus]);

  useEffect(() => { void loadFocus(); }, [loadFocus]);

  const reload = useCallback(async () => {
    await load();
    await loadFocus();
  }, [load, loadFocus]);

  const gradeBy = useMemo(() => new Map(grades.map((g) => [g.student_id, g])), [grades]);
  const entries: GradeEntry[] = useMemo(
    () => students.map((s) => {
      const row = gradeBy.get(s.id);
      return { studentId: s.id, grade: row?.grade ?? null, status: (row?.status ?? 'noted') as GradeStatus };
    }),
    [students, gradeBy],
  );
  const stats = useMemo(() => describeGrades(entries), [entries]);
  const adaptedIds = useMemo(() => new Set(grades.filter((g) => g.is_adapted).map((g) => g.student_id)), [grades]);
  const gradeRaws = useMemo(
    () => grades.filter((g) => g.status === 'noted' && g.grade_raw !== null).map((g) => Number(g.grade_raw)),
    [grades],
  );

  const toggleAdapted = async (studentId: string, value: boolean) => {
    if (!user || !focus) return;
    try {
      const row = await setGradeAdapted(user.id, focus.id, studentId, value);
      setGrades((prev) => [...prev.filter((g) => g.student_id !== row.student_id), row]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’aménagement');
    }
  };

  const backTo = focus
    ? `/evaluations?classe=${encodeURIComponent(focus.class_id)}&t=${focus.period ?? ''}`
    : '/evaluations';

  const handleDelete = async () => {
    if (!focus) return;
    const cls = focus.classes?.name ?? 'cette classe';
    const scope = group && group.items.length > 1 ? ` pour ${cls} seulement (les autres classes de la série restent)` : '';
    if (!window.confirm(`Supprimer « ${focus.name} »${scope} et ses notes du carnet ?`)) return;
    try {
      await softDeleteAssessment(focus.id);
      navigate(backTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  const bareme = focus ? Number(focus.bareme_total ?? 20) : 20;

  return (
    <Layout fluid>
      <div style={{ marginBottom: 16 }}>
        <Link to={backTo} style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 600, textDecoration: 'none' }}>
          ← Carnet{focus?.classes?.name ? ` ${focus.classes.name}` : ''}{focus?.period ? ` · T${focus.period}` : ''}
        </Link>
      </div>

      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {rows === null ? (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
      ) : !group || !focus || !user ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
          Cette évaluation n’existe plus (ou a été supprimée).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* En-tête : l'éval, ses classes, ses réglages */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {group.name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {ASSESSMENT_KIND_LABEL[focus.kind]} · {group.items.map((a) => a.classes?.name ?? '—').join(', ')}
                {' '}· /{bareme} · coef {Number(focus.coefficient)}
                {focus.period ? ` · T${focus.period}` : ''}
                {focus.sequence ? ` · ${focus.sequence}` : ''}
                {!focus.counts_in_average && ' · hors moyenne'}
                {group.items.length > 1 ? ' · sujet et corrigé communs' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)} style={btnGhost} title="Nom, type, date, barème, coefficient, aménagements">
                Modifier{group.items.length > 1 ? ` (${focus.classes?.name ?? ''})` : ''}
              </button>
              <button onClick={handleDelete} style={btnDanger}>
                Supprimer{group.items.length > 1 ? ` (${focus.classes?.name ?? ''})` : ''}
              </button>
            </div>
          </div>

          <AssessmentDetail
            group={group}
            overviews={overviews}
            sessionStarts={sessionStarts}
            userId={user.id}
            openId={openId}
            onOpen={setOpenId}
            onError={handleError}
            onReload={reload}
          />

          {/* Statistiques de la classe en cours, repliées par défaut */}
          <details style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Statistiques{group.items.length > 1 ? ` · ${focus.classes?.name ?? ''}` : ''}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                {stats.mean !== null ? ` · moyenne ${String(Math.round(stats.mean * 10) / 10).replace('.', ',')}` : ''}
              </span>
            </summary>
            <div style={{ marginTop: 14 }}>
              <AssessmentStatsBody assessment={focus} entries={entries} stats={stats} userId={user.id} />
            </div>
          </details>
        </div>
      )}

      {editing && focus && (
        <AssessmentModal
          title="Modifier l’évaluation"
          className={focus.classes?.name ?? ''}
          initial={{
            name: focus.name,
            bareme: Number(focus.bareme_total ?? 20),
            coefficient: Number(focus.coefficient),
            kind: focus.kind,
            date: focus.date ?? '',
            countsInAverage: focus.counts_in_average,
            shortName: focus.short_name ?? '',
            sequence: focus.sequence ?? '',
          }}
          sequences={sequencesPresent((rows ?? []).filter((r) => r.class_id === focus.class_id))}
          students={students}
          adaptedIds={adaptedIds}
          onToggleAdapted={toggleAdapted}
          gradeRaws={gradeRaws}
          onClose={() => setEditing(false)}
          seriesId={focus.series_id}
          onSubmit={async (values) => {
            const patch = {
              name: values.name,
              baremeTotal: values.bareme,
              coefficient: values.coefficient,
              kind: values.kind,
              countsInAverage: values.countsInAverage,
              shortName: values.shortName,
              sequence: values.sequence,
            };
            const oldBareme = Number(focus.bareme_total ?? 20);
            const convert = values.baremeMode === 'convert' && values.bareme !== oldBareme;
            // La date reste propre à la classe : chaque groupe passe l'éval son jour.
            // La publication, elle, se fait sur la ligne de la classe (bouton Publier).
            const ownFields = { date: values.date || null };
            if (values.applyToSeries && focus.series_id) {
              await updateSeriesAssessments(focus.series_id, patch, { rescaleRaw: convert });
              await updateAssessment(focus.id, ownFields);
            } else {
              await updateAssessment(focus.id, { ...patch, ...ownFields });
              if (convert) await rescaleGradesForBareme(focus.id, oldBareme, values.bareme);
            }
            setEditing(false);
            await reload();
          }}
        />
      )}
    </Layout>
  );
}

const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit',
};
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
const btnDanger: React.CSSProperties = { ...btnBase, background: 'var(--neg-soft)', color: 'var(--neg)' };
