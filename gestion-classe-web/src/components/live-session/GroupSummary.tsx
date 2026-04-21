import { useMemo } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';

const HOUSE_COLORS: Record<string, { c1: string; c2: string; ink: string }> = {
  gryffondor: { c1: '#9b2226', c2: '#ee9b00', ink: '#6b1518' },
  serpentard: { c1: '#2d6a4f', c2: '#b7e4c7', ink: '#1b4332' },
  serdaigle:  { c1: '#1d3557', c2: '#a8dadc', ink: '#14213d' },
  poufsouffle:{ c1: '#e9c46a', c2: '#264653', ink: '#9a6b13' },
};

function houseKey(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getHouseStyle(name: string) {
  return HOUSE_COLORS[houseKey(name)] || { c1: '#6366f1', c2: '#a5b4fc', ink: '#4338ca' };
}

export function GroupSummary() {
  const { sessionData, academyMode, cancelFlow } = useGroupSession();

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

  const hp = academyMode;
  const maxScore = sessionData.criteria.reduce((s, c) => s + c.max_points, 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.total, 0) / results.length * 10) / 10
    : 0;

  const bgMain = hp ? '#1a1410' : 'var(--bg)';
  const bgCard = hp ? '#251c15' : 'var(--surface)';
  const bgMuted = hp ? '#1e1712' : 'var(--surface-3)';
  const textMain = hp ? '#e8dcc8' : 'var(--text)';
  const textDim = hp ? '#8a7a66' : 'var(--text-dim)';
  const textMuted = hp ? '#6a5c4e' : 'var(--text-muted)';
  const goldAccent = '#d4a843';
  const fontDisplay = hp ? "'Cormorant Garamond', Georgia, serif" : 'inherit';

  const winner = results[0];
  const winnerHs = hp && winner ? getHouseStyle(winner.name) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bgMain }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', padding: '24px 16px', color: '#fff',
        background: hp
          ? (winnerHs ? `linear-gradient(135deg, ${winnerHs.ink}, ${winnerHs.c1})` : '#1a1410')
          : 'var(--gradient-success)',
      }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 12px',
          background: hp ? `linear-gradient(135deg, ${goldAccent}, #b8860b)` : 'rgba(255,255,255,0.2)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          boxShadow: hp ? '0 4px 20px rgba(180,130,50,0.4)' : 'none',
        }}>
          {hp ? '🏆' : '✓'}
        </div>
        <h1 style={{ fontWeight: 700, fontSize: 20, margin: 0, fontFamily: fontDisplay }}>
          {hp ? 'Épreuve terminée !' : 'Séance terminée'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, fontFamily: fontDisplay }}>
          {sessionData.name}
        </p>
        {hp && winner && (
          <p style={{
            color: goldAccent, fontSize: 16, marginTop: 8, fontWeight: 700,
            fontFamily: fontDisplay, fontStyle: 'italic',
          }}>
            Victoire de {winner.name} — {winner.total} pts
          </p>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((g, i) => {
            const hs = hp ? getHouseStyle(g.name) : null;
            return (
              <div
                key={g.id}
                style={{
                  background: bgCard, padding: 16,
                  borderRadius: 'var(--radius)',
                  boxShadow: hp ? 'none' : 'var(--shadow-1)',
                  borderLeft: i === 0
                    ? `4px solid ${hp ? goldAccent : 'var(--pos)'}`
                    : undefined,
                  border: hp ? `1px solid ${i === 0 ? goldAccent : '#3a2e22'}` : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                    background: i === 0
                      ? (hp ? `linear-gradient(135deg, ${goldAccent}, #b8860b)` : 'var(--pos)')
                      : bgMuted,
                    color: i === 0 ? (hp ? '#1a1410' : '#fff') : textMuted,
                    fontFamily: fontDisplay,
                  }}>
                    {i === 0 ? '🥇' : `#${i + 1}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontWeight: 600, color: hp && hs ? hs.c2 : textMain,
                      fontFamily: fontDisplay, fontSize: 15,
                    }}>{g.name}</span>
                    <div style={{ fontSize: 10, color: textDim }}>
                      {g.members.map(m => m.pseudo).join(', ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, fontSize: 18, color: textMain, fontFamily: fontDisplay }}>{g.total}</span>
                    <span style={{ fontSize: 14, color: textDim }}>/{g.maxScore}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 8, background: bgMuted, borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 'var(--radius-full)',
                    width: `${g.pct}%`,
                    background: hp
                      ? (hs ? hs.c1 : goldAccent)
                      : (g.pct >= 70 ? 'var(--pos)' : g.pct >= 50 ? 'var(--color-remarque)' : 'var(--neg)'),
                    transition: 'width 0.3s',
                  }} />
                </div>

                {/* Criteria detail */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                  {sessionData.criteria.map(c => {
                    const grade = g.grades.find(gr => gr.criteria_id === c.id);
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: textMuted, fontFamily: fontDisplay }}>
                        <span>{c.label}</span>
                        <span style={{ fontWeight: 600 }}>{grade?.points_awarded || 0}/{c.max_points}</span>
                      </div>
                    );
                  })}
                  {g.conduct_malus > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#dc2626' }}>
                      <span>Malus</span>
                      <span style={{ fontWeight: 600 }}>-{g.conduct_malus}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <StatBox label={hp ? 'Maisons' : 'Groupes'} value={results.length.toString()} bg={bgCard} border={hp ? '#3a2e22' : undefined} text={textMain} sub={textDim} font={fontDisplay} />
            <StatBox label="Élèves" value={results.reduce((s, g) => s + g.members.length, 0).toString()} bg={bgCard} border={hp ? '#3a2e22' : undefined} text={textMain} sub={textDim} font={fontDisplay} />
            <StatBox label="Moyenne" value={`${avgScore}/${maxScore}`} bg={bgCard} border={hp ? '#3a2e22' : undefined} text={textMain} sub={textDim} font={fontDisplay} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 16px 24px', flexShrink: 0 }}>
        <button
          onClick={cancelFlow}
          style={{
            width: '100%', padding: '16px 0',
            color: hp ? '#1a1410' : '#fff',
            fontWeight: 700, fontSize: 16,
            fontFamily: fontDisplay,
            background: hp ? `linear-gradient(135deg, ${goldAccent}, #b8860b)` : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer',
            boxShadow: hp ? '0 4px 16px rgba(180,130,50,0.3)' : 'none',
          }}
        >
          {hp ? 'Retour au château' : 'Retour à l\'accueil'}
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value, bg, border, text, sub, font }: {
  label: string; value: string; bg: string; border?: string; text: string; sub: string; font: string;
}) {
  return (
    <div style={{
      background: bg, padding: 12, textAlign: 'center',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-xs)',
      border: border ? `1px solid ${border}` : undefined,
    }}>
      <div style={{ fontWeight: 700, fontSize: 18, color: text, fontFamily: font }}>{value}</div>
      <div style={{ fontSize: 10, color: sub, fontFamily: font }}>{label}</div>
    </div>
  );
}
