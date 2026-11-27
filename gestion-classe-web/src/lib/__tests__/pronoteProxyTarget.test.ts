import { describe, expect, it } from 'vitest';
import { allowedTarget } from '../../../../supabase/functions/pronote-proxy/target';

const PRONOTE = ['index-education.net', 'index-education.com'];
const ok = (url: string, suffixes = PRONOTE) => allowedTarget(url, suffixes) !== null;

describe('relais Pronote : cible admise', () => {
  it('laisse passer un serveur Pronote en https', () => {
    expect(ok('https://0000000x.index-education.net/pronote/professeur.html')).toBe(true);
    expect(ok('https://www.index-education.com/swie/geoloc.php')).toBe(true);
    expect(ok('https://index-education.net/')).toBe(true);
    expect(ok('https://0000000X.INDEX-EDUCATION.NET/pronote/')).toBe(true);
  });

  it("refuse tout ce qui n'est pas un serveur Pronote", () => {
    expect(ok('https://example.com/')).toBe(false);
    expect(ok('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(ok('https://localhost/')).toBe(false);
    expect(ok('https://10.0.0.1/')).toBe(false);
  });

  it('ne se laisse pas tromper par un nom qui ressemble', () => {
    expect(ok('https://index-education.net.example.com/')).toBe(false);
    expect(ok('https://fauxindex-education.net/')).toBe(false);
    expect(ok('https://example.com/?x=.index-education.net')).toBe(false);
    expect(ok('https://example.com/#index-education.net')).toBe(false);
    expect(ok('https://index-education.net@example.com/')).toBe(false);
    expect(ok('https://moi:secret@0000000x.index-education.net/')).toBe(false);
  });

  it('refuse un autre protocole ou un autre port', () => {
    expect(ok('http://0000000x.index-education.net/pronote/')).toBe(false);
    expect(ok('ftp://0000000x.index-education.net/')).toBe(false);
    expect(ok('https://0000000x.index-education.net:8443/')).toBe(false);
    expect(ok('https://0000000x.index-education.net:443/pronote/')).toBe(true);
  });

  it('refuse une adresse illisible ou vide', () => {
    expect(ok('')).toBe(false);
    expect(ok('pronote')).toBe(false);
    expect(ok('//0000000x.index-education.net/')).toBe(false);
  });

  it('admet un Pronote hébergé ailleurs quand son suffixe est ajouté', () => {
    expect(ok('https://pronote.mon-college.fr/')).toBe(false);
    expect(ok('https://pronote.mon-college.fr/', [...PRONOTE, 'pronote.mon-college.fr'])).toBe(true);
  });
});
