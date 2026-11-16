/* Outils de dessin communs à toutes les scènes : temps, interpolation, texte, flèches, pastilles. */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
/** Progression lissée (0 → 1) de l'instant a à l'instant b. */
const seg = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const D = Math.PI / 180;
const dir = (a) => [Math.cos(a * D), Math.sin(a * D)];
const f = (n) => Math.round(n * 10) / 10;
const lerpAng = (a, b, p) => { const d = ((b - a) % 360 + 540) % 360 - 180; return a + d * p; };
/** Hasard reproductible : la scène est la même à chaque lecture. */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Interpolation entre images-clés [{ t, x, y, r }]. */
function keys(K, t) {
  if (t <= K[0].t) return K[0];
  for (let i = 1; i < K.length; i++) {
    if (t <= K[i].t) {
      const a = K[i - 1], b = K[i], p = ease((t - a.t) / (b.t - a.t));
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), r: lerpAng(a.r ?? 0, b.r ?? 0, p) };
    }
  }
  return K[K.length - 1];
}
const TXT = '#1d2433';
/** Texte avec liseré blanc (lisible sur n'importe quel fond). */
function txt(x, y, s, size = 24, col = TXT, anchor = 'start', w = 400, op = 1) {
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${col}" text-anchor="${anchor}" font-weight="${w}" opacity="${op}" paint-order="stroke" stroke="#fff" stroke-width="6" stroke-linejoin="round">${s}</text>`;
}
function fleche(x1, y1, x2, y2, op = 1, col = '#333') { return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="3" marker-end="url(#fl)" opacity="${op}"/>`; }
const VERT = '#2E9E55', ROUGE = '#C62828';
function ok(x, y, op = 1) { return `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="22" fill="${VERT}"/><path d="M${x - 10},${y} l7,8 l13,-16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`; }
function ko(x, y, op = 1) { return `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="22" fill="${ROUGE}"/><path d="M${x - 9},${y - 9} l18,18 M${x + 9},${y - 9} l-18,18" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>`; }
