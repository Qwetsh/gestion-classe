import { formatGrade, formatRate, type GradeStats } from '../lib/gradeStats';
import type { ClassGradeSummary } from '../lib/seriesSummary';

/**
 * Les statistiques de la fiche d'une évaluation, au plus près des copies :
 * - `StatsStrip` : une ligne au-dessus de la visionneuse (moyenne, médiane, part ≥ 10,
 *   mini-histogramme), dépliable vers le détail ;
 * - `SeriesOverview` : l'onglet « Ensemble » d'une série, qui compare les classes sur une
 *   même échelle 0–20 (boîte à moustaches) plutôt qu'en tableau seul.
 */

// ============================================================
// Bandeau d'une classe
// ============================================================

export function StatsStrip({ stats, open, onToggle }: { stats: GradeStats; open: boolean; onToggle: () => void }) {
  if (stats.count === 0) {
    return (
      <div style={{ ...strip, color: 'var(--text-dim)' }}>
        Pas encore de note
      </div>
    );
  }
  const max = Math.max(1, ...stats.histogram.map((b) => b.count));
  return (
    <div style={strip}>
      <span>Moy. <b style={num}>{formatGrade(stats.mean)}</b></span>
      <Sep />
      <span>méd. <b style={num}>{formatGrade(stats.median)}</b></span>
      <Sep />
      <span><b style={num}>{formatRate(stats.successRate)}</b> ≥ 10</span>
      <span
        aria-hidden
        title="Répartition des notes, par tranches de 2 points"
        style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 16, marginLeft: 10 }}
      >
        {stats.histogram.map((b) => (
          <span
            key={b.from}
            style={{ width: 4, height: Math.max(2, (b.count / max) * 16), background: 'var(--indigo)', opacity: 0.45, borderRadius: 1 }}
          />
        ))}
      </span>
      <button onClick={onToggle} aria-expanded={open} style={toggleBtn}>
        Statistiques {open ? '▴' : '▾'}
      </button>
    </div>
  );
}

function Sep() {
  return <span style={{ color: 'var(--text-dim)' }}>·</span>;
}

// ============================================================
// Onglet « Ensemble »
// ============================================================

export function SeriesOverview({ classes, level, total, loading, error, onOpenClass }: {
  classes: ClassGradeSummary[];
  level: GradeStats | null;
  total: number;
  loading: boolean;
  error: string | null;
  onOpenClass: (assessmentId: string) => void;
}) {
  if (error) return <div style={{ padding: 16, fontSize: 13, color: 'var(--neg)' }}>{error}</div>;
  if (loading || !level) return <div style={{ padding: 16, fontSize: 13, color: 'var(--text-dim)' }}>Chargement…</div>;

  const means = classes.map((c) => c.stats.mean).filter((m): m is number => m !== null);
  const spread = means.length > 1 ? Math.max(...means) - Math.min(...means) : null;

  return (
    <div style={{ paddingTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <Kpi label="Moyenne du niveau" value={formatGrade(level.mean)} />
        <Kpi label="≥ 10/20" value={formatRate(level.successRate)} />
        <Kpi label="Notés" value={`${level.count}/${total}`} />
        {spread !== null && <Kpi label="Écart entre classes" value={`${formatGrade(spread)} pt${spread >= 2 ? 's' : ''}`} />}
      </div>

      <div role="table" aria-label="Comparaison des classes" style={{ marginTop: 16 }}>
        <div role="row" style={{ ...gridRow, fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <span role="columnheader">Classe</span>
          <span role="columnheader" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>0</span><span>10</span><span>20</span>
          </span>
          <span role="columnheader" style={{ textAlign: 'right' }}>Moy.</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>Méd.</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>≥ 10</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>Notés</span>
          <span />
        </div>
        {classes.map((c) => {
          const s = c.stats;
          const delta = s.mean !== null && level.mean !== null ? s.mean - level.mean : null;
          return (
            <div role="row" key={c.assessmentId} style={{ ...gridRow, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span role="cell" style={{ fontWeight: 600, color: 'var(--text)' }}>{c.className}</span>
              <span role="cell"><BoxPlot stats={s} levelMean={level.mean} /></span>
              <span role="cell" style={{ textAlign: 'right' }}>
                <b style={{ fontWeight: 700, color: 'var(--text)' }}>{formatGrade(s.mean)}</b>
                {delta !== null && Math.abs(delta) >= 0.05 && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)' }}>
                    {delta > 0 ? '+' : '−'}{formatGrade(Math.abs(delta))}
                  </span>
                )}
              </span>
              <span role="cell" style={cellNum}>{formatGrade(s.median)}</span>
              <span role="cell" style={cellNum}>{formatRate(s.successRate)}</span>
              <span role="cell" style={{ ...cellNum, color: 'var(--text-dim)' }}>{s.count}/{c.total}</span>
              <span role="cell" style={{ textAlign: 'right' }}>
                <button onClick={() => onOpenClass(c.assessmentId)} style={openBtn}>Copies →</button>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
        Boîte : la moitié centrale des notes · trait foncé : médiane · trait fin : de la plus basse à la plus haute ·
        pointillés : 10/20 · losange : moyenne du niveau
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.min(100, Math.max(0, (v / 20) * 100))}%`;

function BoxPlot({ stats, levelMean }: { stats: GradeStats; levelMean: number | null }) {
  const { min, max, q1, q3, median } = stats;
  return (
    <div
      style={{ position: 'relative', height: 22 }}
      title={stats.count === 0 ? 'Pas de note' : `Min ${formatGrade(min)} · Q1 ${formatGrade(q1)} · médiane ${formatGrade(median)} · Q3 ${formatGrade(q3)} · max ${formatGrade(max)}`}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: '1px dashed var(--text-dim)' }} />
      {min !== null && max !== null && (
        <div style={{ position: 'absolute', top: 10, height: 1, left: pct(min), width: `calc(${pct(max)} - ${pct(min)})`, background: 'var(--text-dim)' }} />
      )}
      {q1 !== null && q3 !== null && (
        <div style={{ position: 'absolute', top: 4, height: 14, left: pct(q1), width: `max(2px, calc(${pct(q3)} - ${pct(q1)}))`, background: 'var(--indigo-soft)', border: '1px solid var(--indigo)', borderRadius: 3, boxSizing: 'border-box' }} />
      )}
      {median !== null && (
        <div style={{ position: 'absolute', top: 2, height: 18, width: 2, marginLeft: -1, left: pct(median), background: 'var(--indigo-ink)' }} />
      )}
      {levelMean !== null && stats.count > 0 && (
        <div style={{ position: 'absolute', top: 7, width: 8, height: 8, marginLeft: -4, left: pct(levelMean), transform: 'rotate(45deg)', background: 'var(--surface)', border: '1.5px solid var(--text-muted)', boxSizing: 'border-box' }} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

const strip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 2px', fontSize: 13, color: 'var(--text-muted)',
};
const num: React.CSSProperties = { fontWeight: 700, color: 'var(--text)' };
const toggleBtn: React.CSSProperties = {
  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', padding: '2px 4px',
};
const gridRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '56px minmax(120px, 1fr) 56px 48px 52px 60px 84px', gap: 12, alignItems: 'center', fontSize: 13,
};
const cellNum: React.CSSProperties = { textAlign: 'right', color: 'var(--text)' };
const openBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)',
};
