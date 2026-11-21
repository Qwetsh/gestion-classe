/* Carte commune aux deux animations de la correction de Wegener (4e S2 A3) : le puzzle qui se ferme
   et l'ouverture de l'Atlantique sud. Scène 1600 x 570 (cadre posé au-dessus de y = 450 sur l'écran).
   Dessins : animation/banque/tectonique.js. */
const CARTE = (() => {
  const LON0 = -15, LAT0 = -12;
  // Deux cadrages : toute la carte d'aujourd'hui, et la jonction des deux continents
  const LARGE = { cx: 30, cy: 15, k: 0.051 };
  const PROCHE = { cx: 3375, cy: -300, k: 0.08 };
  const vue = (z, de = LARGE, a = PROCHE) => TEC.camera(LON0, LAT0, lerp(de.cx, a.cx, z), lerp(de.cy, a.cy, z), lerp(de.k, a.k, z));

  const SABLE = '#EADBB8', BORD = '#7C5A2E', PLATEAU = '#CDB88C', MER = '#D3E8F5', MESO = '#4F6B2E';
  const defs = `<defs>
    <linearGradient id="mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCEEF8"/><stop offset="1" stop-color="#C3DFF0"/></linearGradient>
    <pattern id="hach" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#E3EDC9"/><line x1="0" y1="0" x2="0" y2="14" stroke="${MESO}" stroke-width="5"/></pattern>
    <linearGradient id="ages" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E4572E"/><stop offset=".5" stop-color="#F3C969"/><stop offset="1" stop-color="#4E7FB0"/></linearGradient>
  </defs>`;
  const fond = () => defs + `<rect width="1600" height="570" fill="url(#mer)"/>`;

  function equateur(P, op = 1) {
    const L = []; for (let lon = -110; lon <= 80; lon += 5) L.push([lon, 0]);
    const [x, y] = P([57, 0]);
    return `<path d="${TEC.chemin(L, P, false)}" fill="none" stroke="#7FA6C6" stroke-width="2.5" stroke-dasharray="10 8" opacity="${op}"/>` +
      txt(x + 6, y - 14, 'équateur', 30, '#4F7698', 'start', 600, op);
  }

  /** Un continent : plateau continental (sous la mer) en option, puis la terre émergée. */
  function continent(points, P, op = 1, plateauKm = 0) {
    const d = TEC.chemin(points, P);
    let h = '';
    if (plateauKm > 0) h += `<path d="${d}" fill="${PLATEAU}" stroke="${PLATEAU}" stroke-width="${f(2 * plateauKm * P.k)}" stroke-linejoin="round" opacity="${op}"/>`;
    return h + `<path d="${d}" fill="${SABLE}" stroke="${BORD}" stroke-width="3" stroke-linejoin="round" opacity="${op}"/>`;
  }
  function zone(points, P, op = 1, eclat = 0) {
    const d = TEC.chemin(points, P);
    return (eclat > 0 ? `<path d="${d}" fill="none" stroke="#9BC53D" stroke-width="${f(10 + 10 * eclat)}" opacity="${f(.5 * op)}" stroke-linejoin="round"/>` : '') +
      `<path d="${d}" fill="url(#hach)" stroke="${MESO}" stroke-width="3" opacity="${op}"/>`;
  }
  /** Étiquette posée près d'un point de la carte, avec un trait de rappel. */
  function etiquette(P, p, dx, dy, s, taille = 36, col = TXT, op = 1, poids = 700) {
    const [x, y] = P(p);
    if (op <= 0) return '';
    return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + dx)}" y2="${f(y + dy + (dy < 0 ? 8 : -taille * .75))}" stroke="${col}" stroke-width="2.5" opacity="${op}"/>` +
      `<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="${col}" opacity="${op}"/>` +
      txt(x + dx, y + dy, s, taille, col, dx < 0 ? 'end' : 'start', poids, op);
  }
  /** Le texte d'un encart en haut à droite (date, compteur). */
  function encart(lignes, op = 1, x = 1190, y = 22, w = 390) {
    const h = 20 + lignes.length * 52;
    let s = `<g opacity="${op}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#fff" stroke="#9FB3CC" stroke-width="3"/>`;
    lignes.forEach(([texte, taille, col, poids], i) => { s += txt(x + w / 2, y + 52 + i * 52, texte, taille || 36, col || TXT, 'middle', poids || 700); });
    return s + '</g>';
  }
  return { vue, fond, equateur, continent, zone, etiquette, encart, LARGE, PROCHE, SABLE, BORD, MESO };
})();
