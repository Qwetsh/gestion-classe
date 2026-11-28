/* Banque de dessins — chenilles processionnaires, arbres, climat (5e S2 « Climat, biodiversité et
   activités humaines ») : chenille qui rampe, procession le long d'un chemin, nid de soie, pin et
   chêne, touffe d'aiguilles, thermomètre gradué avec seuils, jauge, ciel de nuit et lune, camion,
   secteurs d'une roue des mois, carte schématique du nord-est de la France (vraies coordonnées).
   Tout est dans l'objet CHEN (pas de nom global qui puisse gêner une autre banque). */
const CHEN = (() => {
  const COUL = {
    corps: '#7A5A3E', corpsF: '#5E4430', poil: '#E0A458', poilP: '#F6DDB5', tete: '#2B2118',
    gel: '#9FB2C6', gelF: '#7C90A6', soie: '#FBFBF8', soieS: '#C9C4B8',
    tronc: '#7B5636', troncF: '#5E3F26', aiguille: '#2F6B3F', aiguilleC: '#4E8F5A',
    feuille: '#6E9F3A', feuilleF: '#4F7A2A',
    pin: '#1F7A4D', chene: '#B7650B', front: '#9C5300', zone: '#FBE9D7',
    froid: '#2C6FB7', chaud: '#D9381E', mort: '#C00000', encre: '#1F2328', bleu: '#1F4E79',
  };

  const defs = () => `<defs>
    <radialGradient id="ch-soie" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F3F1EA"/><stop offset="1" stop-color="#DAD5C8"/></radialGradient>
    <radialGradient id="ch-lune" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#FFFBE8"/><stop offset="1" stop-color="#E9DFB4"/></radialGradient>
    <pattern id="ch-hach" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="${COUL.zone}"/><line x1="0" y1="0" x2="0" y2="14" stroke="${COUL.front}" stroke-width="3" opacity=".5"/></pattern>
    <marker id="ch-fl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COUL.front}"/></marker>
    <marker id="ch-flN" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COUL.encre}"/></marker>
  </defs>`;

  // ------------------------------------------------------------------ chenille
  /** Une chenille, tête en (x, y), tournée vers ang (degrés). ph fait onduler le corps (ramper).
      opts.gel : chenille gelée (gris bleuté) ; opts.op : opacité. */
  function chenille(x, y, ang = 0, s = 1, ph = 0, opts = {}) {
    const n = 8, pas = 7.2, gel = opts.gel || 0;
    const mix = (a, b) => (gel > 0 ? mixc(a, b, gel) : a);
    const corps = mix(COUL.corps, COUL.gel), poil = mix(COUL.poil, '#D7E2EC'), tete = mix(COUL.tete, COUL.gelF);
    let h = '';
    for (let i = n; i >= 1; i--) {
      const cx = -i * pas, cy = Math.sin(ph - i * 0.85) * 2.2 * (1 - gel);
      const r = i === n ? 5.2 : 6.6;
      for (let k = -2; k <= 2; k++) {
        const a = (-90 + k * 32) * D, L = 8 + (k === 0 ? 3 : 0);
        h += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + L * Math.cos(a) * .8)}" y2="${f(cy + L * Math.sin(a))}" stroke="${poil}" stroke-width="1.6" stroke-linecap="round"/>`;
      }
      h += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${corps}"/>`;
      h += `<circle cx="${f(cx)}" cy="${f(cy - 3.2)}" r="2.3" fill="${mix(COUL.poil, '#E8EEF4')}"/>`;
    }
    h += `<circle cx="0" cy="${f(Math.sin(ph) * 2.2 * (1 - gel))}" r="6.2" fill="${tete}"/>`;
    return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(ang)}) scale(${f(s * 100) / 100})" opacity="${opts.op ?? 1}">${h}</g>`;
  }
  function mixc(a, b, p) {
    const A = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16)), B = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16));
    return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p)))).join(',') + ')';
  }

  /** Longueur d'un chemin (liste de points [x, y]). */
  function longueur(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  /** Le point à la distance d du début du chemin, et la direction (degrés). */
  function surChemin(pts, d) {
    d = Math.max(0, d);
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], l = Math.hypot(x2 - x1, y2 - y1);
      if (d <= l || i === pts.length - 1) {
        const p = l ? Math.min(1, d / l) : 0;
        return { x: lerp(x1, x2, p), y: lerp(y1, y2, p), a: Math.atan2(y2 - y1, x2 - x1) / D };
      }
      d -= l;
    }
    return { x: pts[0][0], y: pts[0][1], a: 0 };
  }
  /** Une procession : n chenilles à la queue leu leu, la tête de la première à la distance `tete`
      du début du chemin. Celles qui ne sont pas encore sorties (d < 0) ne sont pas dessinées. */
  function procession(pts, n, tete, ecart = 70, s = 1, ph = 0, opts = {}) {
    const L = longueur(pts);
    let h = '';
    for (let i = n - 1; i >= 0; i--) {
      const d = tete - i * ecart;
      if (d < 0 || d > L) continue;
      const p = surChemin(pts, d);
      h += chenille(p.x, p.y, p.a, s, ph + i * 1.3, opts);
    }
    return h;
  }

  // ------------------------------------------------------------------ nid, arbres
  /** Nid de soie (poche blanche) accroché en (x, y) au bout d'une branche ; s : taille.
      opts.givre (0 → 1) : nid couvert de givre ; opts.sombre : nid éteint (colonie morte). */
  function nid(x, y, s = 1, opts = {}) {
    const g = opts.givre || 0;
    let h = `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${opts.op ?? 1}">`;
    h += `<path d="M0,-58 C34,-50 52,-12 44,22 C38,50 14,66 -4,64 C-30,62 -48,40 -46,8 C-44,-26 -26,-54 0,-58Z" fill="url(#ch-soie)" stroke="${COUL.soieS}" stroke-width="2.5"/>`;
    for (const [a, b] of [[-34, 18], [-20, 40], [-40, -6], [28, -20], [36, 14], [10, 50]]) {
      h += `<path d="M${a},${b} q${f(-a * .3)},${f(-20 - b * .2)} ${f(-a * .9)},${f(-30 - b * .5)}" fill="none" stroke="#D9D4C7" stroke-width="1.6" opacity=".9"/>`;
    }
    h += `<path d="M-30,-30 L36,40 M-40,10 L20,-46 M-10,60 L40,-20" stroke="#E7E3D9" stroke-width="1.2" opacity=".8"/>`;
    if (opts.sombre) h += `<path d="M0,-58 C34,-50 52,-12 44,22 C38,50 14,66 -4,64 C-30,62 -48,40 -46,8 C-44,-26 -26,-54 0,-58Z" fill="#5B6573" opacity="${f(.45 * opts.sombre)}"/>`;
    if (g > 0) {
      h += `<path d="M0,-58 C34,-50 52,-12 44,22 C38,50 14,66 -4,64 C-30,62 -48,40 -46,8 C-44,-26 -26,-54 0,-58Z" fill="#DCEBFA" opacity="${f(.55 * g)}"/>`;
      const R = rng(7);
      for (let i = 0; i < 26; i++) { const a = R() * 360, r = 30 + R() * 22, [c, si] = dir(a); h += `<circle cx="${f(r * c)}" cy="${f(r * si * 1.15)}" r="${f(1.5 + R() * 2)}" fill="#fff" opacity="${f(g)}"/>`; }
    }
    return h + '</g>';
  }
  /** Une touffe d'aiguilles de pin en (x, y), orientée vers ang ; reste (0 → 1) : part non mangée. */
  function touffe(x, y, ang = -90, r = 34, reste = 1, givre = 0, op = 1) {
    if (reste <= 0.02) return '';
    let h = '';
    const n = 9, col = givre > 0 ? mixc(COUL.aiguille, '#B9D0E6', givre * .7) : COUL.aiguille;
    for (let i = 0; i < n; i++) {
      const a = (ang - 55 + 110 * i / (n - 1)) * D, L = r * (0.75 + 0.25 * Math.sin(i * 2.1)) * reste;
      h += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + L * Math.cos(a))}" y2="${f(y + L * Math.sin(a))}" stroke="${i % 2 ? col : (givre > 0 ? col : COUL.aiguilleC)}" stroke-width="2.6" stroke-linecap="round"/>`;
      if (givre > .3) h += `<circle cx="${f(x + L * Math.cos(a))}" cy="${f(y + L * Math.sin(a))}" r="2" fill="#fff" opacity="${f(givre)}"/>`;
    }
    return `<g opacity="${op}">${h}</g>`;
  }
  /** Une branche (trait épais qui s'affine). */
  function branche(x1, y1, x2, y2, e = 10, col = COUL.tronc) {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
    return `<path d="M${f(x1 + nx * e / 2)},${f(y1 + ny * e / 2)} L${f(x2 + nx * e / 5)},${f(y2 + ny * e / 5)} L${f(x2 - nx * e / 5)},${f(y2 - ny * e / 5)} L${f(x1 - nx * e / 2)},${f(y1 - ny * e / 2)}Z" fill="${col}"/>`;
  }
  /** Petit pin (vignette, chargement du camion) : pied en (x, y), hauteur 100·s. */
  function pin(x, y, s = 1, op = 1) {
    let h = `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">`;
    h += `<rect x="-5" y="-34" width="10" height="34" fill="${COUL.tronc}"/>`;
    h += `<path d="M0,-100 L30,-62 L18,-62 L40,-30 L-40,-30 L-18,-62 L-30,-62Z" fill="${COUL.pin}" stroke="#165A38" stroke-width="2" stroke-linejoin="round"/>`;
    return h + '</g>';
  }
  /** Chêne : pied en (x, y), hauteur 220·s. */
  function chene(x, y, s = 1, op = 1) {
    let h = `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">`;
    h += `<path d="M-16,0 C-12,-40 -14,-80 -10,-110 L10,-110 C14,-80 12,-40 16,0Z" fill="${COUL.tronc}"/>`;
    h += branche(-4, -96, -46, -140, 10) + branche(4, -100, 46, -146, 10);
    const R = [[-58, -150, 46], [0, -178, 54], [58, -152, 46], [-30, -120, 40], [32, -118, 40], [0, -132, 44]];
    for (const [cx, cy, r] of R) h += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COUL.feuille}" stroke="${COUL.feuilleF}" stroke-width="3"/>`;
    for (const [cx, cy] of [[-40, -160], [20, -190], [50, -140], [-10, -130]]) h += `<path d="M${cx},${cy} q6,-8 12,0 q6,-8 12,0" fill="none" stroke="${COUL.feuilleF}" stroke-width="2.5" opacity=".7"/>`;
    return h + '</g>';
  }

  // ------------------------------------------------------------------ mesures
  /** Thermomètre vertical : tube de y1 (haut, tmax) à y2 (bas, tmin), réservoir dessous.
      opts.seuils : [[température, libellé, couleur]] ; opts.grad : pas des graduations ; opts.libre : texte des graduations à gauche. */
  function thermometre(x, y1, y2, temp, tmin, tmax, opts = {}) {
    const Y = (v) => y2 - (v - tmin) * (y2 - y1) / (tmax - tmin);
    const col = temp < 0 ? COUL.froid : COUL.chaud, w = opts.largeur || 26;
    let h = '';
    const pas = opts.grad || 5;
    for (let v = Math.ceil(tmin / pas) * pas; v <= tmax; v += pas) {
      h += `<line x1="${f(x - w / 2 - 14)}" y1="${f(Y(v))}" x2="${f(x - w / 2 - 2)}" y2="${f(Y(v))}" stroke="#5C6169" stroke-width="2.5"/>`;
      if (opts.libre !== false) h += txt(x - w / 2 - 20, Y(v) + 9, String(v).replace('-', '−'), 24, '#5C6169', 'end', 500);
    }
    h += `<rect x="${f(x - w / 2)}" y="${f(y1 - 16)}" width="${w}" height="${f(y2 - y1 + 34)}" rx="${w / 2}" fill="#F1F5F9" stroke="#475569" stroke-width="3"/>`;
    const yt = Y(clamp(temp, tmin - 2, tmax));
    h += `<rect x="${f(x - w / 2 + 7)}" y="${f(yt)}" width="${w - 14}" height="${f(y2 + 22 - yt)}" fill="${col}"/>`;
    h += `<circle cx="${x}" cy="${f(y2 + 34)}" r="${f(w * .95)}" fill="${col}" stroke="#475569" stroke-width="3"/>`;
    for (const [v, lib, c] of opts.seuils || []) {
      h += `<line x1="${f(x + w / 2 + 2)}" y1="${f(Y(v))}" x2="${f(x + w / 2 + 34)}" y2="${f(Y(v))}" stroke="${c}" stroke-width="4"/>`;
      if (lib) h += txt(x + w / 2 + 42, Y(v) + 9, lib, 26, c, 'start', 700);
    }
    return h;
  }
  /** Jauge horizontale remplie à p (0 → 1). */
  function jauge(x, y, w, h, p, col = '#2E9E55', fond = '#fff') {
    p = clamp(p);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fond}" stroke="#475569" stroke-width="3"/>` +
      (p > 0.01 ? `<rect x="${x + 5}" y="${y + 5}" width="${f(Math.max(h - 10, (w - 10) * p))}" height="${h - 10}" rx="${(h - 10) / 2}" fill="${col}"/>` : '');
  }

  // ------------------------------------------------------------------ ciel, nuit
  /** Fond de ciel : nuit (0 = jour, 1 = nuit), étoiles qui scintillent (t en secondes). */
  function ciel(w, hgt, nuit, t = 0, sol = '#3E4A3A') {
    const haut = mixc('#BFE0F5', '#0E1B33', nuit), bas = mixc('#E8F3FA', '#26395C', nuit);
    let h = `<defs><linearGradient id="ch-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${haut}"/><stop offset="1" stop-color="${bas}"/></linearGradient></defs>`;
    h += `<rect width="${w}" height="${hgt}" fill="url(#ch-ciel)"/>`;
    if (nuit > .3) {
      const R = rng(11);
      for (let i = 0; i < 70; i++) {
        const x = R() * w, y = R() * hgt * .75, r = .8 + R() * 1.8, sc = .55 + .45 * Math.sin(t * (1 + R() * 2) + i);
        h += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fff" opacity="${f(clamp((nuit - .3) / .5) * sc)}"/>`;
      }
    }
    return h;
  }
  function lune(x, y, r = 40, op = 1) {
    return `<g opacity="${op}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.6)}" fill="#FFF8D6" opacity=".12"/><circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="url(#ch-lune)"/>` +
      `<circle cx="${f(x - r * .3)}" cy="${f(y - r * .2)}" r="${f(r * .18)}" fill="#DDD3A6" opacity=".6"/><circle cx="${f(x + r * .25)}" cy="${f(y + r * .3)}" r="${f(r * .12)}" fill="#DDD3A6" opacity=".6"/></g>`;
  }

  // ------------------------------------------------------------------ camion
  /** Camion tourné vers la droite, avant en (x, y) au sol ; charge : nombre de petits pins sur le plateau ; roue : angle des roues. */
  function camion(x, y, s = 1, charge = 3, roue = 0, op = 1) {
    let h = `<g transform="translate(${f(x)},${f(y)}) scale(${s})" opacity="${op}">`;
    h += `<rect x="-170" y="-58" width="118" height="40" rx="4" fill="#E8D9BC" stroke="#7B5636" stroke-width="3"/>`;
    for (let i = 0; i < charge; i++) h += pin(-152 + i * 34, -56, .42);
    h += `<path d="M-48,-18 L-48,-66 L-18,-66 L0,-40 L0,-18Z" fill="#2C6FB7" stroke="#1F4E79" stroke-width="3" stroke-linejoin="round"/>`;
    h += `<path d="M-40,-60 L-21,-60 L-8,-42 L-40,-42Z" fill="#DCEEF8"/>`;
    h += `<rect x="-174" y="-20" width="178" height="8" rx="3" fill="#475569"/>`;
    for (const wx of [-140, -100, -22]) {
      h += `<g transform="translate(${wx},-8) rotate(${f(roue)})"><circle r="15" fill="#2B2B2B"/><circle r="6" fill="#B0B7C3"/><line x1="-12" y1="0" x2="12" y2="0" stroke="#666" stroke-width="2"/></g>`;
    }
    return h + '</g>';
  }

  // ------------------------------------------------------------------ roue des mois
  const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  /** Secteur d'anneau de r1 à r2, de l'angle a1 à a2 (degrés, 0 = en haut, sens des aiguilles d'une montre). */
  function secteur(cx, cy, r1, r2, a1, a2) {
    if (a2 - a1 >= 359.9) a2 = a1 + 359.9;
    const P = (r, a) => [cx + r * Math.cos((a - 90) * D), cy + r * Math.sin((a - 90) * D)];
    const g = a2 - a1 > 180 ? 1 : 0, [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1);
    return `M${f(x1)},${f(y1)} A${r2},${r2} 0 ${g} 1 ${f(x2)},${f(y2)} L${f(x3)},${f(y3)} A${r1},${r1} 0 ${g} 0 ${f(x4)},${f(y4)}Z`;
  }
  /** Point de la roue au rayon r et à l'angle a (même convention que `secteur`). */
  const roueP = (cx, cy, r, a) => [cx + r * Math.cos((a - 90) * D), cy + r * Math.sin((a - 90) * D)];

  // ------------------------------------------------------------------ carte du nord-est de la France
  /** Villes (latitude, longitude réelles, en degrés décimaux). */
  const VILLES = {
    Paris: [48.857, 2.352], Reims: [49.258, 4.032], Troyes: [48.297, 4.074], 'Châlons': [48.957, 4.363],
    Metz: [49.119, 6.176], Nancy: [48.692, 6.184], Strasbourg: [48.573, 7.752], Obernai: [48.462, 7.482],
    'Orléans': [47.903, 1.909], Dijon: [47.322, 5.041],
  };
  /** Projection simple (plate, échelle conservée à la latitude moyenne) : P([lat, lon]) → [x, y]. */
  function projection(lon0, lat0, k, x0 = 0, y0 = 0, latMoy = 48.6) {
    const c = Math.cos(latMoy * D);
    const P = ([lat, lon]) => [x0 + (lon - lon0) * c * k, y0 + (lat0 - lat) * k];
    P.km = k / 111.2;              // pixels par kilomètre
    return P;
  }
  /** Polyligne de points [lat, lon] projetés. */
  const trace = (pts, P) => pts.map((p) => P(p).map(f).join(',')).join(' ');
  /** Interpolation point à point entre deux tracés de même longueur. */
  const entre = (A, B, p) => A.map((a, i) => [lerp(a[0], B[i][0], p), lerp(a[1], B[i][1], p)]);
  /** Une ville : point et nom. */
  function ville(P, nom, dx = 12, dy = -12, anc = 'start', opts = {}) {
    const [x, y] = P(VILLES[nom]), col = opts.col || COUL.encre, r = opts.r || 7;
    return (opts.halo ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(opts.halo)}" fill="${col}" opacity=".18"/>` : '') +
      `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${col}" stroke="#fff" stroke-width="3"/>` +
      txt(x + dx, y + dy, opts.label || nom, opts.taille || 26, col, anc, opts.poids || 500, opts.op ?? 1);
  }

  return { COUL, defs, chenille, procession, surChemin, longueur, nid, touffe, branche, pin, chene, thermometre, jauge,
    ciel, lune, camion, MOIS, secteur, roueP, VILLES, projection, trace, entre, ville, mixc };
})();
