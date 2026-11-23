/**
 * Classeur ouvert aux classes (PLAN_classeur_eleves.md, lot 2) : le lien où une classe retrouve son
 * classeur sans compte, à poser dans Pronote. Qui a le lien voit ce que la classe a d'ouvert, et
 * rien d'autre. Le professeur l'active, le coupe ou le remplace (l'ancienne adresse ne répond plus).
 * Lot 3 : l'onglet « Classeur » de l'espace élève, ouvert par le code de l'élève.
 */
import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  binderAccessUnavailable, binderLinkUrl, fetchBinderAccess, newLinkToken, saveBinderAccess, updateBinderAccess, type BinderAccess,
} from '../../lib/binderReleaseQueries';

interface Props {
  userId: string;
  classId: string;
  className: string;
}

export function BinderLinkButton({ userId, classId, className }: Props) {
  const [open, setOpen] = useState(false);
  /** Accès lu pour une classe ; il ne vaut que pour elle. */
  const [loaded, setLoaded] = useState<{ classId: string; access: BinderAccess | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Remplacer le lien tue l'adresse posée dans Pronote : il faut le dire deux fois. */
  const [replacing, setReplacing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBinderAccess(classId).then(
      (access) => { if (!cancelled) setLoaded({ classId, access }); },
      (err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Lien illisible'); },
    );
    return () => { cancelled = true; };
  }, [classId]);

  // Fermeture : clic ailleurs, ou Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const ready = loaded?.classId === classId;
  const access = ready ? loaded.access : null;
  const live = !!access?.link_enabled && !!access.link_token;
  const tab = !!access?.tab_enabled;
  const url = access?.link_token ? binderLinkUrl(access.link_token) : '';

  const save = async (patch: Partial<Omit<BinderAccess, 'class_id'>>) => {
    setBusy(true);
    setError(null);
    setCopied(false);
    setReplacing(false);
    try {
      // La ligne existe déjà : on ne change que ce qui est demandé. « Réactiver » garde ainsi le jeton
      // qui est en base, même si le lien a été remplacé depuis un autre écran
      const saved = access ? await updateBinderAccess(classId, patch) : await saveBinderAccess(userId, classId, patch);
      setLoaded({ classId, access: saved });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Copie impossible : sélectionnez l’adresse et copiez-la à la main.');
    }
  };

  if (ready && binderAccessUnavailable()) return null;

  return (
    <div className="bd-link" ref={rootRef}>
      <button type="button" className="bd-btn" aria-expanded={open} aria-pressed={live || tab} onClick={() => setOpen((o) => !o)} title="Par où la classe retrouve son classeur : lien à poser dans Pronote, onglet de l’espace élève">
        <Link2 size={18} aria-hidden /> <span className="bd-hide-sm">{live && tab ? 'Lien et onglet actifs' : live ? 'Lien actif' : tab ? 'Onglet actif' : 'Accès des élèves'}</span>
      </button>
      {open && (
        <div className="bd-link__panel" role="dialog" aria-label={`Accès des élèves au classeur de la ${className}`}>
          <p className="bd-link__title">Lien pour Pronote</p>
          {!ready && !error && <p className="bd-link__text">Lecture…</p>}
          {ready && !live && (
            <>
              <p className="bd-link__text">
                Avec ce lien, sans compte ni code, on voit ce que vous avez ouvert à la {className} dans le classeur, et rien d’autre.
                Il ne montre aucune donnée personnelle.
              </p>
              <button type="button" className="bd-link__main" disabled={busy} onClick={() => void save(access?.link_token ? { link_enabled: true } : { link_token: newLinkToken(), link_enabled: true })}>
                {access?.link_token ? 'Réactiver le lien' : 'Créer le lien'}
              </button>
            </>
          )}
          {ready && live && (
            <>
              <p className="bd-link__text">À poser dans Pronote. Qui a ce lien voit ce que vous avez ouvert à la {className}.</p>
              <input className="bd-link__url" readOnly value={url} aria-label="Adresse du classeur" onFocus={(e) => e.currentTarget.select()} />
              <div className="bd-link__row">
                <button type="button" className="bd-link__main" onClick={() => void copy()}>{copied ? 'Copié' : 'Copier le lien'}</button>
                <a className="bd-link__ghost" href={url} target="_blank" rel="noreferrer">Voir comme la {className}</a>
              </div>
              <div className="bd-link__row">
                <button type="button" className="bd-link__ghost" disabled={busy} onClick={() => void save({ link_enabled: false })} title="Le lien ne répond plus ; il pourra être réactivé">
                  Couper le lien
                </button>
                {!replacing && (
                  <button type="button" className="bd-link__ghost" disabled={busy} onClick={() => setReplacing(true)} title="L’adresse actuelle ne répondra plus : il faudra reposer la nouvelle dans Pronote">
                    Remplacer par un nouveau lien
                  </button>
                )}
              </div>
              {replacing && (
                <>
                  <p className="bd-link__text">Le lien actuel cessera de marcher partout où il est posé (Pronote, messages). Il faudra y mettre le nouveau.</p>
                  <div className="bd-link__row">
                    <button type="button" className="bd-link__main" disabled={busy} onClick={() => void save({ link_token: newLinkToken(), link_enabled: true })}>Remplacer le lien</button>
                    <button type="button" className="bd-link__ghost" disabled={busy} onClick={() => setReplacing(false)}>Annuler</button>
                  </div>
                </>
              )}
            </>
          )}
          {ready && (
            <>
              <p className="bd-link__title bd-link__title--next">Espace élève</p>
              <p className="bd-link__text">
                {tab
                  ? `Les élèves de la ${className} ont un onglet « Classeur » dans leur espace (code à 6 chiffres).`
                  : `Ajoute un onglet « Classeur » dans l’espace élève de la ${className} (code à 6 chiffres). L’élève témoin le voit dès que vous avez ouvert quelque chose à la classe.`}
              </p>
              <button type="button" className={tab ? 'bd-link__ghost' : 'bd-link__main'} disabled={busy} onClick={() => void save({ tab_enabled: !tab })}>
                {tab ? 'Retirer l’onglet' : 'Ouvrir l’onglet'}
              </button>
            </>
          )}
          {error && <p className="bd-link__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
