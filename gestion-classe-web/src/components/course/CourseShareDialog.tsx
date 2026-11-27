/**
 * Fenêtre « Partager en lecture seule » : le lien d'un document à coller dans le cahier de texte
 * (Pronote, ENT). Qui l'ouvre, sans compte, lit le document sur son téléphone ou en feuilles A4, et
 * peut l'imprimer ou l'enregistrer en PDF (page publique `/d/<jeton>`, pages/MobileDocument.tsx).
 *
 * Un lien par original de la bibliothèque (table `board_share_links`, migration 092), créé au
 * premier partage, coupable à tout moment. Une correction ou une évaluation peut être partagée ;
 * une copie modèle, jamais (règles : supabase/functions/version-mobile/rules.ts).
 * Le lien suit le document : une modification se voit à la prochaine ouverture du lien.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { mobileUrl } from '../../lib/mobileVersion';
import { ShareUnavailableError, deleteShareToken, ensureShareToken, findShareToken, resolveLinkTarget } from '../../lib/mobileVersionQueries';
import './course.css';

interface Props {
  boardId: string;
  userId: string;
  title: string;
  onClose: () => void;
}

type State =
  | { step: 'loading' }
  | { step: 'refused' }
  | { step: 'unavailable' }
  | { step: 'error' }
  | { step: 'ready'; target: string; token: string | null };

const isCorrection = (title: string) => /corr(?:ection|ig[ée])/iu.test(title.normalize('NFC'));
const isAssessment = (title: string) => /[ée]valuation|entra[îi]nements?\s+not[ée]s?|contr[ôo]les?|interro(?:gation)?s?|devoirs?|^\s*ds(?![\p{L}])/iu.test(title.normalize('NFC'));

/** Copie dans le presse-papiers ; repli sur la sélection du champ (navigateur sans accès au presse-papiers). */
async function copyText(text: string, field: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!field) return false;
    field.select();
    try { return document.execCommand('copy'); } catch { return false; }
  }
}

export function CourseShareDialog({ boardId, userId, title, onClose }: Props) {
  const [state, setState] = useState<State>({ step: 'loading' });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmCut, setConfirmCut] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const fail = useCallback((err: unknown) => {
    if (err instanceof ShareUnavailableError) setState({ step: 'unavailable' });
    else { console.warn('[partage] lien illisible', err); setState({ step: 'error' }); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveLinkTarget('share', boardId, title)
      .then(async (target) => (target ? { target, token: await findShareToken(target) } : null))
      .then((r) => { if (!cancelled) setState(r ? { step: 'ready', ...r } : { step: 'refused' }); })
      .catch((err: unknown) => { if (!cancelled) fail(err); });
    return () => { cancelled = true; };
  }, [boardId, title, fail]);

  const url = state.step === 'ready' && state.token ? mobileUrl(state.token) : '';

  const copy = async (text: string) => {
    if (await copyText(text, fieldRef.current)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  const create = async () => {
    if (state.step !== 'ready') return;
    setBusy(true);
    try {
      const token = await ensureShareToken(userId, state.target);
      setState({ ...state, token });
      await copy(mobileUrl(token));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const cut = async () => {
    if (state.step !== 'ready') return;
    setBusy(true);
    try {
      await deleteShareToken(state.target);
      setState({ ...state, token: null });
      setConfirmCut(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ce-modal" onMouseDown={onClose}>
      <div className="ce-dialog ce-shared" role="dialog" aria-label="Partager en lecture seule" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="ce-dialog__title">Partager en lecture seule</h3>

        {state.step === 'loading' && <p className="ce-dialog__hint">Lecture du lien…</p>}

        {state.step === 'refused' && (
          <p className="ce-shared__warn">
            Une copie modèle ne se partage pas par un lien : ce sont les réponses d’un élève.
          </p>
        )}

        {state.step === 'unavailable' && (
          <p className="ce-shared__warn">Le partage n’est pas encore activé sur le serveur (migration 092 à appliquer).</p>
        )}

        {state.step === 'error' && <p className="ce-shared__warn">Le lien n’a pas pu être lu. Réessayez dans un instant.</p>}

        {state.step === 'ready' && (
          <>
            <p className="ce-dialog__hint">
              Les élèves ouvrent ce lien sans compte : ils lisent le document sur leur téléphone ou en pages A4, et peuvent l’imprimer ou l’enregistrer en PDF. Ils ne peuvent rien modifier. Le lien montre toujours la dernière version du document.
            </p>
            {state.target !== boardId && (
              <p className="ce-dialog__hint">Ce cours est une copie posée sur l’emploi du temps : le lien ouvre son original de la bibliothèque.</p>
            )}
            {isCorrection(title) ? (
              <p className="ce-shared__warn">C’est une correction : ne collez le lien que lorsque vous voulez la donner aux élèves.</p>
            ) : isAssessment(title) && (
              <p className="ce-shared__warn">C’est une évaluation : ne collez le lien qu’après l’avoir faite en classe.</p>
            )}

            {state.token ? (
              <>
                <div className="ce-shared__link">
                  <input ref={fieldRef} className="ce-input" readOnly value={url} aria-label="Adresse du lien" onFocus={(e) => e.currentTarget.select()} />
                  <button type="button" className="ce-btn ce-btn--primary" onClick={() => void copy(url)}>{copied ? 'Copié' : 'Copier'}</button>
                </div>
                <div className="ce-dialog__foot">
                  {confirmCut ? (
                    <>
                      <span className="ce-shared__confirm">L’adresse déjà collée ne mènera plus à rien.</span>
                      <button type="button" className="ce-btn" onClick={() => setConfirmCut(false)}>Garder</button>
                      <button type="button" className="ce-btn ce-btn--danger" disabled={busy} onClick={() => void cut()}>Couper le lien</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="ce-btn" onClick={() => setConfirmCut(true)} title="L’adresse ne fonctionnera plus ; un prochain partage en créera une autre. Le QR code des feuilles imprimées n’est pas touché.">Couper le lien</button>
                      <a className="ce-btn" href={url} target="_blank" rel="noreferrer">Ouvrir</a>
                      <span className="ce-spacer-flex" />
                      <button type="button" className="ce-btn" onClick={onClose}>Fermer</button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="ce-dialog__foot">
                <span className="ce-spacer-flex" />
                <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
                <button type="button" className="ce-btn ce-btn--primary" disabled={busy} onClick={() => void create()}>{busy ? 'Création…' : 'Créer et copier le lien'}</button>
              </div>
            )}
            {copied && <p className="ce-shared__ok" role="status">Lien copié : collez-le dans le cahier de texte.</p>}
          </>
        )}

        {state.step !== 'ready' && state.step !== 'loading' && (
          <div className="ce-dialog__foot">
            <span className="ce-spacer-flex" />
            <button type="button" className="ce-btn" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
