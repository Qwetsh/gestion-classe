import { describe, expect, it } from 'vitest';
import { buildCredit, licenseLabel } from '../courseImageBank';

const URL = 'https://commons.wikimedia.org/wiki/File:Volcan.jpg';

describe('crédit des images de la banque', () => {
  it('auteur · licence · source', () => {
    expect(buildCredit('Jean Dupont', 'CC BY-SA 4.0', URL)).toEqual({ text: 'Jean Dupont · CC BY-SA 4.0 · Wikimedia Commons', url: URL });
  });

  it('domaine public traduit, auteur inconnu nommé comme tel', () => {
    expect(licenseLabel('Public domain')).toBe('Domaine public');
    expect(buildCredit('Unknown author', 'Public domain', URL).text).toBe('Auteur inconnu · Domaine public · Wikimedia Commons');
  });

  it('sans auteur ni licence : la source reste écrite', () => {
    expect(buildCredit('', '', URL).text).toBe('Licence libre · Wikimedia Commons');
  });

  it('auteur très long raccourci, licence et source gardées', () => {
    const t = buildCredit('A'.repeat(400), 'CC BY 4.0', URL).text;
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t.endsWith('… · CC BY 4.0 · Wikimedia Commons')).toBe(true);
  });
});
