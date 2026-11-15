import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { ALL_CLASSES, AssessmentDetail, type SeriesSummary } from '../components/AssessmentDetail';
import { AssessmentDocButtons } from '../components/AssessmentDocButtons';
import { AssessmentModal } from '../components/AssessmentModal';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { DuplicateAssessmentDialog } from '../components/DuplicateAssessmentDialog';
import { GroupSessionDetail } from '../components/groups/GroupSessionDetail';
import { ActivityClassPanel } from '../components/productions/ActivityClassPanel';
import { fetchActivityForAssessment, type ActivityRow } from '../lib/productionsQueries';
import { groupOf } from '../lib/assessmentGroups';
import { sequencesPresent } from '../lib/carnetView';
import { summarizeSeries } from '../lib/seriesSummary';
import type { CopyOverview } from '../lib/copyStatus';
import { describeGrades, type GradeEntry, type GradeStatus } from '../lib/gradeStats';
import {
  ASSESSMENT_KIND_LABEL,
  fetchAssessmentGrades,
  fetchAssessments,
  fetchCarnetStudents,
  fetchCopyOverviews,
  fetchSeriesComparison,
  rescaleGradesForBareme,
  setGradeAdapted,
  softDeleteAssessment,
  updateAssessment,
  updateSeriesAssessments,
  type AssessmentRow,
  type CarnetStudent,
  type GradeRow,
  type SeriesClassRow,
} from '../lib/evaluationQueries';

/**
 * La fiche d'une évaluation : tout ce qui la concerne, au même endroit (cf.
 * PLAN_ergonomie_evaluations.md). Un en-tête compact (sujet, corrigé, réglages dans ⋯), puis un
 * onglet par classe — copies, statistiques en une ligne, valider / publier — et, pour une série,
 * un onglet Ensemble qui compare les classes. L'URL porte l'éval d'une classe : son onglet
 * s'ouvre à l'arrivée, et Modifier comme Supprimer portent sur la classe affichée.
 */
