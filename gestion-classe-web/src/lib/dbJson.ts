/**
 * Passage entre les colonnes JSON de la base et leurs types applicatifs.
 *
 * Pour TypeScript, une colonne `jsonb` est du JSON quelconque (`Json`). L'application y range des
 * structures précises (un document de cours, des positions de plan, une correction). Ces deux
 * fonctions marquent l'endroit où l'on passe de l'un à l'autre : la base ne garantit pas la forme
 * de ce qu'elle rend, c'est le code qui l'a écrite qui la connaît.
 */
import type { Json } from './database.types';

/** Une valeur applicative, au moment de l'écrire dans une colonne JSON. */
export function toJson(value: unknown): Json {
  return value as Json;
}

/** Une colonne JSON, ou le résultat JSON d'une fonction de la base, relue avec son type applicatif. */
export function fromJson<T>(value: unknown): T {
  return value as T;
}

/**
 * Des lignes de la base, vues avec un type applicatif plus précis que celui de la table : un texte
 * libre qui ne prend que quelques valeurs, une colonne à valeur par défaut que la table déclare
 * pouvant être vide. La requête, elle, reste contrôlée contre la description de la base.
 */
export function fromDb<T>(rows: unknown): T {
  return rows as T;
}
