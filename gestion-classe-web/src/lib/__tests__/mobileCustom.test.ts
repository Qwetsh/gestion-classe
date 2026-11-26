/**
 * Version mobile « sur mesure » (migration 093) : règle d'autonomie de la page déposée, taille,
 * document visé (original ou copie), version servie (QR code ou lien de partage), empreinte du
 * document et état « plus ancienne que le document », page prête pour le cadre isolé.
 * Règles partagées avec les Edge Functions : supabase/functions/version-mobile/custom.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUSTOM_CSP, CUSTOM_MAX_BYTES, customPageProblem, customSrcdoc, customState, docFingerprint, linkTarget, servedVersion } from '../mobileVersion';

const page = (body: string, head = '') => `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fiche</title>${head}</head>
<body>${body}</body>
</html>`;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** Une animation du tableau telle que gc_animation la produit, mise dans un cadre `srcdoc` (échappée). */
const escapeAttr = (html: string) => html.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('page sur mesure : autonome, rien du réseau', () => {
  it('accepte une page complète : images en data URI, styles et scripts écrits dans la page', () => {
    const html = page(
      `<h1>La dérive des continents</h1>
       <p>Source : https://fr.wikipedia.org/wiki/Alfred_Wegener (texte, pas un chargement)</p>
       <img src="${PNG}" alt="carte" srcset="${PNG} 1x, ${PNG} 2x">
       <a href="https://fr.wikipedia.org/wiki/Alfred_Wegener">En savoir plus</a>
       <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">
         <defs><linearGradient id="g"></linearGradient><symbol id="fleche"><path d="M0 0"/></symbol></defs>
         <rect fill="url(#g)" width="10" height="10"/><use href="#fleche"/><use xlink:href="#fleche"/>
       </svg>
       <button onclick="document.body.classList.toggle('vu')">Révéler</button>
       <script>
         // Une bibliothèque recopiée (three.js) contient fetch( sans adresse écrite : permis
         function charger(url) { return fetch(url).then((r) => r.arrayBuffer()); }
         const ns = 'http://www.w3.org/2000/svg';
         document.createElementNS(ns, 'g');
       </script>`,
      `<style>@font-face { font-family: X; src: url(data:font/woff2;base64,AAAA); } body { background: url("${PNG}"); }</style>`,
    );
    expect(customPageProblem(html)).toBeNull();
  });

  it('accepte une animation du tableau dans un cadre srcdoc, et relit sa page', () => {
    const anim = '<!DOCTYPE html><html><head><script>var a = 1;</script></head><body><svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>';
    expect(customPageProblem(page(`<iframe title="animation" srcdoc="${escapeAttr(anim)}"></iframe>`))).toBeNull();
    const leaky = anim.replace('var a = 1;', 'fetch("https://exemple.fr/suivi");');
    expect(customPageProblem(page(`<iframe srcdoc="${escapeAttr(leaky)}"></iframe>`))).toMatchObject({ error: 'network' });
  });

  it.each([
    ['une image en ligne', `<img src="https://exemple.fr/carte.png">`],
    ['une image à adresse relative (ne mène à rien depuis la page isolée)', `<img src="carte.png">`],
    ['une adresse sans protocole', `<img src="//exemple.fr/carte.png">`],
    ['un srcset en ligne', `<img src="${PNG}" srcset="${PNG} 1x, https://exemple.fr/carte@2x.png 2x">`],
    ['une police Google', `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`],
    ['une feuille de style à côté', `<link rel="stylesheet" href="style.css">`],
    ['un script en ligne', `<script src="https://cdn.jsdelivr.net/npm/three"></script>`],
    ['une vidéo en ligne', `<video src="https://exemple.fr/film.mp4"></video>`],
    ['une affiche de vidéo en ligne', `<video poster="https://exemple.fr/a.jpg" src="${PNG}"></video>`],
    ['une image SVG en ligne', `<svg><image href="https://exemple.fr/a.png"/></svg>`],
    ['url(http…) dans une feuille', `<style>body { background: url(https://exemple.fr/fond.jpg) }</style>`],
    ['url(http…) dans un attribut style', `<div style="background-image:url('http://exemple.fr/a.png')"></div>`],
    ['@import d’une adresse', `<style>@import url("https://fonts.googleapis.com/css2?family=Inter");</style>`],
    ['fetch vers l’extérieur', `<script>fetch('https://exemple.fr/api').then(() => 0)</script>`],
    ['XMLHttpRequest vers l’extérieur', `<script>const x = new XMLHttpRequest(); x.open('GET', "https://exemple.fr/api");</script>`],
    ['WebSocket', `<script>new WebSocket("wss://exemple.fr/direct")</script>`],
    ['sendBeacon', `<script>navigator.sendBeacon('https://exemple.fr/suivi', '1')</script>`],
    ['une image posée par un script', `<script>const img = new Image(); img.src = "https://exemple.fr/a.png";</script>`],
    ['setAttribute', `<script>el.setAttribute('src', 'https://exemple.fr/a.png')</script>`],
    ['import d’un module en ligne', `<script type="module">import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';</script>`],
    ['import() en ligne', `<script>import('https://exemple.fr/mod.js')</script>`],
    ['fetch dans un attribut onclick', `<button onclick="fetch('https://exemple.fr')">x</button>`],
    ['un cadre vers un site', `<iframe src="https://exemple.fr"></iframe>`],
    ['un cadre sans srcdoc', `<iframe></iframe>`],
    ['un objet', `<object data="${PNG}"></object>`],
    ['un greffon', `<embed src="${PNG}">`],
    ['une base', `<base href="https://exemple.fr/">`],
    ['une redirection', `<meta http-equiv="refresh" content="0;url=https://exemple.fr">`],
    ['un formulaire qui envoie', `<form action="https://exemple.fr/envoi"><button>ok</button></form>`],
  ])('refuse %s', (_label, body) => {
    const problem = customPageProblem(page(body));
    expect(problem).toMatchObject({ error: 'network' });
    expect(problem && 'detail' in problem && problem.detail.length).toBeGreaterThan(0);
  });

  it('refuse ce qui n’est pas une page HTML complète', () => {
    expect(customPageProblem('<p>Bonjour</p>')).toEqual({ error: 'not_a_page' });
    expect(customPageProblem('')).toEqual({ error: 'bad_html' });
    expect(customPageProblem(42)).toEqual({ error: 'bad_html' });
    expect(customPageProblem('<!-- version 2 -->\n<html><body>ok</body></html>')).toBeNull();
    expect(customPageProblem('﻿<!doctype html><title>x</title>')).toBeNull();
  });

  it('5 Mo au plus, comptés en octets (les accents comptent double)', () => {
    const shell = page('<p></p>');
    const fill = (n: number) => shell.replace('<p></p>', `<p>${'a'.repeat(n)}</p>`);
    const room = CUSTOM_MAX_BYTES - new TextEncoder().encode(shell).length;
    expect(customPageProblem(fill(room))).toBeNull();
    expect(customPageProblem(fill(room + 1))).toMatchObject({ error: 'too_large' });
    const accents = shell.replace('<p></p>', `<p>${'é'.repeat(Math.floor(room / 2) + 1)}</p>`);
    expect(customPageProblem(accents)).toMatchObject({ error: 'too_large' });
  });
});

