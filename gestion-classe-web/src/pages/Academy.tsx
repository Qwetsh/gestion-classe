import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import {
  fetchAllAcademyConfigs, fetchAssignments, fetchBonuses, fetchTestResponses,
  calculateHousePoints, saveBonus, revealBonuses, saveAssignment, saveCoefficient,
  type HouseId, type AcademyAssignment, type AcademyHouseBonus, type HousePoints,
} from '../lib/academyQueries';
import { calculateStudentScores, runSortingAlgorithm, saveSortingResults, type StudentScores, type SortingResult } from '../lib/sortingAlgorithm';
import { supabase } from '../lib/supabase';
import { Starfield, Ornament, WaxSeal, GoldParticles, RollingNumber } from '../components/academy/Atmosphere';
import { HouseCrest } from '../components/academy/HouseCrest';
import { HOUSE_DATA, HOUSE_LIST, type HouseData } from '../components/academy/houses';
import '../components/academy/tokens.css';

interface ClassOption { id: string; name: string; }

export function Academy() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [assignments, setAssignments] = useState<AcademyAssignment[]>([]);
  const [bonuses, setBonuses] = useState<AcademyHouseBonus[]>([]);
  const [housePoints, setHousePoints] = useState<HousePoints[]>([]);
  const [students, setStudents] = useState<{ id: string; pseudo: string }[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [modal, setModal] = useState<{ type: string; houseId?: HouseId } | null>(null);

  // Award zone state
  const [awardMode, setAwardMode] = useState<'house' | 'student'>('house');
  const [awardHouse, setAwardHouse] = useState<HouseId>('salamandre');
  const [awardStudentId, setAwardStudentId] = useState('');
  const [awardAmount, setAwardAmount] = useState(10);
  const [awardHidden, setAwardHidden] = useState(true);
  const [awardLabel, setAwardLabel] = useState('');

  // Sorting
  const [sortingResult, setSortingResult] = useState<SortingResult | null>(null);
  const [, setSortingScores] = useState<StudentScores[]>([]);

  // Coefficients
  const [groupSessions, setGroupSessions] = useState<{ id: string; created_at: string; status: string; coeff: number }[]>([]);

  // Load classes with academy enabled
  useEffect(() => {
    if (!user) return;
    (async () => {
      const configs = await fetchAllAcademyConfigs(user.id);
      const classIds = configs.map(c => c.class_id);
      if (classIds.length === 0) { setClasses([]); return; }
      const { data } = await supabase.from('classes').select('id, name').in('id', classIds).order('name');
      setClasses(data || []);
      if (data && data.length > 0 && !selectedClassId) setSelectedClassId(data[0].id);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!selectedClassId) return;
    const [a, b, hp, gs] = await Promise.all([
      fetchAssignments(selectedClassId),
      fetchBonuses(selectedClassId),
      calculateHousePoints(selectedClassId),
      supabase.from('group_sessions').select('id, created_at, status').eq('class_id', selectedClassId).order('created_at', { ascending: false }),
    ]);
    setAssignments(a);
    setBonuses(b);
    setHousePoints(hp);

    // Load students
    const { data: studs } = await supabase.from('students').select('id, pseudo').eq('class_id', selectedClassId).order('pseudo');
    setStudents(studs || []);

    // Load coefficients for group sessions
    const sessionIds = (gs.data || []).map(s => s.id);
    let coeffMap: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: coeffs } = await supabase.from('academy_session_coefficients').select('*').in('group_session_id', sessionIds);
      coeffMap = Object.fromEntries((coeffs || []).map(c => [c.group_session_id, c.coefficient]));
    }
    setGroupSessions((gs.data || []).map(s => ({ ...s, coeff: coeffMap[s.id] ?? 1.0 })));
  }, [selectedClassId]);

  useEffect(() => { loadData(); }, [loadData]);

  const leaderboard = useMemo(() =>
    [...housePoints].sort((a, b) => b.total_points - a.total_points), [housePoints]);

  const rankById = useMemo(() => {
    const r: Record<string, number> = {};
    leaderboard.forEach((h, i) => r[h.house] = i + 1);
    return r;
  }, [leaderboard]);

  const hiddenBonusByHouse = useMemo(() => {
    const m: Record<HouseId, number> = { salamandre: 0, vouivre: 0, zephyr: 0, taisson: 0 };
    bonuses.filter(b => !b.visible).forEach(b => { m[b.house] += b.points; });
    return m;
  }, [bonuses]);

  const totalHiddenBonus = Object.values(hiddenBonusByHouse).reduce((a, b) => a + b, 0);

  const handleReveal = async () => {
    if (revealing || totalHiddenBonus === 0 || !selectedClassId) return;
    setRevealing(true);
    await revealBonuses(selectedClassId);
    setTimeout(async () => {
      await loadData();
      setRevealing(false);
    }, 3500);
  };

  const handleAward = async () => {
    if (!selectedClassId || !user) return;
    let targetHouse = awardHouse;
    if (awardMode === 'student') {
      const a = assignments.find(x => x.student_id === awardStudentId);
      if (!a) return;
      targetHouse = a.house;
    }
    await saveBonus(selectedClassId, user.id, targetHouse, awardAmount, awardLabel || 'Bonus', !awardHidden);
    setAwardLabel('');
    setAwardAmount(10);
    await loadData();
  };

  const handleRunSorting = async () => {
    if (!selectedClassId) return;
    const scores = await calculateStudentScores(selectedClassId);
    setSortingScores(scores);
    const overrides = assignments.filter(a => a.override).map(a => ({ student_id: a.student_id, house: a.house }));
    const result = runSortingAlgorithm(scores, overrides, students.length);
    setSortingResult(result);
    setModal({ type: 'sorting' });
  };

  const handleConfirmSorting = async () => {
    if (!sortingResult || !selectedClassId) return;
    await saveSortingResults(selectedClassId, sortingResult.assignments);
    setModal(null);
    setSortingResult(null);
    await loadData();
  };

  const handleReassign = async (studentId: string, house: HouseId) => {
    if (!selectedClassId) return;
    await saveAssignment(studentId, selectedClassId, house, true);
    await loadData();
  };

  const handleSaveCoeff = async (sessionId: string, coeff: number) => {
    await saveCoefficient(sessionId, coeff);
    setGroupSessions(prev => prev.map(s => s.id === sessionId ? { ...s, coeff } : s));
  };

  const getPointsForHouse = (houseId: HouseId) => housePoints.find(h => h.house === houseId)?.total_points ?? 0;

  if (classes.length === 0) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-dim)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏰</div>
          <h2>Aucune classe avec le module Académie</h2>
          <p>Activez le module dans la page Classes pour commencer.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fluid>
      <div className="academy-root" style={{
        minHeight: 'calc(100vh - 56px)', position: 'relative',
        background: 'var(--ink-void)', color: 'var(--parchment)',
        fontFamily: 'var(--font-body)', paddingBottom: 80,
        marginTop: -16, marginLeft: -16, marginRight: -16,
        padding: '0 0 80px',
      }}>
        <Starfield density={120} />

        {/* Header */}
        <header style={{
          position: 'relative', padding: '24px 40px 20px',
          borderBottom: '1px solid oklch(0.30 0.04 60 / 0.6)',
          background: 'linear-gradient(180deg, oklch(0.08 0.02 55) 0%, transparent 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="var(--gold)" strokeWidth="0.8" />
                <circle cx="22" cy="22" r="14" fill="none" stroke="var(--gold)" strokeWidth="0.6" />
                <path d="M22 4 L24 20 L22 22 L20 20 Z" fill="var(--gold)" />
                <path d="M22 40 L24 24 L22 22 L20 24 Z" fill="var(--gold)" opacity="0.5" />
              </svg>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.35em', color: 'var(--gold-deep)', textTransform: 'uppercase' }}>
                  Académie des Quatre Lumières
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontStyle: 'italic', margin: 0, fontWeight: 500 }}>
                  Registre du Professeur
                </h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                style={{
                  padding: '8px 14px', background: 'oklch(0.15 0.02 55)',
                  border: '1px solid var(--gold-shadow)', color: 'var(--parchment)',
                  fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15,
                }}
              >
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <WaxSeal letter={user?.email?.[0]?.toUpperCase() || 'P'} size={48} />
            </div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 32, padding: '32px 40px', position: 'relative' }}>
          {/* Main column */}
          <main>
            {/* 4 House Panels */}
            <SectionHeading title="Les Quatre Maisons" sub="Points cumulés et classement" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 24 }}>
              {HOUSE_LIST.map(h => (
                <HousePanel
                  key={h.id}
                  house={h}
                  points={getPointsForHouse(h.id)}
                  hiddenBonus={hiddenBonusByHouse[h.id]}
                  rank={rankById[h.id] || 4}
                  revealing={revealing}
                  studentCount={assignments.filter(a => a.house === h.id).length}
                  onClick={() => setModal({ type: 'roster', houseId: h.id })}
                />
              ))}
            </div>

            {/* Podium */}
            <div style={{ marginTop: 48 }}>
              <SectionHeading title="Classement" sub="Podium des Maisons" />
              <Podium leaderboard={leaderboard} />
            </div>

            {/* Award Zone */}
            <div style={{ marginTop: 48 }}>
              <SectionHeading title="Attribution des points" sub="Par maison ou par élève — le bonus peut être caché jusqu'au reveal" />
              <div style={{
                marginTop: 24, padding: 28,
                background: 'linear-gradient(180deg, oklch(0.14 0.02 55 / 0.6), oklch(0.10 0.02 50 / 0.4))',
                border: '1px solid var(--ink-line)', borderRadius: 2,
                display: 'grid', gridTemplateColumns: '1fr 300px', gap: 36,
              }}>
                <div>
                  {/* Mode toggle */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
                    {(['house', 'student'] as const).map(m => (
                      <button key={m} onClick={() => setAwardMode(m)} style={{
                        padding: '10px 20px',
                        background: awardMode === m ? 'var(--parchment)' : 'transparent',
                        color: awardMode === m ? 'var(--ink-warm)' : 'var(--parchment-dark)',
                        border: '1px solid var(--ink-line)',
                        fontFamily: 'var(--font-body)', fontSize: 14, fontStyle: 'italic', cursor: 'pointer',
                      }}>
                        {m === 'house' ? 'Par Maison' : 'Par élève'}
                      </button>
                    ))}
                  </div>

                  {/* Target selector */}
                  {awardMode === 'house' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {HOUSE_LIST.map(h => (
                        <button key={h.id} onClick={() => setAwardHouse(h.id)} style={{
                          padding: '12px 8px',
                          background: awardHouse === h.id ? h.c1 : 'transparent',
                          color: awardHouse === h.id ? 'var(--gold-bright)' : 'var(--parchment)',
                          border: `1px solid ${awardHouse === h.id ? h.c1 : 'var(--ink-line)'}`,
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14,
                        }}>
                          <div style={{ transform: 'scale(0.3)', margin: '-22px 0' }}>
                            <HouseCrest house={h} size={60} ornate={false} />
                          </div>
                          {h.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <select value={awardStudentId} onChange={e => setAwardStudentId(e.target.value)} style={{
                      width: '100%', padding: '10px 14px',
                      background: 'var(--parchment)', color: 'var(--ink-warm)',
                      fontFamily: 'var(--font-body)', fontSize: 15, border: '1px solid var(--gold-shadow)',
                    }}>
                      <option value="">Choisir un élève...</option>
                      {students.map(s => {
                        const a = assignments.find(x => x.student_id === s.id);
                        return <option key={s.id} value={s.id}>{s.pseudo}{a ? ` — ${HOUSE_DATA[a.house].name}` : ''}</option>;
                      })}
                    </select>
                  )}

                  {/* Label */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--parchment-dark)', textTransform: 'uppercase' }}>Motif</label>
                    <input value={awardLabel} onChange={e => setAwardLabel(e.target.value)} placeholder="Ex: Épreuve de poésie" style={{
                      width: '100%', padding: '8px 12px', marginTop: 4,
                      fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14,
                      background: 'oklch(0.20 0.02 55 / 0.6)', border: '1px solid var(--gold-shadow)',
                      color: 'var(--parchment)',
                    }} />
                  </div>

                  {/* Slider */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--parchment-dark)', textTransform: 'uppercase' }}>Points</label>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontStyle: 'italic', color: 'var(--gold-bright)', lineHeight: 1 }}>
                        {awardAmount > 0 ? '+' : ''}{awardAmount}
                      </div>
                    </div>
                    <input type="range" min="-50" max="100" step="5" value={awardAmount} onChange={e => setAwardAmount(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--gold)' }} />
                  </div>

                  {/* Hidden toggle */}
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button onClick={() => setAwardHidden(!awardHidden)} style={{
                      width: 50, height: 26, borderRadius: 13,
                      background: awardHidden ? 'oklch(0.30 0.08 30)' : 'var(--gold-deep)',
                      border: '1px solid var(--gold-shadow)', position: 'relative', cursor: 'pointer', transition: 'all 0.25s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: awardHidden ? 2 : 24,
                        width: 20, height: 20, borderRadius: '50%',
                        background: awardHidden ? 'oklch(0.85 0.08 30)' : 'var(--gold-bright)',
                        transition: 'all 0.25s', boxShadow: '0 1px 4px oklch(0 0 0 / 0.6)',
                      }} />
                    </button>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>
                        {awardHidden ? 'Bonus caché' : 'Bonus visible'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--parchment-dark)', fontStyle: 'italic' }}>
                        {awardHidden ? 'Révélé à votre signal' : 'Affiché en temps réel'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: summary + buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ padding: 16, background: 'oklch(0.06 0 0 / 0.6)', border: '1px solid var(--gold-shadow)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-deep)', textTransform: 'uppercase' }}>Bonus cachés en attente</div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {HOUSE_LIST.map(h => (
                        <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14 }}>
                          <span>{h.name}</span>
                          <span style={{ color: hiddenBonusByHouse[h.id] > 0 ? 'var(--gold-bright)' : 'var(--parchment-dark)' }}>
                            {hiddenBonusByHouse[h.id] > 0 ? `+${hiddenBonusByHouse[h.id]}` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleAward} style={{
                    padding: '12px 20px', background: 'var(--parchment)', color: 'var(--ink-warm)',
                    border: '2px solid var(--gold)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, cursor: 'pointer', marginTop: 12,
                  }}>Inscrire au registre</button>
                  <button onClick={handleReveal} disabled={revealing || totalHiddenBonus === 0} style={{
                    padding: '14px 20px', background: revealing ? 'var(--gold-deep)' : 'linear-gradient(180deg, var(--gold), var(--gold-deep))',
                    color: 'var(--ink-deep)', border: 'none', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, fontWeight: 600,
                    cursor: totalHiddenBonus === 0 ? 'not-allowed' : 'pointer', marginTop: 8,
                    opacity: totalHiddenBonus === 0 ? 0.4 : 1, boxShadow: '0 0 20px oklch(0.78 0.12 85 / 0.3)',
                  }}>{revealing ? '— Révélation en cours —' : 'Révéler les bonus cachés'}</button>
                </div>
              </div>
            </div>

            {/* Coefficients */}
            {groupSessions.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <SectionHeading title="Coefficients" sub="Sessions de groupe — multiplicateur de points" />
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupSessions.map(gs => (
                    <div key={gs.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', background: 'oklch(0.12 0.02 55 / 0.6)', border: '1px solid var(--ink-line)',
                    }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}>
                          Session du {new Date(gs.created_at).toLocaleDateString('fr-FR')}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold-deep)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                          {gs.status}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dark)' }}>×</span>
                        <input
                          type="number" min="0" max="5" step="0.5" value={gs.coeff}
                          onChange={e => handleSaveCoeff(gs.id, parseFloat(e.target.value) || 1)}
                          style={{
                            width: 60, padding: '6px 8px', textAlign: 'center',
                            background: 'oklch(0.20 0.02 55)', border: '1px solid var(--gold-shadow)',
                            color: 'var(--gold-bright)', fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          {/* Right sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <SidePanel title="Actions rapides">
              <QuickAction icon="reveal" label="Révéler les bonus cachés" detail={`${totalHiddenBonus} points en attente`}
                onClick={handleReveal} disabled={revealing || totalHiddenBonus === 0} highlight />
              <QuickAction icon="sort" label="Lancer la répartition" detail={`${students.length} élèves`}
                onClick={handleRunSorting} />
              <QuickAction icon="reassign" label="Réaffecter un·e élève" detail="Choix manuel de la Maison"
                onClick={() => setModal({ type: 'reassign' })} />
              <QuickAction icon="responses" label="Réponses brutes du test" detail={`${assignments.length} réparti·es`}
                onClick={() => setModal({ type: 'rawResponses' })} />
            </SidePanel>

            {/* Students without house */}
            {(() => {
              const assignedIds = new Set(assignments.map(a => a.student_id));
              const unassigned = students.filter(s => !assignedIds.has(s.id));
              if (unassigned.length === 0) return null;
              return (
                <SidePanel title="Élèves sans maison">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {unassigned.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>{s.pseudo}</span>
                        <select onChange={e => { if (e.target.value) handleReassign(s.id, e.target.value as HouseId); }}
                          defaultValue="" style={{
                            padding: '4px 8px', background: 'transparent', border: '1px solid var(--ink-line)',
                            color: 'var(--parchment)', fontFamily: 'var(--font-body)', fontSize: 12, fontStyle: 'italic',
                          }}>
                          <option value="">Assigner...</option>
                          {HOUSE_LIST.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </SidePanel>
              );
            })()}
          </aside>
        </div>

        {/* Modals */}
        {modal?.type === 'roster' && modal.houseId && (
          <ModalShell
            title={`Maison ${HOUSE_DATA[modal.houseId].name}`}
            subtitle={`${HOUSE_DATA[modal.houseId].element} · ${HOUSE_DATA[modal.houseId].virtue}`}
            onClose={() => setModal(null)}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 24, marginBottom: 24 }}>
              <HouseCrest house={HOUSE_DATA[modal.houseId]} size={100} />
              <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.6 }}>
                {HOUSE_DATA[modal.houseId].description}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', marginTop: 8, color: 'var(--ink-line)' }}>
                  « {HOUSE_DATA[modal.houseId].motto} »
                </div>
              </div>
            </div>
            {assignments.filter(a => a.house === modal.houseId).map(a => {
              const s = students.find(x => x.id === a.student_id);
              return s ? (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid oklch(0.60 0.05 70 / 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: HOUSE_DATA[modal.houseId!].c1,
                      color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, border: '1px solid var(--gold-shadow)',
                    }}>{s.pseudo.substring(0, 2).toUpperCase()}</div>
                    <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}>{s.pseudo}</span>
                  </div>
                  <select value={a.house} onChange={e => handleReassign(a.student_id, e.target.value as HouseId)}
                    style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--ink-warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontStyle: 'italic' }}>
                    {HOUSE_LIST.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              ) : null;
            })}
          </ModalShell>
        )}

        {modal?.type === 'reassign' && (
          <ModalShell title="Réaffectation manuelle" subtitle="Administration" onClose={() => setModal(null)}>
            <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14, marginBottom: 16 }}>
              Déplacez un·e apprenti·e vers une autre Maison d'un simple choix.
            </p>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {students.map(s => {
                const a = assignments.find(x => x.student_id === s.id);
                return (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid oklch(0.60 0.05 70 / 0.3)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>{s.pseudo}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: a ? HOUSE_DATA[a.house].cInkLight : 'var(--parchment-dark)' }}>
                      {a ? HOUSE_DATA[a.house].name.toUpperCase() : 'AUCUNE'}
                    </span>
                    <select value={a?.house || ''} onChange={e => { if (e.target.value) handleReassign(s.id, e.target.value as HouseId); }}
                      style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--ink-warm)', fontFamily: 'var(--font-body)', fontSize: 12, fontStyle: 'italic' }}>
                      <option value="">—</option>
                      {HOUSE_LIST.map(h => <option key={h.id} value={h.id}>→ {h.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </ModalShell>
        )}

        {modal?.type === 'sorting' && sortingResult && (
          <ModalShell title="Résultat de la répartition" subtitle="Le Diadème a parlé" onClose={() => setModal(null)} width={800}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {HOUSE_LIST.map(h => {
                const count = sortingResult.assignments.filter(a => a.house === h.id).length + sortingResult.overrides.filter(o => o.house === h.id).length;
                return (
                  <div key={h.id} style={{ textAlign: 'center', padding: 12, border: '1px solid var(--ink-line)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18 }}>{h.name}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontStyle: 'italic', color: 'var(--gold-bright)' }}>{count}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--parchment-dark)' }}>apprenti·es</div>
                  </div>
                );
              })}
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {sortingResult.assignments.map(a => (
                <div key={a.student_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid oklch(0.60 0.05 70 / 0.2)', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14 }}>
                  <span>{a.pseudo}</span>
                  <span style={{ color: HOUSE_DATA[a.house].cInkLight }}>{HOUSE_DATA[a.house].name} ({a.method})</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button onClick={() => setModal(null)} style={{
                flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--ink-line)',
                color: 'var(--parchment)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={handleConfirmSorting} style={{
                flex: 1, padding: '12px', background: 'var(--parchment)', color: 'var(--ink-warm)',
                border: '2px solid var(--gold)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, cursor: 'pointer',
              }}>Confirmer la répartition</button>
            </div>
          </ModalShell>
        )}

        {modal?.type === 'rawResponses' && (
          <RawResponsesModal students={students} classId={selectedClassId} onClose={() => setModal(null)} />
        )}

        {/* Reveal overlay */}
        {revealing && (
          <>
            <div style={{
              position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
              background: 'radial-gradient(ellipse at center, transparent 40%, oklch(0 0 0 / 0.6) 100%)',
              animation: 'academy-fadeIn 0.4s ease',
            }} />
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 51 }}>
              <GoldParticles active count={120} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

// --- Sub-components ---

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontStyle: 'italic', fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--gold-shadow), transparent)' }} />
      </div>
      {sub && <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14, color: 'var(--parchment-dark)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function HousePanel({ house, points, hiddenBonus, rank, revealing, studentCount, onClick }: {
  house: HouseData; points: number; hiddenBonus: number; rank: number; revealing: boolean; studentCount: number; onClick: () => void;
}) {
  const isLeader = rank === 1;
  return (
    <div style={{ position: 'relative' }} onClick={onClick}>
      {isLeader && (
        <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <svg width="50" height="25" viewBox="0 0 60 30">
            <path d="M4 28 L10 8 L20 20 L30 4 L40 20 L50 8 L56 28 Z" fill="var(--gold)" stroke="var(--gold-deep)" strokeWidth="0.8" />
            <circle cx="30" cy="4" r="2.5" fill="var(--gold-bright)" />
          </svg>
        </div>
      )}
      <div className="parchment-bg parchment-edges" style={{
        padding: '20px 16px 18px', minHeight: 340, position: 'relative', borderRadius: 2,
        boxShadow: isLeader ? '0 0 0 1.5px var(--gold), 0 20px 60px oklch(0 0 0 / 0.7)' : '0 12px 40px oklch(0 0 0 / 0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--ink-warm)',
        cursor: 'pointer', transition: 'transform 0.2s ease',
      }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <div style={{ position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--ink-line)', textTransform: 'uppercase' }}>
          {['1er', '2e', '3e', '4e'][rank - 1]} · {studentCount} él.
        </div>
        <div style={{ marginTop: 6 }}><HouseCrest house={house} size={100} glow={isLeader} /></div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontStyle: 'italic', fontWeight: 500, marginTop: 4, lineHeight: 1 }}>{house.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-line)', marginTop: 2 }}>« {house.mottoFr} »</div>
        <div style={{ marginTop: 10 }}><Ornament variant="diamond" color="var(--ink-line)" width={120} /></div>
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.3em', color: 'var(--ink-line)', textTransform: 'uppercase' }}>Points</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 500, lineHeight: 1, marginTop: 2,
            textShadow: isLeader ? '0 0 20px var(--gold)' : 'none',
          }}>
            <RollingNumber value={points} />
          </div>
          {hiddenBonus > 0 && !revealing && (
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'oklch(0.42 0.08 30)', marginTop: 4 }}>+ ? · caché</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Podium({ leaderboard }: { leaderboard: HousePoints[] }) {
  const maxPts = leaderboard[0]?.total_points || 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'flex-end', marginTop: 24, padding: '0 12px' }}>
      {leaderboard.map((hp, i) => {
        const house = HOUSE_DATA[hp.house];
        const heightPct = 0.5 + (hp.total_points / maxPts) * 0.5;
        return (
          <div key={hp.house} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.3em', color: 'var(--gold-deep)', marginBottom: 6 }}>
              {['Ier', 'IIe', 'IIIe', 'IVe'][i]} RANG
            </div>
            <HouseCrest house={house} size={55} ornate={false} glow={i === 0} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', fontWeight: 500, color: i === 0 ? 'var(--gold-bright)' : 'var(--parchment)', marginTop: 6 }}>
              {house.name}
            </div>
            <div style={{
              width: '100%', height: 100 * heightPct,
              background: `linear-gradient(180deg, ${house.c1}, oklch(0.25 0.05 60))`,
              border: '1px solid var(--gold-shadow)', borderBottom: 'none', marginTop: 10,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8,
              boxShadow: i === 0 ? 'inset 0 0 30px oklch(0.78 0.12 85 / 0.3)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, fontStyle: 'italic', color: 'var(--gold-bright)', textShadow: '0 0 12px oklch(0 0 0 / 0.6)' }}>
                <RollingNumber value={hp.total_points} />
              </div>
            </div>
            <div style={{ width: '100%', height: 12, background: 'linear-gradient(180deg, var(--gold-deep), var(--gold-shadow))' }} />
          </div>
        );
      })}
    </div>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--ink-line)', background: 'oklch(0.12 0.02 55 / 0.7)', padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold-deep)', textTransform: 'uppercase', marginBottom: 4 }}>{title}</div>
      <div style={{ height: 1, background: 'var(--ink-line)', marginBottom: 14 }} />
      {children}
    </div>
  );
}

