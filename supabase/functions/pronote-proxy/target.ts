// Contrôle de la cible du relais Pronote. Sans dépendance Deno, pour être testé depuis le web
// (`gestion-classe-web/src/lib/__tests__/pronoteProxyTarget.test.ts`).

/** Cible admise : https, port par défaut, sans identifiants, nom d'hôte finissant par un suffixe connu. */
export function allowedTarget(raw: string, suffixes: string[]): URL | null {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  if (target.port !== "" && target.port !== "443") return null;
  if (target.username || target.password) return null;
  const host = target.hostname.toLowerCase();
  return suffixes.some((s) => host === s || host.endsWith("." + s)) ? target : null;
}
