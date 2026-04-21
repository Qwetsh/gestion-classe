import { useState, useRef } from 'react';
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
  const pctTotal = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const handleMalusDown = () => {
    longPressTimer.current = setTimeout(() => {
      resetMalus(group.id);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }, 600);
  };
  const handleMalusUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
  const handleMalusTap = () => {
    applyMalus(group.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ===== HEADER — compact ===== */}
      <div style={{
        padding: '10px 12px',
        background: 'linear-gradient(135deg, #059669, #10b981)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sessionData.name}
          </div>
        </div>
        {/* Score badge */}
        <div style={{
          background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px',
          textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{totalScore}</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>/ {maxScore}</div>
        </div>
      </div>

      {/* ===== GROUP TABS — horizontal scroll ===== */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        WebkitOverflowScrolling: 'touch',
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
                flexShrink: 0, padding: '6px 14px',
                fontSize: 13, fontWeight: 700, lineHeight: 1.3,
                background: isActive ? '#059669' : 'var(--surface-3)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                borderRadius: 20, border: 'none', cursor: 'pointer',
              }}
            >
              {g.name}
              <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{Math.max(0, gScore)}</span>
            </button>
          );
        })}
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* Members — compact inline */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16,
        }}>
          {group.members.map(m => (
            <span key={m.student_id} style={{
              padding: '3px 8px', fontSize: 11, fontWeight: 500,
              background: 'var(--surface-3)', color: 'var(--text-muted)',
              borderRadius: 10,
            }}>
              {m.pseudo}
            </span>
          ))}
        </div>

        {/* ===== CRITERIA — stepper cards ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {criteria.map(c => {
            const grade = group.grades.find(g => g.criteria_id === c.id);
            const value = grade?.points_awarded || 0;
            return (
              <CriteriaStepper
                key={c.id}
                label={c.label}
                maxPoints={c.max_points}
                value={value}
                onChange={(pts) => setGrade(group.id, c.id, pts)}
              />
            );
          })}
        </div>

        {/* ===== MALUS — inline row ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 16, padding: 12,
          background: group.conduct_malus > 0 ? 'var(--neg-soft, #fef2f2)' : 'var(--surface-3)',
          borderRadius: 12,
        }}>
          <button
            onClick={handleMalusTap}
            onTouchStart={handleMalusDown}
            onTouchEnd={handleMalusUp}
            onMouseDown={handleMalusDown}
            onMouseUp={handleMalusUp}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 18,
              background: 'var(--neg)', border: 'none', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            −1
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Malus conduite
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {group.conduct_malus > 0
                ? <><strong style={{ color: 'var(--neg)' }}>−{group.conduct_malus} pt{group.conduct_malus > 1 ? 's' : ''}</strong> · maintenir pour annuler</>
                : 'Aucun malus'
              }
            </div>
          </div>
        </div>

        {/* spacer for bottom button */}
        <div style={{ height: 80 }} />
      </div>

      {/* ===== FIXED BOTTOM — Terminer ===== */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(transparent, var(--bg) 20%)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setShowEndConfirm(true)}
          style={{
            width: '100%', padding: '16px 0',
            background: '#fff', color: '#059669',
            fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em',
            borderRadius: 14,
            border: '2px solid #059669',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          ✓ Terminer l'épreuve
        </button>
      </div>

      {/* ===== CONFIRM MODAL ===== */}
      {showEndConfirm && (
        <div
          onClick={() => setShowEndConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', padding: 24, margin: '0 20px',
              maxWidth: 340, width: '100%',
              borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>✓</div>
              <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', margin: '0 0 6px' }}>
                Terminer la notation ?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Score final : <strong>{totalScore}/{maxScore}</strong> ({pctTotal}%)
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 600, fontSize: 15,
                  color: 'var(--text-muted)', background: 'var(--surface-3)',
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                }}
              >
                Continuer
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); finishSession(); }}
                disabled={loading}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 800, fontSize: 15,
                  color: '#fff', background: '#059669',
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================
   STEPPER — tap +/- or quick-set buttons
   ======================================== */
function CriteriaStepper({ label, maxPoints, value, onChange }: {
  label: string;
  maxPoints: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = maxPoints <= 5 ? 0.5 : 1;
  const pct = maxPoints > 0 ? Math.round((value / maxPoints) * 100) : 0;

  const dec = () => { const v = Math.max(0, value - step); onChange(v); vibrate(); };
  const inc = () => { const v = Math.min(maxPoints, value + step); onChange(v); vibrate(); };
  const setTo = (v: number) => { onChange(v); vibrate(); };

  // Quick presets: 0%, 50%, 75%, 100%
  const presets = [
    { label: '0', value: 0 },
    { label: '½', value: Math.round(maxPoints * 0.5 * 2) / 2 },
    { label: '¾', value: Math.round(maxPoints * 0.75 * 2) / 2 },
    { label: 'Max', value: maxPoints },
  ];

  const barColor = pct >= 70 ? '#059669' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : 'var(--surface-3)';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, padding: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      border: '1px solid var(--border)',
    }}>
      {/* Label + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: barColor }}>
          {value}<span style={{ fontWeight: 500, color: 'var(--text-dim)' }}>/{maxPoints}</span>
        </span>
      </div>

      {/* Progress bar — thin, non-interactive */}
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 100ms' }} />
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Minus button */}
        <button
          onClick={dec}
          disabled={value <= 0}
          style={{
            width: 44, height: 44, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            background: value <= 0 ? 'var(--surface-3)' : '#fef2f2',
            color: value <= 0 ? 'var(--text-dim)' : '#ef4444',
            border: 'none', cursor: value <= 0 ? 'default' : 'pointer',
          }}
        >−</button>

        {/* Quick presets */}
        <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center' }}>
          {presets.map((p, i) => {
            const isActive = value === p.value;
            return (
              <button
                key={i}
                onClick={() => setTo(p.value)}
                style={{
                  flex: 1, padding: '8px 0',
                  fontSize: 12, fontWeight: isActive ? 800 : 600,
                  background: isActive ? '#059669' : 'var(--surface-3)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Plus button */}
        <button
          onClick={inc}
          disabled={value >= maxPoints}
          style={{
            width: 44, height: 44, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            background: value >= maxPoints ? 'var(--surface-3)' : '#ecfdf5',
            color: value >= maxPoints ? 'var(--text-dim)' : '#059669',
            border: 'none', cursor: value >= maxPoints ? 'default' : 'pointer',
          }}
        >+</button>
      </div>
    </div>
  );
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(8);
}
