/**
 * Google Drive : jeton OAuth (Google Identity Services), sélecteur (Picker, panneau « Ressources »
 * du tableau) et navigation directe par l'API Drive v3 (page « Mes clouds ») : dossiers, recherche,
 * « Partagés avec moi », téléchargement. Les documents Google natifs (Docs, Slides, Sheets) sont
 * exportés en PDF par Google ; les fichiers Office déposés tels quels sont téléchargés bruts.
 *
 * Aucune clé n'est inventée : il faut un « ID client OAuth » d'un projet Google Cloud (API Drive
 * activée, origine JavaScript autorisée = origine du site). La clé API n'est nécessaire que pour
 * le Picker. Le jeton (1 h) est gardé en sessionStorage pour ne pas rouvrir la fenêtre Google à
 * chaque rechargement.
 */
import { MissingKeyError } from './boardSearch';
import { pushKeys } from './userKeys';

/** Un maillon du fil d'Ariane (dossier parcouru). */
export interface DriveCrumb { id: string; name: string }

export interface DriveKeys {
  clientId?: string;
  apiKey?: string;
  /** Dossier de départ épinglé (chemin complet depuis « Mon Drive »), ouvert d'office à la connexion. */
  home?: DriveCrumb[];
}
const DRIVE_KEY = 'classroom-board-drive-keys';

export function loadDriveKeys(): DriveKeys {
  try { return JSON.parse(localStorage.getItem(DRIVE_KEY) || '{}') as DriveKeys; } catch { return {}; }
}

export function saveDriveKeys(keys: DriveKeys) {
  try { localStorage.setItem(DRIVE_KEY, JSON.stringify(keys)); } catch { /* stockage indisponible */ }
  void pushKeys();
}

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';
const TOKEN_KEY = 'classroom-board-drive-token';

export interface DriveFile { id: string; name: string; mimeType: string }

interface PickerBuilderT {
  addView(v: unknown): PickerBuilderT;
  setOAuthToken(t: string): PickerBuilderT;
  setDeveloperKey(k: string): PickerBuilderT;
  setCallback(cb: (d: { action: string; docs?: DriveFile[] }) => void): PickerBuilderT;
  setLocale(l: string): PickerBuilderT;
  build(): { setVisible(v: boolean): void };
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }

interface GoogleGlobal {
  accounts?: { oauth2: { initTokenClient(cfg: { client_id: string; scope: string; prompt?: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }): { requestAccessToken(): void } } };
  picker?: {
    PickerBuilder: new () => PickerBuilderT;
    ViewId: { DOCS: unknown; DOCS_IMAGES: unknown };
    Action: { PICKED: string };
  };
}

type GoogleWindow = Window & { google?: GoogleGlobal; gapi?: { load(n: string, cb: () => void): void } };

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

interface StoredToken { token: string; expires: number; clientId: string }

function storedToken(clientId: string): string | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null') as StoredToken | null;
    return t && t.clientId === clientId && t.expires > Date.now() + 60_000 ? t.token : null;
  } catch { return null; }
}

/** Jeton refusé par Drive : il faut se reconnecter. */
export class DriveExpiredError extends Error {
  constructor() { super('Session Google expirée : ouvrir Google Drive à nouveau.'); this.name = 'DriveExpiredError'; }
}

/** Oublie le jeton gardé dans cet onglet (la session Google du navigateur reste ouverte). */
export function forgetGoogleToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* stockage indisponible */ }
}

/**
 * Jeton d'accès Drive (lecture seule). Sans interaction : uniquement s'il en reste un valable dans
 * l'onglet (sinon null). Avec interaction : ouvre la fenêtre Google (sans écran de consentement si
 * déjà accordé).
 */
export async function getGoogleToken(keys: DriveKeys, interactive: boolean): Promise<string | null> {
  const clientId = keys.clientId?.trim();
  if (!clientId) throw new MissingKeyError('Google Drive', 'ID client OAuth Google (console Google Cloud, API Drive activée) à renseigner.');
  const cached = storedToken(clientId);
  if (cached) return cached;
  if (!interactive) return null;
  await loadScript('https://accounts.google.com/gsi/client');
  const g = window as GoogleWindow;
  if (!g.google?.accounts) throw new Error('Bibliothèque Google indisponible');
  const { token, expires } = await new Promise<{ token: string; expires: number }>((resolve, reject) => {
    const client = g.google!.accounts!.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => (r.access_token ? resolve({ token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 }) : reject(new Error(r.error ?? 'Accès refusé'))),
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'user_cancelled' : e.message ?? 'Connexion Google impossible')),
    });
    client.requestAccessToken();
  });
  try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires, clientId } satisfies StoredToken)); } catch { /* stockage indisponible */ }
  return token;
}

// ---- Sélecteur (Picker), utilisé par le tableau blanc ----

