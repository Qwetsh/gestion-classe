import { describe, expect, it } from 'vitest';
import { lockPreparedPages } from '../boardPresent';
import type { BoardPage } from '../boardRender';
import type { BoardObject } from '../boardObjects';

const text = (id: string, extra: Partial<BoardObject> = {}): BoardObject =>
  ({ id, type: 'text', x: 0, y: 0, w: 100, size: 20, font: 'sans', color: '#111827', html: '<div>a</div>', ...extra }) as BoardObject;

const page = (id: string, objects?: BoardObject[]): BoardPage =>
  ({ id, background: 'blank', strokes: [], ...(objects ? { objects } : {}) }) as BoardPage;

describe('lockPreparedPages', () => {
  it('verrouille chaque objet préparé', () => {
    const out = lockPreparedPages([page('p1', [text('a'), text('b')]), page('p2', [text('c')])]);
    expect(out.flatMap((p) => p.objects ?? []).map((o) => o.locked)).toEqual([true, true, true]);
  });

  it('garde le rideau, les trous et les actions : seul le verrou change', () => {
    const cover = { kind: 'curtain' as const, color: '#1F4E79', label: 'Réponse' };
    const src = text('a', { cover, html: '<div><span data-gap="g1">mot</span></div>' } as Partial<BoardObject>);
    const [out] = lockPreparedPages([page('p1', [src])]);
    expect(out.objects?.[0]).toEqual({ ...src, locked: true });
  });

  it('ne modifie pas les pages reçues', () => {
    const src = [page('p1', [text('a')])];
    lockPreparedPages(src);
    expect(src[0].objects?.[0].locked).toBeUndefined();
  });

  it('laisse telle quelle une page sans objet', () => {
    const empty = page('p1');
    const noObjects = page('p2', []);
    const out = lockPreparedPages([empty, noObjects]);
    expect(out[0]).toBe(empty);
    expect(out[1]).toBe(noObjects);
  });
});
