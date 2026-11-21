import { describe, expect, it } from 'vitest';
import { blocksToBoardHtml, fullImageUrl, isStopHeading } from '../wikiArticle';

describe('fullImageUrl', () => {
  const thumb = '//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Volcan.jpg/220px-Volcan.jpg';

  it('demande la vignette de 960 px pour une grande image', () => {
    expect(fullImageUrl(thumb, 4000)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Volcan.jpg/960px-Volcan.jpg');
  });

  it("prend l'original quand il est plus petit que 960 px", () => {
    expect(fullImageUrl(thumb, 640)).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Volcan.jpg');
  });

  it('rastérise un SVG à 960 px, quelle que soit sa taille', () => {
    const svg = '//upload.wikimedia.org/wikipedia/commons/thumb/1/12/Coeur.svg/250px-Coeur.svg.png';
    expect(fullImageUrl(svg, 300)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Coeur.svg/960px-Coeur.svg.png');
  });

  it('retire les paramètres de suivi et repasse par upload.wikimedia.org', () => {
    const t = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Modele.png/500px-Modele.png?utm_source=fr.wikipedia.org&utm_content=thumbnail';
    expect(fullImageUrl(t, 800)).toBe('https://upload.wikimedia.org/wikipedia/commons/a/a8/Modele.png');
    expect(fullImageUrl(t, 2000)).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Modele.png/960px-Modele.png');
  });

  it("laisse telle quelle une adresse qui n'est pas une vignette", () => {
    expect(fullImageUrl('//upload.wikimedia.org/wikipedia/commons/a/ab/Volcan.jpg')).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Volcan.jpg');
  });
});

describe('isStopHeading', () => {
  it('reconnaît les sections de fin d’article', () => {
    expect(isStopHeading('Notes et références')).toBe(true);
    expect(isStopHeading('  Voir   aussi ')).toBe(true);
    expect(isStopHeading('Liens externes')).toBe(true);
  });
  it('laisse passer les autres titres', () => {
    expect(isStopHeading('Formation')).toBe(false);
  });
});

describe('blocksToBoardHtml', () => {
  it('assemble titres, paragraphes et listes, puis cite la source en gris', () => {
    const html = blocksToBoardHtml([
      { kind: 'heading', level: 2, text: 'Formation <1>' },
      { kind: 'para', html: 'Un <b>volcan</b> se forme…', text: 'Un volcan se forme…' },
      { kind: 'list', html: '<ul><li>lave</li></ul>', text: 'lave' },
      { kind: 'image', src: 'a', full: 'b', caption: '' },
    ], 'Volcan');
    expect(html).toBe('<div><b>Formation &lt;1&gt;</b></div><div>Un <b>volcan</b> se forme…</div><ul><li>lave</li></ul><div><span style="color: #6B7280">Source : Wikipédia, « Volcan »</span></div>');
  });
  it('ne rend rien sans bloc de texte', () => {
    expect(blocksToBoardHtml([{ kind: 'image', src: 'a', full: 'b', caption: '' }], 'Volcan')).toBe('');
  });
});
