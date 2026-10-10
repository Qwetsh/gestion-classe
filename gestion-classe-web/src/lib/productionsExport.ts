import {
  ZONE_NAMES,
  applyAuto,
  autoPoints,
  checkQ1Cell,
  computeTotal,
  q1Label,
  saveWorkCorrection,
  type ActivityQuestion,
  type ActivityRow,
  type Q1Row,
  type WorkCorrection,
  type WorkRow,
} from './productionsQueries';

/**
 * Correction par Claude : export des copies d'une classe en un document Markdown lisible (consignes, barème,
 * corrigé attendu, copies), puis import du JSON renvoyé par le correcteur (critères cochés, remarques,
 * compétences, conseils), enregistré sur chaque copie avec corrected_by = 'claude'.
 * La question 1 (réponses fermées) reste corrigée automatiquement ici : le correcteur ne la touche pas.
 */

const pts = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
const today = (): string => new Date().toLocaleDateString('fr-FR');

function answerText(def: ActivityRow['definition'], q: ActivityQuestion, content: Record<string, unknown>): string {
  const v = content[q.id];
  if (q.type === 'tableau') {
    const lignes = (v ?? {}) as Record<string, Q1Row>;
    return (def.lignes_q1 ?? []).map((l, i) => {
      const row = lignes[l.id] ?? {};
      const cells = (def.colonnes_q1 ?? []).map((col) => {
        const champs = col.champs ?? [{ id: col.id }];
        const auto = q.criteres.some((cr) => cr.auto?.colonne === col.id) ? checkQ1Cell(def, row, col.id) : null;
        const texte = champs.map((ch) => q1Label(def, ch, row[ch.id])).filter(Boolean).join(' · ') || '—';
        return `  - ${col.nom} : ${auto === true ? '✓ ' : auto === false ? '✗ ' : ''}${texte}`;
      });
      return `- Ligne ${i + 1} (${ZONE_NAMES[String(row.zone ?? '')] ?? row.zone ?? 'zone non choisie'})\n${cells.join('\n')}`;
    }).join('\n');
  }
  if (q.type === 'deductive') {
    const o = (v ?? {}) as Record<string, string>;
    return (q.champs ?? []).map((ch) => `- ${ch.nom} : ${o[ch.id]?.trim() ? o[ch.id].trim() : '(vide)'}`).join('\n');
  }
  const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return t.trim() ? t.trim() : '(pas de réponse)';
}

