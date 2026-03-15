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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="text-center py-6 text-white" style={{ background: 'var(--gradient-success)' }}>
        <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center text-3xl">
          ✓
        </div>
        <h1 className="font-bold text-xl">Seance terminee</h1>
        <p className="text-white/70 text-sm mt-1">{sessionData.name}</p>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.map((g, i) => (
          <div
            key={g.id}
            className="bg-[var(--color-surface)] p-4"
            style={{
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-sm)',
              borderLeft: i === 0 ? '4px solid var(--color-success)' : undefined,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                i === 0 ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
              }`}>
                {i === 0 ? '🥇' : `#${i + 1}`}
              </span>
              <div className="flex-1">
                <span className="font-semibold text-[var(--color-text)]">{g.name}</span>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  {g.members.map(m => m.pseudo).join(', ')}
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-lg text-[var(--color-text)]">{g.total}</span>
                <span className="text-sm text-[var(--color-text-tertiary)]">/{g.maxScore}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${g.pct}%`,
                  background: g.pct >= 70 ? 'var(--color-success)' : g.pct >= 50 ? 'var(--color-remarque)' : 'var(--color-error)',
                }}
              />
            </div>

            {/* Criteria detail */}
            <div className="grid grid-cols-2 gap-1 mt-2">
              {sessionData.criteria.map(c => {
                const grade = g.grades.find(gr => gr.criteria_id === c.id);
                return (
                  <div key={c.id} className="flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                    <span>{c.label}</span>
                    <span className="font-semibold">{grade?.points_awarded || 0}/{c.max_points}</span>
                  </div>
                );
              })}
              {g.conduct_malus > 0 && (
                <div className="flex justify-between text-[10px] text-[var(--color-error)]">
                  <span>Malus</span>
                  <span className="font-semibold">-{g.conduct_malus}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Groupes" value={results.length.toString()} />
          <StatBox label="Eleves" value={results.reduce((s, g) => s + g.members.length, 0).toString()} />
          <StatBox label="Moyenne" value={`${avgScore}/${maxScore}`} />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 pb-6 shrink-0">
        <button
          onClick={cancelFlow}
          className="w-full py-4 text-white font-bold text-lg active:scale-[0.98] transition-transform"
          style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-xl)', border: 'none' }}
        >
          Retour a l'accueil
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] p-3 text-center" style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xs)' }}>
      <div className="font-bold text-lg text-[var(--color-text)]">{value}</div>
      <div className="text-[10px] text-[var(--color-text-tertiary)]">{label}</div>
    </div>
  );
}
