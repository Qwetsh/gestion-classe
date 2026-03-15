import { useState, useEffect } from 'react';

export function SessionTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className="font-mono text-sm text-white/80">{elapsed}</span>
  );
}
