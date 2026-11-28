/* Animation C — « Pin ou chêne ? Le calendrier des poils urticants » (5e S2 A1, correction de la
   question 1). Une roue des 12 mois (janvier en haut, sens des aiguilles d'une montre), deux anneaux :
   processionnaire du pin urticante de novembre à avril, du chêne de mai à juillet. Un curseur tourne
   jusqu'à « fin juin » (message de la mairie) : seul l'anneau du chêne reste allumé.
   Dessins : animation/banque/chenilles.js. Scène 1600 x 570 (cadre posé au-dessus de y = 450). */
(() => {
  const K = CHEN.COUL, CX = 290, CY = 287;
  const R = { moisIn: 208, moisOut: 262, pinIn: 150, pinOut: 202, cheIn: 92, cheOut: 144, centre: 86 };
  const PIN = [300, 480], CHE = [120, 210];          // nov. → avr. ; mai → juil. (degrés depuis le 1er janvier)
  const FIN_JUIN = 179;
  const dans = (a, [a1, a2]) => { a = ((a % 360) + 360) % 360; return (a >= a1 && a < a2) || (a + 360 >= a1 && a + 360 < a2); };
  const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function roue(o) {
    let h = '';
    // les mois
    for (let i = 0; i < 12; i++) {
      const op = o.mois ?? 1;
      h += `<path d="${CHEN.secteur(CX, CY, R.moisIn, R.moisOut, i * 30, i * 30 + 30)}" fill="${i % 2 ? '#F4F1EA' : '#FBFAF6'}" stroke="#C9C2B2" stroke-width="2" opacity="${op}"/>`;
      const [x, y] = CHEN.roueP(CX, CY, (R.moisIn + R.moisOut) / 2, i * 30 + 15);
      h += txt(x, y + 9, CHEN.MOIS[i], 25, i === 5 && o.juin ? '#C00000' : K.encre, 'middle', i === 5 && o.juin ? 700 : 500, op);
    }
    // fonds des anneaux
    h += `<path d="${CHEN.secteur(CX, CY, R.pinIn, R.pinOut, 0, 360)}" fill="#EEF1EE" stroke="#D5DBD5" stroke-width="2"/>`;
    h += `<path d="${CHEN.secteur(CX, CY, R.cheIn, R.cheOut, 0, 360)}" fill="#F3EEE6" stroke="#DED4C4" stroke-width="2"/>`;
    // anneau du pin, puis du chêne (p : part tracée, eclat : allumé ou non)
    const anneau = (r1, r2, [a1, a2], p, col, eclat, nom, aNom) => {
      if (p <= 0) return '';
      const a = a1 + (a2 - a1) * p, op = .3 + .7 * eclat;
      let s = '';
      if (eclat > .05) s += `<path d="${CHEN.secteur(CX, CY, r1 - 6, r2 + 6, a1, a)}" fill="${col}" opacity="${f(.25 * eclat)}"/>`;
      s += `<path d="${CHEN.secteur(CX, CY, r1, r2, a1, a)}" fill="${col}" opacity="${f(op)}"/>`;
      if (p > .5) { const [x, y] = CHEN.roueP(CX, CY, (r1 + r2) / 2, aNom); s += `<text x="${f(x)}" y="${f(y + 9)}" font-size="26" font-weight="700" fill="#fff" text-anchor="middle" opacity="${f(seg(p, .5, .8) * op)}">${nom}</text>`; }
      return s;
    };
    h += anneau(R.pinIn, R.pinOut, PIN, o.pin ?? 0, K.pin, o.ePin ?? 1, 'pin', 30);
    h += anneau(R.cheIn, R.cheOut, CHE, o.che ?? 0, K.chene, o.eChe ?? 1, 'chêne', 140);
    // centre
    h += `<circle cx="${CX}" cy="${CY}" r="${R.centre}" fill="#fff" stroke="#C9C2B2" stroke-width="3"/>`;
    if (o.centre) h += o.centre;
    // curseur
    if (o.curseur != null) {
      const [x1, y1] = CHEN.roueP(CX, CY, R.centre + 2, o.curseur), [x2, y2] = CHEN.roueP(CX, CY, R.moisOut + 8, o.curseur);
      h += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#C00000" stroke-width="7" stroke-linecap="round"/>`;
      h += `<circle cx="${f(x2)}" cy="${f(y2)}" r="11" fill="#C00000" stroke="#fff" stroke-width="3"/>`;
    }
    return h;
  }

  /** Carte d'une espèce (dessin + nom + période), à droite de la roue. */
  function carte(y, espece, op, etat = {}) {
    if (op <= 0) return '';
    const col = espece === 'pin' ? K.pin : K.chene, x = 620, w = 960, hgt = 150;
    const grise = etat.ko || 0, allume = etat.ok || 0;
    let h = `<g opacity="${f(op * (1 - .45 * grise))}">`;
    h += `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="18" fill="#fff" stroke="${col}" stroke-width="${f(3 + 4 * allume)}"/>`;
    if (espece === 'pin') {
      h += CHEN.pin(x + 85, y + 140, 1.15);
      h += CHEN.nid(x + 118, y + 46, .32);
    } else {
      h += CHEN.chene(x + 85, y + 142, .58);
      h += CHEN.nid(x + 96, y + 116, .24);
    }
    h += CHEN.chenille(x + 170, y + 128, 0, .9, 0);
    h += txt(x + 200, y + 58, `processionnaire du ${espece}`, 34, col, 'start', 700);
    h += txt(x + 200, y + 106, espece === 'pin' ? 'urticante de novembre à avril' : 'urticante de mai à juillet', 30, K.encre, 'start', 500);
    h += '</g>';
    if (etat.ko) h += ko(x + w - 50, y + hgt / 2, etat.ko);
    if (etat.ok) h += ok(x + w - 50, y + hgt / 2, etat.ok);
    return h;
  }
  const fond = () => CHEN.defs() + `<rect width="1600" height="570" fill="#FFFFFF"/>`;
  /** Angle du curseur → libellé du centre. */
  const centreMois = (a, rouge) => {
    const m = MOIS_LONG[Math.min(11, Math.floor(((a % 360) + 360) % 360 / 30))];
    return txt(CX, CY - 22, rouge ? 'fin' : '', 30, '#C00000', 'middle', 700) + txt(CX, CY + (rouge ? 20 : 10), m, rouge ? 36 : 30, rouge ? '#C00000' : K.encre, 'middle', 700);
  };

  GC.play({
    calendrier: { dur: 9, draw(t) {
      let h = fond();
      h += roue({ mois: seg(t, 0, 1), pin: seg(t, 1.2, 4), che: seg(t, 4.8, 6.8),
        centre: txt(CX, CY - 4, 'poils', 28, K.encre, 'middle', 700, seg(t, .5, 1.2)) + txt(CX, CY + 30, 'urticants', 28, K.encre, 'middle', 700, seg(t, .5, 1.2)) });
      h += txt(620, 92, 'Quand les poils sont-ils urticants ?', 38, K.bleu, 'start', 700, seg(t, .3, 1));
      h += carte(150, 'pin', seg(t, 1.8, 2.6));
      h += carte(330, 'chêne', seg(t, 5.2, 6));
      return h;
    } },

    mairie: { dur: 9, draw(t) {
      let h = fond();
      const a = lerp(0, FIN_JUIN, seg(t, .6, 6)), fin = seg(t, 6, 6.5);
      const pinOn = dans(a, PIN) ? 1 : 0, cheOn = dans(a, CHE) ? 1 : 0;
      h += roue({ pin: 1, che: 1, ePin: pinOn, eChe: cheOn, curseur: a, juin: fin > .5, centre: centreMois(a, fin > .5) });
      // le message de la mairie
      const o = seg(t, 6.4, 7.1);
      if (o > 0) {
        h += `<g opacity="${f(o)}"><rect x="620" y="22" width="960" height="104" rx="18" fill="#FFF4E5" stroke="#E07B00" stroke-width="3"/>` +
          `<path d="M640,126 L612,150 L668,126Z" fill="#FFF4E5" stroke="#E07B00" stroke-width="3" stroke-linejoin="round"/><rect x="636" y="118" width="40" height="10" fill="#FFF4E5"/>` +
          txt(650, 64, 'Mairie de Woippy, parc du Pâtis :', 28, '#9A4A00', 'start', 700) +
          txt(650, 106, '« danger jusqu’à la fin juin 2020 »', 34, K.encre, 'start', 700) + '</g>';
      } else {
        h += txt(620, 92, 'Le curseur avance dans l’année…', 38, K.bleu, 'start', 700, 1 - seg(t, 5.6, 6.2));
      }
      h += carte(170, 'pin', 1, { ko: seg(t, 7.3, 7.8) });
      h += carte(350, 'chêne', 1, { ok: seg(t, 7.6, 8.1) });
      // les cartes s'allument avec leur anneau tant que le curseur tourne
      if (t < 6.4) {
        if (pinOn) h += `<rect x="620" y="170" width="960" height="150" rx="18" fill="none" stroke="${K.pin}" stroke-width="8"/>`;
        if (cheOn) h += `<rect x="620" y="350" width="960" height="150" rx="18" fill="none" stroke="${K.chene}" stroke-width="8"/>`;
      }
      return h;
    } },

    patis: { dur: 9, draw(t) {
      let h = fond();
      h += roue({ pin: 1, che: 1, ePin: 0, eChe: 1, curseur: FIN_JUIN, juin: true, centre: centreMois(FIN_JUIN, true) });
      // le parc du Pâtis : un chêne, son nid collé au tronc, une procession qui monte
      const o = seg(t, 0, 1);
      h += `<g opacity="${f(o)}">`;
      h += `<ellipse cx="760" cy="548" rx="190" ry="22" fill="#CFE3B5"/>`;
      h += CHEN.chene(760, 545, 1.3);
      h += CHEN.nid(782, 452, .42);
      const chemin = [[600, 552], [700, 550], [748, 548], [751, 500], [762, 480]];
      h += CHEN.procession(chemin, 4, lerp(40, CHEN.longueur(chemin) - 4, seg(t, .6, 6)), 46, .78, t * 9);
      h += txt(760, 215, 'parc du Pâtis, fin juin', 28, '#4F7A2A', 'middle', 700);
      h += '</g>';
      const X = 960;
      h += txt(X, 110, 'processionnaire du chêne', 46, '#C00000', 'start', 700, seg(t, 1.2, 2));
      const indices = [['Indice 1 : la date', ['fin juin, seule la chenille du chêne', 'est urticante']],
        ['Indice 2 : la répartition', ['la chenille du pin n’est pas', 'installée en Lorraine']]];
      indices.forEach(([titre, lignes], i) => {
        const oi = seg(t, 3 + i * 2, 3.7 + i * 2), y = 200 + i * 150;
        h += ok(X + 22, y - 10, oi);
        h += txt(X + 60, y, titre, 28, K.bleu, 'start', 700, oi);
        lignes.forEach((l, k) => { h += txt(X + 60, y + 38 + k * 34, l, 26, K.encre, 'start', 500, oi); });
      });
      return h;
    } },
  });
})();
