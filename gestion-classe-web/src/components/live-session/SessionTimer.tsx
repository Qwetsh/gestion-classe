import { useState, useEffect } from 'react';
import { DB } from './directionB';

/** Chrono Direction B : "● {n} min" vert (maquette 6a). */
export function SessionTimer({ startedAt }: { startedAt: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      setMinutes(Math.max(0, Math.floor((Date.now() - start) / 60000)));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: DB.action }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: DB.action }}>{minutes} min</span>
    </span>
  );
}
