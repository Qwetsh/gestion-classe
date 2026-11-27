/**
 * Outils communs aux scènes des thèmes illustrés.
 *
 * Les particules d'une scène (braises, pétales, étoiles) sont tirées d'un hasard « à graine » : la
 * même graine donne toujours la même scène, d'un affichage à l'autre et d'un appareil à l'autre.
 */

/** Suite de nombres entre 0 et 1, toujours la même pour une graine donnée. */
export function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** `count` éléments décrits par `make`, à partir d'une graine. */
export function scatter<T>(count: number, seed: number, make: (next: () => number, index: number) => T): T[] {
  const next = seeded(seed);
  return Array.from({ length: count }, (_, i) => make(next, i));
}

/** Variables CSS d'un élément (`--x`, `--d`…), au format attendu par React. */
export const vars = (values: Record<string, string | number>): React.CSSProperties => values as React.CSSProperties;
