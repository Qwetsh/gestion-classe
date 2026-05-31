import { useState, useMemo, useCallback } from 'react';
import { HOUSE_LIST } from './houses';
import { HouseCrest } from './HouseCrest';
import { Hourglass } from './Hourglass';
import { ClassroomTimer } from './ClassroomTimer';
import { SortingCeremony } from './SortingCeremony';
import { RollingNumber } from './Atmosphere';
import { revealBonuses, saveBonus, type HouseId, type AcademyAssignment, type AcademyHouseBonus, type HousePoints } from '../../lib/academyQueries';
import './tokens.css';

interface Props {
  classId: string;
  userId: string;
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

type ViewMode = 'hourglasses' | 'students';

interface PointsModal {
  studentId: string;
  studentPseudo: string;
  house: HouseId;
}

const QUICK_AMOUNTS = [5, 10, 20, -5, -10, -20];

export function ClassroomDisplay({ classId, userId, housePoints, bonuses, assignments, students, onClose, onReload }: Props) {
  const [showCeremony, setShowCeremony] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('hourglasses');
  const [pointsModal, setPointsModal] = useState<PointsModal | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const ranked = useMemo(() => {
    return HOUSE_LIST.map(h => {
      const hp = housePoints.find(p => p.house === h.id);
      return { ...h, points: hp?.total_points || 0 };
    }).sort((a, b) => b.points - a.points);
  }, [housePoints]);

  const pointsCap = 500;

  const hiddenBonuses = bonuses.filter(b => !b.visible);
  const hasHiddenBonuses = hiddenBonuses.length > 0;

  // Group students by house
  const studentsByHouse = useMemo(() => {
    const map: Record<HouseId, { id: string; pseudo: string }[]> = {
      gryffondor: [], serpentard: [], serdaigle: [], poufsouffle: [],
    };
    for (const a of assignments) {
      const student = students.find(s => s.id === a.student_id);
      if (student && map[a.house]) {
        map[a.house].push(student);
      }
    }
    // Sort alphabetically within each house
    for (const house of Object.keys(map) as HouseId[]) {
      map[house].sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    }
    return map;
  }, [assignments, students]);

  const handleReveal = async () => {
    setRevealing(true);
    await revealBonuses(classId);
    setTimeout(() => {
      onReload();
      setRevealing(false);
    }, 3500);
  };

  const handleStudentClick = useCallback((studentId: string, pseudo: string, house: HouseId) => {
    setPointsModal({ studentId, studentPseudo: pseudo, house });
    setCustomAmount('');
    setReason('');
  }, []);

  const handleAwardPoints = useCallback(async (amount: number) => {
    if (!pointsModal || amount === 0) return;
    setSaving(true);
    const label = reason.trim()
      ? `${pointsModal.studentPseudo}: ${reason.trim()}`
      : pointsModal.studentPseudo;
    await saveBonus(classId, userId, pointsModal.house, amount, label, true);
    setSaving(false);
    setPointsModal(null);
    onReload();
  }, [pointsModal, reason, classId, userId, onReload]);

  if (showCeremony) {
    return (
      <SortingCeremony
        students={students}
        assignments={assignments}
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
          {/* Cérémonie purement visuelle, rejouable à volonté : rejoue les Maisons déjà attribuées.
              L'affectation réelle se lance depuis le dashboard (« Lancer la répartition »). */}
          {students.length > 0 && (
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
              🎩 Cérémonie ({assignments.length})
            </button>
          )}
        </div>

        {/* Center: view toggle */}
        <div style={{ display: 'flex', gap: 4, background: '#1a1410', borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setViewMode('hourglasses')}
            style={{
              padding: '5px 14px', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: viewMode === 'hourglasses' ? '#d4a843' : 'transparent',
              color: viewMode === 'hourglasses' ? '#1a1410' : '#8a7a66',
            }}
          >⏳ Sabliers</button>
          <button
            onClick={() => setViewMode('students')}
            style={{
              padding: '5px 14px', fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: viewMode === 'students' ? '#d4a843' : 'transparent',
              color: viewMode === 'students' ? '#1a1410' : '#8a7a66',
            }}
          >👤 Classe</button>
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

      {/* Content area */}
      {viewMode === 'hourglasses' ? (
        /* ===== HOURGLASSES VIEW ===== */
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
                <div style={{ marginBottom: 6 }}>
                  <HouseCrest house={h} size={56} glow={i === 0} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: hc.c2, marginBottom: 6 }}>
                  {h.name}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Hourglass pct={pct} color={hc.c1} colorLight={hc.c1Light} size={180} />
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#e8dcc8', lineHeight: 1, marginTop: 8 }}>
                  <RollingNumber value={h.points} duration={2000} />
                </div>
                <div style={{ fontSize: 13, color: '#6a5c4e' }}>points</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: i === 0 ? '#d4a843' : '#6a5c4e' }}>
                  {i === 0 ? '1er' : `${i + 1}e`}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== STUDENTS VIEW ===== */
        <div style={{
          flex: 1, display: 'flex', position: 'relative', zIndex: 1, overflow: 'hidden',
        }}>
          {/* Left: compact hourglasses */}
          <div style={{
            width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            borderRight: '1px solid #3a2e22', padding: '12px 8px',
          }}>
            {ranked.map((h, i) => {
              const hc = HOUSE_INLINE[h.id];
              const pct = Math.min(100, Math.round((h.points / pointsCap) * 100));
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                }}>
                  <Hourglass pct={pct} color={hc.c1} colorLight={hc.c1Light} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: hc.c2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {h.name}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#e8dcc8', lineHeight: 1 }}>
                      <RollingNumber value={h.points} duration={2000} />
                      <span style={{ fontSize: 11, color: '#6a5c4e', marginLeft: 4 }}>pts</span>
                    </div>
                  </div>
                  {i === 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d4a843' }}>1er</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: student list by house */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {(Object.keys(HOUSE_INLINE) as HouseId[]).map(houseId => {
              const hc = HOUSE_INLINE[houseId];
              const houseStudents = studentsByHouse[houseId];
              const houseName = HOUSE_LIST.find(h => h.id === houseId)?.name || houseId;
              if (houseStudents.length === 0) return null;
              return (
                <div key={houseId}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: hc.c2,
                    borderBottom: `1px solid ${hc.c1}44`, paddingBottom: 4, marginBottom: 8,
                  }}>
                    {houseName} ({houseStudents.length})
                  </div>
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6,
                  }}>
                    {houseStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleStudentClick(s.id, s.pseudo, houseId)}
                        style={{
                          padding: '6px 12px',
                          background: `${hc.c1}22`,
                          color: hc.c2,
                          border: `1px solid ${hc.c1}44`,
                          borderRadius: 8, cursor: 'pointer',
                          fontSize: 13, fontWeight: 600,
                          fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${hc.c1}55`;
                          e.currentTarget.style.borderColor = hc.c2;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${hc.c1}22`;
                          e.currentTarget.style.borderColor = `${hc.c1}44`;
                        }}
                      >
                        {s.pseudo}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Points award modal */}
      {pointsModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPointsModal(null); }}
        >
          <div style={{
            background: '#1a1410',
            border: '1px solid #3a2e22',
            borderRadius: 16, padding: 24,
            width: 380, maxWidth: '90vw',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e8dcc8' }}>
                {pointsModal.studentPseudo}
              </div>
              <div style={{ fontSize: 14, color: HOUSE_INLINE[pointsModal.house].c2, fontWeight: 600 }}>
                {HOUSE_LIST.find(h => h.id === pointsModal.house)?.name}
              </div>
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {QUICK_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  disabled={saving}
                  onClick={() => handleAwardPoints(amt)}
                  style={{
                    padding: '8px 16px', fontSize: 16, fontWeight: 700,
                    fontFamily: 'inherit',
                    borderRadius: 8, cursor: saving ? 'default' : 'pointer',
                    border: 'none',
                    background: amt > 0
                      ? 'linear-gradient(135deg, #2d6a4f, #40916c)'
                      : 'linear-gradient(135deg, #9b2226, #ae2012)',
                    color: '#fff',
                    opacity: saving ? 0.5 : 1,
                    minWidth: 60,
                  }}
                >
                  {amt > 0 ? `+${amt}` : amt}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder="Autre..."
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 15,
                  background: '#0a0908', color: '#e8dcc8',
                  border: '1px solid #3a2e22', borderRadius: 8,
                  fontFamily: 'inherit',
                }}
              />
              <button
                disabled={saving || !customAmount || Number(customAmount) === 0}
                onClick={() => handleAwardPoints(Number(customAmount))}
                style={{
                  padding: '8px 16px', fontSize: 14, fontWeight: 700,
                  fontFamily: 'inherit',
                  borderRadius: 8, cursor: 'pointer',
                  border: 'none',
                  background: 'linear-gradient(135deg, #d4a843, #b8860b)',
                  color: '#1a1410',
                  opacity: saving || !customAmount || Number(customAmount) === 0 ? 0.5 : 1,
                }}
              >
                Valider
              </button>
            </div>

            {/* Reason */}
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Raison (optionnel)"
              onKeyDown={e => {
                if (e.key === 'Enter' && customAmount && Number(customAmount) !== 0) {
                  handleAwardPoints(Number(customAmount));
                }
              }}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                background: '#0a0908', color: '#e8dcc8',
                border: '1px solid #3a2e22', borderRadius: 8,
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />

            {/* Cancel */}
            <button
              onClick={() => setPointsModal(null)}
              style={{
                marginTop: 12, width: '100%', padding: '8px',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                background: 'none', border: '1px solid #3a2e22',
                borderRadius: 8, color: '#8a7a66', cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

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
