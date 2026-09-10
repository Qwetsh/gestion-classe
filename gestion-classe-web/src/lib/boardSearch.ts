/**
 * Recherche intégrée au tableau blanc : Wikipédia et Wikimedia Commons (sans clé),
 * YouTube et Unsplash (clé API de l'enseignant, gardée dans le navigateur), web via
 * l'Edge Function `search-proxy` (Brave Search, clé côté serveur).
 *
 * Aucune clé n'est inventée : sans clé, le fournisseur explique quoi renseigner.
 */
import { supabase } from './supabase';
import { pushKeys } from './userKeys';

export type SearchKind = 'web' | 'video' | 'image';

export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  /** Page, vidéo ou image en pleine taille. */
  url: string;
  /** Vignette (images, vidéos) ou extrait (web). */
  thumbnail?: string;
  snippet?: string;
  /** Source et licence, pour les images. */
  credit?: string;
  provider: string;
}

export interface ApiKeys { youtube?: string; unsplash?: string }

const KEYS_STORAGE = 'classroom-board-api-keys';

export function loadApiKeys(): ApiKeys {
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) || '{}') as ApiKeys; } catch { return {}; }
}

export function saveApiKeys(keys: ApiKeys) {
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys)); } catch { /* stockage indisponible */ }
  void pushKeys();
}

export class MissingKeyError extends Error {
  provider: string;
  hint: string;
  constructor(provider: string, hint: string) {
    super(`${provider} : clé à renseigner`);
    this.provider = provider;
    this.hint = hint;
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// ---- Wikipédia (sans clé) ----

interface WikiSearchResponse {
  query?: { pages?: Record<string, { pageid: number; title: string; extract?: string; thumbnail?: { source: string }; fullurl?: string }> };
}

export async function searchWikipedia(q: string): Promise<SearchResult[]> {
  const url = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=8&prop=extracts|pageimages|info&exintro=1&explaintext=1&exsentences=2&exlimit=8&pithumbsize=240&inprop=url&format=json&origin=*`;
  const data = await getJson<WikiSearchResponse>(url);
  return Object.values(data.query?.pages ?? {}).map((p) => ({
    id: `wp-${p.pageid}`,
    kind: 'web' as const,
    title: p.title,
    url: p.fullurl ?? `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
    thumbnail: p.thumbnail?.source,
    snippet: p.extract,
    provider: 'Wikipédia',
  }));
}

// ---- Wikimedia Commons (images libres, sans clé) ----

interface CommonsResponse {
  query?: { pages?: Record<string, { pageid: number; title: string; imageinfo?: { url: string; thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[] }> };
}

export async function searchCommons(q: string): Promise<SearchResult[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}%20filetype:bitmap&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320&format=json&origin=*`;
  const data = await getJson<CommonsResponse>(url);
  return Object.values(data.query?.pages ?? {}).flatMap((p) => {
    const info = p.imageinfo?.[0];
    if (!info) return [];
    const meta = info.extmetadata ?? {};
    const license = meta.LicenseShortName?.value ?? '';
    const artist = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '');
    return [{
      id: `commons-${p.pageid}`,
      kind: 'image' as const,
      title: p.title.replace(/^File:/, ''),
      url: info.url,
      thumbnail: info.thumburl ?? info.url,
      credit: [artist, license, 'Wikimedia Commons'].filter(Boolean).join(' · '),
      provider: 'Wikimedia Commons',
    }];
  });
}

// ---- YouTube Data API v3 (clé) ----

interface YouTubeResponse { items?: { id: { videoId?: string }; snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url: string } } } }[] }

export async function searchYouTube(q: string, keys: ApiKeys): Promise<SearchResult[]> {
  if (!keys.youtube) throw new MissingKeyError('YouTube', 'La recherche de vidéos demande une clé « YouTube Data API v3 » (gratuite, sans carte bancaire : console.cloud.google.com → API et services → activer YouTube Data API v3 → Identifiants → Clé API). À coller ci-dessous dans « Clés API ».');
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&safeSearch=strict&maxResults=12&relevanceLanguage=fr&q=${encodeURIComponent(q)}&key=${encodeURIComponent(keys.youtube)}`;
  const data = await getJson<YouTubeResponse>(url);
  // YouTube renvoie les titres avec des entités HTML (L&#39;éruption…)
  const decode = (t: string) => { const el = document.createElement('textarea'); el.innerHTML = t; return el.value; };
  return (data.items ?? []).flatMap((it) => it.id.videoId ? [{
    id: `yt-${it.id.videoId}`,
    kind: 'video' as const,
    title: decode(it.snippet.title),
    url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
    thumbnail: it.snippet.thumbnails?.medium?.url,
    snippet: decode(it.snippet.channelTitle),
    provider: 'YouTube',
  }] : []);
}

// ---- Unsplash (clé) ----

interface UnsplashResponse { results?: { id: string; description?: string; alt_description?: string; urls: { regular: string; small: string }; user: { name: string }; links: { html: string } }[] }

export async function searchUnsplash(q: string, keys: ApiKeys): Promise<SearchResult[]> {
  if (!keys.unsplash) throw new MissingKeyError('Unsplash', 'Clé « Access Key » Unsplash (compte développeur gratuit) à renseigner dans les réglages.');
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=16&content_filter=high&lang=fr`;
  const data = await getJson<UnsplashResponse>(url, { headers: { Authorization: `Client-ID ${keys.unsplash}` } });
  return (data.results ?? []).map((r) => ({
    id: `unsplash-${r.id}`,
    kind: 'image' as const,
    title: r.description ?? r.alt_description ?? 'Photo',
    url: r.urls.regular,
    thumbnail: r.urls.small,
    credit: `${r.user.name} · Unsplash`,
    provider: 'Unsplash',
  }));
}

// ---- Web (Brave Search) via Edge Function : la clé reste côté serveur ----

interface ProxyResponse { results?: { title: string; url: string; description?: string; thumbnail?: string }[]; error?: string }

export async function searchWeb(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.functions.invoke<ProxyResponse>('search-proxy', { body: { q, count: 10 } });
  if (error) throw new MissingKeyError('Recherche web', "L'Edge Function « search-proxy » n'est pas déployée ou sa clé BRAVE_API_KEY manque. En attendant, l'onglet Web interroge Wikipédia.");
  if (data?.error) throw new Error(data.error);
  return (data?.results ?? []).map((r, i) => ({
    id: `web-${i}`,
    kind: 'web' as const,
    title: r.title,
    url: r.url,
    thumbnail: r.thumbnail,
    snippet: r.description,
    provider: 'Web',
  }));
}

/** Télécharge une image de résultat (Commons, Unsplash autorisent le CORS) pour l'envoyer dans le bucket. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Image indisponible (${res.status})`);
  return res.blob();
}
