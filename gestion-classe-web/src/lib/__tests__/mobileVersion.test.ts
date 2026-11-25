/**
 * Version couleur au format téléphone d'un document imprimé : quels documents ont un lien, vers
 * quel original, l'adresse et le QR code imprimé, ce que le serveur rend
 * (supabase/functions/version-mobile/rules.ts) et ce que le téléphone en affiche.
 */
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import type { JSONContent } from '@tiptap/core';
import { MM } from '../course/coursePage';
import { splitVariant } from '../courseLibrary';
import { MOBILE_TOKEN, PHONE_FULL_IMAGE, QR_INSET, mobileEligible, mobileTarget, mobileUrl, newMobileToken, phoneContent, qrBox, qrModules } from '../mobileVersion';
import { mobileDoc } from '../../../../supabase/functions/version-mobile/rules';

const ORIGIN = 'https://qwetsh.github.io';
const BASE = '/gestion-classe/';

describe('documents qui ont une version téléphone', () => {
  it('fiche, documents, extraits, protocole, version adaptée, fiche méthode, cours placé sur un créneau', () => {
    for (const title of [
      'Activité 3 — La dérive des continents',
      'Activité 3 — La dérive des continents (documents)',
      'Activité 3 — La dérive des continents (extraits)',
      'Activité 3 — La dérive des continents (protocole)',
      'Activité 3 — La dérive des continents (adaptée)',
      'FM3 — Réaliser un dessin d’observation',
      '5e B · mar. 10 nov.',
      '',
    ]) expect(mobileEligible(title), title).toBe(true);
  });

  it('jamais une correction, une copie modèle ni une évaluation (sujet, documents ou corrigé)', () => {
    for (const title of [
      'Activité 3 — La dérive des continents (correction)',
      'Activité 3 — La dérive des continents (corrigé)',
      'Activité 3 — La dérive des continents (copie modèle)',
      'Évaluation — La Terre, de la surface au centre',
      'Evaluation : La Terre (documents)',
      'Évaluation — La Terre (correction)',
      'Activité 4 — Auto-correction de l’exercice',
      'Entraînement noté — Les angines',
      'Contrôle — Les séismes',
      'DS 2 — Météo',
      // Accents écrits en deux caractères (titre collé depuis un autre logiciel)
      'Évaluation — La digestion',
      'Activité 1 — Wegener (copie modèle)',
    ]) expect(mobileEligible(title), title).toBe(false);
  });

  it('suit la bibliothèque : seuls la correction et la copie modèle d’une activité sont refusées', () => {
    for (const suffix of ['', ' (documents)', ' (document)', ' (extraits)', ' (protocole)', ' (adaptée)', ' (adapte)', ' (correction)', ' (corrigé)', ' (copie modèle)']) {
      const title = `Activité 2 — Les volcans${suffix}`;
      const { variant } = splitVariant(title);
      expect(mobileEligible(title), title).toBe(variant !== 'correction' && variant !== 'copie');
    }
  });
});

describe('original visé par le QR code', () => {
  const fiche = { id: 'copie-5b', title: 'Activité 3 — Wegener' };

  it('une copie posée pour une classe renvoie au lien de son original', () => {
    expect(mobileTarget(fiche, { id: 'original', title: 'Activité 3 — Wegener' })).toBe('original');
  });

  it('un cours de la bibliothèque, ou une copie dont l’original a disparu, sert lui-même', () => {
    expect(mobileTarget(fiche, null)).toBe('copie-5b');
    expect(mobileTarget(fiche, { id: 'copie-5b', title: 'Activité 3 — Wegener' })).toBe('copie-5b');
  });

  it('pas de lien si la copie ou son original est une correction ou une évaluation', () => {
    expect(mobileTarget(fiche, { id: 'original', title: 'Activité 3 — Wegener (correction)' })).toBeNull();
    expect(mobileTarget({ id: 'copie', title: 'Évaluation — Météo' }, { id: 'original', title: 'Activité 3' })).toBeNull();
    expect(mobileTarget({ id: 'seul', title: 'Activité 3 — Wegener (copie modèle)' }, null)).toBeNull();
  });
});

