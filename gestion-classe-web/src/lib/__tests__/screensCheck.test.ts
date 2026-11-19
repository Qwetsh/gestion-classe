import { describe, expect, it } from 'vitest';
import { checkScreens, estimateTextHeight, htmlLines, htmlProblem } from '../course/screensCheck';

type Obj = Record<string, unknown>;

const text = (id: string, over: Obj = {}): Obj => ({ id, type: 'text', x: 60, y: 120, w: 880, size: 28, font: 'sans', color: '#111827', html: '<div>Une phrase courte.</div>', ...over });
const page = (id: string, objects: Obj[], over: Obj = {}): Obj => ({ id, background: 'blank', strokes: [], objects, ...over });
const check = (...pages: Obj[]) => checkScreens(pages);

describe('htmlProblem', () => {
  it('accepte la mise en forme', () => {
    expect(htmlProblem('<div><b>Gras</b> et <span style="color: #C00000">rouge</span><br>suite</div>')).toBeNull();
  });

  it('refuse une balise étrangère, un attribut dangereux et un signe < nu', () => {
    expect(htmlProblem('<img src="x.png">')).toMatch(/balise refusée/);
    expect(htmlProblem('<div onclick="x()">a</div>')).toMatch(/balise refusée/);
    expect(htmlProblem('<div>3 < 5</div>')).toMatch(/&lt;/);
    expect(htmlProblem('<div>3 &lt; 5</div>')).toBeNull();
  });
});

describe('estimation de la hauteur', () => {
  it('sépare les blocs', () => {
    expect(htmlLines('<div>Un</div><div>Deux<br>Trois</div><ul><li>Quatre</li></ul>')).toEqual(['Un', 'Deux', 'Trois', 'Quatre']);
  });

  it('compte une ligne pour un texte court et davantage quand il est long', () => {
    const one = estimateTextHeight('<div>Court</div>', 880, 28, false);
    const long = estimateTextHeight(`<div>${'mot '.repeat(60)}</div>`, 880, 28, false);
    expect(one).toBeCloseTo(28 * 1.34);
    expect(long).toBeGreaterThan(one * 3);
  });

  it('compte une ligne pour chaque bloc vide entre deux paragraphes', () => {
    const line = 26 * 1.34;
    expect(estimateTextHeight('<div>Un</div><div><br></div><div>Deux</div>', 880, 26, false)).toBeCloseTo(line * 3);
    expect(estimateTextHeight('<div>Un</div><div><br/></div><p>&nbsp;</p><div>Deux</div>', 880, 26, false)).toBeCloseTo(line * 4);
    // Un retour à la ligne dans un bloc qui porte du texte n'est pas un bloc vide
    expect(estimateTextHeight('<div>Un<br>Deux</div>', 880, 26, false)).toBeCloseTo(line * 2);
  });

  it('ajoute le rembourrage d’un fond coloré', () => {
    expect(estimateTextHeight('<div>Court</div>', 880, 28, true)).toBeCloseTo(28 * 1.34 + 28);
  });
});

