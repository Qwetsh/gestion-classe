/**
 * Barre contextuelle d'un connecteur (flèche entre objets) : tracé, têtes, couleur, épaisseur,
 * pointillé, libellé, suppression. Se pose sur l'objet dans `BoardFloatingToolbar`, comme les
 * autres barres. Tout agit tout de suite sur les connecteurs sélectionnés.
 */
import { CONNECTOR_COLORS, CONNECTOR_WIDTHS, type ConnectorObject, type ConnectorRoute } from '../../lib/boardConnectors';

interface Props {
  connectors: ConnectorObject[];
  onPatch: (fn: (c: ConnectorObject) => ConnectorObject) => void;
  onDelete: () => void;
}

const hold = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); };

export function BoardConnectorToolbar({ connectors, onPatch, onDelete }: Props) {
  const one = connectors[0];
  if (!one) return null;
  const heads = one.heads.start && one.heads.end ? 'both' : one.heads.end ? 'end' : one.heads.start ? 'start' : 'none';
  const setRoute = (route: ConnectorRoute) => onPatch((c) => ({ ...c, route, ...(route === 'straight' ? { bend: undefined } : {}) }));
  const setHeads = (h: 'none' | 'end' | 'start' | 'both') => onPatch((c) => ({ ...c, heads: { start: h === 'start' || h === 'both', end: h === 'end' || h === 'both' } }));
  const editLabel = () => {
    const t = window.prompt('Texte sur la flèche (vide : aucun)', one.label ?? '');
    if (t === null) return;
    onPatch((c) => ({ ...c, label: t.trim() || undefined }));
  };
  return (
    <>
      <div className="wb__group">
        <button type="button" className={`wb__btn wb__txt ${one.route === 'curve' ? 'is-on' : ''}`} title="Courbe" onPointerDown={hold} onClick={() => setRoute('curve')}>◜</button>
        <button type="button" className={`wb__btn wb__txt ${one.route === 'straight' ? 'is-on' : ''}`} title="Droite" onPointerDown={hold} onClick={() => setRoute('straight')}>／</button>
      </div>
      <div className="wb__group">
        <button type="button" className={`wb__btn wb__txt ${heads === 'none' ? 'is-on' : ''}`} title="Sans flèche" onPointerDown={hold} onClick={() => setHeads('none')}>—</button>
        <button type="button" className={`wb__btn wb__txt ${heads === 'end' ? 'is-on' : ''}`} title="Flèche à la fin" onPointerDown={hold} onClick={() => setHeads('end')}>→</button>
        <button type="button" className={`wb__btn wb__txt ${heads === 'both' ? 'is-on' : ''}`} title="Flèche aux deux bouts" onPointerDown={hold} onClick={() => setHeads('both')}>↔</button>
      </div>
      <div className="wb__group">
        {CONNECTOR_COLORS.map((col) => (
          <button key={col} type="button" className={`wb__btn wb__swatch ${one.stroke === col ? 'is-on' : ''}`} title="Couleur" style={{ background: col }} onPointerDown={hold} onClick={() => onPatch((c) => ({ ...c, stroke: col }))} />
        ))}
      </div>
      <div className="wb__group">
        {(Object.keys(CONNECTOR_WIDTHS) as ('S' | 'M' | 'L')[]).map((k) => (
          <button key={k} type="button" className={`wb__btn wb__txt ${one.strokeWidth === CONNECTOR_WIDTHS[k] ? 'is-on' : ''}`} title={`Épaisseur ${k}`} onPointerDown={hold} onClick={() => onPatch((c) => ({ ...c, strokeWidth: CONNECTOR_WIDTHS[k] }))}>
            <span style={{ display: 'inline-block', width: 18, height: CONNECTOR_WIDTHS[k], background: 'currentColor', borderRadius: 2 }} />
          </button>
        ))}
        <button type="button" className={`wb__btn wb__txt ${one.dashed ? 'is-on' : ''}`} title="Pointillé" onPointerDown={hold} onClick={() => onPatch((c) => ({ ...c, dashed: !c.dashed }))}>┄</button>
      </div>
      <div className="wb__group">
        <button type="button" className={`wb__btn wb__txt ${one.label ? 'is-on' : ''}`} title="Texte sur la flèche" onPointerDown={hold} onClick={editLabel}>Aa</button>
        <button type="button" className="wb__btn wb__txt wb__btn--danger" title="Supprimer" onPointerDown={hold} onClick={onDelete}>🗑</button>
      </div>
    </>
  );
}
