import { describe, expect, it } from 'vitest';
import { CURTAIN_OPEN_AT, curtainSlide, emptyReveal, fireInteractions, isObjectVisible, recoverPage, settleCurtain, type RevealState } from '../boardReveal';
import { actionsFor, cloneObjects, describeInteraction, type BoardObject, type Interaction, type TextObject } from '../boardObjects';
import type { WidgetObject, WindowObject } from '../boardMedia';

describe('settleCurtain', () => {
  it('compte un rideau presque sorti comme découvert', () => {
    expect(settleCurtain({ dx: 0, dy: CURTAIN_OPEN_AT })).toBe(true);
    expect(settleCurtain({ dx: 0, dy: -1 })).toBe(true);
  });

  it('remet en place un rideau à peine bougé', () => {
    expect(settleCurtain({ dx: 0, dy: 0.01 })).toBeNull();
    expect(settleCurtain({ dx: 0, dy: -0.019 })).toBeNull();
  });

  it('garde un décalage intermédiaire tel quel', () => {
    const slide = { dx: 0, dy: 0.4 };
    expect(settleCurtain(slide)).toEqual(slide);
  });
});

describe('curtainSlide', () => {
  const state: RevealState = { ...emptyReveal(), objects: { a: true, b: 'data:image/png;base64,x', c: { dx: 0, dy: 0.3 } } };

  it('ne renvoie un décalage que pour un rideau tiré en partie', () => {
    expect(curtainSlide(state, 'a')).toBeNull();
    expect(curtainSlide(state, 'b')).toBeNull();
    expect(curtainSlide(state, 'c')).toEqual({ dx: 0, dy: 0.3 });
    expect(curtainSlide(state, 'zz')).toBeNull();
  });
});

// ---- Boutons d'interaction ----------------------------------------------------------------

const text = (id: string, extra: Partial<TextObject> = {}): TextObject => ({ id, type: 'text', x: 0, y: 0, w: 100, size: 20, font: 'sans', color: '#000', html: '<div>x</div>', ...extra });
const widget = (id: string, kind: WidgetObject['widget']): WidgetObject => ({ id, type: 'widget', x: 0, y: 0, w: 100, h: 60, widget: kind, config: {} });
const button = (id: string, interactions: Interaction[]): TextObject => text(id, { interactions });

describe('fireInteractions', () => {
  it('garde le comportement afficher / masquer / basculer', () => {
    const q = text('q');
    const r = text('r', { hidden: true });
    const b = button('b', [{ action: 'hide', targetId: 'q' }, { action: 'show', targetId: 'r' }]);
    const { state, effects } = fireInteractions(emptyReveal(), b, [q, r, b]);
    expect(isObjectVisible(state, q)).toBe(false);
    expect(isObjectVisible(state, r)).toBe(true);
    expect(effects).toEqual([]);
    const t = button('t', [{ action: 'toggle', targetId: 'r' }]);
    expect(isObjectVisible(fireInteractions(state, t, [q, r, t]).state, r)).toBe(false);
  });

  it('découvre et recouvre un cache, déplie et replie un post-it', () => {
    const covered = text('c', { cover: { kind: 'curtain', color: '#000' } });
    const note = text('n', { background: '#FDE047', collapsed: true });
    const open = button('o', [{ action: 'reveal', targetId: 'c' }, { action: 'unfold', targetId: 'n' }]);
    const s1 = fireInteractions(emptyReveal(), open, [covered, note, open]).state;
    expect(s1.objects.c).toBe(true);
    expect(s1.unfolded.n).toBe(true);
    const close = button('k', [{ action: 'cover', targetId: 'c' }, { action: 'fold', targetId: 'n' }]);
    const s2 = fireInteractions(s1, close, [covered, note, close]).state;
    expect(s2.objects.c).toBeUndefined();
    expect(s2.unfolded.n).toBeUndefined();
  });

  it("rend les pages, médias, widgets et la remise à zéro en effets, dans l'ordre, sans toucher l'état", () => {
    const audio: BoardObject = { id: 'a', type: 'audio', x: 0, y: 0, w: 100, h: 40, path: 'x.mp3' };
    const timer = widget('w', 'timer');
    const b = button('b', [
      { action: 'goto', params: { pageId: 'p2' } },
      { action: 'play', targetId: 'a' },
      { action: 'start', targetId: 'w' },
      { action: 'next' },
      { action: 'reset' },
    ]);
    const before = emptyReveal();
    const { state, effects } = fireInteractions(before, b, [audio, timer, b]);
    expect(effects).toEqual([
      { kind: 'page', pageId: 'p2' },
      { kind: 'command', targetId: 'a', command: 'play' },
      { kind: 'command', targetId: 'w', command: 'start' },
      { kind: 'pageDelta', delta: 1 },
      { kind: 'reset' },
    ]);
    expect(state.shown).toEqual({});
    expect(state.objects).toEqual({});
  });

  it('ignore une cible disparue et un goto sans page', () => {
    const b = button('b', [{ action: 'show', targetId: 'gone' }, { action: 'start', targetId: 'gone' }, { action: 'goto' }]);
    const { state, effects } = fireInteractions(emptyReveal(), b, [b]);
    expect(state.shown).toEqual({});
    expect(effects).toEqual([]);
  });

  it("ne rejoue pas une action « une seule fois », sauf après remise à zéro de la page", () => {
    const r = text('r', { hidden: true });
    const b = button('b', [{ action: 'toggle', targetId: 'r', once: true }]);
    const s1 = fireInteractions(emptyReveal(), b, [r, b]).state;
    expect(isObjectVisible(s1, r)).toBe(true);
    expect(s1.fired['b:0']).toBe(true);
    const s2 = fireInteractions(s1, b, [r, b]).state;
    expect(isObjectVisible(s2, r)).toBe(true);
    const s3 = recoverPage(s2, { id: 'p1', objects: [r, b], strokes: [] } as never);
    expect(s3.fired).toEqual({});
    expect(isObjectVisible(s3, r)).toBe(false);
    expect(s3.unfolded).toEqual({});
  });
});

