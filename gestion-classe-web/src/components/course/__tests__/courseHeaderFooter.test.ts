import { describe, expect, it } from 'vitest';
import { footerOf, isEmptyLine, pageNumberPreset, renderFields } from '../courseHeaderFooter';

const values = { titre: 'La cellule', classe: '4B', date: 'jeudi 13 novembre 2026', page: 2, pages: 4 };

describe('renderFields', () => {
  it('remplace les champs', () => {
    expect(renderFields('Page {page} sur {pages}', values).map((p) => p.text).join('')).toBe('Page 2 sur 4');
    expect(renderFields('{titre} — {classe}', values).map((p) => p.text).join('')).toBe('La cellule — 4B');
  });
  it('champ sans valeur : marqué manquant, jamais du texte inventé', () => {
    const pieces = renderFields('Classe : {classe}', { ...values, classe: '' });
    expect(pieces[1]).toEqual({ text: 'classe', field: 'classe', missing: true });
  });
  it('accolades inconnues laissées telles quelles', () => {
    expect(renderFields('{nom} {page}', values).map((p) => p.text).join('')).toBe('{nom} 2');
  });
  it('texte vide : rien', () => {
    expect(renderFields('', values)).toEqual([]);
  });
});

describe('pied de page et numéros', () => {
  it('par défaut : le numéro seul, centré (comme avant le lot T9)', () => {
    expect(footerOf({})).toEqual({ center: '{page}' });
    expect(pageNumberPreset({})).toBe('n');
  });
  it('reconnaît les préréglages', () => {
    expect(pageNumberPreset({ footer: { center: 'Page {page} sur {pages}' } })).toBe('sur');
    expect(pageNumberPreset({ footer: { center: '' } })).toBe('none');
  });
  it('réglage libre : pas de préréglage', () => {
    expect(pageNumberPreset({ footer: { left: '{titre}', center: '{page}' } })).toBeNull();
  });
  it('ligne vide', () => {
    expect(isEmptyLine(undefined)).toBe(true);
    expect(isEmptyLine({ left: '  ', center: '' })).toBe(true);
    expect(isEmptyLine({ right: '{date}' })).toBe(false);
  });
});
