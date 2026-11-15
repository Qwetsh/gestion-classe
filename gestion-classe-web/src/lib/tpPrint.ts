/**
 * Fiche imprimable d'un TP (une page A4) : problématique, matériel par poste, protocole,
 * sécurité, barème. Ouverte dans une fenêtre à part pour ne pas dépendre des règles
 * d'impression de l'application.
 */
import { formatPoints, totalPoints } from './tpLibrary';
import type { Tp } from './tpQueries';

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML complet de la fiche (testable sans navigateur). */
export function tpPrintHtml(tp: Tp): string {
  const meta = [tp.level, tp.chapter, tp.modality, tp.duration_min ? `${tp.duration_min} min` : null].filter(Boolean).map((m) => esc(String(m))).join(' · ');
  const list = (items: string[], ordered = false) => {
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag}>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</${tag}>`;
  };
  const total = totalPoints(tp.criteria);
  const rows = tp.criteria.map((c) => `<tr><td>${esc(c.label)}${c.hint ? `<div class="hint">${esc(c.hint)}</div>` : ''}</td><td class="pts">… / ${formatPoints(c.max_points)}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(tp.name)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: Inter, system-ui, sans-serif; font-size: 11pt; color: #18181b; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2pt; }
  .meta { color: #52525b; font-size: 9.5pt; margin-bottom: 8pt; }
  .problem { border-left: 3pt solid #4f46e5; padding: 4pt 8pt; margin: 6pt 0 10pt; font-style: italic; }
  h2 { font-size: 11.5pt; margin: 10pt 0 3pt; text-transform: uppercase; letter-spacing: .04em; color: #3f3f46; }
  ul, ol { margin: 0; padding-left: 16pt; } li { margin: 1.5pt 0; }
  .cols { display: grid; grid-template-columns: 1fr 1.6fr; gap: 14pt; }
  .safety { background: #fef2f2; border: 1pt solid #fecaca; padding: 4pt 8pt; border-radius: 4pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 3pt; }
  td { border: 0.75pt solid #d4d4d8; padding: 4pt 6pt; vertical-align: top; }
  td.pts { width: 18%; text-align: right; white-space: nowrap; }
  .hint { color: #71717a; font-size: 9pt; margin-top: 1pt; }
  tr.total td { font-weight: 700; }
</style></head><body>
<h1>${esc(tp.name)}</h1>
${meta ? `<div class="meta">${meta}</div>` : ''}
${tp.problem ? `<div class="problem">${esc(tp.problem)}</div>` : ''}
<div class="cols">
  <div>${tp.materials.length ? `<h2>Matériel par poste</h2>${list(tp.materials)}` : ''}
  ${tp.safety.length ? `<h2>Sécurité</h2><div class="safety">${list(tp.safety)}</div>` : ''}</div>
  <div>${tp.protocol.length ? `<h2>Protocole</h2>${list(tp.protocol, true)}` : ''}</div>
</div>
${tp.criteria.length ? `<h2>Barème</h2><table>${rows}<tr class="total"><td>Total</td><td class="pts">… / ${formatPoints(total)}</td></tr></table>` : ''}
</body></html>`;
}

/** Ouvre la fiche dans une nouvelle fenêtre et lance l'impression. Rend false si la fenêtre est bloquée. */
export function printTp(tp: Tp): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(tpPrintHtml(tp));
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 250);
  return true;
}
