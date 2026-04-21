import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCardTier } from '../lib/rewardsQueries';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { AcademyQuiz } from '../components/academy/AcademyQuiz';
import { MyHouse } from '../components/academy/MyHouse';
import type { HouseId } from '../lib/academyQueries';
import hpMusicUrl from '../Musique/Musique Générique - HARRY POTTER.mp3';

// ============================================
// Student theme — warm dark palette
// ============================================
const T = {
  bg: '#1a1410',
  bg2: '#221b14',
  card: '#2a2018',
  cardBorder: '#3a2e22',
  surface: '#1e1712',
  text: '#e8dcc8',
  textMuted: '#a09080',
  textDim: '#6a5c4e',
  gold: '#d4a843',
  goldBright: '#e8c066',
  goldDeep: '#b8860b',
  accent: '#c084fc',
  accentSoft: '#2e1065',
  pos: '#4ade80',
  posSoft: '#14532d',
  neg: '#f87171',
  negSoft: '#450a0a',
  warn: '#fbbf24',
  warnSoft: '#451a03',
  indigo: '#a5b4fc',
  indigoSoft: '#1e1b4b',
  font: "'Cormorant Garamond', Georgia, serif",
} as const;

// ============================================
// Stamp card types
// ============================================

interface StampData {
  student_id: string;
  active_card: {
    id: string;
    card_number: number;
    status: string;
    created_at: string;
    stamps: {
      id: string;
      slot_number: number;
      category_label: string;
      category_icon: string;
      category_color: string;
      awarded_at: string;
    }[];
    stamp_count: number;
  } | null;
  completed_cards: {
    id: string;
    card_number: number;
    completed_at: string;
    bonus_label: string | null;
    bonus_used: boolean;
    selected_at: string | null;
    used_at: string | null;
  }[];
  categories: {
    label: string;
    icon: string;
    color: string;
  }[];
  available_bonuses: {
    id: string;
    label: string;
  }[];
}

interface DashboardData {
  pseudo: string;
  class_name: string;
  trimester: number;
  school_year: string;
  grade: number;
  participations: number;
  malus: number;
  absences: number;
  target: number;
  class_rank: number;
  class_total: number;
  overall_rank: number;
  overall_total: number;
  top10_class: { rank: number; grade: number }[];
  top10_overall: { rank: number; grade: number }[];
  my_class_rank_among_classes: number;
  total_classes: number;
  my_class_avg: number;
  all_classes_ranking: { rank: number; class_name: string; avg_grade: number; student_count: number }[];
}

