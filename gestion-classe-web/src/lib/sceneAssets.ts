/**
 * Ce qu'il faut aux scènes riches du tableau (voir lib/boardAnimation) : leurs bibliothèques,
 * servies par l'application, et leurs fichiers joints, lus dans le stockage du tableau.
 * Les deux sont gardés en mémoire : une scène rouverte ou copiée ne relit rien.
 */
import { isSceneLib } from './boardAnimation';
import { signedUrl } from './boardMedia';

const libs = new Map<string, Promise<string>>();

/** Source d'une bibliothèque de scène (public/scene-libs/<nom>.js). */
export function loadSceneLib(name: string): Promise<string> {
  if (!isSceneLib(name)) return Promise.reject(new Error(`bibliothèque inconnue : ${name}`));
  let p = libs.get(name);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}scene-libs/${name}.js`).then((r) => {
      if (!r.ok) throw new Error(`bibliothèque ${name} : ${r.status}`);
      return r.text();
    });
    p.catch(() => libs.delete(name));
    libs.set(name, p);
  }
  return p;
}

export interface LoadedAsset { buffer: ArrayBuffer; type: string }

const assets = new Map<string, Promise<LoadedAsset>>();
const ASSETS_MAX = 24;

/**
 * Octets d'un fichier joint, par son chemin de stockage. En développement seulement, un chemin
 * « dev:<fichier> » lit public/<fichier> (essais sans écrire dans le stockage).
 */
export function loadSceneAsset(path: string): Promise<LoadedAsset> {
  let p = assets.get(path);
  if (!p) {
    p = (async () => {
      const url = import.meta.env.DEV && path.startsWith('dev:') ? `${import.meta.env.BASE_URL}${path.slice(4)}` : await signedUrl(path);
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fichier joint ${path} : ${r.status}`);
      return { buffer: await r.arrayBuffer(), type: r.headers.get('content-type') ?? '' };
    })();
    p.catch(() => assets.delete(path));
    if (assets.size >= ASSETS_MAX) assets.delete(assets.keys().next().value as string);
    assets.set(path, p);
  }
  return p;
}
