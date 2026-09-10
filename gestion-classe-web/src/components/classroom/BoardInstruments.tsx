/**
 * Règle, équerre, rapporteur : dessinés en SVG au-dessus du tableau, déplaçables à la main,
 * tournés par la poignée ronde (ou à deux doigts). Le stylo s'aimante sur leurs bords
 * (voir boardInstruments.snapToInstruments, appliqué par le Whiteboard).
 */
import { useRef } from 'react';
import { RULER_WIDTH, UNITS_PER_CM, type Instrument } from '../../lib/boardInstruments';
import type { StageBox } from './BoardObjectLayer';

interface Props {
  instruments: Instrument[];
  stage: StageBox;
  scale: number;
  onChange: (next: Instrument[]) => void;
}

type Drag = { id: string; mode: 'move' | 'rotate'; pointerId: number; startX: number; startY: number; start: Instrument; secondId?: number; startAngleBetween?: number; startDist?: number };

function RulerShape({ inst }: { inst: Instrument }) {
  const s = inst.size, h = RULER_WIDTH;
  const ticks: React.ReactNode[] = [];
  const cm = Math.floor(s / UNITS_PER_CM);
  for (let i = 0; i <= cm * 10; i++) {
    const x = -s / 2 + (i * UNITS_PER_CM) / 10;
    const len = i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7;
    ticks.push(<line key={i} x1={x} y1={-h / 2} x2={x} y2={-h / 2 + len} stroke="#1F2937" strokeWidth={i % 10 === 0 ? 1.2 : 0.7} />);
    if (i % 10 === 0 && i / 10 < cm) ticks.push(<text key={`t${i}`} x={x + 3} y={-h / 2 + 30} fontSize={11} fill="#1F2937" fontFamily="Inter, system-ui, sans-serif">{i / 10}</text>);
  }
  return (
    <g>
      <rect x={-s / 2} y={-h / 2} width={s} height={h} rx={4} fill="rgba(255, 244, 200, 0.82)" stroke="#92400E" strokeWidth={1.5} />
      {ticks}
      <text x={0} y={h / 2 - 10} textAnchor="middle" fontSize={11} fill="#92400E" fontFamily="Inter, system-ui, sans-serif">cm</text>
    </g>
  );
}

function SetSquareShape({ inst }: { inst: Instrument }) {
  const l = inst.size / Math.SQRT2;
  const p = `${-l / 2},${l / 2} ${l / 2},${l / 2} ${-l / 2},${-l / 2}`;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= Math.floor(l / UNITS_PER_CM) * 10; i++) {
    const x = -l / 2 + (i * UNITS_PER_CM) / 10;
    const len = i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6;
    ticks.push(<line key={i} x1={x} y1={l / 2} x2={x} y2={l / 2 - len} stroke="#1F2937" strokeWidth={0.8} />);
  }
  return (
    <g>
      <polygon points={p} fill="rgba(220, 240, 255, 0.82)" stroke="#1E40AF" strokeWidth={1.5} />
      <polygon points={`${-l / 2 + 40},${l / 2 - 40} ${l / 2 - 90},${l / 2 - 40} ${-l / 2 + 40},${-l / 2 + 90}`} fill="none" stroke="#1E40AF" strokeWidth={1} opacity={0.5} />
      {ticks}
      <path d={`M ${-l / 2 + 16} ${l / 2} v -16 h 16`} fill="none" stroke="#1E40AF" strokeWidth={1} />
    </g>
  );
}

