/* Scène « Comment les anticorps nous défendent-ils ? » — SVT 3e, séquence 2, activité 2 (Mme Eve Amalle).
   Dessins : animation/banque/immunite.js. Scène 1600 x 760. Chaque étape : dur (secondes) et draw(t) → SVG.
   Choix (cycle 4) : « les lymphocytes B produisent des anticorps » (plasmocytes non nommés) ; neutralisation =
   le virus ne peut plus entrer dans les cellules ; le complexe est éliminé par phagocytose. */
GC.play({
  intro: { dur: 4, draw(t) {
    let h = `<rect width="1600" height="760" fill="#FDF2EF"/>`;
    h += virus(800, 330, 'tri', t * 10, 2.2);
    for (const i of [0, 2, 3, 5, 7]) { const p = bindAb(800, 330, t * 10, 2.2, i, 1.6); h += antibody(p.x, p.y, p.r, 1.6, 'tri', seg(t, .3 + i * .15, 1 + i * .15)); }
    h += txt(800, 615, 'Les anticorps', 60, '#1F4E79', 'middle', 700);
    h += txt(800, 672, 'Le système immunitaire', 30, '#555', 'middle');
    return h;
  } },

  entree: { dur: 7, draw(t) {
    let h = fondSang(t, 'Dans l\'organisme');
    h += cellule(1180, 150, 380, 430);
    const x = lerp(-80, 560, seg(t, 0, 3)), y = 380 + 10 * Math.sin(t * 2), r = 15 * Math.min(t, 3);
    h += virus(x, y, 'tri', r, 1.5);
    const o = seg(t, 3.3, 4);
    if (o > 0) {
      for (const i of [6, 7]) { const a = r + 45 * i, [c, s] = dir(a); h += fleche(700, 170, x + 1.5 * 44 * c, y + 1.5 * 44 * s, o); }
      h += txt(700, 155, 'antigènes', 32, C.agTri, 'middle', 700, o);
      h += txt(x, y + 108, 'virus d\'Epstein-Barr', 26, C.ebvS, 'middle', 700, o);
    }
    return h;
  } },

  multiplication: { dur: 8, draw(t) {
    let h = fondSang(t, 'Dans l\'organisme');
    h += cellule(1180, 150, 380, 430);
    const p = seg(t, 0, 2.6);
    h += virus(lerp(560, 1290, p), 380, 'tri', 45 + 30 * t, 1.5 * lerp(1, .6, seg(t, 1.8, 2.6)), 1 - seg(t, 2.2, 2.9));
    const IN = [[1250, 250], [1330, 300], [1260, 460], [1360, 500], [1300, 380], [1230, 350]];
    const OUT = [[330, 230], [420, 540], [640, 300], [820, 560], [160, 420], [900, 220]];
    const n = Math.floor(clamp((t - 3) * 2.6, 0, 6));
    for (let k = 0; k < n; k++) {
      const q = seg(t, 5.2 + k * .25, 7.2 + k * .15);
      h += virus(lerp(IN[k][0], OUT[k][0], q), lerp(IN[k][1], OUT[k][1], q), 'tri', k * 20 + t * 12, lerp(.5, 1, q));
    }
    return h;
  } },

  reconnaissance: { dur: 10, draw(t) {
    let h = fondGanglion();
    const L = [{ x: 250, k: 'carre' }, { x: 590, k: 'rond' }, { x: 930, k: 'tri' }, { x: 1270, k: 'double' }], Y = 500, VS = 1.3, LS = 1.55;
    L.forEach((l, i) => { const act = i === 2; h += LB(l.x, Y, l.k, LS, act ? seg(t, 5, 5.6) : 0, act ? 1 : 1 - .6 * seg(t, 6, 7)); });
    const P = L.map((l) => poseOnLB(l.x, Y, LS, VS));
    const H = P.map((p) => ({ x: p.x, y: p.y - 110, r: p.r })), N = P.map((p) => ({ x: p.x, y: p.y - 16, r: p.r }));
    const v = keys([{ t: 0, x: -80, y: 200, r: 0 }, { t: .9, ...H[0] }, { t: 1.4, ...N[0] }, { t: 1.9, ...H[0] }, { t: 2.6, ...H[1] }, { t: 3.1, ...N[1] }, { t: 3.6, ...H[1] }, { t: 4.3, ...H[2] }, { t: 5, ...P[2] }], t);
    h += virus(v.x, v.y, 'tri', v.r, VS);
    h += ko(L[0].x + 150, Y - 200, seg(t, 1.4, 1.6) * (1 - seg(t, 2.3, 2.6)));
    h += ko(L[1].x + 150, Y - 200, seg(t, 3.1, 3.3) * (1 - seg(t, 4, 4.3)));
    h += ok(L[2].x + 165, Y - 200, seg(t, 5, 5.3));
    h += txt(760, Y + 178, 'lymphocytes B', 28, C.lbS, 'middle', 700, 1 - seg(t, 4.5, 5.2));
    h += txt(L[2].x, Y + 178, 'lymphocyte B activé', 28, C.lbS, 'middle', 700, seg(t, 5.6, 6.3));
    h += txt(L[2].x + 200, Y - 191, 'la forme correspond !', 26, C.ok, 'start', 700, seg(t, 5.3, 5.8));
    return h;
  } },

  clones: { dur: 8, draw(t) {
    const g = seg(t, .5, 7.5);
    let h = fondGanglion(lerp(560, 700, g), lerp(250, 330, g));
    const G = [[[800, 400]], [[700, 400], [900, 400]], [[700, 320], [700, 480], [900, 320], [900, 480]],
      [[575, 320], [725, 320], [575, 480], [725, 480], [875, 320], [1025, 320], [875, 480], [1025, 480]]];
    const T = [0, 1, 3, 5];
    let gen = 0; for (let k = 1; k < 4; k++) if (t >= T[k]) gen = k;
    const p = gen ? seg(t, T[gen], T[gen] + .9) : 1;
    G[gen].forEach((c, k) => { const par = gen ? G[gen - 1][k >> 1] : c; h += LB(lerp(par[0], c[0], p), lerp(par[1], c[1], p), 'tri', .72, .35); });
    const jour = 1 + Math.floor(5 * seg(t, .4, 7));
    h += `<rect x="1330" y="30" width="230" height="70" rx="12" fill="#fff" stroke="#94AE7C" stroke-width="3"/>` + txt(1445, 78, 'Jour ' + jour, 36, '#4F6B37', 'middle', 700);
    h += txt(800, 722, 'le ganglion gonfle', 28, '#4F6B37', 'middle', 700, seg(t, 5.5, 6.3));
    return h;
  } },

  production: { dur: 9, draw(t) {
    let h = fondSang(t, 'Dans le sang', 640) + `<rect width="640" height="760" fill="#E7F0DC"/>` + txt(24, 46, 'Ganglion', 26, '#4F6B37', 'start', 700);
    const P = [[120, 300], [240, 300], [360, 300], [480, 300], [120, 450], [240, 450], [360, 450], [480, 450]];
    P.forEach((c) => { h += LB(c[0], c[1], 'tri', .88); });
    const R = rng(7);
    for (let i = 0; i < 40; i++) {
      const s = P[i % 8], tx = 700 + R() * 820, ty = 290 + R() * 420, r0 = R() * 360, sp = (R() - .5) * 60, b = .4 + i * .15;
      if (t < b) continue;
      const q = seg(t, b, b + 3), x = lerp(s[0] + 40, tx, q) + 6 * Math.sin(t + i), y = lerp(s[1], ty, q) + 6 * Math.cos(t * .8 + i);
      h += antibody(x, y, r0 + sp * (t - b), .9);
    }
    const o = seg(t, 4.5, 5.2);
    if (o > 0) {
      h += `<g opacity="${o}"><rect x="1040" y="70" width="530" height="200" rx="14" fill="#fff" stroke="#1F4E79" stroke-width="3"/>`;
      h += antibody(1150, 195, 0, 2.4);
      const J = [1150, 195], [ax, ay] = dir(-55), T = [J[0] + 26 * 2.4 * ax, J[1] + 26 * 2.4 * ay], u = dir(125), g = lerp(40, 0, seg(t, 6, 7.5)), tip = [T[0] - g * u[0], T[1] - g * u[1]];
      h += antigen('tri', tip[0] - 29 * u[0], tip[1] - 29 * u[1], 125, 2.4);
      h += txt(1280, 125, 'antigène', 26, C.agTri, 'start', 700) + txt(1280, 175, 'anticorps', 26, C.ab, 'start', 700);
      h += txt(1280, 218, 'formes complémentaires', 24, C.txt, 'start', 400) + `</g>`;
    }
    return h;
  } },

  fixation: { dur: 10, draw(t) {
    let h = fondSang(t);
    const V = [[440, 290, 10], [650, 550, 30], [930, 330, 0]].map((v, j) => [v[0] + 8 * Math.sin(t * .9 + j), v[1] + 8 * Math.cos(t * .7 + j), v[2]]);
    const G = [[1240, 560], [1360, 250]].map((g, j) => [g[0] + 8 * Math.sin(t * .8 + j + 2), g[1] + 8 * Math.cos(t * .6 + j)]);
    V.forEach((v) => { h += virus(v[0], v[1], 'tri', v[2], 1.25); });
    G.forEach((g) => { h += virus(g[0], g[1], 'carre', 15, 1.25); });
    const R = rng(3); let idx = 0;
    V.forEach((v) => { for (const i of [0, 1, 3, 4, 5, 7]) {
      const sx = -60 + R() * 300, sy = 80 + R() * 600, sr = R() * 360, b = .8 + idx * .25; idx++;
      const B = bindAb(v[0], v[1], v[2], 1.25, i, .95), q = seg(t, b, b + 2.6);
      h += antibody(lerp(sx, B.x, q) + (1 - q) * 10 * Math.sin(t * 2 + idx), lerp(sy, B.y, q), lerpAng(sr, B.r, q), .95);
    } });
    for (let k = 0; k < 5; k++) {
      const g = G[k % 2], q = clamp((t - 2 - k * .9) / 5), dy = (k % 2 ? 1 : -1) * (80 + 20 * k);
      if (q > 0 && q < 1) h += antibody(lerp(-60, 1700, q), g[1] + dy + 40 * Math.sin(q * 6), q * 400 + k * 60, .95);
    }
    const o = seg(t, 7, 7.6);
    h += fleche(560, 120, V[0][0] + 30, V[0][1] - 80, o) + txt(560, 105, 'complexe antigène-anticorps', 28, C.ab, 'middle', 700, o);
    h += txt(1290, 692, 'virus de la grippe : aucun anticorps fixé', 26, C.grS, 'middle', 700, seg(t, 7.6, 8.2));
    return h;
  } },

  neutralisation: { dur: 7, draw(t) {
    let h = fondSang(t, 'Dans l\'organisme');
    h += cellule(1180, 150, 380, 430);
    const v = keys([{ t: 0, x: 430, y: 380 }, { t: 2.8, x: 1082, y: 380 }, { t: 3.6, x: 950, y: 380 }, { t: 4.6, x: 990, y: 380 }], t);
    const vr = 10 + 8 * t;
    h += virus(v.x, v.y, 'tri', vr, 1.25);
    for (const i of [0, 1, 2, 3, 5, 6, 7]) { const B = bindAb(v.x, v.y, vr, 1.25, i, .95); h += antibody(B.x, B.y, B.r, .95); }
    h += ko(1180, 250, seg(t, 2.7, 3));
    h += txt(800, 692, 'entrée impossible', 32, C.ko, 'middle', 700, seg(t, 3.4, 4));
    return h;
  } },

  phagocytose: { dur: 11, draw(t) {
    let h = fondSang(t);
    const cx = 950, cy = 390, cs = lerp(1, .15, seg(t, 6.4, 8.8)), co = lerp(1, .15, seg(t, 6.4, 8.8));
    h += `<g opacity="${co}">` + virus(cx, cy, 'tri', 20, 1.25 * cs);
    for (const i of [0, 1, 2, 3, 5, 6, 7]) { const B = bindAb(cx, cy, 20, 1.25 * cs, i, .95 * cs); h += antibody(B.x, B.y, B.r, .95 * cs); }
    h += `</g>`;
    const px = keys([{ t: 0, x: 120, y: cy }, { t: 2.4, x: 700, y: cy }, { t: 3.4, x: 700, y: cy }, { t: 5.8, x: 925, y: cy }], t);
    const r = lerp(130, 165, seg(t, 3.4, 5.8));
    h += phagocyte(px.x, px.y, r, t, 1, lerp(1, .72, seg(t, 3, 4)), -r * .5, r * .28);
    h += `<circle cx="${cx}" cy="${cy}" r="${f(lerp(10, 105, seg(t, 5, 6)) * (t > 5 ? 1 : 0))}" fill="none" stroke="${C.phS}" stroke-width="3" stroke-dasharray="8 6" opacity="${seg(t, 5, 6) * (1 - seg(t, 9.2, 10))}"/>`;
    const R = rng(11);
    for (let k = 0; k < 7; k++) {
      const a = R() * 360, [ux, uy] = dir(a), q = seg(t, 8.8, 10.6);
      if (t > 8.8) h += `<circle cx="${f(cx + ux * lerp(10, 260, q))}" cy="${f(cy + uy * lerp(10, 260, q))}" r="6" fill="${C.ebvS}" opacity="${.8 * (1 - seg(t, 10.2, 11))}"/>`;
    }
    const E = ['1 Adhésion', '2 Ingestion', '3 Digestion', '4 Rejet'], TT = [2.4, 3.4, 6.4, 8.8];
    E.forEach((e, k) => {
      const on = t >= TT[k] && (k === 3 || t < TT[k + 1]);
      h += `<rect x="1180" y="${110 + 62 * k}" width="360" height="50" rx="10" fill="${on ? '#1F4E79' : '#fff'}" stroke="#1F4E79" stroke-width="2" opacity="${t >= TT[k] ? 1 : .35}"/>`;
      h += txt(1360, 146 + 62 * k, e, 28, on ? '#fff' : '#1F4E79', 'middle', 700, t >= TT[k] ? 1 : .35).replace('stroke="#fff"', on ? 'stroke="none"' : 'stroke="#fff"');
    });
    h += txt(px.x - r * .5, cy + r + 52, 'phagocyte', 28, C.phS, 'middle', 700, 1 - seg(t, 4, 5));
    return h;
  } },

  bilan: { dur: 7, draw(t) {
    let h = `<rect width="1600" height="760" fill="#fff"/>`;
    const B = [
      ['Un lymphocyte B', 'reconnaît l\'antigène', 'du virus'],
      ['Il se multiplie', 'dans les ganglions', '(plusieurs jours)'],
      ['Les lymphocytes B', 'produisent', 'des anticorps'],
      ['Les anticorps se fixent', 'sur les antigènes :', 'complexe antigène-anticorps'],
      ['Le virus est neutralisé,', 'puis éliminé', 'par phagocytose']];
    B.forEach((l, k) => {
      const o = seg(t, k * .8, k * .8 + .6), x = 30 + k * 312;
      h += `<g opacity="${o}"><rect x="${x}" y="40" width="280" height="340" rx="16" fill="#F2F6FB" stroke="#1F4E79" stroke-width="3"/>`;
      const ix = x + 140, iy = 145;
      if (k === 0) { h += LB(ix, iy + 35, 'tri', .75, .6); const p = poseOnLB(ix, iy + 35, .75, .6); h += virus(p.x, p.y, 'tri', p.r, .6); }
      if (k === 1) { [[-45, -30], [45, -30], [-45, 50], [45, 50]].forEach((d) => { h += LB(ix + d[0], iy + d[1] + 10, 'tri', .5); }); }
      if (k === 2) { h += LB(ix - 55, iy + 10, 'tri', .6); [[30, -40, 20], [75, 0, -30], [40, 50, 60]].forEach((d) => { h += antibody(ix + d[0], iy + d[1], d[2], .8); }); }
      if (k === 3) { h += virus(ix, iy + 10, 'tri', 0, .85); [0, 2, 4, 6].forEach((i) => { const b = bindAb(ix, iy + 10, 0, .85, i, .7); h += antibody(b.x, b.y, b.r, .7); }); }
      if (k === 4) { h += phagocyte(ix, iy + 10, 85, t, 1, .75, -40, 25); h += `<g opacity=".8">` + virus(ix + 18, iy, 'tri', 0, .45) + `</g>`; }
      l.forEach((s, j) => { h += txt(ix, 284 + j * 32, s, s.length > 24 ? 19 : 23, C.txt, 'middle', j === 0 ? 700 : 400); });
      h += `</g>`;
      if (k < 4) h += `<line x1="${x + 284}" y1="210" x2="${x + 306}" y2="210" stroke="#1F4E79" stroke-width="4" marker-end="url(#flB)" opacity="${seg(t, k * .8 + .5, k * .8 + .9)}"/>`;
    });
    // « À retenir » : un bilan s'écrit en rouge
    const o = seg(t, 4.4, 5.2), R = '#C00000';
    h += `<g opacity="${o}"><rect x="30" y="410" width="1540" height="320" rx="16" fill="#FFF7F7" stroke="${R}" stroke-width="3"/>`;
    h += txt(60, 462, 'À retenir', 32, R, 'start', 700);
    h += txt(60, 514, '• Un anticorps est spécifique : il ne se fixe que sur l\'antigène de forme complémentaire.', 27, R);
    h += txt(60, 562, '• Les anticorps restent dans le sang : les rechercher montre quel micro-organisme on a rencontré.', 27, R);
    h += txt(84, 602, 'Mme Amalle : anticorps contre le virus d\'Epstein-Barr → mononucléose.', 27, R, 'start', 700);
    h += txt(60, 654, '• Les virus déjà entrés dans les cellules échappent aux anticorps : les lymphocytes T', 27, R);
    h += txt(84, 694, 'détruisent les cellules infectées.', 27, R) + `</g>`;
    return h;
  } },
});
