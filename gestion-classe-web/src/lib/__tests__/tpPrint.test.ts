import { describe, expect, it } from 'vitest';
import { tpPrintHtml } from '../tpPrint';
import type { Tp } from '../tpQueries';

const tp: Tp = {
  id: 'x', name: 'Eau iodée <amidon>', color: 'green', theme: null, level: '5e', chapter: 'Séquence 3 — Végétaux', activity: '3',
  problem: 'Que fabrique la plante ?', duration_min: 55, modality: 'Binôme',
  materials: ['Feuille de géranium'], protocol: ['Décolorer', 'Ajouter l\'eau iodée'], safety: ['Lunettes'],
  criteria: [{ label: 'Témoin', max_points: 1.5, hint: 'Feuille à l\'obscurité' }, { label: 'Conclusion', max_points: 2, hint: null }],
  created_at: '', usage_count: 0,
};

describe('tpPrintHtml', () => {
  const html = tpPrintHtml(tp);
  it('échappe le texte', () => {
    expect(html).toContain('Eau iodée &lt;amidon&gt;');
    expect(html).not.toContain('<amidon>');
  });
  it('numérote le protocole et totalise le barème', () => {
    expect(html).toContain('<ol><li>Décolorer</li>');
    expect(html).toContain('… / 1,5');
    expect(html).toContain('… / 3,5');
    expect(html).toContain('5e · Séquence 3 — Végétaux · Binôme · 55 min');
  });
  it('omet les sections vides', () => {
    expect(tpPrintHtml({ ...tp, safety: [], criteria: [] })).not.toContain('Sécurité</h2>');
  });
});
