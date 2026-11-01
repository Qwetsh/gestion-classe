import { describe, expect, it } from 'vitest';
import {
  buildGrade,
  buildOutputSchema,
  competenceLevels,
  estimateCostUsd,
  formatKitBlock,
  formatReference,
  niveau,
  noteSur20,
  pickReferences,
  validateOutput,
  type CorrectionKit,
  type ReferenceCandidate,
} from '../../../../supabase/functions/corriger-copie/correction.ts';

const kit: CorrectionKit = {
  v: 1,
  evaluation: 'Volcans, séismes et roches',
  niveau: '4e',
  version: null,
  bareme: {
    competences: { Restituer: 'D1.3', Raisonner: 'D4', Orpheline: 'D2' },
    questions: [
      { label: 'Q1 Magma', bareme: 1, competences: ['Restituer'] },
      { label: 'Q2 Viscosité', bareme: 0.5, competences: ['Restituer'] },
      { label: 'Q3 Plaques', bareme: 2, competences: ['Raisonner', 'Restituer'] },
    ],
  },
  corrige: 'Q1 : le magma est une roche fondue en profondeur.',
  calibrage: '## Calibrage\n- Indulgent sur l\'orthographe.',
  harmonisation: '',
  consignes: 'Tu corriges…',
};

const goodRaw = {
  questions: {
    L01: { points: 0.75, commentaire: 'Presque : la lave est le magma en surface.' },
    L02: { points: 0.5, commentaire: 'Bien.' },
    L03: { points: 1.25, commentaire: 'Tu cites les plaques, sans expliquer.' },
  },
  forces: 'Tu connais le vocabulaire.',
  faiblesses: 'Tu expliques peu.',
  commentaire: 'Nathan, bon début. Explique davantage.',
  transcription: [{ q: 'Q1', texte: 'Le magma c une roche fondu' }],
  a_arbitrer: [{ question: 'Q3 Plaques', note_mise: 1.25, raison: 'Mot illisible.' }],
};

describe('noteSur20 (identique au Correcteur)', () => {
  it('arrondit au demi-point supérieur', () => {
    expect(noteSur20(2.5, 3.5)).toBe(14.5); // 14,2857… → 14,5
    expect(noteSur20(17, 20)).toBe(17);
    expect(noteSur20(0, 20)).toBe(0);
    expect(noteSur20(20, 20)).toBe(20);
  });
  it('ne monte pas d\'un demi-point sur une erreur d\'arrondi binaire', () => {
    // 7 × 20 / 28 = 5 exactement ; 0,1 + 0,2 style ne doit pas donner 5,5
    expect(noteSur20(7, 28)).toBe(5);
    expect(noteSur20(14.25, 28.5)).toBe(10);
  });
});

describe('niveaux de compétence', () => {
  it('suit les seuils 80 / 60 / 40 %', () => {
    expect(niveau(0.8)).toBe('Très bonne maîtrise');
    expect(niveau(0.79)).toBe('Satisfaisante');
    expect(niveau(0.6)).toBe('Satisfaisante');
    expect(niveau(0.4)).toBe('Fragile');
    expect(niveau(0.39)).toBe('Insuffisante');
  });
  it('compte les points des lignes rattachées et omet une compétence sans ligne', () => {
    // Restituer : (0,75 + 0,5 + 1,25) / (1 + 0,5 + 2) = 2,5 / 3,5 = 71 % ; Raisonner : 1,25 / 2 = 62,5 %
    expect(competenceLevels(kit, [0.75, 0.5, 1.25])).toEqual([
      { nom: 'Restituer', niveau: 'Satisfaisante' },
      { nom: 'Raisonner', niveau: 'Satisfaisante' },
    ]);
  });
});

describe('validateOutput', () => {
  it('accepte une sortie conforme et la remet dans l\'ordre du barème', () => {
    const r = validateOutput(goodRaw, kit.bareme.questions);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.questions.map((q) => q.points)).toEqual([0.75, 0.5, 1.25]);
      expect(r.value.a_arbitrer).toHaveLength(1);
    }
  });

  it('accepte aussi les lignes en tableau', () => {
    const raw = { ...goodRaw, questions: Object.values(goodRaw.questions) };
    expect(validateOutput(raw, kit.bareme.questions).ok).toBe(true);
  });

  it('refuse une ligne manquante ou en trop', () => {
    const missing = { ...goodRaw, questions: { L01: goodRaw.questions.L01, L02: goodRaw.questions.L02 } };
    const r1 = validateOutput(missing, kit.bareme.questions);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors[0]).toMatch('2 ligne(s) notée(s), le barème en compte 3');

    const extra = { ...goodRaw, questions: { ...goodRaw.questions, L04: { points: 0, commentaire: 'x' } } };
    expect(validateOutput(extra, kit.bareme.questions).ok).toBe(false);
  });

  it('refuse des points hors barème ou pas multiples de 0,25', () => {
    const over = { ...goodRaw, questions: { ...goodRaw.questions, L02: { points: 0.75, commentaire: 'x' } } };
    const r = validateOutput(over, kit.bareme.questions);
    expect(!r.ok && r.errors).toEqual(['Q2 Viscosité : 0.75 pt hors barème (0 à 0.5)']);

    const odd = { ...goodRaw, questions: { ...goodRaw.questions, L03: { points: 1.3, commentaire: 'x' } } };
    const r2 = validateOutput(odd, kit.bareme.questions);
    expect(!r2.ok && r2.errors).toEqual(["Q3 Plaques : 1.3 n'est pas un multiple de 0,25"]);

    const neg = { ...goodRaw, questions: { ...goodRaw.questions, L01: { points: -0.25, commentaire: 'x' } } };
    expect(validateOutput(neg, kit.bareme.questions).ok).toBe(false);
  });

  it('refuse les champs vides et une transcription vide', () => {
    const r = validateOutput(
      { ...goodRaw, forces: ' ', transcription: [], questions: { ...goodRaw.questions, L01: { points: 1, commentaire: '' } } },
      kit.bareme.questions,
    );
    expect(!r.ok && r.errors).toEqual([
      'Q1 Magma : commentaire vide',
      'champ « forces » vide',
      'transcription vide ou mal formée',
    ]);
    expect(validateOutput('pas du JSON', kit.bareme.questions).ok).toBe(false);
  });
});

