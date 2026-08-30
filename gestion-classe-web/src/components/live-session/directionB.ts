/**
 * Tokens "Direction B" — reskin mobile porte sur la PWA.
 * Reprend les valeurs exactes de gestion-classe-mobile/constants/theme.ts
 * (scopes a l'experience de seance mobile pour ne pas toucher au desktop).
 */

export const DB = {
  background: '#F7F7F9',
  surface: '#FFFFFF',
  surfaceHover: '#FAFBFC',
  surfaceDisabled: '#F1F2F5',
  segmentTrack: '#EDEEF2',
  border: '#E5E7EB',
  borderLight: '#F1F5F9',

  text: '#1F2433',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  primary: '#4F46E5',
  primarySoft: '#EEF0FF',

  action: '#059669',
  actionSoft: '#ECFDF5',

  error: '#EF4444',
  errorSoft: '#FDE8E8',

  // Etats cellules du plan
  absentBg: '#FEF2F2',
  absentBorder: '#FECACA',
  absentText: '#B91C1C',
  absentBadge: '#EF4444',
  sortieBg: '#F5F3FF',
  sortieBorder: '#DDD6FE',
  sortieText: '#6D28D9',
  malusText: '#B45309',
  malusSoft: '#FFFBEB',

  sheetBackdrop: 'rgba(15,23,42,0.35)',
} as const;

/** Actions du menu radial 4 directions (haut, droite, bas, gauche). */
export interface RadialAction {
  type: string;
  label: string;
  color: string;
  subActions?: { id: string; label: string; color: string }[];
}

export const RADIAL_ACTIONS: RadialAction[] = [
  { type: 'participation', label: 'Implication', color: '#34D399' },
  { type: 'bavardage', label: 'Malus', color: '#FBBF24' },
  {
    type: 'sortie',
    label: 'Sortie',
    color: '#A78BFA',
    subActions: [
      { id: 'infirmerie', label: 'Infirmerie', color: '#F472B6' },
      { id: 'toilettes', label: 'Toilettes', color: '#22D3EE' },
      { id: 'convocation', label: 'Convocation', color: '#A8A29E' },
      { id: 'exclusion', label: 'Exclusion', color: '#F87171' },
    ],
  },
  { type: 'absence', label: 'Absence', color: '#FB7185' },
];

export const ACTION_LABELS: Record<string, string> = {
  participation: '+1 Implication',
  bavardage: '+1 Malus',
  absence: 'Absence',
  sortie: 'Sortie',
  remarque: 'Remarque',
};

/**
 * Signatures haptiques differenciees (equivalent web des vibrations mobiles) :
 * Implication 1 impact, Malus 2 impacts, Sortie 1 long, Absence 2 longs.
 */
export function vibrateAction(type: string): void {
  if (!navigator.vibrate) return;
  const patterns: Record<string, number[]> = {
    participation: [30],
    bavardage: [30, 80, 30],
    sortie: [120],
    absence: [120, 80, 120],
  };
  navigator.vibrate(patterns[type] ?? [20]);
}
