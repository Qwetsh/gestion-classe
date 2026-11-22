/* Scène « Comment lire un antibiogramme ? » — SVT 3e, séquence 2, activité 3 (M. Apabien).
   Dessins : animation/banque/bacteries.js. Scène 1600 x 760.
   À gauche le modèle de la classe (gel au jus de chou rouge, « antibiotiques » = vinaigre dilué), à droite
   un vrai antibiogramme : même principe, la diffusion. Sur la vraie boîte, les bactéries ensemencées
   poussent pendant l'incubation, sauf là où l'antibiotique est assez concentré (zone claire). */
const G = { x: 430, y: 390 }, Dr = { x: 1170, y: 390 }, RB = 245, MM = 7;
const PAST = [{ l: 'A', dx: -115, dy: -80, r: 80 }, { l: 'B', dx: 115, dy: -80, r: 72 }, { l: 'C', dx: 0, dy: 115, r: 30 }];
const pos = (b, p) => ({ x: b.x + p.dx, y: b.y + p.dy });

function titres(op = 1) {
  return txt(G.x, 72, 'Notre modèle', 34, '#5E3A85', 'middle', 700, op) +
    txt(Dr.x, 72, 'Un vrai antibiogramme', 34, '#7A5A12', 'middle', 700, op);
}
/** Les deux boîtes ; zr = rayon des zones (0 à 1 de leur taille finale), pousse = croissance du tapis. */
function deuxBoites(t, { past = 1, diff = 0, zr = 0, pousse = .22 } = {}) {
  let h = boite(G.x, G.y, RB, BA.chou) + boite(Dr.x, Dr.y, RB, BA.gel);
  const trous = PAST.map((p) => ({ ...pos(Dr, p), r: p.r * zr }));
  h += tapis(Dr.x, Dr.y, RB, trous, pousse);
  PAST.forEach((p, i) => {
    const a = pos(G, p), b = pos(Dr, p);
    h += halo('hg' + i, a.x, a.y, p.r * 1.45 * diff, '#FFFFFF', .55 * (1 - zr * .6));
    h += halo('hd' + i, b.x, b.y, p.r * 1.45 * diff, '#9EC6EA', .55 * (1 - zr));
    h += zone(a.x, a.y, p.r * zr, BA.rose, .9, '#9C2A5C');
    if (zr > 0) h += `<circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(p.r * zr)}" fill="#FFFDF5" opacity="${f(.85 * zr)}" stroke="#7A5A12" stroke-width="2" stroke-dasharray="7 5"/>`;
  });
  PAST.forEach((p, i) => {
    const a = pos(G, p), b = pos(Dr, p), s = past;
    h += pastille(a.x, a.y - 30 * (1 - s), p.l, 1, s) + pastille(b.x, b.y - 30 * (1 - s), p.l, 1, s);
  });
  return h;
}

