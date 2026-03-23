import { useState, useCallback, useEffect, useRef } from 'react';

interface RadialMenuProps {
  studentPseudo: string;
  position: { x: number; y: number };
  onSelect: (type: string, subtype?: string | null) => void;
  onRemarque: () => void;
  onClose: () => void;
}

const ACTIONS = [
  { type: 'participation', label: '+', color: 'var(--color-participation)', fullLabel: 'Implication' },
  { type: 'bavardage', label: '-', color: 'var(--color-bavardage)', fullLabel: 'Malus' },
  { type: 'absence', label: 'A', color: 'var(--color-absence)', fullLabel: 'Absence' },
  { type: 'remarque', label: '!', color: 'var(--color-remarque)', fullLabel: 'Remarque' },
  { type: 'sortie', label: 'S', color: 'var(--color-sortie)', fullLabel: 'Sortie' },
];

const SORTIE_SUBTYPES = [
  { id: 'infirmerie', label: 'Infirm.', color: '#E91E63' },
  { id: 'toilettes', label: 'WC', color: '#00BCD4' },
  { id: 'convocation', label: 'Conv.', color: '#795548' },
  { id: 'exclusion', label: 'Exclu.', color: '#B71C1C' },
];

const RADIUS = 80;
const ITEM_SIZE = 52;
const SUB_RADIUS = 70;
const SUB_ITEM_SIZE = 46;

export function WebRadialMenu({ studentPseudo, position, onSelect, onRemarque, onClose }: RadialMenuProps) {
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Clamp menu center to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = Math.max(RADIUS + 10, Math.min(position.x, vw - RADIUS - 10));
  const cy = Math.max(RADIUS + 60, Math.min(position.y, vh - RADIUS - 10));

  const handleAction = useCallback((type: string) => {
    if (type === 'sortie') {
      setShowSubMenu(true);
      if (navigator.vibrate) navigator.vibrate(10);
      return;
    }
    if (type === 'remarque') {
      onRemarque();
      return;
    }
    onSelect(type);
  }, [onSelect, onRemarque]);

  const handleSubtype = useCallback((subtype: string) => {
    onSelect('sortie', subtype);
  }, [onSelect]);

  const handleBackdropClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  const items = showSubMenu ? SORTIE_SUBTYPES : ACTIONS;
  const radius = showSubMenu ? SUB_RADIUS : RADIUS;
  const itemSize = showSubMenu ? SUB_ITEM_SIZE : ITEM_SIZE;
  const angleStep = (2 * Math.PI) / items.length;
  // Start from top (-PI/2)
  const startAngle = -Math.PI / 2;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60]"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={handleBackdropClick}
      onTouchEnd={handleBackdropClick}
    >
      {/* Student name label */}
      <div
        className="absolute text-center font-bold text-white text-sm px-3 py-1 pointer-events-none"
        style={{
          left: cx,
          top: cy - radius - 36,
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 'var(--radius-full)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 150ms',
        }}
      >
        {studentPseudo}
      </div>

      {/* Center dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-white pointer-events-none"
        style={{
          left: cx - 6,
          top: cy - 6,
          boxShadow: '0 0 8px rgba(0,0,0,0.3)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 100ms',
        }}
      />

      {/* Back button for submenu */}
      {showSubMenu && (
        <button
          className="absolute w-10 h-10 rounded-full bg-white text-[var(--color-text)] font-bold text-lg flex items-center justify-center"
          style={{
            left: cx - 20,
            top: cy - 20,
            boxShadow: 'var(--shadow-md)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 150ms, transform 150ms',
            transform: visible ? 'scale(1)' : 'scale(0)',
          }}
          onClick={(e) => { e.stopPropagation(); setShowSubMenu(false); }}
        >
          ←
        </button>
      )}

      {/* Menu items */}
      {items.map((item, i) => {
        const angle = startAngle + i * angleStep;
        const x = cx + Math.cos(angle) * radius - itemSize / 2;
        const y = cy + Math.sin(angle) * radius - itemSize / 2;

        const isAction = 'type' in item;
        const color = isAction ? (item as typeof ACTIONS[0]).color : (item as typeof SORTIE_SUBTYPES[0]).color;
        const label = isAction ? (item as typeof ACTIONS[0]).label : (item as typeof SORTIE_SUBTYPES[0]).label;

        return (
          <button
            key={isAction ? (item as typeof ACTIONS[0]).type : (item as typeof SORTIE_SUBTYPES[0]).id}
            className="absolute flex items-center justify-center text-white font-bold rounded-full"
            style={{
              left: x,
              top: y,
              width: itemSize,
              height: itemSize,
              background: color,
              boxShadow: 'var(--shadow-md)',
              fontSize: showSubMenu ? '11px' : '18px',
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0)',
              transition: `opacity 150ms ${i * 30}ms, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 30}ms`,
              border: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.vibrate) navigator.vibrate(15);
              if (showSubMenu) {
                handleSubtype((item as typeof SORTIE_SUBTYPES[0]).id);
              } else {
                handleAction((item as typeof ACTIONS[0]).type);
              }
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
