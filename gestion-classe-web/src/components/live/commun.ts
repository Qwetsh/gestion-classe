import type { Case, QuestionCarnet } from '../../lib/liveCarnet';
import type { Groupe } from '../../lib/liveClass';

/** Un groupe tel que la page l'affiche : la carte, la ligne du tableau, la vue du groupe. */
export interface GroupeAffiche {
  g: Groupe;
  questions: QuestionCarnet[];
  /** null : fiche d'une version du jeu sans `faites` (on garde `reponses / sur`). */
  cases: Case[] | null;
  legende: string;
  /** Pourquoi aller le voir, ou null. */
  raison: string | null;
  points: number;
}

/** Ce que la page peut faire sur un groupe. */
export interface ActionsGroupe {
  ecrire: (a: GroupeAffiche, points?: number) => void;
  ouvrir: (a: GroupeAffiche) => void;
}

export const EN_LIGNE_MS = 2 * 60_000;
export const RECENT_MS = 10 * 60_000;

export const heure = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Dernier signe de vie : « en ligne », « il y a 4 min ». */
export function etatVu(maj: number, maintenant: number): { cle: 'en-ligne' | 'recent' | 'ancien'; texte: string } {
  const d = maintenant - maj;
  const min = Math.max(0, Math.round(d / 60_000));
  if (d < EN_LIGNE_MS) return { cle: 'en-ligne', texte: 'en ligne' };
  if (d < RECENT_MS) return { cle: 'recent', texte: `il y a ${min} min` };
  if (min < 120) return { cle: 'ancien', texte: `il y a ${min} min` };
  return { cle: 'ancien', texte: `vu à ${heure(maj)}` };
}

export const nomsDuGroupe = (g: Groupe) => g.noms.join(' · ');
