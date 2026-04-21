import { useState, useRef } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';
import '../../components/academy/tokens.css';

/* ── House color map (matches tokens.css) ── */
const HOUSE_COLORS: Record<string, { c1: string; c2: string; ink: string }> = {
  gryffondor: { c1: '#9b2226', c2: '#ee9b00', ink: '#6b1518' },
  serpentard: { c1: '#2d6a4f', c2: '#b7e4c7', ink: '#1b4332' },
  serdaigle:  { c1: '#1d3557', c2: '#a8dadc', ink: '#14213d' },
  poufsouffle:{ c1: '#e9c46a', c2: '#264653', ink: '#9a6b13' },
};

function houseKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getHouseStyle(name: string) {
  return HOUSE_COLORS[houseKey(name)] || { c1: '#6366f1', c2: '#a5b4fc', ink: '#4338ca' };
}

export function GroupGrading() {
  const {
    sessionData, activeGroupIndex, loading, academyMode,
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

  // ── Theme based on mode ──
  const hp = academyMode;
  const houseStyle = hp ? getHouseStyle(group.name) : null;
  const accentColor = hp ? houseStyle!.c1 : '#059669';

  const bgMain = hp ? '#1a1410' : 'var(--bg)';
  const bgCard = hp ? '#251c15' : 'var(--surface)';
  const bgCardBorder = hp ? '#3a2e22' : 'var(--border)';
  const bgMuted = hp ? '#1e1712' : 'var(--surface-3)';
  const textMain = hp ? '#e8dcc8' : 'var(--text)';
  const textDim = hp ? '#8a7a66' : 'var(--text-dim)';
  const textMuted = hp ? '#6a5c4e' : 'var(--text-muted)';
  const goldAccent = '#d4a843';
  const fontDisplay = hp ? "'Cormorant Garamond', Georgia, serif" : 'inherit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bgMain }}>

      {/* ===== HEADER ===== */}
      <div style={{
        padding: '10px 12px',
        background: hp
          ? `linear-gradient(135deg, ${houseStyle!.ink}, ${houseStyle!.c1})`
          : 'linear-gradient(135deg, #059669, #10b981)',
        color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: hp ? 17 : 15,
            fontFamily: fontDisplay,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {hp ? '⚔ ' : ''}{sessionData.name}
          </div>
          {hp && (
            <div style={{ fontSize: 11, opacity: 0.7, fontFamily: fontDisplay, fontStyle: 'italic' }}>
              Épreuve des Quatre Maisons
            </div>
          )}
        </div>
        {/* Score badge */}
        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 10px',
          textAlign: 'center', flexShrink: 0,
          border: hp ? '1px solid rgba(255,255,255,0.2)' : 'none',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontFamily: fontDisplay }}>{totalScore}</div>
          <div style={{ fontSize: 10, opacity: 0.7 }}>/ {maxScore}</div>
        </div>
      </div>

      {/* ===== GROUP / HOUSE TABS ===== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${groups.length}, 1fr)`,
        gap: 6, padding: '8px 12px',
        borderBottom: `1px solid ${hp ? '#3a2e22' : 'var(--border)'}`,
        background: hp ? '#1e1712' : undefined,
        flexShrink: 0,
      }}>
        {groups.map((g, i) => {
          const gScore = criteria.reduce((s, c) => {
            const gr = g.grades.find(x => x.criteria_id === c.id);
            return s + (gr?.points_awarded || 0);
          }, 0) - g.conduct_malus;
          const isActive = i === activeGroupIndex;
          const hs = hp ? getHouseStyle(g.name) : null;

          return (
            <button
              key={g.id}
              onClick={() => setActiveGroup(i)}
              style={{
                padding: '10px 4px',
                fontSize: 12, fontWeight: 700, lineHeight: 1.2,
                fontFamily: fontDisplay,
                background: isActive
                  ? (hp ? hs!.c1 : '#059669')
                  : (hp ? '#251c15' : 'var(--surface-3)'),
                color: isActive
                  ? '#fff'
                  : (hp ? '#8a7a66' : 'var(--text-muted)'),
                borderRadius: 10,
                border: isActive
                  ? `2px solid ${hp ? hs!.c2 : '#059669'}`
                  : `2px solid ${hp ? '#3a2e22' : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'center',
                minHeight: 48,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
              }}
            >
              <div>{g.name}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>
                {Math.max(0, gScore)} pts
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        WebkitOverflowScrolling: 'touch',
      }}>

        {/* Members */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {group.members.map(m => (
            <span key={m.student_id} style={{
              padding: '3px 8px', fontSize: 11, fontWeight: 500,
              background: hp ? '#2a2018' : 'var(--surface-3)',
              color: hp ? '#b0a08a' : 'var(--text-muted)',
              borderRadius: 10,
              border: hp ? '1px solid #3a2e22' : 'none',
              fontFamily: fontDisplay,
            }}>
              {m.pseudo}
            </span>
          ))}
        </div>

        {/* ===== CRITERIA CARDS ===== */}
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
                accent={accentColor}


                bgCard={bgCard}
                bgCardBorder={bgCardBorder}
                bgMuted={bgMuted}
                textMain={textMain}
                textDim={textDim}
                textMuted={textMuted}
                fontDisplay={fontDisplay}
                hp={hp}
              />
            );
          })}
        </div>

        {/* ===== MALUS ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 16, padding: 12,
          background: group.conduct_malus > 0
            ? (hp ? '#3a1515' : 'var(--neg-soft, #fef2f2)')
            : bgMuted,
          borderRadius: 12,
          border: hp ? `1px solid ${bgCardBorder}` : 'none',
        }}>
          <button
            onClick={() => applyMalus(group.id)}
            onTouchStart={handleMalusDown}
            onTouchEnd={handleMalusUp}
            onMouseDown={handleMalusDown}
            onMouseUp={handleMalusUp}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 18,
              background: '#dc2626', border: 'none', cursor: 'pointer',
              flexShrink: 0,
            }}
          >−1</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: textMain, fontFamily: fontDisplay }}>
              Malus conduite
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              {group.conduct_malus > 0
                ? <><strong style={{ color: '#dc2626' }}>−{group.conduct_malus} pt{group.conduct_malus > 1 ? 's' : ''}</strong> · maintenir pour annuler</>
                : 'Aucun malus'
              }
            </div>
          </div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      {/* ===== FIXED BOTTOM ===== */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 12px max(12px, env(safe-area-inset-bottom))',
        background: `linear-gradient(transparent, ${bgMain} 25%)`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setShowEndConfirm(true)}
          style={{
            width: '100%', padding: '16px 0',
            background: hp
              ? `linear-gradient(135deg, ${goldAccent}, #b8860b)`
              : '#fff',
            color: hp ? '#1a1410' : '#059669',
            fontWeight: 800, fontSize: 17,
            fontFamily: fontDisplay,
            letterSpacing: hp ? '0.02em' : '-0.01em',
            borderRadius: 14,
            border: hp ? 'none' : '2px solid #059669',
            cursor: 'pointer',
            boxShadow: hp
              ? '0 4px 16px rgba(180, 130, 50, 0.4)'
              : '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          {hp ? '⚔ Terminer l\'épreuve' : '✓ Terminer'}
        </button>
      </div>

      {/* ===== CONFIRM MODAL ===== */}
      {showEndConfirm && (
        <div
          onClick={() => setShowEndConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: hp ? 'rgba(10,9,8,0.7)' : 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: hp ? '#251c15' : 'var(--surface)',
              padding: 24, margin: '0 20px',
              maxWidth: 340, width: '100%',
              borderRadius: 16,
              boxShadow: hp
                ? '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,168,67,0.2)'
                : '0 20px 60px rgba(0,0,0,0.3)',
              border: hp ? '1px solid #3a2e22' : 'none',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                background: hp ? 'linear-gradient(135deg, #d4a843, #b8860b)' : '#ecfdf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
                boxShadow: hp ? '0 4px 16px rgba(180,130,50,0.3)' : 'none',
              }}>
                {hp ? '⚔' : '✓'}
              </div>
              <h3 style={{
                fontWeight: 700, fontSize: 18,
                color: hp ? '#e8dcc8' : 'var(--text)',
                fontFamily: fontDisplay,
                margin: '0 0 6px',
              }}>
                {hp ? 'Clore l\'épreuve ?' : 'Terminer la notation ?'}
              </h3>
              <p style={{ fontSize: 13, color: hp ? '#8a7a66' : 'var(--text-muted)', margin: 0, fontFamily: fontDisplay }}>
                {hp
                  ? <>Les points seront attribués à <strong style={{ color: '#d4a843' }}>{group.name}</strong> et aux autres maisons</>
                  : <>Score final : <strong>{totalScore}/{maxScore}</strong> ({pctTotal}%)</>
                }
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 600, fontSize: 15,
                  color: hp ? '#8a7a66' : 'var(--text-muted)',
                  background: hp ? '#1e1712' : 'var(--surface-3)',
                  borderRadius: 12, border: hp ? '1px solid #3a2e22' : 'none', cursor: 'pointer',
                  fontFamily: fontDisplay,
                }}
              >
                Poursuivre
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); finishSession(); }}
                disabled={loading}
                style={{
                  flex: 1, padding: '14px 0', fontWeight: 800, fontSize: 15,
                  color: hp ? '#1a1410' : '#fff',
                  background: hp ? 'linear-gradient(135deg, #d4a843, #b8860b)' : '#059669',
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontFamily: fontDisplay,
                  opacity: loading ? 0.6 : 1,
                  boxShadow: hp ? '0 2px 8px rgba(180,130,50,0.3)' : 'none',
                }}
              >
                {loading ? '...' : hp ? 'Valider ⚔' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================
   STEPPER — with theme support
   ======================================== */
function CriteriaStepper({ label, maxPoints, value, onChange, accent, accentLight, bgCard, bgCardBorder, bgMuted, textMain, textDim, textMuted, fontDisplay, hp }: {
  label: string; maxPoints: number; value: number;
  onChange: (v: number) => void;
  accent: string;
  bgCard: string; bgCardBorder: string; bgMuted: string;
  textMain: string; textDim: string; textMuted: string;
  fontDisplay: string; hp: boolean;
}) {
  const step = maxPoints <= 5 ? 0.5 : 1;
  const pct = maxPoints > 0 ? Math.round((value / maxPoints) * 100) : 0;

  const dec = () => { onChange(Math.max(0, value - step)); vibrate(); };
  const inc = () => { onChange(Math.min(maxPoints, value + step)); vibrate(); };
  const setTo = (v: number) => { onChange(v); vibrate(); };

  const presets = [
    { label: '0', value: 0 },
    { label: '½', value: Math.round(maxPoints * 0.5 * 2) / 2 },
    { label: '¾', value: Math.round(maxPoints * 0.75 * 2) / 2 },
    { label: 'Max', value: maxPoints },
  ];

  const barColor = hp
    ? (pct >= 70 ? '#d4a843' : pct >= 40 ? '#b8860b' : pct > 0 ? '#8b4513' : bgMuted)
    : (pct >= 70 ? '#059669' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : 'var(--surface-3)');

  return (
    <div style={{
      background: bgCard, borderRadius: 12, padding: 12,
      boxShadow: hp ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
      border: `1px solid ${bgCardBorder}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: textMain, fontFamily: fontDisplay }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: barColor, fontFamily: fontDisplay }}>
          {value}<span style={{ fontWeight: 500, color: textDim }}>/{maxPoints}</span>
        </span>
      </div>

      <div style={{ height: 4, background: bgMuted, borderRadius: 4, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 100ms' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={dec}
          disabled={value <= 0}
          style={{
            width: 44, height: 44, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            background: value <= 0 ? bgMuted : (hp ? '#3a1515' : '#fef2f2'),
            color: value <= 0 ? textDim : '#dc2626',
            border: hp ? `1px solid ${bgCardBorder}` : 'none',
            cursor: value <= 0 ? 'default' : 'pointer',
          }}
        >−</button>

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
                  fontFamily: fontDisplay,
                  background: isActive ? accent : bgMuted,
                  color: isActive ? '#fff' : textMuted,
                  borderRadius: 8,
                  border: hp && !isActive ? `1px solid ${bgCardBorder}` : 'none',
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={inc}
          disabled={value >= maxPoints}
          style={{
            width: 44, height: 44, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            background: value >= maxPoints ? bgMuted : (hp ? '#1a2e1a' : '#ecfdf5'),
            color: value >= maxPoints ? textDim : (hp ? '#4ade80' : '#059669'),
            border: hp ? `1px solid ${bgCardBorder}` : 'none',
            cursor: value >= maxPoints ? 'default' : 'pointer',
          }}
        >+</button>
      </div>
    </div>
  );
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(8);
}
