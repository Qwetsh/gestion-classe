/**
 * Version mobile du document, dans la barre de titre de l'éditeur : « automatique » (la page du QR
 * code est faite par l'application) ou « sur mesure » (une page déposée par Claude, migration 093,
 * skill version-mobile). Quand le document a changé depuis le dépôt, la page sur mesure ne suit pas :
 * « plus ancienne que le document », avec trois actions : Garder (elle convient encore), Revenir à
 * l'automatique (elle est retirée), Voir (la page du QR code, dans un nouvel onglet).
 *
 * Une copie posée sur l'emploi du temps montre la version de son original (c'est lui que sert le QR
 * code). Rien n'est affiché pour une correction ou une évaluation (pas de QR code), ni si la
 * migration 093 manque.
 */
import { useEffect, useRef, useState } from 'react';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { customState, mobileUrl } from '../../lib/mobileVersion';
import { currentFingerprint, customVersionsUnavailable, fetchCustomVersion, keepCustomVersion, removeCustomVersion, type CustomVersion } from '../../lib/mobileVersionQueries';

interface Props {
  boardId: string;
  /** Original visé par le QR code (null : pas de version mobile pour ce document). */
  target: string | null;
  /** Jeton du QR code (null : pas encore imprimé). */
  token: string | null;
  /** État d'enregistrement de l'éditeur : l'original est revu après chaque enregistrement. */
  save: string;
}

type Info = { target: string; custom: CustomVersion | null; current: string | null };

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function CourseMobileStatus({ boardId, target, token, save }: Props) {
  const { toast, confirm } = useUIFeedback();
  const [info, setInfo] = useState<Info | null>(null);
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    fetchCustomVersion(target)
      .then(async (custom) => ({ target, custom, current: custom ? await currentFingerprint(target) : null }))
      .then((v) => { if (!cancelled) setInfo(v); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInfo(null);
        console.warn('[mobileVersion] version sur mesure illisible', err);
      });
    return () => { cancelled = true; };
  }, [target, round]);

  // L'original vient d'être enregistré dans cet éditeur : son empreinte a pu changer
  const hasCustom = !!info?.custom;
  useEffect(() => {
    if (save !== 'saved' || !hasCustom || target !== boardId) return;
    const id = window.setTimeout(() => setRound((n) => n + 1), 1500);
    return () => window.clearTimeout(id);
  }, [save, hasCustom, target, boardId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!target || !info || info.target !== target || customVersionsUnavailable()) return null;

  if (!info.custom) {
    return (
      <span className="ce-mstatus" title="Le QR code des feuilles imprimées ouvre la version faite automatiquement par l’application. Une version sur mesure se fait avec Claude (skill version-mobile).">
        Version mobile : automatique
      </span>
    );
  }

  const custom = info.custom;
  const stale = customState(custom.docFingerprint, info.current) === 'stale';

  const keep = async () => {
    setBusy(true);
    try {
      const fingerprint = await keepCustomVersion(info.target);
      if (fingerprint) setInfo({ ...info, custom: { ...custom, docFingerprint: fingerprint, checkedAt: new Date().toISOString() }, current: fingerprint });
      setOpen(false);
    } catch (err) {
      console.warn('[mobileVersion] « Garder » impossible', err);
      toast('La version mobile n’a pas pu être mise à jour. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setOpen(false);
    const ok = await confirm({
      title: 'Revenir à la version automatique ?',
      message: 'La page sur mesure est retirée : le QR code des feuilles imprimées ouvrira de nouveau la version faite par l’application. Pour la retrouver, il faudra la déposer à nouveau.',
      confirmLabel: 'Revenir à l’automatique',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeCustomVersion(info.target);
      setInfo({ ...info, custom: null, current: null });
    } catch (err) {
      console.warn('[mobileVersion] retrait impossible', err);
      toast('La version sur mesure n’a pas pu être retirée. Réessayez dans un instant.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ce-mstatus-box" ref={boxRef}>
      <button
        type="button"
        className={stale ? 'ce-chip ce-chip--warn ce-mstatus-chip' : 'ce-chip ce-mstatus-chip ce-mstatus-chip--ok'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`Version mobile sur mesure, déposée le ${when(custom.depositedAt)}`}
      >
        {stale ? 'Version mobile : plus ancienne que le document' : 'Version mobile : sur mesure'}
      </button>
      {open && (
        <div className="ce-mstatus-pop" role="dialog" aria-label="Version mobile">
          <p>Sur mesure, déposée le {when(custom.depositedAt)}.</p>
          {stale && <p className="ce-mstatus-pop__warn">Le document a été modifié depuis : la page du téléphone ne suit pas les retouches.</p>}
          {info.target !== boardId && <p className="ce-mstatus-pop__hint">C’est celle de l’original de la bibliothèque.</p>}
          <div className="ce-mstatus-pop__actions">
            {token && <a className="ce-btn" href={mobileUrl(token)} target="_blank" rel="noreferrer">Voir</a>}
            {stale && <button type="button" className="ce-btn ce-btn--primary" disabled={busy} onClick={() => void keep()} title="Elle convient encore au document tel qu’il est">Garder</button>}
            <button type="button" className="ce-btn" disabled={busy} onClick={() => void revert()}>Revenir à l’automatique</button>
          </div>
        </div>
      )}
    </div>
  );
}
