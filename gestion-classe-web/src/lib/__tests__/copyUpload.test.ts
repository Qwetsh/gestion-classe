import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../pdfjs', () => ({ getPdfjs: vi.fn() }));

import { COPY_PROFILE, depotUrl, describeDepotError, fitSize, movePage, rotatedSize } from '../copyUpload';

describe('fitSize (même profil que le scan mobile)', () => {
  it('ramène le grand côté à 2000 px', () => {
    expect(fitSize(2800, 3800)).toEqual({ width: 1474, height: 2000 });
    expect(fitSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });
  it('n\'agrandit jamais', () => {
    expect(fitSize(1200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(2000, 1000)).toEqual({ width: 2000, height: 1000 });
  });
  it('garde le profil JPEG 0,75 et le plafond de 4,5 Mo', () => {
    expect(COPY_PROFILE).toMatchObject({ maxLongEdge: 2000, jpegQuality: 0.75, fallbackQuality: 0.5 });
    expect(COPY_PROFILE.maxBytes).toBeLessThan(5 * 1024 * 1024); // limite du bucket
  });
});

describe('rotatedSize', () => {
  it('échange largeur et hauteur à chaque quart de tour impair', () => {
    expect(rotatedSize(100, 200, 0)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 200, 1)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(100, 200, 2)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 200, 7)).toEqual({ width: 200, height: 100 });
  });
});

describe('movePage', () => {
  it('déplace une vignette sans perdre les autres', () => {
    expect(movePage(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(movePage(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });
  it('ignore un déplacement hors liste', () => {
    const list = ['a', 'b'];
    expect(movePage(list, 0, -1)).toBe(list);
    expect(movePage(list, 1, 2)).toBe(list);
  });
});

describe('lien du QR code', () => {
  it('met le jeton dans le fragment, jamais dans le chemin ni la requête', () => {
    const url = depotUrl('abcDEF_123-xyz', 'https://qwetsh.github.io');
    expect(url).toBe('https://qwetsh.github.io/gestion-classe/depot#abcDEF_123-xyz');
    expect(new URL(url).search).toBe('');
  });
  it('explique les refus', () => {
    expect(describeDepotError('expired_or_full')).toMatch('nombre maximum de pages');
    expect(describeDepotError('zzz')).toBe('Envoi impossible (zzz).');
  });
});
