/* Animation C — « L'Atlantique sud s'ouvre » (correction de Wegener, question 5).
   Même carte que le puzzle, jouée à l'envers : de 130 millions d'années à aujourd'hui, à vitesse
   constante (la simplification de l'énoncé). À la dorsale, du nouveau fond océanique se forme de
   part et d'autre (expansion symétrique) ; il est coloré selon son âge (jeune = orangé, ancien = bleu).
   Les deux plaques tournent autour du pôle de Bullard : l'Amérique du Sud de -w, la dorsale de -w/2. */
(() => {
  const OUVERT = 57;                                   // degrés d'ouverture en 130 millions d'années
  const w = (age) => OUVERT * (130 - age) / 130;
  const CL = { cx: 700, cy: 15, k: 0.051 };            // toute la carte, décalée pour l'encart
  const vue = (z) => CARTE.vue(z, CARTE.PROCHE, CL);
  // La côte ouest de l'Afrique, prolongée au sud du Cap (marge de l'Atlantique austral, schématique)
  const J = [...TEC.J.filter((p, i) => i % 2 === 0 || i === TEC.J.length - 1), [18.6, -37], [18.3, -40.5], [17.6, -44]];
  const tourne = (pts, a) => TEC.tourne(pts, TEC.R(a));
  // âge relatif 0 (né à l'instant) → 1 (130 Ma) : orangé → jaune → bleu
  const couleur = (u) => {
    const C = [[228, 87, 46], [243, 201, 105], [78, 127, 176]];
    const k = u < .5 ? 0 : 1, p = u < .5 ? u * 2 : (u - .5) * 2;
    const c = C[k].map((a, i) => Math.round(lerp(a, C[k + 1][i], p)));
    return `rgb(${c})`;
  };
  /** Le fond océanique formé depuis 130 Ma, quand l'âge actuel est `age`, en bandes de 10 Ma. */
  function fondOceanique(age, P) {
    const wt = w(age);
    let h = '';
    for (let a = 130; a > age; a -= 10) {
      const b = Math.max(age, a - 10), wa = w(a), wb = w(b), col = couleur(clamp((a - 5 - age) / 130));
      const cote = (ra, rb) => TEC.chemin([...tourne(J, ra), ...tourne(J, rb).reverse()], P);
      h += `<path d="${cote(-wa / 2, -wb / 2)}" fill="${col}" stroke="${col}" stroke-width="1"/>`;               // côté africain
      h += `<path d="${cote(-(wt - wa / 2), -(wt - wb / 2))}" fill="${col}" stroke="${col}" stroke-width="1"/>`; // côté américain
    }
    return h;
  }
  function dorsale(age, P, op = 1) {
    return `<path d="${TEC.chemin(tourne(J, -w(age) / 2), P, false)}" fill="none" stroke="#B3001B" stroke-width="5" stroke-linejoin="round" opacity="${op}"/>`;
  }
  function carte(age, P, opts = {}) {
    let h = CARTE.fond() + CARTE.equateur(P, .7) + fondOceanique(age, P);
    if (age < 130) h += dorsale(age, P, opts.dorsale ?? 1);
    h += CARTE.continent(TEC.AF, P) + CARTE.continent(TEC.SA_A(w(age)), P);
    return h;
  }
  const km = (age) => Math.round(30 * (130 - age));    // 3 cm par an = 30 km par million d'années
  const nombre = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function compteur(age, op = 1) {
    const quand = age < 0.5 ? ['aujourd\'hui', 36, '#1F4E79'] : [`il y a ${Math.round(age)} millions d'années`, 32, '#1F4E79'];
    return CARTE.encart([quand, [`écart : ${nombre(km(Math.max(0, age)))} km`, 38, '#C00000']], op, 1150, 22, 430);
  }
  function largeur(P, a, b, texte, dx, dy, op) {
    if (op <= 0) return '';
    const [x1, y1] = P(a), [x2, y2] = P(b);
    return `<g opacity="${op}"><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#1F3864" stroke-width="4" marker-start="url(#flB)" marker-end="url(#flB)"/>` +
      txt((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, texte, 34, '#1F3864', 'middle', 700) + '</g>';
  }
  const NORD = [TEC.SA[225], TEC.AF[13]];              // Natal (Brésil) → Monrovia (Liberia) : ≈ 3 000 km
  const SUD = [TEC.SA[267], TEC.AF[354]];              // Rio de Janeiro → Namibie : ≈ 6 000 km
  const arrondi = (d) => '≈ ' + nombre(Math.round(d / 500) * 500) + ' km';

  GC.play({
    colles: { dur: 6, draw(t) {
      const P = vue(0);
      let h = carte(130, P);
      const [x, y] = P([-2, -14]);
      h += txt(x, y, 'un seul bloc', 40, '#7C5A2E', 'middle', 700, seg(t, 1, 2));
      h += compteur(130, seg(t, 2, 3));
      return h;
    } },

    ouverture: { dur: 10, draw(t) {
      const age = lerp(130, 65, seg(t, .8, 8.5)), P = vue(.5 * seg(t, .8, 8.5));
      let h = carte(age, P);
      const r = tourne([J[Math.round(J.length * .6)]], -w(age) / 2)[0];
      h += CARTE.etiquette(P, r, -330, 40, 'la dorsale', 38, '#B3001B', seg(t, 3, 3.8));
      const r2 = tourne([J[Math.round(J.length * .86)]], -w(age) / 4)[0];
      h += CARTE.etiquette(P, r2, 230, 30, 'du nouveau fond océanique', 34, '#9A4A00', seg(t, 5.2, 6));
      h += compteur(age);
      return h;
    } },

    calcul: { dur: 10, draw(t) {
      const P = vue(.5);
      let h = carte(65, P) + `<rect width="1600" height="570" fill="#fff" opacity="${f(.78 * seg(t, 0, .8))}"/>`;
      const L = [
        ['1 an', '3 cm'],
        ['1 000 ans', '3 000 cm = 30 m'],
        ['1 million d\'années', '30 km'],
        ['130 millions d\'années', '130 × 30 = 3 900 km'],
      ];
      h += txt(800, 80, '3 cm par an, c\'est très lent…', 42, '#1F4E79', 'middle', 700, seg(t, .5, 1.2));
      L.forEach(([a, b], i) => {
        const o = seg(t, 1.6 + i * 1.9, 2.3 + i * 1.9), y = 170 + i * 92, fin = i === L.length - 1;
        h += txt(760, y, a, 40, TXT, 'end', 600, o) + txt(800, y, '→', 40, '#888', 'middle', 400, o) + txt(840, y, b, 40, fin ? '#C00000' : '#1F4E79', 'start', 700, o);
      });
      h += txt(800, 540, '… mais en millions d\'années, cela fait des milliers de kilomètres.', 34, TXT, 'middle', 600, seg(t, 8.6, 9.4));
      return h;
    } },

    aujourdhui: { dur: 10, draw(t) {
      const s = seg(t, .5, 6.5), age = lerp(65, 0, s), P = vue(.5 + .5 * s);
      let h = carte(age, P);
      h += compteur(age);
      h += largeur(P, NORD[0], NORD[1], arrondi(TEC.distance(...NORD)), -10, -22, seg(t, 7, 7.8));
      h += largeur(P, SUD[0], SUD[1], arrondi(TEC.distance(...SUD)), 0, -22, seg(t, 7.8, 8.6));
      return h;
    } },

    limite: { dur: 8, draw(t) {
      const P = vue(1);
      let h = carte(0, P, { dorsale: 1 });
      h += compteur(0);
      h += largeur(P, NORD[0], NORD[1], arrondi(TEC.distance(...NORD)), -10, -22, 1);
      h += largeur(P, SUD[0], SUD[1], arrondi(TEC.distance(...SUD)), 0, -22, 1);
      const [x, y] = P(TEC.centre(SUD));
      h += txt(x, y + 60, 'plus large au sud', 36, '#C00000', 'middle', 700, seg(t, .6, 1.4));
      // légende des âges
      const o = seg(t, 2.4, 3.2);
      h += `<g opacity="${o}"><rect x="1150" y="400" width="430" height="150" rx="16" fill="#fff" stroke="#9FB3CC" stroke-width="3"/>` +
        txt(1365, 448, 'âge du fond océanique', 30, TXT, 'middle', 700) +
        `<rect x="1180" y="468" width="370" height="28" rx="6" fill="url(#ages)"/>` +
        txt(1180, 530, 'jeune', 28, '#B3001B', 'start', 700) + txt(1550, 530, 'ancien', 28, '#2F5F8F', 'end', 700) + '</g>';
      h += CARTE.encart([['modèle : vitesse constante', 30, '#9A4A00', 700]], seg(t, 4.4, 5.2), 1150, 230, 430);
      return h;
    } },
  });
})();
