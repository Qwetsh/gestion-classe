/**
 * Version couleur au format téléphone d'un document imprimé : les liens (table `board_mobile_links`,
 * migration 090) côté professeur, et la lecture du document par qui scanne le QR code, à travers
 * l'Edge Function `version-mobile` (sans compte : rien n'est lu directement en base ni dans le
 * stockage). Règles et fonctions pures : mobileVersion.ts.
 *
 * Migration absente : pas de lien, donc pas de QR code ; l'impression se fait quand même, avec un
 * avertissement en console.
 */
import { supabase } from './supabase';
import { seedSignedUrls } from './boardMedia';
import type { CourseDoc } from './course/courseDoc';
import { linkTarget, newMobileToken, type CourseRef, type LinkKind } from './mobileVersion';

// ---------------------------------------------------------------------------------------------
// Professeur : le lien d'un document
// ---------------------------------------------------------------------------------------------

let tableMissing = false;

/** Vrai si la migration 090 n'est pas appliquée (détecté au premier appel). */
export const mobileLinksUnavailable = () => tableMissing;

type DbError = { message?: string; code?: string } | null;

function isMissingTable(error: DbError, table: string): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || (msg.includes(table) && (msg.includes('does not exist') || msg.includes('schema cache')));
}

function missingLinks(): null {
  if (!tableMissing) console.warn('[mobileVersion] table « board_mobile_links » absente : migration 090 à appliquer. Impression sans QR code.');
  tableMissing = true;
  return null;
}

const isMissingSource = (error: DbError) =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /source_board_id/i.test(error.message ?? '') || isMissingTable(error, 'lesson_boards'));

/**
 * Le document vers lequel pointe le QR code d'un cours imprimé (mobileVersion.ts, mobileTarget) :
 * l'original de la bibliothèque pour une copie posée sur l'emploi du temps, le cours lui-même
 * sinon ; null pour une correction ou une évaluation (pas de QR code).
 */
export async function resolveMobileTarget(boardId: string, title: string): Promise<string | null> {
  return resolveLinkTarget('qr', boardId, title);
}

/** Le document vers lequel pointe un lien de cette sorte (QR code ou lien de partage) ; null : il ne peut pas sortir par ce lien. */
export async function resolveLinkTarget(kind: LinkKind, boardId: string, title: string): Promise<string | null> {
  if (linkTarget(kind, { id: boardId, title }, null) === null) return null;
  const own = await supabase.from('lesson_boards').select('source_board_id').eq('board_id', boardId).maybeSingle();
  // Sans la provenance (migration 077), une copie n'est pas reconnue : elle sert elle-même
  if (own.error && !isMissingSource(own.error)) throw own.error;
  const source = own.error ? null : (own.data as { source_board_id: string | null } | null)?.source_board_id ?? null;
  let original: CourseRef | null = null;
  if (source && source !== boardId) {
    const { data, error } = await supabase.from('boards').select('id, title').eq('id', source).maybeSingle();
    if (error) throw error;
    original = (data as CourseRef | null) ?? null;
  }
  return linkTarget(kind, { id: boardId, title }, original);
}

/** Jeton du lien d'un original, s'il en a déjà un (null : pas encore imprimé, ou migration absente). */
export async function findMobileToken(targetId: string): Promise<string | null> {
  if (tableMissing) return null;
  const { data, error } = await supabase.from('board_mobile_links').select('token').eq('board_id', targetId).maybeSingle();
  if (isMissingTable(error, 'board_mobile_links')) return missingLinks();
  if (error) throw error;
  return (data as { token: string } | null)?.token ?? null;
}

/**
 * Jeton du lien d'un original, créé s'il n'existe pas (première impression). Jamais modifié
 * ensuite : le QR code déjà imprimé reste valable.
 */
