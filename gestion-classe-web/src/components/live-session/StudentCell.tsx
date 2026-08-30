import { memo, useMemo, useRef, useCallback } from 'react';
import type { ActiveSortie } from '../../contexts/LiveSessionContext';
import { DB } from './directionB';

export interface StudentCounts {
  participation: number;
  malus: number;
  absence: number;
  sortie: number;
  remarque: number;
}

interface StudentCellProps {
  studentId: string;
  pseudo: string;
  counts: StudentCounts;
  activeSortie: ActiveSortie | null;
  /** Declenche sur pointerdown : ouvre le menu radial (press-slide possible). */
  onPress: (rect: DOMRect) => void;
  onDoubleTap?: () => void;
  onSortieReturn?: () => void;
}

/** Cellule du plan de classe, style Direction B (maquette 8b). */
export const StudentCell = memo(function StudentCell({
  studentId: _studentId,
  pseudo,
  counts,
  activeSortie,
  onPress,
  onDoubleTap,
  onSortieReturn,
}: StudentCellProps) {
  const lastTapRef = useRef<number>(0);

  const isAbsent = counts.absence > 0 && counts.absence % 2 === 1; // odd = absent
  const isOut = !!activeSortie;

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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    // Double-tap (< 400 ms) : annuler l'absence ou marquer le retour
    if (timeSinceLastTap < 400) {
      if (isAbsent && onDoubleTap) {
        onDoubleTap();
        return;
      }
      if (isOut && onSortieReturn) {
        onSortieReturn();
        return;
      }
    }

    // Tap simple : pas de menu pour les absents/sortis
    if (isAbsent || isOut) return;

    // Ouvre le menu des le pointerdown (press-slide-release possible)
    onPress(rect);
  }, [isAbsent, isOut, onPress, onDoubleTap, onSortieReturn]);

  const background = isAbsent ? DB.absentBg : isOut ? DB.sortieBg : DB.surface;
  const borderColor = isAbsent ? DB.absentBorder : isOut ? DB.sortieBorder : DB.border;
  const nameColor = isAbsent ? DB.absentText : isOut ? DB.sortieText : DB.text;

  return (
    <button
      className="relative flex flex-col items-center justify-center p-1 text-center transition-transform active:scale-95"
      style={{
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        minHeight: 52,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Prenom */}
      <span
        className="leading-tight truncate max-w-full"
        style={{ fontSize: 11, fontWeight: 600, color: nameColor }}
      >
        {truncate(pseudo, 8)}
      </span>

      {/* Badges */}
      {isAbsent ? (
        <span
          className="mt-0.5"
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            color: '#fff',
            background: DB.absentBadge,
            borderRadius: 999,
            padding: '1px 5px',
          }}
        >
          ABS
        </span>
      ) : isOut ? (
        <span
          className="mt-0.5"
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            color: DB.sortieText,
            background: DB.sortieBorder,
            borderRadius: 999,
            padding: '1px 5px',
          }}
        >
          {sortieElapsed}
        </span>
      ) : (counts.participation > 0 || counts.malus > 0) ? (
        <div className="flex gap-0.5 mt-0.5">
          {counts.participation > 0 && (
            <Pill text={`+${counts.participation}`} bg={DB.actionSoft} fg={DB.action} />
          )}
          {counts.malus > 0 && (
            <Pill text={`${counts.malus}`} bg={DB.malusSoft} fg={DB.malusText} />
          )}
        </div>
      ) : null}
    </button>
  );
});

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      className="flex items-center justify-center"
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: fg,
        background: bg,
        borderRadius: 999,
        minWidth: 16,
        padding: '0 4px',
        height: 13,
      }}
    >
      {text}
    </span>
  );
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '.' : str;
}