/** Document Markdown à donner au correcteur. */
export function buildClaudeExport(activity: ActivityRow, works: WorkRow[], className: string): string {
  const def = activity.definition;
  const open = def.questions.filter((q) => !q.criteres.some((cr) => cr.auto));
  const sorted = [...works].sort((a, b) => (a.students?.pseudo ?? '').localeCompare(b.students?.pseudo ?? ''));
  const exemple = {
    work_id: sorted[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    pseudo: sorted[0]?.students?.pseudo ?? 'Élève',
    questions: Object.fromEntries(open.map((q) => [q.id, { criteres: Object.fromEntries(q.criteres.map((cr) => [cr.id, false])), remarque: '' }])),
    skills: Object.fromEntries((def.competences ?? []).map((c) => [c.id, 0])),
    advice: '',
  };

  const out: string[] = [];
  out.push(`# Correction de copies — ${activity.title} · classe ${className} · export du ${today()}`);
  out.push('');
  out.push('## Consignes pour le correcteur');
  out.push('');
  out.push(`Tu corriges des fiches d'activité de ${activity.level ?? 'collège'} en SVT, remplies dans l'application « Terre en mouvement » et envoyées à gestion-classe. Chaque copie est notée sur ${activity.bareme_total} d'après des critères à points fixes : un critère est acquis (true) ou non (false), jamais à moitié.`);
  out.push('');
  out.push('- Corrige seulement les questions ouvertes listées dans « Barème » ci-dessous. La question 1 (réponses fermées) est déjà corrigée automatiquement : ne la renvoie pas.');
  out.push('- Sois exigeant mais juste : un élève qui a l’idée mais la formule mal garde le critère ; une case vide ou hors sujet ne l’a pas. Applique les règles du corrigé attendu.');
  out.push('- `remarque` : une phrase courte par question, concrète, adressée à l’élève (tutoiement), qui dit quoi améliorer. Vide si tout est juste.');
  out.push('- `skills` : niveau 1 à 4 par compétence (1 insuffisante · 2 fragile · 3 satisfaisante · 4 très bonne), 0 si non évaluable.');
  out.push('- `advice` : un ou deux conseils pour la prochaine fois, tournés vers l’élève. Deux phrases maximum.');
  out.push('- Ne modifie pas les identifiants (`work_id`, ids de questions et de critères). Ne change pas les points.');
  out.push('- Réponds avec UN SEUL bloc de code ```json contenant un tableau avec une entrée par copie, exactement dans ce format (exemple pour la première copie) :');
  out.push('');
  out.push('```json');
  out.push(JSON.stringify([exemple], null, 2));
  out.push('```');
  out.push('');
  out.push('Ce JSON est ensuite importé dans gestion-classe (page Productions, bouton « Importer la correction Claude »). Si tu disposes d’un accès direct à la base Supabase de gestion-classe (connecteur), tu peux aussi écrire la correction toi-même : pour chaque copie, `UPDATE student_works SET correction = <json {questions}>, advice = <texte>, skills = <json>, corrected_by = \'claude\', corrected_at = now(), status = \'corrected\', modified_after_correction = false WHERE id = <work_id>` ; dans ce cas, garde les critères automatiques de la question 1 déjà présents dans `correction` et laisse `total_points` être recalculé à l’import ou renseigne-le toi-même (somme des points des critères acquis, bonus exclu).');
  out.push('');
  out.push('## Barème et critères');
  out.push('');
  for (const q of def.questions) {
    const auto = q.criteres.some((cr) => cr.auto);
    out.push(`### ${q.num}. ${q.titre} — ${q.bonus ? 'bonus, non compté' : `${pts(q.points)} pt${q.points > 1 ? 's' : ''}`}${auto ? ' — corrigée automatiquement, ne pas renvoyer' : ` — id \`${q.id}\``}`);
    out.push('');
    out.push(`Consigne donnée à l’élève : ${q.consigne}`);
    if (q.champs?.length) out.push(`Réponse attendue en ${q.champs.length} temps : ${q.champs.map((c) => c.nom).join(' / ')}.`);
    if (!auto) {
      out.push('');
      for (const cr of q.criteres) out.push(`- \`${cr.id}\` (${q.bonus ? '★' : pts(cr.points) + ' pt'}) : ${cr.nom}`);
    }
    out.push('');
  }
  out.push('## Corrigé attendu et règles de notation');
  out.push('');
  out.push(activity.expected_answers?.trim() || '(aucun corrigé attendu saisi dans gestion-classe)');
  out.push('');
  out.push(`## Copies (${sorted.length})`);
  out.push('');
  sorted.forEach((w, i) => {
    const a = autoPoints(def, w.content);
    out.push(`### Copie ${i + 1} — ${w.students?.pseudo ?? 'Élève'} — work_id \`${w.id}\``);
    out.push('');
    out.push(`Envoi n°${w.version}${w.group_pseudos.length > 1 ? ` · binôme : ${w.group_pseudos.join(', ')}` : ''}${a ? ` · question 1 (auto) : ${pts(a.points)} / ${pts(a.max)}` : ''}`);
    out.push('');
    for (const q of def.questions) {
      out.push(`**${q.num}. ${q.titre}**${q.criteres.some((cr) => cr.auto) ? ' (auto, pour information)' : ''}`);
      out.push('');
      out.push(answerText(def, q, w.content));
      out.push('');
    }
  });
  return out.join('\n');
}