function QuickAction({ icon, label, detail, onClick, disabled, highlight }: {
  icon: string; label: string; detail: string; onClick: () => void; disabled?: boolean; highlight?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '10px 12px',
      background: highlight ? 'oklch(0.15 0.06 70)' : 'transparent',
      border: `1px solid ${highlight ? 'var(--gold)' : 'var(--ink-line)'}`,
      color: 'var(--parchment)', fontFamily: 'var(--font-body)', cursor: disabled ? 'not-allowed' : 'pointer',
      textAlign: 'left', marginBottom: 8, opacity: disabled ? 0.4 : 1,
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--gold-shadow)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14,
      }}>
        {icon === 'reveal' && '✦'}
        {icon === 'sort' && '⚗'}
        {icon === 'reassign' && '⇄'}
        {icon === 'responses' && '📜'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--parchment-dark)', fontStyle: 'italic', marginTop: 2 }}>{detail}</div>
      </div>
    </button>
  );
}

function ModalShell({ title, subtitle, onClose, children, width = 720 }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'oklch(0 0 0 / 0.75)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="parchment-bg parchment-edges" style={{
        width, maxWidth: '90vw', maxHeight: '85vh', padding: '28px 36px 32px',
        borderRadius: 2, boxShadow: '0 40px 120px oklch(0 0 0 / 0.9)', color: 'var(--ink-warm)',
        position: 'relative', overflow: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%',
          border: '1px solid var(--ink-line)', background: 'transparent',
          fontFamily: 'var(--font-display)', fontSize: 18, cursor: 'pointer', color: 'var(--ink-warm)',
        }}>×</button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--ink-line)', textTransform: 'uppercase' }}>{subtitle}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontStyle: 'italic', fontWeight: 500, margin: '4px 0 0' }}>{title}</h2>
        <Ornament variant="diamond" color="var(--ink-line)" width={200} />
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function RawResponsesModal({ students, classId, onClose }: { students: { id: string; pseudo: string }[]; classId: string; onClose: () => void }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(students[0]?.id || '');

  useEffect(() => {
    if (!classId) return;
    fetchTestResponses(classId).then(setResponses);
  }, [classId]);

  const selected = responses.find(r => r.student.id === selectedId);

  return (
    <ModalShell title="Réponses brutes au Diadème" subtitle="Archives" onClose={onClose} width={820}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        <div style={{ maxHeight: 450, overflow: 'auto', borderRight: '1px solid oklch(0.60 0.05 70 / 0.4)', paddingRight: 12 }}>
          {responses.map(r => (
            <button key={r.student.id} onClick={() => setSelectedId(r.student.id)} style={{
              width: '100%', textAlign: 'left', padding: '6px 10px', margin: '2px 0',
              background: selectedId === r.student.id ? 'oklch(0.80 0.05 75)' : 'transparent',
              border: 'none', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13,
              color: 'var(--ink-warm)', cursor: 'pointer',
            }}>
              {r.student.pseudo} {r.hasCompleted ? '✓' : ''}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: 450, overflow: 'auto' }}>
          {selected ? (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontStyle: 'italic' }}>{selected.student.pseudo}</div>
              {selected.hasCompleted ? (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selected.responses.map((r: any, i: number) => (
                    <div key={i}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-line)' }}>Q{i + 1}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, marginTop: 4, padding: '4px 8px', background: 'oklch(0.82 0.04 80 / 0.5)', borderLeft: '2px solid var(--gold-shadow)' }}>
                        → Réponse sélectionnée
                        {r.academy_answers && (
                          <span style={{ fontSize: 11, color: 'var(--ink-line)', marginLeft: 8 }}>
                            (S:{r.academy_answers.salamandre_weight} V:{r.academy_answers.vouivre_weight} Z:{r.academy_answers.zephyr_weight} T:{r.academy_answers.taisson_weight})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {selected.preferences.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-line)' }}>PRÉFÉRENCES</div>
                      {selected.preferences.map((p: any, i: number) => (
                        <div key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 13, marginTop: 2 }}>
                          {['I', 'II', 'III', 'IV'][i]}. {HOUSE_DATA[p.house as HouseId]?.name || p.house}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-line)', marginTop: 12 }}>
                  Test non complété
                </div>
              )}
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--ink-line)' }}>Sélectionner un élève</div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
