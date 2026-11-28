/* Animation A — « Le front qui remonte » (5e S2 A1, correction de la question 4 et bilan).
   Carte schématique du nord-est de la France (vraies coordonnées des villes, comme la carte de la
   feuille de documents). Le front d'expansion de la processionnaire du pin : 1972 au sud de Paris,
   2004 (+ 87 km, 2,7 km par an, hivers + 1,1 °C), aujourd'hui (5,5 km par an depuis 2000) dans l'Aube
   et le sud de la Marne (FREDON Grand Est, 2021), foyer isolé d'Obernai (transport par l'humain),
   environ 125 km jusqu'à Metz. Les tracés de 1972 et 2004 sont schématiques.
   Dessins : animation/banque/chenilles.js. Scène 1600 x 570 (cadre posé au-dessus de y = 450). */
(() => {
  const K = CHEN.COUL;
  const P = CHEN.projection(1.3, 49.6, 215);                  // carte de x = 0 à 960 (latitudes 46,95 à 49,6)
  const MAP_W = 960, PX = 1000;                              // PX : début du panneau de droite
  // Le front (latitude, longitude), d'ouest en est puis vers le sud ; même nombre de points
  const F1972 = [[47.49, 1.0], [47.43, 2.9], [47.36, 3.35], [47.27, 3.7], [47.14, 3.92], [46.95, 4.05], [46.75, 4.1], [46.55, 4.15], [46.35, 4.2]];
  const F2004 = [[48.27, 1.0], [48.21, 2.9], [48.13, 3.5], [48.0, 4.05], [47.8, 4.4], [47.5, 4.6], [47.15, 4.7], [46.85, 4.75], [46.55, 4.8]];
  const F2021 = [[49.12, 1.0], [49.05, 2.9], [48.95, 3.6], [48.8, 4.3], [48.6, 4.75], [48.25, 5.0], [47.85, 5.15], [47.3, 5.25], [46.9, 5.3]];
  const FRONT_METZ = [48.673, 4.585];                         // point du front d'aujourd'hui le plus proche de Metz
  const OBERNAI = CHEN.VILLES.Obernai;
  const ROUTE = [[48.64, 4.62], [48.71, 5.4], [48.71, 6.18], [48.6, 6.75], [48.40, 7.2]];
  const nombre = (x) => String(x).replace('.', ',');

  /** Le front et sa zone, pour un tracé donné (liste de [lat, lon]). */
  function zone(F, op = 1) {
    const pts = [...F, [46.0, F[F.length - 1][1]], [46.0, 0.5], [F[0][0], 0.5]];
    return `<polygon clip-path="url(#ch-carte)" points="${CHEN.trace(pts, P)}" fill="url(#ch-hach)" opacity="${f(op)}"/>`;
  }
  function ligne(F, op = 1, tirets = false, trace = 1) {
    const L = 1600;
    return `<polyline clip-path="url(#ch-carte)" points="${CHEN.trace(F, P)}" fill="none" stroke="${K.front}" stroke-width="${tirets ? 3.5 : 7}" stroke-linecap="round" stroke-linejoin="round" opacity="${f(op)}"` +
      (tirets ? ' stroke-dasharray="12 10"' : ` stroke-dasharray="${L}" stroke-dashoffset="${f(L * (1 - trace))}"`) + '/>';
  }
  /** Flèches qui partent du front vers l'extérieur et avancent en boucle (le front progresse). */
  function poussees(F, t, op = 1) {
    if (op <= 0) return '';
    let h = '';
    for (const i of [1, 2, 3, 5, 6]) {
      const a = P(F[i]), b = P(F[i + 1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      const u = (t * .7 + i * .37) % 1, d0 = 6 + 22 * u;
      if (m[1] > 560 || m[1] < 10) continue;
      h += `<line x1="${f(m[0] + nx * d0)}" y1="${f(m[1] + ny * d0)}" x2="${f(m[0] + nx * (d0 + 34))}" y2="${f(m[1] + ny * (d0 + 34))}" stroke="${K.front}" stroke-width="5" marker-end="url(#ch-fl)" opacity="${f(op * Math.sin(Math.PI * u))}"/>`;
    }
    return h;
  }
  /** Les nids : des points fixes qui apparaissent quand le front les a dépassés. */
  const NIDS = (() => { const R = rng(5), L = []; for (let i = 0; i < 70; i++) L.push([47.2 + R() * 2.4, 1.1 + R() * 5]); return L; })();
  function dedans(F, [lat, lon]) {
    // au sud-ouest du front : latitude sous le front à cette longitude, et longitude à l'ouest du front à cette latitude
    for (let i = 1; i < F.length; i++) {
      const [la1, lo1] = F[i - 1], [la2, lo2] = F[i];
      if (lon >= Math.min(lo1, lo2) && lon <= Math.max(lo1, lo2) && lo1 !== lo2) {
        const la = la1 + (la2 - la1) * (lon - lo1) / (lo2 - lo1);
        if (lat > la) return false;
      }
    }
    return lon < F[F.length - 1][1] && lat < F[0][0] + .1;
  }
  function nids(F, op = 1) {
    let h = '';
    for (const p of NIDS) if (dedans(F, p)) { const [x, y] = P(p); h += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="5" ry="7" fill="#fff" stroke="${K.front}" stroke-width="1.5" opacity="${f(op)}"/>`; }
    return h;
  }

  function fondCarte(op = 1) {
    let h = CHEN.defs() + `<defs><clipPath id="ch-carte"><rect x="0" y="0" width="${MAP_W}" height="570"/></clipPath></defs>`;
    h += `<rect width="1600" height="570" fill="#FFFFFF"/>`;
    h += `<rect x="0" y="0" width="${MAP_W}" height="570" fill="#FBFAF7" opacity="${f(op)}"/>`;
    h += `<line x1="${MAP_W}" y1="0" x2="${MAP_W}" y2="570" stroke="#E2DFD8" stroke-width="3"/>`;
    return h;
  }
  function villes(op = 1, opts = {}) {
    const V = CHEN.ville;
    let h = `<g opacity="${f(op)}">`;
    h += V(P, 'Paris', -14, -14, 'end', { taille: 28, poids: 700 });
    h += V(P, 'Orléans', 14, -12, 'start');
    h += V(P, 'Reims', 14, -10, 'start');
    h += V(P, 'Châlons', -14, -10, 'end');
    h += V(P, 'Troyes', 14, 26, 'start');
    h += V(P, 'Nancy', -14, 9, 'end');
    h += V(P, 'Strasbourg', -14, -16, 'end');
    h += V(P, 'Metz', 16, -12, 'start', { col: K.bleu, r: 10, taille: 30, poids: 700, label: 'Metz (Woippy)', halo: opts.metz || 0 });
    h += txt(P([48.93, 6.55])[0], P([48.93, 6.55])[1], 'Lorraine', 30, K.bleu, 'start', 500, opts.lorraine ?? .8).replace('<text ', '<text font-style="italic" ');
    // légende
    h += `<rect x="12" y="12" width="330" height="46" rx="10" fill="#fff" opacity=".92"/><rect x="22" y="22" width="34" height="26" fill="url(#ch-hach)" stroke="${K.front}" stroke-width="2"/>` +
      txt(68, 44, 'chenille du pin installée', 24, K.encre, 'start', 500);
    // échelle et nord
    const k100 = 100 * P.km, ex = MAP_W - 30 - k100, ey = 548;
    h += `<line x1="${f(ex)}" y1="${ey}" x2="${f(ex + k100)}" y2="${ey}" stroke="${K.encre}" stroke-width="4"/>` +
      [ex, ex + k100].map((x) => `<line x1="${f(x)}" y1="${ey - 8}" x2="${f(x)}" y2="${ey + 8}" stroke="${K.encre}" stroke-width="3"/>`).join('') +
      txt(ex + k100 / 2, ey - 14, '100 km', 24, K.encre, 'middle', 500);
    const nx = MAP_W - 30, ny = 470;
    h += `<path d="M${nx},${ny - 30} L${nx + 12},${ny + 8} L${nx},${ny} L${nx - 12},${ny + 8}z" fill="${K.encre}"/>` + txt(nx, ny + 34, 'N', 24, K.encre, 'middle', 700);
    return h + '</g>';
  }
  /** Le panneau de droite : année, thermomètre des hivers, vitesses. */
  function panneau(o) {
    let h = '';
    if (o.annee != null) {
      h += `<rect x="${PX + 10}" y="14" width="575" height="96" rx="18" fill="#fff" stroke="#9FB3CC" stroke-width="3"/>`;
      h += txt(PX + 297, 84, String(Math.round(o.annee)), 62, K.bleu, 'middle', 700);
    }
    if (o.thermo > 0) {
      h += `<g opacity="${f(o.thermo)}">` + CHEN.thermometre(PX + 40, 160, 410, o.hiver, 0, 1.5, { grad: .5, libre: false, largeur: 24 });
      h += txt(PX + 90, 178, 'hivers', 30, K.encre, 'start', 700);
      h += txt(PX + 90, 228, '+ ' + nombre(o.hiver.toFixed(1)) + ' °C', 44, K.chaud, 'start', 700);
      h += txt(PX + 90, 262, 'depuis 1972', 24, '#5C6169', 'start', 500) + '</g>';
    }
    const barre = (y, titre, v, op, w) => op <= 0 ? '' : `<g opacity="${f(op)}">` + txt(PX + 90, y, titre, 26, K.encre, 'start', 600) +
      `<rect x="${PX + 90}" y="${y + 12}" width="${f(Math.max(8, 70 * v * w))}" height="40" rx="8" fill="${K.front}"/>` +
      txt(PX + 90 + 70 * v * w + (v > 4 ? -12 : 14), y + 42, nombre(v) + ' km par an', 26, v > 4 ? '#fff' : K.front, v > 4 ? 'end' : 'start', 700).replace('stroke="#fff"', v > 4 ? 'stroke="none"' : 'stroke="#fff"') + '</g>';
    if (o.v1 > 0 || o.v2 > 0) h += txt(PX + 90, 318, 'vitesse du front', 28, K.bleu, 'start', 700, Math.max(o.v1, o.v2 ? 1 : 0));
    h += barre(362, '1972 → 2004', 2.7, o.v1, o.v1w ?? 1);
    h += barre(458, 'depuis 2000', 5.5, o.v2, o.v2w ?? 1);
    return h;
  }
  function etiquetteFront(F, i, texte, op, dy = -18) {
    const [x, y] = P(F[i]);
    return txt(x + 10, y + dy, texte, 30, K.front, 'start', 700, op);
  }

  GC.play({
    debut: { dur: 7, draw(t) {
      let h = fondCarte();
      h += zone(F1972, seg(t, 2.4, 3.4)) + nids(F1972, seg(t, 2.6, 3.6));
      h += ligne(F1972, 1, false, seg(t, 1, 3));
      h += poussees(F1972, t, seg(t, 4, 4.6));
      h += villes(seg(t, 0, 1));
      h += etiquetteFront(F1972, 1, 'front d’expansion en 1972', seg(t, 3.2, 3.9), -24);
      h += panneau({ annee: 1972, v1: 0, v2: 0 });
      return h;
    } },

    remonte: { dur: 10, draw(t) {
      const p = seg(t, .6, 7), F = CHEN.entre(F1972, F2004, p), an = lerp(1972, 2004, p);
      let h = fondCarte() + zone(F) + nids(F);
      h += ligne(F1972, .7, true) + etiquetteFront(F1972, 1, '1972', .9, 34);
      h += ligne(F) + poussees(F, t, 1 - seg(t, 6.6, 7));
      h += villes();
      h += etiquetteFront(F, 1, String(Math.round(an)), seg(t, 6.8, 7.4), -22);
      // les 87 km, au sud de Paris
      const o = seg(t, 7.2, 8);
      if (o > 0) {
        const [x1, y1] = P([47.414, 3.0]), [, y2] = P([48.197, 3.0]);
        h += `<g opacity="${f(o)}"><line x1="${f(x1)}" y1="${f(y1 - 6)}" x2="${f(x1)}" y2="${f(y2 + 6)}" stroke="${K.encre}" stroke-width="4" marker-start="url(#ch-flN)" marker-end="url(#ch-flN)"/>` +
          txt(x1 + 14, (y1 + y2) / 2 + 10, '87 km', 34, K.encre, 'start', 700) + '</g>';
      }
      h += panneau({ annee: an, thermo: seg(t, 0, .6), hiver: 1.1 * p, v1: seg(t, 8, 8.6), v1w: seg(t, 8, 9.2), v2: 0 });
      return h;
    } },

    accelere: { dur: 10, draw(t) {
      const p = seg(t, .6, 7), F = CHEN.entre(F2004, F2021, p), an = lerp(2004, 2021, p);
      let h = fondCarte() + zone(F) + nids(F);
      h += ligne(F2004, .7, true) + etiquetteFront(F2004, 1, '2004', .9, 36);
      h += ligne(F) + poussees(F, t, 1 - seg(t, 6.6, 7));
      h += villes();
      const od = seg(t, 7.2, 8);
      const dep = (lat, lon, s) => { const [x, y] = P([lat, lon]); return txt(x, y, s, 30, '#6B4A2B', 'middle', 700, od).replace('<text ', '<text font-style="italic" '); };
      h += dep(48.45, 4.5, 'Aube') + dep(48.65, 4.05, 'Marne');
      h += etiquetteFront(F, 1, 'aujourd’hui', seg(t, 7, 7.6), -22);
      h += panneau({ annee: an, thermo: 1, hiver: 1.1, v1: 1, v2: seg(t, .6, 1.2), v2w: seg(t, .6, 2.4) });
      return h;
    } },

    saut: { dur: 9, draw(t) {
      let h = fondCarte() + zone(F2021) + nids(F2021) + ligne(F2021) + poussees(F2021, t, .6);
      h += villes();
      // la route et le camion
      const route = ROUTE.map((q) => P(q)), L = CHEN.longueur(route), q = seg(t, .8, 5.6);
      h += `<polyline points="${route.map((r) => r.map(f).join(',')).join(' ')}" fill="none" stroke="#8A8F98" stroke-width="4" stroke-dasharray="4 10" stroke-linecap="round" opacity="${f(seg(t, 0, .8))}"/>`;
      // le foyer d'Obernai
      const [ox, oy] = P(OBERNAI), of = seg(t, 5.6, 6.6);
      if (of > 0) {
        h += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(26 * of)}" fill="url(#ch-hach)" stroke="${K.front}" stroke-width="3"/>`;
        for (const [dx, dy] of [[-8, -6], [8, -2], [0, 10]]) h += CHEN.nid(ox + dx, oy + dy, .12 * of);
      }
      const c = CHEN.surChemin(route, q * L);
      h += CHEN.camion(c.x + 6, c.y + 4, .62, q > .99 ? Math.round(3 - 2 * seg(t, 5.6, 6.4)) : 3, t * 400 * (q < .99 ? 1 : 0));
      h += txt(ox + 30, oy + 66, 'Obernai : nids isolés', 30, K.front, 'end', 700, seg(t, 6.2, 6.9));
      h += txt(ox + 30, oy + 102, 'transport par l’humain', 28, K.front, 'end', 600, seg(t, 6.8, 7.5));
      h += panneau({ annee: 2021, thermo: 1, hiver: 1.1, v1: 1, v2: 1 });
      return h;
    } },

    lorraine: { dur: 9, draw(t) {
      let h = fondCarte() + zone(F2021) + nids(F2021) + ligne(F2021) + poussees(F2021, t, 1);
      const [ox, oy] = P(OBERNAI);
      h += `<circle cx="${f(ox)}" cy="${f(oy)}" r="26" fill="url(#ch-hach)" stroke="${K.front}" stroke-width="3"/>`;
      h += villes(1, { metz: 16 + 8 * Math.sin(t * 4) * seg(t, 2.5, 3), lorraine: lerp(.8, 1, seg(t, 3, 4)) });
      const [ax, ay] = P(FRONT_METZ), [bx, by] = P(CHEN.VILLES.Metz), p = seg(t, .5, 2.5);
      h += `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(lerp(ax, bx, p))}" y2="${f(lerp(ay, by, p))}" stroke="${K.encre}" stroke-width="4" stroke-dasharray="12 9"/>`;
      const o = seg(t, 2.4, 3.1), mx = lerp(ax, bx, .6), my = lerp(ay, by, .6) + 14;
      h += `<g opacity="${f(o)}"><rect x="${f(mx - 82)}" y="${f(my - 36)}" width="164" height="50" rx="25" fill="#fff" stroke="${K.encre}" stroke-width="3"/>` +
        `<text x="${f(mx)}" y="${f(my - 1)}" font-size="32" font-weight="700" fill="${K.encre}" text-anchor="middle">≈ 125 km</text></g>`;
      const oq = seg(t, 4.6, 5.4);
      if (oq > 0) h += `<g opacity="${f(oq)}"><rect x="530" y="400" width="360" height="84" rx="20" fill="#fff" stroke="#C00000" stroke-width="4"/>` +
        `<text x="710" y="456" font-size="44" font-weight="700" fill="#C00000" text-anchor="middle">Et la Lorraine ?</text></g>`;
      h += panneau({ annee: 2021, thermo: 1, hiver: 1.1, v1: 1, v2: 1 });
      return h;
    } },
  });
})();
