import { describe, expect, it } from 'vitest';
import { ANIMATION_MAX_CHARS, animationInfo, animationSrcDoc, animationStepCount, type AnimationObject } from '../boardAnimation';
import { emptyReveal, fireInteractions, isRevealEmpty, normalizeReveal, recoverPage } from '../boardReveal';
import { actionsFor, describeInteraction, objectRect, objectTypeLabel, type Interaction, type TextObject } from '../boardObjects';
import { checkScreens } from '../course/screensCheck';

const data = (steps: unknown, extra = '') =>
  `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Les anticorps &amp; nous</title>
<script type="application/json" id="gc-anim">${JSON.stringify({ version: 1, ratio: 1.9, steps })}</script></head><body>${extra}<script>GC.play({})</script></body></html>`;
const THREE = data([{ id: 'a', title: 'Un', caption: 'Première <b>étape</b>' }, { id: 'b', title: 'Deux', caption: '' }, { id: 'c', title: 'Trois' }]);
const PLAIN = '<html><body><svg></svg><script>requestAnimationFrame(()=>{})</script></body></html>';

const anim = (id: string, code = THREE): AnimationObject => ({ id, type: 'animation', x: 20, y: 8, w: 960, h: 506, code });
const button = (id: string, interactions: Interaction[]): TextObject => ({ id, type: 'text', x: 0, y: 0, w: 100, size: 20, font: 'sans', color: '#000', html: '<div>x</div>', interactions });

describe('animationInfo', () => {
  it('lit les étapes, le titre et les proportions du bloc gc-anim', () => {
    const info = animationInfo(THREE);
    expect(info.contract).toBe(true);
    expect(info.steps).toEqual([{ title: 'Un', caption: 'Première <b>étape</b>' }, { title: 'Deux', caption: '' }, { title: 'Trois', caption: '' }]);
    expect(info.title).toBe('Les anticorps & nous');
    expect(info.ratio).toBe(1.9);
    expect(animationStepCount(anim('a'))).toBe(3);
  });

  it('joue un HTML quelconque en une seule étape', () => {
    const info = animationInfo(PLAIN);
    expect(info.contract).toBe(false);
    expect(info.steps).toHaveLength(1);
  });

  it('ne se fie pas à un bloc illisible ou vide', () => {
    expect(animationInfo('<script type="application/json" id="gc-anim">{oups</script>').contract).toBe(false);
    expect(animationInfo(data([])).contract).toBe(false);
  });
});

describe('animationSrcDoc', () => {
  it('pose la politique de contenu en tête du document, sans toucher au reste', () => {
    const doc = animationSrcDoc(THREE);
    expect(doc.indexOf('Content-Security-Policy')).toBeGreaterThan(doc.indexOf('<head>'));
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<meta charset'));
    expect(doc).toContain("default-src 'none'");
    expect(doc.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')).toBe(THREE);
  });

  it('ajoute un en-tête à un document qui n\'en a pas', () => {
    expect(animationSrcDoc(PLAIN)).toMatch(/^<html><head><meta http-equiv="Content-Security-Policy"[^>]*><\/head><body>/);
    expect(animationSrcDoc('<svg></svg>')).toMatch(/^<head><meta [^>]*><\/head><svg>/);
  });
});

describe('boutons d\'une animation', () => {
  it('avance et recule d\'une étape, sans sortir des bornes', () => {
    const a = anim('a');
    const next = button('n', [{ action: 'stepNext', targetId: 'a' }]);
    const prev = button('p', [{ action: 'stepPrev', targetId: 'a' }]);
    const objects = [a, next, prev];
    let state = emptyReveal();
    expect(fireInteractions(state, prev, objects).state.steps).toEqual({});
    state = fireInteractions(state, next, objects).state;
    expect(state.steps.a).toBe(1);
    state = fireInteractions(state, next, objects).state;
    state = fireInteractions(state, next, objects).state;
    expect(state.steps.a).toBe(2);
    state = fireInteractions(state, prev, objects).state;
    state = fireInteractions(state, prev, objects).state;
    expect(state.steps.a).toBeUndefined();
    expect(isRevealEmpty(state)).toBe(true);
  });

  it('rejoue l\'étape par une commande, et ignore une cible qui n\'est pas une animation', () => {
    const a = anim('a');
    const t = button('t', []);
    const replay = button('r', [{ action: 'replay', targetId: 'a' }, { action: 'stepNext', targetId: 't' }]);
    const { state, effects } = fireInteractions(emptyReveal(), replay, [a, t, replay]);
    expect(effects).toEqual([{ kind: 'command', targetId: 'a', command: 'replay' }]);
    expect(state.steps).toEqual({});
  });

  it('revient à la première étape quand la page est remise à zéro', () => {
    const a = anim('a');
    const state = { ...emptyReveal(), steps: { a: 2, autre: 1 } };
    expect(recoverPage(state, { id: 'p', objects: [a], strokes: [] } as never).steps).toEqual({ autre: 1 });
  });

  it('garde l\'étape dans l\'état de séance relu', () => {
    expect(normalizeReveal({ steps: { a: 3 } }).steps).toEqual({ a: 3 });
    expect(normalizeReveal({ moved: {} }).steps).toEqual({});
  });

  it('ne propose les étapes que pour une animation qui suit le contrat', () => {
    expect(actionsFor(anim('a'))).toEqual(expect.arrayContaining(['stepNext', 'stepPrev', 'replay', 'show']));
    expect(actionsFor(anim('b', PLAIN))).toContain('replay');
    expect(actionsFor(anim('b', PLAIN))).not.toContain('stepNext');
    expect(actionsFor(button('t', []))).not.toContain('replay');
    expect(describeInteraction({ action: 'stepNext', targetId: 'a' }, [anim('a')], [])).toBe('Étape suivante · Animation');
    expect(objectTypeLabel([anim('a')])).toBe('Animation');
    expect(objectRect(anim('a'))).toEqual({ x: 20, y: 8, w: 960, h: 506 });
  });
});

describe('contrôle des écrans', () => {
  const page = (objects: unknown[]) => [{ id: 'e-01', background: 'blank', strokes: [], objects }];
  const next = { id: 'n', type: 'shape', kind: 'rounded-rect', x: 790, y: 518, w: 190, h: 38, stroke: '#000', strokeWidth: 2, fill: null, interactions: [{ action: 'stepNext', targetId: 'a' }] };

  it('accepte une animation et ses boutons', () => {
    const r = checkScreens(page([anim('a'), next]));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('refuse un code absent, trop lourd, ou qui charge un fichier du réseau', () => {
    expect(checkScreens(page([{ ...anim('a'), code: '' }])).errors.join(' ')).toMatch(/code de l'animation absent/);
    expect(checkScreens(page([anim('a', THREE + ' '.repeat(ANIMATION_MAX_CHARS))])).errors.join(' ')).toMatch(/trop lourde/);
    expect(checkScreens(page([anim('a', data([{ title: 'Un' }], '<script src="https://exemple.fr/x.js"></script>'))])).errors.join(' ')).toMatch(/réseau/);
  });

  it('signale une animation hors contrat et un bouton d\'étape qui vise autre chose', () => {
    expect(checkScreens(page([anim('a', PLAIN)])).warnings.join(' ')).toMatch(/hors contrat/);
    const wrong = { ...next, interactions: [{ action: 'stepNext', targetId: 'n' }] };
    expect(checkScreens(page([anim('a'), wrong])).errors.join(' ')).toMatch(/ne s'adresse qu'à une animation/);
  });
});
