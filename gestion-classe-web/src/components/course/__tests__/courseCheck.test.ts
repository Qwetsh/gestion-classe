import { describe, expect, it } from 'vitest';
import { getSchema, type JSONContent } from '@tiptap/core';
import { courseExtensions } from '../courseExtensions';
import { checkCourseDraft, docProblem, draftInsertSQL, type CourseDraft } from '../courseCheck';
import { BUILTIN_TEMPLATES } from '../courseTemplates';

const noop = () => undefined;
const schema = getSchema(courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }));

const p = (text?: string): JSONContent => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const draft = (content: JSONContent[], extra: Partial<CourseDraft> = {}, settings?: Record<string, unknown>): CourseDraft => ({
  title: 'TEST', level: '3e', chapter: null,
  doc: { version: 1, content: { type: 'doc', content }, ...(settings ? { settings } : {}) },
  ...extra,
});
const check = (d: CourseDraft) => checkCourseDraft(schema, d);

describe('vérification des brouillons de cours', () => {
  it('le modèle « Fiche à cartouche » passe sans erreur ni avertissement', () => {
    const doc = BUILTIN_TEMPLATES.find((t) => t.id === 'activite-cartouche')!.build();
    expect(check({ title: 'Fiche', level: '3e', doc })).toMatchObject({ errors: [], warnings: [] });
  });

  it('un type de bloc inconnu est bloquant', () => {
    const r = check(draft([{ type: 'encadre', content: [p('x')] }]));
    expect(r.errors.join()).toMatch(/schéma/);
  });

  it('du texte directement dans un encadré est bloquant (il faut un paragraphe)', () => {
    const r = check(draft([{ type: 'callout', attrs: { kind: 'libre' }, content: [{ type: 'text', text: 'x' }] }]));
    expect(r.errors.join()).toMatch(/schéma/);
    expect(docProblem(schema, { type: 'doc', content: [{ type: 'callout', content: [{ type: 'text', text: 'x' }] }] })).not.toBeNull();
  });

  it('niveau, thème, police, couleurs et tailles invalides sont signalés', () => {
    const r = check(draft([
      { type: 'callout', attrs: { kind: 'libre', color: 'violet', frame: 'double' }, content: [p('x')] },
      { type: 'paragraph', content: [{ type: 'text', text: 'y', marks: [{ type: 'textStyle', attrs: { color: 'red', fontSize: '11px' } }] }] },
    ], { level: 'Troisième' }, { theme: 'rose', fontSize: 15, font: 'Calibri' }));
    expect(r.errors.length).toBe(8);
  });

  it('image sans fichier : bloquant ; attribut inconnu : avertissement', () => {
    const r = check(draft([{ type: 'image', attrs: { src: 'https://exemple.fr/a.png' } }, { type: 'paragraph', attrs: { couleur: 'bleu' }, content: [{ type: 'text', text: 'x' }] }]));
    expect(r.errors.join()).toMatch(/image sans fichier/);
    expect(r.warnings.join()).toMatch(/attribut « couleur »/);
  });

  it('un tableau aux fusions incohérentes est bloquant', () => {
    const cell = (rowspan = 1): JSONContent => ({ type: 'tableCell', attrs: { colspan: 1, rowspan }, content: [p('x')] });
    const r = check(draft([{ type: 'table', content: [
      { type: 'tableRow', content: [cell(3), cell()] },
      { type: 'tableRow', content: [cell(), cell()] },
    ] }]));
    expect(r.errors.join()).toMatch(/tableau n° 1/);
  });

  it('la requête échappe le texte et refuse un identifiant douteux', () => {
    const d = draft([p('prix : $gc_doc$ ; l’élève')], { title: "L'activité" });
    const sql = draftInsertSQL(d, '73f03330-7b03-42f1-b355-3378c4f94710');
    expect(sql).toContain("$gc_title$L'activité$gc_title$");
    expect(sql).toContain('$gc_doc1$');
    expect(sql).toMatch(/returning id, title;$/);
    expect(() => draftInsertSQL(d, "x'); drop table boards; --")).toThrow();
  });
});
