import { describe, expect, it } from 'vitest';
import { foldedRect, isFolded, textBoxRect, textBoxTitle, type TextBox } from '../boardText';

const box: TextBox = { id: 't1', x: 10, y: 20, w: 400, size: 24, font: 'sans', color: '#111827', html: '<div>Titre du post-it</div><div>suite</div>', background: '#FDE68A' };

describe('post-it replié', () => {
  it('ne vaut que pour une zone à fond coloré', () => {
    expect(isFolded({ ...box, collapsed: true })).toBe(true);
    expect(isFolded({ ...box, collapsed: true, background: undefined })).toBe(false);
    expect(isFolded(box)).toBe(false);
  });

  it('se replie en petit dossier, borné en largeur', () => {
    expect(foldedRect(box)).toEqual({ x: 10, y: 20, w: 144, h: 77 });
    expect(foldedRect({ ...box, w: 120 }).w).toBe(120);
    expect(textBoxRect({ ...box, collapsed: true })).toEqual(foldedRect(box));
  });

  it('prend la première ligne non vide comme titre', () => {
    expect(textBoxTitle(box.html)).toBe('Titre du post-it');
    expect(textBoxTitle('<div><br></div><div>  Deuxième &amp; <b>gras</b></div>')).toBe('Deuxième & gras');
    expect(textBoxTitle('')).toBe('');
  });
});
