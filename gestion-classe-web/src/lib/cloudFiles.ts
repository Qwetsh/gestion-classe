/**
 * Page « Mes clouds » : vue unifiée de OneDrive (Graph) et Google Drive (API Drive v3), et ouverture
 * d'un fichier dans la visionneuse. Réutilise les connexions et clés du tableau blanc
 * (`oneDrive.ts`, `googleDrive.ts`, synchronisées entre appareils par `userKeys.ts`).
 *
 * Ouverture : tout ce qui est un document devient un PDF (conversion côté serveur par le cloud
 * quand il sait le faire, sinon Word → PDF dans le navigateur, voir `docConvert.ts`) ; les images,
 * vidéos, sons et textes sont affichés tels quels ; une page HTML est rendue en iframe isolée ;
 * un raccourci Internet (.url, .webloc) ouvre le site en iframe, ou dans un nouvel onglet.
 */
import { docxToPdf, isDocx } from './docConvert';
import {
  DriveExpiredError,
  downloadDriveFile,
  forgetGoogleToken,
  getGoogleToken,
  isGoogleNative,
  listDrive,
  loadDriveKeys,
  saveDriveKeys,
  searchDrive,
  type DriveItem,
  type DriveKeys,
} from './googleDrive';
import {
  OneDriveExpiredError,
  connectOneDrive,
  convertOneDriveToPdf,
  disconnectOneDrive,
  fetchOneDriveRaw,
  isOneDriveConvertible,
  listOneDrive,
  loadOneDriveKeys,
  saveOneDriveKeys,
  searchOneDrive,
  type OneDriveItem,
  type OneDriveKeys,
} from './oneDrive';

export type CloudId = 'onedrive' | 'google';

export type CloudKind = 'folder' | 'pdf' | 'image' | 'office' | 'html' | 'link' | 'text' | 'video' | 'audio' | 'board' | 'other';

export interface CloudCrumb { id: string | null; name: string }

export interface CloudItem {
  id: string;
  name: string;
  kind: CloudKind;
  isFolder: boolean;
  size: number;
  /** Date ISO de dernière modification, ou chaîne vide. */
  modified: string;
  mime: string | null;
  /** Page du fichier sur le site du cloud. */
  webUrl: string | null;
  childCount: number | null;
  /** Le cloud sait fournir ce document en PDF (Office sur OneDrive, Docs/Slides/Sheets sur Google). */
  serverPdf: boolean;
  raw: OneDriveItem | DriveItem;
}

export interface CloudSession { token: string; account: string }

