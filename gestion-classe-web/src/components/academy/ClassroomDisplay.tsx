import { useState, useMemo } from 'react';
import { HOUSE_LIST } from './houses';
import { HouseCrest } from './HouseCrest';
import { ClassroomTimer } from './ClassroomTimer';
import { SortingCeremony } from './SortingCeremony';
import { RollingNumber } from './Atmosphere';
import { revealBonuses, type HouseId, type AcademyAssignment, type AcademyHouseBonus, type HousePoints } from '../../lib/academyQueries';
import './tokens.css';

interface Props {
  classId: string;
  housePoints: HousePoints[];
  bonuses: AcademyHouseBonus[];
  assignments: AcademyAssignment[];
  students: { id: string; pseudo: string }[];
  onClose: () => void;
  onReload: () => void;
}

export function ClassroomDisplay({ classId, housePoints, bonuses, assignments, students, onClose, onReload }: Props) {
  const [showCeremony, setShowCeremony] = useState(false);
  const [revealing, setRevealing] = useState(false);

  // Sort houses by points
  const ranked = useMemo(() => {
    return HOUSE_LIST.map(h => {
      const hp = housePoints.find(p => p.house === h.id);
      return { ...h, points: hp?.total_points || 0 };
    }).sort((a, b) => b.points - a.points);
  }, [housePoints]);

  const maxPoints = Math.max(1, ...ranked.map(h => h.points));

  // Check if there are pending students (completed quiz but no assignment)
  const assignedIds = new Set(assignments.map(a => a.student_id));
  const unassignedCount = students.filter(s => !assignedIds.has(s.id)).length;

  // Hidden bonuses
  const hiddenBonuses = bonuses.filter(b => !b.visible);
  const hasHiddenBonuses = hiddenBonuses.length > 0;

  const handleReveal = async () => {
    setRevealing(true);
    await revealBonuses(classId);
    setTimeout(() => {
      onReload();
      setRevealing(false);
    }, 3500);
  };

  if (showCeremony) {
    return (
      <SortingCeremony
        classId={classId}
        students={students}
        assignments={assignments}
        onAssigned={onReload}
        onClose={() => { setShowCeremony(false); onReload(); }}
      />
    );
  }

  // Colors for inline styles (no CSS vars since this overlays everything)
  const HOUSE_INLINE: Record<HouseId, { c1: string; c2: string; ink: string }> = {
    gryffondor: { c1: '#9b2226', c2: '#ee9b00', ink: '#6b1518' },
    serpentard: { c1: '#2d6a4f', c2: '#b7e4c7', ink: '#1b4332' },
    serdaigle: { c1: '#1d3557', c2: '#a8dadc', ink: '#14213d' },
    poufsouffle: { c1: '#e9c46a', c2: '#264653', ink: '#9a6b13' },
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0a0908',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      overflow: 'hidden',
    }}>
      {/* Stars */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 80 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: Math.random() * 2 + 0.5, height: Math.random() * 2 + 0.5,
            borderRadius: '50%', background: '#d4a843',
            opacity: Math.random() * 0.5 + 0.2,
            animation: `academy-twinkle ${Math.random() * 4 + 3}s ease-in-out ${Math.random() * 5}s infinite`,
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #3a2e22', flexShrink: 0,
        position: 'relative', zIndex: 1,
      }}>
        <button
          onClick={onClose}
          style={{
            color: '#8a7a66', background: 'none', border: 'none',
            fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >← Mode prof</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#d4a843' }}>
            Quatre Maisons
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px',
        display: 'flex', flexDirection: 'column', gap: 24,
        position: 'relative', zIndex: 1,
      }}>
        {/* House score cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        }}>
          {ranked.map((h, i) => {
            const hc = HOUSE_INLINE[h.id];
            const barPct = maxPoints > 0 ? Math.round((h.points / maxPoints) * 100) : 0;
            return (
              <div key={h.id} style={{
                background: '#1a1410',
                border: `2px solid ${i === 0 ? '#d4a843' : '#3a2e22'}`,
                borderRadius: 16, padding: 20,
                textAlign: 'center',
                boxShadow: i === 0 ? '0 0 20px rgba(212,168,67,0.2)' : 'none',
              }}>
                {/* Rank badge */}
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: i === 0 ? '#d4a843' : '#6a5c4e',
                  marginBottom: 8,
                }}>
                  {i === 0 ? '🏆 1er' : `#${i + 1}`}
                </div>

                {/* Crest */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <HouseCrest house={h} size={80} glow={i === 0} />
                </div>

                {/* Name */}
                <div style={{
                  fontSize: 20, fontWeight: 700,
                  color: hc.c2,
                  marginBottom: 4,
                }}>
                  {h.name}
                </div>

                {/* Points */}
                <div style={{
                  fontSize: 36, fontWeight: 800,
                  color: '#e8dcc8', lineHeight: 1,
                }}>
                  <RollingNumber value={h.points} duration={2000} />
                </div>
                <div style={{ fontSize: 13, color: '#6a5c4e', marginBottom: 12 }}>points</div>

                {/* Score bar */}
                <div style={{
                  height: 8, background: '#251c15', borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${barPct}%`,
                    background: `linear-gradient(90deg, ${hc.ink}, ${hc.c1})`,
                    transition: 'width 1s ease-out',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Reveal bonus */}
          {hasHiddenBonuses && (
            <button
              onClick={handleReveal}
              disabled={revealing}
              style={{
                flex: 1, minWidth: 200, padding: '16px 24px',
                background: revealing
                  ? '#251c15'
                  : 'linear-gradient(135deg, #d4a843, #b8860b)',
                color: revealing ? '#d4a843' : '#1a1410',
                fontWeight: 700, fontSize: 17,
                fontFamily: 'inherit',
                border: revealing ? '1px solid #d4a843' : 'none',
                borderRadius: 12, cursor: revealing ? 'default' : 'pointer',
                boxShadow: revealing ? 'none' : '0 4px 16px rgba(180,130,50,0.3)',
                animation: revealing ? 'academy-pulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              {revealing ? '✨ Révélation en cours...' : `✨ Révéler les bonus (${hiddenBonuses.length})`}
            </button>
          )}

          {/* Sorting ceremony */}
          {unassignedCount > 0 && (
            <button
              onClick={() => setShowCeremony(true)}
              style={{
                flex: 1, minWidth: 200, padding: '16px 24px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', fontWeight: 700, fontSize: 17,
                fontFamily: 'inherit',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
              }}
            >
              🎩 Cérémonie de la Répartition ({unassignedCount})
            </button>
          )}
        </div>

        {/* Timer */}
        <ClassroomTimer />

        {/* Students per house */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        }}>
          {HOUSE_LIST.map(h => {
            const hc = HOUSE_INLINE[h.id];
            const members = assignments
              .filter(a => a.house === h.id)
              .map(a => students.find(s => s.id === a.student_id))
              .filter(Boolean) as { id: string; pseudo: string }[];

            return (
              <div key={h.id} style={{
                background: '#1a1410', border: '1px solid #3a2e22',
                borderRadius: 12, padding: 12,
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: hc.c2,
                  marginBottom: 8, textAlign: 'center',
                  borderBottom: `1px solid ${hc.ink}`, paddingBottom: 6,
                }}>
                  {h.name} ({members.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {members.map(m => (
                    <div key={m.id} style={{
                      fontSize: 12, color: '#b0a08a', padding: '3px 6px',
                      background: '#251c15', borderRadius: 6,
                    }}>
                      {m.pseudo}
                    </div>
                  ))}
                  {members.length === 0 && (
                    <div style={{ fontSize: 11, color: '#6a5c4e', fontStyle: 'italic', textAlign: 'center', padding: 8 }}>
                      Aucun membre
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
