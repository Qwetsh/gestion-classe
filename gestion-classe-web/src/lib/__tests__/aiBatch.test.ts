import { describe, expect, it } from 'vitest';
import type { AiCorrectionRun } from '../aiCorrection';
import {
  batchCandidates,
  batchProgress,
  canLaunchNext,
  estimateBatchCost,
  isFatalRunError,
  newBatch,
} from '../aiBatch';

const NOW = Date.parse('2026-11-02T20:00:00Z');

function run(studentId: string, id: string, status: AiCorrectionRun['status'], minutesAgo = 1, error: string | null = null): AiCorrectionRun {
  return {
    id, assessment_id: 'a', student_id: studentId, mode: 'corriger', status, error, model: null, attempts: 1,
    input_tokens: null, output_tokens: null, cache_creation_tokens: null, cache_read_tokens: null, cost_usd: null,
    grade: null, a_arbitrer: [], started_at: new Date(NOW - minutesAgo * 60_000).toISOString(), finished_at: null,
  };
}

const student = (id: string) => ({ id, pseudo: `Élève ${id}` });

describe('correction en lot', () => {
  it('ne prend que les copies scannées sans note ni statut, et pas déjà en cours', () => {
    const rows = [
      { student: student('a'), pages: [1], grade: null },
      { student: student('b'), pages: [1], grade: { grade: 12, status: 'noted' } },
      { student: student('c'), pages: [], grade: null },
      { student: student('d'), pages: [1], grade: { grade: null, status: 'absent' } },
      { student: student('e'), pages: [1], grade: { grade: null, status: 'noted' } },
      { student: student('f'), pages: [1], grade: null },
    ];
    const runs = { f: run('f', 'r1', 'running') };
    expect(batchCandidates(rows, runs, NOW).map((s) => s.id)).toEqual(['a', 'e']);
    // Un appel « en cours » depuis plus de 10 min est interrompu : la copie redevient à corriger.
    expect(batchCandidates(rows, { f: run('f', 'r1', 'running', 30) }, NOW).map((s) => s.id)).toEqual(['a', 'e', 'f']);
  });

  it('annonce le coût du lot', () => {
    expect(estimateBatchCost(25)).toBe('≈ 7,50 $');
  });

  it('compte corrigées, en cours, erreurs, et ne lance pas plus de deux copies', () => {
    const b = newBatch([student('a'), student('b'), student('c'), student('d')]);
    const pseudo = (id: string) => `Élève ${id}`;
    expect(canLaunchNext(b, batchProgress(b, {}, pseudo, NOW))).toBe(true);

    const twoStarted = { ...b, pending: b.pending.slice(2), started: { a: 'r1', b: 'r2' } };
    // Appels pas encore relus : comptés en cours.
    expect(batchProgress(twoStarted, {}, pseudo, NOW).running).toBe(2);
    expect(canLaunchNext(twoStarted, batchProgress(twoStarted, {}, pseudo, NOW))).toBe(false);

    const runs = { a: run('a', 'r1', 'done'), b: run('b', 'r2', 'error', 1, 'Erreur de l\'API Claude (500)') };
    const p = batchProgress(twoStarted, runs, pseudo, NOW);
    expect(p).toMatchObject({ done: 1, running: 0, finished: false });
    expect(p.errors).toEqual([{ studentId: 'b', pseudo: 'Élève b', message: 'Erreur de l\'API Claude (500)' }]);
    expect(canLaunchNext(twoStarted, p)).toBe(true);

    // Arrêt demandé : plus rien ne se lance, le lot se termine quand les appels en cours ont fini.
    const stopped = { ...twoStarted, stopping: true };
    expect(canLaunchNext(stopped, p)).toBe(false);
    expect(batchProgress(stopped, runs, pseudo, NOW).finished).toBe(true);
  });

  it('reconnaît une erreur qui toucherait toutes les copies', () => {
    expect(isFatalRunError('Clé API Anthropic refusée (secret ANTHROPIC_API_KEY).')).toBe(true);
    expect(isFatalRunError('Limite de l\'API atteinte (crédits ou débit) : réessaie plus tard.')).toBe(true);
    expect(isFatalRunError('Erreur de l\'API Claude (529) : Overloaded')).toBe(false);
    expect(isFatalRunError(null)).toBe(false);
  });
});