/**
 * Ouvre le sélecteur Google Drive et renvoie le fichier choisi téléchargé (Blob) avec son nom.
 * Demande l'accès « drive.readonly » via OAuth (client id) ; le Picker a besoin d'une clé API.
 */
export async function pickFromGoogleDrive(keys: DriveKeys): Promise<{ file: DriveFile; blob: Blob } | null> {
  if (!keys.clientId || !keys.apiKey) throw new MissingKeyError('Google Drive', 'Client ID OAuth et clé API Google (console Google Cloud, API Picker + Drive activées) à renseigner.');
  const token = await getGoogleToken(keys, true);
  if (!token) return null;
  await loadScript('https://apis.google.com/js/api.js');
  const g = window as GoogleWindow;
  if (!g.gapi) throw new Error('Bibliothèques Google indisponibles');
  await new Promise<void>((resolve) => g.gapi!.load('picker', resolve));
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
  const file = await downloadDriveFile(token, { id: picked.id, name: picked.name, mime: picked.mimeType });
  return { file: { id: picked.id, name: file.name, mimeType: file.type }, blob: file };
}

// ---- Navigation par l'API Drive ----

export interface DriveItem {
  id: string;
  name: string;
  mime: string;
  size: number;
  isFolder: boolean;
  modified: string;
  /** Page du fichier sur drive.google.com (ouverture dans l'application Google). */
  webUrl: string | null;
  /** Raccourci Drive : identifiant et type de la cible. */
  shortcut: { id: string; mime: string } | null;
}

interface ApiFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
}

const FOLDER = 'application/vnd.google-apps.folder';
const SHORTCUT = 'application/vnd.google-apps.shortcut';
const FIELDS = 'files(id,name,mimeType,size,modifiedTime,webViewLink,shortcutDetails)';

export const isGoogleNative = (mime: string) => mime.startsWith('application/vnd.google-apps.') && mime !== FOLDER && mime !== SHORTCUT;

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { forgetGoogleToken(); throw new DriveExpiredError(); }
  if (!res.ok) {
    let message = `Drive ${res.status}`;
    try { const j = (await res.json()) as { error?: { message?: string } }; if (j.error?.message) message = j.error.message; } catch { /* corps non JSON */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function toItems(files: ApiFile[]): DriveItem[] {
  return files
    .map((f) => {
      const isFolder = f.mimeType === FOLDER || f.shortcutDetails?.targetMimeType === FOLDER;
      const shortcut = f.mimeType === SHORTCUT && f.shortcutDetails?.targetId ? { id: f.shortcutDetails.targetId, mime: f.shortcutDetails.targetMimeType ?? '' } : null;
      return { id: f.id, name: f.name, mime: shortcut?.mime || f.mimeType, size: Number(f.size ?? 0), isFolder, modified: f.modifiedTime ?? '', webUrl: f.webViewLink ?? null, shortcut };
    })
    .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** Contenu d'un dossier (« Mon Drive » si `folderId` est null ; `'shared'` = Partagés avec moi). */
export async function listDrive(token: string, folderId: string | null): Promise<DriveItem[]> {
  const q = folderId === 'shared' ? 'sharedWithMe = true and trashed = false' : `'${esc(folderId ?? 'root')}' in parents and trashed = false`;
  const data = await api<{ files: ApiFile[] }>(token, `/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(FIELDS)}&pageSize=500&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return toItems(data.files);
}

/** Recherche par nom et contenu indexé (dans tout le Drive : l'API ne sait pas restreindre à un sous-arbre). */
export async function searchDrive(token: string, query: string): Promise<DriveItem[]> {
  const q = `(name contains '${esc(query)}' or fullText contains '${esc(query)}') and trashed = false`;
  const data = await api<{ files: ApiFile[] }>(token, `/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(FIELDS)}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return toItems(data.files);
}

/**
 * Télécharge un fichier : les documents Google natifs sont exportés en PDF, les autres sont
 * renvoyés tels quels (un raccourci est suivi jusqu'à sa cible).
 */
export async function downloadDriveFile(token: string, item: { id: string; name: string; mime: string; shortcut?: { id: string; mime: string } | null }): Promise<File> {
  const id = item.shortcut?.id ?? item.id;
  const native = isGoogleNative(item.mime);
  const url = native ? `${API}/files/${encodeURIComponent(id)}/export?mimeType=application/pdf` : `${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { forgetGoogleToken(); throw new DriveExpiredError(); }
  if (!res.ok) throw new Error(`${native ? 'Export en PDF' : 'Téléchargement'} impossible (${res.status})`);
  const blob = await res.blob();
  if (native) return new File([blob], `${item.name.replace(/\.pdf$/i, '')}.pdf`, { type: 'application/pdf' });
  return new File([blob], item.name, { type: item.mime || blob.type });
}