describe('checkScreens', () => {
  it('accepte un écran simple', () => {
    const r = check(page('e-01', [text('e-01-1')]));
    expect(r).toMatchObject({ errors: [], warnings: [], pages: 1, objects: 1 });
  });

  it('accepte la liste ou un objet qui la porte', () => {
    expect(checkScreens({ pages: [page('e-01', [text('t')])] }).errors).toEqual([]);
    expect(checkScreens('rien').errors).toHaveLength(1);
  });

  it('refuse ce que le dépôt refuserait', () => {
    const r = check(page('écran 1', [text('a')]), page('e-02', [text('b')], { background: 'damier' }), page('e-02', [text('c')]));
    expect(r.errors.join('\n')).toMatch(/identifiant de page refusé/);
    expect(r.errors.join('\n')).toMatch(/fond « damier » inconnu/);
    expect(r.errors.join('\n')).toMatch(/sert déjà à une autre page/);
  });

  it('refuse un type inconnu, un champ manquant, un identifiant en double', () => {
    const r = check(page('e-01', [
      { id: 'x', type: 'hologramme', x: 0, y: 0, w: 10 },
      { id: 'y', type: 'shape', kind: 'rect', x: 10, y: 10, w: 100 },
      text('z'), text('z'),
      { id: 'w', type: 'text', x: 'gauche', y: 0, w: 10 },
    ]));
    const all = r.errors.join('\n');
    expect(all).toMatch(/type « hologramme » inconnu/);
    expect(all).toMatch(/hauteur « h » absente/);
    expect(all).toMatch(/déjà utilisé par un autre objet/);
    expect(all).toMatch(/x, y et w doivent être des nombres/);
  });

  it('refuse une image citée par une adresse ou sans chemin', () => {
    const image = (id: string, path: unknown): Obj => ({ id, type: 'image', x: 60, y: 120, w: 300, h: 200, path, naturalWidth: 900, naturalHeight: 600 });
    const r = check(page('e-01', [image('a', 'https://exemple.org/photo.png'), image('b', ''), image('c', 'u1/import/photo.png')]));
    expect(r.errors).toHaveLength(2);
  });

  it('refuse un bouton ou un cache qui vise dans le vide', () => {
    const r = check(
      page('e-01', [
        text('bouton', { interactions: [{ action: 'reveal', targetId: 'absent' }, { action: 'goto', params: { pageId: 'e-09' } }, { action: 'voler' }] }),
        text('cache', { y: 300, cover: { kind: 'brouillard', color: '#000' } }),
      ]),
    );
    const all = r.errors.join('\n');
    expect(all).toMatch(/vise un objet absent/);
    expect(all).toMatch(/page absente/);
    expect(all).toMatch(/action de bouton inconnue/);
    expect(all).toMatch(/cache inconnu/);
  });

  it('accepte un bouton dont la cible et la page existent', () => {
    const r = check(
      page('e-01', [text('reponse', { y: 300, cover: { kind: 'curtain', color: '#1F4E79' } }), text('bouton', { interactions: [{ action: 'reveal', targetId: 'reponse' }, { action: 'goto', params: { pageId: 'e-02' } }, { action: 'next' }] })]),
      page('e-02', [text('suite')]),
    );
    expect(r.errors).toEqual([]);
  });

  it('refuse ce qui sort de l’écran', () => {
    const r = check(page('e-01', [
      text('large', { x: 200, w: 900 }),
      { id: 'bas', type: 'shape', kind: 'rect', x: 60, y: 500, w: 200, h: 120, stroke: '#000', strokeWidth: 1, fill: null },
    ]));
    expect(r.errors.join('\n')).toMatch(/dépasse de l'écran/);
    expect(r.errors.join('\n')).toMatch(/sous le bas de l'écran/);
  });

  it('accepte une page allongée', () => {
    const r = check(page('e-01', [{ id: 'bas', type: 'shape', kind: 'rect', x: 60, y: 500, w: 200, h: 120, stroke: '#000', strokeWidth: 1, fill: null }], { height: 700 }));
    expect(r.errors).toEqual([]);
  });

  it('prévient d’un texte courant trop petit, pas d’une étiquette', () => {
    const long = `<div>${'Les côtes des deux continents s’emboîtent. '.repeat(3)}</div>`;
    const r = check(page('e-01', [text('etiquette', { size: 15, html: '<div>Activité 3</div>', y: 20 }), text('petit', { size: 18, html: long, y: 200 }), text('minuscule', { size: 10, y: 400 })]));
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => /texte courant/.test(w))).toHaveLength(1);
    expect(r.warnings.filter((w) => /illisible/.test(w))).toHaveLength(1);
  });

  it('prévient d’un texte qui descendrait sur le suivant ou sous l’écran', () => {
    const long = `<div>${'Une longue explication qui tient sur plusieurs lignes. '.repeat(8)}</div>`;
    const r = check(page('e-01', [text('haut', { y: 120, html: long }), text('bas', { y: 180 }), text('fond', { y: 500, html: long })]));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/« haut » descendrait de \d+ sur « bas »/);
    expect(r.warnings.join('\n')).toMatch(/« fond » : le texte descendrait jusqu'à \d+/);
  });

  it('ne prévient pas pour deux textes côte à côte', () => {
    const r = check(page('e-01', [text('gauche', { w: 400 }), text('droite', { x: 520, w: 400 })]));
    expect(r.warnings).toEqual([]);
  });

  it('prévient d’un texte posé dans le bas de l’écran, pas d’un bouton', () => {
    const bouton = { id: 'suite', type: 'shape', kind: 'rounded-rect', x: 820, y: 490, w: 150, h: 50, stroke: '#000', strokeWidth: 1, fill: '#EEF2FF', text: { html: '<div>Suite</div>', size: 22, font: 'sans', color: '#000' }, interactions: [{ action: 'next' }] };
    const r = check(page('e-01', [text('bas', { y: 470 }), bouton]));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/« bas » : descend jusqu'à \d+, dans le bas de l'écran/);
    // Une page allongée se lit en défilant : pas d'alerte
    expect(check(page('e-02', [text('bas', { y: 470 })], { height: 900 })).warnings).toEqual([]);
  });

  it('prévient d’un texte trop long pour son cadre', () => {
    const r = check(page('e-01', [{ id: 'cadre', type: 'shape', kind: 'rect', x: 60, y: 120, w: 200, h: 40, stroke: '#000', strokeWidth: 1, fill: null, text: { html: `<div>${'mot '.repeat(30)}</div>`, size: 20, font: 'sans', color: '#000' } }]));
    expect(r.warnings.join('\n')).toMatch(/le cadre en fait 40/);
  });
});
