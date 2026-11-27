import { Suspense, lazy, useEffect, useRef, type ComponentType, type LazyExoticComponent } from 'react';
import { STUDENT_THEMES, type StudentThemeId } from '../../lib/studentThemes';
import { scatter, vars } from '../../themes-eleve/shared';

/**
 * Décor d'un thème illustré de l'espace élève : une scène en plusieurs plans, posée derrière le
 * contenu (`.el-decor`, fixe, plein écran). La scène de chaque thème vit dans `themes-eleve/<id>/`
 * et n'est chargée que si l'élève a choisi ce thème.
 *
 * Mouvement, pour toutes les scènes :
 *  - parallaxe au défilement : `--sy` (défilement de la page, en px) est tenu à jour ici ; chaque
 *    plan (`.el-layer`) se décale selon sa profondeur `--k` ;
 *  - un lent mouvement de caméra automatique (`--px`, `--py`) fait glisser les plans les uns devant
 *    les autres, sans que l'élève touche à rien ; sur un écran à souris, le pointeur s'y ajoute ;
 *  - les animations d'ambiance sont de simples animations CSS de la scène.
 *  - au toucher : un élément de la scène marqué `data-tap="nom"` (durée en ms dans `data-tap-ms`)
 *    déclenche l'animation `nom` quand l'élève tape dessus ; le nom est alors posé dans l'attribut
 *    `data-fx` du décor, le temps de l'animation, et la scène l'anime en CSS (`[data-fx~='nom']`).
 *    Une même animation ne repart pas avant dix secondes. Le décor reste derrière le contenu : un
 *    toucher ne compte que s'il tombe sur une zone vide de la page (ni carte, ni bouton, ni lien).
 *  - au changement d'onglet : le calque `.el-front`, devant le contenu, joue l'effet du thème
 *    (voir lib/studentSceneTransition.ts).
 * Garde-fous : rien ne bouge si l'appareil demande de réduire les animations, et tout se met en
 * pause quand la page n'est plus à l'écran.
 */

const SCENES: Partial<Record<StudentThemeId, LazyExoticComponent<ComponentType>>> = Object.fromEntries(
  STUDENT_THEMES.flatMap((t) => (t.scene ? [[t.id, lazy(t.scene)] as const] : [])),
);

/** Éléments du calque de devant (transition d'onglet) : chaque thème les habille à sa façon. */
const FRONT = scatter(28, 71, (r, i) => vars({ '--i': i, '--r1': r().toFixed(3), '--r2': r().toFixed(3), '--r3': r().toFixed(3) }));

/** Repos d'une animation au toucher avant de pouvoir repartir. */
const TAP_REST_MS = 10_000;
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [tabindex]';

/** Vrai si le toucher est tombé sur du contenu (un bouton, une carte opaque) et non sur le décor. */
function isCovered(target: EventTarget | null, root: Element): boolean {
  if (!(target instanceof Element) || !root.contains(target)) return true;
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    if (node.matches(INTERACTIVE)) return true;
    const style = window.getComputedStyle(node);
    if (style.backgroundImage !== 'none') return true;
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') return true;
  }
  return false;
}

export function StudentDecor({ theme }: { theme: StudentThemeId }) {
  const ref = useRef<HTMLDivElement>(null);
  const Scene = SCENES[theme];
  const active = !!Scene;

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = 0;
    let px = 0;
    let py = 0;
    // Une trentaine d'images par seconde suffit à un mouvement aussi lent.
    const paint = (now: number) => {
      frame = window.requestAnimationFrame(paint);
      if (now - last < 30) return;
      last = now;
      const t = now / 1000;
      el.style.setProperty('--sy', String(Math.min(900, Math.max(0, window.scrollY))));
      el.style.setProperty('--px', (px + Math.sin(t / 5.5) * 0.9).toFixed(3));
      el.style.setProperty('--py', (py + Math.sin(t / 3.7) * 0.35).toFixed(3));
    };
    const run = () => {
      const on = document.visibilityState === 'visible' && !still.matches;
      if (on && !frame) frame = window.requestAnimationFrame(paint);
      if (!on && frame) { window.cancelAnimationFrame(frame); frame = 0; }
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
    };
    // Animations au toucher
    const fx = new Set<string>();
    const rest = new Map<string, number>();
    const timers = new Set<number>();
    const writeFx = () => { if (fx.size) el.setAttribute('data-fx', [...fx].join(' ')); else el.removeAttribute('data-fx'); };
    const onTap = (e: MouseEvent) => {
      const root = el.parentElement;
      if (still.matches || !root || isCovered(e.target, root)) return;
      let hit: Element | null = null;
      let area = Infinity;
      for (const spot of el.querySelectorAll('[data-tap]')) {
        const r = spot.getBoundingClientRect();
        if (e.clientX < r.left - 6 || e.clientX > r.right + 6 || e.clientY < r.top - 6 || e.clientY > r.bottom + 6) continue;
        if (r.width * r.height < area) { area = r.width * r.height; hit = spot; }
      }
      const name = hit?.getAttribute('data-tap');
      if (!hit || !name) return;
      const now = performance.now();
      if ((rest.get(name) ?? 0) > now) return;
      const ms = Number(hit.getAttribute('data-tap-ms')) || 3000;
      rest.set(name, now + Math.max(TAP_REST_MS, ms));
      fx.add(name);
      writeFx();
      const timer = window.setTimeout(() => { timers.delete(timer); fx.delete(name); writeFx(); }, ms);
      timers.add(timer);
    };
    const onVisible = () => { el.toggleAttribute('data-paused', document.visibilityState !== 'visible'); run(); };
    const onStill = () => { el.toggleAttribute('data-still', still.matches); run(); };
    onVisible();
    onStill();
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('click', onTap);
    document.addEventListener('visibilitychange', onVisible);
    still.addEventListener('change', onStill);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('click', onTap);
      for (const timer of timers) window.clearTimeout(timer);
      el.removeAttribute('data-fx');
      document.removeEventListener('visibilitychange', onVisible);
      still.removeEventListener('change', onStill);
    };
  }, [active, theme]);

  if (!Scene) return null;
  return (
    <>
      <div ref={ref} className="el-decor" data-scene={theme} aria-hidden>
        <Suspense fallback={null}><Scene /></Suspense>
      </div>
      <div className="el-front" data-scene={theme} aria-hidden>
        {FRONT.map((style, i) => <i key={i} style={style} />)}
      </div>
    </>
  );
}
