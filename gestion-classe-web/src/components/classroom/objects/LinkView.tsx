/**
 * Lien : une puce cliquable. En mode objets (sélection, texte), le clic sélectionne ;
 * avec un outil de dessin, il ouvre la page dans un nouvel onglet.
 */
import { fontCss } from '../../../lib/boardText';
import type { LinkObject } from '../../../lib/boardMedia';

interface Props {
  o: LinkObject;
  scale: number;
  active: boolean;
}

export function LinkView({ o, scale, active }: Props) {
  return (
    <a
      className="wbl"
      href={o.url}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      onClick={(e) => { if (active) e.preventDefault(); }}
      style={{ width: o.w * scale, height: o.size * 1.9 * scale, fontSize: o.size * scale, fontFamily: fontCss('sans'), padding: `0 ${o.size * 0.6 * scale}px` }}
      title={o.url}
    >
      🔗 <span>{o.label}</span>
      <style>{CSS}</style>
    </a>
  );
}

const CSS = `
.wbl { display: inline-flex; align-items: center; gap: 0.4em; box-sizing: border-box; border-radius: 999px; background: #E0E7FF; color: #3730A3; font-weight: 600; text-decoration: none; white-space: nowrap; overflow: hidden; user-select: none; }
.wbl span { overflow: hidden; text-overflow: ellipsis; }
.wbl:hover { background: #C7D2FE; }
`;