describe('adresse et QR code', () => {
  it('jeton de 20 caractères tirés au hasard, accepté par le serveur', () => {
    const tokens = new Set(Array.from({ length: 200 }, newMobileToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toHaveLength(20);
      expect(MOBILE_TOKEN.test(t)).toBe(true);
    }
    expect(MOBILE_TOKEN.test('court')).toBe(false);
    expect(MOBILE_TOKEN.test('a'.repeat(20) + '/')).toBe(false);
  });

  it('adresse la plus courte possible : /d/<jeton> sous la base de l’app', () => {
    expect(mobileUrl('abcDEF_123-xyz456789', ORIGIN, BASE)).toBe('https://qwetsh.github.io/gestion-classe/d/abcDEF_123-xyz456789');
    expect(mobileUrl('abcDEF_123-xyz456789', 'http://localhost:5173', '/gestion-classe')).toBe('http://localhost:5173/gestion-classe/d/abcDEF_123-xyz456789');
  });

  it('QR code de version 4 (33 modules), relu tel quel par un lecteur de QR code', () => {
    const url = mobileUrl(newMobileToken(), ORIGIN, BASE);
    const qr = qrModules(url);
    expect(qr.version).toBe(4);
    expect(qr.size).toBe(33);
    // Image du tracé : 4 px par module, marge blanche de 4 modules
    const scale = 4;
    const quiet = 4;
    const side = (qr.size + 2 * quiet) * scale;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    for (const m of qr.path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      const [c, r, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
      for (let y = (r + quiet) * scale; y < (r + quiet + 1) * scale; y++) {
        for (let x = (c + quiet) * scale; x < (c + quiet + w) * scale; x++) {
          const i = (y * side + x) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    }
    expect(jsQR(pixels, side, side)?.data).toBe(url);
  });

  it('taille selon la marge du haut : 1,8 cm avec 2,5 cm de marge, 1,2 cm avec 1,5 cm, à 3 mm des bords', () => {
    expect(QR_INSET).toBeCloseTo(3 * MM, 5);
    expect(qrBox(94.49).size).toBeCloseTo(18 * MM, 5);
    expect(qrBox(56.5).size).toBeCloseTo(12 * MM, 5);
    // Marge de 2 cm : aussi grand que la marge le permet
    expect(qrBox(20 * MM).size).toBeCloseTo(17 * MM, 5);
    // Marges de 1,5 cm : le QR code occupe le coin, sans entrer dans la colonne (à 0,1 mm près)
    const { size, inset } = qrBox(56.5);
    expect(inset + size).toBeLessThanOrEqual(56.5 + 0.1 * MM);
    // Jamais hors des bornes
    expect(qrBox(10).size).toBeCloseTo(12 * MM, 5);
    expect(qrBox(400).size).toBeCloseTo(18 * MM, 5);
  });
});

describe('ce que le serveur rend', () => {
  const p = (text?: string): JSONContent => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });

  it('le texte et sa mise en page, sans encarts, zones d’écriture ni pointillés ; ni écrans, ni liens, ni calque', () => {
    const doc = {
      version: 3,
      rev: 'abc',
      settings: { theme: 'fiche' },
      screens: ['page-1'],
      links: [{ url: 'https://exemple.org' }],
      layer: { items: [{ id: 'x' }] },
      content: {
        type: 'doc',
        content: [
          p('Consigne'),
          { type: 'encart', attrs: { pageId: 'page-1' } },
          { type: 'paragraph', content: [{ type: 'text', text: 'Le noyau contient ' }, { type: 'dots', attrs: { cm: null } }] },
          { type: 'callout', content: [{ type: 'writingZone', attrs: { lines: 5 } }] },
          { type: 'image', attrs: { path: 'u1/a.png' } },
        ],
      },
    };
    const out = mobileDoc(doc)!;
    expect(Object.keys(out).sort()).toEqual(['content', 'settings', 'version']);
    const types = JSON.stringify(out.content);
    expect(types).not.toMatch(/encart|writingZone|"dots"/);
    expect(types).toContain('Le noyau contient ');
    // L'encadré vidé garde un paragraphe (le schéma refuse un encadré vide)
    expect((out.content.content as JSONContent[])[2]).toEqual({ type: 'callout', content: [{ type: 'paragraph' }] });
    expect((out.content.content as JSONContent[])[3]).toEqual({ type: 'image', attrs: { path: 'u1/a.png' } });
  });

  it('rien pour ce qui n’est pas un cours rédigé, ou pour un document trop profond pour être relu', () => {
    expect(mobileDoc(null)).toBeNull();
    expect(mobileDoc({ content: { type: 'doc' } })).toBeNull();
    let deep: JSONContent = p('fond');
    for (let i = 0; i < 70; i++) deep = { type: 'blockquote', content: [deep] };
    expect(mobileDoc({ version: 1, content: { type: 'doc', content: [deep] } })).toBeNull();
  });
});

describe('ce que le téléphone affiche', () => {
  const cell = (...content: JSONContent[]): JSONContent => ({ type: 'tableCell', content });
  const text = (t: string, color?: string): JSONContent => ({ type: 'text', text: t, ...(color ? { marks: [{ type: 'textStyle', attrs: { color, fontSize: '10pt' } }] } : {}) });
  const para = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
  // Cartouche de la skill (gc_cours.py, Cartouche), en raccourci
  const cartouche: JSONContent = {
    type: 'table',
    content: [
      { type: 'tableRow', content: [cell(para(text('Séquence 2', '#FFFFFF'))), cell(para(text('Activité 3 — Wegener'))), cell(para(text('4'), text('e')))] },
      { type: 'tableRow', content: [cell(para(text('Note :')), para(text('/20'))), cell(para(text('Commentaire :')))] },
      { type: 'tableRow', content: [cell(para(text('Pratiquer des langages (D1, D4)')), para(text('○  ○  ○  ○')))] },
      { type: 'tableRow', content: [cell(para(text('Durée : 1 séance')))] },
      { type: 'tableRow', content: [cell(para(text('Problématique : '), text('Les continents bougent-ils ?')))] },
    ],
  };

  it('le cartouche est mis à plat : titre, séquence, durée, problématique ; ni note, ni commentaire, ni cercles', () => {
    const out = phoneContent({ type: 'doc', content: [cartouche, para(text('1. Observe le document.'))] });
    const all = JSON.stringify(out);
    expect(out.content!.every((b) => b.type === 'paragraph')).toBe(true);
    for (const kept of ['Séquence 2', 'Activité 3 — Wegener', 'Durée : 1 séance', 'Les continents bougent-ils ?', '1. Observe le document.']) expect(all).toContain(kept);
    for (const dropped of ['Note :', 'Commentaire :', '○', 'Pratiquer des langages']) expect(all).not.toContain(dropped);
    // Le texte blanc du bandeau perd sa couleur (sans son fond, il serait invisible), garde sa taille
    expect(out.content![0].content![0].marks).toEqual([{ type: 'textStyle', attrs: { fontSize: '10pt' } }]);
  });

  it('un tableau ordinaire reste un tableau (il défilera de côté)', () => {
    const table: JSONContent = { type: 'table', content: [{ type: 'tableRow', content: [cell(para(text('Roche'))), cell(para(text('Densité')))] }] };
    expect(phoneContent({ type: 'doc', content: [table] }).content![0]).toEqual(table);
  });

  it('les images prennent toute la largeur, sauf les pictogrammes ; une page entière ne change pas', () => {
    const img = (attrs: Record<string, unknown>): JSONContent => ({ type: 'image', attrs: { path: 'u/x.png', ...attrs } });
    const out = phoneContent({
      type: 'doc',
      content: [img({ width: 420 }), img({ width: null }), img({ width: PHONE_FULL_IMAGE - 10 }), img({ width: 300, page: true }), { type: 'columns', content: [{ type: 'column', content: [img({ width: 280 })] }] }],
    });
    const widths = [0, 1, 2, 3].map((i) => out.content![i].attrs!.width);
    expect(widths).toEqual([null, null, PHONE_FULL_IMAGE - 10, 300]);
    expect(out.content![4].content![0].content![0].attrs!.width).toBeNull();
  });
});