/** Déclenche le téléchargement d'un fichier texte. */
export function downloadText(name: string, text: string, type = 'text/markdown'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ClaudeEntry {
  work_id: string;
  pseudo?: string;
  questions?: Record<string, { criteres?: Record<string, unknown>; remarque?: unknown; points?: unknown }>;
  skills?: Record<string, unknown>;
  advice?: unknown;
}

/** Extrait le tableau JSON d'une réponse de Claude (JSON brut, ou bloc ```json dans un texte). */
export function parseClaudeCorrection(text: string): ClaudeEntry[] {
  const t = text.trim();
  let body = t;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1];
  else if (!t.startsWith('[')) {
    const i = t.indexOf('['), j = t.lastIndexOf(']');
    if (i >= 0 && j > i) body = t.slice(i, j + 1);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new Error('Fichier illisible : il faut le tableau JSON renvoyé par Claude (ou un texte qui contient un bloc ```json).'); }
  const arr = Array.isArray(parsed) ? parsed : (parsed as { copies?: unknown })?.copies;
  if (!Array.isArray(arr)) throw new Error('Le JSON doit être un tableau avec une entrée par copie.');
  return arr.filter((e): e is ClaudeEntry => !!e && typeof e === 'object' && typeof (e as ClaudeEntry).work_id === 'string');
}

/** Transforme une entrée Claude en correction (questions ouvertes seulement, critères connus, booléens stricts). */
export function correctionFromEntry(def: ActivityRow['definition'], entry: ClaudeEntry): WorkCorrection {
  const questions: WorkCorrection['questions'] = {};
  for (const q of def.questions) {
    if (q.criteres.some((cr) => cr.auto)) continue;
    const src = entry.questions?.[q.id];
    if (!src) continue;
    const criteres: Record<string, boolean> = {};
    for (const cr of q.criteres) {
      const v = src.criteres?.[cr.id];
      criteres[cr.id] = v === true || v === 'true' || v === 1;
    }
    questions[q.id] = { criteres, points: null, remarque: typeof src.remarque === 'string' ? src.remarque.trim() : '' };
  }
  return { questions };
}

function skillsFromEntry(def: ActivityRow['definition'], entry: ClaudeEntry): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const c of def.competences ?? []) {
    const v = Number(entry.skills?.[c.id]);
    if (Number.isInteger(v) && v >= 1 && v <= 4) out[c.id] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Enregistre les corrections de Claude sur les copies correspondantes. Renvoie les copies mises à jour. */
export async function importClaudeCorrections(
  activity: ActivityRow,
  works: WorkRow[],
  entries: ClaudeEntry[],
): Promise<{ updated: WorkRow[]; skipped: string[] }> {
  const def = activity.definition;
  const updated: WorkRow[] = [];
  const skipped: string[] = [];
  for (const e of entries) {
    const w = works.find((x) => x.id === e.work_id);
    if (!w) { skipped.push(`${e.pseudo ?? e.work_id} : copie introuvable dans cette classe`); continue; }
    if (w.status === 'validated') { skipped.push(`${w.students?.pseudo ?? e.work_id} : copie déjà validée`); continue; }
    const correction = applyAuto(def, correctionFromEntry(def, e), w.content);
    const advice = typeof e.advice === 'string' && e.advice.trim() ? e.advice.trim() : null;
    const skills = skillsFromEntry(def, e);
    const totalPoints = computeTotal(def, correction);
    await saveWorkCorrection(w.id, { correction, advice, skills, totalPoints, correctedBy: 'claude' });
    updated.push({ ...w, correction, advice, skills, total_points: totalPoints, corrected_by: 'claude', corrected_at: new Date().toISOString(), status: 'corrected', modified_after_correction: false });
  }
  return { updated, skipped };
}