function ProtractorShape({ inst }: { inst: Instrument }) {
  const r = inst.size / 2;
  const ticks: React.ReactNode[] = [];
  for (let d = 0; d <= 180; d++) {
    const a = Math.PI + (d * Math.PI) / 180;
    const len = d % 10 === 0 ? 16 : d % 5 === 0 ? 11 : 6;
    ticks.push(<line key={d} x1={r * Math.cos(a)} y1={r * Math.sin(a)} x2={(r - len) * Math.cos(a)} y2={(r - len) * Math.sin(a)} stroke="#1F2937" strokeWidth={d % 10 === 0 ? 1 : 0.6} />);
    if (d % 10 === 0) ticks.push(<text key={`t${d}`} x={(r - 26) * Math.cos(a)} y={(r - 26) * Math.sin(a) + 4} textAnchor="middle" fontSize={10} fill="#1F2937" fontFamily="Inter, system-ui, sans-serif">{d}</text>);
  }
  return (
    <g>
      <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`} fill="rgba(230, 255, 235, 0.82)" stroke="#065F46" strokeWidth={1.5} />
      <line x1={-r} y1={0} x2={r} y2={0} stroke="#065F46" strokeWidth={1} />
      <circle cx={0} cy={0} r={3} fill="#065F46" />
      {ticks}
    </g>
  );
}

export function BoardInstruments({ instruments, stage, scale, onChange }: Props) {
  const drag = useRef<Drag | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const angleOf = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

  const onDown = (e: React.PointerEvent, inst: Instrument, mode: 'move' | 'rotate') => {
    e.stopPropagation();
    e.preventDefault();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* synthétique */ }
    const d = drag.current;
    if (d && d.id === inst.id && pointers.current.size === 2 && !d.secondId) {
      // Deuxième doigt : rotation à deux doigts
      const a = pointers.current.get(d.pointerId)!;
      d.secondId = e.pointerId;
      d.startAngleBetween = angleOf(a, { x: e.clientX, y: e.clientY });
      d.start = inst;
      return;
    }
    drag.current = { id: inst.id, mode, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, start: inst };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const inst = instruments.find((i) => i.id === d.id);
    if (!inst) return;
    let next: Instrument = inst;
    if (d.secondId !== undefined && pointers.current.has(d.pointerId) && pointers.current.has(d.secondId)) {
      const a = pointers.current.get(d.pointerId)!, b = pointers.current.get(d.secondId)!;
      next = { ...inst, angle: d.start.angle + angleOf(a, b) - (d.startAngleBetween ?? 0) };
    } else if (e.pointerId !== d.pointerId) {
      return;
    } else if (d.mode === 'move') {
      next = { ...inst, x: d.start.x + (e.clientX - d.startX) / scale, y: d.start.y + (e.clientY - d.startY) / scale };
    } else {
      // Rotation par la poignée : angle du pointeur autour du centre
      const rect = (e.currentTarget as Element).closest('.wbn-inst')?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + inst.x * scale, cy = rect.top + inst.y * scale;
      const a = angleOf({ x: cx, y: cy }, { x: e.clientX, y: e.clientY });
      next = { ...inst, angle: Math.round(a) };
    }
    onChange(instruments.map((i) => (i.id === inst.id ? next : i)));
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    const d = drag.current;
    if (!d) return;
    if (e.pointerId === d.pointerId || e.pointerId === d.secondId) {
      if (pointers.current.size === 0) drag.current = null;
      else if (d.secondId !== undefined) { d.secondId = undefined; }
    }
  };

  return (
    <svg className="wbn-inst" style={{ left: stage.left, top: stage.top, width: stage.width, height: stage.height }} viewBox={`0 0 ${stage.width / scale} ${stage.height / scale}`}>
      {instruments.map((inst) => {
        const handleX = inst.kind === 'protractor' ? 0 : inst.size / 2 + 26;
        const handleY = inst.kind === 'protractor' ? -inst.size / 2 - 26 : 0;
        return (
          <g key={inst.id} className="wbn-inst__g" transform={`translate(${inst.x} ${inst.y}) rotate(${inst.angle})`}>
            <g className="wbn-inst__body" onPointerDown={(e) => onDown(e, inst, 'move')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {inst.kind === 'ruler' && <RulerShape inst={inst} />}
              {inst.kind === 'setsquare' && <SetSquareShape inst={inst} />}
              {inst.kind === 'protractor' && <ProtractorShape inst={inst} />}
            </g>
            <g className="wbn-inst__handle" onPointerDown={(e) => onDown(e, inst, 'rotate')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <circle cx={handleX} cy={handleY} r={16} />
              <text x={handleX} y={handleY + 5} textAnchor="middle" fontSize={16} fill="#FFFFFF">↻</text>
            </g>
            <g className="wbn-inst__close" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onChange(instruments.filter((i) => i.id !== inst.id)); }}>
              <circle cx={inst.kind === 'protractor' ? inst.size / 2 + 26 : -inst.size / 2 - 26} cy={inst.kind === 'protractor' ? -10 : 0} r={14} />
              <text x={inst.kind === 'protractor' ? inst.size / 2 + 26 : -inst.size / 2 - 26} y={(inst.kind === 'protractor' ? -10 : 0) + 5} textAnchor="middle" fontSize={14} fill="#FFFFFF">✕</text>
            </g>
          </g>
        );
      })}
      <style>{CSS}</style>
    </svg>
  );
}

const CSS = `
.wbn-inst { position: absolute; z-index: 3; pointer-events: none; overflow: visible; touch-action: none; user-select: none; }
.wbn-inst__body { pointer-events: auto; cursor: move; }
.wbn-inst__handle { pointer-events: auto; cursor: grab; }
.wbn-inst__handle circle { fill: #4F46E5; }
.wbn-inst__close { pointer-events: auto; cursor: pointer; }
.wbn-inst__close circle { fill: #DC2626; }
`;
