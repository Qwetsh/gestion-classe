/**
 * Onglets d'une liste rangée (niveaux de « Mes cours » et de « Mes TP », thèmes ou sessions des
 * annales) : quel onglet montrer, et le dernier choix gardé sur l'appareil.
 */

/** L'élément de l'onglet choisi, à défaut le premier (aucun choix encore, ou l'onglet choisi n'existe plus). */
export function pickedOrFirst<T>(items: T[], picked: string | undefined, keyOf: (item: T) => string): T | null {
  return items.find((item) => keyOf(item) === picked) ?? items[0] ?? null;
}

/** Choix gardés sous cette clé de stockage : un onglet par liste (`scope`). */
export function readTabChoices(storageKey: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

export function saveTabChoices(storageKey: string, choices: Record<string, string>): void {
  try { localStorage.setItem(storageKey, JSON.stringify(choices)); } catch { /* stockage indisponible */ }
}