export async function ensureMobileToken(userId: string, targetId: string): Promise<string | null> {
  const found = await findMobileToken(targetId);
  if (found || tableMissing) return found;
  const token = newMobileToken();
  const { error } = await supabase.from('board_mobile_links').insert({ board_id: targetId, user_id: userId, token });
  if (isMissingTable(error, 'board_mobile_links')) return missingLinks();
  // Créé entre-temps (autre onglet, copie du même original imprimée en même temps) : on prend celui-là
  if (error?.code === '23505') return findMobileToken(targetId);
  if (error) throw error;
  return token;
}

// ---------------------------------------------------------------------------------------------
// Professeur : le lien de partage d'un document (table `board_share_links`, migration 092)
// ---------------------------------------------------------------------------------------------

/** Migration 092 pas appliquée : le partage n'est pas encore possible. */
export class ShareUnavailableError extends Error {
  constructor() { super('share_unavailable'); }
}

/** Jeton du lien de partage d'un original, s'il en a un (null : jamais partagé, ou lien coupé). */
export async function findShareToken(targetId: string): Promise<string | null> {
  const { data, error } = await supabase.from('board_share_links').select('token').eq('board_id', targetId).maybeSingle();
  if (isMissingTable(error, 'board_share_links')) throw new ShareUnavailableError();
  if (error) throw error;
  return (data as { token: string } | null)?.token ?? null;
}

/** Jeton du lien de partage d'un original, créé s'il n'existe pas. */
export async function ensureShareToken(userId: string, targetId: string): Promise<string> {
  const found = await findShareToken(targetId);
  if (found) return found;
  const token = newMobileToken();
  const { error } = await supabase.from('board_share_links').insert({ board_id: targetId, user_id: userId, token });
  if (isMissingTable(error, 'board_share_links')) throw new ShareUnavailableError();
  // Créé entre-temps (autre onglet) : on prend celui-là
  if (error?.code === '23505') {
    const again = await findShareToken(targetId);
    if (again) return again;
  }
  if (error) throw error;
  return token;
}

/**
 * Coupe le lien de partage : l'adresse déjà collée ne mène plus à rien. Un prochain partage crée
 * une autre adresse. Le QR code des feuilles imprimées n'est pas touché (autre table, autre jeton).
 */
export async function deleteShareToken(targetId: string): Promise<void> {
  const { error } = await supabase.from('board_share_links').delete().eq('board_id', targetId);
  if (isMissingTable(error, 'board_share_links')) throw new ShareUnavailableError();
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Téléphone : le document, par le jeton du QR code ou du lien de partage
// ---------------------------------------------------------------------------------------------

/** `forbidden` : lien inconnu ou coupé, ou document qui ne peut plus sortir ; `not_found` : plus un cours rédigé ; `network` : pas de réponse. */
export class MobileDocError extends Error {
  kind: 'forbidden' | 'not_found' | 'network' | 'server';
  constructor(kind: MobileDocError['kind']) {
    super(kind);
    this.kind = kind;
  }
}

export interface MobileDocument {
  title: string;
  /** QR code imprimé ou lien de partage (cahier de texte). */
  kind: LinkKind;
  doc: CourseDoc;
}

/**
 * Le document d'un lien, tel qu'il est à l'instant. Les adresses de ses images, signées par le
 * serveur, sont posées là où le rendu des cours les cherche.
 */
export async function fetchMobileDoc(token: string): Promise<MobileDocument> {
  const { data, error } = await supabase.functions.invoke<{ title?: unknown; kind?: unknown; doc?: unknown; images?: unknown }>('version-mobile', { body: { token } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new MobileDocError(status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status ? 'server' : 'network');
  }
  const doc = data?.doc as CourseDoc | undefined;
  if (!doc || typeof doc !== 'object' || !doc.content || typeof doc.content !== 'object') throw new MobileDocError('server');
  if (data?.images && typeof data.images === 'object') seedSignedUrls(data.images as Record<string, string>);
  return { title: typeof data?.title === 'string' ? data.title : '', kind: data?.kind === 'share' ? 'share' : 'qr', doc };
}
