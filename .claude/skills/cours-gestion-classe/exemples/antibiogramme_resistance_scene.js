/* Scène « Quand les antibiotiques ne marchent plus » — SVT 3e, séquence 2, activité 3 (document 3).
   Dessins : animation/banque/bacteries.js. Scène 1600 x 760.
   Choix scientifiques : les bactéries résistantes sont présentes PAR HASARD avant le traitement ;
   l'antibiotique ne les crée pas, il les sélectionne (pas de finalisme : aucune bactérie ne « s'adapte »). */
const RC = rng(5), COL = [];
for (let i = 0; i < 36; i++) {
  const a = RC() * 2 * Math.PI, d = Math.sqrt(RC());
  COL.push({ x: 800 + 520 * d * Math.cos(a), y: 400 + 230 * d * Math.sin(a), r: RC() * 180, res: i === 4 || i === 17 || i === 29, k: RC() });
}
const RES = COL.filter((b) => b.res);
/** Descendance des résistantes : génération g (0 à 3) → 3 × 2^g bactéries. */
function descendants(g) {
  let pop = RES.map((b) => ({ x: b.x, y: b.y, r: b.r }));
  const R = rng(9);
  for (let k = 0; k < g; k++) {
    const next = [];
    // chaque division : une fille reste, l'autre part vers un point de la plaie (la colonie s'étale partout)
    pop.forEach((b) => { const a = R() * 2 * Math.PI, d = Math.sqrt(R()); next.push({ x: b.x, y: b.y, r: b.r }, { x: 800 + 540 * d * Math.cos(a), y: 400 + 230 * d * Math.sin(a), r: R() * 180 }); });
    pop = next;
  }
  return pop;
}
function fond(lab, col = '#FBEFEF', tcol = '#9C2A2A') {
  return `<rect width="1600" height="760" fill="${col}"/>` + txt(28, 50, lab, 28, tcol, 'start', 700);
}
/** Molécules d'antibiotique (petits losanges verts) qui balaient la scène de gauche à droite. */
function dose(t, a, b) {
  const p = clamp((t - a) / (b - a)); if (p <= 0 || p >= 1) return '';
  const R = rng(21); let h = '';
  for (let i = 0; i < 70; i++) {
    const x = -100 + (1800 * p) - R() * 500, y = 120 + R() * 560;
    h += `<path d="M${f(x)},${f(y - 8)} l8,8 l-8,8 l-8,-8z" fill="#2E9E55" opacity=".8"/>`;
  }
  return h;
}
function legende(x, y, col, texte, op) {
  return bacterie(x, y, 0, 1, col, op) + txt(x + 40, y + 9, texte, 26, TXT, 'start', 700, op);
}

GC.play({
  colonie: { dur: 7, draw(t) {
    let h = fond('Dans la plaie de M. Apabien');
    COL.forEach((b, i) => { h += bacterie(b.x, b.y + 4 * Math.sin(t + i), b.r + 6 * Math.sin(t * .7 + i), 1.1, b.res ? BA.res : BA.sens, seg(t, i * .05, .6 + i * .05)); });
    h += legende(80, 700, BA.sens, 'bactéries sensibles', seg(t, 2.2, 2.9));
    h += legende(520, 700, BA.res, 'résistantes : quelques-unes, par hasard, dès le départ', seg(t, 3.4, 4.1));
    return h;
  } },

  dose: { dur: 8, draw(t) {
    let h = fond('Dans la plaie de M. Apabien');
    COL.forEach((b, i) => {
      const mort = b.res ? 0 : seg(t, 1.5 + b.k * 3, 2.5 + b.k * 3);
      h += bacterie(b.x, b.y + 4 * Math.sin(t + i), b.r, 1.1 * (1 - .4 * mort), b.res ? BA.res : BA.sens, 1 - mort);
    });
    h += dose(t, .3, 6.5);
    h += txt(800, 712, 'une prise d’antibiotique : les sensibles sont détruites', 28, '#1E6B3A', 'middle', 700, seg(t, 1, 1.8));
    return h;
  } },

  multiplication: { dur: 9, draw(t) {
    let h = fond('Dans la plaie de M. Apabien');
    const T = [0, 1.5, 3.5, 5.5]; let g = 0; for (let k = 1; k < 4; k++) if (t >= T[k]) g = k;
    const cur = descendants(g), prev = g ? descendants(g - 1) : cur, p = g ? seg(t, T[g], T[g] + 1) : 1;
    cur.forEach((b, i) => { const par = prev[i >> (g ? 1 : 0)] || b; h += bacterie(lerp(par.x, b.x, p), lerp(par.y, b.y, p) + 3 * Math.sin(t + i), b.r, 1.1, BA.res); });
    h += `<rect x="1330" y="30" width="240" height="70" rx="12" fill="#fff" stroke="#9C2A2A" stroke-width="3"/>` + txt(1450, 78, cur.length + ' résistantes', 30, '#9C2A2A', 'middle', 700);
    h += txt(800, 712, 'les résistantes se multiplient et prennent toute la place', 28, '#9C2A2A', 'middle', 700, seg(t, 6.5, 7.3));
    return h;
  } },

  echec: { dur: 7, draw(t) {
    let h = fond('Dans la plaie de M. Apabien');
    descendants(3).forEach((b, i) => { h += bacterie(b.x, b.y + 3 * Math.sin(t + i), b.r, 1.1, BA.res); });
    h += dose(t, .3, 5);
    h += ko(800, 120, seg(t, 4.2, 4.6));
    h += txt(800, 712, 'une nouvelle prise ne fait plus rien : l’antibiotique ne marche plus', 28, '#9C2A2A', 'middle', 700, seg(t, 4.4, 5.1));
    return h;
  } },

  microbiote: { dur: 9, draw(t) {
    let h = fond('Dans l’intestin : le microbiote', '#F1F6EC', '#3E6B2A');
    const R = rng(33);
    for (let i = 0; i < 46; i++) {
      const a = R() * 2 * Math.PI, d = Math.sqrt(R()), x = 800 + 600 * d * Math.cos(a), y = 390 + 240 * d * Math.sin(a), rot = R() * 180;
      const res = i === 7 || i === 30, col = res ? BA.res : BA.microbio[i % 5], k = R();
      const mort = res ? 0 : (k < .7 ? seg(t, 2 + k * 3, 3 + k * 3) : 0);
      h += bacterie(x, y + 3 * Math.sin(t + i), rot, 1, col, 1 - mort);
    }
    h += dose(t, 1, 6);
    h += txt(800, 712, 'le microbiote s’appauvrit ; les résistantes y restent aussi', 28, '#3E6B2A', 'middle', 700, seg(t, 5.5, 6.3));
    return h;
  } },

  bilan: { dur: 7, draw(t) {
    let h = fond('Dans la plaie de M. Apabien');
    descendants(3).forEach((b, i) => { h += bacterie(b.x, b.y + 3 * Math.sin(t + i), b.r, 1.1, BA.res, .5); });
    h += `<rect x="200" y="300" width="1200" height="150" rx="18" fill="#fff" stroke="#C00000" stroke-width="4" opacity="${f(seg(t, .5, 1.2))}"/>`;
    h += txt(800, 365, 'L’antibiotique ne crée pas les bactéries résistantes :', 34, '#C00000', 'middle', 700, seg(t, .5, 1.2));
    h += txt(800, 415, 'il les sélectionne.', 34, '#C00000', 'middle', 700, seg(t, 1, 1.7));
    return h;
  } },
});