export function StudentDashboard() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeTab, setActiveTab] = useState<'grades' | 'stamps' | 'academy'>('grades');
  const [stampData, setStampData] = useState<StampData | null>(null);
  const [academyData, setAcademyData] = useState<{ enabled: boolean; house: HouseId | null; test_completed: boolean; classId: string | null } | null>(null);
  const [stampLoading, setStampLoading] = useState(false);
  const [stampError, setStampError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBonusSelect, setShowBonusSelect] = useState(false);
  const [selectedStampDetail, setSelectedStampDetail] = useState<{ label: string; icon: string; color: string; date: string } | null>(null);
  const currentCodeRef = useRef('');
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Academy music — play HP theme when Maison tab is active
  const isAcademyActive = activeTab === 'academy' && !!academyData?.enabled;
  useEffect(() => {
    if (isAcademyActive && !muted) {
      if (!audioRef.current) {
        audioRef.current = new Audio(hpMusicUrl);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isAcademyActive, muted]);

  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    setCode(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [code]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length < 6) {
      inputRefs.current[pasted.length]?.focus();
    }
  }, [code]);

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setIsLoading(true);
    setError(null);
    currentCodeRef.current = fullCode;

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_student_dashboard', { p_code: fullCode });
      if (rpcError) throw rpcError;
      if (result?.error) {
        setError(result.error === 'not_found' ? 'Code incorrect. Vérifie et réessaie.' : 'Erreur inconnue');
        setIsLoading(false);
        return;
      }
      setData(result);

      // Load stamp data
      setStampLoading(true);
      try {
        const { data: sData, error: sErr } = await supabase.rpc('get_student_stamps', { p_code: fullCode });
        if (!sErr && sData) setStampData(sData);
        else setStampError('Impossible de charger les tampons');
      } catch {
        setStampError('Erreur de chargement des tampons');
      }
      setStampLoading(false);

      // Load academy data
      try {
        const { data: aData } = await supabase.rpc('get_student_academy', { p_code: fullCode });
        if (aData && !aData.error) {
          setAcademyData({
            enabled: aData.enabled ?? false,
            house: aData.house ?? null,
            test_completed: aData.test_completed ?? false,
            classId: aData.class_id ?? null,
          });
        }
      } catch { /* ignore */ }
    } catch {
      setError('Erreur de connexion. Réessaie.');
    }
    setIsLoading(false);
  };

  const handleSelectBonus = async (bonusId: string) => {
    if (!stampData?.active_card) return;
    const cardId = stampData.active_card.id;
    try {
      const { error: err } = await supabase.rpc('select_card_bonus', { p_card_id: cardId, p_bonus_id: bonusId });
      if (err) throw err;
      setShowBonusSelect(false);
      setShowCelebration(true);
      celebrationTimerRef.current = setTimeout(() => setShowCelebration(false), 3500);
      // Reload stamp data
      const { data: sData } = await supabase.rpc('get_student_stamps', { p_code: currentCodeRef.current });
      if (sData) setStampData(sData);
    } catch {
      setError('Erreur lors de la selection du bonus');
    }
  };

  const handleLogout = () => {
    setData(null);
    setStampData(null);
    setAcademyData(null);
    setCode(['', '', '', '', '', '']);
    setError(null);
    setActiveTab('grades');
    currentCodeRef.current = '';
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const gradeColor = (grade: number) => {
    if (grade >= 16) return T.pos;
    if (grade >= 12) return T.indigo;
    if (grade >= 8) return T.warn;
    return T.neg;
  };

  const gradePercent = (grade: number) => Math.min(100, (grade / 20) * 100);

  // ============================================
  // CODE ENTRY SCREEN
  // ============================================
  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse at 50% 30%, ${T.bg2} 0%, ${T.bg} 70%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: T.font,
      }}>
        <div style={{
          background: T.card,
          borderRadius: '20px',
          padding: '40px 32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          border: `1px solid ${T.cardBorder}`,
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
            <h1 style={{ color: T.goldBright, fontFamily: T.font, fontWeight: 600, fontSize: 36, letterSpacing: '-0.02em', fontStyle: 'italic', margin: 0 }}>
              Mon espace
            </h1>
            <p style={{ color: T.textMuted, fontSize: '14px', marginTop: '8px' }}>
              Entre ton code personnel pour voir tes résultats
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                style={{
                  width: '48px', height: '56px', textAlign: 'center',
                  fontSize: '24px', fontWeight: 700, borderRadius: '12px',
                  border: `2px solid ${digit ? T.gold : T.cardBorder}`,
                  background: T.surface, color: T.text, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = T.gold; }}
                onBlur={e => { if (!digit) e.target.style.borderColor = T.cardBorder; }}
              />
            ))}
          </div>

          {error && (
            <p style={{ color: T.neg, textAlign: 'center', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || code.join('').length !== 6}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: code.join('').length === 6
                ? `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`
                : T.surface,
              color: code.join('').length === 6 ? T.bg : T.textDim,
              fontSize: '16px', fontWeight: 700, fontFamily: T.font,
              cursor: code.join('').length === 6 ? 'pointer' : 'default',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: code.join('').length === 6 ? '0 4px 16px rgba(180,130,50,0.3)' : 'none',
            }}
          >
            {isLoading ? 'Chargement...' : 'Voir mes résultats'}
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // DASHBOARD SCREEN
  // ============================================
  const isInTop10Class = data.class_rank <= 10;
  const isInTop10Overall = data.overall_rank <= 10;
  const isAcademyTab = isAcademyActive;

  return (
    <div style={{
      minHeight: '100vh',
      background: isAcademyTab ? 'transparent' : `radial-gradient(ellipse at 50% 0%, ${T.bg2} 0%, ${T.bg} 60%)`,
      padding: isAcademyTab ? 0 : '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
    }}>
      <div style={{ maxWidth: isAcademyTab ? 'none' : '480px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: isAcademyTab ? 0 : '20px',
          padding: isAcademyTab ? '10px 16px' : '0 4px',
          ...(isAcademyTab ? {
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            background: 'oklch(0.08 0.01 50 / 0.7)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          } : {}),
        }}>
          <div>
            <h1 style={{
              color: isAcademyTab ? 'oklch(0.85 0.04 60)' : T.goldBright,
              fontFamily: T.font, fontWeight: 600,
              fontSize: isAcademyTab ? 20 : 32, letterSpacing: '-0.02em', fontStyle: 'italic', margin: 0,
            }}>
              {data.pseudo}
            </h1>
            {!isAcademyTab && (
              <p style={{ color: T.textDim, fontSize: '13px', margin: '2px 0 0 0' }}>
                {data.class_name} · Trimestre {data.trimester} · {data.school_year}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAcademyTab && (
              <button
                onClick={() => setMuted(m => !m)}
                style={{
                  padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid oklch(0.35 0.04 60 / 0.4)',
                  background: 'transparent',
                  color: 'oklch(0.60 0.03 60)',
                  fontSize: '16px', cursor: 'pointer',
                }}
                title={muted ? 'Activer la musique' : 'Couper la musique'}
              >
                {muted ? '🔇' : '🔊'}
              </button>
            )}
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 14px', borderRadius: '8px',
              border: isAcademyTab ? '1px solid oklch(0.35 0.04 60 / 0.4)' : `1px solid ${T.cardBorder}`,
              background: 'transparent',
              color: isAcademyTab ? 'oklch(0.60 0.03 60)' : T.textMuted,
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            Quitter
          </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px',
          marginBottom: isAcademyTab ? 0 : '16px',
          ...(isAcademyTab ? {
            position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 10,
            background: 'oklch(0.08 0.01 50 / 0.75)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 0, padding: '6px 12px',
            paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
          } : { background: T.surface, borderRadius: '12px', padding: '4px' }),
        }}>
          {[
            { key: 'grades' as const, icon: '📊', label: 'Notes', activeColor: T.indigoSoft, activeText: T.indigo },
            { key: 'stamps' as const, icon: '⭐', label: 'Tampons', activeColor: T.warnSoft, activeText: T.warn },
            ...(academyData?.enabled ? [{ key: 'academy' as const, icon: '🏰', label: 'Maison', activeColor: T.accentSoft, activeText: T.accent }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: isAcademyTab ? '8px' : '10px',
                borderRadius: '10px', border: 'none',
                background: activeTab === tab.key
                  ? (isAcademyTab ? 'oklch(0.25 0.03 50 / 0.9)' : tab.activeColor)
                  : 'transparent',
                color: activeTab === tab.key
                  ? (isAcademyTab ? 'oklch(0.90 0.06 60)' : tab.activeText)
                  : (isAcademyTab ? 'oklch(0.55 0.03 60)' : T.textDim),
                fontSize: isAcademyTab ? '12px' : '14px',
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'academy' && academyData?.enabled ? (
          academyData.house && academyData.classId ? (
            <div style={{ overflow: 'hidden', minHeight: '100vh' }}>
              <MyHouse houseId={academyData.house} classId={academyData.classId} />
            </div>
          ) : (
            <div style={{ overflow: 'hidden', minHeight: '100vh' }}>
              <AcademyQuiz
                studentCode={currentCodeRef.current}
                onComplete={() => {
                  setAcademyData(prev => prev ? { ...prev, test_completed: true } : prev);
                }}
              />
            </div>
          )
        ) : activeTab === 'stamps' ? (
          <StampCardView
            stampData={stampData}
            stampLoading={stampLoading}
            stampError={stampError}
            showCelebration={showCelebration}
            showBonusSelect={showBonusSelect}
            setShowBonusSelect={setShowBonusSelect}
            onSelectBonus={handleSelectBonus}
            selectedStampDetail={selectedStampDetail}
            setSelectedStampDetail={setSelectedStampDetail}
          />
        ) : (
        <>
        {/* Grade Card */}
        <div style={{
          background: T.card, borderRadius: '16px', padding: '24px',
          marginBottom: '12px', border: `1px solid ${T.cardBorder}`, textAlign: 'center',
        }}>
          <p style={{ color: T.textMuted, fontSize: '13px', marginBottom: '8px' }}>Ma note actuelle</p>
          <div style={{ fontSize: '56px', fontWeight: 800, color: gradeColor(data.grade), lineHeight: 1 }}>
            {data.grade.toFixed(1)}
            <span style={{ fontSize: '24px', color: T.textDim }}>/20</span>
          </div>
          <div style={{
            marginTop: '16px', height: '8px', background: T.surface,
            borderRadius: '4px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${gradePercent(data.grade)}%`,
              background: `linear-gradient(90deg, ${gradeColor(data.grade)}88, ${gradeColor(data.grade)})`,
              borderRadius: '4px', transition: 'width 0.8s ease',
            }} />
          </div>
          <p style={{ color: T.textDim, fontSize: '12px', marginTop: '8px' }}>
            Objectif : {data.target} implications
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <StatCard label="Implications" value={data.participations} color={T.pos} />
          <StatCard label="Malus" value={data.malus} color={T.warn} />
          <StatCard label="Absences" value={data.absences} color={T.neg} />
        </div>

        {/* Rankings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: T.card, borderRadius: '16px', padding: '16px', border: `1px solid ${T.cardBorder}` }}>
            <p style={{ color: T.textMuted, fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement classe
            </p>
            <RankingDisplay rank={data.class_rank} total={data.class_total} top10={data.top10_class} isInTop10={isInTop10Class} studentGrade={data.grade} />
          </div>
          <div style={{ background: T.card, borderRadius: '16px', padding: '16px', border: `1px solid ${T.cardBorder}` }}>
            <p style={{ color: T.textMuted, fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement général
            </p>
            <RankingDisplay rank={data.overall_rank} total={data.overall_total} top10={data.top10_overall} isInTop10={isInTop10Overall} studentGrade={data.grade} />
          </div>
        </div>

        {/* Class vs Classes */}
        {data.all_classes_ranking.length > 1 && (
          <div style={{ background: T.card, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: `1px solid ${T.cardBorder}` }}>
            <p style={{ color: T.textMuted, fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement des classes
            </p>
            <div style={{
              textAlign: 'center', marginBottom: '12px', padding: '8px',
              background: T.surface, borderRadius: '8px',
            }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: T.accent }}>
                {data.my_class_rank_among_classes}<sup style={{ fontSize: '12px' }}>e</sup>
              </span>
              <span style={{ color: T.textMuted, fontSize: '13px' }}> / {data.total_classes} classes</span>
              <div style={{ color: T.textDim, fontSize: '11px', marginTop: '4px' }}>
                Moyenne {data.class_name} : <span style={{ color: T.accent, fontWeight: 600 }}>{data.my_class_avg.toFixed(1)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {data.all_classes_ranking.map((entry, index) => {
                const isMyClass = entry.class_name === data.class_name;
                const medalEmoji = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}.`;
                return (
                  <div key={index} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: '6px',
                    background: isMyClass ? T.accentSoft : 'transparent', fontSize: '12px',
                  }}>
                    <span style={{ color: isMyClass ? T.accent : T.textDim, fontWeight: isMyClass ? 700 : 400 }}>
                      {medalEmoji(entry.rank)} {entry.class_name}
                    </span>
                    <span style={{ color: isMyClass ? T.accent : T.text, fontWeight: isMyClass ? 700 : 400 }}>
                      {entry.avg_grade.toFixed(1)}
                      <span style={{ color: T.textDim, fontSize: '10px', marginLeft: '4px' }}>
                        ({entry.student_count} el.)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: T.textDim, fontSize: '11px', marginTop: '16px' }}>
          Données mises à jour en temps réel
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: T.card, borderRadius: '12px', padding: '14px 10px',
      textAlign: 'center', border: `1px solid ${T.cardBorder}`,
    }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '11px', color: T.textDim, marginTop: '4px' }}>{label}</div>
    </div>
  );
}

// ============================================
// Stamp Card View (Student)
// ============================================

function StampCardView({
  stampData, stampLoading, stampError, showCelebration, showBonusSelect, setShowBonusSelect, onSelectBonus, selectedStampDetail, setSelectedStampDetail,
}: {
  stampData: StampData | null;
  stampLoading: boolean;
  stampError: string | null;
  showCelebration: boolean;
  showBonusSelect: boolean;
  setShowBonusSelect: (v: boolean) => void;
  onSelectBonus: (bonusId: string) => void;
  selectedStampDetail: { label: string; icon: string; color: string; date: string } | null;
  setSelectedStampDetail: (v: { label: string; icon: string; color: string; date: string } | null) => void;
}) {
  const { confirm: showConfirm } = useUIFeedback();

  if (stampLoading) return <div style={{ textAlign: 'center', color: T.textDim, padding: '40px 0' }}>Chargement...</div>;
  if (stampError) return <div style={{ textAlign: 'center', color: T.neg, padding: '40px 0' }}>{stampError}</div>;
  if (!stampData) return <div style={{ textAlign: 'center', color: T.textDim, padding: '40px 0' }}>Aucune donnée</div>;

  const card = stampData.active_card;
  const stampCount = card?.stamp_count || 0;
  const cardComplete = stampCount >= 10;
  const stamps = card?.stamps || [];
  const tier = getCardTier(card?.card_number || 1);

  return (
    <div>
      {/* Celebration overlay */}
      {showCelebration && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)', animation: 'fadeIn 0.3s ease',
        }}>
          {['🎊', '⭐', '🌟', '✨', '🎉', '💫', '🏆', '🎁'].map((emoji, i) => (
            <div key={i} style={{
              position: 'absolute', fontSize: '28px', left: `${12 + i * 11}%`, top: '40%',
              animation: `confetti ${1.2 + i * 0.15}s ease-out forwards`,
              animationDelay: `${i * 0.1}s`,
            }}>{emoji}</div>
          ))}
          <div style={{ textAlign: 'center', animation: 'pulse 1.5s ease infinite' }}>
            <div style={{ fontSize: '80px', animation: 'bounce 0.6s ease infinite' }}>🎉</div>
            <p style={{ color: T.warn, fontSize: '24px', fontWeight: 700, marginTop: '16px', textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>
              Bravo ! Bonus enregistré !
            </p>
            <p style={{ color: T.textMuted, fontSize: '14px', marginTop: '8px' }}>
              Ton enseignant le prendra en compte.
            </p>
          </div>
        </div>
      )}

      {/* Stamp detail popup */}
      {selectedStampDetail && (
        <div onClick={() => setSelectedStampDetail(null)} style={{
          position: 'fixed', inset: 0, zIndex: 90,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{
            background: T.card, borderRadius: '16px', padding: '24px',
            border: `1px solid ${T.cardBorder}`, textAlign: 'center', maxWidth: '280px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{selectedStampDetail.icon}</div>
            <p style={{ color: T.text, fontSize: '16px', fontWeight: 600 }}>{selectedStampDetail.label}</p>
            <p style={{ color: T.textDim, fontSize: '12px', marginTop: '8px' }}>
              {new Date(selectedStampDetail.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: selectedStampDetail.color, margin: '12px auto 0' }} />
          </div>
        </div>
      )}

      {/* Active Card */}
      <div style={{
        background: tier.gradient, borderRadius: '20px', padding: '24px',
        marginBottom: '12px',
        boxShadow: `0 8px 32px ${tier.borderColor}30`,
        position: 'relative', overflow: 'hidden',
        animation: cardComplete ? 'cardComplete 2s ease infinite' : undefined,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: tier.bgPattern, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{tier.emoji}</span>
            <div>
              <p style={{ color: '#ffffff', fontSize: '16px', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Carte n°{card?.card_number || 1}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>{tier.name}</p>
            </div>
          </div>
          <span style={{
            padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
            background: 'rgba(255,255,255,0.2)', color: '#ffffff', backdropFilter: 'blur(4px)',
          }}>
            {stampCount}/10
          </span>
        </div>

        <div style={{
          position: 'relative', height: '8px', background: 'rgba(0,0,0,0.25)', borderRadius: '4px',
          overflow: 'hidden', marginBottom: '20px',
        }}>
          <div style={{
            height: '100%', borderRadius: '4px', transition: 'width 0.8s ease',
            width: `${(stampCount / 10) * 100}%`,
            background: cardComplete ? tier.progressGradientComplete : tier.progressGradient,
            backgroundSize: cardComplete ? '200% 100%' : undefined,
            animation: cardComplete ? 'shimmer 2s linear infinite' : undefined,
          }} />
        </div>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {Array.from({ length: 10 }, (_, i) => {
            const stamp = stamps.find(s => s.slot_number === i + 1);
            return (
              <button
                key={i}
                onClick={() => stamp ? setSelectedStampDetail({
                  label: stamp.category_label, icon: stamp.category_icon,
                  color: stamp.category_color, date: stamp.awarded_at,
                }) : undefined}
                disabled={!stamp}
                style={{
                  aspectRatio: '1', borderRadius: '14px',
                  border: stamp ? `2px solid ${stamp.category_color}90` : '2px dashed rgba(255,255,255,0.3)',
                  background: stamp ? `${stamp.category_color}25` : 'rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: stamp ? '24px' : '16px',
                  cursor: stamp ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: stamp ? `0 2px 8px ${stamp.category_color}30` : 'none',
                  animation: stamp ? `stampAppear 0.4s ease ${i * 0.05}s both` : undefined,
                }}
              >
                {stamp ? <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>{stamp.category_icon}</span> : (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{tier.emptyIcon}</span>
                )}
              </button>
            );
          })}
        </div>

        {cardComplete && !showBonusSelect && stampData.available_bonuses.length > 0 && (
          <button
            onClick={() => setShowBonusSelect(true)}
            style={{
              position: 'relative', width: '100%', marginTop: '20px', padding: '14px',
              borderRadius: '12px', border: 'none',
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldDeep})`,
              color: T.bg, fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', animation: 'pulse 2s ease infinite',
            }}
          >
            🎁 Choisir ton bonus !
          </button>
        )}
      </div>

      {/* Bonus selection */}
      {showBonusSelect && (
        <div style={{
          background: T.card, borderRadius: '20px', padding: '20px',
          marginBottom: '12px', border: `1px solid ${T.cardBorder}`,
        }}>
          <p style={{ color: T.warn, fontSize: '16px', fontWeight: 700, marginBottom: '4px', textAlign: 'center' }}>
            🎁 Choisis ton bonus !
          </p>
          <p style={{ color: T.textDim, fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
            Tu as rempli ta carte, bravo ! Choisis ta récompense :
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stampData.available_bonuses.map(bonus => (
              <button
                key={bonus.id}
                onClick={async () => {
                  const ok = await showConfirm({ title: 'Choisir ce bonus', message: `Tu veux choisir : "${bonus.label}" ?`, confirmLabel: 'Choisir', variant: 'warning' });
                  if (ok) onSelectBonus(bonus.id);
                }}
                style={{
                  padding: '14px 16px', borderRadius: '12px',
                  border: `1px solid ${T.cardBorder}`, background: T.surface,
                  color: T.text, fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                }}
              >
                🎁 {bonus.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBonusSelect(false)}
            style={{
              width: '100%', marginTop: '12px', padding: '10px',
              borderRadius: '10px', border: `1px solid ${T.cardBorder}`,
              background: 'transparent', color: T.textDim, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Completed cards history */}
      {stampData.completed_cards.length > 0 && (
        <div style={{
          background: T.card, borderRadius: '16px', padding: '16px',
          marginBottom: '12px', border: `1px solid ${T.cardBorder}`,
        }}>
          <p style={{ color: T.textMuted, fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
            Historique des cartes
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stampData.completed_cards.map(c => {
              const cTier = getCardTier(c.card_number);
              return (
                <div key={c.id || `card-${c.card_number}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: '10px', background: T.surface,
                }}>
                  <div>
                    <span style={{ fontSize: '14px', marginRight: '6px' }}>{cTier.emoji}</span>
                    <span style={{ color: T.text, fontSize: '13px', fontWeight: 600 }}>
                      Carte n°{c.card_number}
                    </span>
                    <span style={{ color: T.textDim, fontSize: '11px', marginLeft: '6px' }}>
                      {cTier.name}
                    </span>
                    {c.completed_at && (
                      <span style={{ color: T.textDim, fontSize: '10px', marginLeft: '8px' }}>
                        {new Date(c.completed_at).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {c.bonus_label ? (
                      <span style={{ fontSize: '11px', fontWeight: 500, color: c.bonus_used ? T.pos : T.warn }}>
                        🎁 {c.bonus_label} {c.bonus_used ? '✓' : '⏳'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: T.textDim }}>Pas de bonus</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How to earn stamps */}
      {stampData.categories.length > 0 && (
        <details style={{
          background: T.card, borderRadius: '16px',
          marginBottom: '12px', border: `1px solid ${T.cardBorder}`, overflow: 'hidden',
        }}>
          <summary style={{
            padding: '14px 16px', color: T.textMuted, fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            listStyle: 'none', userSelect: 'none',
          }}>
            <span>Comment gagner un tampon ?</span>
            <span style={{ fontSize: '11px', transition: 'transform 0.2s' }} className="accordion-arrow">▼</span>
          </summary>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', padding: '0 16px 14px',
          }}>
            {stampData.categories.filter((cat, i, arr) =>
              arr.findIndex(c => c.label === cat.label) === i
            ).map((cat, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderRadius: '8px', background: T.surface,
              }}>
                <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                <span style={{ color: T.text, fontSize: '11px' }}>{cat.label}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <style>{`
        details summary::-webkit-details-marker { display: none; }
        details[open] .accordion-arrow { transform: rotate(180deg); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes stampAppear {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(-80px) rotate(720deg); opacity: 0; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes cardComplete { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
      `}</style>
    </div>
  );
}

function RankingDisplay({
  rank, total, top10, isInTop10, studentGrade,
}: {
  rank: number; total: number;
  top10: { rank: number; grade: number }[];
  isInTop10: boolean; studentGrade: number;
}) {
  const medalEmoji = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}.`;

  return (
    <div>
      <div style={{
        textAlign: 'center', marginBottom: '12px', padding: '8px',
        background: T.surface, borderRadius: '8px',
      }}>
        <span style={{ fontSize: '24px', fontWeight: 700, color: isInTop10 ? T.pos : T.indigo }}>
          {rank}<sup style={{ fontSize: '12px' }}>e</sup>
        </span>
        <span style={{ color: T.textMuted, fontSize: '13px' }}> / {total}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {top10.map((entry, index) => {
          const isMe = entry.rank === rank && Math.abs(entry.grade - studentGrade) < 0.05;
          return (
            <div key={index} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 6px', borderRadius: '6px',
              background: isMe ? T.indigoSoft : 'transparent', fontSize: '12px',
            }}>
              <span style={{ color: isMe ? T.indigo : T.textDim, fontWeight: isMe ? 700 : 400 }}>
                {medalEmoji(entry.rank)}
              </span>
              <span style={{ color: isMe ? T.indigo : T.text, fontWeight: isMe ? 700 : 400 }}>
                {entry.grade.toFixed(1)}
              </span>
            </div>
          );
        })}

        {!isInTop10 && (
          <>
            <div style={{ textAlign: 'center', color: T.textDim, fontSize: '11px', padding: '2px 0' }}>
              ···
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '4px 6px', borderRadius: '6px',
              background: T.indigoSoft, fontSize: '12px',
            }}>
              <span style={{ color: T.indigo, fontWeight: 700 }}>{rank}.</span>
              <span style={{ color: T.indigo, fontWeight: 700 }}>Toi · {studentGrade.toFixed(1)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
