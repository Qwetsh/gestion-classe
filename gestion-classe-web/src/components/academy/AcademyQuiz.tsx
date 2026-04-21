import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchQuestions, type AcademyQuestion, type AcademyAnswer } from '../../lib/academyQueries';
import { Starfield, FloatingCandles, Candle, Ornament, WaxSeal } from './Atmosphere';
import { HouseCrest } from './HouseCrest';
import { HOUSE_LIST, type HouseData } from './houses';
import './tokens.css';

type Phase = 'intro' | 'question' | 'ranking' | 'submitting' | 'waiting';

interface AcademyQuizProps {
  studentCode: string;
  onComplete?: () => void;
}

export function AcademyQuiz({ studentCode, onComplete }: AcademyQuizProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<(AcademyQuestion & { answers: AcademyAnswer[] })[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<HouseData[]>([...HOUSE_LIST]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions().then(setQuestions);
  }, []);

  const totalSteps = questions.length + 1; // questions + ranking

  const selectAnswer = useCallback((questionId: string, answerId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answerId }));
    setTimeout(() => {
      if (qIndex < questions.length - 1) {
        setQIndex(i => i + 1);
      } else {
        setPhase('ranking');
      }
    }, 600);
  }, [qIndex, questions.length]);

  const goBack = useCallback(() => {
    if (phase === 'ranking') {
      setPhase('question');
      return;
    }
    if (qIndex > 0) {
      setQIndex(i => i - 1);
    }
  }, [phase, qIndex]);

  const submitTest = useCallback(async () => {
    setPhase('submitting');
    setError(null);

    const responses = Object.entries(answers).map(([questionId, answerId]) => ({
      question_id: questionId,
      answer_id: answerId,
    }));

    const preferences = ranking.map((h, i) => ({
      house: h.id,
      rank: i + 1,
    }));

    try {
      const { data: result, error: rpcError } = await supabase
        .rpc('submit_academy_test', {
          p_code: studentCode,
          p_responses: responses,
          p_preferences: preferences,
        });

      if (rpcError) throw rpcError;
      if (result?.error) {
        setError(result.error === 'already_submitted' ? 'Tu as déjà passé le test.' : result.error);
        setPhase('waiting');
        return;
      }

      setTimeout(() => {
        setPhase('waiting');
        onComplete?.();
      }, 3500);
    } catch {
      setError('Erreur de connexion. Réessaye.');
      setPhase('ranking');
    }
  }, [answers, ranking, studentCode, onComplete]);

  return (
    <div className="academy-root" style={{
      width: '100%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, oklch(0.15 0.02 55) 0%, oklch(0.06 0.01 50) 80%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'var(--font-body)', color: 'var(--parchment)',
    }}>
      <Starfield density={60} />
      <FloatingCandles count={8} />

      {phase === 'intro' && <IntroScreen onBegin={() => setPhase('question')} totalQuestions={questions.length} />}
      {phase === 'question' && questions.length > 0 && (
        <QuestionScreen
          question={questions[qIndex]}
          index={qIndex}
          total={totalSteps}
          selectedAnswer={answers[questions[qIndex].id]}
          onAnswer={selectAnswer}
          onBack={qIndex > 0 ? goBack : undefined}
        />
      )}
      {phase === 'ranking' && (
        <RankingScreen
          ranking={ranking}
          setRanking={setRanking}
          onSubmit={submitTest}
          onBack={goBack}
          total={totalSteps}
        />
      )}
      {phase === 'submitting' && <SubmittingScreen />}
      {phase === 'waiting' && <WaitingScreen error={error} />}
    </div>
  );
}

