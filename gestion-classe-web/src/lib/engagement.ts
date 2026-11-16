/** Couleur + libellé d'engagement selon la dernière connexion à l'espace élève. */
export function engagementInfo(last: string | null): { color: string; label: string } {
  if (!last) return { color: 'var(--text-dim)', label: 'Jamais connecté' };
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  let color = 'var(--text-dim)';
  if (days <= 7) color = 'var(--pos)';
  else if (days <= 21) color = 'var(--warn)';
  let label: string;
  if (days <= 0) label = "Aujourd'hui";
  else if (days === 1) label = 'Hier';
  else if (days < 7) label = `Il y a ${days} j`;
  else if (days < 30) label = `Il y a ${Math.floor(days / 7)} sem`;
  else label = `Il y a ${Math.floor(days / 30)} mois`;
  return { color, label };
}

/** Répartition des connexions sur les N dernières semaines (pour le mini-graphe). */
export function weeklyBuckets(timestamps: string[], weeks = 10): number[] {
  const now = Date.now();
  const wk = 7 * 86400000;
  const buckets = new Array<number>(weeks).fill(0);
  timestamps.forEach((ts) => {
    const idx = weeks - 1 - Math.floor((now - new Date(ts).getTime()) / wk);
    if (idx >= 0 && idx < weeks) buckets[idx]++;
  });
  return buckets;
}
