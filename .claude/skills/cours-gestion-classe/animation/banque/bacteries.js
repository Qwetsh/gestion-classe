/* Banque de dessins — bactéries et antibiogramme (cycle 4) : bactérie en bâtonnet, boîte de Petri,
   gélose à tapis de bactéries, pastille, halo de diffusion, règle graduée.
   Choix : une bactérie sensible est bleue, une résistante rouge ; les tailles ne sont pas à l'échelle. */
const BA = { sens: '#3D7FD1', sensS: '#1F4E79', res: '#D64545', resS: '#8E1F1F', gel: '#F3E6C4', gelS: '#C9B27A',
  lawn: '#D9C48E', petriS: '#8FA3B8', pastille: '#FFFFFF', pastilleS: '#7A8794', chou: '#8A5BB5', chouS: '#5E3A85',
  rose: '#E2508C', microbio: ['#3D7FD1', '#2E9E55', '#E0A21B', '#8A5BB5', '#1BA3A3'] };

/** Bactérie en bâtonnet centrée en (x, y), angle rot (degrés), échelle s ; col = remplissage. */
function bacterie(x, y, rot = 0, s = 1, col = BA.sens, op = 1, trait = null) {
  const S = trait || (col === BA.res ? BA.resS : '#0005');
  return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(rot)}) scale(${f(s)})" opacity="${f(op)}">
    <rect x="-22" y="-9" width="44" height="18" rx="9" fill="${col}" stroke="${S}" stroke-width="2.5"/>
    <path d="M-12,-2 q6,-5 12,0 t12,0" fill="none" stroke="#fff" stroke-width="2" opacity=".45"/></g>`;
}

/** Boîte de Petri vue de dessus, centre (x, y), rayon r ; fond = couleur de la gélose. */
function boite(x, y, r, fond = BA.gel) {
  return `<circle cx="${x}" cy="${y}" r="${r + 10}" fill="#EEF3F8" stroke="${BA.petriS}" stroke-width="4"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${fond}" stroke="${BA.gelS}" stroke-width="2"/>`;
}

/** Tapis de bactéries (points serrés) dans la boîte, sauf dans les disques `trous` [{x, y, r}]. */
function tapis(x, y, r, trous = [], op = 1, seed = 11) {
  const R = rng(seed); let h = `<g opacity="${f(op)}">`;
  for (let i = 0; i < 1400; i++) {
    const a = R() * 2 * Math.PI, d = Math.sqrt(R()) * (r - 8), px = x + d * Math.cos(a), py = y + d * Math.sin(a);
    if (trous.some((t) => Math.hypot(px - t.x, py - t.y) < t.r)) continue;
    h += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(2.6 + R() * 2)}" fill="#A88A44" opacity=".8"/>`;
  }
  return h + '</g>';
}

/** Pastille de papier, lettre au centre. */
function pastille(x, y, lettre, s = 1, op = 1) {
  return `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})" opacity="${f(op)}"><circle r="16" fill="${BA.pastille}" stroke="${BA.pastilleS}" stroke-width="2.5"/>
    <text y="8" font-size="22" font-weight="700" text-anchor="middle" fill="#1d2433">${lettre}</text></g>`;
}

/** Halo de diffusion : dégradé radial de la couleur col, rayon r, opacité op (identifiant unique id). */
function halo(id, x, y, r, col, op = 1) {
  if (r <= 1) return '';
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${f(.85 * op)}"/>
    <stop offset=".75" stop-color="${col}" stop-opacity="${f(.45 * op)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${id})"/>`;
}

/** Zone nette (après lecture) : disque de couleur col, bord marqué. */
function zone(x, y, r, col, op = 1, trait = '#0004') {
  if (r <= 1) return '';
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${col}" opacity="${f(op)}" stroke="${trait}" stroke-width="2"/>`;
}

/** Règle graduée horizontale de longueur L (px) commençant en (x, y) ; mm = px par millimètre. */
function regle(x, y, L, mm, op = 1) {
  let h = `<g opacity="${f(op)}"><rect x="${f(x)}" y="${f(y)}" width="${f(L)}" height="44" rx="4" fill="#FFF8DC" stroke="#9C8A4A" stroke-width="2"/>`;
  for (let k = 0; k * mm <= L - 2; k++) {
    const gx = x + k * mm, g = k % 10 === 0 ? 20 : k % 5 === 0 ? 14 : 8;
    h += `<line x1="${f(gx)}" y1="${f(y)}" x2="${f(gx)}" y2="${f(y + g)}" stroke="#5C4A00" stroke-width="1.5"/>`;
    if (k % 10 === 0) h += `<text x="${f(gx)}" y="${f(y + 38)}" font-size="13" text-anchor="middle" fill="#5C4A00">${k / 10}</text>`;
  }
  return h + '</g>';
}
