/**
 * QR code de la version téléphone (lib/mobileVersion.ts), posé par-dessus la première feuille du
 * cours, en haut à droite, dans la marge du haut, avec la légende « Version couleur » à sa gauche,
 * sur fond blanc (il recouvre le coin d'une image « page entière »). Invisible à l'écran : il n'existe
 * que sur le papier et dans le PDF, jamais dans le document.
 */
import { useMemo } from 'react';
import { qrBox, qrModules } from '../../lib/mobileVersion';

/** Zone blanche autour des modules, en modules (le blanc de la marge prolonge celle-ci). */
const QUIET = 1;

export function CourseMobileQr({ url }: { url: string }) {
  const qr = useMemo(() => qrModules(url), [url]);
  const { size, inset } = qrBox();
  const side = qr.size + 2 * QUIET;
  return (
    <div className="ce-qrprint" style={{ top: inset, right: inset, height: size }} aria-hidden>
      <span className="ce-qrprint__label">Version<br />couleur</span>
      <svg width={size} height={size} viewBox={`${-QUIET} ${-QUIET} ${side} ${side}`} shapeRendering="crispEdges">
        <rect x={-QUIET} y={-QUIET} width={side} height={side} fill="#fff" />
        <path d={qr.path} fill="#000" />
      </svg>
    </div>
  );
}
