/**
 * Cahier de texte (migration 084, table lesson_journal, PLAN_cahier_de_texte.md).
 *
 * Une entrée par cours de l'emploi du temps, identifiée comme les notes (044) et les tableaux de
 * cours (065) par (user_id, starts_at, label). Le texte est brut : l'enseignant le recopie dans
 * Pronote (bouton Copier, qui pose copied_at). Claude écrit les entrées par le jeton d'import
 * (fonction depot-cours, action "journal") ; l'application les lit, les retouche, les copie.
 */
import { supabase } from '../supabase';
import { lessonNoteKey } from './lessonNotesQueries';

export type JournalSource = 'claude' | 'manual' | 'import';

export interface JournalEntry {
  id: string;
  startsAt: Date;
  endsAt: Date;
  label: string;
  classId: string | null;
  groupId: string | null;
  content: string;
  copiedAt: Date | null;
  source: JournalSource;
  createdAt: Date;
  updatedAt: Date;
}

/** Ce qu'il faut savoir d'un cours pour lui écrire une entrée. */
export interface JournalLesson {
  start: Date;
  end: Date;
  label: string;
  classId?: string | null;
  groupId?: string | null;
}

const COLUMNS = 'id, starts_at, ends_at, label, class_id, group_id, content, copied_at, source, created_at, updated_at';

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  class_id: string | null;
  group_id: string | null;
  content: string;
  copied_at: string | null;
  source: JournalSource;
  created_at: string;
  updated_at: string;
};

function fromRow(r: Row): JournalEntry {
  return {
    id: r.id,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    label: r.label,
    classId: r.class_id,
    groupId: r.group_id,
    content: r.content,
    copiedAt: r.copied_at ? new Date(r.copied_at) : null,
    source: r.source,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/** Même clé de rapprochement que les notes : heure de début à la minute + libellé. */
export const journalKey = lessonNoteKey;

/**
 * Entrées dont le cours commence dans [from, to[ (bornes facultatives), éventuellement d'une
 * classe. Table absente (migration non appliquée) : liste vide, l'accueil s'en passe.
 */
export async function fetchJournalEntries(
  userId: string,
  opts: { from?: Date; to?: Date; classId?: string } = {},
): Promise<JournalEntry[]> {
  let q = supabase.from('lesson_journal').select(COLUMNS).eq('user_id', userId);
  if (opts.from) q = q.gte('starts_at', opts.from.toISOString());
  if (opts.to) q = q.lt('starts_at', opts.to.toISOString());
  if (opts.classId) q = q.eq('class_id', opts.classId);
  const { data, error } = await q.order('starts_at', { ascending: false });
  if (error) {
    console.warn('[cahier de texte] lecture impossible :', error.message);
    return [];
  }
  return ((data || []) as Row[]).map(fromRow);
}

export function indexJournal(entries: JournalEntry[]): Map<string, JournalEntry> {
  const map = new Map<string, JournalEntry>();
  for (const e of entries) map.set(journalKey(e.startsAt, e.label), e);
  return map;
}

export function journalForLesson(map: Map<string, JournalEntry>, lesson: Pick<JournalLesson, 'start' | 'label'>): JournalEntry | null {
  return map.get(journalKey(lesson.start, lesson.label)) ?? null;
}

/**
 * Enregistre le texte de l'entrée d'un cours : met à jour l'entrée existante (sa provenance est
 * gardée), sinon la crée (« manual »). Retouchée, l'entrée redevient « à recopier ».
 */
export async function saveJournalEntry(
  userId: string,
  lesson: JournalLesson,
  content: string,
  existing: JournalEntry | null,
): Promise<JournalEntry> {
  const text = normalizeJournalText(content);
  if (!text) throw new Error('Entrée vide.');
  const now = new Date().toISOString();
  if (existing) {
    const changed = text !== existing.content;
    const { data, error } = await supabase
      .from('lesson_journal')
      .update({ content: text, updated_at: now, ...(changed ? { copied_at: null } : {}) })
      .eq('id', existing.id)
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  }
  const startsAt = new Date(lesson.start);
  startsAt.setSeconds(0, 0);
  const { data, error } = await supabase
    .from('lesson_journal')
    .insert({
      user_id: userId,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(lesson.end).toISOString(),
      label: lesson.label,
      class_id: lesson.classId ?? null,
      group_id: lesson.groupId ?? null,
      content: text,
      source: 'manual',
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_journal').delete().eq('id', id);
  if (error) throw error;
}

/** Marque l'entrée recopiée dans Pronote (ou de nouveau à recopier). */
export async function setJournalCopied(entry: JournalEntry, copied: boolean): Promise<JournalEntry> {
  const copiedAt = copied ? new Date() : null;
  const { error } = await supabase
    .from('lesson_journal')
    .update({ copied_at: copiedAt ? copiedAt.toISOString() : null })
    .eq('id', entry.id);
  if (error) throw error;
  return { ...entry, copiedAt };
}

/** Fins de ligne Unix, espaces de fin de ligne et lignes vides de début et de fin retirés. */
export function normalizeJournalText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/** Première ligne non vide (thème, séquence, séance) : ce qui résume l'entrée dans une liste. */
export function journalHeadline(content: string, max = 140): string {
  const line = content.split('\n').map(l => l.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Met le texte dans le presse-papiers ; repli pour un navigateur sans API Clipboard. */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copie refusée par le navigateur.');
}

/** « lundi 23 novembre · 11:15 » */
export function journalWhen(start: Date): string {
  const day = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** Copie l'entrée pour Pronote et la marque recopiée. */
export async function copyJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  await copyToClipboard(entry.content);
  return entry.copiedAt ? entry : setJournalCopied(entry, true);
}
