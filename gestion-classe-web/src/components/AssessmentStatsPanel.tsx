import { useEffect, useState } from 'react';
import {
  fetchSeriesComparison,
  type AssessmentRow,
  type SeriesClassRow,
} from '../lib/evaluationQueries';
import {
  describeGrades,
  formatGrade,
  formatRate,
  STATUS_LABEL,
  type GradeEntry,
  type GradeStats,
  type GradeStatus,
  type Histogram,
} from '../lib/gradeStats';

/**
 * Panneau de statistiques d'une évaluation (cf. PLAN_carnet_de_notes.md, lot 4).
 *
 * S'ouvre depuis l'en-tête d'une colonne du carnet. Quand l'évaluation appartient à une
 * série, il affiche aussi la comparaison entre les classes du niveau — la vue qui répond
 * à « est-ce que mes 5e2 ont décroché ? ».
 */

// ============================================================
// Histogramme
// ============================================================

/**
 * Distribution des notes par tranches de 2 points.
 *
 * Série unique, donc une seule teinte (`--indigo`) et pas de légende : le titre nomme
 * la série. Les effectifs sont écrits au-dessus des barres, ce qui rend le graphique
 * lisible sans la couleur et dispense d'une vue tableau séparée.
 */
function HistogramChart({ buckets, total }: { buckets: Histogram[]; total: number }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const PLOT_HEIGHT = 96;

  if (total === 0) {
    return (
      <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '16px 0' }}>
        Aucune note exploitable pour tracer la distribution.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: PLOT_HEIGHT + 18 }}>
        {buckets.map((b) => {
          const h = b.count === 0 ? 0 : Math.max(3, (b.count / max) * PLOT_HEIGHT);
          const label = `${b.from}–${b.to}${b.to === 20 ? ' inclus' : ''} : ${b.count} élève${b.count > 1 ? 's' : ''}`;
          return (
            <div
              key={b.from}
              title={label}
              aria-label={label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}
            >
              <span style={{ fontSize: 10, color: b.count ? 'var(--text-muted)' : 'transparent', marginBottom: 2 }}>
                {b.count || 0}
              </span>
              <div
                style={{
                  width: '100%',
                  height: h,
                  background: b.count ? 'var(--indigo)' : 'var(--surface-3)',
                  // Extrémité arrondie côté données, ancrée sur la ligne de base.
                  borderRadius: '4px 4px 0 0',
                  minHeight: b.count ? undefined : 3,
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
        {buckets.map((b) => (
          <div key={b.from} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-dim)' }}>
            {b.from}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
        Note sur 20, par tranches de 2 points.
      </div>
    </div>
  );
}

// ============================================================
// Panneau
// ============================================================

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

export function AssessmentStatsPanel({
  assessment, entries, stats, userId, onClose, onEdit,
}: {
  assessment: AssessmentRow;
  entries: GradeEntry[];
  stats: GradeStats;
  userId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [series, setSeries] = useState<SeriesClassRow[] | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessment.series_id) return;
    let alive = true;
    fetchSeriesComparison(userId, assessment.series_id)
      .then((rows) => { if (alive) setSeries(rows); })
      .catch((e) => { if (alive) setSeriesError(e instanceof Error ? e.message : 'Comparaison indisponible'); });
    return () => { alive = false; };
  }, [assessment.series_id, userId]);

  const total = entries.length;
  const bareme = Number(assessment.bareme_total ?? 20);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 110, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '96vw', height: '100%', overflowY: 'auto',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          padding: 24, boxSizing: 'border-box', boxShadow: 'var(--shadow-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {assessment.name}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {assessment.classes?.name ?? '—'} · T{assessment.period ?? '?'} ·
              {' '}coef {Number(assessment.coefficient)} · /{bareme}
              {assessment.date ? ` · ${new Date(assessment.date).toLocaleDateString('fr-FR')}` : ''}
              {!assessment.counts_in_average && ' · hors moyenne'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Indicateurs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20 }}>
          <Stat label="Moyenne" value={formatGrade(stats.mean)} />
          <Stat label="Médiane" value={formatGrade(stats.median)} />
          <Stat label="Écart-type" value={formatGrade(stats.stdDev)} />
          <Stat label="Min" value={formatGrade(stats.min)} />
          <Stat label="Max" value={formatGrade(stats.max)} />
          <Stat label="≥ 10/20" value={formatRate(stats.successRate)} />
          <Stat label="Q1" value={formatGrade(stats.q1)} />
          <Stat label="Q3" value={formatGrade(stats.q3)} />
          <Stat label="Notes" value={`${stats.count}/${total}`} />
        </div>

        {/* Distribution */}
        <h4 style={sectionTitle}>Distribution</h4>
        <HistogramChart buckets={stats.histogram} total={stats.count} />

        {/* Effectifs par statut */}
        <h4 style={sectionTitle}>Effectifs</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(Object.keys(stats.statusCounts) as GradeStatus[])
            .filter((s) => stats.statusCounts[s] > 0)
            .map((s) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)' }}>
                <span>{STATUS_LABEL[s]}</span>
                <strong>{stats.statusCounts[s]}</strong>
              </div>
            ))}
          {stats.pending > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--warn)' }}>
              <span>Dont pas encore corrigées</span>
              <strong>{stats.pending}</strong>
            </div>
          )}
        </div>

        {/* Comparaison entre classes de la série */}
        {assessment.series_id && (
          <>
            <h4 style={sectionTitle}>Comparaison entre classes</h4>
            {seriesError ? (
              <div style={{ fontSize: 13, color: 'var(--neg)' }}>{seriesError}</div>
            ) : series === null ? (
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Chargement…</div>
            ) : (
              <SeriesComparison rows={series} currentId={assessment.id} />
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button onClick={onEdit} style={btnPrimary}>Modifier l’évaluation</button>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Comparaison inter-classes : un tableau, pas un graphique. Trois à cinq classes sur
 * quatre indicateurs se lisent mieux alignées que dessinées, et les valeurs exactes
 * sont ce qui est utile ici.
 */
function SeriesComparison({ rows, currentId }: { rows: SeriesClassRow[]; currentId: string }) {
  const computed = rows.map((r) => ({
    ...r,
    stats: describeGrades(
      r.entries.map((e, i) => ({
        studentId: String(i),
        grade: e.grade,
        status: e.status as GradeStatus,
      })),
    ),
  }));

  const overall = computed.flatMap((c) =>
    c.entries.map((e, i) => ({ studentId: String(i), grade: e.grade, status: e.status as GradeStatus })),
  );
  const levelStats = describeGrades(overall);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          {['Classe', 'Moy.', 'Méd.', '≥10', 'Notes'].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 4px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {computed.map((c) => (
          <tr key={c.assessmentId} style={{ background: c.assessmentId === currentId ? 'var(--indigo-soft)' : undefined }}>
            <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)', fontWeight: c.assessmentId === currentId ? 700 : 400 }}>
              {c.className}
            </td>
            <td style={tdNum}>{formatGrade(c.stats.mean)}</td>
            <td style={tdNum}>{formatGrade(c.stats.median)}</td>
            <td style={tdNum}>{formatRate(c.stats.successRate)}</td>
            <td style={tdNum}>{c.stats.count}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td style={{ padding: '6px 4px', borderTop: '2px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)' }}>
            Ensemble
          </td>
          <td style={{ ...tdNum, borderTop: '2px solid var(--border)', fontWeight: 700 }}>{formatGrade(levelStats.mean)}</td>
          <td style={{ ...tdNum, borderTop: '2px solid var(--border)', fontWeight: 700 }}>{formatGrade(levelStats.median)}</td>
          <td style={{ ...tdNum, borderTop: '2px solid var(--border)', fontWeight: 700 }}>{formatRate(levelStats.successRate)}</td>
          <td style={{ ...tdNum, borderTop: '2px solid var(--border)', fontWeight: 700 }}>{levelStats.count}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '24px 0 10px',
};
const tdNum: React.CSSProperties = {
  padding: '6px 4px', textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--text)',
};
const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
