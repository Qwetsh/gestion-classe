/**
 * Réglages › Jeton d'import : créer, voir et révoquer les jetons qui permettent à Claude de
 * déposer des images, des cours et des écrans (migration 075, Edge Function `depot-cours`).
 * La valeur d'un jeton n'est montrée qu'une fois, à sa création.
 */
import { useCallback, useEffect, useState } from 'react';
import { ImportTokensUnavailable, createImportToken, listImportTokens, revokeImportToken, tokenIsLive, type ImportToken } from '../lib/importTokens';

const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Où ranger le jeton sur l'ordinateur (lu par le script d'envoi de la skill). */
const TOKEN_FILE = '%USERPROFILE%\\.gestion-classe\\jeton-import.txt';

export function ImportTokensPanel() {
  const [tokens, setTokens] = useState<ImportToken[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ token: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setTokens(await listImportTokens());
      setError(null);
    } catch (err) {
      if (err instanceof ImportTokensUnavailable) setUnavailable(true);
      else setError(err instanceof Error ? err.message : 'Lecture impossible');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createImportToken(label.trim());
      setFresh({ token: created.token, expiresAt: created.expiresAt });
      setCopied(false);
      setLabel('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (confirmRevoke !== id) { setConfirmRevoke(id); return; }
    setConfirmRevoke(null);
    setBusy(true);
    try {
      await revokeImportToken(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Révocation impossible');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.token);
      setCopied(true);
    } catch {
      setError('Copie impossible : sélectionnez le jeton à la main.');
    }
  };

  const live = (tokens ?? []).filter((t) => tokenIsLive(t));
  const dead = (tokens ?? []).filter((t) => !tokenIsLive(t));

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Jeton d’import</h3>
      <p className="text-xs text-[var(--text-muted)]">
        Un jeton permet à Claude, depuis cet ordinateur, de déposer dans l’application les images, les cours et les
        écrans qu’il prépare. Il ne donne aucun accès en lecture et n’écrit que dans votre espace. Vous pouvez le
        révoquer à tout moment.
      </p>

      {unavailable ? (
        <p className="text-xs text-[var(--neg)]">Cette fonction demande la migration 075, qui n’est pas encore appliquée.</p>
      ) : (
        <>
          {fresh && (
            <div className="rounded-lg border border-[var(--indigo)] bg-[var(--indigo-soft)] p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--text)]">
                Voici votre jeton. Il ne sera plus jamais affiché : copiez-le maintenant.
              </p>
              <code className="block text-xs break-all select-all rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5">{fresh.token}</code>
              <div className="flex items-center gap-2">
                <button type="button" onClick={copy} className="px-3 py-1.5 rounded-lg bg-[var(--indigo)] text-white text-xs font-medium">
                  {copied ? 'Copié' : 'Copier le jeton'}
                </button>
                <button type="button" onClick={() => setFresh(null)} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text)]">
                  C’est fait, masquer
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Collez-le, seul, dans le fichier <code className="break-all">{TOKEN_FILE}</code> (à créer). Ne le collez
                jamais dans une conversation. Valable jusqu’au {day(fresh.expiresAt)}.
              </p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-[var(--text-muted)]">
              Nom du jeton (pour le reconnaître)
              <input
                type="text"
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="PC de la maison"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)]"
              />
            </label>
            <button
              type="button"
              onClick={create}
              disabled={busy || tokens === null}
              className="px-4 py-2 rounded-lg bg-[var(--indigo)] text-white text-sm font-medium disabled:opacity-50"
            >
              Créer un jeton
            </button>
          </div>

          {error && <p className="text-xs text-[var(--neg)]" role="alert">{error}</p>}

          {tokens !== null && live.length === 0 && !fresh && (
            <p className="text-xs text-[var(--text-muted)]">Aucun jeton actif.</p>
          )}

          {live.length > 0 && (
            <ul className="space-y-2">
              {live.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{t.label || 'Jeton sans nom'}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Créé le {day(t.createdAt)} · {t.lastUsedAt ? `utilisé le ${day(t.lastUsedAt)}` : 'jamais utilisé'} · expire le {day(t.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(t.id)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50"
                    style={{
                      borderColor: confirmRevoke === t.id ? 'var(--neg)' : 'var(--border)',
                      color: confirmRevoke === t.id ? 'var(--neg)' : 'var(--text)',
                    }}
                  >
                    {confirmRevoke === t.id ? 'Confirmer' : 'Révoquer'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {dead.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              {dead.length} ancien{dead.length > 1 ? 's' : ''} jeton{dead.length > 1 ? 's' : ''} révoqué{dead.length > 1 ? 's' : ''} ou expiré{dead.length > 1 ? 's' : ''}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
