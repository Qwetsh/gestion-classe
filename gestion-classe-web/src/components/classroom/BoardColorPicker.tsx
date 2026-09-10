/**
 * Sélecteur de couleur du tableau blanc : pastilles rapides dans la barre, puis un panneau
 * avec la palette complète, les couleurs récentes et une couleur libre (roue du navigateur).
 * Partagé par le stylo, le texte et les formes.
 */
import { useEffect, useRef, useState } from 'react';
import { BOARD_PALETTE, QUICK_COLORS, loadRecentColors, pushRecentColor } from '../../lib/boardPalette';

interface Props {
  value: string;
  onChange: (color: string) => void;
  /** Pastille « aucune » (remplissage vide). */
  allowNone?: boolean;
  title?: string;
  /** La couleur active n'est pas mise en avant (ex. surligneur actif). */
  muted?: boolean;
}

export function BoardColorPicker({ value, onChange, allowNone, title = 'Couleur', muted }: Props) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentColors());
  const panelRef = useRef<HTMLDivElement>(null);
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

  const pick = (c: string) => {
    onChange(c);
    if (c !== 'none') setRecent(pushRecentColor(c));
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', onDown, true); };
  }, [open]);

  const isOn = (c: string) => !muted && value.toLowerCase() === c.toLowerCase();

  return (
    <div className="wbc" ref={panelRef}>
      {QUICK_COLORS.map((c) => (
        <button key={c} className={`wb__swatch ${isOn(c) ? 'is-on' : ''}`} style={{ background: c }} onPointerDown={hold} onClick={() => pick(c)} title={title} />
      ))}
      <button
        className={`wb__swatch wbc__more ${open ? 'is-on' : ''} ${!QUICK_COLORS.some(isOn) && value !== 'none' && !muted ? 'is-custom' : ''}`}
        style={{ background: !QUICK_COLORS.some(isOn) && value !== 'none' ? value : undefined }}
        onPointerDown={hold}
        onClick={() => setOpen((v) => !v)}
        title="Plus de couleurs"
      >
        {(QUICK_COLORS.some(isOn) || value === 'none') && <span>+</span>}
      </button>
      {open && (
        <div className="wbc__panel" onPointerDown={(e) => e.stopPropagation()}>
          <div className="wbc__grid">
            {allowNone && (
              <button className={`wbc__cell wbc__cell--none ${value === 'none' ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => { pick('none'); setOpen(false); }} title="Aucune" />
            )}
            {BOARD_PALETTE.map((c) => (
              <button key={c} className={`wbc__cell ${isOn(c) ? 'is-on' : ''}`} style={{ background: c }} onPointerDown={hold} onClick={() => { pick(c); setOpen(false); }} title={c} />
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
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbc { position: relative; display: flex; align-items: center; }
.wbc__more { display: flex; align-items: center; justify-content: center; background: #1F2937; color: #E5E7EB; font: 700 18px/1 Inter, system-ui, sans-serif; }
.wbc__more.is-custom { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wbc__panel {
  position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%); z-index: 13;
  width: 292px; padding: 12px; border-radius: 14px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45);
}
.wbc__grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.wbc__cell { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #374151; cursor: pointer; padding: 0; }
.wbc__cell.is-on { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wbc__cell--none { background: linear-gradient(135deg, transparent 45%, #DC2626 45%, #DC2626 55%, transparent 55%), #FFFFFF; }
.wbc__label { margin: 10px 0 6px; font: 500 11px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wbc__custom { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; color: #E5E7EB; font: 500 13px/1 Inter, system-ui, sans-serif; }
.wbc__custom input { width: 44px; height: 30px; border: 0; background: transparent; cursor: pointer; }
`;
