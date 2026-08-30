import { useState, useCallback, useEffect, useRef } from 'react';
import { Hand, MessageCircle, LogOut, XCircle, Cross, DoorOpen, ClipboardList, Ban } from 'lucide-react';
import { DB, RADIAL_ACTIONS, vibrateAction } from './directionB';

interface RadialMenuProps {
  studentPseudo: string;
  position: { x: number; y: number };
  onSelect: (type: string, subtype?: string | null) => void;
  onClose: () => void;
}

// Geometrie du menu (version compacte pour ecrans iPhone)
const INNER_RADIUS = 36;
const LABEL_RADIUS = 92;
const OUTER_RADIUS = 134;
const CENTER_RADIUS = 35; // disque blanc central : relacher/taper dedans = annuler
const GAP_ANGLE = (2 * Math.PI) / 180; // ~2°
const SUB_RADIUS = 82;
const SUB_ITEM_SIZE = 58;
const DRAG_THRESHOLD = 14; // px de deplacement avant de passer en mode "slide"

const ICONS: Record<string, typeof Hand> = {
  participation: Hand,
  bavardage: MessageCircle,
  sortie: LogOut,
  absence: XCircle,
  infirmerie: Cross,
  toilettes: DoorOpen,
  convocation: ClipboardList,
  exclusion: Ban,
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function describeArc(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number): string {
  const osx = cx + outerR * Math.cos(startAngle);
  const osy = cy + outerR * Math.sin(startAngle);
  const oex = cx + outerR * Math.cos(endAngle);
  const oey = cy + outerR * Math.sin(endAngle);
  const isx = cx + innerR * Math.cos(endAngle);
  const isy = cy + innerR * Math.sin(endAngle);
  const iex = cx + innerR * Math.cos(startAngle);
  const iey = cy + innerR * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${osx} ${osy}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oex} ${oey}`,
    `L ${isx} ${isy}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iex} ${iey}`,
    'Z',
  ].join(' ');
}

/** Index du quadrant sous (x,y), ou null (centre = annulation, trop loin = rien). */
function quadrantAt(x: number, y: number, cx: number, cy: number): number | null {
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < CENTER_RADIUS || distance > OUTER_RADIUS * 2) return null;
  let angle = Math.atan2(dx, -dy); // 0 = haut, sens horaire
  if (angle < 0) angle += 2 * Math.PI;
  const anglePerItem = (2 * Math.PI) / RADIAL_ACTIONS.length;
  return Math.floor(((angle + anglePerItem / 2) % (2 * Math.PI)) / anglePerItem);
}

/** Index du cercle de sous-action sous (x,y) autour de (cx,cy), ou null. */
function subItemAt(x: number, y: number, cx: number, cy: number, count: number): number | null {
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 20 || distance > SUB_RADIUS + SUB_ITEM_SIZE) return null;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  const anglePerItem = (2 * Math.PI) / count;
  return Math.floor(((angle + anglePerItem / 2) % (2 * Math.PI)) / anglePerItem);
}

/**
 * Menu radial 4 directions (Direction B, maquette 7a) :
 * quadrants pleins, centre disque blanc avec le nom de l'eleve.
 * Interactions : press-slide-release (menu ouvert pendant l'appui initial)
 * OU tap sur un quadrant si le doigt a ete releve au centre.
 */
export function WebRadialMenu({ studentPseudo, position, onSelect, onClose }: RadialMenuProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [subMenu, setSubMenu] = useState(false);
  const [subHovered, setSubHovered] = useState<number | null>(null);

  const draggingRef = useRef(false);
  const pressActiveRef = useRef(true); // le doigt qui a ouvert le menu est-il encore pose ?
  const subMenuRef = useRef(false);
  const hoveredRef = useRef<number | null>(null);
  const subHoveredRef = useRef<number | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Clamp du centre au viewport (marge = rayon exterieur, centre si trop etroit)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = OUTER_RADIUS + 8;
  const cx = margin * 2 >= vw ? vw / 2 : Math.max(margin, Math.min(position.x, vw - margin));
  const topSafe = margin + 8;
  const cy = Math.max(topSafe, Math.min(position.y, vh - margin - 8));

  const sortieAction = RADIAL_ACTIONS.find((a) => a.type === 'sortie')!;

  // Sous-menu Sortie : positionne vers le bas, flip vers le haut pres du bord
  const subCy = cy + SUB_RADIUS + SUB_ITEM_SIZE / 2 > vh - 12
    ? cy - LABEL_RADIUS
    : cy + LABEL_RADIUS;

  const commitSelection = useCallback((index: number | null, sub: boolean) => {
    if (sub) {
      if (index === null) { setSubMenu(false); subMenuRef.current = false; return; }
      const subAction = sortieAction.subActions![index];
      if (subAction) {
        vibrateAction('sortie');
        onSelect('sortie', subAction.id);
      }
      return;
    }
    if (index === null) { onClose(); return; }
    const action = RADIAL_ACTIONS[index];
    if (!action) { onClose(); return; }
    if (action.subActions) {
      // Sortie : ouvrir le sous-menu
      setSubMenu(true);
      subMenuRef.current = true;
      setHovered(null);
      hoveredRef.current = null;
      if (navigator.vibrate) navigator.vibrate(10);
      return;
    }
    vibrateAction(action.type);
    onSelect(action.type);
  }, [onSelect, onClose, sortieAction]);

  // Suivi global du pointeur : press-slide-release depuis la cellule
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!pressActiveRef.current) return;
      const inSub = subMenuRef.current;
      const index = inSub
        ? subItemAt(e.clientX, e.clientY, cx, subCy, sortieAction.subActions!.length)
        : quadrantAt(e.clientX, e.clientY, cx, cy);

      if (!draggingRef.current) {
        const dx = e.clientX - position.x;
        const dy = e.clientY - position.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) draggingRef.current = true;
      }

      if (inSub) {
        if (index !== subHoveredRef.current) {
          subHoveredRef.current = index;
          setSubHovered(index);
          if (index !== null && navigator.vibrate) navigator.vibrate(8);
        }
      } else if (index !== hoveredRef.current) {
        hoveredRef.current = index;
        setHovered(index);
        if (index !== null && navigator.vibrate) navigator.vibrate(8);
      }
    };

    const handleUp = (e: PointerEvent) => {
      const wasPressing = pressActiveRef.current;
      pressActiveRef.current = false;
      // Simple tap d'ouverture : le menu reste ouvert, la selection se fera au tap suivant
      if (!wasPressing || !draggingRef.current) return;
      draggingRef.current = false;
      const inSub = subMenuRef.current;
      const index = inSub
        ? subItemAt(e.clientX, e.clientY, cx, subCy, sortieAction.subActions!.length)
        : quadrantAt(e.clientX, e.clientY, cx, cy);
      commitSelection(index, inSub);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [cx, cy, subCy, position.x, position.y, commitSelection, sortieAction]);

  // Mode tap : un nouveau contact sur l'overlay selectionne directement.
  // (Le pointerdown d'ouverture est recu par la cellule, pas par l'overlay :
  // aucun risque de double traitement. On ne se fie donc pas au pointerup
  // d'ouverture, qui peut arriver avant que les listeners soient installes.)
  const handleOverlayPointerDown = useCallback((e: React.PointerEvent) => {
    pressActiveRef.current = false;
    draggingRef.current = false;
    const inSub = subMenuRef.current;
    const index = inSub
      ? subItemAt(e.clientX, e.clientY, cx, subCy, sortieAction.subActions!.length)
      : quadrantAt(e.clientX, e.clientY, cx, cy);
    commitSelection(index, inSub);
  }, [cx, cy, subCy, commitSelection, sortieAction]);

  const anglePerItem = (2 * Math.PI) / RADIAL_ACTIONS.length;
  const svgSize = (OUTER_RADIUS + 4) * 2;
  const svgCenter = svgSize / 2;

  return (
    <div
      className="fixed inset-0 z-[210]"
      style={{
        background: 'rgba(0,0,0,0.2)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 120ms',
        touchAction: 'none',
      }}
      onPointerDown={handleOverlayPointerDown}
    >
      {/* Quadrants */}
      <svg
        width={svgSize}
        height={svgSize}
        className="absolute pointer-events-none"
        style={{
          left: cx - svgCenter,
          top: cy - svgCenter,
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          opacity: subMenu ? 0.35 : 1,
        }}
      >
        {RADIAL_ACTIONS.map((action, index) => {
          const startAngle = (index - 0.5) * anglePerItem - Math.PI / 2 + GAP_ANGLE / 2;
          const endAngle = (index + 0.5) * anglePerItem - Math.PI / 2 - GAP_ANGLE / 2;
          const isHovered = hovered === index;
          return (
            <path
              key={action.type}
              d={describeArc(svgCenter, svgCenter, INNER_RADIUS, OUTER_RADIUS, startAngle, endAngle)}
              fill={isHovered ? hexToRgba(action.color, 0.88) : 'rgba(15,23,42,0.78)'}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}
      </svg>

      {/* Icones + labels des quadrants */}
      {!subMenu && RADIAL_ACTIONS.map((action, index) => {
        const angle = index * anglePerItem - Math.PI / 2;
        const x = cx + Math.cos(angle) * LABEL_RADIUS;
        const y = cy + Math.sin(angle) * LABEL_RADIUS;
        const Icon = ICONS[action.type];
        return (
          <div
            key={action.type}
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              opacity: visible ? 1 : 0,
              transition: 'opacity 150ms',
              gap: 3,
            }}
          >
            <Icon size={22} color="#fff" strokeWidth={hovered === index ? 2.2 : 1.9} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
              {action.label}
            </span>
          </div>
        );
      })}

      {/* Sous-menu Sortie : 4 cercles pleins */}
      {subMenu && (
        <>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: cx - SUB_RADIUS - SUB_ITEM_SIZE / 2 - 12,
              top: subCy - SUB_RADIUS - SUB_ITEM_SIZE / 2 - 12,
              width: (SUB_RADIUS + SUB_ITEM_SIZE / 2 + 12) * 2,
              height: (SUB_RADIUS + SUB_ITEM_SIZE / 2 + 12) * 2,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
          {sortieAction.subActions!.map((sub, index) => {
            const angle = (index * 2 * Math.PI) / sortieAction.subActions!.length - Math.PI / 2;
            const x = cx + Math.cos(angle) * SUB_RADIUS;
            const y = subCy + Math.sin(angle) * SUB_RADIUS;
            const Icon = ICONS[sub.id];
            const isHovered = subHovered === index;
            return (
              <div
                key={sub.id}
                className="absolute flex flex-col items-center justify-center rounded-full pointer-events-none"
                style={{
                  left: x - SUB_ITEM_SIZE / 2,
                  top: y - SUB_ITEM_SIZE / 2,
                  width: SUB_ITEM_SIZE,
                  height: SUB_ITEM_SIZE,
                  background: sub.color,
                  boxShadow: isHovered
                    ? '0 4px 16px rgba(0,0,0,0.35)'
                    : '0 2px 6px rgba(0,0,0,0.2)',
                  transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                  transition: 'transform 120ms',
                  gap: 1,
                }}
              >
                {Icon && <Icon size={18} color="#fff" strokeWidth={2} />}
                <span style={{ fontSize: 8, fontWeight: 600, color: '#fff' }}>{sub.label}</span>
              </div>
            );
          })}
        </>
      )}

      {/* Disque central blanc : nom de l'eleve, taper dedans = annuler */}
      <div
        className="absolute flex items-center justify-center text-center pointer-events-none"
        style={{
          left: cx - CENTER_RADIUS,
          top: (subMenu ? subCy : cy) - CENTER_RADIUS,
          width: CENTER_RADIUS * 2,
          height: CENTER_RADIUS * 2,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          padding: 4,
          transform: visible ? 'scale(1)' : 'scale(0.5)',
          transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: DB.text,
            lineHeight: 1.15,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {studentPseudo}
        </span>
      </div>

      {/* Pill bas d'ecran */}
      <div
        className="absolute left-1/2 pointer-events-none"
        style={{
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 999,
          padding: '9px 16px',
          maxWidth: '85vw',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: 12.5,
          fontWeight: 500,
          color: DB.text,
          opacity: visible ? 1 : 0,
          transition: 'opacity 150ms',
        }}
      >
        {studentPseudo} · toucher le centre pour annuler
      </div>
    </div>
  );
}
