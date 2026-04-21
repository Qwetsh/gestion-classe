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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--gradient-success)',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{sessionData.name}</h1>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#86efac', display: 'inline-block' }} /> EN COURS
          </span>
        </div>
        <button
          onClick={() => setShowEndConfirm(true)}
          style={{
            padding: '10px 20px',
            background: '#fff',
            color: 'var(--pos)',
            fontWeight: 700,
            fontSize: 15,
            borderRadius: 'var(--radius)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          ✓ Terminer
        </button>
      </div>

      {/* Group tabs */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {groups.map((g, i) => {
          const gScore = criteria.reduce((s, c) => {
            const gr = g.grades.find(x => x.criteria_id === c.id);
            return s + (gr?.points_awarded || 0);
          }, 0) - g.conduct_malus;
          const isActive = i === activeGroupIndex;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(i)}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: isActive ? 'var(--pos)' : 'var(--surface-3)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                borderRadius: 'var(--radius)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div>{g.name}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>{Math.max(0, gScore)}/{maxScore}</div>
            </button>
          );
        })}
      </div>

      {/* Score display */}
      <div style={{ textAlign: 'center', padding: '12px 0', flexShrink: 0 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{totalScore}</span>
        <span style={{ fontSize: 18, color: 'var(--text-dim)' }}> / {maxScore}</span>
        {group.conduct_malus > 0 && (
          <div style={{ fontSize: 12, color: 'var(--neg)' }}>(dont {group.conduct_malus} malus)</div>
        )}
      </div>

      {/* Members */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px', overflowX: 'auto', flexShrink: 0 }}>
        {group.members.map(m => (
          <span key={m.student_id} style={{
            flexShrink: 0, padding: '2px 8px', fontSize: 10, fontWeight: 500,
            background: 'var(--surface-3)', color: 'var(--text-muted)', borderRadius: 'var(--radius-full)',
          }}>
            {m.pseudo}
          </span>
        ))}
      </div>

      {/* Criteria sliders */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </div>

      {/* Malus button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button
          onClick={handleMalusTap}
          onTouchStart={handleMalusDown}
          onTouchEnd={handleMalusUp}
          onMouseDown={handleMalusDown}
          onMouseUp={handleMalusUp}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 18,
            background: 'var(--neg)', border: 'none', cursor: 'pointer',
          }}
        >
          -1
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Malus : <strong style={{ color: 'var(--neg)' }}>{group.conduct_malus}</strong>
          {group.conduct_malus > 0 && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 4 }}>(maintenir pour reset)</span>}
        </span>
      </div>

      {/* End confirm */}
      {showEndConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
        }}>
          <div style={{
            background: 'var(--surface)', padding: 24, margin: '0 24px',
            maxWidth: 360, width: '100%',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)',
          }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', textAlign: 'center', margin: '0 0 16px' }}>
              Terminer la notation ?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 20px' }}>
              Les notes seront enregistrées et les points attribués aux maisons.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 500,
                  color: 'var(--text-muted)', background: 'var(--surface-3)',
                  borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontSize: 15,
                }}
              >
                Continuer
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); finishSession(); }}
                disabled={loading}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 700,
                  color: '#fff', background: 'var(--gradient-success)',
                  borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', fontSize: 15,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'En cours...' : '✓ Valider'}
              </button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--pos)' }}>{value}/{maxPoints}</span>
      </div>
      <div
        ref={trackRef}
        style={{
          position: 'relative', height: 40,
          background: 'var(--surface-3)', borderRadius: 'var(--radius)',
          cursor: 'pointer', touchAction: 'none',
        }}
        onClick={(e) => handleInteraction(e.clientX)}
        onTouchMove={handleTouchMove}
        onTouchStart={(e) => handleInteraction(e.touches[0].clientX)}
      >
        <div style={{
          position: 'absolute', inset: '0 auto 0 0',
          width: `${pct}%`,
          background: 'var(--gradient-success)',
          borderRadius: 'var(--radius)',
          transition: 'width 50ms',
        }} />
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24, background: '#fff', borderRadius: '50%',
          left: `calc(${pct}% - 12px)`,
          boxShadow: 'var(--shadow-2)',
          transition: 'left 50ms',
        }} />
      </div>
    </div>
  );
}
