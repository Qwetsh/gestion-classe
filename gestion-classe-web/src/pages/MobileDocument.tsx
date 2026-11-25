/**
 * Version couleur d'un document imprimé : page publique `/d/<jeton>`, celle du QR code posé en haut
 * de la première page (lib/mobileVersion.ts). Sans compte : le jeton désigne un document, et le
 * serveur (Edge Function `version-mobile`) ne rend que son texte et ses images, jamais une
 * correction ni une évaluation. Lecture seule, sur une colonne de téléphone, zoom du doigt permis.
 *
 * Le document est lu en direct : il est relu quand on revient sur la page après un moment (le
 * professeur a pu le modifier ; les adresses de ses images ne vivent que quelques heures).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CoursePhoneDoc } from '../components/course/CoursePhoneDoc';
import { setSeededUrlsOnly } from '../lib/boardMedia';
import { MOBILE_TOKEN } from '../lib/mobileVersion';
import { MobileDocError, fetchMobileDoc, type MobileDocument as Loaded } from '../lib/mobileVersionQueries';

/** Âge au-delà duquel le document est relu au retour sur la page. */
const STALE_MS = 60 * 1000;

function errorMessage(kind: MobileDocError['kind']): { title: string; text: string } {
  if (kind === 'forbidden') return { title: 'Ce lien ne fonctionne plus.', text: 'Demande la fiche à ton professeur.' };
  if (kind === 'not_found') return { title: 'Ce document n’est plus disponible.', text: 'Demande la fiche à ton professeur.' };
  if (kind === 'network') return { title: 'Pas de connexion.', text: 'Vérifie ta connexion à Internet, puis recharge la page.' };
  return { title: 'Le document ne répond pas pour le moment.', text: 'Réessaie dans quelques minutes.' };
}

export function MobileDocument() {
  const { token = '' } = useParams();
  const [loaded, setLoaded] = useState<{ token: string; at: number; value: Loaded } | null>(null);
  const [failed, setFailed] = useState<{ token: string; kind: MobileDocError['kind'] } | null>(null);
  /** Relecture : change quand on revient sur la page après un moment. */
  const [round, setRound] = useState(0);

  // L'adresse porte le jeton : ni indexation, ni adresse transmise aux sites ouverts depuis le document
  useEffect(() => {
    const metas = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => { for (const meta of metas) meta.remove(); };
  }, []);

  // Seules les adresses d'images fournies par le serveur servent (un professeur connecté voit ce que voient ses élèves)
  useEffect(() => {
    setSeededUrlsOnly(true);
    return () => setSeededUrlsOnly(false);
  }, []);

  // Jeton mal formé (adresse recopiée à la main) : même message qu'un lien coupé, sans appel
  const malformed = !MOBILE_TOKEN.test(token);

  useEffect(() => {
    if (malformed) return;
    let cancelled = false;
    const readAt = Date.now();
    fetchMobileDoc(token).then(
      (value) => { if (!cancelled) { setLoaded({ token, at: readAt, value }); setFailed(null); } },
      (err: unknown) => { if (!cancelled) setFailed({ token, kind: err instanceof MobileDocError ? err.kind : 'server' }); },
    );
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - readAt > STALE_MS) setRound((n) => n + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, [token, malformed, round]);

  const current = loaded?.token === token ? loaded : null;
  // Une relecture ratée ne retire pas le document déjà affiché, sauf un lien coupé entre-temps
  const error = malformed ? errorMessage('forbidden') : failed?.token === token && (!current || failed.kind === 'forbidden' || failed.kind === 'not_found') ? errorMessage(failed.kind) : null;
  const title = current?.value.title ?? '';

  useEffect(() => {
    const before = document.title;
    document.title = title ? `${title} — version couleur` : 'Version couleur';
    return () => { document.title = before; };
  }, [title]);

  return (
    <div className="mdoc">
      <header className="mdoc__bar">
        <h1 className="mdoc__title">{error ? '' : title}</h1>
        <span className="mdoc__tag">Version couleur</span>
      </header>
      {error ? (
        <p className="mdoc__message" role="alert"><strong>{error.title}</strong>{error.text}</p>
      ) : current ? (
        <main className="mdoc__body">
          <CoursePhoneDoc key={`${current.token}:${current.at}`} doc={current.value.doc} title={title} />
        </main>
      ) : (
        <p className="mdoc__message">Ouverture du document…</p>
      )}
    </div>
  );
}
