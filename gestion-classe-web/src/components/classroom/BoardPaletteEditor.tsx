/**
 * Éditeur de la palette flottante : les huit quartiers du menu radial, chacun avec une liste
 * déroulante d'actions. Un aperçu du menu à gauche, les huit lignes à droite ; taper un
 * quartier de l'aperçu met sa ligne en avant. « Réinitialiser » remet la palette d'origine.
 */
import { useState } from 'react';
import { DEFAULT_PALETTE_SLOTS, PALETTE_CATALOG, PALETTE_GROUPS, PALETTE_SLOTS, paletteAction, radialArc } from '../../lib/boardRadialPalette';

interface Props {
  slots: string[];
  onChange: (slots: string[]) => void;
  hidden: boolean;
  onToggleHidden: () => void;
  onClose: () => void;
}

const R0 = 40, R1 = 130, RL = 92, GAP = (2 * Math.PI) / 180;

export function BoardPaletteEditor({ slots, onChange, hidden, onToggleHidden, onClose }: Props) {
  const [focus, setFocus] = useState<number | null>(null);
  const step = (2 * Math.PI) / PALETTE_SLOTS;
  const c = R1 + 6;
  const set = (i: number, id: string) => { const next = [...slots]; next[i] = id; onChange(next); };

  return (
    <div className="wbpe" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-label="Personnaliser la palette">
      <div className="wbpe__box" onPointerDown={(e) => e.stopPropagation()}>
        <div className="wbpe__head">
          <div>
            <h2>Ma palette</h2>
            <p>Huit quartiers autour de la pastille. Tapez un quartier pour le modifier.</p>
          </div>
          <button type="button" className="wbpe__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>
        <div className="wbpe__body">
          <svg className="wbpe__preview" width={c * 2} height={c * 2} viewBox={`0 0 ${c * 2} ${c * 2}`}>
            {slots.map((id, i) => {
              const a0 = -Math.PI / 2 + i * step - step / 2 + GAP / 2;
              const a1 = a0 + step - GAP;
              const am = (a0 + a1) / 2;
              const def = paletteAction(id);
              const lx = c + RL * Math.cos(am), ly = c + RL * Math.sin(am);
              return (
                <g key={i} className={`wbpe__seg ${focus === i ? 'is-focus' : ''}`} onPointerDown={() => setFocus(i)}>
                  <path d={radialArc(c, c, R0, R1, a0, a1)} />
                  <text x={lx} y={ly - 6} textAnchor="middle" className="wbpe__icon">{def?.icon ?? ''}</text>
                  <text x={lx} y={ly + 16} textAnchor="middle" className="wbpe__label">{def?.label ?? ''}</text>
                  <text x={c + (R0 + 16) * Math.cos(am)} y={c + (R0 + 16) * Math.sin(am) + 4} textAnchor="middle" className="wbpe__num">{i + 1}</text>
                </g>
              );
            })}
            <circle cx={c} cy={c} r={R0 - 6} fill="#FFFFFF" />
          </svg>
          <ol className="wbpe__list">
            {slots.map((id, i) => (
              <li key={i} className={focus === i ? 'is-focus' : ''}>
                <span className="wbpe__n">{i + 1}</span>
                <select value={id} onFocus={() => setFocus(i)} onChange={(e) => set(i, e.target.value)}>
                  {PALETTE_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {PALETTE_CATALOG.filter((a) => a.group === g).map((a) => (
                        <option key={a.id} value={a.id}>{a.icon ? `${a.icon}  ${a.label}` : a.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </li>
            ))}
          </ol>
        </div>
        <div className="wbpe__foot">
          <button type="button" className="wbpe__btn" onClick={onToggleHidden}>{hidden ? 'Afficher la pastille' : 'Masquer la pastille'}</button>
          <button type="button" className="wbpe__btn" onClick={() => onChange([...DEFAULT_PALETTE_SLOTS])}>Réinitialiser</button>
          <span className="wbpe__hint">Glissez la pastille pour la poser où vous voulez.</span>
          <button type="button" className="wbpe__btn wbpe__btn--primary" onClick={onClose}>Terminé</button>
        </div>
        <style>{CSS}</style>
      </div>
    </div>
  );
}

const CSS = `
.wbpe { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(8,10,14,.66); font-family: var(--wb-font-ui, Inter, system-ui, sans-serif); }
.wbpe__box { width: min(880px, 100%); max-height: calc(100vh - 48px); display: flex; flex-direction: column; background: var(--wb-chrome, #171C24); color: var(--wb-on-chrome, #E7ECF3); border-radius: var(--wb-r-panel, 28px); box-shadow: var(--wb-e3, 0 24px 48px -20px rgba(0,0,0,1)); overflow: hidden; }
.wbpe__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 8px; }
.wbpe__head h2 { margin: 0; font: 700 24px/1.2 var(--wb-font-ui, inherit); }
.wbpe__head p { margin: 4px 0 0; font-size: 16px; color: var(--wb-on-chrome-dim, #93A0B4); }
.wbpe__close { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--wb-chrome-sunk, #1E2530); color: inherit; font-size: 18px; cursor: pointer; }
.wbpe__body { display: flex; gap: 20px; padding: 8px 22px; overflow: auto; align-items: flex-start; }
.wbpe__preview { flex: none; overflow: visible; }
.wbpe__seg path { fill: var(--wb-chrome-sunk, #1E2530); stroke: var(--wb-chrome-line, #2E3846); stroke-width: 2; cursor: pointer; }
.wbpe__seg.is-focus path { fill: var(--wb-select, #4F46E5); }
.wbpe__icon { font-size: 20px; fill: #FFFFFF; pointer-events: none; }
.wbpe__label { font: 600 12px/1 var(--wb-font-ui, inherit); fill: var(--wb-on-chrome, #E7ECF3); pointer-events: none; }
.wbpe__num { font: 700 11px/1 var(--wb-font-num, monospace); fill: var(--wb-on-chrome-mute, #6E7C92); pointer-events: none; }
.wbpe__list { flex: 1; min-width: 0; margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.wbpe__list li { display: flex; align-items: center; gap: 10px; padding: 4px; border-radius: 14px; }
.wbpe__list li.is-focus { background: var(--wb-select-soft, rgba(79,70,229,.14)); }
.wbpe__n { flex: none; width: 28px; text-align: center; font: 700 15px/1 var(--wb-font-num, monospace); color: var(--wb-on-chrome-dim, #93A0B4); }
.wbpe__list select { flex: 1; min-width: 0; height: 48px; padding: 0 12px; border: 1px solid var(--wb-chrome-line, #2E3846); border-radius: 12px; background: var(--wb-chrome-sunk, #1E2530); color: inherit; font: 600 16px/1 var(--wb-font-ui, inherit); cursor: pointer; }
.wbpe__foot { display: flex; align-items: center; gap: 10px; padding: 12px 22px 20px; flex-wrap: wrap; }
.wbpe__hint { flex: 1; min-width: 160px; font-size: 14px; color: var(--wb-on-chrome-dim, #93A0B4); }
.wbpe__btn { height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--wb-chrome-sunk, #1E2530); color: inherit; font: 600 15px/1 var(--wb-font-ui, inherit); cursor: pointer; }
.wbpe__btn--primary { background: #FFFFFF; color: #14181F; }
@media (max-width: 760px) { .wbpe__body { flex-direction: column; align-items: center; } .wbpe__list { grid-template-columns: 1fr; width: 100%; } }
`;
