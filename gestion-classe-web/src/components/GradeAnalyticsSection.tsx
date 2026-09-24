import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchCurrentPeriod } from '../lib/evaluationQueries';
import {
  fetchGradeAnalytics,
  computeClassStats,
  computeGenderStats,
  computeGlobalStats,
  computeSeriesComparison,
  computeStudentRows,
  computeTimeline,
  describeCorrelation,
  pearson,
  type AnalyticsStudent,
  type GradeAnalyticsData,
} from '../lib/gradeAnalytics';
import { formatGrade, formatRate } from '../lib/gradeStats';

/**
 * Bloc « Notes » de l'onglet Analyses.
 *
 * L'onglet raisonnait jusqu'ici en événements (comportement) et en notes d'oral ; les
 * notes du carnet n'y figuraient pas. Tout est ici plutôt que dans `Analytics.tsx` :
 * le fichier est déjà long, et ces vues ont leur propre filtre de période — le carnet
 * se lit par trimestre, pas sur une fenêtre glissante de 30 jours.
 */

interface ClassOption {
  id: string;
  name: string;
}

interface BehaviourEvent {
  student_id: string;
  type: string;
}

interface Props {
  userId: string;
  classes: ClassOption[];
  selectedClasses: string[];
  students: AnalyticsStudent[];
  events: BehaviourEvent[];
}

/** Une teinte par classe, réutilisée dans toutes les vues du bloc. */
const CLASS_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#84cc16', '#0ea5e9', '#f97316',
];

