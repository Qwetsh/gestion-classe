/**
 * Banque d'images du cours (lot T16b) : recherche dans Wikimedia Commons, qui n'héberge que des
 * fichiers libres (domaine public, CC0, CC BY, CC BY-SA…). L'image choisie est copiée dans le
 * bucket du cours (le cours ne dépend pas de Wikimedia) et garde son crédit (auteur, licence,
 * source), affiché d'office sous l'image : c'est la condition des licences CC BY et CC BY-SA.
 *
 * Usage de l'API : requêtes une à une (jamais en parallèle), en-tête `Api-User-Agent` (le
 * navigateur ne laisse pas changer le User-Agent), vignettes aux tailles standard de Wikimedia.
 */

const API = 'https://commons.wikimedia.org/w/api.php';
const AGENT = 'GestionClasse-EditeurCours/1.0';
const PAGE_SIZE = 24;
/** Tailles de vignettes standard (Wikimedia limite les tailles libres). */
const THUMB_W = 330;
const INSERT_W = 1280;
const CREDIT_MAX = 160;

export interface ImageCredit {
  /** Texte affiché sous l'image : « Auteur · Licence · Wikimedia Commons ». */
  text: string;
  /** Page du fichier sur Commons (auteur, licence complète). */
  url: string;
}

export interface BankImage {
  /** Nom du fichier sur Commons (« File:… »). */
  file: string;
  title: string;
  thumb: string;
  width: number;
  height: number;
  credit: ImageCredit;
  license: string;
}

export interface BankPage {
  items: BankImage[];
  /** Décalage de la page suivante (null : plus de résultats). */
  next: number | null;
}

interface ApiImageInfo {
  thumburl?: string;
  width?: number;
  height?: number;
  mime?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
}
interface ApiPage { title: string; index?: number; imageinfo?: ApiImageInfo[] }
interface ApiResponse { query?: { pages?: ApiPage[] }; continue?: { gsroffset?: number } }

const MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/tiff']);

/** Texte brut d'un champ HTML de Commons (auteur souvent donné en liens). */
export function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<sup[\s\S]*?<\/sup>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Les notes « [1] » vers des références ne servent à rien dans un crédit
  doc.querySelectorAll('a.autonumber, sup').forEach((el) => el.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const LICENSE_FR: Record<string, string> = {
  'public domain': 'Domaine public',
  'pd': 'Domaine public',
  'no restrictions': 'Domaine public',
};

export function licenseLabel(raw: string): string {
  const v = raw.trim();
  return LICENSE_FR[v.toLowerCase()] ?? v;
}

const UNKNOWN_AUTHOR = /^(unknown|unknown author|anonymous|auteur inconnu|inconnu)\.?$/i;

/** Crédit à écrire sous l'image (auteur, licence, source). */
export function buildCredit(artistHtml: string, license: string, url: string): ImageCredit {
  let author = htmlToText(artistHtml);
  if (UNKNOWN_AUTHOR.test(author)) author = 'Auteur inconnu';
  const parts = [author, licenseLabel(license) || 'Licence libre', 'Wikimedia Commons'].filter(Boolean);
  let text = parts.join(' · ');
  if (text.length > CREDIT_MAX && author) {
    const tail = ` · ${parts.slice(1).join(' · ')}`;
    text = `${author.slice(0, Math.max(10, CREDIT_MAX - tail.length - 1)).trimEnd()}…${tail}`;
  }
  return { text, url };
}

function toItem(p: ApiPage): BankImage | null {
  const info = p.imageinfo?.[0];
  if (!info?.thumburl || !info.mime || !MIMES.has(info.mime)) return null;
  const meta = info.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? '';
  return {
    file: p.title,
    title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
    thumb: info.thumburl,
    width: info.width ?? 0,
    height: info.height ?? 0,
    license: licenseLabel(license),
    credit: buildCredit(meta.Artist?.value ?? '', license, info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`),
  };
}

async function callApi(params: Record<string, string>, signal?: AbortSignal): Promise<ApiResponse> {
  const u = new URL(API);
  const all: Record<string, string> = {
    action: 'query', format: 'json', formatversion: '2', origin: '*', uselang: 'fr',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName',
    iiextmetadatalanguage: 'fr', ...params,
  };
  for (const [k, v] of Object.entries(all)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { 'Api-User-Agent': AGENT }, signal });
  if (res.status === 429) throw new Error('Wikimedia Commons demande de patienter un peu avant une nouvelle recherche.');
  if (!res.ok) throw new Error(`Wikimedia Commons ne répond pas (${res.status}).`);
  return (await res.json()) as ApiResponse;
}

/** Une page de résultats pour des mots (en français ou en anglais) : photos et schémas. */
export async function searchCommons(query: string, offset = 0, signal?: AbortSignal): Promise<BankPage> {
  const q = query.trim();
  if (!q) return { items: [], next: null };
  const j = await callApi({
    generator: 'search', gsrsearch: `${q} filetype:bitmap|drawing`, gsrnamespace: '6',
    gsrlimit: String(PAGE_SIZE), gsroffset: String(offset), iiurlwidth: String(THUMB_W),
  }, signal);
  const pages = [...(j.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return {
    items: pages.map(toItem).filter((x): x is BankImage => x !== null),
    next: j.continue?.gsroffset ?? null,
  };
}

/** Télécharge l'image choisie en grand (1280 px au plus ; un schéma SVG arrive en PNG). */
export async function downloadCommonsImage(img: BankImage): Promise<File> {
  const j = await callApi({ titles: img.file, iiurlwidth: String(INSERT_W) });
  const url = j.query?.pages?.[0]?.imageinfo?.[0]?.thumburl ?? img.thumb;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image non téléchargée (${res.status}).`);
  const blob = await res.blob();
  const type = blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('gif') ? 'gif' : type.includes('webp') ? 'webp' : 'jpg';
  return new File([blob], `commons.${ext}`, { type });
}
