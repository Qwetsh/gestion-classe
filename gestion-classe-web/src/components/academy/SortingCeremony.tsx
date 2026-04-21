import { useState, useEffect } from 'react';
import { HOUSE_DATA, HOUSE_LIST } from './houses';
import { HouseCrest } from './HouseCrest';
import { calculateStudentScores, runSortingAlgorithm, type StudentScores } from '../../lib/sortingAlgorithm';
import { saveAssignment, fetchAssignments, type HouseId, type AcademyAssignment } from '../../lib/academyQueries';
import choixpeauImg from '../../assets/choixpeau.png';

interface Props {
  classId: string;
  students: { id: string; pseudo: string }[];
  assignments: AcademyAssignment[];
  onAssigned: () => void; // reload data after assignment
  onClose: () => void;
}

type CeremonyStep = 'queue' | 'hatting' | 'revealing' | 'revealed';

export function SortingCeremony({ classId, students, assignments, onAssigned, onClose }: Props) {
  const [scores, setScores] = useState<StudentScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStudent, setCurrentStudent] = useState<StudentScores | null>(null);
  const [step, setStep] = useState<CeremonyStep>('queue');
  const [revealedHouse, setRevealedHouse] = useState<HouseId | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Load student scores on mount
  useEffect(() => {
    (async () => {
      const allScores = await calculateStudentScores(classId);
      const assignedIds = new Set(assignments.map(a => a.student_id));
      // Only students who completed quiz but aren't assigned
      const pending = allScores.filter(s => !assignedIds.has(s.student_id));
      setScores(pending);
      setLoading(false);
    })();
  }, [classId, assignments]);

  const pendingStudents = scores.filter(s => !completedIds.has(s.student_id));

  const selectStudent = (s: StudentScores) => {
    setCurrentStudent(s);
    setStep('hatting');
    setRevealedHouse(null);
  };

  const clickHat = async () => {
    if (!currentStudent) return;
    setStep('revealing');

    // Run algorithm for this single student considering current assignments
    const currentAssignments = await fetchAssignments(classId);
    const overrides = currentAssignments.filter(a => a.override).map(a => ({
      student_id: a.student_id, house: a.house,
    }));

    const result = runSortingAlgorithm(
      [currentStudent],
      [...overrides, ...currentAssignments.filter(a => !a.override).map(a => ({ student_id: a.student_id, house: a.house }))],
      students.length,
    );

    // The algorithm puts existing assignments as "overrides" to count them,
    // but the new assignment is the first one that matches our student
    const assignment = result.assignments.find(a => a.student_id === currentStudent.student_id);
    const house = assignment?.house || currentStudent.dominantHouse;

    // Dramatic pause
    await new Promise(r => setTimeout(r, 2500));

    setRevealedHouse(house);
    setStep('revealed');

    // Save to DB
    await saveAssignment(currentStudent.student_id, classId, house, false);
    onAssigned();
  };

  const nextStudent = () => {
    if (currentStudent) {
      setCompletedIds(prev => new Set([...prev, currentStudent.student_id]));
    }
    setCurrentStudent(null);
    setStep('queue');
    setRevealedHouse(null);
  };

  const houseData = revealedHouse ? HOUSE_DATA[revealedHouse] : null;

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#0a0908',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 22, color: '#d4a843',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
        }}>
          Préparation de la cérémonie...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0a0908',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
    }}>
      {/* Stars background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 60 }, (_, i) => (
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
        padding: '20px', textAlign: 'center', flexShrink: 0,
        borderBottom: '1px solid #3a2e22', position: 'relative', zIndex: 1,
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            color: '#8a7a66', background: 'none', border: 'none',
            fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >← Retour</button>
        <div style={{ fontSize: 11, color: '#8a7a66', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Cérémonie de la
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#d4a843', marginTop: 2 }}>
          Répartition
        </div>
        <div style={{ fontSize: 13, color: '#6a5c4e', marginTop: 4 }}>
          {pendingStudents.length} élève{pendingStudents.length > 1 ? 's' : ''} en attente
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, position: 'relative', zIndex: 1,
      }}>
        {/* === QUEUE: show student list === */}
        {step === 'queue' && (
          <div style={{ width: '100%', maxWidth: 500 }}>
            {pendingStudents.length === 0 ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
                <div style={{ fontSize: 22, color: '#d4a843', fontWeight: 700 }}>
                  Tous les élèves ont été répartis !
                </div>
                <button
                  onClick={onClose}
                  style={{
                    marginTop: 24, padding: '14px 40px',
                    fontSize: 17, fontWeight: 700,
                    background: 'linear-gradient(135deg, #d4a843, #b8860b)',
                    color: '#1a1410', border: 'none', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Terminer la cérémonie
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  textAlign: 'center', fontSize: 15, color: '#8a7a66', marginBottom: 8,
                  fontStyle: 'italic',
                }}>
                  L'élève s'avance vers le Choixpeau...
                </div>
                {pendingStudents.map(s => (
                  <button
                    key={s.student_id}
                    onClick={() => selectStudent(s)}
                    style={{
                      padding: '16px 20px', width: '100%',
                      background: '#1a1410', border: '1px solid #3a2e22',
                      borderRadius: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 14,
                      transition: 'border-color 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#d4a843')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#3a2e22')}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: '#251c15', border: '1px solid #3a2e22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, color: '#d4a843',
                    }}>🧙</div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#e8dcc8' }}>
                        {s.pseudo}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: '#6a5c4e' }}>›</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === HATTING: student clicks the hat === */}
        {step === 'hatting' && currentStudent && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 22, color: '#e8dcc8', fontWeight: 700, marginBottom: 8,
            }}>
              {currentStudent.pseudo}
            </div>
            <div style={{
              fontSize: 14, color: '#8a7a66', fontStyle: 'italic', marginBottom: 32,
            }}>
              Pose ta main sur le Choixpeau...
            </div>
            <button
              onClick={clickHat}
              style={{
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer',
                filter: 'drop-shadow(0 0 30px rgba(212,168,67,0.4)) drop-shadow(0 0 60px rgba(212,168,67,0.15))',
                transition: 'transform 200ms, filter 200ms',
                animation: 'academy-float 3s ease-in-out infinite',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(212,168,67,0.6)) drop-shadow(0 0 80px rgba(212,168,67,0.3))';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.filter = 'drop-shadow(0 0 30px rgba(212,168,67,0.4)) drop-shadow(0 0 60px rgba(212,168,67,0.15))';
              }}
            >
              <img src={choixpeauImg} alt="Choixpeau Magique" style={{ width: 220, height: 'auto' }} />
            </button>
          </div>
        )}

        {/* === REVEALING: dramatic pause === */}
        {step === 'revealing' && currentStudent && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 22, color: '#e8dcc8', fontWeight: 700, marginBottom: 16,
            }}>
              {currentStudent.pseudo}
            </div>
            <div style={{
              marginBottom: 16,
              animation: 'academy-shake 0.4s ease-in-out infinite',
              filter: 'drop-shadow(0 0 20px rgba(212,168,67,0.5))',
            }}>
              <img src={choixpeauImg} alt="Choixpeau" style={{ width: 160, height: 'auto' }} />
            </div>
            <div style={{
              fontSize: 18, color: '#d4a843', fontStyle: 'italic',
              animation: 'academy-twinkle 1.5s ease-in-out infinite',
            }}>
              Mmm... voyons, voyons...
            </div>
          </div>
        )}

        {/* === REVEALED: show the house === */}
        {step === 'revealed' && currentStudent && houseData && (
          <div style={{
            textAlign: 'center',
            animation: 'academy-reveal 0.6s ease-out',
          }}>
            <div style={{
              fontSize: 14, color: '#8a7a66', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              {currentStudent.pseudo} rejoint...
            </div>
            <div style={{
              fontSize: 42, fontWeight: 800, marginBottom: 20,
              color: houseData.cInkLight,
              textShadow: `0 0 30px ${houseData.c1}`,
            }}>
              {houseData.name} !
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <HouseCrest house={houseData} size={120} glow />
            </div>
            <div style={{
              fontSize: 15, color: '#8a7a66', fontStyle: 'italic', marginBottom: 8,
            }}>
              « {houseData.mottoFr} »
            </div>
            <div style={{
              fontSize: 13, color: '#6a5c4e', marginBottom: 32,
            }}>
              {houseData.virtue} · {houseData.element}
            </div>
            <button
              onClick={nextStudent}
              style={{
                padding: '14px 40px', fontSize: 17, fontWeight: 700,
                background: 'linear-gradient(135deg, #d4a843, #b8860b)',
                color: '#1a1410', border: 'none', borderRadius: 12, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(180,130,50,0.3)',
              }}
            >
              {pendingStudents.length > 1 ? 'Élève suivant' : 'Terminer'}
            </button>
          </div>
        )}
      </div>

      {/* House indicators at bottom */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 24,
        padding: '16px 20px', borderTop: '1px solid #1e1712',
        position: 'relative', zIndex: 1,
      }}>
        {HOUSE_LIST.map(h => (
          <div key={h.id} style={{ textAlign: 'center', opacity: revealedHouse === h.id ? 1 : 0.4 }}>
            <HouseCrest house={h} size={40} glow={revealedHouse === h.id} />
            <div style={{ fontSize: 10, color: '#8a7a66', marginTop: 4 }}>{h.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
