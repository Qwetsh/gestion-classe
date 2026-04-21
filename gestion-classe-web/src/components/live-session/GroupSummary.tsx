import { useMemo } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSummary() {
  const { sessionData, cancelFlow } = useGroupSession();

  const results = useMemo(() => {
    if (!sessionData) return [];
    const maxScore = sessionData.criteria.reduce((s, c) => s + c.max_points, 0);
    return sessionData.groups
      .map(g => {
        const rawScore = sessionData.criteria.reduce((s, c) => {
          const grade = g.grades.find(gr => gr.criteria_id === c.id);
          return s + (grade?.points_awarded || 0);
        }, 0);
        const total = Math.max(0, rawScore - g.conduct_malus);
        const pct = maxScore > 0 ? Math.round((total / maxScore) * 100) : 0;
        return { ...g, total, maxScore, pct };
      })
      .sort((a, b) => b.total - a.total);
  }, [sessionData]);

  if (!sessionData) return null;

  const maxScore = sessionData.criteria.reduce((s, c) => s + c.max_points, 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.total, 0) / results.length * 10) / 10
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#fff', background: 'var(--gradient-success)' }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 12px', background: 'rgba(255,255,255,0.2)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          ✓
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>Épreuve terminée</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>{sessionData.name}</p>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((g, i) => (
            <div
              key={g.id}
              style={{
                background: 'var(--surface)', padding: 16,
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)',
                borderLeft: i === 0 ? '4px solid var(--pos)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14,
                  background: i === 0 ? 'var(--pos)' : 'var(--surface-3)',
                  color: i === 0 ? '#fff' : 'var(--text-muted)',
                }}>
                  {i === 0 ? '🥇' : `#${i + 1}`}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{g.name}</span>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {g.members.map(m => m.pseudo).join(', ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{g.total}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>/{g.maxScore}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 'var(--radius-full)',
                  width: `${g.pct}%`,
                  background: g.pct >= 70 ? 'var(--pos)' : g.pct >= 50 ? 'var(--color-remarque)' : 'var(--neg)',
                  transition: 'width 0.3s',
                }} />
              </div>

              {/* Criteria detail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                {sessionData.criteria.map(c => {
                  const grade = g.grades.find(gr => gr.criteria_id === c.id);
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{c.label}</span>
                      <span style={{ fontWeight: 600 }}>{grade?.points_awarded || 0}/{c.max_points}</span>
                    </div>
                  );
                })}
                {g.conduct_malus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--neg)' }}>
                    <span>Malus</span>
                    <span style={{ fontWeight: 600 }}>-{g.conduct_malus}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <StatBox label="Groupes" value={results.length.toString()} />
            <StatBox label="Élèves" value={results.reduce((s, g) => s + g.members.length, 0).toString()} />
            <StatBox label="Moyenne" value={`${avgScore}/${maxScore}`} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 16px 24px', flexShrink: 0 }}>
        <button
          onClick={cancelFlow}
          style={{
            width: '100%', padding: '16px 0',
            color: '#fff', fontWeight: 700, fontSize: 16,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
          }}
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface)', padding: 12, textAlign: 'center',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}
