import { useState, useCallback, useRef } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupGrading() {
  const {
    sessionData, activeGroupIndex, loading,
    setActiveGroup, setGrade, applyMalus, resetMalus, finishSession,
  } = useGroupSession();

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (!sessionData) return null;

  const { criteria, groups } = sessionData;
  const group = groups[activeGroupIndex];
  if (!group) return null;

  const maxScore = criteria.reduce((s, c) => s + c.max_points, 0);
  const rawScore = criteria.reduce((s, c) => {
    const grade = group.grades.find(g => g.criteria_id === c.id);
    return s + (grade?.points_awarded || 0);
  }, 0);
  const totalScore = Math.max(0, rawScore - group.conduct_malus);

  const handleMalusDown = () => {
    longPressTimer.current = setTimeout(() => {
      resetMalus(group.id);
    }, 600);
  };

  const handleMalusUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleMalusTap = () => {
    applyMalus(group.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 text-white shrink-0 flex items-center justify-between" style={{ background: 'var(--gradient-success)' }}>
        <div>
          <h1 className="font-bold text-base">{sessionData.name}</h1>
          <span className="text-white/70 text-xs flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" /> EN COURS
          </span>
        </div>
        <button
          onClick={() => setShowEndConfirm(true)}
          className="px-4 py-1.5 bg-white/20 text-white font-semibold text-sm rounded-full"
          style={{ border: 'none' }}
        >
          Terminer
        </button>
      </div>

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
        {groups.map((g, i) => {
          const gScore = criteria.reduce((s, c) => {
            const gr = g.grades.find(x => x.criteria_id === c.id);
            return s + (gr?.points_awarded || 0);
          }, 0) - g.conduct_malus;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(i)}
              className={`shrink-0 px-3 py-2 text-xs font-semibold ${
                i === activeGroupIndex
                  ? 'bg-[var(--color-success)] text-white'
                  : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
              }`}
              style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}
            >
              <div>{g.name}</div>
              <div className="text-[10px] mt-0.5 opacity-80">{Math.max(0, gScore)}/{maxScore}</div>
            </button>
          );
        })}
      </div>

      {/* Score display */}
      <div className="text-center py-3 shrink-0">
        <span className="text-3xl font-bold text-[var(--color-text)]">{totalScore}</span>
        <span className="text-lg text-[var(--color-text-tertiary)]"> / {maxScore}</span>
        {group.conduct_malus > 0 && (
          <div className="text-xs text-[var(--color-error)]">(dont {group.conduct_malus} malus)</div>
        )}
      </div>

      {/* Members */}
      <div className="flex gap-1 px-4 pb-2 overflow-x-auto shrink-0">
        {group.members.map(m => (
          <span key={m.student_id} className="shrink-0 px-2 py-0.5 text-[10px] font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]" style={{ borderRadius: 'var(--radius-full)' }}>
            {m.pseudo}
          </span>
        ))}
      </div>

      {/* Criteria sliders */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {criteria.map(c => {
          const grade = group.grades.find(g => g.criteria_id === c.id);
          const value = grade?.points_awarded || 0;
          return (
            <CriteriaSlider
              key={c.id}
              label={c.label}
              maxPoints={c.max_points}
              value={value}
              onChange={(pts) => setGrade(group.id, c.id, pts)}
            />
          );
        })}
      </div>

      {/* Malus button */}
      <div className="flex items-center justify-center gap-4 py-3 px-4 border-t border-[var(--color-border)] shrink-0">
        <button
          onClick={handleMalusTap}
          onTouchStart={handleMalusDown}
          onTouchEnd={handleMalusUp}
          onMouseDown={handleMalusDown}
          onMouseUp={handleMalusUp}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg active:scale-90 transition-transform"
          style={{ background: 'var(--color-error)', border: 'none' }}
        >
          -1
        </button>
        <span className="text-sm text-[var(--color-text-secondary)]">
          Malus: <strong className="text-[var(--color-error)]">{group.conduct_malus}</strong>
          {group.conduct_malus > 0 && <span className="text-xs text-[var(--color-text-tertiary)] ml-1">(maintenir pour reset)</span>}
        </span>
      </div>

      {/* End confirm */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-[var(--color-surface)] p-6 mx-6 space-y-4 max-w-sm w-full" style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="font-bold text-lg text-[var(--color-text)] text-center">Terminer la notation ?</h3>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-3 font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]" style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}>Continuer</button>
              <button onClick={() => { setShowEndConfirm(false); finishSession(); }} disabled={loading} className="flex-1 py-3 font-bold text-white" style={{ background: 'var(--gradient-success)', borderRadius: 'var(--radius-lg)', border: 'none' }}>Terminer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CriteriaSlider({ label, maxPoints, value, onChange }: {
  label: string;
  maxPoints: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const computeValue = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // Snap to 0.5
    return Math.round(ratio * maxPoints * 2) / 2;
  }, [maxPoints, value]);

  const handleInteraction = useCallback((clientX: number) => {
    const v = computeValue(clientX);
    if (v !== value) {
      onChange(v);
      if (navigator.vibrate) navigator.vibrate(5);
    }
  }, [computeValue, value, onChange]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleInteraction(e.touches[0].clientX);
  }, [handleInteraction]);

  const pct = maxPoints > 0 ? (value / maxPoints) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        <span className="text-sm font-bold text-[var(--color-success)]">{value}/{maxPoints}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-10 bg-[var(--color-surface-secondary)] cursor-pointer"
        style={{ borderRadius: 'var(--radius-lg)' }}
        onClick={(e) => handleInteraction(e.clientX)}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => handleInteraction(e.touches[0].clientX)}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            background: 'var(--gradient-success)',
            borderRadius: 'var(--radius-lg)',
            transition: 'width 50ms',
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full"
          style={{
            left: `calc(${pct}% - 12px)`,
            boxShadow: 'var(--shadow-md)',
            transition: 'left 50ms',
          }}
        />
      </div>
    </div>
  );
}