export interface CloudProvider {
  id: CloudId;
  label: string;
  icon: string;
  /** Nom de la racine dans le fil d'Ariane. */
  rootLabel: string;
  /** Racines supplémentaires (Google : « Partagés avec moi »). */
  extraRoots: CloudCrumb[];
  /** La recherche peut se limiter au dossier courant (OneDrive) ou porte sur tout le cloud (Google). */
  scopedSearch: boolean;
  /** Ce qu'il manque pour se connecter, ou null si la clé est renseignée. */
  configured(): boolean;
  /** Dossier de départ épinglé. */
  home(): CloudCrumb[] | undefined;
  setHome(path: CloudCrumb[] | undefined): void;
  connect(interactive: boolean): Promise<CloudSession | null>;
  disconnect(): Promise<void>;
  list(session: CloudSession, folderId: string | null): Promise<CloudItem[]>;
  search(session: CloudSession, query: string, folderId: string | null): Promise<CloudItem[]>;
  /** Fichier brut. */
  fetch(session: CloudSession, item: CloudItem): Promise<File>;
  /** Document converti en PDF par le cloud (si `serverPdf`). */
  fetchPdf(session: CloudSession, item: CloudItem): Promise<File>;
  isExpired(err: unknown): boolean;
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic']);
const OFFICE_EXT = new Set(['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'pps', 'ppsx', 'odp', 'xls', 'xlsx', 'xlsm', 'ods', 'epub']);
const TEXT_EXT = new Set(['txt', 'md', 'csv', 'json', 'xml', 'log']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'm4v', 'mov', 'ogv']);
const AUDIO_EXT = new Set(['mp3', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'aac']);
const LINK_EXT = new Set(['url', 'webloc', 'desktop', 'website']);

export const extensionOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** Nature d'un fichier d'après son nom et son type MIME. */
export function cloudKind(name: string, mime: string | null, isFolder = false): CloudKind {
  if (isFolder) return 'folder';
  const ext = extensionOf(name);
  const m = mime ?? '';
  if (ext === 'pdf' || m === 'application/pdf') return 'pdf';
  if (ext === 'gcboard') return 'board';
  if (IMAGE_EXT.has(ext) || m.startsWith('image/')) return 'image';
  if (ext === 'htm' || ext === 'html' || m === 'text/html') return 'html';
  if (LINK_EXT.has(ext)) return 'link';
  if (OFFICE_EXT.has(ext) || isGoogleNative(m)) return 'office';
  if (VIDEO_EXT.has(ext) || m.startsWith('video/')) return 'video';
  if (AUDIO_EXT.has(ext) || m.startsWith('audio/')) return 'audio';
  if (TEXT_EXT.has(ext) || m.startsWith('text/')) return 'text';
  return 'other';
}

export const KIND_ICON: Record<CloudKind, string> = { folder: '📁', pdf: '📕', image: '🖼', office: '📝', html: '🌐', link: '🔗', text: '📄', video: '🎬', audio: '🎵', board: '🖍', other: '📎' };

const OFFICE_ICON: Record<string, string> = { ppt: '📊', pptx: '📊', pps: '📊', ppsx: '📊', odp: '📊', xls: '📈', xlsx: '📈', xlsm: '📈', ods: '📈' };

export function cloudIcon(item: Pick<CloudItem, 'kind' | 'name' | 'mime'>): string {
  if (item.kind === 'office') {
    const m = item.mime ?? '';
    if (m.endsWith('.presentation')) return '📊';
    if (m.endsWith('.spreadsheet')) return '📈';
    return OFFICE_ICON[extensionOf(item.name)] ?? '📝';
  }
  return KIND_ICON[item.kind];
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

const cancelled = (err: unknown) => err instanceof Error && /user_cancelled|popup_closed/.test(err.message);
/** L'enseignant a refermé la fenêtre de connexion : pas une erreur à afficher. */
export const isCancelled = cancelled;

// ---- OneDrive ----

function fromOneDrive(v: OneDriveItem): CloudItem {
  return {
    id: v.id, name: v.name, kind: cloudKind(v.name, v.mime, v.isFolder), isFolder: v.isFolder, size: v.size, modified: v.modified, mime: v.mime,
    webUrl: v.webUrl, childCount: v.isFolder ? v.childCount : null, serverPdf: !v.isFolder && isOneDriveConvertible(v.name), raw: v,
  };
}

const oneDriveProvider: CloudProvider = {
  id: 'onedrive',
  label: 'OneDrive',
  icon: '☁️',
  rootLabel: 'OneDrive',
  extraRoots: [],
  scopedSearch: true,
  configured: () => !!loadOneDriveKeys().clientId?.trim(),
  home: () => loadOneDriveKeys().home,
  setHome: (path) => saveOneDriveKeys({ ...loadOneDriveKeys(), home: path?.length ? path.map((c) => ({ id: c.id!, name: c.name })) : undefined }),
  connect: (interactive) => connectOneDrive(loadOneDriveKeys(), interactive),
  disconnect: () => disconnectOneDrive(loadOneDriveKeys()),
  list: async (s, folderId) => (await listOneDrive(s.token, folderId)).map(fromOneDrive),
  search: async (s, q, folderId) => (await searchOneDrive(s.token, q, folderId)).map(fromOneDrive),
  fetch: (s, item) => fetchOneDriveRaw(s.token, item.raw as OneDriveItem),
  fetchPdf: (s, item) => convertOneDriveToPdf(s.token, item.raw as OneDriveItem),
  isExpired: (err) => err instanceof OneDriveExpiredError,
};

// ---- Google Drive ----

function fromDrive(v: DriveItem): CloudItem {
  return {
    id: v.id, name: v.name, kind: cloudKind(v.name, v.mime, v.isFolder), isFolder: v.isFolder, size: v.size, modified: v.modified, mime: v.mime,
    webUrl: v.webUrl, childCount: null, serverPdf: !v.isFolder && isGoogleNative(v.mime), raw: v,
  };
}

const googleProvider: CloudProvider = {
  id: 'google',
  label: 'Google Drive',
  icon: '🟢',
  rootLabel: 'Mon Drive',
  extraRoots: [{ id: 'shared', name: 'Partagés avec moi' }],
  scopedSearch: false,
  configured: () => !!loadDriveKeys().clientId?.trim(),
  home: () => loadDriveKeys().home,
  setHome: (path) => saveDriveKeys({ ...loadDriveKeys(), home: path?.length ? path.map((c) => ({ id: c.id!, name: c.name })) : undefined }),
  connect: async (interactive) => {
    const token = await getGoogleToken(loadDriveKeys(), interactive);
    return token ? { token, account: '' } : null;
  },
  disconnect: async () => forgetGoogleToken(),
  list: async (s, folderId) => (await listDrive(s.token, folderId)).map(fromDrive),
  search: async (s, q) => (await searchDrive(s.token, q)).map(fromDrive),
  fetch: (s, item) => downloadDriveFile(s.token, item.raw as DriveItem),
  fetchPdf: (s, item) => downloadDriveFile(s.token, item.raw as DriveItem),
  isExpired: (err) => err instanceof DriveExpiredError,
};

export const CLOUD_PROVIDERS: CloudProvider[] = [oneDriveProvider, googleProvider];

export function cloudProvider(id: CloudId): CloudProvider {
  return CLOUD_PROVIDERS.find((p) => p.id === id)!;
}

export type { DriveKeys, OneDriveKeys };

// ---- Ouverture d'un fichier ----

/** Ce que la visionneuse reçoit. */
export type OpenedFile =
  | { kind: 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'html'; file: File; /** Nom du fichier d'origine (avant conversion). */ source?: string }
  | { kind: 'link'; url: string; source?: string }
  | { kind: 'download'; file: File; reason: string };

/** Adresse contenue dans un raccourci Internet (.url Windows, .webloc macOS, .desktop Linux). */
export function parseShortcut(text: string): string | null {
  const m = text.match(/^\s*URL\s*=\s*(\S+)/im) ?? text.match(/<string>\s*(https?:\/\/[^<\s]+)\s*<\/string>/i) ?? text.match(/https?:\/\/\S+/);
  return m ? m[1].trim() : null;
}

/**
 * Prépare un fichier du cloud pour la visionneuse : télécharge, convertit si besoin.
 * `onStep` reçoit l'étape en cours (téléchargement, conversion…).
 */
export async function openCloudItem(provider: CloudProvider, session: CloudSession, item: CloudItem, onStep?: (label: string) => void): Promise<OpenedFile> {
  switch (item.kind) {
    case 'office': {
      if (item.serverPdf) {
        onStep?.('Conversion en PDF par le cloud…');
        return { kind: 'pdf', file: await provider.fetchPdf(session, item), source: item.name };
      }
      onStep?.('Téléchargement…');
      const raw = await provider.fetch(session, item);
      if (isDocx(raw.name)) return { kind: 'pdf', file: await docxToPdf(raw, onStep), source: item.name };
      return { kind: 'download', file: raw, reason: `Ce format (${extensionOf(item.name) || 'inconnu'}) ne se convertit pas dans le navigateur : ouvrir dans ${provider.label} ou télécharger.` };
    }
    case 'link': {
      onStep?.('Lecture du raccourci…');
      const raw = await provider.fetch(session, item);
      const url = parseShortcut(await raw.text());
      if (!url) return { kind: 'download', file: raw, reason: 'Aucune adresse trouvée dans ce raccourci.' };
      return { kind: 'link', url, source: item.name };
    }
    case 'pdf': case 'image': case 'video': case 'audio': case 'text': case 'html': {
      onStep?.('Téléchargement…');
      return { kind: item.kind, file: await provider.fetch(session, item) };
    }
    default: {
      onStep?.('Téléchargement…');
      const raw = await provider.fetch(session, item);
      return { kind: 'download', file: raw, reason: item.kind === 'board' ? 'Un tableau se charge depuis le tableau blanc (Ressources › Drive).' : 'Type de fichier non affichable ici.' };
    }
  }
}

/** Ouverture d'un fichier local (glissé sur la page) avec les mêmes conversions. */
export async function openLocalFile(file: File, onStep?: (label: string) => void): Promise<OpenedFile> {
  const kind = cloudKind(file.name, file.type || null);
  if (kind === 'office') {
    if (isDocx(file.name)) return { kind: 'pdf', file: await docxToPdf(file, onStep), source: file.name };
    return { kind: 'download', file, reason: `Ce format (${extensionOf(file.name) || 'inconnu'}) ne se convertit pas dans le navigateur.` };
  }
  if (kind === 'link') {
    const url = parseShortcut(await file.text());
    return url ? { kind: 'link', url, source: file.name } : { kind: 'download', file, reason: 'Aucune adresse trouvée dans ce raccourci.' };
  }
  if (kind === 'pdf' || kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'text' || kind === 'html') return { kind, file };
  return { kind: 'download', file, reason: 'Type de fichier non affichable ici.' };
}

/**
 * Adresse à charger dans l'iframe pour un lien : les sites qui proposent une version intégrable
 * (YouTube, Google Docs/Drive, Vimeo…) y sont convertis ; null si le site refuse notoirement
 * l'intégration (il faut alors ouvrir un nouvel onglet).
 */
export function embedUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/') ? u.pathname.split('/')[2] : null);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (u.pathname.startsWith('/embed/')) return `https://www.youtube-nocookie.com${u.pathname}`;
  }
  if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  if (host === 'vimeo.com') { const id = u.pathname.split('/').filter(Boolean).pop(); if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`; }
  if (host === 'docs.google.com') return raw.replace(/\/(edit|view)(\?[^#]*)?/, '/preview');
  if (host === 'drive.google.com') { const m = u.pathname.match(/\/file\/d\/([^/]+)/); if (m) return `https://drive.google.com/file/d/${m[1]}/preview`; }
  if (host === 'genial.ly' || host === 'view.genially.com' || host === 'app.genially.com') return raw.replace('app.genially.com/view/', 'view.genially.com/');
  // Sites qui interdisent l'iframe (X-Frame-Options) : inutile d'essayer
  if (/(^|\.)(google\.(com|fr)|facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|microsoft\.com|office\.com|live\.com|sharepoint\.com|amazon\.(com|fr)|github\.com)$/.test(host)) return null;
  return raw;
}
