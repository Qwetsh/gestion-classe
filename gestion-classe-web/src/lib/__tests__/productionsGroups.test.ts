import { describe, expect, it } from 'vitest';
import { groupWorks, sameCorrection, type ActivityRow, type WorkRow } from '../productionsQueries';
import { buildClaudeExport } from '../productionsExport';

const work = (id: string, pseudo: string, extra: Partial<WorkRow> = {}): WorkRow => ({
  id, student_id: `s-${id}`, group_key: null, group_pseudos: [pseudo], content: { q3: 'réponse' }, status: 'submitted', version: 1,
  correction: null, advice: null, skills: null, total_points: null, students: { pseudo, class_id: 'c1' },
  ...extra,
} as unknown as WorkRow);

const activity = {
  id: 'a1', key: 'hopital-test', title: 'Hôpital', level: '3e', bareme_total: 10, expected_answers: null,
  definition: { questions: [{ id: 'q3', num: '3', points: 1, type: 'texte', titre: 'Diagnostic', consigne: 'c3', criteres: [{ id: 'ok', nom: 'Juste', points: 1 }] }] },
} as unknown as ActivityRow;

describe('productions de groupe', () => {
  it('réunit les élèves qui ont envoyé ensemble, triés par pseudo', () => {
    const groups = groupWorks([
      work('3', 'Zoé', { group_key: 'g1' }),
      work('1', 'Anna'),
      work('2', 'Léo', { group_key: 'g1' }),
    ]);
    expect(groups.map((g) => g.works.map((w) => w.students?.pseudo))).toEqual([['Anna'], ['Léo', 'Zoé']]);
  });

  it('sépare un membre dont le contenu a divergé (copie validée, puis renvoi des autres)', () => {
    const groups = groupWorks([
      work('1', 'Léo', { group_key: 'g1', content: { q3: 'ancienne' }, status: 'validated' }),
      work('2', 'Zoé', { group_key: 'g1', content: { q3: 'nouvelle' } }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('ne mélange pas deux élèves seuls au même contenu', () => {
    expect(groupWorks([work('1', 'Anna'), work('2', 'Bob')])).toHaveLength(2);
  });

  it('repère les membres corrigés à part', () => {
    const corr = { questions: { q3: { criteres: { ok: true } } } };
    expect(sameCorrection([work('1', 'A', { correction: corr, total_points: 1 }), work('2', 'B', { correction: corr, total_points: 1 })])).toBe(true);
    expect(sameCorrection([work('1', 'A', { correction: corr, total_points: 1 }), work('2', 'B', { correction: null, total_points: null })])).toBe(false);
  });

  it('exporte une seule copie par groupe pour Claude, avec tous les noms', () => {
    const md = buildClaudeExport(activity, [
      work('w-2', 'Zoé', { group_key: 'g1' }),
      work('w-1', 'Léo', { group_key: 'g1' }),
      work('w-3', 'Anna'),
    ], '3D');
    expect(md).toContain('## Copies (2)');
    expect(md).toContain('### Copie 2 — Léo, Zoé — work_id `w-1`');
    expect(md).toContain('copie de groupe, une seule correction pour tous');
    expect(md).not.toContain('`w-2`');
  });
});
