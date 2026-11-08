import { ZONE_NAMES, checkQ1Cell, q1Label, questionScore, type ActivityQuestion, type ActivityRow, type Q1Row, type WorkRow } from './productionsQueries';

/**
 * Impression des copies corrigées d'une activité numérique : une page par élève, avec ses réponses,
 * les critères acquis ou non, la remarque par question, les compétences et les conseils.
 * Ouvre une fenêtre d'impression du navigateur (HTML autonome, aucune dépendance).
 *
 * Une copie tient sur une page A4 : mise en page serrée (pas d'encadré par question, titre et
 * réponse à gauche, critères et remarque à droite), questions non notées et sans remarque omises,
 * puis un petit script réduit la taille du texte copie par copie jusqu'à ce qu'elle tienne
 * (de 9 pt à 7 pt). Au-delà, la copie déborde sur une deuxième page plutôt que d'être illisible.
 */

const SKILL_LEVELS = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne'];

/** Marges de la page, en mm (servent aussi au calcul de la hauteur disponible). */
const PAGE_MARGIN_MM = 8;
/** Tailles de texte essayées, de la plus confortable à la plus petite encore lisible (pt). */
const FONT_STEPS = [9, 8.75, 8.5, 8.25, 8, 7.75, 7.5, 7.25, 7];

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');

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
        return `<span class="cell"><span class="lbl">${esc(col.nom)} :</span> ${texte ? mark + esc(texte) : '<span class="vide">—</span>'}</span>`;
      });
      return `<tr><td class="zone"><b>${i + 1}.</b> ${esc(ZONE_NAMES[String(row.zone ?? '')] ?? row.zone ?? '—')}</td><td>${cells.join(' ')}</td></tr>`;
    });
    return `<table class="q1">${rows.join('')}</table>`;
  }
  if (q.type === 'deductive') {
    const o = (v ?? {}) as Record<string, string>;
    return (q.champs ?? []).map((ch) => `<div class="texte"><span class="lbl">${esc(ch.nom)} :</span> ${o[ch.id] ? esc(o[ch.id]) : '<span class="vide">—</span>'}</div>`).join('');
  }
  const t = v == null ? '' : typeof v === 'string' ? v.trim() : JSON.stringify(v);
  return `<div class="texte">${t ? esc(t) : '<span class="vide">— pas de réponse</span>'}</div>`;
}

/** Une question est notée si elle rapporte des points ou si un de ses critères en rapporte. */
const isGraded = (q: ActivityQuestion): boolean => q.points > 0 || q.criteres.some((cr) => cr.points > 0);

function copyHtml(activity: ActivityRow, work: WorkRow): string {
  const def = activity.definition;
  const content = work.content;
  const total = work.total_points != null ? pts(Number(work.total_points)) : '—';
  const questions = def.questions.flatMap((q) => {
    const c = work.correction?.questions[q.id];
    const remarque = c?.remarque?.trim();
    const graded = isGraded(q);
    // Question facultative ou réservée au professeur, sans rien à dire à l'élève : on ne l'imprime pas.
    if (!graded && !remarque) return [];
    const crit = graded
      ? q.criteres.map((cr) => {
        const on = !!c?.criteres?.[cr.id];
        return `<li class="${on ? 'ok' : 'ko'}"><span class="case">${on ? '✓' : '✗'}</span><span class="nom">${esc(cr.nom)}</span><span class="pt">${q.bonus ? '★' : pts(cr.points)}</span></li>`;
      })
      : [];
    const score = q.bonus ? '★' : graded ? `${pts(questionScore(q, work.correction))}<span class="sur">/${pts(q.points)}</span>` : '';
    return [`
      <section class="q">
        <div class="rep"><div class="titre"><b class="num">${esc(q.num)}</b> ${esc(q.titre)}</div>${answerHtml(def, q, content)}</div>
        <div class="cor">${crit.length ? `<ul>${crit.join('')}</ul>` : ''}${remarque ? `<p class="remarque">${esc(remarque)}</p>` : ''}</div>
        <div class="score">${score}</div>
      </section>`];
  });
  const skills = (def.competences ?? []).map((comp) => {
    const lvl = work.skills?.[comp.id];
    return `<li>${esc(comp.nom)} : <b>${lvl ? `${lvl} · ${SKILL_LEVELS[lvl - 1]}` : '—'}</b></li>`;
  });
  const advice = work.advice?.trim();
  const bilan = [
    skills.length ? `<div><div class="lbl">Compétences</div><ul>${skills.join('')}</ul></div>` : '',
    advice ? `<div><div class="lbl">Conseils pour la prochaine fois</div><div class="texte">${esc(advice)}</div></div>` : '',
  ].filter(Boolean);
  const binome = work.group_pseudos.length > 1 ? ` · avec ${esc(work.group_pseudos.filter((p) => p !== work.students?.pseudo).join(', '))}` : '';
  return `
    <article class="copie">
      <header class="tete">
        <div class="id">
          <div><span class="eleve">${esc(work.students?.pseudo ?? 'Élève')}</span> <span class="classe">${esc(work.classes?.name ?? '')}${binome}</span></div>
          <div class="activite">${esc(activity.title)}${activity.sequence ? ` · ${esc(activity.sequence)}` : ''} · envoi n°${work.version} du ${fmtDate(work.submitted_at)}</div>
        </div>
        <div class="note"><b>${total}</b> / ${esc(activity.bareme_total)}</div>
      </header>
      ${questions.join('')}
      ${bilan.length ? `<section class="bilan${bilan.length === 1 ? ' seul' : ''}">${bilan.join('')}</section>` : ''}
    </article>`;
}

