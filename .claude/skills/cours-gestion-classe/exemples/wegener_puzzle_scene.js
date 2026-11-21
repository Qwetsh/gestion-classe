/* Animation A — « Le puzzle se ferme » (correction de Wegener, question 1).
   Les vrais contours de la fiche (Natural Earth) ; l'Amérique du Sud revient contre l'Afrique par la
   rotation de Bullard (1965), sur la sphère. Carte : wegener_carte.js ; banque : tectonique.js. */
(() => {
  const TIP = 225;                       // pointe est du Brésil (cap São Roque) dans TEC.SA
  const COLLE = TEC.SA_A(0), MSA0 = TEC.SA_A(0, TEC.MSA);
  // Les deux plus grands vides le long de la côte africaine, une fois les pièces assemblées
  const vides = (() => {
    const d = TEC.J.map((p) => Math.min(...COLLE.map((q) => TEC.distance(p, q))));
    const pick = (a, b) => { let m = a; for (let i = a; i < b; i++) if (d[i] > d[m]) m = i; return TEC.J[m]; };
    const n = TEC.J.length;
    return [pick(Math.round(n * .15), Math.round(n * .5)), pick(Math.round(n * .55), Math.round(n * .95))];
  })();
  const zoom = (t, a, b) => CARTE.vue(seg(t, a, b));

  GC.play({
    actuel: { dur: 6, draw(t) {
      const P = CARTE.vue(0), o = seg(t, 0, 1.2);
      let h = CARTE.fond() + CARTE.equateur(P, o);
      h += CARTE.continent(TEC.SA, P, o) + CARTE.continent(TEC.AF, P, o);
      const [ax, ay] = P([-60, -12]), [fx, fy] = P([20, 5]), [ox, oy] = P([-18, -22]);
      h += txt(ax, ay, 'Amérique', 38, TXT, 'middle', 700, seg(t, 1.2, 2)) + txt(ax, ay + 44, 'du Sud', 38, TXT, 'middle', 700, seg(t, 1.2, 2));
      h += txt(fx, fy, 'Afrique', 40, TXT, 'middle', 700, seg(t, 1.6, 2.4));
      h += txt(ox, oy, 'Océan', 36, '#2F6690', 'middle', 600, seg(t, 2.4, 3.2)) + txt(ox, oy + 42, 'Atlantique', 36, '#2F6690', 'middle', 600, seg(t, 2.4, 3.2));
      h += CARTE.encart([['Aujourd\'hui', 40, '#1F4E79']], seg(t, 3, 3.8));
      return h;
    } },

    rapprochement: { dur: 9, draw(t) {
      const s = seg(t, .8, 7.2), w = 57 * (1 - s), P = zoom(t, 5.5, 8.8);
      let h = CARTE.fond() + CARTE.equateur(P);
      const SAw = TEC.SA_A(w);
      // trajet de la pointe du Brésil
      const trace = []; for (let k = 0; k <= 40; k++) { const wk = 57 - (57 - w) * k / 40; trace.push(TEC.SA_A(wk, [TEC.SA[TIP]])[0]); }
      h += CARTE.continent(TEC.AF, P) + CARTE.continent(SAw, P);
      h += `<path d="${TEC.chemin(trace, P, false)}" fill="none" stroke="#C00000" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round"/>`;
      const [tx, ty] = P(SAw[TIP]);
      h += `<circle cx="${f(tx)}" cy="${f(ty)}" r="10" fill="#C00000" stroke="#fff" stroke-width="3"/>`;
      h += CARTE.etiquette(P, SAw[TIP], -40, -70, 'la pointe du Brésil', 34, '#C00000', seg(t, .3, 1) * (1 - seg(t, 3.5, 4.2)));
      h += CARTE.etiquette(P, SAw[TIP], 130, 30, 'dans le golfe de Guinée', 34, '#C00000', seg(t, 7.4, 8.2));
      const [ox, oy] = P([-18, -22]);
      h += txt(ox, oy, 'Océan Atlantique', 34, '#2F6690', 'middle', 600, 1 - seg(t, .8, 2.5));
      return h;
    } },

    emboitement: { dur: 7, draw(t) {
      const P = CARTE.vue(1);
      let h = CARTE.fond() + CARTE.equateur(P, .6);
      h += CARTE.continent(TEC.AF, P) + CARTE.continent(COLLE, P);
      // la côte commune s'allume, du nord au sud
      const n = Math.max(2, Math.round(TEC.J.length * seg(t, .4, 3.4)));
      h += `<path d="${TEC.chemin(TEC.J.slice(0, n), P, false)}" fill="none" stroke="#E07B00" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
      h += CARTE.etiquette(P, TEC.J[Math.round(TEC.J.length * .62)], 230, 40, 'les côtes s\'emboîtent', 38, '#B35F00', seg(t, 2.6, 3.4));
      const o = seg(t, 4.2, 5);
      h += CARTE.etiquette(P, vides[0], -300, -80, 'un petit vide', 34, '#1F4E79', o, 600);
      h += CARTE.etiquette(P, vides[1], -330, 90, 'un petit vide', 34, '#1F4E79', seg(t, 4.8, 5.6), 600);
      return h;
    } },

    fossiles: { dur: 8, draw(t) {
      const P = CARTE.vue(1);
      let h = CARTE.fond() + CARTE.equateur(P, .6);
      h += CARTE.continent(TEC.AF, P) + CARTE.continent(COLLE, P);
      const pulse = .5 + .5 * Math.sin(t * 3);
      h += CARTE.zone(MSA0, P, seg(t, .4, 1.2), t > 3 ? pulse : 0) + CARTE.zone(TEC.MAF, P, seg(t, 1.4, 2.2), t > 3 ? pulse : 0);
      const c1 = TEC.centre(MSA0), c2 = TEC.centre(TEC.MAF);
      h += CARTE.etiquette(P, c1, -330, 70, 'au Brésil', 34, CARTE.MESO, seg(t, .8, 1.5), 700);
      h += CARTE.etiquette(P, c2, 240, 50, 'en Namibie', 34, CARTE.MESO, seg(t, 1.8, 2.5), 700);
      // les deux zones se font face : une seule région
      const [x1, y1] = P(c1), [x2, y2] = P(c2), o = seg(t, 3.2, 4.2);
      h += `<ellipse cx="${f((x1 + x2) / 2)}" cy="${f((y1 + y2) / 2)}" rx="${f(Math.hypot(x2 - x1, y2 - y1) / 2 + 70)}" ry="95" transform="rotate(${f(Math.atan2(y2 - y1, x2 - x1) / D)},${f((x1 + x2) / 2)},${f((y1 + y2) / 2)})" fill="none" stroke="${CARTE.MESO}" stroke-width="4" stroke-dasharray="14 10" opacity="${o}"/>`;
      h += `<g opacity="${seg(t, 4.4, 5.2)}">${TEC.mesosaurus(1400, 250, 260, t)}</g>`;
      h += txt(1400, 340, 'Mesosaurus', 38, CARTE.MESO, 'middle', 700, seg(t, 4.4, 5.2));
      h += txt(1400, 382, "un reptile d'eau douce", 30, CARTE.MESO, 'middle', 600, seg(t, 5, 5.8));
      return h;
    } },

    talus: { dur: 8, draw(t) {
      const P = CARTE.vue(1), km = 160 * seg(t, .5, 3.5);
      let h = CARTE.fond() + CARTE.equateur(P, .6);
      h += CARTE.continent(TEC.AF, P, 1, km) + CARTE.continent(COLLE, P, 1, km);
      h += CARTE.zone(MSA0, P, .55) + CARTE.zone(TEC.MAF, P, .55);
      const bord = TEC.AF[300];
      h += CARTE.etiquette(P, [bord[0] + 3.5, bord[1] - 1], 120, 130, 'le vrai bord du continent', 36, '#7C5A2E', seg(t, 2.6, 3.4));
      const o = seg(t, 4.6, 5.4);
      h += CARTE.etiquette(P, vides[0], -300, -80, 'plus de vide', 34, '#2E9E55', o, 700);
      h += CARTE.etiquette(P, vides[1], -330, 90, 'plus de vide', 34, '#2E9E55', o, 700);
      h += CARTE.encart([['sous la mer :', 34, '#7C5A2E', 600], ['le plateau continental', 34, '#7C5A2E', 700]], seg(t, 1.2, 2), 1130, 22, 450);
      return h;
    } },
  });
})();
