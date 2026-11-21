import { describe, expect, it } from 'vitest';
import { emptyReveal, fireInteractions, learnSiteSteps, objectStepCount, stepPageAnimation } from '../boardReveal';
import { actionsFor, type TextObject } from '../boardObjects';
import type { WebObject } from '../boardMedia';
import { checkScreens } from '../course/screensCheck';

const site = (id: string, extra: Partial<WebObject> = {}): WebObject => ({ id, type: 'web', x: 20, y: 60, w: 960, h: 440, url: 'https://hopital-virtuel.vercel.app/?presentation=eve-amalle', ...extra });
const button = (id: string, action: 'stepNext' | 'stepPrev', targetId: string): TextObject => ({ id, type: 'text', x: 0, y: 0, w: 100, size: 20, font: 'sans', color: '#000', html: '<div>x</div>', interactions: [{ action, targetId }] });

describe('site pilotable', () => {
  it('compte les étapes déclarées à la pose, sinon celles que le site annonce', () => {
    expect(objectStepCount(site('a', { steps: 4 }))).toBe(4);
    expect(objectStepCount(site('inconnu'))).toBe(0);
    learnSiteSteps('annonce', 7);
    expect(objectStepCount(site('annonce'))).toBe(7);
    learnSiteSteps('farfelu', -3);
    expect(objectStepCount(site('farfelu'))).toBe(0);
  });

  it('avance et recule avec les boutons du tableau, sans sortir des bornes', () => {
    const s = site('s', { steps: 3 });
    const objects = [s, button('n', 'stepNext', 's'), button('p', 'stepPrev', 's')];
    let state = emptyReveal();
    for (let i = 0; i < 4; i++) state = fireInteractions(state, objects[1], objects).state;
    expect(state.steps.s).toBe(2);
    state = fireInteractions(state, objects[2], objects).state;
    expect(state.steps.s).toBe(1);
  });

  it('ne bouge pas tant que le site n’a pas dit combien il a d’étapes', () => {
    const s = site('muet');
    const objects = [s, button('n', 'stepNext', 'muet')];
    expect(fireInteractions(emptyReveal(), objects[1], objects).state.steps).toEqual({});
  });

  it('avance avec le « Suivant » du téléphone, puis laisse passer à la page suivante', () => {
    const objects = [site('t', { steps: 2 })];
    const state = stepPageAnimation(emptyReveal(), objects, 1)!;
    expect(state.steps.t).toBe(1);
    expect(stepPageAnimation(state, objects, 1)).toBeNull();
    expect(stepPageAnimation(emptyReveal(), [site('u', { steps: 1 })], 1)).toBeNull();
  });

  it('propose « étape suivante / précédente » dans les interactions', () => {
    expect(actionsFor(site('a'))).toEqual(expect.arrayContaining(['stepNext', 'stepPrev']));
  });

  it('est contrôlé par screens:check', () => {
    const page = (objects: unknown[]) => [{ id: 'e-01', background: 'blank', strokes: [], objects }];
    const s = site('s', { steps: 12 });
    expect(checkScreens(page([s, button('n', 'stepNext', 's')])).errors).toEqual([]);
    expect(checkScreens(page([{ ...s, steps: 2.5 }])).errors.join(' ')).toMatch(/nombre entier/);
    expect(checkScreens(page([{ ...s, url: 'http://exemple.fr' }])).errors.join(' ')).toMatch(/https/);
  });
});
