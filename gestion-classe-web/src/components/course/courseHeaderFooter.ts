/**
 * En-têtes et pieds de page des cours (AUDIT_editeur_texte.md, lot T9a) : texte libre et champs
 * remplacés à l'affichage, feuille par feuille. Rien n'est écrit dans le texte du cours : tout vit
 * dans `doc.settings.header` / `doc.settings.footer`.
 */
import type { CourseSettings, HeaderFooterLine } from '../../lib/course/courseDoc';

export interface FieldInfo { token: string; label: string; title: string }

export const HEADER_FIELDS: FieldInfo[] = [
  { token: '{titre}', label: 'Titre du cours', title: 'Le nom du cours (barre de titre)' },
  { token: '{classe}', label: 'Classe', title: 'La classe du cours de l’emploi du temps rattaché' },
  { token: '{date}', label: 'Date', title: 'La date du cours rattaché, sinon celle du jour' },
  { token: '{page}', label: 'N° de page', title: 'Le numéro de la page' },
  { token: '{pages}', label: 'Nombre de pages', title: 'Le nombre total de pages' },
];

/** Numéros de page proposés dans le ruban (case centrale du pied de page). */
export const PAGE_NUMBER_PRESETS: { id: string; label: string; text: string }[] = [
  { id: 'n', label: '1', text: '{page}' },
  { id: 'page', label: 'Page 1', text: 'Page {page}' },
  { id: 'sur', label: 'Page 1 sur 4', text: 'Page {page} sur {pages}' },
  { id: 'slash', label: '1 / 4', text: '{page} / {pages}' },
  { id: 'none', label: 'Sans numéro', text: '' },
];

/** Pied de page d'un cours qui n'en a jamais réglé : le numéro centré, comme avant. */
export const DEFAULT_FOOTER: HeaderFooterLine = { center: '{page}' };

export interface FieldValues {
  titre: string;
  classe: string;
  date: string;
  page: number;
  pages: number;
}

export type Piece = { text: string; field?: keyof FieldValues; missing?: boolean };

/**
 * Découpe un texte d'en-tête en morceaux : texte simple et champs remplacés. Un champ sans valeur
 * (pas de classe rattachée) est marqué `missing` : montré en gris à l'écran, jamais imprimé.
 */
export function renderFields(text: string, values: FieldValues): Piece[] {
  const out: Piece[] = [];
  const re = /\{(titre|classe|date|page|pages)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const field = m[1] as keyof FieldValues;
    const v = String(values[field] ?? '');
    out.push(v ? { text: v, field } : { text: field, field, missing: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function footerOf(settings: CourseSettings): HeaderFooterLine {
  return settings.footer ?? DEFAULT_FOOTER;
}

export const isEmptyLine = (l: HeaderFooterLine | undefined) => !l || !(l.left?.trim() || l.center?.trim() || l.right?.trim());

/** Préréglage de numéro de page correspondant au pied de page actuel (ou null : réglage libre). */
export function pageNumberPreset(settings: CourseSettings): string | null {
  const f = footerOf(settings);
  if (f.left?.trim() || f.right?.trim()) return null;
  const hit = PAGE_NUMBER_PRESETS.find((p) => p.text === (f.center ?? '').trim());
  return hit?.id ?? null;
}

/** Date affichée dans {date} : « jeudi 13 novembre 2026 ». */
export function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
