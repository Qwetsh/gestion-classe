import { describe, expect, it } from 'vitest';
import {
  correctionMode,
  describeStartError,
  formatCost,
  isApiGrade,
  isRunActive,
  isRunInterrupted,
  latestRunByStudent,
  type AiCorrectionRun,
} from '../aiCorrection';

const run = (over: Partial<AiCorrectionRun>): AiCorrectionRun => ({
  id: 'r',
  assessment_id: 'a',
  student_id: 's',
  mode: 'corriger',
  status: 'running',
  error: null,
  model: 'claude-opus-5-5',
  attempts: 1,
  input_tokens: null,
  output_tokens: null,
  cache_creation_tokens: null,
  cache_read_tokens: null,
  cost_usd: null,
  grade: null,
  a_arbitrer: [],
  started_at: '2026-11-01T10:00:00Z',
  finished_at: null,
  ...over,
});

describe('correctionMode', () => {
  it('Corriger sans note, Recorriger avec, rien sans page', () => {
    expect(correctionMode({ pages: 3, grade: null })).toBe('corriger');
    expect(correctionMode({ pages: 3, grade: { grade: null } })).toBe('corriger'); // absent noté puis scanné
    expect(correctionMode({ pages: 3, grade: { grade: 12 } })).toBe('recorriger');
    expect(correctionMode({ pages: 0, grade: null })).toBeNull();
  });
});

describe('état d\'un appel', () => {
  const now = new Date('2026-11-01T10:03:00Z').getTime();
  it('en cours, puis interrompu après 10 minutes', () => {
    expect(isRunActive(run({}), now)).toBe(true);
    expect(isRunInterrupted(run({}), now)).toBe(false);
    const later = new Date('2026-11-01T10:11:00Z').getTime();
    expect(isRunActive(run({}), later)).toBe(false);
    expect(isRunInterrupted(run({}), later)).toBe(true);
    expect(isRunActive(run({ status: 'done' }), now)).toBe(false);
    expect(isRunActive(undefined, now)).toBe(false);
  });

  it('garde le dernier appel de chaque élève', () => {
    const runs = [
      run({ id: 'old', started_at: '2026-11-01T09:00:00Z' }),
      run({ id: 'new', started_at: '2026-11-01T10:00:00Z' }),
      run({ id: 'other', student_id: 't' }),
    ];
    const latest = latestRunByStudent(runs);
    expect(latest.s.id).toBe('new');
    expect(latest.t.id).toBe('other');
  });
});

describe('affichage', () => {
  it('reconnaît une note venue de l\'API', () => {
    expect(isApiGrade({ v: 1, source: 'api' })).toBe(true);
    expect(isApiGrade({ v: 1 })).toBe(false);
    expect(isApiGrade(null)).toBe(false);
  });
  it('messages et coût', () => {
    expect(describeStartError('no_kit')).toMatch('Corrige d’abord la classe dans le Correcteur');
    expect(describeStartError('bizarre')).toBe('Correction impossible (bizarre).');
    expect(formatCost(0.3124)).toBe('0,31 $');
    expect(formatCost(null)).toBe('—');
  });
});