describe('actionsFor', () => {
  it('propose les actions selon la cible', () => {
    expect(actionsFor(null)).toEqual(['goto', 'next', 'prev', 'reset']);
    expect(actionsFor(text('t')).slice(0, 3)).toEqual(['show', 'hide', 'toggle']);
    expect(actionsFor(text('t'))).not.toContain('reveal');
    expect(actionsFor(text('c', { cover: { kind: 'scratch', color: '#999' } }))).toContain('reveal');
    expect(actionsFor(text('n', { background: '#FDE047' }))).toContain('fold');
    expect(actionsFor(widget('w', 'timer'))).toContain('startToggle');
    expect(actionsFor(widget('d', 'dice'))).toContain('roll');
    expect(actionsFor(widget('d', 'dice'))).not.toContain('start');
  });
});

describe('describeInteraction / cloneObjects', () => {
  it('libelle une interaction avec sa cible ou sa page', () => {
    const objects = [text('q', { html: '<div>Question</div>' })];
    expect(describeInteraction({ action: 'hide', targetId: 'q' }, objects, [])).toBe('Masquer · Texte « Question »');
    expect(describeInteraction({ action: 'goto', params: { pageId: 'p3' } }, objects, ['p1', 'p2', 'p3'])).toBe('Aller à la page 3');
    expect(describeInteraction({ action: 'goto', params: { pageId: 'zz' } }, objects, ['p1'])).toBe('Aller à la page (page supprimée)');
    expect(describeInteraction({ action: 'next' }, objects, [])).toBe('Page suivante');
    expect(describeInteraction({ action: 'show', targetId: 'gone' }, objects, [])).toBe('Afficher · objet supprimé');
  });

  it('copie un bouton en remappant ses cibles copiées et en gardant les actions sans cible', () => {
    const q = text('q');
    const b = button('b', [{ action: 'hide', targetId: 'q' }, { action: 'next' }, { action: 'show', targetId: 'elsewhere' }]);
    const [q2, b2] = cloneObjects([q, b]);
    const its = b2.interactions ?? [];
    expect(its[0].targetId).toBe(q2.id);
    expect(its[1]).toEqual({ action: 'next' });
    expect(its[2].targetId).toBe('elsewhere');
  });
});

describe('lot B : fenêtre, zoom, déplacements', () => {
  const win: WindowObject = { id: 'w', type: 'window', x: 0, y: 0, w: 220, h: 56, title: 'Le noyau', html: '<div>…</div>' };

  it('ouvre une fenêtre et zoome par effets, sans toucher l’état', () => {
    const t = text('t');
    const b = button('b', [{ action: 'window', targetId: 'w' }, { action: 'zoomTo', targetId: 't' }, { action: 'window', targetId: 't' }]);
    const { state, effects } = fireInteractions(emptyReveal(), b, [win, t, b]);
    expect(effects).toEqual([{ kind: 'window', targetId: 'w' }, { kind: 'zoom', targetId: 't' }]);
    expect(state).toEqual(emptyReveal());
  });

  it('déplace une cible vers un point, la décale, la remet en place', () => {
    const t = text('t', { x: 100, y: 50 });
    const to = button('a', [{ action: 'moveTo', targetId: 't', params: { x: 400, y: 300 } }]);
    const s1 = fireInteractions(emptyReveal(), to, [t, to]).state;
    expect(s1.moved.t).toEqual({ dx: 300, dy: 250 });
    const by = button('c', [{ action: 'moveBy', targetId: 't', params: { dx: -50, dy: 25 } }]);
    const s2 = fireInteractions(s1, by, [t, by]).state;
    expect(s2.moved.t).toEqual({ dx: 250, dy: 275 });
    const back = button('d', [{ action: 'moveBack', targetId: 't' }]);
    expect(fireInteractions(s2, back, [t, back]).state.moved.t).toBeUndefined();
    expect(recoverPage(s2, { id: 'p', objects: [t], strokes: [] } as never).moved).toEqual({});
  });

  it('propose la fenêtre seulement sur une fenêtre, le zoom et le déplacement sur le reste', () => {
    expect(actionsFor(win)).toEqual(['window']);
    expect(actionsFor(text('t'))).toEqual(expect.arrayContaining(['zoomTo', 'moveTo', 'moveBy', 'moveBack']));
    expect(actionsFor(text('t'))).not.toContain('window');
    expect(describeInteraction({ action: 'moveBy', targetId: 't', params: { dx: 50, dy: -25 } }, [text('t', { html: 'Globule' })], [])).toBe('Décaler de (+50, -25) · Texte « Globule »');
    expect(describeInteraction({ action: 'window', targetId: 'w' }, [win], [])).toBe('Ouvrir la fenêtre · Fenêtre « Le noyau »');
  });
});