const CARD = 'bg-[var(--surface)] p-5';
const CARD_STYLE = { borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' } as const;

/** Vert au-dessus de 12, orange au-dessus de 10, rouge en dessous. */
function gradeColor(value: number | null): string {
  if (value === null) return 'var(--text-dim)';
  if (value >= 12) return '#22c55e';
  if (value >= 10) return '#f59e0b';
  return '#ef4444';
}

type PeriodFilter = 'all' | 1 | 2 | 3;

export function GradeAnalyticsSection({ userId, classes, selectedClasses, students, events }: Props) {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [schoolYear, setSchoolYear] = useState<string | null>(null);
  const [data, setData] = useState<GradeAnalyticsData>({ assessments: [], grades: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(10);
  const [crossMetric, setCrossMetric] = useState<'participation' | 'bavardage'>('participation');

  useEffect(() => {
    if (!userId) return;
    fetchCurrentPeriod(userId)
      .then((p) => setSchoolYear(p.schoolYear))
      .catch(() => setSchoolYear(null));
  }, [userId]);

  useEffect(() => {
    if (!userId || !schoolYear) return;
    let cancelled = false;
    // Sélection vide : `fetchGradeAnalytics` rend un résultat vide sans requête, ce qui
    // évite un setState synchrone dans l'effet (cascade de rendus).
    fetchGradeAnalytics(userId, selectedClasses, schoolYear, period === 'all' ? null : period)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Erreur de chargement des notes');
        setData({ assessments: [], grades: [] });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, schoolYear, selectedClasses, period]);

  const visibleStudents = useMemo(
    () => students.filter((s) => selectedClasses.includes(s.classId)),
    [students, selectedClasses],
  );

  const classStats = useMemo(() => computeClassStats(data, visibleStudents), [data, visibleStudents]);
  const globalStats = useMemo(() => computeGlobalStats(data), [data]);
  const studentRows = useMemo(() => computeStudentRows(data, visibleStudents), [data, visibleStudents]);
  const timeline = useMemo(() => computeTimeline(data), [data]);
  const seriesRows = useMemo(() => computeSeriesComparison(data), [data]);
  const genderStats = useMemo(() => computeGenderStats(studentRows, visibleStudents), [studentRows, visibleStudents]);

  /** Moyenne générale au sens du bulletin : moyenne des moyennes d'élèves. */
  const overallAverage = useMemo(() => {
    const values = studentRows.map((r) => r.average).filter((v): v is number => v !== null);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  }, [studentRows]);

  const classColor = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c, i) => map.set(c.id, CLASS_COLORS[i % CLASS_COLORS.length]));
    return map;
  }, [classes]);

  const activeClasses = useMemo(
    () => classStats.map((c) => ({ id: c.classId, name: c.className })),
    [classStats],
  );

  // --- Croisement notes × comportement -------------------------------------
  const crossPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.type !== crossMetric) continue;
      counts.set(e.student_id, (counts.get(e.student_id) ?? 0) + 1);
    }
    return studentRows
      .filter((r) => r.average !== null)
      .map((r) => ({
        x: counts.get(r.studentId) ?? 0,
        y: Number((r.average as number).toFixed(2)),
        pseudo: r.pseudo,
        className: r.className,
        classId: r.classId,
      }));
  }, [events, studentRows, crossMetric]);

  const correlation = useMemo(
    () => pearson(crossPoints.map((p) => ({ x: p.x, y: p.y }))),
    [crossPoints],
  );

  const watchList = useMemo(
    () => studentRows.filter((r) => r.average !== null && r.average < threshold),
    [studentRows, threshold],
  );

  const timelineData = useMemo(
    () => timeline.map((p) => {
      const row: Record<string, string | number | null> = {
        label: p.label,
        overall: p.overall === null ? null : Number(p.overall.toFixed(2)),
      };
      for (const [classId, value] of Object.entries(p.byClass)) {
        row[classId] = value === null ? null : Number(value.toFixed(2));
      }
      return row;
    }),
    [timeline],
  );

  const histogramData = useMemo(
    () => globalStats.histogram.map((b) => ({
      name: `${b.from}–${b.to}`,
      eleves: b.count,
    })),
    [globalStats],
  );

  const tooltipStyle = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  };

  return (
    <div className="space-y-6">
      {/* En-tête + filtre de période */}
      <div className={CARD} style={CARD_STYLE}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text)]">Notes du carnet</h3>
            <p className="text-sm text-[var(--text-dim)]">
              {schoolYear ? `Année ${schoolYear}` : 'Année en cours'} ·{' '}
              {data.assessments.length} évaluation{data.assessments.length > 1 ? 's' : ''} ·{' '}
              {globalStats.count} note{globalStats.count > 1 ? 's' : ''}
              {globalStats.pending > 0 && ` · ${globalStats.pending} à corriger`}
            </p>
          </div>
          <div className="flex gap-1">
            {([['all', 'Année'], [1, 'T1'], [2, 'T2'], [3, 'T3']] as [PeriodFilter, string][]).map(
              ([id, label]) => (
                <button
                  key={String(id)}
                  onClick={() => setPeriod(id)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    period === id
                      ? 'bg-[var(--indigo)] text-white'
                      : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:bg-[var(--border)]'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
      </div>

      {isLoading ? (
        <div className={CARD} style={CARD_STYLE}>
          <p className="text-[var(--text-dim)] text-center py-6">Chargement des notes…</p>
        </div>
      ) : globalStats.count === 0 ? (
        <div className={CARD} style={CARD_STYLE}>
          <p className="text-[var(--text-dim)] text-center py-6">
            Aucune note saisie pour cette sélection. Les notes se saisissent dans
            Évaluations › Carnet.
          </p>
        </div>
      ) : (
        <>
          {/* Cartes de synthèse */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Moyenne générale" value={`${formatGrade(overallAverage)}/20`} color={gradeColor(overallAverage)} />
            <StatCard label="Médiane" value={`${formatGrade(globalStats.median)}/20`} color={gradeColor(globalStats.median)} />
            <StatCard label="Écart-type" value={formatGrade(globalStats.stdDev)} color="var(--indigo)" />
            <StatCard label="Notes ≥ 10" value={formatRate(globalStats.successRate)} color={gradeColor(globalStats.successRate === null ? null : globalStats.successRate * 20)} />
            <StatCard
              label="Amplitude"
              value={`${formatGrade(globalStats.min)} – ${formatGrade(globalStats.max)}`}
              color="var(--indigo)"
            />
          </div>

          {/* Distribution + filles/garçons */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className={CARD} style={CARD_STYLE}>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Distribution des notes</h3>
              <p className="text-sm text-[var(--text-dim)] mb-4">
                Q1 {formatGrade(globalStats.q1)} · médiane {formatGrade(globalStats.median)} · Q3 {formatGrade(globalStats.q3)}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} />
                  <YAxis stroke="var(--text-dim)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} élève(s)`, 'Effectif']} />
                  <Bar dataKey="eleves" name="Élèves" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={CARD} style={CARD_STYLE}>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Filles / Garçons</h3>
              <p className="text-sm text-[var(--text-dim)] mb-4">
                Moyenne des moyennes d'élèves, sur la sélection en cours.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    {
                      name: `Filles (${genderStats.filles.count})`,
                      moyenne: genderStats.filles.average === null ? 0 : Number(genderStats.filles.average.toFixed(2)),
                    },
                    {
                      name: `Garçons (${genderStats.garcons.count})`,
                      moyenne: genderStats.garcons.average === null ? 0 : Number(genderStats.garcons.average.toFixed(2)),
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={12} />
                  <YAxis domain={[0, 20]} stroke="var(--text-dim)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/20`, 'Moyenne']} />
                  <Bar dataKey="moyenne" name="Moyenne /20" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Évolution */}
          <div className={CARD} style={CARD_STYLE}>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-1">Évolution des moyennes</h3>
            <p className="text-sm text-[var(--text-dim)] mb-4">
              Une évaluation par point, dans l'ordre chronologique. Les classes qui passent
              le même devoir partagent le point.
            </p>
            {timelineData.length === 0 ? (
              <p className="text-[var(--text-dim)] py-6 text-center">Aucune évaluation notée.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--text-dim)" fontSize={11} interval="preserveStartEnd" />
                  <YAxis domain={[0, 20]} stroke="var(--text-dim)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/20`]} />
                  <Legend />
                  {activeClasses.map((c) => (
                    <Line
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      name={c.name}
                      stroke={classColor.get(c.id) ?? '#6366f1'}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                  {activeClasses.length > 1 && (
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Toutes classes"
                      stroke="var(--text-muted)"
                      strokeDasharray="5 3"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tableau par classe */}
          <div className="bg-[var(--surface)] overflow-hidden" style={CARD_STYLE}>
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text)]">Moyennes par classe</h3>
              <p className="text-sm text-[var(--text-dim)] mt-1">
                La moyenne de classe est la moyenne des moyennes d'élèves, pondérées par les
                coefficients — comme au bulletin.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-3)]">
                    {['Classe', 'Moyenne', 'Médiane', 'Écart-type', 'Min – Max', '≥ 10', 'Évals', 'Élèves'].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-sm font-medium text-[var(--text-muted)] ${i === 0 ? 'text-left' : 'text-center'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classStats.map((c) => (
                    <tr key={c.classId} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: classColor.get(c.classId) ?? '#6366f1' }}
                          />
                          <span className="font-medium text-[var(--text)]">{c.className}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-2 py-1 text-sm font-bold"
                          style={{
                            color: gradeColor(c.classAverage),
                            backgroundColor: `${gradeColor(c.classAverage)}20`,
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {formatGrade(c.classAverage)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text)]">{formatGrade(c.stats.median)}</td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text)]">{formatGrade(c.stats.stdDev)}</td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">
                        {formatGrade(c.stats.min)} – {formatGrade(c.stats.max)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text)]">{formatRate(c.stats.successRate)}</td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">{c.assessmentCount}</td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">{c.studentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparaison des classes sur une même éval */}
          {seriesRows.length > 0 && (
            <div className="bg-[var(--surface)] overflow-hidden" style={CARD_STYLE}>
              <div className="p-5 border-b border-[var(--border)]">
                <h3 className="text-lg font-semibold text-[var(--text)]">Même devoir, classes différentes</h3>
                <p className="text-sm text-[var(--text-dim)] mt-1">
                  Les évaluations passées par plusieurs classes. L'écart est la différence
                  entre la meilleure et la moins bonne moyenne.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-3)]">
                      <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Évaluation</th>
                      {activeClasses.map((c) => (
                        <th key={c.id} className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">
                          {c.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seriesRows.map((row) => (
                      <tr key={row.seriesId} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                        <td className="px-4 py-3 font-medium text-[var(--text)]">{row.name}</td>
                        {activeClasses.map((c) => {
                          const v = row.byClass[c.id] ?? null;
                          const isBest = row.best === c.id;
                          const isWorst = row.worst === c.id;
                          return (
                            <td key={c.id} className="px-4 py-3 text-center text-sm">
                              <span
                                className="px-2 py-1 font-medium"
                                style={{
                                  color: v === null ? 'var(--text-dim)' : isBest ? '#22c55e' : isWorst ? '#ef4444' : 'var(--text)',
                                  backgroundColor: v === null ? 'transparent' : isBest ? '#22c55e20' : isWorst ? '#ef444420' : 'transparent',
                                  borderRadius: 'var(--radius-md)',
                                }}
                              >
                                {formatGrade(v)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">
                          {row.spread === null ? '—' : `${formatGrade(row.spread)} pts`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Élèves à surveiller */}
          <div className="bg-[var(--surface)] overflow-hidden" style={CARD_STYLE}>
            <div className="p-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Élèves à surveiller</h3>
                <p className="text-sm text-[var(--text-dim)] mt-1">
                  Moyenne sous le seuil. « Tendance » compare les trois dernières notes aux
                  précédentes : une baisse marquée sur une bonne moyenne se voit ici.
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {[8, 10, 12].map((t) => (
                  <button
                    key={t}
                    onClick={() => setThreshold(t)}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      threshold === t
                        ? 'bg-[var(--indigo)] text-white'
                        : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:bg-[var(--border)]'
                    }`}
                  >
                    &lt; {t}
                  </button>
                ))}
              </div>
            </div>
            {watchList.length === 0 ? (
              <p className="p-5 text-[var(--text-dim)]">
                Aucun élève sous {threshold}/20 sur cette sélection.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-3)]">
                      {['Élève', 'Classe', 'Moyenne', 'Écart classe', 'Tendance', 'Notes'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-sm font-medium text-[var(--text-muted)] ${i === 0 ? 'text-left' : 'text-center'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {watchList.map((r) => (
                      <tr key={r.studentId} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                        <td className="px-4 py-3 font-medium text-[var(--text)]">{r.pseudo}</td>
                        <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">{r.className}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="px-2 py-1 text-sm font-bold"
                            style={{
                              color: gradeColor(r.average),
                              backgroundColor: `${gradeColor(r.average)}20`,
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            {formatGrade(r.average)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">
                          {r.gap === null ? '—' : `${r.gap > 0 ? '+' : ''}${formatGrade(r.gap)}`}
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          <TrendCell trend={r.trend} />
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes × comportement */}
          <div className={CARD} style={CARD_STYLE}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-1">
              <h3 className="text-lg font-semibold text-[var(--text)]">Notes et comportement</h3>
              <div className="flex gap-1">
                {([['participation', 'Participations'], ['bavardage', 'Malus']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setCrossMetric(id)}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      crossMetric === id
                        ? 'bg-[var(--indigo)] text-white'
                        : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:bg-[var(--border)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-[var(--text-dim)] mb-4">
              Un point par élève, sur la période d'événements choisie plus haut.{' '}
              {describeCorrelation(correlation)} — une corrélation n'est pas une cause.
            </p>
            {crossPoints.length < 3 ? (
              <p className="text-[var(--text-dim)] py-6 text-center">
                Pas assez d'élèves ayant à la fois des notes et des événements.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={crossMetric === 'participation' ? 'Participations' : 'Malus'}
                    stroke="var(--text-dim)"
                    fontSize={12}
                    allowDecimals={false}
                  />
                  <YAxis type="number" dataKey="y" name="Moyenne" domain={[0, 20]} stroke="var(--text-dim)" fontSize={12} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => [value, name === 'y' ? 'Moyenne /20' : name]}
                    labelFormatter={() => ''}
                  />
                  <Legend />
                  {activeClasses.map((c) => (
                    <Scatter
                      key={c.id}
                      name={c.name}
                      data={crossPoints.filter((p) => p.classId === c.id)}
                      fill={classColor.get(c.id) ?? '#6366f1'}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TrendCell({ trend }: { trend: number | null }) {
  if (trend === null) return <span className="text-[var(--text-dim)]">—</span>;
  const up = trend > 0.5;
  const down = trend < -0.5;
  const color = up ? '#22c55e' : down ? '#ef4444' : 'var(--text-muted)';
  const arrow = up ? '▲' : down ? '▼' : '→';
  return (
    <span style={{ color }} className="font-medium">
      {arrow} {trend > 0 ? '+' : ''}{formatGrade(trend)}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--surface)] p-4" style={CARD_STYLE}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm text-[var(--text-dim)]">{label}</div>
    </div>
  );
}
