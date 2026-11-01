import { useEffect, useRef, useState } from 'react';
import {
  describeDepotError,
  draftId,
  fetchDepotInfo,
  preparePage,
  uploadDepotPage,
  type DepotInfo,
  type DraftPage,
} from '../lib/copyUpload';

/**
 * Page publique ouverte par le QR code de « Ajouter une copie » (migration 058) : le téléphone
 * photographie les pages et les envoie à l'Edge Function depot-copie avec le jeton du lien
 * (dans le fragment #, jamais envoyé au serveur web). Pas de connexion, pas de liste d'élèves :
 * on ne voit que le pseudo, la classe et le nom de l'éval.
 */
export function CopyDepot() {
  const token = window.location.hash.replace(/^#/, '');
  const [info, setInfo] = useState<DepotInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftPage[]>([]);
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setError('Lien incomplet : scanne de nouveau le QR code affiché sur l’ordinateur.');
      return;
    }
    fetchDepotInfo(token)
      .then(setInfo)
      .catch((e) => setError(describeDepotError(e instanceof Error ? e.message : 'unknown')));
  }, [token]);

  const add = (files: FileList | null) => {
    if (!files) return;
    const more = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ id: draftId(), source: f, turns: 0, preview: URL.createObjectURL(f) }));
    setDrafts((prev) => [...prev, ...more]);
  };

  const left = info ? info.max_pages - info.pages_uploaded - sent : 0;

  const send = async () => {
    setSending(0);
    setError(null);
    let ok = 0;
    try {
      for (const d of drafts) {
        await uploadDepotPage(token, await preparePage(d.source, d.turns));
        ok += 1;
        setSending(ok);
        URL.revokeObjectURL(d.preview);
      }
      setDrafts([]);
    } catch (e) {
      setDrafts((prev) => prev.slice(ok));
      setError(describeDepotError(e instanceof Error ? e.message : 'unknown'));
    } finally {
      setSent((s) => s + ok);
      setSending(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f6f6f4)', color: 'var(--text, #1d1d1b)', fontFamily: 'inherit', padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted, #666)', fontWeight: 600 }}>Gestion Classe · envoi d’une copie</div>

        {info && (
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface, #fff)', border: '1px solid var(--border, #ddd)' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Copie de {info.pseudo}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #666)' }}>
              {info.class_name} · {info.assessment_name}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--neg-soft, #fde8e8)', color: 'var(--neg, #b42318)', fontSize: 14 }}>{error}</div>
        )}

        {info && (
          <>
            <button
              onClick={() => input.current?.click()}
              disabled={left - drafts.length <= 0 || sending !== null}
              style={{ ...big, background: 'var(--indigo, #4f46e5)', color: '#fff', opacity: left - drafts.length <= 0 ? 0.5 : 1 }}
            >
              📷 Photographier une page
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => { add(e.target.files); e.target.value = ''; }}
            />

            {drafts.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {drafts.map((d, i) => (
                  <div key={d.id} style={{ textAlign: 'center' }}>
                    <div style={{ aspectRatio: '3 / 4', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #ddd)', display: 'grid', placeItems: 'center', background: '#eee' }}>
                      <img src={d.preview} alt={`page ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', transform: `rotate(${d.turns * 90}deg)` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => setDrafts((prev) => prev.map((x) => (x.id === d.id ? { ...x, turns: x.turns + 1 } : x)))}
                        style={small}
                        aria-label="Tourner"
                      >
                        ⟳
                      </button>
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(d.preview);
                          setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                        }}
                        style={small}
                        aria-label="Retirer"
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #666)' }}>Page {i + 1}</div>
                  </div>
                ))}
              </div>
            )}

            {drafts.length > 0 && (
              <button onClick={send} disabled={sending !== null} style={{ ...big, background: 'var(--pos, #15803d)', color: '#fff' }}>
                {sending !== null ? `Envoi… ${sending}/${drafts.length}` : `Envoyer ${drafts.length} page(s)`}
              </button>
            )}

            {sent > 0 && drafts.length === 0 && (
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--pos-soft, #e7f6ec)', color: 'var(--pos, #15803d)', fontSize: 14 }}>
                {sent} page(s) envoyée(s). Tu peux en ajouter d’autres, ou fermer cette page.
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>
              Encore {Math.max(0, left)} page(s) possible(s). Le lien expire 15 minutes après l’ouverture du QR code.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const big: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const small: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border, #ddd)', background: 'var(--surface, #fff)', fontSize: 14, cursor: 'pointer',
};
