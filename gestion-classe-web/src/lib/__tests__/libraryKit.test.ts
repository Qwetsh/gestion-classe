import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONSIGNES,
  baremeFromGrades,
  buildLibraryCorrige,
  buildLibraryKit,
  docImagePaths,
  docToText,
  isCorrectionRed,
  isHintGrey,
  isLibraryKit,
  libraryImages,
  validateBareme,
} from '../../../../supabase/functions/corriger-copie/libraryKit.ts';
import { pickKit } from '../../../../supabase/functions/corriger-copie/correction.ts';

const text = (t: string, color?: string) => ({ type: 'text', text: t, ...(color ? { marks: [{ type: 'textStyle', attrs: { color } }] } : {}) });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const img = (path: string) => ({ type: 'image', attrs: { path, width: 200 } });

const correction = {
  version: 2,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('Correction')] },
    p(text('Question 1 : Cite les 3 frontières.   /1.5')),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [p(text('Dorsales', '#C00000'))] },
      { type: 'listItem', content: [p(text('Zone de ', '#C00000'), text('subduction', '#c00000'))] },
    ] },
    p(text('Indice : pense aux volcans', '#606060')),
    p(text('Légende du document', '#6E6E6E')),
    img('u/import/carte.png'),
    { type: 'dots', attrs: { lines: 3 } },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [p(text('Critère'))] },
        { type: 'tableCell', content: [p(text('2 pts', '#C00000'))] },
      ] },
    ] },
  ],
};

describe('couleurs de la correction', () => {
  it('reconnaît le rouge des corrections et le gris des coups de pouce', () => {
    expect(isCorrectionRed('#C00000')).toBe(true);
    expect(isCorrectionRed('#ff0000')).toBe(true);
    expect(isCorrectionRed('#1E5945')).toBe(false);
    expect(isCorrectionRed(undefined)).toBe(false);
    expect(isHintGrey('#606060')).toBe(true);
    expect(isHintGrey('#6E6E6E')).toBe(false);
  });
});

describe('docToText', () => {
  const out = docToText(correction, (path) => `[img:${path}]`);
  it('garde les titres, les listes et les tableaux', () => {
    expect(out).toContain('## Correction');
    expect(out).toContain('Question 1 : Cite les 3 frontières.   /1.5');
    expect(out).toContain('| Critère | ⟨rouge⟩2 pts⟨/rouge⟩ |');
  });
  it('balise le rouge et le gris, en fusionnant les morceaux rouges voisins', () => {
    expect(out).toContain('- ⟨rouge⟩Dorsales⟨/rouge⟩');
    expect(out).toContain('- ⟨rouge⟩Zone de subduction⟨/rouge⟩');
    expect(out).toContain('⟨gris⟩Indice : pense aux volcans⟨/gris⟩');
    expect(out).toContain('Légende du document');
    expect(out).not.toContain('⟨gris⟩Légende');
  });
  it('repère les images et omet les pointillés', () => {
    expect(out).toContain('[img:u/import/carte.png]');
    expect(out).not.toContain('dots');
  });
  it('supporte un document vide ou mal formé', () => {
    expect(docToText(null)).toBe('');
    expect(docToText({ content: 'x' })).toBe('');
  });
});

describe('buildLibraryCorrige', () => {
  const sujet = { id: 's', title: 'Évaluation — Plaques', doc: { content: [p(text('Question 1 : Cite les 3 frontières.')), img('u/import/carte.png')] } };
  const docs = { id: 'd', title: 'Évaluation — Plaques (documents)', doc: { content: [img('u/import/doc1.png'), img('u/import/doc2.png')] } };
  const corr = { id: 'c', title: 'Évaluation — Plaques (correction)', doc: correction };

  it('assemble sujet, documents et correction, et numérote chaque image une seule fois', () => {
    const { corrige, images } = buildLibraryCorrige({ sujet, documents: docs, correction: corr });
    expect(images).toEqual(['u/import/carte.png', 'u/import/doc1.png', 'u/import/doc2.png']);
    expect(corrige).toContain('### Sujet distribué aux élèves — « Évaluation — Plaques »');
    expect(corrige).toContain('### Documents');
    expect(corrige).toContain('### Correction — « Évaluation — Plaques (correction) »');
    // La carte, déjà vue dans le sujet, garde son numéro dans la correction.
    expect(corrige.match(/\[Image 1\]/g)).toHaveLength(2);
    expect(corrige).toContain('⟨rouge⟩');
  });

  it('plafonne le nombre d’images jointes', () => {
    const { corrige, images } = buildLibraryCorrige({ sujet: null, documents: docs, correction: corr }, 1);
    expect(images).toEqual(['u/import/doc1.png']);
    expect(corrige).toContain('[Image non transmise]');
  });

  it('chemins des images d’un cours', () => {
    expect(docImagePaths(docs.doc)).toEqual(['u/import/doc1.png', 'u/import/doc2.png']);
    expect(docImagePaths(null)).toEqual([]);
  });
});

