import { describe, expect, it } from 'vitest';
import { sameCourseContent, type CourseDoc } from '../courseDoc';

const doc = (over: Partial<CourseDoc> = {}): CourseDoc => ({
  version: 1,
  content: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Bonjour' }] }] },
  settings: {},
  ...over,
} as CourseDoc);

describe('sameCourseContent', () => {
  it('ignore le numéro d’enregistrement et l’ordre des clés', () => {
    const stored = JSON.parse('{"settings":{},"content":{"content":[{"content":[{"text":"Bonjour","type":"text"}],"attrs":{"textAlign":null},"type":"paragraph"}],"type":"doc"},"version":1,"rev":"abc"}') as CourseDoc;
    expect(sameCourseContent(doc(), stored)).toBe(true);
  });

  it('voit un vrai changement', () => {
    const changed = doc({ content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonsoir' }] }] } } as Partial<CourseDoc>);
    expect(sameCourseContent(doc(), changed)).toBe(false);
    expect(sameCourseContent(doc(), doc({ screens: ['p1'] }))).toBe(false);
  });

  it('ne compare rien sans document de référence', () => {
    expect(sameCourseContent(doc(), null)).toBe(false);
  });
});