export function AssessmentSheet() {
  const { id } = useParams<{ id: string }>();
  /** Lien depuis la modale du carnet : la production de cet élève s'ouvre à l'arrivée. */
  const [searchParams] = useSearchParams();
  const studentParam = searchParams.get('eleve');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [overviews, setOverviews] = useState<Record<string, CopyOverview>>({});
  const [sessionStarts, setSessionStarts] = useState<Record<string, string>>({});
  /** Classe affichée (id d'éval) ; à défaut, celle de l'URL. */
  const [classId, setClassId] = useState<string | null>(null);
  /** Onglet Ensemble d'une série. */
  const [showAll, setShowAll] = useState(false);
  /** Notes de toutes les classes d'une série : moyennes des onglets et onglet Ensemble. */
  const [seriesRows, setSeriesRows] = useState<SeriesClassRow[] | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesTick, setSeriesTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  /** Activité numérique liée à l'éval de la classe en cours (phase 6), si elle existe. */
  const [activity, setActivity] = useState<{ assessmentId: string; row: ActivityRow | null } | null>(null);

  /** Élèves et notes de la classe en cours : pour Modifier (aménagements, barème) et les stats. */
  const [students, setStudents] = useState<CarnetStudent[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  /** Éval dont `students` et `grades` sont chargés : pas de statistiques d'une autre classe pendant un changement d'onglet. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const handleError = useCallback((message: string) => setError(message), []);

  const group = useMemo(() => (rows && id ? groupOf(rows, id) : null), [rows, id]);
  /** La classe en cours : celle de l'onglet choisi, sinon celle de l'URL. */
  const focus = useMemo(
    () => group?.items.find((a) => a.id === classId) ?? group?.items.find((a) => a.id === id) ?? null,
    [group, classId, id],
  );

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
      setLoadedFor(focus.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notes introuvables');
    }
  }, [user, focus]);

  useEffect(() => { void loadFocus(); }, [loadFocus]);

  const focusId = focus?.id ?? null;
  useEffect(() => {
    if (!focusId) return;
    let alive = true;
    fetchActivityForAssessment(focusId)
      .then((row) => { if (alive) setActivity({ assessmentId: focusId, row }); })
      .catch(() => { if (alive) setActivity({ assessmentId: focusId, row: null }); });
    return () => { alive = false; };
  }, [focusId]);
  const linkedActivity = activity && activity.assessmentId === focusId ? activity.row : null;

  const seriesId = group && group.items.length > 1 ? group.seriesId : null;
  useEffect(() => {
    if (!user || !seriesId) return;
    let alive = true;
    fetchSeriesComparison(user.id, seriesId)
      .then((r) => { if (alive) { setSeriesRows(r); setSeriesError(null); } })
      .catch((e) => { if (alive) setSeriesError(e instanceof Error ? e.message : 'Comparaison indisponible'); });
    return () => { alive = false; };
  }, [user, seriesId, seriesTick]);

  const reload = useCallback(async () => {
    await load();
    await loadFocus();
    setSeriesTick((t) => t + 1);
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
  const ready = !!focus && loadedFor === focus.id;
  const focusStats = useMemo(() => (ready ? { stats, entries } : null), [ready, stats, entries]);

  const series: SeriesSummary | null = useMemo(() => {
    if (!seriesId) return null;
    if (!seriesRows) return { classes: [], level: null, total: 0, loading: !seriesError, error: seriesError };
    return { ...summarizeSeries(seriesRows), loading: false, error: seriesError };
  }, [seriesId, seriesRows, seriesError]);

  /** Moyenne de chaque classe pour les onglets : la série si elle est chargée, sinon la classe affichée. */
  const classMeans = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const c of series?.classes ?? []) m[c.assessmentId] = c.stats.mean;
    if (focusStats && focus) m[focus.id] = focusStats.stats.mean;
    return m;
  }, [series, focusStats, focus]);
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

  // Réglages de l'éval : rares, ils passent dans ⋯. Dans une série, Modifier et Supprimer
  // portent sur la classe affichée (Modifier propose ensuite d'appliquer à toute la série).
  const forClass = group && group.items.length > 1 && focus?.classes?.name ? ` (${focus.classes.name})` : '';
  const evalMenu: MoreMenuItem[] = focus
    ? [
        { label: `Modifier${forClass}…`, onClick: () => setEditing(true), title: 'Nom, type, date, barème, coefficient, aménagements' },
        ...(focus.kind !== 'groupe'
          ? [{ label: 'Dupliquer…', onClick: () => setDuplicating(true), title: 'Même éval pour une autre classe, ou une nouvelle fois : réglages, sujet et corrigé, sans les notes' }]
          : []),
        { label: `Supprimer${forClass}`, onClick: () => { void handleDelete(); }, danger: true },
      ]
    : [];

  return (
    <Layout fluid>
      <div style={{ marginBottom: 6 }}>
        <Link to={backTo} style={{ fontSize: 13, color: 'var(--indigo)', fontWeight: 600, textDecoration: 'none' }}>
          ← Carnet{focus?.classes?.name ? ` ${focus.classes.name}` : ''}{focus?.period ? ` · T${focus.period}` : ''}
        </Link>
      </div>

      {error && (
        <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {rows === null ? (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
      ) : !group || !focus || !user ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
          Cette évaluation n’existe plus (ou a été supprimée).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            {/* En-tête : l'éval, sujet et corrigé, réglages rangés dans ⋯ */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 className="page-title">{group.name}</h1>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ASSESSMENT_KIND_LABEL[focus.kind]} · /{bareme} · coef {Number(focus.coefficient)}
                  {focus.sequence ? ` · ${focus.sequence}` : ''}
                  {!focus.counts_in_average && ' · hors moyenne'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AssessmentDocButtons group={group} userId={user.id} onReload={reload} onError={handleError} />
                <MoreMenu items={evalMenu} title="Modifier, dupliquer, supprimer" />
              </div>
            </div>

            <AssessmentDetail
              group={group}
              overviews={overviews}
              sessionStarts={sessionStarts}
              userId={user.id}
              selected={showAll ? ALL_CLASSES : focus.id}
              onSelect={(key) => {
                if (key === ALL_CLASSES) { setShowAll(true); return; }
                setShowAll(false);
                setClassId(key);
              }}
              classMeans={classMeans}
              focusStats={focusStats}
              series={series}
              onError={handleError}
              onReload={reload}
            />
          </div>

          {/* Production numérique (phase 6) : l'activité pour cette classe, ses envois et leur correction. */}
          {!showAll && linkedActivity && (
            <section aria-label="Activité numérique" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Activité numérique{group.items.length > 1 ? ` · ${focus.classes?.name ?? ''}` : ''}</div>
              <ActivityClassPanel
                key={`${linkedActivity.id}|${focus.id}`}
                activity={linkedActivity}
                classId={focus.class_id}
                className={focus.classes?.name ?? ''}
                assessmentId={focus.id}
                initialStudentId={studentParam}
                onActivityChange={(a) => setActivity({ assessmentId: focus.id, row: a })}
                onGradesSynced={() => { void reload(); }}
              />
            </section>
          )}

          {/* TP de groupe (migration 063) : la séance elle-même, ses critères, groupes, matériel et photos. */}
          {!showAll && focus.kind === 'groupe' && focus.group_session_id && (
            <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }} aria-label="Séance de groupe">
              <div style={{ padding: '14px 16px 0', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Séance de groupe</div>
              <GroupSessionDetail
                sessionId={focus.group_session_id}
                onChanged={() => { void reload(); }}
                onDeleted={() => navigate(backTo)}
              />
            </section>
          )}
        </div>
      )}

      {duplicating && focus && user && (
        <DuplicateAssessmentDialog
          source={focus}
          userId={user.id}
          onClose={() => setDuplicating(false)}
          onCreated={(newId) => { setDuplicating(false); navigate(`/evaluations/${newId}`); }}
        />
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