// --- Intro Screen ---
function IntroScreen({ onBegin, totalQuestions }: { onBegin: () => void; totalQuestions: number }) {
  return (
    <div style={{
      position: 'relative', zIndex: 2,
      padding: '28px 20px 30px',
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      animation: 'academy-scroll-unfurl 1.4s cubic-bezier(0.22, 0.8, 0.25, 1)',
    }}>
      <div className="parchment-bg parchment-edges" style={{
        padding: '24px 20px 22px',
        color: 'var(--ink-warm)', position: 'relative',
        borderRadius: 2,
        boxShadow: '0 20px 60px oklch(0 0 0 / 0.7)',
        width: '100%', marginTop: 8,
      }}>
        {/* Scroll rollers */}
        <div style={{
          position: 'absolute', top: -10, left: -10, right: -10, height: 14,
          background: 'linear-gradient(180deg, var(--gold-deep), oklch(0.30 0.04 60))',
          borderRadius: 7, boxShadow: '0 2px 6px oklch(0 0 0 / 0.5)',
        }} />
        <div style={{
          position: 'absolute', bottom: -10, left: -10, right: -10, height: 14,
          background: 'linear-gradient(180deg, oklch(0.30 0.04 60), var(--gold-deep))',
          borderRadius: 7, boxShadow: '0 2px 6px oklch(0 0 0 / 0.5)',
        }} />

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--ink-line)', textTransform: 'uppercase' }}>
          Le Choixpeau Magique
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 34, fontStyle: 'italic', fontWeight: 500,
          margin: '8px 0 4px', lineHeight: 1.05,
        }}>
          Approche,<br />jeune apprenti·e…
        </h1>

        <Ornament variant="diamond" color="var(--ink-line)" width={200} />

        <p style={{
          fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15,
          lineHeight: 1.5, marginTop: 10, color: 'var(--ink-warm)',
        }}>
          Ce soir, le <em>Choixpeau</em> se posera sur ta tête. Quatre voix
          s'élèveront ensuite — une seule reconnaîtra la tienne.
        </p>
        <p style={{
          fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13,
          lineHeight: 1.45, marginTop: 10, color: 'var(--ink-line)',
        }}>
          Réponds sans hâte. Ni bonnes ni mauvaises réponses —
          seulement les tiennes.
        </p>

        <div style={{ marginTop: 12 }}>
          <Ornament variant="fleur" color="var(--ink-line)" width={180} />
        </div>

        <button onClick={onBegin} style={{
          marginTop: 14, padding: '12px 24px',
          background: 'var(--ink-warm)', color: 'var(--gold-bright)',
          border: '2px solid var(--gold)',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18,
          cursor: 'pointer', letterSpacing: '0.04em', borderRadius: 1, width: '100%',
        }}>
          Que le Choixpeau parle
        </button>
      </div>

      {/* Two candles flanking below parchment */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 120,
        marginTop: 18,
      }}>
        <div style={{ animation: 'academy-drift-1 5s ease-in-out 0.5s infinite' }}>
          <Candle size="lg" />
        </div>
        <div style={{ animation: 'academy-drift-3 6.5s ease-in-out 1.2s infinite' }}>
          <Candle size="lg" />
        </div>
      </div>

      <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'var(--gold-deep)', textTransform: 'uppercase' }}>
        {totalQuestions} questions · 1 classement · ~5 min
      </div>
    </div>
  );
}

