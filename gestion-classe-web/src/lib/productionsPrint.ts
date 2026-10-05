import { checkQ1Cell, q1Label, type ActivityQuestion, type ActivityRow, type Q1Row, type WorkRow } from './productionsQueries';

/**
 * Impression des copies corrigées d'une activité numérique : une page par élève, avec ses réponses,
 * les critères acquis ou non, la remarque par question, les compétences et les conseils.
 * Ouvre une fenêtre d'impression du navigateur (HTML autonome, aucune dépendance).
 */

const ZONE_NAMES: Record<string, string> = {
  islande: 'Islande', atlantique: 'Atlantique', andes: 'Andes', java: 'Java', himalaya: 'Himalaya', rhin: 'Fossé rhénan',
};
const SKILL_LEVELS = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne'];

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');

function questionPoints(q: ActivityQuestion, work: WorkRow): number {
  const c = work.correction?.questions[q.id];
  if (!c) return 0;
  if (typeof c.points === 'number') return c.points;
  return q.criteres.reduce((s, cr) => s + (c.criteres?.[cr.id] ? cr.points : 0), 0);
}

function answerHtml(def: ActivityRow['definition'], q: ActivityQuestion, content: Record<string, unknown>): string {
  const v = content[q.id];
  if (q.type === 'tableau') {
    const lignes = (v ?? {}) as Record<string, Q1Row>;
    const rows = (def.lignes_q1 ?? []).map((l, i) => {
      const row = lignes[l.id] ?? {};
      const cells = (def.colonnes_q1 ?? []).map((col) => {
        const champs = col.champs ?? [{ id: col.id }];
        const auto = q.criteres.some((cr) => cr.auto?.colonne === col.id) ? checkQ1Cell(def, row, col.id) : null;
        const texte = champs.map((ch) => q1Label(def, ch, row[ch.id])).filter(Boolean).join(' · ');
        const mark = auto === true ? '<b class="ok">✓</b> ' : auto === false ? '<b class="ko">✗</b> ' : '';
        return `<div><span class="lbl">${esc(col.nom)} :</span> ${texte ? mark + esc(texte) : '<span class="vide">—</span>'}</div>`;
      });
      return `<tr><td class="zone"><b>Ligne ${i + 1}</b><br>${esc(ZONE_NAMES[row.zone ?? ''] ?? row.zone ?? '—')}</td><td>${cells.join('')}</td></tr>`;
    });
    return `<table class="q1">${rows.join('')}</table>`;
  }
  if (q.type === 'deductive') {
    const o = (v ?? {}) as Record<string, string>;
    return (q.champs ?? []).map((ch) => `<div><span class="lbl">${esc(ch.nom)}</span><div class="texte">${o[ch.id] ? esc(o[ch.id]) : '<span class="vide">—</span>'}</div></div>`).join('');
  }
  const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return `<div class="texte">${t ? esc(t) : '<span class="vide">— (pas de réponse)</span>'}</div>`;
}

function copyHtml(activity: ActivityRow, work: WorkRow): string {
  const def = activity.definition;
  const content = work.content;
  const total = work.total_points != null ? pts(Number(work.total_points)) : '—';
  const questions = def.questions.map((q) => {
    const c = work.correction?.questions[q.id];
    const crit = q.criteres.map((cr) => {
      const on = !!c?.criteres?.[cr.id];
      return `<li class="${on ? 'ok' : 'ko'}"><span class="case">${on ? '✓' : '✗'}</span> ${esc(cr.nom)} <span class="pt">${q.bonus ? '★' : pts(cr.points) + ' pt'}</span></li>`;
    });
    return `
      <section class="question">
        <header><span class="num">${esc(q.num)}</span><span class="titre">${esc(q.titre)}</span>
          <span class="score">${q.bonus ? 'bonus' : `${pts(questionPoints(q, work))} / ${pts(q.points)}`}</span></header>
        <div class="corps">
          <div class="reponse">${answerHtml(def, q, content)}</div>
          <div class="criteres"><ul>${crit.join('')}</ul>${c?.remarque ? `<p class="remarque">${esc(c.remarque)}</p>` : ''}</div>
        </div>
      </section>`;
  });
  const skills = (def.competences ?? []).map((comp) => {
    const lvl = work.skills?.[comp.id];
    return `<li>${esc(comp.nom)} : <b>${lvl ? `${lvl} · ${SKILL_LEVELS[lvl - 1]}` : '—'}</b></li>`;
  });
  return `
    <article class="copie">
      <header class="tete">
        <div>
          <div class="eleve">${esc(work.students?.pseudo ?? 'Élève')} <span class="classe">· ${esc(work.classes?.name ?? '')}${work.group_pseudos.length > 1 ? ` · binôme : ${esc(work.group_pseudos.join(', '))}` : ''}</span></div>
          <div class="activite">${esc(activity.title)}${activity.sequence ? ` · ${esc(activity.sequence)}` : ''} · envoi n°${work.version} du ${fmtDate(work.submitted_at)}</div>
        </div>
        <div class="note"><b>${total}</b> / ${esc(activity.bareme_total)}</div>
      </header>
      ${questions.join('')}
      <section class="bilan">
        <div><div class="lbl">Compétences</div><ul>${skills.join('')}</ul></div>
        <div><div class="lbl">Conseils pour la prochaine fois</div><div class="texte">${work.advice ? esc(work.advice) : '<span class="vide">—</span>'}</div></div>
      </section>
    </article>`;
}

const CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.35 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  .copie { page-break-after: always; }
  .copie:last-child { page-break-after: auto; }
  .tete { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
  .eleve { font-size: 16pt; font-weight: 700; }
  .classe { font-weight: 400; color: #555; font-size: 11pt; }
  .activite { color: #555; font-size: 9.5pt; }
  .note { font-size: 18pt; white-space: nowrap; border: 2px solid #111; border-radius: 6px; padding: 4px 10px; }
  .question { border: 1px solid #999; border-radius: 6px; margin-bottom: 8px; page-break-inside: avoid; }
  .question header { display: flex; align-items: baseline; gap: 8px; padding: 4px 8px; background: #eee; border-bottom: 1px solid #999; }
  .num { font-weight: 700; } .titre { flex: 1; font-weight: 600; } .score { font-size: 10pt; }
  .corps { display: grid; grid-template-columns: 1.2fr 1fr; }
  .reponse { padding: 6px 8px; border-right: 1px solid #ccc; font-size: 10pt; }
  .criteres { padding: 6px 8px; font-size: 9.5pt; }
  .criteres ul { list-style: none; margin: 0; padding: 0; }
  .criteres li { display: flex; gap: 6px; margin-bottom: 2px; }
  .criteres li .case { font-weight: 700; width: 12px; }
  .criteres li .pt { margin-left: auto; color: #666; white-space: nowrap; }
  .criteres li.ko { color: #777; }
  .remarque { margin: 6px 0 0; padding: 4px 6px; border-left: 3px solid #b45309; background: #fff7e6; font-size: 9.5pt; }
  .lbl { color: #666; font-size: 9pt; font-weight: 600; }
  .texte { white-space: pre-wrap; margin-bottom: 4px; }
  .vide { color: #aaa; }
  .ok { color: #047857; } .ko { color: #b91c1c; }
  .q1 { border-collapse: collapse; width: 100%; }
  .q1 td { vertical-align: top; padding: 3px 4px; border-top: 1px solid #ddd; }
  .q1 .zone { width: 70px; }
  .bilan { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid #999; padding-top: 6px; font-size: 10pt; }
  .bilan ul { margin: 2px 0 0; padding-left: 16px; }
`;

/** Ouvre une fenêtre d'impression avec une page par copie (les copies sans correction sont ignorées). */
export function printWorks(activity: ActivityRow, works: WorkRow[], className: string): number {
  const corrected = works.filter((w) => w.correction && (w.status === 'corrected' || w.status === 'validated'));
  if (corrected.length === 0) return 0;
  const sorted = [...corrected].sort((a, b) => (a.students?.pseudo ?? '').localeCompare(b.students?.pseudo ?? ''));
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(activity.title)} · ${esc(className)} · copies corrigées</title><style>${CSS}</style></head>
<body>${sorted.map((w) => copyHtml(activity, w)).join('')}<script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script></body></html>`;
  const win = window.open('', '_blank');
  if (!win) throw new Error('Le navigateur a bloqué la fenêtre d’impression : autorise les fenêtres surgissantes pour ce site.');
  win.document.open();
  win.document.write(html);
  win.document.close();
  return sorted.length;
}
