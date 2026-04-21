import { useState, useMemo } from 'react';
import { HOUSE_LIST } from './houses';
import { HouseCrest } from './HouseCrest';
import { Hourglass } from './Hourglass';
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

const HOUSE_INLINE: Record<HouseId, { c1: string; c1Light: string; c2: string; ink: string }> = {
  gryffondor: { c1: '#9b2226', c1Light: '#ee9b00', c2: '#ee9b00', ink: '#6b1518' },
  serpentard: { c1: '#2d6a4f', c1Light: '#52b788', c2: '#b7e4c7', ink: '#1b4332' },
  serdaigle:  { c1: '#1d3557', c1Light: '#457b9d', c2: '#a8dadc', ink: '#14213d' },
  poufsouffle:{ c1: '#e9c46a', c1Light: '#f4d88e', c2: '#264653', ink: '#9a6b13' },
};

export function ClassroomDisplay({ classId, housePoints, bonuses, assignments, students, onClose, onReload }: Props) {
  const [showCeremony, setShowCeremony] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [revealing, setRevealing] = useState(false);

  // Sort houses by points (keep original order for display, sort for rank)
  const ranked = useMemo(() => {
    return HOUSE_LIST.map(h => {
      const hp = housePoints.find(p => p.house === h.id);
      return { ...h, points: hp?.total_points || 0 };
    }).sort((a, b) => b.points - a.points);
  }, [housePoints]);

  const pointsCap = 500; // fixed max — beyond this the hourglass is full

  const assignedIds = new Set(assignments.map(a => a.student_id));
  const unassignedCount = students.filter(s => !assignedIds.has(s.id)).length;

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

      {/* Header bar */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #3a2e22', flexShrink: 0,
        position: 'relative', zIndex: 2,
      }}>
        {/* Left: back + ceremony */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <button
            onClick={onClose}
            style={{
              color: '#8a7a66', background: 'none', border: 'none',
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >← Retour</button>
          {unassignedCount > 0 && (
            <button
              onClick={() => setShowCeremony(true)}
              style={{
                padding: '6px 14px',
                background: '#1a1410',
                color: '#d4a843', fontWeight: 700, fontSize: 13,
                fontFamily: 'inherit',
                border: '1px solid #d4a843', borderRadius: 8, cursor: 'pointer',
              }}
            >
              🎩 Répartition ({unassignedCount})
            </button>
          )}
        </div>

        {/* Center: title */}
        <div style={{ fontSize: 22, fontWeight: 700, color: '#d4a843', textAlign: 'center' }}>
          Quatre Maisons
        </div>

        {/* Right: timer + reveal */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          {hasHiddenBonuses && (
            <button
              onClick={handleReveal}
              disabled={revealing}
              style={{
                padding: '6px 14px',
                background: revealing ? '#251c15' : 'linear-gradient(135deg, #d4a843, #b8860b)',
                color: revealing ? '#d4a843' : '#1a1410',
                fontWeight: 700, fontSize: 13,
                fontFamily: 'inherit',
                border: revealing ? '1px solid #d4a843' : 'none',
                borderRadius: 8, cursor: revealing ? 'default' : 'pointer',
                animation: revealing ? 'academy-pulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              {revealing ? '✨ Révélation...' : `✨ Bonus (${hiddenBonuses.length})`}
            </button>
          )}
          <button
            onClick={() => setShowTimer(true)}
            style={{
              padding: '6px 14px',
              background: '#1a1410',
              color: '#d4a843', fontWeight: 700, fontSize: 13,
              fontFamily: 'inherit',
              border: '1px solid #d4a843', borderRadius: 8, cursor: 'pointer',
            }}
          >
            ⏳ Minuteur
          </button>
        </div>
      </div>

      {/* Full-screen hourglasses */}
      <div style={{
        flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 24, padding: '12px 16px',
        position: 'relative', zIndex: 1,
      }}>
        {ranked.map((h, i) => {
          const hc = HOUSE_INLINE[h.id];
          const pct = Math.min(100, Math.round((h.points / pointsCap) * 100));
          return (
            <div key={h.id} style={{
              textAlign: 'center', position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flex: 1, maxWidth: 200,
            }}>
              {/* Crest */}
              <div style={{ marginBottom: 6 }}>
                <HouseCrest house={h} size={56} glow={i === 0} />
              </div>

              {/* House name */}
              <div style={{ fontSize: 18, fontWeight: 700, color: hc.c2, marginBottom: 6 }}>
                {h.name}
              </div>

              {/* Hourglass — fills remaining space */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Hourglass
                  pct={pct}
                  color={hc.c1}
                  colorLight={hc.c1Light}
                  size={180}
                />
              </div>

              {/* Points */}
              <div style={{
                fontSize: 36, fontWeight: 800,
                color: '#e8dcc8', lineHeight: 1, marginTop: 8,
              }}>
                <RollingNumber value={h.points} duration={2000} />
              </div>
              <div style={{ fontSize: 13, color: '#6a5c4e' }}>points</div>

              {/* Rank badge */}
              <div style={{
                fontSize: 13, fontWeight: 700, marginTop: 4,
                color: i === 0 ? '#d4a843' : '#6a5c4e',
              }}>
                {i === 0 ? '1er' : `${i + 1}e`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer modal */}
      {showTimer && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTimer(false); }}
        >
          <div style={{ position: 'relative', minWidth: 320 }}>
            <button
              onClick={() => setShowTimer(false)}
              style={{
                position: 'absolute', top: -12, right: -12,
                width: 32, height: 32, borderRadius: '50%',
                background: '#3a2e22', color: '#d4a843', border: 'none',
                fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1,
              }}
            >✕</button>
            <ClassroomTimer />
          </div>
        </div>
      )}
    </div>
  );
}
