/**
 * Sélecteur de couleur du tableau blanc : pastilles rapides dans la barre, puis un panneau
 * avec la palette complète, les couleurs récentes et une couleur libre (roue du navigateur).
 * Partagé par le stylo, le texte et les formes. Un clic droit sur une pastille (rapide ou de la
 * palette) la remplace par une couleur choisie à la roue, mémorisée pour la suite.
 */
import { useRef, useState } from 'react';
import { loadRecentColors, pushRecentColor } from '../../lib/boardPalette';
import { SWATCHES, SWATCH_HINT, customizeSwatch, openColorWheel, useSwatches } from '../../lib/boardSwatches';
import { BoardPopover } from './BoardPopover';

interface Props {
  value: string;
  onChange: (color: string) => void;
  /** Pastille « aucune » (remplissage vide). */
  allowNone?: boolean;
  title?: string;
  /** La couleur active n'est pas mise en avant (ex. surligneur actif). */
  muted?: boolean;
  /** Une seule pastille (la couleur courante) au lieu des quatre rapides : barre principale. */
  compact?: boolean;
}

export function BoardColorPicker({ value, onChange, allowNone, title = 'Couleur', muted, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const QUICK_COLORS = useSwatches(SWATCHES.quick);
  const BOARD_PALETTE = useSwatches(SWATCHES.palette);
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

  const pick = (c: string) => {
    onChange(c);
    if (c !== 'none') setRecent(pushRecentColor(c));
  };

  const isOn = (c: string) => !muted && value.toLowerCase() === c.toLowerCase();

  return (
    <div className={`wbc ${compact ? 'wbc--compact' : ''}`} ref={panelRef}>
      {compact ? (
        <button
          ref={btnRef}
          className={`wb__swatch wbc__single ${open ? 'is-on' : ''}`}
          style={{ background: value === 'none' ? undefined : value }}
          onPointerDown={hold}
          onClick={() => setOpen((v) => !v)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openColorWheel(value === 'none' ? '#111827' : value, pick, { x: e.clientX, y: e.clientY }); }}
          title={`${title} — ${SWATCH_HINT}`}
        />
      ) : (
      <>
      {QUICK_COLORS.map((c, i) => (
        <button key={i} className={`wb__swatch ${isOn(c) ? 'is-on' : ''}`} style={{ background: c }} onPointerDown={hold} onClick={() => pick(c)} onContextMenu={customizeSwatch(SWATCHES.quick, i, pick)} title={`${title} — ${SWATCH_HINT}`} />
      ))}
      <button
        ref={btnRef}
        className={`wb__swatch wbc__more ${open ? 'is-on' : ''} ${!QUICK_COLORS.some(isOn) && value !== 'none' && !muted ? 'is-custom' : ''}`}
        style={{ background: !QUICK_COLORS.some(isOn) && value !== 'none' ? value : undefined }}
        onPointerDown={hold}
        onClick={() => setOpen((v) => !v)}
        title="Plus de couleurs"
      >
        {(QUICK_COLORS.some(isOn) || value === 'none') && <span>+</span>}
      </button>
      </>
      )}
      {open && (
        // 476 = 8 pastilles de 44 px + 7 gouttières de 12 + 36 de marge intérieure. La grille
        // est en 8 colonnes : plus court, la droite de la palette sort du panneau.
        <BoardPopover anchorRef={btnRef} onClose={() => setOpen(false)} className="wbc__panel" width={476}>
          <div className="wbc__grid">
            {allowNone && (
              <button className={`wbc__cell wbc__cell--none ${value === 'none' ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => { pick('none'); setOpen(false); }} title="Aucune" />
            )}
            {BOARD_PALETTE.map((c, i) => (
              <button key={i} className={`wbc__cell ${isOn(c) ? 'is-on' : ''}`} style={{ background: c }} onPointerDown={hold} onClick={() => { pick(c); setOpen(false); }} onContextMenu={customizeSwatch(SWATCHES.palette, i, pick)} title={`${c} — ${SWATCH_HINT}`} />
            ))}
          </div>
          {recent.length > 0 && (
            <>
              <div className="wbc__label">Récentes</div>
              <div className="wbc__grid">
                {recent.map((c) => (
                  <button key={c} className={`wbc__cell ${isOn(c) ? 'is-on' : ''}`} style={{ background: c }} onPointerDown={hold} onClick={() => { pick(c); setOpen(false); }} title={c} />
                ))}
              </div>
            </>
          )}
          <label className="wbc__custom">
            <span>Autre couleur</span>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#111827'} onChange={(e) => pick(e.target.value)} />
          </label>
        </BoardPopover>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbc { position: relative; display: flex; align-items: center; }
/* Pastille unique : montre la couleur courante, ouvre la palette complète */
.wbc__single { margin: 0; }
.wbc__single.is-on { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wbc__more { display: flex; align-items: center; justify-content: center; background: #1F2937; color: #E5E7EB; font: 700 18px/1 Inter, system-ui, sans-serif; }
.wbc__more.is-custom { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wbc__panel { padding: 12px; border-radius: 14px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45); }
.wbc__grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.wbc__cell { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #374151; cursor: pointer; padding: 0; }
.wbc__cell.is-on { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wbc__cell--none { background: linear-gradient(135deg, transparent 45%, #DC2626 45%, #DC2626 55%, transparent 55%), #FFFFFF; }
.wbc__label { margin: 10px 0 6px; font: 500 11px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wbc__custom { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; color: #E5E7EB; font: 500 13px/1 Inter, system-ui, sans-serif; }
.wbc__custom input { width: 44px; height: 30px; border: 0; background: transparent; cursor: pointer; }
`;