GC.play({
  boites: { dur: 6, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres(seg(t, 0, .8));
    h += deuxBoites(t, { past: 0 });
    h += txt(G.x, 712, 'gel au jus de chou rouge', 26, '#5E3A85', 'middle', 700, seg(t, 1.5, 2.3));
    h += txt(Dr.x, 712, 'gélose ensemencée de bactéries', 26, '#7A5A12', 'middle', 700, seg(t, 2.5, 3.3));
    return h;
  } },

  pastilles: { dur: 6, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres();
    const p = seg(t, .3, 2.5);
    h += deuxBoites(t, { past: p });
    h += txt(800, 712, 'trois pastilles imbibées : A, B, C', 28, TXT, 'middle', 700, seg(t, 2.5, 3.3));
    return h;
  } },

  diffusion: { dur: 9, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres();
    const d = seg(t, .3, 6.5);
    h += deuxBoites(t, { diff: d });
    const o = seg(t, 2, 2.8);
    const a = pos(G, PAST[0]);
    h += fleche(a.x, a.y, a.x - 105 * d - 20, a.y - 70 * d - 20, o);
    h += txt(800, 712, 'le produit se répand : de moins en moins concentré en s’éloignant', 28, TXT, 'middle', 700, o);
    return h;
  } },

  zones: { dur: 9, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres();
    const z = seg(t, .5, 5), pousse = lerp(.22, 1, seg(t, .5, 5));
    h += deuxBoites(t, { diff: 1, zr: z, pousse });
    const o = seg(t, 5, 5.8);
    h += `<g opacity="${f(o)}"><rect x="${G.x - 95}" y="128" width="190" height="52" rx="26" fill="#fff" stroke="#5E3A85" stroke-width="3"/></g>`;
    h += txt(G.x, 164, '≈ 15 min', 28, '#5E3A85', 'middle', 700, o);
    h += `<g opacity="${f(o)}"><rect x="${Dr.x - 115}" y="128" width="230" height="52" rx="26" fill="#fff" stroke="#7A5A12" stroke-width="3"/></g>`;
    h += txt(Dr.x, 164, '16 à 20 h', 28, '#7A5A12', 'middle', 700, o);
    h += txt(G.x, 712, 'le chou rouge change de couleur', 26, '#9C2A5C', 'middle', 700, seg(t, 3, 3.8));
    h += txt(Dr.x, 712, 'zone claire : pas de bactéries', 26, '#7A5A12', 'middle', 700, seg(t, 4, 4.8));
    return h;
  } },

  mesure: { dur: 8, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres(.35);
    h += deuxBoites(t, { diff: 1, zr: 1, pousse: 1 });
    h += `<rect x="${Dr.x - RB - 20}" y="90" width="${2 * RB + 40}" height="${2 * RB + 80}" fill="#F7F9FC" opacity="${f(.65 * seg(t, 0, 1))}"/>`;
    const a = pos(G, PAST[0]), r = PAST[0].r, o = seg(t, .5, 1.5);
    const x0 = lerp(a.x - r - 300, a.x - r, seg(t, .8, 2.6));
    h += regle(x0, a.y + 6, 2 * r + 60, MM, o);
    const o2 = seg(t, 3, 3.6);
    h += `<line x1="${f(a.x - r)}" y1="${f(a.y)}" x2="${f(a.x + r)}" y2="${f(a.y)}" stroke="#1d2433" stroke-width="4" marker-start="url(#fl)" marker-end="url(#fl)" opacity="${f(o2)}"/>`;
    const mm = Math.round(2 * r / MM);
    const ob = seg(t, 3.8, 4.4);
    h += `<g opacity="${f(ob)}"><rect x="${G.x - 170}" y="652" width="340" height="96" rx="14" fill="#fff" stroke="#1F4E79" stroke-width="3"/></g>`;
    h += txt(G.x, 694, 'A : ' + mm + ' mm', 34, '#1F4E79', 'middle', 700, ob);
    h += txt(G.x, 732, 'pastille comprise', 24, '#555', 'middle', 400, ob);
    return h;
  } },

  bilan: { dur: 7, draw(t) {
    let h = `<rect width="1600" height="760" fill="#F7F9FC"/>` + titres();
    h += deuxBoites(t, { diff: 1, zr: 1, pousse: 1 });
    PAST.forEach((p, i) => {
      const b = pos(Dr, p), grande = p.r > 50;
      h += txt(b.x + (i === 2 ? 0 : (p.dx < 0 ? -1 : 1) * 10), b.y + (i === 2 ? 80 : -p.r - 16), grande ? 'grande zone' : 'petite zone', 24, '#1d2433', 'middle', 700, seg(t, .6 + i * .5, 1.2 + i * .5));
    });
    h += `<rect x="260" y="668" width="1080" height="66" rx="14" fill="#fff" stroke="#C00000" stroke-width="3" opacity="${f(seg(t, 2.5, 3.2))}"/>`;
    h += txt(800, 712, 'zone grande = bactérie sensible à l’antibiotique', 30, '#C00000', 'middle', 700, seg(t, 2.5, 3.2));
    return h;
  } },
});
