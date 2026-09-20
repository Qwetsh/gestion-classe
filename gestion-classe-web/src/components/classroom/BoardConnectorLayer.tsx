/**
 * Calque des connecteurs (flèches entre objets) : un seul SVG de la taille de la page, posé
 * au-dessus des cadres d'objets. Chaque flèche a un tracé visible et un tracé invisible plus
 * large pour le pointage (une courbe fine ne s'attrape pas au doigt). Sélectionnée, elle montre
 * trois poignées : les deux extrémités (à glisser sur un objet pour la rattacher, dans le vide
 * pour la libérer) et le milieu (à glisser pour cintrer ; double-clic : redresser).
 * En lecture (classe), le calque est inerte.
 */
import { useEffect, useRef, useState } from 'react';
import type { BoardObject } from '../../lib/boardObjects';
import { CONNECTOR_HIT_WIDTH, isAttachedEnd, objectUnderPoint, resolveConnector, type ConnectorEnd, type ConnectorObject, type Pt } from '../../lib/boardConnectors';

interface Props {
  objects: BoardObject[];
  /** Pixels par unité (hors zoom de la scène : le SVG est dans la vue zoomée). */
  scale: number;
  width: number;
  height: number;
  active: boolean;
  play: boolean;
  selectedIds: ReadonlySet<string>;
  onSelect: (ids: Set<string>) => void;
  /** Même contrat que le calque d'objets : `before` non nul = entre dans l'historique. */
  onChange: (next: BoardObject[], before: BoardObject[] | null) => void;
  onContextMenu: (x: number, y: number, id: string) => void;
  /** Point écran → unités de page. */
  clientToUnit: (clientX: number, clientY: number) => Pt;
}

type Drag = { id: string; pointerId: number; kind: 'from' | 'to' | 'mid'; before: BoardObject[]; moved: boolean };

export function BoardConnectorLayer({ objects, scale, width, height, active, play, selectedIds, onSelect, onChange, onContextMenu, clientToUnit }: Props) {
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  // Les gestes lisent toujours les objets les plus récents (pas la fermeture d'un rendu passé)
  const objectsRef = useRef(objects);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  const connectors = objects.filter((o): o is ConnectorObject => o.type === 'connector');
  if (connectors.length === 0) return null;

  // Le ref est mis à jour tout de suite : un pointerup qui suit un pointermove dans la même
  // frame verrait sinon l'état d'avant le geste et l'enregistrerait dans l'historique
  const patch = (id: string, fn: (c: ConnectorObject) => ConnectorObject, before: BoardObject[] | null) => {
    const next = objectsRef.current.map((o) => (o.id === id && o.type === 'connector' ? fn(o) : o));
    objectsRef.current = next;
    onChange(next, before);
  };

  const startDrag = (e: React.PointerEvent, id: string, kind: Drag['kind']) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    dragRef.current = { id, pointerId: e.pointerId, kind, before: objectsRef.current, moved: false };
    setDragging(true);
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.moved = true;
    const u = clientToUnit(e.clientX, e.clientY);
    if (d.kind === 'mid') {
      patch(d.id, (c) => {
        const g = resolveConnector({ ...c, bend: undefined }, objectsRef.current);
        const m = { x: (g.p0.x + g.p1.x) / 2, y: (g.p0.y + g.p1.y) / 2 };
        // Le point de contrôle d'une quadratique est à 2× l'écart du milieu de la courbe
        return { ...c, route: 'curve', bend: { x: Math.round((u.x - m.x) * 2), y: Math.round((u.y - m.y) * 2) } };
      }, null);
      return;
    }
    const target = objectUnderPoint(e.clientX, e.clientY, objectsRef.current, d.id);
    const end: ConnectorEnd = target ? { objectId: target.id, side: 'auto' } : { x: Math.round(u.x), y: Math.round(u.y) };
    patch(d.id, (c) => (d.kind === 'from' ? { ...c, from: end } : { ...c, to: end }), null);
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    if (d.moved) onChange(objectsRef.current, d.before);
  };

  return (
    <svg className={`wbo__connectors ${active && !play ? 'is-active' : ''}`} width={width} height={height} viewBox={`0 0 ${width / scale} ${height / scale}`}>
      {connectors.map((c) => {
        const g = resolveConnector(c, objects);
        const selected = selectedIds.has(c.id);
        return (
          <g key={c.id} className={`wbo__connector ${selected ? 'is-selected' : ''}`} data-connector={c.id}>
            {selected && <path d={g.path} className="wbo__connector-halo" fill="none" vectorEffect="non-scaling-stroke" />}
            <path d={g.path} fill="none" stroke={c.stroke} strokeWidth={c.strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={c.dashed ? `${c.strokeWidth * 3} ${c.strokeWidth * 2.2}` : undefined} />
            {g.heads.map((h, i) => <path key={i} d={h} fill={c.stroke} stroke={c.stroke} strokeWidth={c.strokeWidth} strokeLinejoin="round" />)}
            {c.label && (
              <g className="wbo__connector-label" transform={`translate(${g.mid.x} ${g.mid.y})`}>
                <rect x={-(c.label.length * 5.4 + 8)} y={-13} width={c.label.length * 10.8 + 16} height={26} rx={6} fill="#FFFFFF" />
                <text y={1} textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight={600} fontFamily="Inter, system-ui, sans-serif" fill="#111827">{c.label}</text>
              </g>
            )}
            {active && !play && (
              <path
                d={g.path}
                className="wbo__connector-hit"
                fill="none"
                stroke="transparent"
                strokeWidth={CONNECTOR_HIT_WIDTH}
                vectorEffect="non-scaling-stroke"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  e.stopPropagation();
                  if (e.shiftKey || e.ctrlKey || e.metaKey) { const ids = new Set(selectedIds); if (ids.has(c.id)) ids.delete(c.id); else ids.add(c.id); onSelect(ids); }
                  else if (!selected) onSelect(new Set([c.id]));
                }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!selected) onSelect(new Set([c.id])); onContextMenu(e.clientX, e.clientY, c.id); }}
              />
            )}
            {active && !play && selected && selectedIds.size === 1 && (
              <g className={`wbo__connector-handles ${dragging ? 'is-dragging' : ''}`}>
                <circle cx={g.mid.x} cy={g.mid.y} r={7 / scale} className="wbo__connector-handle wbo__connector-handle--mid" vectorEffect="non-scaling-stroke"
                  onPointerDown={(e) => startDrag(e, c.id, 'mid')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                  onDoubleClick={(e) => { e.stopPropagation(); patch(c.id, (k) => ({ ...k, bend: undefined }), objectsRef.current); }}
                />
                {(['from', 'to'] as const).map((kind) => {
                  const p = kind === 'from' ? g.p0 : g.p1;
                  const attached = isAttachedEnd(kind === 'from' ? c.from : c.to);
                  return (
                    <circle key={kind} cx={p.x} cy={p.y} r={8 / scale} className={`wbo__connector-handle ${attached ? 'is-attached' : ''}`} vectorEffect="non-scaling-stroke"
                      onPointerDown={(e) => startDrag(e, c.id, kind)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                    />
                  );
                })}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
