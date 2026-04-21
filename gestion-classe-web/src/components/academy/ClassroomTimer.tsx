import { useState, useEffect, useRef, useCallback } from 'react';

const PRESETS = [1, 2, 3, 5, 10, 15, 20, 30];

export function ClassroomTimer() {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!running || remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (running && remaining <= 0 && totalSeconds > 0) {
        setRunning(false);
        // Vibrate on finish
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(intervalRef.current); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining, totalSeconds]);

  const start = useCallback((minutes: number) => {
    const secs = minutes * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
    setRunning(true);
    setShowPicker(false);
  }, []);

  const toggle = () => setRunning(r => !r);
  const reset = () => { setRunning(false); setRemaining(0); setTotalSeconds(0); setShowPicker(true); };

  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const isFinished = totalSeconds > 0 && remaining === 0 && !running;
  const isLow = remaining > 0 && remaining <= 30;

  if (showPicker) {
    return (
      <div style={{
        background: '#251c15', borderRadius: 16, padding: 20,
        border: '1px solid #3a2e22',
      }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: '#e8dcc8',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          marginBottom: 12, textAlign: 'center',
        }}>
          ⏳ Minuteur
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {PRESETS.map(m => (
            <button
              key={m}
              onClick={() => start(m)}
              style={{
                padding: '10px 18px', fontSize: 16, fontWeight: 700,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                background: '#1e1712', color: '#d4a843',
                border: '1px solid #3a2e22', borderRadius: 10,
                cursor: 'pointer', minWidth: 60,
              }}
            >
              {m}'
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#251c15', borderRadius: 16, padding: 24,
      border: `1px solid ${isFinished ? '#d4a843' : isLow ? '#dc2626' : '#3a2e22'}`,
      textAlign: 'center',
      animation: isFinished ? 'academy-pulse 1.5s ease-in-out infinite' : isLow ? 'academy-pulse 0.8s ease-in-out infinite' : 'none',
    }}>
      {/* Circular progress */}
      <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 16px' }}>
        <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r="70" fill="none" stroke="#1e1712" strokeWidth="8" />
          <circle
            cx="80" cy="80" r="70" fill="none"
            stroke={isFinished ? '#d4a843' : isLow ? '#dc2626' : '#d4a843'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 70}`}
            strokeDashoffset={`${2 * Math.PI * 70 * (1 - pct / 100)}`}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: isFinished ? 28 : 36, fontWeight: 800,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: isFinished ? '#d4a843' : isLow ? '#f87171' : '#e8dcc8',
            letterSpacing: '0.05em',
          }}>
            {isFinished ? "Temps !" : timeStr}
          </div>
          {!isFinished && (
            <div style={{ fontSize: 11, color: '#6a5c4e', marginTop: 2 }}>
              {running ? 'en cours' : 'en pause'}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {!isFinished && (
          <button
            onClick={toggle}
            style={{
              padding: '10px 28px', fontSize: 15, fontWeight: 700,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              background: running ? '#3a1515' : 'linear-gradient(135deg, #d4a843, #b8860b)',
              color: running ? '#f87171' : '#1a1410',
              border: running ? '1px solid #5a2020' : 'none',
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            {running ? '⏸ Pause' : '▶ Reprendre'}
          </button>
        )}
        <button
          onClick={reset}
          style={{
            padding: '10px 20px', fontSize: 15, fontWeight: 700,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            background: '#1e1712', color: '#8a7a66',
            border: '1px solid #3a2e22', borderRadius: 10, cursor: 'pointer',
          }}
        >
          ↻ Reset
        </button>
      </div>
    </div>
  );
}
