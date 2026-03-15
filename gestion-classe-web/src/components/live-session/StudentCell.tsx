import { useMemo, useRef, useCallback } from 'react';
import type { SessionEvent } from '../../lib/liveSessionQueries';
import type { ActiveSortie } from '../../contexts/LiveSessionContext';

interface StudentCellProps {
  studentId: string;
  pseudo: string;
  events: SessionEvent[];
  activeSortie: ActiveSortie | null;
  onTap: (rect: DOMRect) => void;
  onDoubleTap?: () => void;
  onSortieReturn?: () => void;
}

export function StudentCell({ studentId, pseudo, events, activeSortie, onTap, onDoubleTap, onSortieReturn }: StudentCellProps) {
  const lastTapRef = useRef<number>(0);

  const counts = useMemo(() => {
    const c = { participation: 0, bavardage: 0, absence: 0, sortie: 0, remarque: 0 };
    for (const e of events) {
      if (e.student_id === studentId && e.type in c) {
        c[e.type as keyof typeof c]++;
      }
    }
    return c;
  }, [studentId, events]);

  const isAbsent = counts.absence > 0 && counts.absence % 2 === 1; // odd = absent
  const isOut = !!activeSortie;
  const hasEvents = counts.participation + counts.bavardage + counts.sortie + counts.remarque > 0;

  // Format elapsed time for sortie
  const sortieElapsed = useMemo(() => {
    if (!activeSortie) return '';
    const start = new Date(activeSortie.timestamp).getTime();
    const now = Date.now();
    const minutes = Math.floor((now - start) / 60000);
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h${(minutes % 60).toString().padStart(2, '0')}`;
  }, [activeSortie]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    // Double-tap detection (< 400ms)
    if (timeSinceLastTap < 400) {
      // If absent, cancel absence
      if (isAbsent && onDoubleTap) {
        onDoubleTap();
        return;
      }
      // If out on sortie, mark return
      if (isOut && onSortieReturn) {
        onSortieReturn();
        return;
      }
    }

    // Normal tap — don't open menu for absent/out students
    if (isAbsent || isOut) return;

    onTap(rect);
  }, [isAbsent, isOut, onTap, onDoubleTap, onSortieReturn]);

  return (
    <button
      className={`relative flex flex-col items-center justify-center p-1 text-center transition-transform active:scale-95 ${
        isAbsent ? 'opacity-40' : isOut ? 'opacity-60' : ''
      }`}
      style={{
        background: isAbsent
          ? 'var(--color-absence-soft)'
          : isOut
            ? 'var(--color-sortie-soft)'
            : hasEvents
              ? 'var(--color-surface)'
              : 'var(--color-surface-secondary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: hasEvents ? 'var(--shadow-xs)' : undefined,
        border: isOut ? '2px solid var(--color-sortie)' : 'none',
        minHeight: '52px',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={handleClick}
    >
      {/* Pseudo */}
      <span
        className={`text-[11px] font-semibold leading-tight ${
          isAbsent ? 'line-through text-[var(--color-text-tertiary)]' :
          isOut ? 'text-[var(--color-sortie)]' :
          'text-[var(--color-text)]'
        }`}
      >
        {truncate(pseudo, 7)}
      </span>

      {/* Event badges or status */}
      {isAbsent ? (
        <span className="text-[9px] font-bold text-[var(--color-absence)] mt-0.5">ABS</span>
      ) : isOut ? (
        <span className="text-[9px] font-bold text-[var(--color-sortie)] mt-0.5">
          {sortieElapsed}
        </span>
      ) : hasEvents ? (
        <div className="flex gap-0.5 mt-0.5">
          {counts.participation > 0 && (
            <Badge count={counts.participation} color="var(--color-participation)" />
          )}
          {counts.bavardage > 0 && (
            <Badge count={counts.bavardage} color="var(--color-bavardage)" />
          )}
          {counts.sortie > 0 && (
            <Badge count={counts.sortie} color="var(--color-sortie)" />
          )}
          {counts.remarque > 0 && (
            <Badge count={counts.remarque} color="var(--color-remarque)" />
          )}
        </div>
      ) : null}
    </button>
  );
}

function Badge({ count, color }: { count: number; color: string }) {
  return (
    <span
      className="text-[9px] font-bold text-white min-w-[14px] h-[14px] flex items-center justify-center rounded-full"
      style={{ background: color }}
    >
      {count}
    </span>
  );
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '.' : str;
}
