/**
 * Version couleur d'un document imprimé : page publique `/d/<jeton>`, celle du QR code posé en haut
 * de la première page (lib/mobileVersion.ts). Sans compte : le jeton désigne un document, et le
 * serveur (Edge Function `version-mobile`) ne rend que son texte et ses images, jamais une
 * correction ni une évaluation. Lecture seule, sur une colonne de téléphone, zoom du doigt permis.
 *
 * Le document est lu en direct : il est relu quand on revient sur la page après un moment (le
 * professeur a pu le modifier ; les adresses de ses images ne vivent que quelques heures).
 *
 * La même page sert le lien de partage en lecture seule (migration 092) que le professeur colle
 * dans le cahier de texte. Deux vues : « Téléphone » (une colonne) et « Pages A4 » (les feuilles
 * telles qu'imprimées) ; « Imprimer » imprime toujours les feuilles A4, ou les enregistre en PDF
 * depuis la fenêtre d'impression du navigateur.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { CoursePhoneDoc } from '../components/course/CoursePhoneDoc';
import { CourseA4Doc } from '../components/course/CourseA4Doc';
import { printPages, sheetPrintPages, whenSettled } from '../lib/binderPrint';
import '../styles/classeur-eleves.css';
import { setSeededUrlsOnly } from '../lib/boardMedia';
import { MOBILE_TOKEN } from '../lib/mobileVersion';
import { MobileDocError, fetchMobileDoc, type MobileDocument as Loaded } from '../lib/mobileVersionQueries';

/** Âge au-delà duquel le document est relu au retour sur la page. */
const STALE_MS = 60 * 1000;

/** Largeur d'écran à partir de laquelle un lien de partage s'ouvre en pages A4 (ordinateur, tablette). */
const WIDE = 820;

type View = 'phone' | 'a4';

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
  /** Vue choisie ; null : celle par défaut (pages A4 pour un lien de partage sur grand écran). */
  const [chosen, setChosen] = useState<View | null>(null);
  const [printing, setPrinting] = useState(false);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const a4Ref = useRef<HTMLDivElement>(null);

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
  const share = current?.value.kind === 'share';
  const tag = share ? 'Lecture seule' : 'Version couleur';
  const view: View = chosen ?? (share && window.innerWidth >= WIDE ? 'a4' : 'phone');

  useEffect(() => {
    const before = document.title;
    document.title = title ? `${title} — ${tag.toLowerCase()}` : tag;
    return () => { document.title = before; };
  }, [title, tag]);

  /** Imprime les feuilles A4 (en passant d'abord sur la vue A4, mise en page attendue). */
  const print = async () => {
    setPrinting(true);
    setChosen('a4');
    // La vue A4 doit être montée et mise en page (images chargées) avant la copie des feuilles
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const root = a4Ref.current;
    if (root) await whenSettled(root, () => !!sheetsRef.current, 6000);
    setPrinting(false);
    const sheets = sheetsRef.current;
    if (sheets) printPages(sheetPrintPages(sheets), title || 'Document');
  };

  return (
    <div className="mdoc">
      <header className="mdoc__bar">
        <h1 className="mdoc__title">{error ? '' : title}</h1>
        {!error && current && (
          <>
            <div className="mdoc__views" role="group" aria-label="Affichage">
              <button type="button" aria-pressed={view === 'phone'} onClick={() => setChosen('phone')}>Téléphone</button>
              <button type="button" aria-pressed={view === 'a4'} onClick={() => setChosen('a4')}>Pages A4</button>
            </div>
            <button type="button" className="mdoc__print" disabled={printing} onClick={() => void print()} title="Imprimer les pages A4, ou les enregistrer en PDF (choisir « Enregistrer au format PDF » dans la fenêtre d’impression)">
              <Printer size={16} aria-hidden /> {printing ? 'Préparation…' : 'Imprimer / PDF'}
            </button>
          </>
        )}
        <span className={share ? 'mdoc__tag mdoc__tag--share' : 'mdoc__tag'}>{tag}</span>
      </header>
      {error ? (
        <p className="mdoc__message" role="alert"><strong>{error.title}</strong>{error.text}</p>
      ) : current ? (
        view === 'a4' ? (
          <main ref={a4Ref} className="mdoc__body mdoc__body--a4">
            <CourseA4Doc key={`${current.token}:${current.at}`} doc={current.value.doc} title={title} sheetsRef={sheetsRef} />
          </main>
        ) : (
          <main className="mdoc__body">
            <CoursePhoneDoc key={`${current.token}:${current.at}`} doc={current.value.doc} title={title} />
          </main>
        )
      ) : (
        <p className="mdoc__message">Ouverture du document…</p>
      )}
    </div>
  );
}