const CSS = `
  @page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Largeur fixée à la zone imprimable : la mesure à l'écran vaut celle du papier. */
  .copie { --fs: 9pt; width: ${210 - 2 * PAGE_MARGIN_MM}mm; font-size: var(--fs); line-height: 1.22; break-after: page; }
  .copie:last-child { break-after: auto; }
  .tete { display: flex; justify-content: space-between; align-items: center; gap: 2mm; border-bottom: 1.5px solid #111; padding-bottom: 1mm; margin-bottom: 0.6mm; }
  .eleve { font-size: 1.55em; font-weight: 700; }
  .classe { color: #555; }
  .activite { color: #555; font-size: 0.9em; }
  .note { font-size: 1.6em; white-space: nowrap; border: 1.5px solid #111; border-radius: 4px; padding: 0 2.5mm; }
  .q { display: grid; grid-template-columns: 46% 1fr 3.4em; column-gap: 2mm; padding: 0.7mm 0; border-bottom: 0.5px solid #c8c8c8; break-inside: avoid; }
  .titre { font-weight: 600; color: #333; font-size: 0.94em; }
  .num { display: inline-block; min-width: 1.3em; color: #111; }
  .rep .texte { white-space: pre-wrap; overflow-wrap: anywhere; }
  .cor ul { list-style: none; margin: 0; padding: 0; }
  .cor li { display: flex; gap: 1mm; }
  .cor .case { font-weight: 700; width: 0.9em; flex: none; }
  .cor .nom { flex: 1; }
  .cor .pt { color: #666; white-space: nowrap; font-size: 0.92em; }
  .cor li.ko { color: #666; } .cor li.ok .case { color: #047857; } .cor li.ko .case { color: #b91c1c; }
  .remarque { margin: 0.3mm 0 0; padding-left: 1.5mm; border-left: 2px solid #b45309; color: #222; }
  .score { text-align: right; font-weight: 700; white-space: nowrap; }
  .score .sur { font-weight: 400; color: #666; font-size: 0.85em; }
  .lbl { color: #666; font-size: 0.92em; font-weight: 600; }
  .vide { color: #999; font-style: italic; }
  .ok { color: #047857; } .ko { color: #b91c1c; }
  .q1 { border-collapse: collapse; width: 100%; }
  .q1 td { vertical-align: top; padding: 0.3mm 1mm 0.3mm 0; border-top: 0.5px solid #ddd; }
  .q1 .zone { white-space: nowrap; }
  .q1 .cell { margin-right: 1.5mm; }
  .bilan { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 1mm; padding-top: 0.8mm; border-top: 1px solid #888; }
  .bilan.seul { grid-template-columns: 1fr; }
  .bilan ul { margin: 0; padding-left: 4mm; }
  .bilan .texte { white-space: pre-wrap; }
`;

/**
 * Réduit la taille du texte de chaque copie jusqu'à ce qu'elle tienne sur une page.
 * Exécuté dans la fenêtre d'impression, avant l'appel à print().
 */
const FIT_SCRIPT = `
(function () {
  var pageH = ${297 - 2 * PAGE_MARGIN_MM} * 96 / 25.4 - 2;
  var steps = ${JSON.stringify(FONT_STEPS)};
  document.querySelectorAll('.copie').forEach(function (c) {
    for (var i = 0; i < steps.length; i++) {
      c.style.setProperty('--fs', steps[i] + 'pt');
      c.dataset.fs = String(steps[i]);
      if (c.getBoundingClientRect().height <= pageH) return;
    }
    c.dataset.deborde = '1';
  });
})();
`;

/** Copies corrigées, triées par pseudo (les copies sans correction sont ignorées). */
function printableWorks(works: WorkRow[]): WorkRow[] {
  return works
    .filter((w) => w.correction && (w.status === 'corrected' || w.status === 'validated'))
    .sort((a, b) => (a.students?.pseudo ?? '').localeCompare(b.students?.pseudo ?? ''));
}

/** Document HTML autonome des copies ; `autoPrint` ouvre la boîte d'impression une fois la mise à la page faite. */
export function buildWorksPrintHtml(activity: ActivityRow, works: WorkRow[], className: string, autoPrint = false): string {
  const sorted = printableWorks(works);
  const trigger = autoPrint ? `window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(activity.title)} · ${esc(className)} · copies corrigées</title><style>${CSS}</style></head>
<body>${sorted.map((w) => copyHtml(activity, w)).join('')}<script>${FIT_SCRIPT}${trigger}</script></body></html>`;
}

/** Ouvre une fenêtre d'impression avec une page par copie (les copies sans correction sont ignorées). */
export function printWorks(activity: ActivityRow, works: WorkRow[], className: string): number {
  const sorted = printableWorks(works);
  if (sorted.length === 0) return 0;
  const html = buildWorksPrintHtml(activity, sorted, className, true);
  const win = window.open('', '_blank');
  if (!win) throw new Error('Le navigateur a bloqué la fenêtre d’impression : autorise les fenêtres surgissantes pour ce site.');
  win.document.open();
  win.document.write(html);
  win.document.close();
  return sorted.length;
}
