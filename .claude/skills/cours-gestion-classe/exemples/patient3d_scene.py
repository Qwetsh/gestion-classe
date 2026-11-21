"""Scène riche « Une patiente fiévreuse » (3e, séquence 2) : démonstration des scènes 3D du tableau.

Exemple complet d'une scène riche : la patiente Eve Amalle de l'hôpital virtuel en 3D (modèle GLB
joint), gros plans sur ses symptômes avec des étiquettes qui suivent le modèle, puis son frottis
sanguin (photo jointe) qui se rapproche, les globules blancs entourés à leur vraie position (données
de l'hôpital). Banque `scene3d`, bibliothèque `three`.

    python -I patient3d_scene.py <sortie.html> [dossier des images de contrôle]

Dans le tableau : envoyer les deux fichiers (`gc_envoi.py fichier`), puis
`e.animation(code, fichiers={'patient.glb': <chemin>, 'frottis.jpg': <chemin>}, interactif=True)`.
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
import gc_animation as A  # noqa: E402

HOPITAL = 'C:/dev/hopital-virtuel'
FICHIERS = {
    'patient.glb': os.path.join(HOPITAL, 'public', 'models', 'fille-fievreuse.glb'),
    'frottis.jpg': os.path.join(HOPITAL, 'public', 'images', 'lames', 'frottis-yve.jpg'),
}

ETAPES = [
    A.etape('accueil', 'Une patiente arrive à l’hôpital', 'Elle se sent <b>très fatiguée</b> depuis une semaine. Observons-la.'),
    A.etape('fievre', 'Premier symptôme : la fièvre', 'Sa température est de <b>38,8 °C</b> : c’est une <b>fièvre</b>.'),
    A.etape('ganglions', 'Deuxième symptôme : les ganglions', 'Sous la mâchoire, les <b>ganglions</b> sont gonflés et douloureux.'),
    A.etape('frottis', 'Au microscope : son sang', 'Un frottis sanguin : parmi les <b>hématies</b>, des <b>globules blancs</b>.'),
    A.etape('globules', 'Les globules blancs', 'Les <b>lymphocytes</b> et les <b>phagocytes</b> défendent l’organisme.'),
    A.etape('bilan', 'Bilan', 'Fièvre, ganglions, globules blancs : l’organisme <b>se défend contre une infection</b>.', bilan=True),
]

SCENE = r"""
(async () => {
  const s3d = S3D.create({ fond: '#EEF3F9' });
  const fille = await s3d.load('patient.glb');
  const photo = await gcAsset('frottis.jpg');
  const b = s3d.fit(fille.root, { marge: 0.95 });
  const H = b.size.y, c = b.center;
  // Points du corps, en fractions de la boîte du modèle (de face : z vers la caméra)
  const front = b.at(0.5, 0.90, 0.80), cou = b.at(0.5, 0.79, 0.72);
  const ggG = b.at(0.40, 0.81, 0.70), ggD = b.at(0.60, 0.81, 0.70);
  const loin = { pos: [c.x + H * 0.9, c.y + H * 0.1, c.z + H * 1.9], target: [c.x, c.y, c.z] };
  const face = { pos: [c.x, c.y, c.z + H * 1.6], target: [c.x, c.y, c.z] };
  const teteV = { pos: [front.x + H * 0.12, front.y + H * 0.02, front.z + H * 0.42], target: [front.x, front.y - H * 0.02, front.z - H * 0.08] };
  const couV = { pos: [cou.x, cou.y - H * 0.02, cou.z + H * 0.40], target: [cou.x, cou.y, cou.z - H * 0.06] };
  const point = (p, op, col) => { const q = s3d.toStage(p); return `<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(14 + 6 * Math.sin(Date.now() / 220))}" fill="none" stroke="${col}" stroke-width="5" opacity="${op}"/>`; };
  const etiquette = (p, dx, dy, texte, op, col) => { const q = s3d.toStage(p); return fleche(q.x + dx, q.y + dy, q.x + Math.sign(dx) * 22, q.y + Math.sign(dy) * 6, op, col) + txt(q.x + dx + Math.sign(dx) * 10, q.y + dy + 10, texte, 34, col, dx < 0 ? 'end' : 'start', 700, op); };

  // Le frottis : photo de 260 µm de large, cellules repérées en % de la photo (hôpital virtuel)
  const PW = 1235, PH = 760, PX = (1600 - PW) / 2;
  const cell = (x, y, r) => ({ x: PX + PW * x / 100, y: PH * y / 100, r: PW * r / 260 });
  const LY = [cell(16.8, 24.2, 4.8), cell(84.1, 80.1, 4.1)], PG = [cell(75.7, 35.2, 6.4), cell(45.7, 68.4, 6.9)];
  const lame = (z, cx, cy, extra) => `<rect x="-2000" y="-200" width="5600" height="1200" fill="#111"/><g transform="translate(${f(cx)},${f(cy)}) scale(${f(z)}) translate(${f(-cx)},${f(-cy)})">`
    + `<image href="${photo.url}" x="${PX}" y="0" width="${PW}" height="${PH}"/>${extra || ''}</g>`;
  const rond = (k, col, op, z) => `<circle cx="${f(k.x)}" cy="${f(k.y)}" r="${f(k.r * 1.35)}" fill="none" stroke="${col}" stroke-width="${f(6 / z)}" opacity="${op}"/>`;

  GC.play({
    accueil: { dur: 7, live: true,
      update(t) { s3d.pose(fille, 'Armature|clip0|baselayer', t); s3d.view(t, [{ t: 0, ...loin }, { t: 6, ...face }]); } },
    fievre: { dur: 7, live: true,
      update(t) { s3d.pose(fille, 'Armature|clip0|baselayer', t); s3d.view(t, [{ t: 0, ...face }, { t: 2.5, ...teteV }]); },
      draw(t) { const op = seg(t, 2.2, 3); return point(front, op, ROUGE) + etiquette(front, 230, -90, '38,8 °C', op, ROUGE); } },
    ganglions: { dur: 7, live: true,
      update(t) { s3d.pose(fille, 'Armature|clip0|baselayer', t); s3d.view(t, [{ t: 0, ...teteV }, { t: 2.5, ...couV }]); },
      draw(t) { const op = seg(t, 2.2, 3); return point(ggG, op, '#E07B00') + point(ggD, op, '#E07B00') + etiquette(ggD, 240, 60, 'Ganglions gonflés', op, '#E07B00'); } },
    frottis: { dur: 8,
      draw(t) { const z = lerp(1, 1.5, seg(t, 1, 7)); return lame(z, LY[0].x, LY[0].y, '') + `<rect x="-2000" y="-200" width="5600" height="1200" fill="#EEF3F9" opacity="${f(1 - seg(t, 0, 1))}"/>`
        + txt(PX + 12, 745, 'Frottis sanguin · CDC PHIL (domaine public)', 18, '#fff', 'start', 400, 0.9).replace('stroke="#fff"', 'stroke="#000"'); } },
    globules: { dur: 9,
      draw(t) {
        const z = lerp(1.5, 1, seg(t, 0, 1.5));
        const ly = LY.map((k, i) => rond(k, '#1A63C9', seg(t, 1.5 + i * 0.8, 2.2 + i * 0.8), z)).join('');
        const pg = PG.map((k, i) => rond(k, '#E07B00', seg(t, 4 + i * 0.8, 4.7 + i * 0.8), z)).join('');
        return lame(z, LY[0].x, LY[0].y, ly + pg)
          + txt(1580, 60, 'Lymphocytes', 36, '#1A63C9', 'end', 700, seg(t, 1.5, 2.2))
          + txt(1580, 110, 'Phagocytes', 36, '#E07B00', 'end', 700, seg(t, 4, 4.7));
      } },
    bilan: { dur: 6, live: true,
      update(t) { s3d.pose(fille, 'Armature|clip0|baselayer', t); s3d.view(t, [{ t: 0, ...face }]); },
      draw(t) {
        const op = seg(t, 0.3, 1.2);
        return `<rect x="-2000" y="-200" width="5600" height="1200" fill="#fff" opacity="${f(0.55 * op)}"/>`
          + txt(800, 300, 'L’organisme se défend', 64, '#C00000', 'middle', 800, op)
          + txt(800, 380, 'contre une infection.', 64, '#C00000', 'middle', 800, op);
      } },
  });
})();
"""

def code():
    return A.assembler('Une patiente fiévreuse', ETAPES, SCENE, banques=['scene3d'], bibliotheques=['three'])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sortie = sys.argv[1]
    A.ecrire(code(), sortie)
    print('écrit', sortie, len(code()), 'caractères')
    if len(sys.argv) > 2:
        os.makedirs(sys.argv[2], exist_ok=True)
        for i, t in enumerate([6.5, 6, 6, 7, 8, 5], start=1):
            A.apercu(sortie, os.path.join(sys.argv[2], 'etape-%02d.png' % i), etape=i, instant=t, fichiers=FICHIERS, attente=25000)
        print('images dans', sys.argv[2])
