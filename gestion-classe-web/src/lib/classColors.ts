/**
 * Couleurs de classe — direction C « couleur mesurée ».
 *
 * Une teinte par NIVEAU (6e, 5e, 4e, 3e), jamais par classe : la couleur sert à
 * balayer un emploi du temps ou une liste d'un coup d'œil, le nom « 3A » porte
 * le reste. Avant, onze teintes tournaient selon l'ordre des classes.
 *
 * - solid : barres, bordures, points (contraste suffisant sur blanc)
 * - soft  : fond de la puce de classe
 * - ink   : texte de la puce (AA sur le fond soft)
 */
export interface ClassTone {
  solid: string;
  soft: string;
  ink: string;
}

const LEVEL_TONES: Record<'3' | '4' | '5' | '6', ClassTone> = {
  '3': { solid: '#4F46E5', soft: '#E0E5FF', ink: '#3730A3' },
  '4': { solid: '#059669', soft: '#D6F3E4', ink: '#065F46' },
  '5': { solid: '#D97706', soft: '#FDE9C9', ink: '#92400E' },
  '6': { solid: '#DB2777', soft: '#FCE1EC', ink: '#9D174D' },
};

const NEUTRAL_TONE: ClassTone = { solid: '#71717A', soft: '#F0F0F2', ink: '#3F3F46' };

/** Niveau d'une classe d'après son nom (« 3A », « 4ème B », « 5E · G1 ») ; null si absent. */
export function classLevel(name: string | null | undefined): '3' | '4' | '5' | '6' | null {
  const m = /[3-6]/.exec(name ?? '');
  return m ? (m[0] as '3' | '4' | '5' | '6') : null;
}

export function classTone(name: string | null | undefined): ClassTone {
  const level = classLevel(name);
  return level ? LEVEL_TONES[level] : NEUTRAL_TONE;
}

/** Couleur pleine de la classe (hex, concaténable avec une opacité « 1A »). */
export function classColor(name: string | null | undefined): string {
  return classTone(name).solid;
}
