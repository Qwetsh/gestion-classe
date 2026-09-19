/**
 * Menu « Plus » du tableau blanc : tout ce qui ne sert pas à chaque instant (page, fichier,
 * instruments, séance, réglages), rangé en sections nommées plutôt qu'empilé dans la barre.
 *
 * Remplace l'ancien popover Réglages fourre-tout. Chaque section est un titre + une grille
 * d'items ; un item peut être actif (réglage en cours) ou désactivé.
 */
import { BoardPopover } from './BoardPopover';

export interface MoreItem {
  id: string;
  label: string;
  icon: string;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface MoreSection {
  title: string;
  items: MoreItem[];
}

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  sections: MoreSection[];
  onClose: () => void;
}

export function BoardMoreMenu({ anchorRef, sections, onClose }: Props) {
  return (
    <BoardPopover anchorRef={anchorRef} onClose={onClose} className="wbm" width={380}>
      {sections.map((s) => (
        <div key={s.title} className="wbm__section">
          <div className="wbm__title">{s.title}</div>
          <div className="wbm__grid">
            {s.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className={`wbm__item ${it.active ? 'is-on' : ''}`}
                disabled={it.disabled}
                onClick={() => { it.onSelect(); onClose(); }}
              >
                <span className="wbm__icon">{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <style>{CSS}</style>
    </BoardPopover>
  );
}

const CSS = `
.wbm { padding: var(--wb-panel-pad, 10px); border-radius: 14px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45); }
.wbm__section + .wbm__section { margin-top: 10px; padding-top: 10px; border-top: 1px solid #1F2937; }
.wbm__title { padding: 0 6px 6px; color: #9CA3AF; font: 700 11px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
.wbm__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.wbm__item { display: flex; align-items: center; gap: 8px; height: var(--wb-menu-h, 44px); padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: #F3F4F6; font: 500 13px/1.2 Inter, system-ui, sans-serif; text-align: left; cursor: pointer; }
.wbm__item:hover:not(:disabled) { background: #1F2937; }
.wbm__item.is-on { background: #312E81; }
.wbm__item:disabled { opacity: 0.35; cursor: default; }
.wbm__icon { width: 22px; text-align: center; font-size: 16px; flex: none; }
`;
