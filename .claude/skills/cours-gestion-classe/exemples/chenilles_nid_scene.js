/* Animation B — « Une nuit d'hiver dans le nid » (5e S2 A1, correction de la question 2).
   Un pin la nuit, un nid de soie au bout d'une branche, le thermomètre de l'air. À 3 °C les chenilles
   sortent en procession et mangent les aiguilles (les réserves montent) ; à −4 °C elles restent au nid
   (les réserves baissent nuit après nuit) ; à −17 °C la colonie meurt (seuil de −16 °C).
   Dessins : animation/banque/chenilles.js. Scène 1600 x 570 (cadre posé au-dessus de y = 450). */
(() => {
  const K = CHEN.COUL;
  const NID = [575, 150];
  /** Texte clair sur fond de nuit (liseré sombre). */
  const ltx = (x, y, s, size = 28, col = '#F6F1E3', anchor = 'start', w = 700, op = 1) =>
    `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${col}" text-anchor="${anchor}" font-weight="${w}" opacity="${f(op)}" paint-order="stroke" stroke="#0E1B33" stroke-width="6" stroke-linejoin="round">${s}</text>`;
  const rappel = (x1, y1, x2, y2, op, col = '#F6F1E3') => op > 0 ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3" opacity="${f(op)}"/>` : '';

  // Le pin : branches [x1, y1, x2, y2, épaisseur] et touffes [x, y, angle, rayon]
  const BRANCHES = [[334, 232, 548, 160, 13], [336, 330, 660, 300, 13], [334, 180, 170, 120, 10], [332, 280, 130, 250, 11],
    [331, 470, 150, 450, 12], [333, 450, 520, 430, 12], [336, 120, 450, 90, 8]];
  const TOUFFES = [[612, 122, -40, 36], [622, 160, 10, 34], [170, 120, -150, 38], [220, 140, -110, 30], [130, 250, 180, 38],
    [200, 262, -100, 30], [250, 268, 100, 28], [150, 450, 180, 38], [220, 458, -100, 30], [520, 430, 0, 36], [450, 440, -90, 30],
    [338, 60, -90, 40], [318, 90, -140, 32], [358, 90, -40, 32], [450, 90, -30, 34], [400, 104, -100, 26]];
  // Touffes de la branche où les chenilles mangent (dessous et bout) : [x, y, angle, rayon, distance sur le chemin]
  const REPAS = [[420, 322, 100, 30], [480, 317, 80, 32], [540, 311, 100, 32], [600, 305, 80, 32], [662, 300, 10, 36],
    [450, 318, -80, 26], [570, 307, -80, 26], [630, 302, -70, 28]];
  const CHEMIN = [[546, 172], [352, 224], [350, 318], [655, 290]];
  const LCH = CHEN.longueur(CHEMIN);
  const dRepas = (x) => LCH - (655 - x);         // distance, sur le chemin, du point de la branche d'abscisse x
  const DEDANS = [[600, 122, 0], [552, 140, 180], [602, 160, 0], [553, 178, 180], [596, 194, 0]];

  function decor(nuit, t, opts = {}) {
    let h = CHEN.defs() + CHEN.ciel(1600, 570, nuit, t);
    const ln = opts.lune;
    if (ln) h += CHEN.lune(ln[0], ln[1], 38, ln[2] ?? 1);
    const g = opts.givre || 0;
    h += `<path d="M0,520 Q400,488 800,514 T1600,504 L1600,570 L0,570Z" fill="${CHEN.mixc('#6E8B5A', '#1C2A22', nuit)}"/>`;
    if (g > 0) h += `<path d="M0,520 Q400,488 800,514 T1600,504 L1600,512 Q1200,520 800,522 T0,528Z" fill="#E6F0FA" opacity="${f(g * .8)}"/>`;
    h += CHEN.branche(330, 560, 338, 56, 30, K.troncF);
    for (const [x1, y1, x2, y2, e] of BRANCHES) h += CHEN.branche(x1, y1, x2, y2, e, K.troncF);
    for (const [x, y, a, r] of TOUFFES) h += CHEN.touffe(x, y, a, r, 1, g);
    const mange = opts.mange || (() => 0);
    REPAS.forEach(([x, y, a, r]) => { h += CHEN.touffe(x, y, a, r, 1 - mange(x), g); });
    return h;
  }
  /** Le nid, avec les chenilles qu'on devine à l'intérieur (n au plus 5). */
  function nidPlein(n, ph, opts = {}) {
    let h = CHEN.nid(NID[0], NID[1], .9, opts);
    for (let i = 0; i < Math.min(n, DEDANS.length); i++) {
      const [x, y, a] = DEDANS[i];
      h += CHEN.chenille(x, y, a, .5, ph + i, { op: .8, gel: opts.gel || 0 });
    }
    h += `<path transform="translate(${NID[0]},${NID[1]}) scale(.9)" d="M0,-58 C34,-50 52,-12 44,22 C38,50 14,66 -4,64 C-30,62 -48,40 -46,8 C-44,-26 -26,-54 0,-58Z" fill="#fff" opacity=".28"/>`;
    return h;
  }
  function thermo(temp, op = 1, alerte = 0) {
    const col = temp < 0 ? K.froid : K.chaud;
    let h = `<g opacity="${f(op)}"><rect x="960" y="14" width="250" height="540" rx="20" fill="#fff" opacity=".93"/>`;
    h += txt(1085, 58, 'air : ' + String(Math.round(temp)).replace('-', '−') + ' °C', 36, col, 'middle', 700);
    if (alerte > 0) h += `<rect x="1088" y="${f(430 - (-16 + 20) * 11 - 22)}" width="116" height="44" rx="10" fill="#C00000" opacity="${f(.18 * alerte)}"/>`;
    h += CHEN.thermometre(1045, 100, 430, temp, -20, 10, { seuils: [[0, '0 °C', K.froid], [-16, '−16 °C', K.mort]] });
    return h + '</g>';
  }
  function reserves(p, op = 1, nuits = 0) {
    if (op <= 0) return '';
    const col = p > .45 ? '#2E9E55' : p > .2 ? '#E07B00' : '#C00000';
    let h = `<g opacity="${f(op)}"><rect x="1225" y="150" width="360" height="160" rx="20" fill="#fff" opacity=".93"/>`;
    h += txt(1245, 200, 'réserves de la colonie', 28, K.encre, 'start', 700);
    h += CHEN.jauge(1245, 225, 320, 50, p, col);
    h += '</g>';
    if (nuits > 0) {
      h += `<g><rect x="1225" y="340" width="360" height="120" rx="20" fill="#fff" opacity=".93"/>` + txt(1405, 385, 'nuits froides : ' + nuits, 30, K.froid, 'middle', 700);
      for (let i = 0; i < nuits; i++) h += `<circle cx="${1290 + i * 58}" cy="${425}" r="14" fill="#E9DFB4" stroke="#8C8060" stroke-width="2"/>`;
      h += '</g>';
    }
    return h;
  }

  GC.play({
    nid: { dur: 7, draw(t) {
      const nuit = seg(t, 0, 3);
      let h = decor(nuit, t, { lune: [830, lerp(250, 90, seg(t, 0, 3.5)), seg(t, .5, 2)] });
      h += nidPlein(5, t * 3);
      h += rappel(612, 180, 640, 226, seg(t, 2.4, 3)) + ltx(645, 236, 'nid de soie', 32, '#F6F1E3', 'start', 700, seg(t, 2.4, 3));
      h += ltx(250, 545, 'pin', 32, '#F6F1E3', 'middle', 700, seg(t, 3.2, 3.8));
      h += thermo(5, seg(t, 4, 5));
      h += reserves(.6, seg(t, 5, 6));
      return h;
    } },

    sortie: { dur: 10, draw(t) {
      const tete = lerp(-20, LCH, seg(t, .8, 8)), n = 7, ecart = 66;
      const mange = (x) => .8 * clamp((tete - dRepas(x) + 30) / 220);
      let h = decor(1, t, { lune: [830, 90], mange });
      let dedans = 0; for (let i = 0; i < n; i++) if (tete - i * ecart < 0) dedans++;
      h += nidPlein(dedans, t * 3);
      h += CHEN.procession(CHEMIN, n, tete, ecart, 1.05, t * 9);
      h += ltx(510, 392, 'elles mangent les aiguilles', 30, '#F6F1E3', 'middle', 700, seg(t, 6.5, 7.3));
      h += thermo(lerp(5, 3, seg(t, 0, 1)));
      h += reserves(lerp(.6, .9, seg(t, 5, 9.5)));
      return h;
    } },

    reste: { dur: 10, draw(t) {
      const u = Math.max(0, (t - 2) / 1.6), nuits = t < 2 ? 0 : Math.min(5, Math.floor(u) + 1), fr = t < 2 ? 0 : (nuits === 5 ? Math.min(1, u - 4) : u - Math.floor(u));
      const lune = t < 2 ? [830, 90] : [lerp(560, 860, fr), 120 - 50 * Math.sin(Math.PI * fr), .35 + .65 * Math.sin(Math.PI * clamp(fr))];
      let h = decor(1, t, { lune, givre: seg(t, 1.2, 2.8) });
      h += nidPlein(5, t * 1.5, { givre: .5 * seg(t, 1.2, 2.8) });
      h += rappel(612, 180, 640, 226, seg(t, 2, 2.6)) + ltx(645, 236, 'elles restent au nid', 30, '#F6F1E3', 'start', 700, seg(t, 2, 2.6));
      h += ltx(645, 276, 'sans manger', 30, '#9CC9F5', 'start', 700, seg(t, 2.8, 3.4));
      h += thermo(lerp(3, -4, seg(t, .3, 1.8)));
      h += reserves(lerp(.9, .25, seg(t, 2, 9.6)), 1, nuits);
      return h;
    } },

    mort: { dur: 9, draw(t) {
      const temp = lerp(-4, -17, seg(t, .3, 3)), mort = seg(t, 3, 4.5);
      let h = decor(1, t, { lune: [830, 90], givre: 1 });
      h += nidPlein(5, 0, { givre: 1, sombre: mort, gel: mort });
      h += rappel(612, 180, 640, 226, seg(t, 4, 4.6), '#FFB3B3') + ltx(645, 236, 'la colonie meurt', 32, '#FFB3B3', 'start', 700, seg(t, 4, 4.6));
      h += thermo(temp, 1, temp < -15.9 ? .6 + .4 * Math.sin(t * 6) : 0);
      h += reserves(lerp(.25, 0, seg(t, .5, 3)), 1);
      const o = seg(t, 5.6, 6.4);
      if (o > 0) h += `<g opacity="${f(o)}"><rect x="30" y="468" width="860" height="80" rx="18" fill="#fff" stroke="#C00000" stroke-width="4"/>` +
        `<text x="460" y="522" font-size="38" font-weight="700" fill="#C00000" text-anchor="middle">le froid de l’hiver = facteur limitant</text></g>`;
      return h;
    } },
  });
})();
