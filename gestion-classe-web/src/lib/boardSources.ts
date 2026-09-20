/**
 * Sources externes du panneau « Ressources » : base Notion (via l'Edge Function
 * notion-proxy), annales de Brevet (bucket public). Google Drive : voir `googleDrive.ts` ; OneDrive : `oneDrive.ts`.
 * Aucune clé n'est inventée : chaque source explique ce qu'il lui manque.
 */
import { supabase } from './supabase';
import { brevets, type Brevet, type Matiere } from './brevets';
import { MissingKeyError } from './boardSearch';
import { pushKeys } from './userKeys';

// ---- Notion ----

export interface NotionEntry { id: string; title: string; text: string; image: string | null; url: string }

const NOTION_KEY = 'classroom-board-notion-db';
/** Base partagée avec la connexion « Gestion Classe » (10/09/2026) : « Ressources de cours ». */
export const DEFAULT_NOTION_DATABASE = '3a582b2d9c3c488e9f60b8327ec148d0';

export function loadNotionDatabaseId(): string {
  try { return localStorage.getItem(NOTION_KEY) || DEFAULT_NOTION_DATABASE; } catch { return DEFAULT_NOTION_DATABASE; }
}

export function saveNotionDatabaseId(id: string) {
  try { localStorage.setItem(NOTION_KEY, id.trim()); } catch { /* stockage indisponible */ }
  void pushKeys();
}

/** Message lisible pour une erreur d'appel de la fonction (elle renvoie { error } en JSON). */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const j = (await ctx.json()) as { error?: string }; if (j?.error) return j.error; } catch { /* corps non JSON */ }
  }
  return fallback;
}

export async function queryNotion(databaseId: string, query: string): Promise<NotionEntry[]> {
  if (!databaseId.trim()) throw new MissingKeyError('Notion', "Identifiant de la base Notion à renseigner (copié depuis l'URL de la base).");
  const { data, error } = await supabase.functions.invoke<{ results?: NotionEntry[]; error?: string }>('notion-proxy', { body: { databaseId, query } });
  if (error) throw new Error(await functionErrorMessage(error, "L'Edge Function « notion-proxy » ne répond pas (déployée ? secret NOTION_TOKEN ?)."));
  if (data?.error) throw new Error(data.error);
  return data?.results ?? [];
}

/** Image Notion (S3 signée, sans CORS) relayée par la fonction ; null si indisponible. */
export async function fetchNotionImage(imageUrl: string): Promise<Blob | null> {
  // La fonction répond en application/octet-stream (seul type rendu en Blob par supabase-js) ;
  // le vrai type d'image est deviné sur les premiers octets.
  const { data, error } = await supabase.functions.invoke<Blob>('notion-proxy', { body: { imageUrl } });
  if (error) { console.warn('[boardSources] relais image Notion :', error); return null; }
  if (!(data instanceof Blob) || data.size === 0) { console.warn('[boardSources] relais image Notion : réponse inattendue', data); return null; }
  const head = new Uint8Array(await data.slice(0, 12).arrayBuffer());
  const type = head[0] === 0x89 && head[1] === 0x50 ? 'image/png'
    : head[0] === 0xff && head[1] === 0xd8 ? 'image/jpeg'
    : head[0] === 0x47 && head[1] === 0x49 ? 'image/gif'
    : head[8] === 0x57 && head[9] === 0x45 ? 'image/webp'
    : null;
  if (!type) { console.warn('[boardSources] relais image Notion : pas une image'); return null; }
  return new Blob([data], { type });
}

export interface NotionPageBody { text: string; images: { url: string; caption: string }[] }

/** Corps d'une page Notion (premiers paragraphes, toutes les images), lu à la demande. */
export async function fetchNotionPage(pageId: string): Promise<NotionPageBody> {
  const { data, error } = await supabase.functions.invoke<{ text?: string; images?: { url: string; caption: string }[]; error?: string }>('notion-proxy', { body: { pageId } });
  if (error || data?.error) return { text: '', images: [] };
  return { text: data?.text ?? '', images: data?.images ?? [] };
}

// ---- Google Drive ----
// Déplacé dans `googleDrive.ts` (jeton, Picker, navigation par l'API) ; ré-exporté pour le panneau « Ressources ».
export { loadDriveKeys, saveDriveKeys, pickFromGoogleDrive, type DriveKeys, type DriveFile } from './googleDrive';

// ---- Annales de Brevet ----

export const BREVET_SUBJECTS: Matiere[] = ['SVT', 'Physique-Chimie', 'Maths', 'Français', 'Histoire-Géo-EMC'];

export function listBrevets(matiere: Matiere | 'all', query = ''): Brevet[] {
  const q = query.trim().toLowerCase();
  return brevets
    .filter((b) => matiere === 'all' || b.matiere === matiere)
    .filter((b) => !q || `${b.annee} ${b.centre} ${b.theme}`.toLowerCase().includes(q))
    .sort((a, b) => b.annee - a.annee || a.centre.localeCompare(b.centre));
}

/** Télécharge le sujet (PDF public) sous forme de File, prêt pour l'import en pages. */
export async function fetchBrevetFile(b: Brevet): Promise<File> {
  const res = await fetch(b.url);
  if (!res.ok) throw new Error(`Sujet indisponible (${res.status})`);
  const blob = await res.blob();
  return new File([blob], `${b.code}.pdf`, { type: 'application/pdf' });
}
