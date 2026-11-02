import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  describeDepotError,
  draftId,
  fetchDepotInfo,
  preparePage,
  uploadDepotPage,
  type DepotInfo,
  type DepotTarget,
  type DraftPage,
} from '../lib/copyUpload';

/** Copie en cours, avec un jeton de classe : un élève, ou une copie « Pas de nom ». */
type Target = { kind: 'student'; id: string; pseudo: string } | { kind: 'unnamed'; copyId: string | null };

/**
 * Page publique ouverte par le QR code (migration 058) : le téléphone photographie les pages et
 * les envoie à l'Edge Function depot-copie avec le jeton du lien (dans le fragment #, jamais
 * envoyé au serveur web). Pas de connexion.
 *
 * Jeton d'un élève : on ne voit que son pseudo, la classe et le nom de l'éval.
 * Jeton de classe (migration 061, « Ajouter les copies de la classe ») : la liste des élèves de
 * l'éval (sans copie d'abord) ; on choisit l'élève, on photographie, « Élève suivant ». Une copie
 * sans nom lisible part en « Pas de nom », à identifier ensuite sur l'ordinateur.
 */
export function CopyDepot() {
  const token = window.location.hash.replace(/^#/, '');
  const [info, setInfo] = useState<DepotInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftPage[]>([]);
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState(0);
  // Jeton de classe : copie en cours, et pages envoyées depuis ce téléphone (par élève).
  const [target, setTarget] = useState<Target | null>(null);
  const [sentBy, setSentBy] = useState<Record<string, number>>({});
  const [justSent, setJustSent] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    () =>
      fetchDepotInfo(token)
        .then(setInfo)
        .catch((e) => setError(describeDepotError(e instanceof Error ? e.message : 'unknown'))),
    [token],
  );

  useEffect(() => {
    if (!token) {
      setError('Lien incomplet : scanne de nouveau le QR code affiché sur l’ordinateur.');
      return;
    }
    refresh();
  }, [token, refresh]);

  const isClass = info?.mode === 'class';
  const pagesOf = (s: { id: string; pages: number }) => s.pages + (sentBy[s.id] ?? 0);
  // Sans copie d'abord, puis par ordre alphabétique (déjà fourni par la fonction).
  const students = useMemo(() => {
    const list = info?.students ?? [];
    return [...list.filter((s) => pagesOf(s) === 0), ...list.filter((s) => pagesOf(s) > 0)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, sentBy]);

  const add = (files: FileList | null) => {
    if (!files) return;
    setJustSent(0);
    const more = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ id: draftId(), source: f, turns: 0, preview: URL.createObjectURL(f) }));
    setDrafts((prev) => [...prev, ...more]);
  };

  const left = info ? info.max_pages - info.pages_uploaded - sent : 0;

  const choose = (t: Target | null) => {
    drafts.forEach((d) => URL.revokeObjectURL(d.preview));
    setDrafts([]);
    setJustSent(0);
    setError(null);
    setTarget(t);
  };

  const nextStudent = () => {
    const current = target?.kind === 'student' ? target.id : null;
    const next = students.find((s) => s.id !== current && pagesOf(s) === 0);
    choose(next ? { kind: 'student', id: next.id, pseudo: next.pseudo } : null);
  };

  const send = async () => {
    setSending(0);
    setError(null);
    let ok = 0;
    let copyId = target?.kind === 'unnamed' ? target.copyId : null;
    try {
      for (const d of drafts) {
        let dest: DepotTarget | undefined;
        if (target?.kind === 'student') dest = { student_id: target.id };
        else if (target?.kind === 'unnamed') dest = copyId ? { unnamed: true, copy_id: copyId } : { unnamed: true };
        const res = await uploadDepotPage(token, await preparePage(d.source, d.turns), dest);
        if (target?.kind === 'unnamed' && res.copy_id) copyId = res.copy_id;
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
      setJustSent(ok);
      if (target?.kind === 'student' && ok > 0) setSentBy((prev) => ({ ...prev, [target.id]: (prev[target.id] ?? 0) + ok }));
      // Les pages suivantes de cette copie sans nom vont dans la même copie.
      if (target?.kind === 'unnamed' && copyId) setTarget({ kind: 'unnamed', copyId });
      setSending(null);
    }
  };

  const capture = (
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
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f6f6f4)', color: 'var(--text, #1d1d1b)', fontFamily: 'inherit', padding: '20px 16px 40px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted, #666)', fontWeight: 600 }}>
          Gestion Classe · {isClass ? 'copies de la classe' : 'envoi d’une copie'}
        </div>

        {info && (
          <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface, #fff)', border: '1px solid var(--border, #ddd)' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {!isClass
                ? `Copie de ${info.pseudo}`
                : target?.kind === 'student'
                  ? `Copie de ${target.pseudo}`
                  : target?.kind === 'unnamed'
                    ? 'Copie sans nom'
                    : 'Choisis la copie'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #666)' }}>
              {info.class_name} · {info.assessment_name}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--neg-soft, #fde8e8)', color: 'var(--neg, #b42318)', fontSize: 14 }}>{error}</div>
        )}

        {info && !isClass && (
          <>
            {capture}
            {sent > 0 && drafts.length === 0 && (
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--pos-soft, #e7f6ec)', color: 'var(--pos, #15803d)', fontSize: 14 }}>
                {sent} page(s) envoyée(s). Tu peux en ajouter d’autres, ou fermer cette page.
              </div>
            )}
          </>
        )}

        {info && isClass && !target && (
          <>
            <button
              onClick={() => choose({ kind: 'unnamed', copyId: null })}
              style={{ ...big, background: 'var(--surface, #fff)', color: 'var(--text, #1d1d1b)', border: '1px dashed var(--border, #bbb)' }}
            >
              Pas de nom (copie à identifier plus tard)
            </button>
            <div style={{ borderRadius: 12, border: '1px solid var(--border, #ddd)', background: 'var(--surface, #fff)', overflow: 'hidden' }}>
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => choose({ kind: 'student', id: s.id, pseudo: s.pseudo })}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '13px 14px', border: 'none',
                    borderBottom: '1px solid var(--border, #eee)', background: 'transparent', fontSize: 16, textAlign: 'left',
                    color: 'var(--text, #1d1d1b)', fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 600 }}>{s.pseudo}</span>
                  {pagesOf(s) > 0 && <span style={{ fontSize: 13, color: 'var(--pos, #15803d)', fontWeight: 700 }}>✓ {pagesOf(s)} p.</span>}
                </button>
              ))}
              {students.length === 0 && <div style={{ padding: 14, fontSize: 14, color: 'var(--text-muted, #666)' }}>Aucun élève attendu.</div>}
            </div>
            {(info.unnamed_copies ?? 0) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>{info.unnamed_copies} copie(s) sans nom déjà rangée(s).</div>
            )}
          </>
        )}

        {info && isClass && target && (
          <>
            <button onClick={() => { choose(null); refresh(); }} style={{ ...small, alignSelf: 'flex-start' }}>← Liste des élèves</button>
            {capture}
            {justSent > 0 && drafts.length === 0 && (
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--pos-soft, #e7f6ec)', color: 'var(--pos, #15803d)', fontSize: 14 }}>
                {justSent} page(s) envoyée(s){target.kind === 'unnamed' ? ' dans la copie sans nom' : ''}. Tu peux en ajouter à cette copie, ou passer à la suite.
              </div>
            )}
            {drafts.length === 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={nextStudent} style={{ ...big, flex: 2, background: 'var(--text, #1d1d1b)', color: '#fff' }}>
                  Élève suivant →
                </button>
                {target.kind === 'unnamed' && target.copyId && (
                  <button onClick={() => choose({ kind: 'unnamed', copyId: null })} style={{ ...big, flex: 1, background: 'var(--surface, #fff)', color: 'var(--text, #1d1d1b)', border: '1px solid var(--border, #ddd)', fontSize: 14 }}>
                    Autre sans nom
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {info && (
          <div style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>
            Encore {Math.max(0, left)} page(s) possible(s). Le lien expire {isClass ? '1 heure' : '15 minutes'} après l’ouverture du QR code.
          </div>
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
