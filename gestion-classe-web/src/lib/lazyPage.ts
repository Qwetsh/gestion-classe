/**
 * Pages chargées à la demande.
 *
 * Chaque page est un morceau de JavaScript à part, téléchargé quand on l'ouvre : un élève qui
 * scanne un QR code ne reçoit plus toute l'application enseignant.
 *
 * Après une mise en ligne, les morceaux de l'ancienne version n'existent plus sur le serveur. Un
 * onglet resté ouvert qui en demande un échoue : on recharge alors la page une fois, ce qui ramène
 * la nouvelle version. Une seule fois par minute, pour ne pas boucler si la panne est ailleurs
 * (réseau coupé, par exemple) ; dans ce cas l'erreur remonte à l'écran d'erreur habituel.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'gc-rechargement-morceau';
const RELOAD_MIN_INTERVAL_MS = 60_000;

/** Vrai si un rechargement automatique est permis : aucun dans la minute qui précède. */
export function staleBuildReloadAllowed(lastReload: string | null, now: number): boolean {
  if (!lastReload) return true;
  const last = Number(lastReload);
  if (!Number.isFinite(last)) return true;
  return now - last > RELOAD_MIN_INTERVAL_MS;
}

/** Recharge la page si c'est permis. Renvoie vrai quand le rechargement est lancé. */
export function reloadOnceForStaleBuild(): boolean {
  try {
    const now = Date.now();
    if (!staleBuildReloadAllowed(sessionStorage.getItem(RELOAD_KEY), now)) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Stockage indisponible (navigation privée stricte) : pas de garde possible contre une
    // boucle, donc pas de rechargement automatique.
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Une page chargée à la demande, à partir d'un module qui l'exporte sous son nom.
 * `lazyPage(() => import('./pages/Students'), 'Students')`
 */
export function lazyPage<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): LazyExoticComponent<ComponentType> {
  return lazy(() =>
    load().then(
      (module: Record<K, ComponentType> | undefined) => {
        // Morceau introuvable et rechargement déjà lancé par l'écouteur `vite:preloadError`
        // (main.tsx) : Vite rend alors `undefined` au lieu d'une erreur. On attend le rechargement.
        if (!module) return new Promise<never>(() => {});
        return { default: module[name] };
      },
      (error: unknown) => {
        // Pendant que la page se recharge, on ne résout rien : pas d'écran d'erreur fugitif.
        if (reloadOnceForStaleBuild()) return new Promise<never>(() => {});
        throw error;
      },
    ),
  );
}

/**
 * Charge une liste de modules l'un après l'autre, quand le navigateur n'a rien d'autre à faire.
 * Les échecs sont ignorés : la page se rechargera normalement à son ouverture.
 */
export function preloadWhenIdle(loaders: ReadonlyArray<() => Promise<unknown>>, delayMs = 2500): void {
  const queue = [...loaders];
  const next = () => {
    const load = queue.shift();
    if (!load) return;
    load().catch(() => undefined).finally(() => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(next, { timeout: 2000 });
      else setTimeout(next, 200);
    });
  };
  setTimeout(next, delayMs);
}
