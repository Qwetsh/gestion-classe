import { describe, expect, it } from 'vitest';
import {
  ANIMATION_MAX_CHARS, animationData, animationInfo, animationSrcDoc, animationStepCount, canReorderSteps, sanitizeCaption, withAnimationData,
  type AnimationObject,
} from '../boardAnimation';
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

describe('retouche des étapes', () => {
  it('lit le bloc tel quel, champs inconnus et étapes masquées compris', () => {
    const d = animationData(data([{ id: 'a', title: 'Un', caption: 'x', dur: 7, color: '#C00000' }, { id: 'b', title: 'Deux', hidden: true }]));
    expect(d?.steps).toEqual([{ id: 'a', title: 'Un', caption: 'x', dur: 7, color: '#C00000' }, { id: 'b', title: 'Deux', caption: '', hidden: true }]);
    expect(d?.ratio).toBe(1.9);
    expect(animationData(PLAIN)).toBeNull();
    expect(animationData(data([]))).toBeNull();
  });

  it('réécrit le bloc sans toucher au reste du code', () => {
    const d = animationData(THREE)!;
    const next = withAnimationData(THREE, { ...d, steps: d.steps.map((s, i) => (i === 0 ? { ...s, title: 'Question 7', caption: 'Le <b>virus</b>' } : s)) });
    expect(animationData(next)?.steps[0]).toEqual({ id: 'a', title: 'Question 7', caption: 'Le <b>virus</b>' });
    const [before, after] = THREE.split(/<script type="application\/json" id="gc-anim">[\s\S]*?<\/script>/);
    expect(next.startsWith(before + '<script type="application/json" id="gc-anim">')).toBe(true);
    expect(next.endsWith('</script>' + after)).toBe(true);
    expect(withAnimationData(PLAIN, d)).toBe(PLAIN);
  });

  it('ne laisse pas un texte fermer le bloc de données', () => {
    const d = animationData(THREE)!;
    const next = withAnimationData(THREE, { ...d, steps: [{ ...d.steps[0], caption: 'fin </script><!-- piège' }] });
    expect(next.match(/<\/script>/g)).toHaveLength(THREE.match(/<\/script>/g)!.length);
    expect(animationData(next)?.steps[0].caption).toBe('fin </script><!-- piège');
  });

  it('ne compte pas une étape masquée parmi les étapes jouées', () => {
    const d = animationData(THREE)!;
    const hidden = withAnimationData(THREE, { ...d, steps: d.steps.map((s, i) => (i === 1 ? { ...s, hidden: true } : s)) });
    expect(animationInfo(hidden).steps.map((s) => s.title)).toEqual(['Un', 'Trois']);
    expect(animationStepCount(anim('a', hidden))).toBe(2);
    expect(animationData(hidden)?.steps).toHaveLength(3);
  });

  it('ne permet de réordonner que si chaque étape nomme son dessin', () => {
    expect(canReorderSteps(animationData(THREE)!)).toBe(true);
    expect(canReorderSteps(animationData(data([{ id: 'a', title: 'Un' }, { title: 'Deux' }]))!)).toBe(false);
  });

  it('réduit une légende saisie à du texte, du gras, des italiques et des retours', () => {
    expect(sanitizeCaption('Le <strong>virus</strong> entre')).toBe('Le <b>virus</b> entre');
    expect(sanitizeCaption('<div>Un</div><div>Deux</div>')).toBe('Un<br>Deux');
    expect(sanitizeCaption('<span style="color:red">a</span><B>b</B><script>x()</script>')).toBe('a<b>b</b>x()');
    expect(sanitizeCaption('<b></b>texte<br><br>')).toBe('texte');
    expect(sanitizeCaption('a &lt; b')).toBe('a &lt; b');
  });
});
