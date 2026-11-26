/* Banque de dessins — immunité (cycle 4) : virus et antigènes, anticorps, lymphocyte B, phagocyte, cellule, fonds.
   Choix : la forme complémentaire antigène / anticorps est symbolisée par des formes géométriques
   (triangle = virus d'Epstein-Barr, carré = grippe) ; les plasmocytes ne sont pas nommés. */
const C = { ebvF: '#C9B6EC', ebvS: '#5E35B1', agTri: '#D63A3A', grF: '#FFE0B2', grS: '#E07B00', agCar: '#2E9E55',
  ab: '#1A63C9', lbF: '#D8E9FC', lbS: '#1A63C9', lbN: '#6A8FCB', phF: '#FBE3BE', phS: '#C98325', phN: '#B9772E',
  celF: '#F9DCDC', celS: '#C05555', txt: TXT, ok: VERT, ko: ROUGE };

/** Antigène : base en (x, y), pointe vers l'extérieur dans la direction ang (degrés). */
function antigen(kind, x, y, ang, s = 1) {
  const p = kind === 'tri' ? 'M-7,1 L0,-12 L7,1Z' : 'M-6,1 L-6,-11 L6,-11 L6,1Z';
  const col = kind === 'tri' ? C.agTri : C.agCar;
  return `<path d="${p}" fill="${col}" stroke="#0004" stroke-width="1" transform="translate(${f(x)},${f(y)}) rotate(${f(ang + 90)}) scale(${s})"/>`;
}
/** Virus à 8 antigènes ; kind : 'tri' (Epstein-Barr) ou 'carre' (grippe). */
function virus(x, y, kind = 'tri', rot = 0, s = 1, op = 1) {
  let a = '';
  for (let i = 0; i < 8; i++) { const an = rot + 45 * i, [c, si] = dir(an); a += antigen(kind, 33 * c, 33 * si, an); }
  const F = kind === 'tri' ? C.ebvF : C.grF, S = kind === 'tri' ? C.ebvS : C.grS;
  return `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">${a}
    <circle r="34" fill="${F}" stroke="${S}" stroke-width="3"/>
    <path d="M-15,-7 q7,-9 15,0 t15,0 M-15,8 q7,-9 15,0 t15,0" fill="none" stroke="${S}" stroke-width="2.5" opacity=".55"/></g>`;
}
/** Extrémité d'un bras d'anticorps : creux de forme complémentaire de l'antigène. */
function cup(kind, L) {
  const b = -L + 2, t = -L - 14, W = 11;
  if (kind === 'tri') return `M-${W},${b} L-${W},${t} L-7,${t} L0,${-L - 2} L7,${t} L${W},${t} L${W},${b}Z`;
  if (kind === 'carre') return `M-${W},${b} L-${W},${t} L-6,${t} L-6,${-L - 3} L6,${-L - 3} L6,${t} L${W},${t} L${W},${b}Z`;
  if (kind === 'rond') return `M-${W},${b} L-${W},${t} L-7,${t} A7,7 0 0 0 7,${t} L${W},${t} L${W},${b}Z`;
  return `M-${W},${b} L-${W},${t} L-5,${-L - 4} L0,${t} L5,${-L - 4} L${W},${t} L${W},${b}Z`; // 'double'
}
/** Anticorps en Y : (x, y) = jonction du Y, tige vers le bas (rot = 0), bras à ±35°. */
function antibody(x, y, rot = 0, s = 1, kind = 'tri', op = 1, col = C.ab) {
  const L = 24, arm = (d) => `<g transform="rotate(${d})"><line x1="0" y1="0" x2="0" y2="${-L}" stroke="${col}" stroke-width="7" stroke-linecap="round"/><path d="${cup(kind, L)}" fill="${col}"/></g>`;
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(rot)}) scale(${s})" opacity="${op}"><line x1="0" y1="0" x2="0" y2="26" stroke="${col}" stroke-width="7" stroke-linecap="round"/>${arm(-35)}${arm(35)}</g>`;
}
/** Position d'un anticorps fixé (bras droit) sur l'antigène i d'un virus. */
function bindAb(vx, vy, vrot, vs, i, as) {
  const th = vrot + 45 * i, [ux, uy] = dir(th), R = 46 * vs;
  const Tx = vx + R * ux, Ty = vy + R * uy;
  return { x: Tx + 26 * as * ux, y: Ty + 26 * as * uy, r: th + 235 };
}
const M = .8; // taille des récepteurs (anticorps de surface) du lymphocyte B
/** Lymphocyte B : six récepteurs d'une seule forme ; glow = halo d'activation (0 à 1). */
function LB(x, y, kind, s = 1, glow = 0, op = 1) {
  let r = '';
  for (let k = 0; k < 6; k++) { const th = -90 + 60 * k, [ux, uy] = dir(th), R = 48 + 26 * M; r += antibody(R * ux, R * uy, th + 90, M, kind, 1, C.lbS); }
  return `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">
    <circle r="74" fill="none" stroke="#FFB300" stroke-width="10" opacity="${glow}"/>${r}
    <circle r="48" fill="${C.lbF}" stroke="${C.lbS}" stroke-width="3"/><circle r="35" fill="${C.lbN}" opacity=".8"/></g>`;
}
/** Pose d'un virus dont un antigène s'emboîte dans le récepteur du haut d'un lymphocyte B. */
function poseOnLB(x, y, s, vs) {
  const th = -90, R = (48 + 26 * M) * s, [ux, uy] = dir(th), Jx = x + R * ux, Jy = y + R * uy;
  const [ax, ay] = dir(th + 35), Tx = Jx + 26 * M * s * ax, Ty = Jy + 26 * M * s * ay;
  return { x: Tx + 46 * vs * ax, y: Ty + 46 * vs * ay, r: th + 215 };
}
/** Phagocyte au contour ondulant ; fop = opacité du cytoplasme (on voit ce qu'il a ingéré). */
function phagocyte(x, y, r, t, op = 1, fop = 1, nx = -60, ny = 40) {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const a = i / 60 * 2 * Math.PI, rr = r * (1 + .07 * Math.sin(3 * a + t * 1.7) + .04 * Math.sin(5 * a - t * 2.3));
    d += (i ? 'L' : 'M') + f(x + rr * Math.cos(a)) + ',' + f(y + rr * Math.sin(a));
  }
  return `<g opacity="${op}"><path d="${d}Z" fill="${C.phF}" fill-opacity="${fop}" stroke="${C.phS}" stroke-width="4"/>
    <g fill="${C.phN}" opacity=".85"><circle cx="${f(x + nx)}" cy="${f(y + ny)}" r="${f(r * .16)}"/><circle cx="${f(x + nx + r * .2)}" cy="${f(y + ny + r * .12)}" r="${f(r * .14)}"/><circle cx="${f(x + nx - r * .18)}" cy="${f(y + ny + r * .16)}" r="${f(r * .13)}"/></g></g>`;
}
function cellule(x, y, w, h, lab = 'Cellule de l\'organisme (amygdale)') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="60" fill="${C.celF}" stroke="${C.celS}" stroke-width="5"/>
    <ellipse cx="${x + w * .62}" cy="${y + h * .5}" rx="${w * .2}" ry="${h * .16}" fill="#E7A3A3" opacity=".8"/>
    ${txt(x + w / 2, y + h + 36, lab, 24, C.celS, 'middle', 700)}`;
}
const HEM = [[120, 110], [360, 640], [600, 90], [820, 680], [1040, 120], [1280, 660], [1480, 140], [230, 400], [1500, 420], [700, 330]];
/** Fond « dans le sang » : hématies qui dérivent ; x0 = bord gauche du fond. */
function fondSang(t, lab = 'Dans le sang', x0 = 0) {
  let h = `<rect x="${x0}" y="0" width="${1600 - x0}" height="760" fill="#FDF2EF"/>`;
  HEM.forEach(([x, y], i) => {
    if (x < x0 + 40) return;
    const dx = 12 * Math.sin(t * .4 + i);
    h += `<g opacity=".45"><ellipse cx="${f(x + dx)}" cy="${y}" rx="40" ry="36" fill="#EFA9A1"/><ellipse cx="${f(x + dx)}" cy="${y}" rx="18" ry="16" fill="#F7CBC5"/></g>`;
  });
  return h + txt(x0 + 24, 46, lab, 26, '#B3473B', 'start', 700);
}
function fondGanglion(rx = 720, ry = 310, lab = 'Dans un ganglion lymphatique') {
  return `<rect width="1600" height="760" fill="#F5F8F1"/><ellipse cx="800" cy="400" rx="${f(rx)}" ry="${f(ry)}" fill="#E7F0DC" stroke="#94AE7C" stroke-width="4" stroke-dasharray="14 8"/>${txt(24, 46, lab, 26, '#4F6B37', 'start', 700)}`;
}

/* --- Ajouts du 22/11/2026 (correction de l'entraînement noté de 3e, séquence 2) :
   staphylocoque, toxines (tétanique : sites ronds ; diphtérique : sites carrés), fixation d'un anticorps
   sur une toxine, souris et lapin de laboratoire. */
const CB = { bF: '#C8E6A8', bS: '#4E8A2E', ttF: '#F6D0EA', ttS: '#A0337C', tdF: '#CFE6F7', tdS: '#2B7BB9',
  sourisF: '#E4E4E8', sourisS: '#6B6B78', lapinF: '#F1E7DA', lapinS: '#8A6E4B' };
/** Staphylocoque : une grappe de quatre coques. dig (0 → 1) : la bactérie est digérée (elle se défait en débris). */
function bacterie(x, y, rot = 0, s = 1, op = 1, dig = 0) {
  const P = [[-10, -8], [10, -8], [0, 9], [19, 8]];
  let h = '';
  P.forEach(([px, py], k) => {
    const r = 11 * (1 - .75 * dig), dx = dig * (k % 2 ? 18 : -18), dy = dig * (k < 2 ? -16 : 16);
    h += `<circle cx="${f(px + dx)}" cy="${f(py + dy)}" r="${f(r)}" fill="${dig > .5 ? '#B9B9B0' : CB.bF}" stroke="${dig > .5 ? '#8A8A80' : CB.bS}" stroke-width="2.5"/>`;
    if (dig < .5) h += `<circle cx="${f(px + dx - 3)}" cy="${f(py + dy - 3)}" r="3" fill="#fff" opacity=".7"/>`;
  });
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(rot)}) scale(${s})" opacity="${op}">${h}</g>`;
}
/** Site d'une toxine : base en (x, y), vers l'extérieur dans la direction ang. 'rond' : tige + bout rond ; 'carre' : comme l'antigène carré. */
function siteTox(kind, x, y, ang, col) {
  const p = kind === 'rond' ? 'M-5,1 L-5,-5 A7,7 0 1 1 5,-5 L5,1Z' : 'M-6,1 L-6,-11 L6,-11 L6,1Z';
  return `<path d="${p}" fill="${col}" stroke="#0004" stroke-width="1" transform="translate(${f(x)},${f(y)}) rotate(${f(ang + 90)})"/>`;
}
/** Toxine : petite molécule à quatre sites. kind : 'tetanique' (sites ronds) ou 'diphterique' (sites carrés). inactive : grisée (rendue inoffensive). */
function toxine(x, y, kind = 'tetanique', rot = 0, s = 1, op = 1, inactive = false) {
  const tet = kind === 'tetanique', F = inactive ? '#E6E6E6' : (tet ? CB.ttF : CB.tdF), S = inactive ? '#8F8F8F' : (tet ? CB.ttS : CB.tdS);
  let a = '';
  for (let i = 0; i < 4; i++) { const an = rot + 45 + 90 * i, [c, si] = dir(an); a += siteTox(tet ? 'rond' : 'carre', 23 * c, 23 * si, an, S); }
  let d = '';
  for (let i = 0; i <= 40; i++) { const an = i / 40 * 2 * Math.PI, rr = 24 * (1 + .1 * Math.cos(4 * an + rot * D)); d += (i ? 'L' : 'M') + f(rr * Math.cos(an)) + ',' + f(rr * Math.sin(an)); }
  return `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">${a}<path d="${d}Z" fill="${F}" stroke="${S}" stroke-width="3"/></g>`;
}
/** Position d'un anticorps (bras droit) fixé sur le site i d'une toxine : bouts ronds dans les creux ronds. */
function bindTox(tx, ty, trot, ts, i, as) {
  const th = trot + 45 + 90 * i, [ux, uy] = dir(th), R = 36 * ts;
  const Tx = tx + R * ux, Ty = ty + R * uy;
  return { x: Tx + 31 * as * ux, y: Ty + 31 * as * uy, r: th + 235 };
}
/** Souris de profil, tournée vers la droite. etat : 'vit' ou 'morte' (couchée sur le dos). */
function souris(x, y, s = 1, etat = 'vit', op = 1) {
  const m = etat === 'morte';
  const corps = `<path d="M-60,10 C-95,8 -110,30 -128,18" fill="none" stroke="${CB.sourisS}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="62" ry="34" fill="${CB.sourisF}" stroke="${CB.sourisS}" stroke-width="3.5"/>
    <path d="M48,-16 L98,4 L48,24 Z" fill="${CB.sourisF}" stroke="${CB.sourisS}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="50" cy="-28" r="15" fill="#F2C9D2" stroke="${CB.sourisS}" stroke-width="3.5"/>
    <circle cx="98" cy="4" r="5" fill="#D9798F"/>
    ${m ? `<path d="M62,-8 l12,12 M74,-8 l-12,12" stroke="#333" stroke-width="3.5" stroke-linecap="round"/>` : `<circle cx="68" cy="-3" r="5" fill="#222"/>`}
    <path d="M-28,32 l-5,14 M28,32 l5,14" stroke="${CB.sourisS}" stroke-width="4" stroke-linecap="round"/>`;
  return `<g transform="translate(${f(x)},${f(y)}) scale(${s})${m ? ' rotate(180)' : ''}" opacity="${op}">${corps}</g>`;
}
/** Lapin assis, tourné vers la droite. */
function lapin(x, y, s = 1, op = 1) {
  return `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}" fill="${CB.lapinF}" stroke="${CB.lapinS}" stroke-width="4" stroke-linejoin="round">
    <ellipse cx="-10" cy="10" rx="78" ry="58"/><circle cx="-88" cy="0" r="16"/>
    <ellipse cx="58" cy="-40" rx="40" ry="34"/>
    <ellipse cx="38" cy="-110" rx="12" ry="46" transform="rotate(-12 38 -110)"/><ellipse cx="66" cy="-108" rx="12" ry="44" transform="rotate(10 66 -108)"/>
    <ellipse cx="16" cy="64" rx="38" ry="12"/>
    <circle cx="74" cy="-46" r="5" fill="#222" stroke="none"/><circle cx="97" cy="-32" r="5" fill="#C77B8B" stroke="none"/></g>`;
}
