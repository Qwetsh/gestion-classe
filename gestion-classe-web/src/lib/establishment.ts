/**
 * Établissement du professeur, repris par les documents de la boîte à outils.
 *
 * Gardé dans le compte (préférence `establishment`) pour suivre le professeur d'un appareil
 * à l'autre, et vide par défaut : le dépôt est public, aucun établissement réel n'y est écrit.
 */

export interface EstablishmentInfo {
  name: string;
  tel: string;
  address: string;
  codePostal: string;
  academie: string;
  region: string;
  email: string;
  siteWeb: string;
}

export const ESTABLISHMENT_PREFERENCE = 'establishment';

export const EMPTY_ESTABLISHMENT: EstablishmentInfo = {
  name: '', tel: '', address: '', codePostal: '', academie: '', region: '', email: '', siteWeb: '',
};

const FIELDS = Object.keys(EMPTY_ESTABLISHMENT) as (keyof EstablishmentInfo)[];

/**
 * Empreinte du nom que les versions précédentes pré-remplissaient pour tous les comptes.
 * Un réglage qui la porte n'a jamais été saisi par ce professeur : il est ignoré.
 */
const LEGACY_DEFAULT_FINGERPRINT = 4276994270;

function fingerprint(text: string): number {
  let h = 5381;
  for (const c of text.trim().toLowerCase()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h;
}

/** Ne garde que des chaînes, pour chaque champ connu ; tout le reste revient vide. */
export function sanitizeEstablishment(raw: unknown): EstablishmentInfo {
  const out = { ...EMPTY_ESTABLISHMENT };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const f of FIELDS) if (typeof obj[f] === 'string') out[f] = obj[f] as string;
  return out;
}

/** Réglage gardé sur cet appareil par une version précédente : vidé s'il s'agit de l'ancien pré-remplissage. */
export function establishmentFromLegacy(raw: unknown): EstablishmentInfo {
  const e = sanitizeEstablishment(raw);
  return e.name && fingerprint(e.name) === LEGACY_DEFAULT_FINGERPRINT ? { ...EMPTY_ESTABLISHMENT } : e;
}

export function isEstablishmentEmpty(e: EstablishmentInfo): boolean {
  return FIELDS.every(f => !e[f].trim());
}

export function sameEstablishment(a: EstablishmentInfo, b: EstablishmentInfo): boolean {
  return FIELDS.every(f => a[f] === b[f]);
}

/** « Nom Commune » pour un lieu de départ ou de retour (vide si le nom manque). */
export function establishmentPlace(e: EstablishmentInfo): string {
  return [e.name, e.codePostal].map(s => s.trim()).filter(Boolean).join(' ');
}

/** Adresse complète sur une ligne. */
export function establishmentFullAddress(e: EstablishmentInfo): string {
  return [e.address, e.codePostal].map(s => s.trim()).filter(Boolean).join(' ');
}
