import { describe, expect, it } from 'vitest';
import { getSchema } from '@tiptap/core';
import { courseExtensions } from '../courseExtensions';
import { BUILTIN_TEMPLATES } from '../courseTemplates';
import { COURSE_BLOCKS } from '../courseBlocks';

// Le schéma réel de l'éditeur (les rappels ne servent pas : on ne monte pas d'éditeur)
const noop = () => undefined;
const schema = getSchema(courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }));

describe('modèles et blocs', () => {
  it.each(BUILTIN_TEMPLATES.map((t) => [t.id, t] as const))('le modèle « %s » respecte le schéma', (_id, t) => {
    const node = schema.nodeFromJSON(t.build().content);
    expect(() => node.check()).not.toThrow();
  });

  it.each(COURSE_BLOCKS.map((b) => [b.id, b] as const))('le bloc « %s » respecte le schéma', (_id, b) => {
    const node = schema.nodeFromJSON({ type: 'doc', content: b.build() });
    expect(() => node.check()).not.toThrow();
  });

  it('le cartouche d’activité garde ses fusions et ses fonds', () => {
    const table = COURSE_BLOCKS.find((b) => b.id === 'cartouche-activite')!.build().find((n) => n.type === 'table')!;
    const first = table.content![0].content![0];
    expect(first.attrs).toMatchObject({ rowspan: 6, backgroundColor: '#1F4E79', verticalAlign: 'middle' });
    expect(table.content).toHaveLength(6);
  });
});
