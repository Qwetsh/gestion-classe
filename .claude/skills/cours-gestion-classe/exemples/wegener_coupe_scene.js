/* Animation B — « Brise-glace ou plaque ? » (correction de Wegener, question 4 b).
   Coupe schématique (épaisseurs exagérées), scène 1600 x 570. D'abord l'idée de Wegener (le continent
   avance à travers le fond de l'océan, comme un brise-glace) et pourquoi elle est impossible ; puis le
   vrai mécanisme de l'activité 2 : la plaque (lithosphère, cerclée de vert) glisse sur l'asthénosphère
   solide en portant le continent ; à la dorsale, de la nouvelle plaque se forme. Couleurs : TEC.COUPE. */
(() => {
  const K = TEC.COUPE;
  const MER = 120, FOND = 188, CROUTE = 214, BASE = 345, TOP = 92, RACINE = 268;

  const ciel = () => `<rect width="1600" height="570" fill="${K.ciel}"/>`;
  const eau = (x0 = 0, x1 = 1600) => `<rect x="${x0}" y="${MER}" width="${x1 - x0}" height="${FOND - MER + 2}" fill="${K.eau}"/>` +
    `<line x1="${x0}" y1="${MER}" x2="${x1}" y2="${MER}" stroke="${K.eauFonce}" stroke-width="3"/>`;
  /** Un bloc continental posé de x à x + w (sa racine descend sous le fond de l'océan). */
  function continent(x, w, nom, couleur = K.croC) {
    const p = [[x, FOND], [x + 70, TOP + 10], [x + 120, TOP], [x + w - 120, TOP], [x + w - 70, TOP + 10], [x + w, FOND],
      [x + w - 50, RACINE - 28], [x + w - 150, RACINE], [x + 150, RACINE], [x + 50, RACINE - 28]];
    let h = `<polygon points="${p.map(([a, b]) => f(a) + ',' + f(b)).join(' ')}" fill="${couleur}" stroke="${K.croCtrait}" stroke-width="3" stroke-linejoin="round"/>`;
    if (nom) h += txt(x + w / 2, TOP + 82, nom, 36, '#5A4020', 'middle', 700);
    return h;
  }
  function asthenosphere(t, cisaille = 0) {
    let h = `<rect x="0" y="${BASE}" width="1600" height="${570 - BASE}" fill="${K.astheno}"/>`;
    for (let i = 0; i < 5; i++) {
      const y = BASE + 40 + i * 42, d = cisaille * (1 - i / 5);
      h += `<path d="M-20,${y} C300,${y - 10} 500,${y + 10} 800,${y} S1300,${y - 8} 1620,${y}" fill="none" stroke="${K.asthenoFonce}" stroke-width="3" opacity=".55" transform="translate(${f(-d)},0)"/>`;
    }
    return h;
  }
  /** La plaque : croûte océanique + manteau rigide, de x0 à x1, et son contour vert (lithosphère). */
  function plaque(x0, x1) {
    return `<rect x="${x0}" y="${FOND}" width="${x1 - x0}" height="${CROUTE - FOND}" fill="${K.croO}"/>` +
      `<rect x="${x0}" y="${CROUTE}" width="${x1 - x0}" height="${BASE - CROUTE}" fill="${K.manteauLitho}"/>` + texture(x0, x1);
  }
  /** Le grain de la roche : traits clairs dans la croûte océanique, cristaux dans le manteau rigide.
      Il est dessiné avec la plaque : quand la plaque glisse, on le voit défiler (Thomas, 21/11/2026 :
      « on ne voit pas la plaque qui glisse, juste le continent »). `bas(x)` : base de la plaque. */
  function grain(x, bas = BASE, R = rng(Math.round(x * 7) + 3)) {
    let h = `<line x1="${f(x)}" y1="${FOND + 5}" x2="${f(x + 8)}" y2="${CROUTE - 5}" stroke="#9AAABD" stroke-width="3.5" stroke-linecap="round"/>`;
    const haut = bas - CROUTE;
    if (haut < 26) return h;
    for (let k = 0; k < Math.max(1, Math.round(haut / 45)); k++) {
      const cx = x + R() * 40, cy = CROUTE + 13 + R() * (haut - 26), rx = 7 + R() * 7;
      h += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(rx * .55)}" fill="#8F7C60" opacity=".75" transform="rotate(${f(R() * 50 - 25)},${f(cx)},${f(cy)})"/>`;
    }
    return h;
  }
  function texture(x0, x1) {
    let h = '';
    for (let x = x0 + 14; x < x1 - 30; x += 46) h += grain(x);
    return h;
  }
  const contourPlaque = (x0, x1, op = 1, cx, cw) => {
    // le dessus suit le fond de l'océan et le continent ; le dessous, la base de la plaque
    const haut = cx === undefined ? [[x0, FOND], [x1, FOND]] :
      [[x0, FOND], [cx, FOND], [cx + 70, TOP + 10], [cx + 120, TOP], [cx + cw - 120, TOP], [cx + cw - 70, TOP + 10], [cx + cw, FOND], [x1, FOND]];
    const pts = [...haut, [x1, BASE], [x0, BASE]];
    return `<polygon points="${pts.map(([a, b]) => f(a) + ',' + f(b)).join(' ')}" fill="none" stroke="${K.vert}" stroke-width="6" stroke-linejoin="round" opacity="${op}"/>`;
  };
  const gauche = (x, y, op = 1, col = '#1F3864') => `<g opacity="${op}"><path d="M${x + 60},${y} H${x}" stroke="${col}" stroke-width="7" marker-end="url(#flB)"/></g>`;
  function gps(x, op = 1) {
    return `<g opacity="${op}"><line x1="${x}" y1="${TOP}" x2="${x}" y2="${TOP - 46}" stroke="#333" stroke-width="4"/>` +
      `<path d="M${x - 22},${TOP - 46} Q${x},${TOP - 70} ${x + 22},${TOP - 46} Z" fill="#fff" stroke="#333" stroke-width="3"/>` +
      txt(x + 30, TOP - 40, 'GPS', 26, '#333', 'start', 700) + '</g>';
  }
  /** Encart : un brise-glace avance dans la banquise (l'image du document 5). */
  function briseGlace(t, op = 1) {
    const X = 1150, Y = 18, W = 430, H = 190, b = X + 40 + 300 * seg(t, .5, 7.5);
    let h = `<g opacity="${op}"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="14" fill="#CFE6F5" stroke="#9FB3CC" stroke-width="3"/>`;
    const R = rng(4);
    for (let i = 0; i < 26; i++) {
      const cx = X + 20 + (i % 9) * 48 + R() * 14, cy = Y + 24 + Math.floor(i / 9) * 40 + R() * 10;
      if (Math.abs(cy - (Y + 74)) < 26 && cx < b + 30) continue;   // le chenal ouvert derrière le navire
      const r = 16 + R() * 8, pts = [];
      for (let k = 0; k < 6; k++) { const a = k * 60 + R() * 25; pts.push(f(cx + r * Math.cos(a * D)) + ',' + f(cy + r * .7 * Math.sin(a * D))); }
      h += `<polygon points="${pts.join(' ')}" fill="#fff" stroke="#B8CFE0" stroke-width="2"/>`;
    }
    h += `<path d="M${b - 70},${Y + 64} H${b + 6} L${b + 26},${Y + 74} L${b + 6},${Y + 84} H${b - 70} Z" fill="#C62828"/>` +
      `<rect x="${b - 52}" y="${Y + 52}" width="34" height="14" fill="#fff" stroke="#555" stroke-width="2"/>`;
    h += txt(X + W / 2, Y + H - 18, 'un brise-glace dans la banquise', 30, '#1F3864', 'middle', 700) + '</g>';
    return h;
  }

  GC.play({
    idee: { dur: 8, draw(t) {
      const x = lerp(140, 470, seg(t, .6, 7));
      let h = ciel() + eau();
      // l'idée de Wegener : un fond d'océan rocheux, un continent qui le traverse
      h += `<rect x="0" y="${FOND}" width="1600" height="${BASE - FOND}" fill="${K.croO}"/>`;
      h += continent(x, 440, 'continent');
      h += txt(1000, 290, 'fond de l\'océan', 38, '#fff', 'middle', 700).replace('stroke="#fff"', `stroke="${K.croO}"`);
      h += `<path d="M${f(x + 470)},${TOP + 40} H${f(x + 600)}" stroke="#C00000" stroke-width="7" marker-end="url(#fl)" opacity="${seg(t, 1, 1.6)}"/>`;
      h += txt(x + 220, TOP - 26, 'roches légères', 32, '#5A4020', 'middle', 600, seg(t, 1.6, 2.4));
      h += txt(800, 440, 'Wegener : le continent avance', 40, '#1F3864', 'middle', 700, seg(t, 2.2, 3));
      h += txt(800, 492, 'à travers le fond de l\'océan', 40, '#1F3864', 'middle', 700, seg(t, 2.2, 3));
      h += briseGlace(t, seg(t, 3.4, 4.2));
      return h;
    } },

    bloque: { dur: 7, draw(t) {
      const choc = seg(t, 0, 1.4), trem = t > 1.4 && t < 3 ? 6 * Math.sin(t * 40) * (1 - seg(t, 1.4, 3)) : 0;
      const x = lerp(470, 520, choc) + trem;
      let h = ciel() + eau();
      h += `<rect x="0" y="${FOND}" width="1600" height="${BASE - FOND}" fill="${K.croO}"/>`;
      // le fond, très rigide, résiste : zone de choc à l'avant
      const o = seg(t, 1, 1.8);
      for (let i = 0; i < 5; i++) {
        const y = FOND + 20 + i * 28;
        h += `<path d="M${f(x + 448)},${y} l22,-10 l-8,14 l26,-8 l-10,16 l28,-6" fill="none" stroke="#FFB4A8" stroke-width="4" opacity="${o}"/>`;
      }
      h += continent(x, 440, 'continent');
      h += txt(1180, 290, 'très rigide', 40, '#fff', 'middle', 700, o).replace('stroke="#fff"', `stroke="${K.croO}"`);
      h += ko(1060, 60, seg(t, 2, 2.5)) + txt(1100, 74, 'Impossible !', 48, '#C00000', 'start', 800, seg(t, 2, 2.5));
      h += txt(800, 440, 'Aucune force connue n\'est assez puissante', 38, TXT, 'middle', 700, seg(t, 3.2, 4));
      h += txt(800, 490, 'pour pousser un continent dans le fond de l\'océan.', 38, TXT, 'middle', 700, seg(t, 3.2, 4));
      return h;
    } },

    plaque: { dur: 9, draw(t) {
      const cx = 250, cw = 440;
      let h = ciel() + eau() + asthenosphere(t) + plaque(-20, 1620) + continent(cx, cw);
      const L = (i) => seg(t, .6 + i * 1.3, 1.3 + i * 1.3);
      h += txt(cx + cw / 2, 190, 'croûte continentale', 34, '#5A4020', 'middle', 700, L(0));
      h += txt(1150, 165, 'croûte océanique', 34, '#33414F', 'middle', 700, L(1)) + `<line x1="1150" y1="172" x2="1150" y2="${FOND + 12}" stroke="#33414F" stroke-width="3" opacity="${L(1)}"/>`;
      h += txt(1150, 292, 'manteau rigide', 36, '#4A3A22', 'middle', 700, L(2));
      h += contourPlaque(-20, 1620, L(3), cx, cw);
      h += txt(1580, 60, 'la plaque = la lithosphère (≈ 100 km)', 36, K.vert, 'end', 800, L(3));
      h += txt(800, 440, 'l\'asthénosphère', 40, '#7A5326', 'middle', 700, L(4));
      h += txt(800, 488, 'solide, elle se déforme très lentement', 34, '#7A5326', 'middle', 600, L(4));
      return h;
    } },

    glisse: { dur: 9, draw(t) {
      const s = seg(t, .8, 7.5), dx = -300 * s, cx = 600 + dx, cw = 440;
      let h = ciel() + eau() + asthenosphere(t, 60 * s);
      // la plaque entière (croûte, manteau rigide, son grain, ses flèches) défile avec le continent
      h += `<g transform="translate(${f(dx)},0)">${plaque(-20, 2240)}`;
      for (let i = 0; i < 6; i++) h += gauche(300 + i * 330, 280, seg(t, .4, 1));
      h += `</g>` + continent(cx, cw, 'continent');
      h += contourPlaque(-20 + dx, 2240 + dx, 1, cx, cw) + gps(cx + 220, seg(t, 1, 1.6));
      // un repère fixe : la plaque passe devant lui
      const o = seg(t, .2, .8);
      h += `<line x1="1300" y1="40" x2="1300" y2="${BASE + 30}" stroke="#C00000" stroke-width="4" stroke-dasharray="12 9" opacity="${o}"/>` +
        txt(1312, 62, 'repère fixe', 30, '#C00000', 'start', 700, o);
      h += txt(800, 440, 'toute la plaque glisse sur l\'asthénosphère', 40, '#1F3864', 'middle', 700, seg(t, 1.8, 2.6));
      h += txt(800, 492, 'le continent est transporté avec elle', 38, K.vert, 'middle', 700, seg(t, 4, 4.8));
      return h;
    } },

    dorsale: { dur: 9, draw(t) {
      const s = seg(t, .8, 7.5), e = 110 * s, R = 800;
      // sous la dorsale, l'asthénosphère remonte jusqu'à la plaque amincie
      let h = ciel() + eau() + `<rect x="0" y="${CROUTE}" width="1600" height="${BASE - CROUTE}" fill="${K.astheno}"/>` + asthenosphere(t);
      // base de la plaque : mince à la dorsale, épaisse plus loin (la plaque refroidit en s'éloignant)
      const base = (x) => FOND + 20 + (BASE - FOND - 20) * Math.min(1, Math.sqrt(Math.abs(x - R) / 520));
      const col = (age) => { const u = clamp(age); return u < .5 ? `rgb(${Math.round(lerp(228, 243, u * 2))},${Math.round(lerp(87, 201, u * 2))},${Math.round(lerp(46, 105, u * 2))})` : `rgb(${Math.round(lerp(243, 78, u * 2 - 1))},${Math.round(lerp(201, 127, u * 2 - 1))},${Math.round(lerp(105, 176, u * 2 - 1))})`; };
      for (const sg of [-1, 1]) {
        // le manteau rigide des deux plaques (sous la croûte), puis les bandes de croûte neuve
        const pts = []; for (let x = 0; x <= 800; x += 20) { const X = R + sg * x; pts.push([X, base(X)]); }
        h += `<polygon points="${f(R)},${CROUTE} ${pts.map(([a, b]) => f(a) + ',' + f(Math.max(b, CROUTE))).join(' ')} ${f(R + sg * 800)},${CROUTE}" fill="${K.manteauLitho}"/>`;
        h += `<rect x="${sg < 0 ? -20 : R}" y="${FOND}" width="820" height="${CROUTE - FOND}" fill="${K.croO}"/>`;
        for (let k = 0; k < 8; k++) {
          const a0 = k * 20, a1 = (k + 1) * 20;
          if (a0 > e) break;
          const x0 = R + sg * a0, x1 = R + sg * Math.min(a1, e);
          h += `<rect x="${f(Math.min(x0, x1))}" y="${FOND}" width="${f(Math.abs(x1 - x0))}" height="${CROUTE - FOND}" fill="${col(1 - (k * 20 + 10) / Math.max(e, 1))}"/>`;
        }
        // le grain de la plaque déjà formée s'éloigne de la dorsale avec elle
        for (let k = 0; k < 18; k++) {
          const X = R + sg * (e + 20 + k * 46);
          if (Math.abs(X - R) > 800) break;
          h += grain(X - (sg < 0 ? 40 : 0), Math.max(base(X), CROUTE), rng(50 + k * 13 + (sg < 0 ? 0 : 7)));
        }
        const cx = sg < 0 ? 150 - e : 1010 + e;
        h += continent(cx, 440, sg < 0 ? 'Amérique du Sud' : 'Afrique');
        h += `<g opacity="${seg(t, .8, 1.4) * (1 - seg(t, 7.6, 8.4))}"><path d="M${R + sg * 260},282 H${R + sg * 360}" stroke="#1F3864" stroke-width="7" marker-end="url(#flB)"/></g>`;
        // la base de chaque plaque, en vert comme dans l'activité 2
        const bord = []; for (let x = 4; x <= 820; x += 20) { const X = R + sg * x; bord.push(f(X) + ',' + f(Math.max(base(X), CROUTE))); }
        h += `<polyline points="${bord.join(' ')}" fill="none" stroke="${K.vert}" stroke-width="6" stroke-linejoin="round"/>`;
      }
      h += `<path d="M${R - 150},${FOND} Q${R - 60},${FOND - 24} ${R},${FOND - 30} Q${R + 60},${FOND - 24} ${R + 150},${FOND}" fill="${K.croO}" stroke="${K.croO}"/>`;
      h += `<line x1="${R}" y1="${FOND - 34}" x2="${R}" y2="${FOND + 30}" stroke="#B3001B" stroke-width="6"/>`;
      // l'asthénosphère monte lentement sous la dorsale
      const o = seg(t, 2.6, 3.4);
      for (const dxa of [-70, 0, 70]) h += `<path d="M${R + dxa},${BASE + 50} V${CROUTE + 40 + Math.abs(dxa)}" stroke="#B5651D" stroke-width="5" marker-end="url(#fl)" opacity="${o}"/>`;
      h += txt(R, 70, 'la dorsale', 40, '#B3001B', 'middle', 800, seg(t, 1.6, 2.4));
      h += txt(800, 440, 'à la dorsale, de la nouvelle plaque se forme', 40, '#1F3864', 'middle', 700, seg(t, 3.6, 4.4));
      h += txt(800, 492, 'les deux plaques s\'écartent', 38, K.vert, 'middle', 700, seg(t, 5, 5.8));
      return h;
    } },

    lave: { dur: 8, draw(t) {
      const cx = 300, cw = 440;
      let h = ciel() + eau() + asthenosphere(t) + plaque(-20, 1620) + continent(cx, cw, 'continent') + contourPlaque(-20, 1620, 1, cx, cw);
      h += txt(1180, 290, 'la plaque', 38, K.vert, 'middle', 800);
      const o = seg(t, .4, 1);
      h += txt(800, 470, 'de la lave ?', 54, '#E4572E', 'middle', 800, o);
      const b = seg(t, 1.8, 2.4);
      h += `<line x1="640" y1="452" x2="${f(640 + 320 * b)}" y2="452" stroke="#C00000" stroke-width="9" stroke-linecap="round"/>`;
      h += ko(1000, 452, seg(t, 2.4, 2.8));
      h += txt(800, 540, 'non : l\'asthénosphère est solide', 36, '#C00000', 'middle', 700, seg(t, 3, 3.6));
      h += ok(1350, 60, seg(t, 4.4, 4.9)) + txt(1320, 74, 'le continent est porté par sa plaque', 34, K.vert, 'end', 800, seg(t, 4.4, 4.9));
      return h;
    } },
  });
})();
