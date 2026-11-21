/**
 * Page web « pour les élèves » : les écrans d'un tableau dans leur état final (le corrigé), en un
 * seul fichier HTML qu'on donne aux élèves (ENT, Pronote, clé USB).
 *
 * - À l'écran : chaque page est une image, les animations se jouent dans leur cadre isolé, avec
 *   leurs boutons « Étape précédente / suivante / Rejouer » sous la page ; les boutons d'un
 *   sommaire mènent à la page visée.
 * - À l'impression (bouton « Imprimer ») : deux écrans par feuille A4, l'animation remplacée par
 *   son image figée (celle des vignettes et de l'export PDF), sans aucun bouton.
 *
 * Ici, la partie pure (état final d'une page, document HTML) ; le rendu et le téléchargement sont
 * dans `boardHandoutExport`.
 */
import { objectRect, type BoardObject } from './boardObjects';
import type { AnimationObject } from './boardAnimation';

/** Page réduite à ce qu'il faut pour l'état final. */
export interface HandoutSourcePage {
  id: string;
  objects: BoardObject[];
}

export interface HandoutLink {
  /** Emprise du bouton, en unités de page. */
  rect: { x: number; y: number; w: number; h: number };
  /** Page visée (identifiant). */
  pageId: string;
}

export interface HandoutPageState<P extends HandoutSourcePage> {
  /** La page à dessiner : sans boutons, avec ce que les boutons auraient montré. */
  page: P;
  /** Boutons d'un sommaire : gardés à l'image, rendus cliquables dans la page web. */
  links: HandoutLink[];
  /** Animations de la page (jouables dans la page web). */
  animations: AnimationObject[];
}

/** Un bouton « pour le prof » : il agit sur la page sans être du contenu. Un lien de sommaire n'en est pas un. */
const isControl = (o: BoardObject) => (o.interactions?.length ?? 0) > 0 && !o.interactions!.some((it) => it.action === 'goto' && it.params?.pageId);

/**
 * État final d'une page, pour la donner aux élèves :
 * - les boutons qui montrent ou cachent sont « appuyés » dans l'ordre de la page (« Suivant 1/3 »,
 *   puis « 2/3 »…) : ce qu'ils montrent est là, ce qu'ils cachent (eux-mêmes, un « ? ») disparaît ;
 * - les boutons eux-mêmes ne sont pas dessinés (ils ne feraient rien), sauf les liens de sommaire ;
 * - ce qui reste masqué sans qu'aucun bouton le montre reste masqué (brouillon, variante) ;
 * - les caches (rideaux, tickets) et les trous sont ouverts par le rendu « corrigé ».
 */
export function handoutPage<P extends HandoutSourcePage>(page: P): HandoutPageState<P> {
  const objects = page.objects ?? [];
  const visible = new Map(objects.map((o) => [o.id, !o.hidden]));
  for (const o of objects) {
    if (!isControl(o)) continue;
    for (const it of o.interactions ?? []) {
      if (!it.targetId || !visible.has(it.targetId)) continue;
      if (it.action === 'show') visible.set(it.targetId, true);
      else if (it.action === 'hide') visible.set(it.targetId, false);
      else if (it.action === 'toggle') visible.set(it.targetId, !visible.get(it.targetId));
    }
  }
  const kept = objects
    .filter((o) => visible.get(o.id) && !isControl(o))
    .map((o) => (o.hidden ? { ...o, hidden: false } : o));
  const links: HandoutLink[] = [];
  for (const o of kept) {
    const target = o.interactions?.find((it) => it.action === 'goto' && it.params?.pageId);
    if (target?.params?.pageId) links.push({ rect: objectRect(o), pageId: target.params.pageId });
  }
  return {
    page: { ...page, objects: kept },
    links,
    animations: kept.filter((o): o is AnimationObject => o.type === 'animation'),
  };
}

// ---- Document HTML ----

/** Rectangle en fractions de la page (0 → 1). */
export interface FractionRect { x: number; y: number; w: number; h: number }

