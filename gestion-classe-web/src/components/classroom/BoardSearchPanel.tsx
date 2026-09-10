/**
 * Recherche intégrée : Web (Wikipédia, puis Brave si l'Edge Function est déployée), vidéos
 * (YouTube), images (Wikimedia Commons, Unsplash). Trois façons de saisir sans clavier
 * physique : le champ (avec le clavier virtuel), la voix, l'écriture au stylet.
 * Un résultat s'insère d'un tap comme objet du tableau (image, vidéo, lien, extrait).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MissingKeyError,
  fetchImageBlob,
  loadApiKeys,
  saveApiKeys,
  searchCommons,
  searchUnsplash,
  searchWeb,
  searchWikipedia,
  searchYouTube,
  type ApiKeys,
  type SearchKind,
  type SearchResult,
} from '../../lib/boardSearch';
import { recognizeHandwriting } from '../../lib/boardHandwriting';
import type { Stroke } from '../../lib/boardRender';

interface Props {
  onInsertImage: (blob: Blob, title: string, credit?: string) => Promise<void> | void;
  onInsertVideo: (url: string) => void;
  onInsertLink: (url: string, label: string) => void;
  onInsertText: (html: string) => void;
  onClose: () => void;
}

type SpeechRecognitionCtor = new () => {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
};

function speechCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Petit bloc d'écriture au stylet : les traits sont reconnus à la validation. */
function HandwritingPad({ onText, onProgress }: { onText: (t: string) => void; onProgress: (label: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [busy, setBusy] = useState(false);

  const local = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const draw = () => {
    const c = ref.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  };
  const clear = () => { strokes.current = []; current.current = null; draw(); };
  const recognize = async () => {
    if (strokes.current.length === 0) return;
    setBusy(true);
    try {
      const { text } = await recognizeHandwriting(strokes.current, onProgress);
      if (text) onText(text);
      else onProgress('Rien de lisible : écrire plus gros, en script.');
      clear();
    } catch (err) {
      onProgress(`Reconnaissance indisponible : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      setBusy(false);
      window.setTimeout(() => onProgress(null), 2500);
    }
  };

  return (
    <div className="wbsr__pad">
      <canvas
        ref={ref}
        width={560}
        height={140}
        onPointerDown={(e) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthétique */ } const p = local(e); current.current = { id: String(Date.now()), tool: 'pen', color: '#000', size: 4, points: [{ ...p, p: 0.5 }] }; draw(); }}
        onPointerMove={(e) => { if (!current.current || !(e.buttons & 1)) return; current.current.points.push({ ...local(e), p: 0.5 }); draw(); }}
        onPointerUp={() => { if (current.current) { strokes.current.push(current.current); current.current = null; draw(); } }}
        onPointerCancel={() => { current.current = null; draw(); }}
      />
      <div className="wbsr__padbar">
        <span>Écrire au stylet, en script</span>
        <button type="button" onClick={clear} disabled={busy}>Effacer</button>
        <button type="button" className="is-primary" onClick={() => void recognize()} disabled={busy}>{busy ? 'Lecture…' : 'Lire'}</button>
      </div>
    </div>
  );
}

export function BoardSearchPanel({ onInsertImage, onInsertVideo, onInsertLink, onInsertText, onClose }: Props) {
  const [kind, setKind] = useState<SearchKind>('web');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [listening, setListening] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>(() => loadApiKeys());
  const [showKeys, setShowKeys] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recog = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const run = useCallback(async (q: string, k: SearchKind) => {
    const text = q.trim();
    if (!text) return;
    setBusy(true);
    setNotice(null);
    // Une clé manquante s'explique ; sinon « aucun résultat »
    let hint: string | null = null;
    try {
      let list: SearchResult[] = [];
      if (k === 'web') {
        const wiki = await searchWikipedia(text);
        try { list = [...(await searchWeb(text)), ...wiki]; } catch (err) { list = wiki; if (err instanceof MissingKeyError && wiki.length === 0) hint = err.hint; }
      } else if (k === 'video') {
        try { list = await searchYouTube(text, keys); } catch (err) { if (err instanceof MissingKeyError) { hint = err.hint; setShowKeys(true); } else throw err; }
      } else {
        const commons = await searchCommons(text);
        try { list = [...(await searchUnsplash(text, keys)), ...commons]; } catch (err) { list = commons; if (err instanceof MissingKeyError && commons.length === 0) hint = err.hint; }
      }
      setResults(list);
      setNotice(hint ?? (list.length === 0 ? 'Aucun résultat.' : null));
    } catch (err) {
      setNotice(`Recherche impossible : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      setBusy(false);
    }
  }, [keys]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const toggleVoice = () => {
    if (listening) { recog.current?.stop(); return; }
    const Ctor = speechCtor();
    if (!Ctor) { setNotice('Reconnaissance vocale indisponible dans ce navigateur.'); return; }
    const r = new Ctor();
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ');
      setQuery(t);
    };
    r.onend = () => { setListening(false); recog.current = null; setQuery((q) => { if (q.trim()) void run(q, kind); return q; }); };
    r.onerror = () => { setListening(false); recog.current = null; setNotice('Micro : rien entendu ou accès refusé.'); };
    recog.current = r;
    setListening(true);
    r.start();
  };

  const insert = async (r: SearchResult) => {
    try {
      if (r.kind === 'image') {
        setBusy(true);
        await onInsertImage(await fetchImageBlob(r.url), r.title, r.credit);
      } else if (r.kind === 'video') onInsertVideo(r.url);
      else onInsertLink(r.url, r.title);
      onClose();
    } catch (err) {
      setNotice(`Insertion impossible : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      setBusy(false);
    }
  };

  const insertExtract = (r: SearchResult) => {
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
    onInsertText(`<div><b>${esc(r.title)}</b></div><div>${esc(r.snippet ?? '')}</div><div><span style="color: #6B7280">${esc(r.provider)}</span></div>`);
    onClose();
  };

  return (
    <div className="wbsr" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="wbsr__box" onClick={(e) => e.stopPropagation()}>
        <div className="wbsr__head">
          <div className="wbsr__tabs">
            {(['web', 'video', 'image'] as SearchKind[]).map((k) => (
              <button key={k} type="button" className={kind === k ? 'is-on' : ''} onClick={() => { setKind(k); if (query.trim()) void run(query, k); }}>
                {k === 'web' ? '🌐 Web' : k === 'video' ? '▶ Vidéos' : '🖼 Images'}
              </button>
            ))}
          </div>
          <button type="button" className="wbsr__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>

        <form className="wbsr__form" onSubmit={(e) => { e.preventDefault(); void run(query, kind); }}>
          <input ref={inputRef} className="wbsr__input" value={query} placeholder="Chercher…" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }} />
          <button type="button" className={`wbsr__ico ${listening ? 'is-on' : ''}`} onClick={toggleVoice} title="Dicter la recherche">🎙</button>
          <button type="button" className={`wbsr__ico ${showPad ? 'is-on' : ''}`} onClick={() => setShowPad((v) => !v)} title="Écrire la recherche au stylet">✍️</button>
          <button type="submit" className="wbsr__go" disabled={busy}>{busy ? '…' : 'Chercher'}</button>
        </form>
        {showPad && <HandwritingPad onText={(t) => { setQuery((q) => (q ? `${q} ${t}` : t)); setShowPad(false); void run(t, kind); }} onProgress={setNotice} />}
        {notice && <div className="wbsr__notice">{notice}</div>}

        <div className={`wbsr__results ${kind === 'web' ? 'is-list' : ''}`}>
          {results.map((r) => (
            <div key={r.id} className="wbsr__item">
              {r.thumbnail && <img src={r.thumbnail} alt="" loading="lazy" onClick={() => void insert(r)} />}
              <div className="wbsr__meta">
                <b title={r.title}>{r.title}</b>
                {r.snippet && <p>{r.snippet}</p>}
                {r.credit && <small>{r.credit}</small>}
                <div className="wbsr__actions">
                  <button type="button" onClick={() => void insert(r)}>{r.kind === 'image' ? 'Insérer l\'image' : r.kind === 'video' ? 'Insérer la vidéo' : 'Insérer le lien'}</button>
                  {r.kind === 'web' && r.snippet && <button type="button" onClick={() => insertExtract(r)}>Insérer l'extrait</button>}
                  <a href={r.url} target="_blank" rel="noreferrer">Ouvrir ↗</a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="wbsr__foot">
          <button type="button" className="wbsr__link" onClick={() => setShowKeys((v) => !v)}>{showKeys ? 'Masquer les clés' : 'Clés API (YouTube, Unsplash)'}</button>
          {showKeys && (
            <div className="wbsr__keys">
              <label>YouTube Data API v3 <input value={keys.youtube ?? ''} onChange={(e) => setKeys({ ...keys, youtube: e.target.value })} onKeyDown={(e) => e.stopPropagation()} placeholder="AIza…" /></label>
              <label>Unsplash Access Key <input value={keys.unsplash ?? ''} onChange={(e) => setKeys({ ...keys, unsplash: e.target.value })} onKeyDown={(e) => e.stopPropagation()} placeholder="…" /></label>
              <button type="button" onClick={() => { saveApiKeys(keys); setNotice('Clés enregistrées sur cet appareil.'); }}>Enregistrer</button>
            </div>
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbsr { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; background: rgba(17,24,39,0.55); font: 400 15px/1.4 Inter, system-ui, sans-serif; }
.wbsr__box { width: min(960px, calc(100vw - 32px)); max-height: calc(100vh - 140px); display: flex; flex-direction: column; background: #111827; color: #F3F4F6; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.5); overflow: hidden; }
.wbsr__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 0; }
.wbsr__tabs { display: flex; gap: 6px; }
.wbsr__tabs button { height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbsr__tabs button.is-on { background: #4F46E5; color: #FFFFFF; }
.wbsr__close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: #1F2937; color: #E5E7EB; cursor: pointer; }
.wbsr__form { display: flex; gap: 8px; padding: 12px 16px; }
.wbsr__input { flex: 1; height: 52px; padding: 0 16px; border-radius: 12px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 20px/1 Inter, system-ui, sans-serif; }
.wbsr__ico { width: 52px; height: 52px; border: 0; border-radius: 12px; background: #1F2937; font-size: 22px; cursor: pointer; }
.wbsr__ico.is-on { background: #DC2626; }
.wbsr__go { height: 52px; padding: 0 20px; border: 0; border-radius: 12px; background: #4F46E5; color: #FFFFFF; font: 600 16px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbsr__pad { margin: 0 16px 10px; border-radius: 12px; background: #FFFFFF; overflow: hidden; }
.wbsr__pad canvas { display: block; width: 100%; height: 140px; touch-action: none; cursor: crosshair; background-image: linear-gradient(#E5E7EB 1px, transparent 1px); background-size: 100% 35px; background-position: 0 34px; }
.wbsr__padbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #F3F4F6; color: #374151; font-size: 13px; }
.wbsr__padbar span { flex: 1; }
.wbsr__padbar button { height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: #E5E7EB; color: #111827; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbsr__padbar button.is-primary { background: #4F46E5; color: #FFFFFF; }
.wbsr__notice { margin: 0 16px 8px; padding: 10px 12px; border-radius: 10px; background: #1F2937; color: #FCD34D; font-size: 13px; }
.wbsr__results { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; padding: 4px 16px 16px; }
.wbsr__results.is-list { grid-template-columns: 1fr; }
.wbsr__item { display: flex; flex-direction: column; border-radius: 12px; background: #1F2937; overflow: hidden; }
.is-list .wbsr__item { flex-direction: row; }
.wbsr__item img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; cursor: pointer; background: #374151; }
.is-list .wbsr__item img { width: 120px; height: 90px; aspect-ratio: auto; flex: none; }
.wbsr__meta { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; min-width: 0; }
.wbsr__meta b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbsr__meta p { margin: 0; color: #D1D5DB; font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wbsr__meta small { color: #9CA3AF; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbsr__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.wbsr__actions button { height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 12px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbsr__actions a { height: 32px; line-height: 32px; padding: 0 10px; border-radius: 8px; background: #374151; color: #E5E7EB; font: 600 12px/32px Inter, system-ui, sans-serif; text-decoration: none; }
.wbsr__foot { padding: 8px 16px 14px; border-top: 1px solid #1F2937; }
.wbsr__link { border: 0; background: transparent; color: #A5B4FC; font: 500 13px/1 Inter, system-ui, sans-serif; cursor: pointer; padding: 0; }
.wbsr__keys { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; margin-top: 10px; }
.wbsr__keys label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #9CA3AF; }
.wbsr__keys input { height: 38px; padding: 0 10px; border-radius: 8px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 13px/1 "IBM Plex Mono", ui-monospace, monospace; }
.wbsr__keys button { height: 38px; padding: 0 14px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
`;
