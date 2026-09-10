/**
 * Format natif du tableau blanc : `.gcboard` = archive ZIP.
 *
 *   board.json   pages et objets (schemaVersion pour les migrations de lecture)
 *   meta.json    titre, date, application
 *   assets/      images référencées (fonds de page, objets image, couvertures de tickets)
 *
 * À l'export, les chemins du bucket sont remplacés par `assets/…` ; à l'import, les fichiers
 * sont renvoyés dans le bucket de l'utilisateur et les chemins réécrits, avec de nouveaux
 * identifiants partout (on peut importer deux fois le même fichier sans collision).
 */
import JSZip from 'jszip';
import { supabase } from './supabase';
import { BOARD_BUCKET, type BoardPage } from './boardRender';
import { migrateLegacyTexts, objectId, type BoardObject } from './boardObjects';

export const GCBOARD_VERSION = 2;
export const GCBOARD_EXTENSION = '.gcboard';

export interface GcboardMeta {
  title: string;
  exportedAt: string;
  app: 'gestion-classe';
  pageCount: number;
}

interface BoardJson {
  schemaVersion: number;
  pages: BoardPage[];
}

export const isGcboardFile = (f: File) => f.name.toLowerCase().endsWith(GCBOARD_EXTENSION);

/** Tous les chemins d'images référencés par une page. */
function imagePaths(page: BoardPage): string[] {
  const paths: string[] = [];
  if (page.image?.path) paths.push(page.image.path);
  for (const o of page.objects ?? []) {
    if (o.type === 'image') paths.push(o.path);
    if (o.cover?.imagePath) paths.push(o.cover.imagePath);
  }
  return paths;
}

/** Page avec ses chemins d'images remplacés selon `map`. */
function remapPaths(page: BoardPage, map: Map<string, string>): BoardPage {
  const m = (p: string) => map.get(p) ?? p;
  return {
    ...page,
    image: page.image ? { ...page.image, path: m(page.image.path) } : page.image,
    objects: (page.objects ?? []).map((o): BoardObject => {
      const next: BoardObject = o.type === 'image' ? { ...o, path: m(o.path) } : { ...o };
      if (next.cover?.imagePath) next.cover = { ...next.cover, imagePath: m(next.cover.imagePath) };
      return next;
    }),
  };
}

export async function exportGcboard(pages: BoardPage[], title: string): Promise<Blob> {
  const zip = new JSZip();
  const map = new Map<string, string>();
  const assets = zip.folder('assets');
  let n = 0;
  for (const page of pages) {
    for (const path of imagePaths(page)) {
      if (map.has(path)) continue;
      const { data, error } = await supabase.storage.from(BOARD_BUCKET).download(path);
      if (error || !data) {
        console.warn('[boardFile] image absente à l\'export :', path, error);
        continue;
      }
      const ext = data.type === 'image/png' ? 'png' : 'jpg';
      const name = `assets/${String(++n).padStart(3, '0')}.${ext}`;
      assets?.file(name.slice('assets/'.length), data);
      map.set(path, name);
    }
  }
  const board: BoardJson = { schemaVersion: GCBOARD_VERSION, pages: pages.map((p) => remapPaths(p, map)) };
  const meta: GcboardMeta = { title, exportedAt: new Date().toISOString(), app: 'gestion-classe', pageCount: pages.length };
  zip.file('board.json', JSON.stringify(board));
  zip.file('meta.json', JSON.stringify(meta, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Lit un `.gcboard` et renvoie ses pages, prêtes à être insérées : images renvoyées dans le
 * bucket sous `userId/sessionId/…`, identifiants neufs, anciens champs migrés.
 */
export async function importGcboard(file: File, userId: string, sessionId: string, onProgress?: (label: string) => void): Promise<{ pages: BoardPage[]; meta: GcboardMeta | null }> {
  const zip = await JSZip.loadAsync(file);
  const boardEntry = zip.file('board.json');
  if (!boardEntry) throw new Error("Ce fichier n'est pas un tableau (board.json manquant)");
  const board = JSON.parse(await boardEntry.async('string')) as Partial<BoardJson>;
  if (!Array.isArray(board.pages)) throw new Error('Tableau illisible (pages manquantes)');
  if ((board.schemaVersion ?? 0) > GCBOARD_VERSION) throw new Error('Ce tableau vient d\'une version plus récente de l\'application');
  let meta: GcboardMeta | null = null;
  const metaEntry = zip.file('meta.json');
  if (metaEntry) { try { meta = JSON.parse(await metaEntry.async('string')) as GcboardMeta; } catch { meta = null; } }

  // Images : renvoyées dans le bucket, chemins réécrits
  const map = new Map<string, string>();
  const entries = Object.keys(zip.files).filter((n) => n.startsWith('assets/') && !zip.files[n].dir);
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i];
    onProgress?.(`Image ${i + 1} / ${entries.length}`);
    const blob = await zip.files[name].async('blob');
    const ext = name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const path = `${userId}/${sessionId}/${objectId()}.${ext}`;
    const { error } = await supabase.storage.from(BOARD_BUCKET).upload(path, blob, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
    if (error) throw error;
    map.set(name, path);
  }

  const pages: BoardPage[] = board.pages.map((raw) => {
    const page = remapPaths({ ...raw, objects: migrateLegacyTexts(raw.objects, raw.texts), texts: undefined }, map);
    return {
      ...page,
      id: objectId(),
      strokes: (page.strokes ?? []).map((s) => ({ ...s, id: objectId() })),
      objects: page.objects.map((o) => ({ ...o, id: objectId() })),
    };
  });
  return { pages, meta };
}

/** Déclenche le téléchargement d'un blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeFileName = (name: string) => name.replace(/[^\w\dÀ-ÿ -]+/g, '').trim() || 'tableau';