describe('buildGrade', () => {
  it('construit la note et le détail v1 comme build_details', () => {
    const r = validateOutput(goodRaw, kit.bareme.questions);
    if (!r.ok) throw new Error('sortie invalide');
    const g = buildGrade(kit, r.value);
    expect(g.grade).toBe(14.5);
    expect(g.grade_raw).toBe(2.5);
    expect(g.comment).toBe('Nathan, bon début. Explique davantage.');
    expect(g.details).toMatchObject({
      v: 1,
      evaluation: 'Volcans, séismes et roches',
      bareme_total: 3.5,
      note_brute: 2.5,
      note_forcee: false,
      source: 'api',
      forces: 'Tu connais le vocabulaire.',
    });
    expect((g.details.questions as unknown[])[2]).toEqual({
      label: 'Q3 Plaques',
      bareme: 2,
      points: 1.25,
      commentaire: 'Tu cites les plaques, sans expliquer.',
      competences: ['Raisonner', 'Restituer'],
    });
    // Les points à arbitrer et la transcription restent hors du détail (lu par l'élève).
    expect(JSON.stringify(g.details)).not.toMatch(/illisible|roche fondu/);
  });
});

describe('buildOutputSchema', () => {
  it('rend chaque ligne du barème obligatoire', () => {
    const s = buildOutputSchema(kit.bareme.questions) as { properties: { questions: { required: string[] } } };
    expect(s.properties.questions.required).toEqual(['L01', 'L02', 'L03']);
  });
});

describe('pickReferences', () => {
  const details = (pts: number[]) => ({
    questions: kit.bareme.questions.map((q, i) => ({ label: q.label, bareme: q.bareme, points: pts[i], commentaire: 'c' })),
  });
  const cand = (id: string, grade: number, opts: Partial<ReferenceCandidate> = {}): ReferenceCandidate => ({
    student_id: id,
    grade,
    is_validated: false,
    details: details([0, 0, 0]),
    transcript: [{ q: 'Q1', texte: 't' }],
    ...opts,
  });

  it('répartit les références sur l\'éventail des notes', () => {
    const cs = [4, 6, 8, 10, 11, 12, 13, 14, 16, 18, 19].map((g, i) => cand(`s${i}`, g));
    expect(pickReferences(cs, kit, 'x').map((c) => c.grade)).toEqual([4, 10, 12, 16, 19]);
  });

  it('exclut l\'élève corrigé et les copies d\'un autre barème', () => {
    const other = { questions: [{ label: 'Autre', bareme: 1, points: 1, commentaire: 'c' }] };
    const cs = [cand('target', 10), cand('a', 12), cand('b', 14, { details: other })];
    expect(pickReferences(cs, kit, 'target').map((c) => c.student_id)).toEqual(['a']);
  });

  it('préfère les copies validées et transcrites', () => {
    const cs = [
      cand('v1', 8, { is_validated: true }),
      cand('v2', 12, { is_validated: true }),
      cand('d1', 10),
      cand('notr', 15, { is_validated: true, transcript: null }),
    ];
    expect(pickReferences(cs, kit, 'x', 2).map((c) => c.student_id)).toEqual(['v1', 'v2']);
    // Pas assez de validées transcrites : on complète par les brouillons transcrits avant les copies sans transcription.
    expect(pickReferences(cs, kit, 'x', 3).map((c) => c.student_id)).toEqual(['v1', 'd1', 'v2']);
  });
});

describe('textes envoyés', () => {
  it('une référence ne contient ni nom ni commentaire général', () => {
    const ref: ReferenceCandidate = {
      student_id: 's',
      grade: 13.5,
      is_validated: true,
      details: {
        questions: [{ label: 'Q1 Magma', bareme: 1, points: 0.5, commentaire: 'Moitié.' }],
        forces: 'Vocabulaire.',
        faiblesses: 'Explications.',
        commentaire: 'Léa, beau travail.',
      },
      transcript: [{ q: 'Q1', texte: 'roche fondu' }],
    };
    const txt = formatReference(ref, 0);
    expect(txt).toContain('13,5/20 (validée par Thomas)');
    expect(txt).toContain('[Q1] roche fondu');
    expect(txt).toContain('- Q1 Magma : 0,5/1 — Moitié.');
    expect(txt).not.toContain('Léa');
  });

  it('le bloc du kit liste le barème et dit quand il n\'y a pas d\'harmonisation', () => {
    const txt = formatKitBlock(kit);
    expect(txt).toContain('L03. Q3 Plaques : sur 2 — Raisonner, Restituer');
    expect(txt).toContain('Total : 3,5 points.');
    expect(txt).toMatch(/harmonisation de cette évaluation\nAucune\./);
  });
});

describe('estimateCostUsd', () => {
  it('applique le tarif Opus 5.5', () => {
    expect(
      estimateCostUsd({ input_tokens: 20_000, output_tokens: 8_000, cache_creation_tokens: 10_000, cache_read_tokens: 0 }),
    ).toBe(0.29); // 0,08 + 0,16 + 0,05
    expect(estimateCostUsd({ input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 1_000_000 })).toBe(0.2);
  });
});
