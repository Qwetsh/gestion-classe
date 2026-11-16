/**
 * Liens d'un cours vers un site ou une application (l'app maison d'une activité, un site de
 * données…) : rangés dans le document (`boards.doc.links`), montrés en bouton sur la ligne de
 * l'activité dans « Mes cours ». Fonctions pures.
 */

export interface CourseLink {
  /** Nom affiché sur le bouton (« Hôpital virtuel »). */
  label: string;
  /** Adresse http(s) complète. */
  url: string;
}

/** Nombre de liens au plus par cours : au-delà, la ligne ne se lit plus. */
export const MAX_COURSE_LINKS = 4;

/** Adresse saisie → adresse complète, ou null si ce n'est pas une adresse web. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Nom de secours : le site, sans « www. ». */
export function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/** Liens lisibles d'un document (champ absent, mal formé ou adresse refusée : ignorés). */
export function courseLinks(raw: unknown): CourseLink[] {
  if (!Array.isArray(raw)) return [];
  const out: CourseLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { label, url } = item as Record<string, unknown>;
    const clean = typeof url === 'string' ? normalizeUrl(url) : null;
    if (!clean || out.some((l) => l.url === clean)) continue;
    const name = typeof label === 'string' ? label.trim() : '';
    out.push({ label: name || linkHost(clean), url: clean });
    if (out.length === MAX_COURSE_LINKS) break;
  }
  return out;
}