describe('document visé par une version sur mesure', () => {
  const copie = { id: 'copie-5b', title: 'Activité 3 — Wegener' };
  const original = { id: 'original', title: 'Activité 3 — Wegener' };

  it('une copie posée pour une classe est ramenée à son original', () => {
    expect(linkTarget('qr', copie, original)).toBe('original');
  });
  it('un original supprimé depuis : la copie sert elle-même', () => {
    expect(linkTarget('qr', copie, null)).toBe('copie-5b');
  });
  it('jamais une correction ni une évaluation (le cours ou son original)', () => {
    expect(linkTarget('qr', { id: 'c', title: 'Activité 3 — Wegener (correction)' }, null)).toBeNull();
    expect(linkTarget('qr', copie, { id: 'o', title: 'Évaluation — Wegener' })).toBeNull();
  });
});

describe('version servie par un lien', () => {
  it('la page sur mesure par le QR code imprimé, si elle existe', () => {
    expect(servedVersion('qr', true, false)).toBe('custom');
    expect(servedVersion('qr', false, false)).toBe('auto');
  });
  it('la version simple quand le lecteur la demande', () => {
    expect(servedVersion('qr', true, true)).toBe('auto');
  });
  it('le lien de partage garde ses vues automatiques (Téléphone / Pages A4)', () => {
    expect(servedVersion('share', true, false)).toBe('auto');
  });
});