describe('baremeFromGrades', () => {
  const lines = (pts: number[]) => ({ v: 1, questions: pts.map((b, i) => ({ label: `Q${i + 1}`, bareme: b, points: 0, commentaire: '', competences: i === 0 ? ['Pratiquer des langages'] : [] })) });

  it('reprend les lignes des copies déjà corrigées (la plus fréquente, validées comptées double)', () => {
    const b = baremeFromGrades([
      { details: lines([2, 3]), is_validated: false },
      { details: lines([2, 3]), is_validated: false },
      { details: lines([5]), is_validated: true },
      { details: lines([5]), is_validated: true },
    ]);
    expect(b?.questions.map((q) => q.bareme)).toEqual([5]);
    expect(b?.competences).toEqual({ 'Pratiquer des langages': 'Pratiquer des langages' });
  });

  it('ne garde que la version du sujet de l’élève quand elle est connue', () => {
    const b = baremeFromGrades([
      { details: lines([2, 3]), subject_version: 'v5', is_validated: true },
      { details: lines([4, 1, 5]), subject_version: 'V4' },
    ], 'v4');
    expect(b?.questions.map((q) => q.bareme)).toEqual([4, 1, 5]);
  });

  it('null sans copie corrigée exploitable', () => {
    expect(baremeFromGrades([])).toBeNull();
    expect(baremeFromGrades([{ details: { questions: [{ label: '', bareme: 2 }] } }, { details: null }])).toBeNull();
  });
});

describe('validateBareme', () => {
  const ok = { questions: [{ label: 'Q1 — Frontières', bareme: 1.5, competences: [] }, { label: 'Partie 2', bareme: 18.5, competences: ['Raisonner'] }], remarque: '' };

  it('accepte un barème qui tombe sur le total de l’évaluation', () => {
    const r = validateBareme(ok, 20);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.competences).toEqual({ Raisonner: 'Raisonner' });
  });

  it('refuse un total différent, en citant la remarque de Claude', () => {
    const r = validateBareme({ ...ok, remarque: 'La partie 3 n’a pas de points.' }, 22);
    expect(r).toEqual({ ok: false, errors: ['le barème lu dans la correction fait 20 points, l\'évaluation est notée sur 22 (La partie 3 n’a pas de points.)'] });
  });

  it('refuse les lignes sans libellé, en double, ou hors quart de point', () => {
    const r = validateBareme({ questions: [{ label: 'Q1', bareme: 1.3 }, { label: 'q1', bareme: 2 }, { label: '', bareme: 0 }] }, 3.3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ; ')).toMatch(/multiple de 0,25.*double.*sans libellé/);
    expect(validateBareme({ questions: [] }, 20).ok).toBe(false);
    expect(validateBareme('x', 20).ok).toBe(false);
  });
});

describe('buildLibraryKit', () => {
  const base = {
    evaluation: 'Évaluation — Plaques',
    niveau: '4e',
    version: null,
    bareme: { competences: {}, questions: [{ label: 'Q1', bareme: 20 }] },
    baremeFrom: 'copies' as const,
    corrige: 'corrigé',
    images: ['a.png'],
    correction: { id: 'c', updated_at: '2026-11-20T10:00:00Z' },
  };

  it('reprend consignes et calibrage du dernier kit du Correcteur', () => {
    const kit = buildLibraryKit({ ...base, base: { consignes: '# Consignes de Thomas', calibrage: 'Demi-point au-dessus.' } });
    expect(kit).toMatchObject({ v: 1, source: 'bibliotheque', consignes: '# Consignes de Thomas', calibrage: 'Demi-point au-dessus.', harmonisation: '' });
    expect(kit.library).toEqual({ correction_board_id: 'c', correction_updated_at: '2026-11-20T10:00:00Z', bareme_from: 'copies', images: ['a.png'] });
    expect(isLibraryKit(kit)).toBe(true);
    expect(libraryImages(kit)).toEqual(['a.png']);
  });

  it('consignes par défaut sans kit du Correcteur', () => {
    const kit = buildLibraryKit({ ...base, base: null });
    expect(kit.consignes).toBe(DEFAULT_CONSIGNES);
    expect(kit.calibrage).toBe('');
  });

  it('un kit du Correcteur n’est pas un kit de la bibliothèque', () => {
    expect(isLibraryKit({ v: 1, consignes: 'x' })).toBe(false);
    expect(libraryImages({ v: 1 })).toEqual([]);
  });

  it('se choisit comme les autres kits (version de la copie)', () => {
    const kit = buildLibraryKit({ ...base, version: 'v5', base: null });
    expect(pickKit([{ kit, version_key: 'v5' }], 'V5', []).ok).toBe(true);
  });
});
