import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../pdfjs', () => ({ getPdfjs: vi.fn() }));

import { COPY_PROFILE, depotUrl, describeDepotError, fitSize, groupUnnamed, movePage, rotatedSize, sortFilesByName } from '../copyUpload';

describe('fitSize (profil d\'envoi)', () => {
  it('ramène le grand côté à 1600 px', () => {
    expect(fitSize(2800, 3800)).toEqual({ width: 1179, height: 1600 });
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });
  it('n\'agrandit jamais', () => {
    expect(fitSize(1200, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(1600, 800)).toEqual({ width: 1600, height: 800 });
  });
  it('garde le profil JPEG 0,75 et le plafond de 4,5 Mo', () => {
    expect(COPY_PROFILE).toMatchObject({ maxLongEdge: 1600, jpegQuality: 0.75, fallbackQuality: 0.5 });
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

describe('copies « Pas de nom »', () => {
  it('regroupe les pages par copie, dans l’ordre des pages, la plus ancienne copie d’abord', () => {
    const out = groupUnnamed([
      { id: 'p3', copy_id: 'B', page_order: 1, storage_path: 'b1', created_at: '2026-11-02T10:05:00Z' },
      { id: 'p2', copy_id: 'A', page_order: 2, storage_path: 'a2', created_at: '2026-11-02T10:01:00Z' },
      { id: 'p1', copy_id: 'A', page_order: 1, storage_path: 'a1', created_at: '2026-11-02T10:00:00Z' },
    ]);
    expect(out.map((c) => c.copyId)).toEqual(['A', 'B']);
    expect(out[0].pages.map((p) => p.storage_path)).toEqual(['a1', 'a2']);
  });
  it('a un message pour un élève hors de l’éval', () => {
    expect(describeDepotError('bad_student')).toMatch(/élève/);
  });
});

describe('sortFilesByName', () => {
  it('range IMG_2 avant IMG_10', () => {
    expect(sortFilesByName([{ name: 'IMG_10.jpg' }, { name: 'IMG_2.jpg' }, { name: 'img_1.jpg' }]).map((f) => f.name)).toEqual([
      'img_1.jpg',
      'IMG_2.jpg',
      'IMG_10.jpg',
    ]);
  });
});
