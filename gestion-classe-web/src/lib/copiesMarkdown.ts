import { fmt } from './correctionsPdf';
import { parseGradeDetails } from './gradeDetails';
import { parseTranscript } from './copyTranscript';
import { STATUS_LABEL, type GradeStatus } from './gradeStats';
import { splitPseudo } from './pronoteColumn';

/**
 * Export Markdown pseudonymisé des corrections d'une classe (hub Évaluations, phase 5), à
 * coller dans un assistant (Claude) pour une analyse de classe, un bilan, des remédiations.
 *
 * Aucun nom ne sort : chaque élève devient « Élève 01 », « Élève 02 »… dans l'ordre de la
 * liste de la classe — un numéro stable, que la fenêtre d'export rappelle (la correspondance
 * reste dans l'app). Les prénoms et pseudos de toute la classe sont remplacés partout
 * (commentaires, transcriptions) ; un mot en capitales qui commence comme le nom d'un élève
 * est masqué, pour le cas où une copie porte le nom de famille en entier.
 */

export interface MarkdownStudent {
  id: string;
  pseudo: string;
}

export interface MarkdownGrade {
  grade: number | null;
  grade_raw: number | null;
  status: string | null;
  is_validated: boolean;
  details?: unknown;
}

export interface CopiesMarkdownInput {
  assessmentName: string;
  className: string;
  bareme: number;
  /** Toute la classe, dans l'ordre de la liste : fixe les numéros. */
  roster: MarkdownStudent[];
  grades: Record<string, MarkdownGrade | undefined>;
  transcripts: Record<string, unknown>;
  /** Élèves à exporter (par défaut : tous ceux qui ont une note ou un statut). */
  only?: Set<string>;
  withTranscripts: boolean;
}

/** « Élève 01 » … : rang dans la liste de la classe, sur deux chiffres. */
export function studentLabels(roster: readonly MarkdownStudent[]): Map<string, string> {
  const width = roster.length >= 100 ? 3 : 2;
  return new Map(roster.map((s, i) => [s.id, `Élève ${String(i + 1).padStart(width, '0')}`]));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Remplace, dans un texte libre, les noms des élèves de la classe par leur numéro.
 * Renvoyée comme fonction : construite une fois pour toute la classe.
 */
export function makeScrubber(roster: readonly MarkdownStudent[], labels: Map<string, string>): (text: string) => string {
  type Rule = { re: RegExp; to: string };
  const rules: Rule[] = [];
  const B = '(?<![\\p{L}\\p{N}])';
  const E = '(?![\\p{L}\\p{N}])';
  for (const s of roster) {
    const label = labels.get(s.id) ?? 'Élève';
    const { first, initials } = splitPseudo(s.pseudo);
    const pseudo = s.pseudo.trim();
    const variants = new Set<string>();
    for (const v of [pseudo, pseudo.replace(/\.$/, ''), first]) {
      if (v.length >= 2) {
        variants.add(v);
        variants.add(stripAccents(v));
      }
    }
    // Prénom suivi du nom de famille (« Abigaël Faure ») : le nom part avec le prénom.
    if (first.length >= 2 && initials.length >= 2) {
      for (const f of new Set([first, stripAccents(first)])) {
        rules.push({ re: new RegExp(`${B}${escapeRegExp(f)}\\s+${escapeRegExp(initials)}[\\p{L}'’-]*\\.?${E}`, 'giu'), to: label });
      }
    }
    for (const v of [...variants].sort((a, b) => b.length - a.length)) {
      rules.push({ re: new RegExp(`${B}${escapeRegExp(v)}${E}`, 'giu'), to: label });
    }
  }
  // Plus long d'abord : « Marie-Lou DE. » avant « Marie ».
  rules.sort((a, b) => b.re.source.length - a.re.source.length);
  // Mot en capitales commençant comme le nom d'un élève (nom de famille écrit sur la copie).
  const initialsSet = [...new Set(roster.map((s) => splitPseudo(s.pseudo).initials).filter((i) => i.length >= 2))];
  const caps = initialsSet.length
    ? new RegExp(`${B}(?:${initialsSet.map(escapeRegExp).join('|')})[A-ZÀ-ÖØ-Þ'’-]{2,}${E}`, 'gu')
    : null;
  return (text: string) => {
    let out = text;
    for (const r of rules) out = out.replace(r.re, r.to);
    if (caps) out = out.replace(caps, '[nom]');
    return out;
  };
}

function cellText(s: string): string {
  return s.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

export function buildCopiesMarkdown(input: CopiesMarkdownInput): { markdown: string; count: number } {
  const labels = studentLabels(input.roster);
  const scrub = makeScrubber(input.roster, labels);
  const lines: string[] = [
    `# ${scrub(input.assessmentName)} · ${input.className}`,
    '',
    'Export pseudonymisé : chaque élève est désigné par un numéro, la correspondance reste dans Gestion Classe.'
      + ` Barème : /${fmt(input.bareme)}. Notes ramenées sur 20.`,
    '',
  ];
  let count = 0;
  for (const s of input.roster) {
    const g = input.grades[s.id];
    if (input.only ? !input.only.has(s.id) : !g) continue;
    count += 1;
    const label = labels.get(s.id)!;
    lines.push(`## ${label}`, '');
    const status = (g?.status ?? 'noted') as GradeStatus;
    if (!g) lines.push('- Pas de note', '');
    else if (status !== 'noted') lines.push(`- ${STATUS_LABEL[status] ?? status}`, '');
    else {
      const raw = g.grade_raw !== null ? ` (${fmt(Number(g.grade_raw))}/${fmt(input.bareme)})` : '';
      lines.push(`- Note : ${fmt(g.grade)}/20${raw}${g.is_validated ? '' : ' · brouillon, pas encore validée'}`, '');
    }
    const d = parseGradeDetails(g?.details);
    if (d) {
      if (d.questions.length > 0) {
        lines.push('| Question | Points | Commentaire |', '|---|---|---|');
        for (const q of d.questions) {
          lines.push(`| ${cellText(scrub(q.label))} | ${fmt(q.points)}/${fmt(q.bareme)} | ${cellText(scrub(q.commentaire))} |`);
        }
        lines.push('');
      }
      if (d.competences.length > 0) {
        lines.push(`**Compétences** : ${d.competences.map((c) => `${scrub(c.nom)} (${c.niveau ?? '?'})`).join(' ; ')}`, '');
      }
      if (d.forces) lines.push(`**Points forts** : ${scrub(d.forces)}`, '');
      if (d.faiblesses) lines.push(`**À travailler** : ${scrub(d.faiblesses)}`, '');
      if (d.commentaire) lines.push(`**Commentaire** : ${scrub(d.commentaire)}`, '');
    }
    if (input.withTranscripts) {
      const t = parseTranscript(input.transcripts[s.id]);
      if (t) {
        lines.push('### Copie (transcription)', '');
        for (const item of t) lines.push(`**${scrub(item.q) || '—'}** : ${scrub(item.texte).trim()}`, '');
      }
    }
  }
  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', count };
}