// --- Question Screen ---
function QuestionScreen({ question, index, total, selectedAnswer, onAnswer, onBack }: {
  question: AcademyQuestion & { answers: AcademyAnswer[] };
  index: number;
  total: number;
  selectedAnswer?: string;
  onAnswer: (questionId: string, answerId: string) => void;
  onBack?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [question.id]);

  const handleSelect = (answerId: string) => {
    setSelected(answerId);
    onAnswer(question.id, answerId);
  };

  const letters = ['a', 'b', 'c', 'd'];

  return (
    <div key={question.id} style={{
      position: 'relative', zIndex: 2,
      minHeight: '100vh', padding: '20px 22px 30px',
      display: 'flex', flexDirection: 'column',
      animation: 'academy-fadeIn 0.9s ease',
    }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2,
            background: i < index ? 'var(--gold)' : i === index ? 'var(--gold-bright)' : 'oklch(0.30 0.05 60 / 0.6)',
            boxShadow: i === index ? '0 0 8px var(--gold)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {onBack ? (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'var(--gold-deep)',
            fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13,
            cursor: 'pointer', padding: '4px 8px',
          }}>← Retour</button>
        ) : <span />}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold-deep)', textTransform: 'uppercase', textAlign: 'center' }}>
          Question {index + 1} sur {total}
        </div>
        <span />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 12 }}>
          <Ornament variant="diamond" color="var(--gold-shadow)" width={160} />
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26, fontStyle: 'italic', fontWeight: 500,
          textAlign: 'center', margin: 0, lineHeight: 1.25,
          color: 'var(--parchment)',
          textShadow: '0 0 20px oklch(0 0 0 / 0.8)',
        }}>
          {question.question_text}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 20 }}>
          <Ornament variant="line" color="var(--gold-shadow)" width={160} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {question.answers.map((a, i) => {
            const isSelected = selected === a.id || selectedAnswer === a.id;
            return (
              <button
                key={a.id}
                onClick={() => handleSelect(a.id)}
                disabled={selected !== null}
                style={{
                  padding: '14px 16px',
                  background: isSelected ? 'oklch(0.85 0.08 80)' : 'oklch(0.20 0.02 55 / 0.6)',
                  border: `1px solid ${isSelected ? 'var(--gold-bright)' : 'var(--gold-shadow)'}`,
                  color: isSelected ? 'var(--ink-warm)' : 'var(--parchment)',
                  fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 16,
                  cursor: selected !== null ? 'default' : 'pointer',
                  textAlign: 'left', lineHeight: 1.4,
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  transition: 'all 0.25s ease',
                  boxShadow: isSelected ? '0 0 24px oklch(0.78 0.12 85 / 0.4)' : 'none',
                }}
              >
                <div style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  border: `1px solid ${isSelected ? 'var(--ink-warm)' : 'var(--gold-deep)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13,
                  background: isSelected ? 'var(--gold)' : 'transparent',
                  color: isSelected ? 'var(--ink-warm)' : 'var(--gold-deep)',
                  marginTop: 1,
                }}>{letters[i]}</div>
                <span>{a.answer_text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Ranking Screen ---
function RankingScreen({ ranking, setRanking, onSubmit, onBack, total }: {
  ranking: HouseData[];
  setRanking: (r: HouseData[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  total: number;
}) {
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...ranking];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setRanking(next);
  };
  const moveDown = (i: number) => {
    if (i === ranking.length - 1) return;
    const next = [...ranking];
    [next[i + 1], next[i]] = [next[i], next[i + 1]];
    setRanking(next);
  };

  const numerals = ['I', 'II', 'III', 'IV'];

  const arrowStyle: React.CSSProperties = {
    width: 22, height: 14,
    background: 'transparent',
    border: '1px solid var(--gold-shadow)',
    color: 'var(--gold)',
    fontSize: 8, cursor: 'pointer', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{
      position: 'relative', zIndex: 2,
      minHeight: '100vh', padding: '20px 22px 30px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2,
            background: i < total - 1 ? 'var(--gold)' : 'var(--gold-bright)',
            boxShadow: i === total - 1 ? '0 0 8px var(--gold)' : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--gold-deep)',
          fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13,
          cursor: 'pointer', padding: '4px 8px',
        }}>← Retour</button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.3em', color: 'var(--gold-deep)', textTransform: 'uppercase', textAlign: 'center' }}>
          Question finale
        </div>
        <span />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, marginBottom: 12 }}>
        <Ornament variant="diamond" color="var(--gold-shadow)" width={160} />
      </div>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22, fontStyle: 'italic', fontWeight: 500,
        textAlign: 'center', margin: 0, lineHeight: 1.35,
      }}>
        Classe les quatre Maisons selon ton inclination.
      </h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13,
        textAlign: 'center', marginTop: 8, color: 'var(--parchment-dark)', lineHeight: 1.5,
      }}>
        De la plus désirée (en haut) à la moins désirée.
        Le Choixpeau en tiendra compte — sans pour autant s'y plier.
      </p>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ranking.map((h, i) => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '10px 14px',
            background: 'oklch(0.18 0.02 55 / 0.85)',
            border: '1px solid var(--gold-shadow)',
            transition: 'all 0.2s ease',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28,
              color: 'var(--gold-bright)', width: 30, textAlign: 'center', lineHeight: 1,
            }}>
              {numerals[i]}
            </div>
            <div style={{ transform: 'scale(0.48)', transformOrigin: 'left center', margin: '-30px 0', marginLeft: -10 }}>
              <HouseCrest house={h} size={80} ornate={false} />
            </div>
            <div style={{ flex: 1, marginLeft: -20 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 19, color: 'var(--parchment)', lineHeight: 1 }}>
                {h.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--gold-deep)', marginTop: 2 }}>
                {h.element.toUpperCase()} · {h.virtue.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => moveUp(i)} style={arrowStyle} disabled={i === 0}>&#9650;</button>
              <button onClick={() => moveDown(i)} style={arrowStyle} disabled={i === ranking.length - 1}>&#9660;</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onSubmit} style={{
        marginTop: 24, padding: '14px 20px',
        background: 'var(--ink-warm)', color: 'var(--gold-bright)',
        border: '2px solid var(--gold)',
        fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20,
        cursor: 'pointer',
      }}>
        Remettre mon cœur au Choixpeau
      </button>
    </div>
  );
}

// --- Submitting Screen ---
function SubmittingScreen() {
  return (
    <div style={{
      position: 'relative', zIndex: 2,
      minHeight: '100vh', padding: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      animation: 'academy-fadeIn 0.8s ease',
    }}>
      {/* Spinning astrolabe */}
      <div style={{ width: 160, height: 160, position: 'relative', animation: 'academy-rotate 6s linear infinite' }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <defs>
            <radialGradient id="astroGlow">
              <stop offset="0" stopColor="var(--gold-bright)" stopOpacity={0.8} />
              <stop offset="1" stopColor="var(--gold)" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx="80" cy="80" r="76" fill="url(#astroGlow)" opacity="0.3" />
          <circle cx="80" cy="80" r="70" fill="none" stroke="var(--gold)" strokeWidth="0.8" />
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--gold)" strokeWidth="0.6" />
          <circle cx="80" cy="80" r="48" fill="none" stroke="var(--gold)" strokeWidth="0.5" />
          <circle cx="80" cy="80" r="36" fill="none" stroke="var(--gold)" strokeWidth="0.4" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const x1 = 80 + Math.cos(angle) * 66;
            const y1 = 80 + Math.sin(angle) * 66;
            const x2 = 80 + Math.cos(angle) * 70;
            const y2 = 80 + Math.sin(angle) * 70;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gold)" strokeWidth="0.8" />;
          })}
          <circle cx="80" cy="80" r="6" fill="var(--gold)" />
          <text x="80" y="9" textAnchor="middle" fontFamily="var(--font-display)" fontSize="10" fill="var(--gold-bright)" fontStyle="italic">☉</text>
          <text x="154" y="84" textAnchor="middle" fontFamily="var(--font-display)" fontSize="10" fill="var(--gold-bright)" fontStyle="italic">☽</text>
          <text x="80" y="158" textAnchor="middle" fontFamily="var(--font-display)" fontSize="10" fill="var(--gold-bright)" fontStyle="italic">✶</text>
          <text x="6" y="84" textAnchor="middle" fontFamily="var(--font-display)" fontSize="10" fill="var(--gold-bright)" fontStyle="italic">✧</text>
        </svg>
      </div>

      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 30, fontStyle: 'italic', fontWeight: 500,
        margin: '24px 0 8px', color: 'var(--parchment)',
        textShadow: '0 0 20px oklch(0 0 0 / 0.6)',
      }}>
        Le Choixpeau réfléchit…
      </h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15,
        color: 'var(--parchment-dark)', maxWidth: 280, lineHeight: 1.5,
      }}>
        Tes réponses traversent le cuivre, l'argent et l'or.<br />
        Patience.
      </p>
      <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--gold)',
            animation: `academy-pulse 1.4s ease-in-out ${i * 0.3}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// --- Waiting Screen ---
function WaitingScreen({ error }: { error: string | null }) {
  return (
    <div style={{
      position: 'relative', zIndex: 2,
      minHeight: '100vh', padding: 40,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
      animation: 'academy-fadeIn 0.8s ease',
    }}>
      <WaxSeal letter="Q" size={120} />

      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontStyle: 'italic', fontWeight: 500,
        margin: '20px 0 8px', color: 'var(--parchment)',
      }}>
        Sceau apposé
      </h2>
      <p style={{
        fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15,
        color: 'var(--parchment-dark)', maxWidth: 300, lineHeight: 1.55,
      }}>
        Tes réponses sont parvenues au Choixpeau.<br />
        Ta Maison te sera révélée lors de la prochaine cérémonie,
        par la voix de ta professeur·e.
      </p>
      {error && (
        <div style={{
          marginTop: 12, padding: '8px 14px',
          border: '1px solid oklch(0.58 0.18 28)',
          fontFamily: 'var(--font-body)', fontSize: 13,
          color: 'oklch(0.72 0.14 55)',
        }}>
          {error}
        </div>
      )}
      <div style={{
        marginTop: 18, padding: '8px 14px',
        border: '1px solid var(--gold-shadow)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em',
        color: 'var(--gold-deep)', textTransform: 'uppercase',
      }}>
        En attente de la cérémonie
      </div>
    </div>
  );
}