describe('empreinte du document : « plus ancienne que le document »', () => {
  const doc = {
    version: 1,
    rev: 'abc',
    content: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'left', indent: 0 }, content: [{ type: 'text', text: 'Bonjour' }] }] },
    settings: { margins: 'normal' },
    screens: ['p1'],
    links: [{ url: 'https://exemple.fr' }],
  };

  it('ne dépend pas de l’ordre des clés (base, éditeur, script)', () => {
    const shuffled = {
      settings: { margins: 'normal' },
      content: { content: [{ content: [{ text: 'Bonjour', type: 'text' }], attrs: { indent: 0, textAlign: 'left' }, type: 'paragraph' }], type: 'doc' },
      version: 1,
    };
    expect(docFingerprint(shuffled)).toBe(docFingerprint(doc));
    expect(docFingerprint(doc)).toMatch(/^v1:[0-9a-f]{28}$/);
  });

  it('change quand le texte ou la mise en page change', () => {
    const fp = docFingerprint(doc);
    expect(docFingerprint({ ...doc, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonsoir' }] }] } })).not.toBe(fp);
    expect(docFingerprint({ ...doc, settings: { margins: 'narrow' } })).not.toBe(fp);
  });

  it('ne change pas pour des écrans, des liens, des annotations ou un nouvel enregistrement', () => {
    const fp = docFingerprint(doc);
    expect(docFingerprint({ ...doc, rev: 'xyz', screens: ['p1', 'p2'], links: [], layer: { items: [{ id: 'a' }] } })).toBe(fp);
  });

  it('pas d’empreinte pour ce qui n’est pas un cours rédigé', () => {
    expect(docFingerprint(null)).toBeNull();
    expect(docFingerprint({ pages: [] })).toBeNull();
  });

  it('état : à jour, plus ancienne, ou inconnu (document illisible)', () => {
    const fp = docFingerprint(doc)!;
    expect(customState(fp, fp)).toBe('current');
    expect(customState(fp, docFingerprint({ ...doc, settings: {} }))).toBe('stale');
    expect(customState(fp, null)).toBe('unknown');
  });
});

describe('page prête pour le cadre isolé', () => {
  it('la CSP coupe le réseau', () => {
    expect(CUSTOM_CSP).toContain("default-src 'none'");
    expect(CUSTOM_CSP).toContain('img-src data: blob:');
    expect(CUSTOM_CSP).not.toMatch(/https?:|\*|'self'/);
  });

  it('posée juste après le doctype (la page reste en mode standard)', () => {
    const out = customSrcdoc('<!DOCTYPE html>\n<html><head><title>x</title></head><body></body></html>');
    expect(out.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(out).toContain('<meta name="referrer" content="no-referrer">');
    expect(out).toContain('\n<html><head><title>x</title>');
  });

  it('en tête d’une page sans doctype', () => {
    expect(customSrcdoc('<html><body>ok</body></html>').startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
  });
});

describe('gabarit et exemple de la skill version-mobile', () => {
  it.each(['gabarit.html', 'exemple.html'])('%s est une page autonome', (name) => {
    const html = readFileSync(new URL(`../../../../.claude/skills/version-mobile/${name}`, import.meta.url), 'utf8');
    expect(customPageProblem(html)).toBeNull();
  });
});
