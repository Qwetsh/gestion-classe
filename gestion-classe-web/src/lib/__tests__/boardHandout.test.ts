import { describe, expect, it } from 'vitest';
import { buildHandoutHtml, handoutPage, toFraction } from '../boardHandout';
import type { BoardObject } from '../boardObjects';

const shape = (id: string, over: Record<string, unknown> = {}): BoardObject => ({
  id, type: 'shape', kind: 'rounded-rect', x: 400, y: 470, w: 200, h: 54, stroke: '#000', strokeWidth: 1, fill: '#fff', ...over,
} as unknown as BoardObject);
const text = (id: string, over: Record<string, unknown> = {}): BoardObject => ({
  id, type: 'text', x: 60, y: 100, w: 800, size: 24, font: 'sans', color: '#000', html: '<div>x</div>', ...over,
} as unknown as BoardObject);

describe('handoutPage', () => {
  it('appuie les boutons « Suivant » dans l’ordre et retire les boutons', () => {
    const page = {
      id: 'p',
      objects: [
        text('titre'),
        text('a', { hidden: true }),
        text('b', { hidden: true }),
        shape('s1', { interactions: [{ action: 'show', targetId: 'a' }, { action: 'hide', targetId: 's1' }, { action: 'show', targetId: 's2' }] }),
        shape('s2', { hidden: true, interactions: [{ action: 'show', targetId: 'b' }, { action: 'hide', targetId: 's2' }, { action: 'show', targetId: 'r' }] }),
        shape('r', { hidden: true, interactions: [{ action: 'reset' }] }),
      ],
    };
    const out = handoutPage(page);
    expect(out.page.objects.map((o) => o.id)).toEqual(['titre', 'a', 'b']);
    expect(out.page.objects.every((o) => !o.hidden)).toBe(true);
  });

  it('fait disparaître ce qu’un bouton cache et garde masqué ce qu’aucun bouton ne montre', () => {
    const page = {
      id: 'p',
      objects: [
        text('question'),
        text('brouillon', { hidden: true }),
        text('verdict', { hidden: true }),
        shape('v', { interactions: [{ action: 'show', targetId: 'verdict' }, { action: 'hide', targetId: 'question' }] }),
      ],
    };
    expect(handoutPage(page).page.objects.map((o) => o.id)).toEqual(['verdict']);
  });

  it('garde les liens de sommaire, à l’image et cliquables', () => {
    const page = { id: 'p', objects: [shape('q1', { x: 100, y: 200, interactions: [{ action: 'goto', params: { pageId: 'p3' } }] })] };
    const out = handoutPage(page);
    expect(out.page.objects.map((o) => o.id)).toEqual(['q1']);
    expect(out.links).toEqual([{ rect: { x: 100, y: 200, w: 200, h: 54 }, pageId: 'p3' }]);
  });

  it('repère les animations de la page', () => {
    const anim = { id: 'an', type: 'animation', x: 20, y: 8, w: 960, h: 444, code: '<html></html>' } as unknown as BoardObject;
    const out = handoutPage({ id: 'p', objects: [anim, shape('next', { interactions: [{ action: 'stepNext', targetId: 'an' }] })] });
    expect(out.animations.map((a) => a.id)).toEqual(['an']);
    expect(out.page.objects.map((o) => o.id)).toEqual(['an']);
  });
});

describe('buildHandoutHtml', () => {
  const doc = {
    title: 'Correction <éval>',
    screens: [
      { image: 'data:image/jpeg;base64,AAA', links: [{ rect: toFraction({ x: 100, y: 200, w: 200, h: 54 }, 1000, 562.5), target: 1 }], animations: [] },
      { image: 'data:image/jpeg;base64,BBB', links: [], animations: [{ rect: { x: 0.02, y: 0.01, w: 0.96, h: 0.79 }, index: 0 }] },
    ],
    animations: [{ title: 'La brise', steps: 6, srcdoc: '<html><script>var a="</script>";</script></html>', assets: [] }],
  };
  const html = buildHandoutHtml(doc);

  it('échappe le titre et pose le bouton Imprimer', () => {
    expect(html).toContain('<title>Correction &lt;éval&gt;</title>');
    expect(html).toContain('id="gc-print"');
  });

  it('relie le sommaire aux écrans et place les animations avec leurs boutons d’étape', () => {
    expect(html).toContain('href="#ecran-2"');
    expect(html).toContain('id="ecran-2"');
    expect(html).toContain('data-anim="0" style="left:2%;top:1%;width:96%;height:79%"');
    expect(html).toContain('1 / 6');
  });

  it('ne laisse pas le code d’une animation fermer le bloc de données', () => {
    const data = /<script type="application\/json" id="gc-data">([\s\S]*?)<\/script>/.exec(html);
    expect(data).not.toBeNull();
    expect(JSON.parse(data![1])[0].srcdoc).toBe(doc.animations[0].srcdoc);
  });

  it('cache boutons et cadres à l’impression (l’image figée de l’animation reste)', () => {
    expect(html).toMatch(/@media print\{[\s\S]*\.bar,\.nav,\.anim\{display:none!important\}/);
  });
});
