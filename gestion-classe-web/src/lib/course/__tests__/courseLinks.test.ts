import { describe, expect, it } from 'vitest';
import { MAX_COURSE_LINKS, courseLinks, linkHost, normalizeUrl } from '../courseLinks';

describe('normalizeUrl', () => {
  it('complète une adresse tapée sans https://', () => {
    expect(normalizeUrl(' hopital-virtuel.vercel.app ')).toBe('https://hopital-virtuel.vercel.app/');
    expect(normalizeUrl('qwetsh.github.io/svt-3e-ordres-de-grandeur/')).toBe('https://qwetsh.github.io/svt-3e-ordres-de-grandeur/');
    expect(normalizeUrl('http://les.cahiers-developpement-durable.be/outils/')).toBe('http://les.cahiers-developpement-durable.be/outils/');
  });

  it('refuse ce qui n’est pas une adresse web', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('mailto:prof@example.fr')).toBeNull();
    expect(normalizeUrl('Le microbiote')).toBeNull();
    expect(normalizeUrl('appli')).toBeNull();
  });
});

describe('courseLinks', () => {
  it('lit les liens du document et nomme ceux qui n’ont pas de nom', () => {
    expect(courseLinks([
      { label: ' Hôpital virtuel ', url: 'hopital-virtuel.vercel.app' },
      { url: 'https://www.georisques.gouv.fr/' },
    ])).toEqual([
      { label: 'Hôpital virtuel', url: 'https://hopital-virtuel.vercel.app/' },
      { label: 'georisques.gouv.fr', url: 'https://www.georisques.gouv.fr/' },
    ]);
  });

  it('ignore un champ absent, mal formé ou une adresse dangereuse', () => {
    expect(courseLinks(undefined)).toEqual([]);
    expect(courseLinks('https://exemple.fr')).toEqual([]);
    expect(courseLinks([null, 3, { label: 'x' }, { label: 'Piège', url: 'javascript:alert(1)' }])).toEqual([]);
  });

  it('garde une adresse une seule fois et pas plus de liens que la ligne n’en montre', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, url: `https://site${i}.fr` }));
    expect(courseLinks([...many.slice(0, 2), many[0]])).toHaveLength(2);
    expect(courseLinks(many)).toHaveLength(MAX_COURSE_LINKS);
  });
});

describe('linkHost', () => {
  it('nomme un lien par son site, sans « www. »', () => {
    expect(linkHost('https://www.georisques.gouv.fr/carte')).toBe('georisques.gouv.fr');
  });
});
