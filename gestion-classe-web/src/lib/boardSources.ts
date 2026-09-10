/**
 * Sources externes du panneau « Ressources » : base Notion (via l'Edge Function
 * notion-proxy), Google Drive (Picker), annales de Brevet (bucket public).
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

// ---- Google Drive (Picker) ----

export interface DriveKeys { clientId?: string; apiKey?: string }
const DRIVE_KEY = 'classroom-board-drive-keys';

export function loadDriveKeys(): DriveKeys {
  try { return JSON.parse(localStorage.getItem(DRIVE_KEY) || '{}') as DriveKeys; } catch { return {}; }
}

export function saveDriveKeys(keys: DriveKeys) {
  try { localStorage.setItem(DRIVE_KEY, JSON.stringify(keys)); } catch { /* stockage indisponible */ }
  void pushKeys();
}

export interface DriveFile { id: string; name: string; mimeType: string }

interface PickerBuilderT {
  addView(v: unknown): PickerBuilderT;
  setOAuthToken(t: string): PickerBuilderT;
  setDeveloperKey(k: string): PickerBuilderT;
  setCallback(cb: (d: { action: string; docs?: DriveFile[] }) => void): PickerBuilderT;
  setLocale(l: string): PickerBuilderT;
  build(): { setVisible(v: boolean): void };
}

interface GoogleGlobal {
  accounts?: { oauth2: { initTokenClient(cfg: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string }) => void }): { requestAccessToken(): void } } };
  picker?: {
    PickerBuilder: new () => PickerBuilderT;
    ViewId: { DOCS: unknown; DOCS_IMAGES: unknown };
    Action: { PICKED: string };
  };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Script indisponible : ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Ouvre le sélecteur Google Drive et renvoie le fichier choisi téléchargé (Blob) avec son nom.
 * Demande l'accès « drive.readonly » via OAuth (client id) ; le Picker a besoin d'une clé API.
 */
export async function pickFromGoogleDrive(keys: DriveKeys): Promise<{ file: DriveFile; blob: Blob } | null> {
  if (!keys.clientId || !keys.apiKey) throw new MissingKeyError('Google Drive', 'Client ID OAuth et clé API Google (console Google Cloud, API Picker + Drive activées) à renseigner.');
  await loadScript('https://accounts.google.com/gsi/client');
  await loadScript('https://apis.google.com/js/api.js');
  const g = (window as unknown as { google?: GoogleGlobal; gapi?: { load(n: string, cb: () => void): void } });
  if (!g.google?.accounts || !g.gapi) throw new Error('Bibliothèques Google indisponibles');
  await new Promise<void>((resolve) => g.gapi!.load('picker', resolve));
  const token = await new Promise<string>((resolve, reject) => {
    const client = g.google!.accounts!.oauth2.initTokenClient({
      client_id: keys.clientId!,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error ?? 'Accès refusé'))),
    });
    client.requestAccessToken();
  });
  const picked = await new Promise<DriveFile | null>((resolve) => {
    const picker = g.google!.picker!;
    new picker.PickerBuilder()
      .addView(picker.ViewId.DOCS)
      .setOAuthToken(token)
      .setDeveloperKey(keys.apiKey!)
      .setLocale('fr')
      .setCallback((d) => { if (d.action === picker.Action.PICKED) resolve(d.docs?.[0] ?? null); else if (d.action === 'cancel') resolve(null); })
      .build()
      .setVisible(true);
  });
  if (!picked) return null;
  const isGoogleDoc = picked.mimeType.startsWith('application/vnd.google-apps');
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${picked.id}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${picked.id}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const blob = await res.blob();
  return { file: isGoogleDoc ? { ...picked, name: `${picked.name}.pdf`, mimeType: 'application/pdf' } : picked, blob };
}

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