export interface HandoutScreen {
  /** Image de la page (adresse data:). */
  image: string;
  /** Liens vers d'autres écrans du fichier (index dans `screens`). */
  links: { rect: FractionRect; target: number }[];
  /** Animations posées sur la page : index dans `animations`. */
  animations: { rect: FractionRect; index: number }[];
}

export interface HandoutAnimation {
  title: string;
  /** Nombre d'étapes pilotables (1 : pas de boutons d'étape). */
  steps: number;
  /** Document complet à donner au cadre isolé (politique de contenu, bibliothèques en place). */
  srcdoc: string;
  /** Fichiers joints de la scène, en base64, envoyés au cadre quand il les demande. */
  assets: { name: string; type: string; base64: string }[];
}

export interface HandoutDocument {
  title: string;
  screens: HandoutScreen[];
  animations: HandoutAnimation[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 10000) / 100}%`;
const place = (r: FractionRect) => `left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)}`;
/** JSON posé dans un <script> : « </script » et « <!-- » ne doivent ni le fermer ni le commenter. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Rectangle en unités de page → fractions de la page. */
export function toFraction(rect: { x: number; y: number; w: number; h: number }, pageW: number, pageH: number): FractionRect {
  return { x: rect.x / pageW, y: rect.y / pageH, w: rect.w / pageW, h: rect.h / pageH };
}

/** Le fichier HTML complet, autonome (aucune ressource extérieure). */
export function buildHandoutHtml(doc: HandoutDocument): string {
  const screens = doc.screens.map((s, i) => {
    const links = s.links.map((l) => `<a class="link" href="#ecran-${l.target + 1}" style="${place(l.rect)}" aria-label="Aller à l'écran ${l.target + 1}"></a>`).join('');
    const frames = s.animations.map((a) => `<div class="anim" data-anim="${a.index}" style="${place(a.rect)}"></div>`).join('');
    const navs = s.animations
      .filter((a) => doc.animations[a.index] && doc.animations[a.index].steps > 1)
      .map((a) => {
        const anim = doc.animations[a.index];
        return `<div class="nav" data-nav="${a.index}">`
          + `<span class="nav__title">${esc(anim.title)}</span>`
          + `<button type="button" data-cmd="prev" data-i="${a.index}">◀ Étape précédente</button>`
          + `<span class="nav__count" data-count="${a.index}">1 / ${anim.steps}</span>`
          + `<button type="button" data-cmd="next" data-i="${a.index}" class="nav__next">Étape suivante ▶</button>`
          + `<button type="button" data-cmd="replay" data-i="${a.index}">↺ Rejouer</button>`
          + '</div>';
      }).join('');
    return `<section class="screen" id="ecran-${i + 1}"><div class="page"><img src="${s.image}" alt="Écran ${i + 1}">${links}${frames}</div>${navs}</section>`;
  }).join('\n');

  const data = doc.animations.map((a) => ({ title: a.title, steps: a.steps, srcdoc: a.srcdoc, assets: a.assets }));
  const hasAnim = doc.animations.length > 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="bar">
  <h1>${esc(doc.title)}</h1>
  <button type="button" id="gc-print" title="${hasAnim ? 'Les animations sont imprimées en image fixe' : 'Imprimer'}">🖨 Imprimer</button>
</header>
<main>
${screens}
</main>
<script type="application/json" id="gc-data">${scriptJson(data)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const CSS = `
:root{--ink:#1d2433;--muted:#64748B;--line:#D9DEE7;--accent:#1F4E79}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:#EEF1F5;color:var(--ink);font:16px/1.4 Inter,"Segoe UI",system-ui,Arial,sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#fff;border-bottom:1px solid var(--line)}
.bar h1{flex:1;min-width:0;margin:0;font-size:18px;font-weight:700;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar button{flex:none;height:40px;padding:0 16px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:600 15px/1 inherit;font-family:inherit;cursor:pointer}
main{max-width:1100px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:20px}
.screen{background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(15,23,42,.12);overflow:hidden;scroll-margin-top:72px}
.page{position:relative}
.page img{display:block;width:100%;height:auto}
.link{position:absolute;border-radius:8px}
.link:hover,.link:focus-visible{outline:3px solid #2E75B6;outline-offset:2px}
.anim{position:absolute;background:#fff}
.anim iframe{display:block;width:100%;height:100%;border:0}
.nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:10px 12px;background:#E8EEF6;border-top:1px solid var(--line)}
.nav__title{flex-basis:100%;text-align:center;font-weight:600;color:var(--accent)}
.nav button{height:38px;padding:0 14px;border:1px solid #9fb3cc;border-radius:9px;background:#fff;color:var(--ink);font:inherit;font-size:15px;cursor:pointer}
.nav button:disabled{opacity:.4;cursor:default}
.nav .nav__next{background:var(--accent);border-color:var(--accent);color:#fff}
.nav__count{min-width:4.5em;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums}
@media print{
  @page{size:A4 portrait;margin:10mm}
  html{scroll-behavior:auto}
  body{background:#fff}
  .bar,.nav,.anim{display:none!important}
  main{max-width:none;padding:0;gap:6mm}
  .screen{border:.3mm solid #C9CED6;border-radius:0;box-shadow:none;break-inside:avoid;page-break-inside:avoid}
}
`;

/**
 * Lecteur des animations (même contrat « gc-anim » que le tableau) : le cadre s'annonce, on lui
 * donne son étape ; il demande ses fichiers joints, on les lui envoie ; les boutons sous la page
 * changent d'étape.
 */
const SCRIPT = `(function(){
var data=JSON.parse(document.getElementById('gc-data').textContent);
var anims=data.map(function(a,i){
  var box=document.querySelector('[data-anim="'+i+'"]');
  var f=document.createElement('iframe');
  f.setAttribute('sandbox','allow-scripts');
  f.setAttribute('referrerpolicy','no-referrer');
  f.title=a.title;
  f.srcdoc=a.srcdoc;
  if(box)box.appendChild(f);
  return {f:f,step:0,n:a.steps,a:a};
});
function post(s,m){m.gc='anim';if(s.f.contentWindow)s.f.contentWindow.postMessage(m,'*');}
function show(i){
  var s=anims[i],c=document.querySelector('[data-count="'+i+'"]');
  if(c)c.textContent=(s.step+1)+' / '+s.n;
  var p=document.querySelector('[data-cmd="prev"][data-i="'+i+'"]'),n=document.querySelector('[data-cmd="next"][data-i="'+i+'"]');
  if(p)p.disabled=s.step<=0;
  if(n)n.disabled=s.step>=s.n-1;
}
function buf(b){var s=atob(b),u=new Uint8Array(s.length);for(var k=0;k<s.length;k++)u[k]=s.charCodeAt(k);return u.buffer;}
window.addEventListener('message',function(e){
  var m=e.data;if(!m||m.gc!=='anim')return;
  for(var i=0;i<anims.length;i++){
    var s=anims[i];if(e.source!==s.f.contentWindow)continue;
    if(m.ev==='ready')post(s,{cmd:'init',step:s.step});
    else if(m.ev==='assets'&&s.a.assets.length)post(s,{cmd:'assets',files:s.a.assets.map(function(x){return {name:x.name,type:x.type,buffer:buf(x.base64)};}),missing:[]});
  }
});
document.addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('[data-cmd]'):null;if(!b)return;
  var i=+b.getAttribute('data-i'),s=anims[i];if(!s)return;
  var c=b.getAttribute('data-cmd');
  if(c==='replay'){post(s,{cmd:'replay'});return;}
  var n=Math.max(0,Math.min(s.n-1,s.step+(c==='next'?1:-1)));
  if(n!==s.step){s.step=n;post(s,{cmd:'goto',step:n});}
  show(i);
});
anims.forEach(function(_,i){show(i);});
document.getElementById('gc-print').addEventListener('click',function(){window.print();});
})();`;
