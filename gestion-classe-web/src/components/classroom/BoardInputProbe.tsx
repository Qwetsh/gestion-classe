/**
 * Diagnostic du pointeur (Plus › Réglages › « Test du stylet »). Recouvre l'écran d'un calque
 * transparent qui dessine une croix à l'endroit exact où le navigateur dit que le stylet, le
 * doigt ou la souris se trouve, et affiche ce que le tableau reçoit : type de pointeur,
 * coordonnées, pression, échantillons groupés, ratio d'écran, zoom, position de la fenêtre.
 * Sert à distinguer un bug du tableau (la croix suit la pointe mais l'encre non) d'un problème
 * de pilote ou de Chrome (la croix elle-même n'est pas sous la pointe). Aucune donnée n'est envoyée.
 */
import { useEffect, useState } from 'react';

interface Sample {
  id: number;
  type: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
  pressure: number;
  grouped: number;
  /** Écart entre le dernier échantillon groupé et l'événement principal (doit être 0). */
  groupedDx: number;
  groupedDy: number;
  down: boolean;
}

interface Props { onClose: () => void }

export function BoardInputProbe({ onClose }: Props) {
  const [pointers, setPointers] = useState<Map<number, Sample>>(new Map());
  const [trail, setTrail] = useState<{ x: number; y: number; type: string }[]>([]);
  const [tick, setTick] = useState(0);
  const [last, setLast] = useState<Sample | null>(null);

  useEffect(() => {
    const read = (e: PointerEvent, down: boolean): Sample => {
      const grouped = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const last = grouped[grouped.length - 1];
      return {
        id: e.pointerId, type: e.pointerType || '?', x: e.clientX, y: e.clientY, sx: e.screenX, sy: e.screenY,
        pressure: e.pressure, grouped: grouped.length,
        groupedDx: last ? last.clientX - e.clientX : 0, groupedDy: last ? last.clientY - e.clientY : 0, down,
      };
    };
    const onMove = (e: PointerEvent) => {
      const s = read(e, (e.buttons & 1) === 1 || e.pointerType === 'touch');
      setLast(s);
      setPointers((m) => { const n = new Map(m); n.set(e.pointerId, s); return n; });
      if (s.down) setTrail((t) => [...t.slice(-400), { x: s.x, y: s.y, type: s.type }]);
    };
    const onDown = (e: PointerEvent) => {
      const s = read(e, true);
      setLast(s);
      setPointers((m) => { const n = new Map(m); n.set(e.pointerId, s); return n; });
      setTrail((t) => [...t.slice(-400), { x: s.x, y: s.y, type: s.type }]);
    };
    const onUp = (e: PointerEvent) => {
      setPointers((m) => { const n = new Map(m); n.delete(e.pointerId); return n; });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('keydown', onKey, true);
    const t = window.setInterval(() => setTick((v) => v + 1), 500);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(t);
    };
  }, [onClose]);

  void tick;
  const dpr = window.devicePixelRatio || 1;
  const vv = window.visualViewport;
  const stage = document.querySelector('.wb__stage')?.getBoundingClientRect();
  const canvas = document.querySelector('canvas.wb__input')?.getBoundingClientRect();
  const info = [
    `Fenêtre ${window.innerWidth}×${window.innerHeight} css · ratio d'écran ${dpr.toFixed(2)} · zoom visuel ${vv ? vv.scale.toFixed(2) : '?'}`,
    `Écran ${window.screen.width}×${window.screen.height} · fenêtre posée en ${window.screenX},${window.screenY} · extérieur ${window.outerWidth}×${window.outerHeight}`,
    stage ? `Scène ${Math.round(stage.left)},${Math.round(stage.top)} ${Math.round(stage.width)}×${Math.round(stage.height)}` : 'Scène : —',
    canvas ? `Calque d'encre ${Math.round(canvas.left)},${Math.round(canvas.top)} ${Math.round(canvas.width)}×${Math.round(canvas.height)}` : 'Calque : —',
    last
      ? `Dernier pointeur : ${last.type} · client ${Math.round(last.x)},${Math.round(last.y)} · écran ${last.sx},${last.sy} · pression ${last.pressure.toFixed(2)} · groupés ${last.grouped} (écart ${last.groupedDx.toFixed(1)},${last.groupedDy.toFixed(1)})`
      : 'Dernier pointeur : posez le stylet, le doigt ou la souris',
    `${navigator.userAgent.replace(/^.*\) /, '')}`,
  ];

  return (
    <div className="wbprobe" aria-hidden>
      <svg className="wbprobe__svg" width={window.innerWidth} height={window.innerHeight}>
        {trail.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2} className={`wbprobe__dot wbprobe__dot--${p.type}`} />)}
        {Array.from(pointers.values()).map((p) => (
          <g key={p.id} className={`wbprobe__cross wbprobe__cross--${p.type}`}>
            <line x1={p.x - 40} y1={p.y} x2={p.x + 40} y2={p.y} />
            <line x1={p.x} y1={p.y - 40} x2={p.x} y2={p.y + 40} />
            <circle cx={p.x} cy={p.y} r={14} />
            <text x={p.x + 18} y={p.y - 18}>{p.type} {Math.round(p.x)},{Math.round(p.y)}</text>
          </g>
        ))}
      </svg>
      <div className="wbprobe__panel">
        <div className="wbprobe__title">Test du stylet — la croix doit être sous la pointe. Échap pour quitter.</div>
        {info.map((l, i) => <div key={i} className="wbprobe__line">{l}</div>)}
        <button type="button" className="wbprobe__close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>Quitter le test</button>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbprobe { position: fixed; inset: 0; z-index: 60; pointer-events: none; font: 500 14px/1.4 var(--wb-font-num, ui-monospace, monospace); }
.wbprobe__svg { position: absolute; inset: 0; overflow: visible; }
.wbprobe__dot { fill: rgba(220,38,38,.8); }
.wbprobe__dot--pen { fill: rgba(29,78,216,.85); }
.wbprobe__dot--touch { fill: rgba(5,150,105,.85); }
.wbprobe__cross line { stroke: #DC2626; stroke-width: 2; }
.wbprobe__cross circle { fill: none; stroke: #DC2626; stroke-width: 2; }
.wbprobe__cross text { fill: #DC2626; font: 700 14px/1 var(--wb-font-num, ui-monospace, monospace); paint-order: stroke; stroke: #FFFFFF; stroke-width: 4px; }
.wbprobe__cross--pen line, .wbprobe__cross--pen circle { stroke: #1D4ED8; }
.wbprobe__cross--pen text { fill: #1D4ED8; }
.wbprobe__cross--touch line, .wbprobe__cross--touch circle { stroke: #059669; }
.wbprobe__cross--touch text { fill: #059669; }
.wbprobe__panel { position: absolute; left: 12px; top: 12px; max-width: min(760px, calc(100vw - 24px)); padding: 10px 14px; border-radius: 12px; background: rgba(8,10,14,.9); color: #E7ECF3; pointer-events: auto; }
.wbprobe__title { font-weight: 700; color: #FCD34D; margin-bottom: 6px; }
.wbprobe__line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbprobe__close { margin-top: 8px; height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: #FFFFFF; color: #14181F; font: 700 15px/1 var(--wb-font-ui, system-ui, sans-serif); cursor: pointer; }
`;
