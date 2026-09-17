/**
 * OneDrive (Microsoft Graph) pour le panneau « Ressources » : connexion au compte Microsoft
 * (MSAL, fenêtre surgissante), navigation dans les dossiers, recherche et téléchargement d'un
 * fichier prêt pour l'import en pages. Les documents Office (Word, PowerPoint, Excel…) sont
 * convertis en PDF par Graph.
 *
 * Aucune clé n'est inventée : il faut l'« ID d'application (client) » d'une inscription Azure
 * (portal.azure.com › Microsoft Entra ID › Inscriptions d'applications), acceptant les comptes
 * personnels et d'organisation, plateforme « Application monopage », avec pour URI de
 * redirection `ONEDRIVE_REDIRECT_URI` (page vide servie par l'app). `msal-browser` n'est chargé
 * qu'au moment d'ouvrir OneDrive ; le jeton est mis en cache dans le navigateur, la reconnexion
 * est silencieuse tant qu'il est valable.
 */
import type { PublicClientApplication } from '@azure/msal-browser';
import { MissingKeyError } from './boardSearch';
import { pushKeys } from './userKeys';

export interface OneDriveKeys { clientId?: string }
const ONEDRIVE_KEY = 'classroom-board-onedrive-keys';

export function loadOneDriveKeys(): OneDriveKeys {
  try { return JSON.parse(localStorage.getItem(ONEDRIVE_KEY) || '{}') as OneDriveKeys; } catch { return {}; }
}

export function saveOneDriveKeys(keys: OneDriveKeys) {
  try { localStorage.setItem(ONEDRIVE_KEY, JSON.stringify(keys)); } catch { /* stockage indisponible */ }
  void pushKeys();
}

const SCOPES = ['Files.Read'];
const GRAPH = 'https://graph.microsoft.com/v1.0';

/** Page vide servie par l'app, où Microsoft renvoie la fenêtre de connexion. */
export const ONEDRIVE_REDIRECT_URI = `${window.location.origin}${import.meta.env.BASE_URL}auth-callback.html`;

let app: { clientId: string; pca: PublicClientApplication } | null = null;

async function getApp(clientId: string): Promise<PublicClientApplication> {
  if (app && app.clientId === clientId) return app.pca;
  const { PublicClientApplication } = await import('@azure/msal-browser');
  const pca = new PublicClientApplication({
    auth: { clientId, authority: 'https://login.microsoftonline.com/common', redirectUri: ONEDRIVE_REDIRECT_URI },
    cache: { cacheLocation: 'localStorage' },
  });
  await pca.initialize();
  app = { clientId, pca };
  return pca;
}

export interface OneDriveSession { token: string; account: string }

/**
 * Jeton d'accès Graph. Sans interaction : uniquement si un compte est déjà connu et son jeton
 * renouvelable en silence (sinon null). Avec interaction : ouvre la fenêtre Microsoft.
 */
export async function connectOneDrive(keys: OneDriveKeys, interactive: boolean): Promise<OneDriveSession | null> {
  const clientId = keys.clientId?.trim();
  if (!clientId) throw new MissingKeyError('OneDrive', "ID d'application (client) Azure à renseigner (inscription gratuite, voir ci-dessous).");
  const pca = await getApp(clientId);
  const known = pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  if (known) {
    try {
      const r = await pca.acquireTokenSilent({ scopes: SCOPES, account: known });
      return { token: r.accessToken, account: known.username };
    } catch (err) {
      if (!interactive) { console.info('[oneDrive] jeton silencieux indisponible :', err); return null; }
    }
  }
  if (!interactive) return null;
  const r = await pca.loginPopup({ scopes: SCOPES, prompt: known ? undefined : 'select_account' });
  if (r.account) pca.setActiveAccount(r.account);
  return { token: r.accessToken, account: r.account?.username ?? '' };
}

/** Oublie le compte dans ce navigateur (sans déconnecter la session Microsoft du navigateur). */
export async function disconnectOneDrive(keys: OneDriveKeys): Promise<void> {
  const clientId = keys.clientId?.trim();
  if (!clientId) return;
  const pca = await getApp(clientId);
  await pca.clearCache();
  pca.setActiveAccount(null);
}

export type OneDriveImport = 'direct' | 'convert' | null;

export interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  isFolder: boolean;
  childCount: number;
  mime: string | null;
  modified: string;
  /** direct : PDF, image ou tableau ; convert : document Office converti en PDF ; null : non importable. */
  importable: OneDriveImport;
}

/** Extensions que Graph sait convertir en PDF (`/content?format=pdf`). */
const CONVERTIBLE = new Set(['doc', 'docx', 'odp', 'ods', 'odt', 'pps', 'ppsx', 'ppt', 'pptx', 'rtf', 'xls', 'xlsm', 'xlsx', 'tif', 'tiff', 'md', 'htm', 'html', 'eml', 'msg', 'epub']);

function importKind(name: string, mime: string | null): OneDriveImport {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf' || ext === 'gcboard' || mime === 'application/pdf' || (mime ?? '').startsWith('image/')) return 'direct';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'direct';
  if (CONVERTIBLE.has(ext)) return 'convert';
  return null;
}

interface GraphItem {
  id: string;
  name: string;
  size?: number;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
}

async function graph<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new OneDriveExpiredError();
  if (!res.ok) {
    let message = `Graph ${res.status}`;
    try { const j = (await res.json()) as { error?: { message?: string } }; if (j.error?.message) message = j.error.message; } catch { /* corps non JSON */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Jeton refusé par Graph : il faut se reconnecter. */
export class OneDriveExpiredError extends Error {
  constructor() { super('Session Microsoft expirée : ouvrir OneDrive à nouveau.'); this.name = 'OneDriveExpiredError'; }
}

const SELECT = '$select=id,name,size,folder,file,lastModifiedDateTime';

function toItems(values: GraphItem[]): OneDriveItem[] {
  return values
    .map((v) => {
      const mime = v.file?.mimeType ?? null;
      const isFolder = !!v.folder;
      return { id: v.id, name: v.name, size: v.size ?? 0, isFolder, childCount: v.folder?.childCount ?? 0, mime, modified: v.lastModifiedDateTime ?? '', importable: isFolder ? null : importKind(v.name, mime) };
    })
    .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
}

/** Contenu d'un dossier (racine si `folderId` est null) : dossiers d'abord, puis fichiers par nom. */
export async function listOneDrive(token: string, folderId: string | null): Promise<OneDriveItem[]> {
  const base = folderId ? `/me/drive/items/${encodeURIComponent(folderId)}/children` : '/me/drive/root/children';
  const data = await graph<{ value: GraphItem[] }>(token, `${base}?${SELECT}&$top=500`);
  return toItems(data.value);
}

/** Recherche dans tout le OneDrive (nom et contenu indexé). */
export async function searchOneDrive(token: string, query: string): Promise<OneDriveItem[]> {
  const q = encodeURIComponent(query.trim().replace(/'/g, "''"));
  const data = await graph<{ value: GraphItem[] }>(token, `/me/drive/root/search(q='${q}')?${SELECT}&$top=100`);
  return toItems(data.value);
}

/**
 * Télécharge un fichier prêt pour l'import : tel quel (PDF, image, tableau) ou converti en PDF
 * (documents Office). Le téléchargement lui-même se fait sur une URL pré-autorisée, sans jeton.
 */
export async function downloadOneDriveFile(token: string, item: OneDriveItem): Promise<File> {
  if (item.importable === 'convert') {
    const res = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(item.id)}/content?format=pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new OneDriveExpiredError();
    if (!res.ok) throw new Error(`Conversion en PDF impossible (${res.status})`);
    const blob = await res.blob();
    return new File([blob], `${item.name.replace(/\.[^.]+$/, '')}.pdf`, { type: 'application/pdf' });
  }
  const meta = await graph<GraphItem>(token, `/me/drive/items/${encodeURIComponent(item.id)}?select=id,name,file,@microsoft.graph.downloadUrl`);
  const url = meta['@microsoft.graph.downloadUrl'];
  if (!url) throw new Error('Lien de téléchargement absent');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const blob = await res.blob();
  const ext = (item.name.split('.').pop() ?? '').toLowerCase();
  const type = item.mime || (ext === 'pdf' ? 'application/pdf' : blob.type);
  return new File([blob], item.name, { type });
}

export function formatOneDriveSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
