import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  }, [code]);

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Entre ton code a 6 chiffres');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase
        .rpc('get_student_dashboard', { p_code: fullCode });

      if (rpcError) throw rpcError;

      if (result?.error === 'invalid_code') {
        setError('Code invalide. Verifie et reessaye.');
        return;
      }

      setData(result as DashboardData);
    } catch {
      setError('Erreur de connexion. Reessaye.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setData(null);
    setCode(['', '', '', '', '', '']);
    setError(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const gradeColor = (grade: number) => {
    if (grade >= 16) return '#22c55e';
    if (grade >= 12) return '#3b82f6';
    if (grade >= 8) return '#f59e0b';
    return '#ef4444';
  };

  const gradePercent = (grade: number) => Math.min(100, (grade / 20) * 100);

  // Code entry screen
  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          background: '#1e293b',
          borderRadius: '20px',
          padding: '40px 32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          border: '1px solid #334155',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
            <h1 style={{ color: '#f1f5f9', fontSize: '24px', fontWeight: 700, margin: 0 }}>
              Mon espace
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>
              Entre ton code personnel pour voir tes resultats
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '24px',
          }}>
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
                  width: '48px',
                  height: '56px',
                  textAlign: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  borderRadius: '12px',
                  border: `2px solid ${digit ? '#3b82f6' : '#334155'}`,
                  background: '#0f172a',
                  color: '#f1f5f9',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = '#3b82f6'; }}
                onBlur={e => { if (!digit) e.target.style.borderColor = '#334155'; }}
              />
            ))}
          </div>

          {error && (
            <p style={{
              color: '#f87171',
              textAlign: 'center',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || code.join('').length !== 6}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: code.join('').length === 6 ? '#3b82f6' : '#334155',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 600,
              cursor: code.join('').length === 6 ? 'pointer' : 'default',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? 'Chargement...' : 'Voir mes resultats'}
          </button>
        </div>
      </div>
    );
  }

  // Dashboard screen
  const isInTop10Class = data.class_rank <= 10;
  const isInTop10Overall = data.overall_rank <= 10;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '0 4px',
        }}>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 700, margin: 0 }}>
              {data.pseudo}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '2px 0 0 0' }}>
              {data.class_name} · Trimestre {data.trimester} · {data.school_year}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Quitter
          </button>
        </div>

        {/* Grade Card */}
        <div style={{
          background: '#1e293b',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '12px',
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>Ma note actuelle</p>
          <div style={{
            fontSize: '56px',
            fontWeight: 800,
            color: gradeColor(data.grade),
            lineHeight: 1,
          }}>
            {data.grade.toFixed(1)}
            <span style={{ fontSize: '24px', color: '#64748b' }}>/20</span>
          </div>
          {/* Grade bar */}
          <div style={{
            marginTop: '16px',
            height: '8px',
            background: '#0f172a',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${gradePercent(data.grade)}%`,
              background: `linear-gradient(90deg, ${gradeColor(data.grade)}88, ${gradeColor(data.grade)})`,
              borderRadius: '4px',
              transition: 'width 0.8s ease',
            }} />
          </div>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
            Objectif : {data.target} implications
          </p>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}>
          <StatCard label="Implications" value={data.participations} color="#22c55e" />
          <StatCard label="Malus" value={data.malus} color="#f59e0b" />
          <StatCard label="Absences" value={data.absences} color="#ef4444" />
        </div>

        {/* Rankings */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {/* Class Ranking */}
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #334155',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement classe
            </p>
            <RankingDisplay
              rank={data.class_rank}
              total={data.class_total}
              top10={data.top10_class}
              isInTop10={isInTop10Class}
              studentGrade={data.grade}
            />
          </div>

          {/* Overall Ranking */}
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #334155',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement general
            </p>
            <RankingDisplay
              rank={data.overall_rank}
              total={data.overall_total}
              top10={data.top10_overall}
              isInTop10={isInTop10Overall}
              studentGrade={data.grade}
            />
          </div>
        </div>

        {/* Class vs Classes Ranking */}
        {data.all_classes_ranking.length > 1 && (
          <div style={{
            background: '#1e293b',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '12px',
            border: '1px solid #334155',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
              Classement des classes
            </p>
            {/* Position de ma classe */}
            <div style={{
              textAlign: 'center',
              marginBottom: '12px',
              padding: '8px',
              background: '#0f172a',
              borderRadius: '8px',
            }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#a78bfa' }}>
                {data.my_class_rank_among_classes}<sup style={{ fontSize: '12px' }}>e</sup>
              </span>
              <span style={{ color: '#64748b', fontSize: '13px' }}> / {data.total_classes} classes</span>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                Moyenne {data.class_name} : <span style={{ color: '#a78bfa', fontWeight: 600 }}>{data.my_class_avg.toFixed(1)}</span>
              </div>
            </div>
            {/* Liste de toutes les classes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {data.all_classes_ranking.map((entry, index) => {
                const isMyClass = entry.class_name === data.class_name;
                const medalEmoji = (r: number) => {
                  if (r === 1) return '\u{1F947}';
                  if (r === 2) return '\u{1F948}';
                  if (r === 3) return '\u{1F949}';
                  return `${r}.`;
                };
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: isMyClass ? '#2e1065' : 'transparent',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{
                      color: isMyClass ? '#c4b5fd' : '#94a3b8',
                      fontWeight: isMyClass ? 700 : 400,
                    }}>
                      {medalEmoji(entry.rank)} {entry.class_name}
                    </span>
                    <span style={{
                      color: isMyClass ? '#c4b5fd' : '#cbd5e1',
                      fontWeight: isMyClass ? 700 : 400,
                    }}>
                      {entry.avg_grade.toFixed(1)}
                      <span style={{ color: '#64748b', fontSize: '10px', marginLeft: '4px' }}>
                        ({entry.student_count} el.)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          color: '#475569',
          fontSize: '11px',
          marginTop: '16px',
        }}>
          Donnees mises a jour en temps reel
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      padding: '14px 10px',
      textAlign: 'center',
      border: '1px solid #334155',
    }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function RankingDisplay({
  rank,
  total,
  top10,
  isInTop10,
  studentGrade,
}: {
  rank: number;
  total: number;
  top10: { rank: number; grade: number }[];
  isInTop10: boolean;
  studentGrade: number;
}) {
  const medalEmoji = (r: number) => {
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return `${r}.`;
  };

  return (
    <div>
      {/* Position summary */}
      <div style={{
        textAlign: 'center',
        marginBottom: '12px',
        padding: '8px',
        background: '#0f172a',
        borderRadius: '8px',
      }}>
        <span style={{ fontSize: '24px', fontWeight: 700, color: isInTop10 ? '#22c55e' : '#3b82f6' }}>
          {rank}<sup style={{ fontSize: '12px' }}>e</sup>
        </span>
        <span style={{ color: '#64748b', fontSize: '13px' }}> / {total}</span>
      </div>

      {/* Top 10 list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {top10.map((entry, index) => {
          const isMe = entry.rank === rank && Math.abs(entry.grade - studentGrade) < 0.05;
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px',
                borderRadius: '6px',
                background: isMe ? '#1e3a5f' : 'transparent',
                fontSize: '12px',
              }}
            >
              <span style={{ color: isMe ? '#60a5fa' : '#94a3b8', fontWeight: isMe ? 700 : 400 }}>
                {medalEmoji(entry.rank)}
              </span>
              <span style={{
                color: isMe ? '#60a5fa' : '#cbd5e1',
                fontWeight: isMe ? 700 : 400,
              }}>
                {entry.grade.toFixed(1)}
              </span>
            </div>
          );
        })}

        {!isInTop10 && (
          <>
            <div style={{
              textAlign: 'center',
              color: '#475569',
              fontSize: '11px',
              padding: '2px 0',
            }}>
              ···
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: '6px',
              background: '#1e3a5f',
              fontSize: '12px',
            }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                {rank}.
              </span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                Toi · {studentGrade.toFixed(1)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
