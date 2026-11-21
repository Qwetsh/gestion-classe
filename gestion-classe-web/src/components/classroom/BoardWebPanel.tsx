/**
 * Panneaux « Internet » et « Vidéo » du tableau blanc, à côté du panneau Activité et de la même
 * taille : on cherche au doigt (petit clavier intégré, pensé pour le TBI) et on prélève sans
 * quitter le tableau.
 *
 * - Internet : articles de Wikipédia et images de Wikimedia Commons (libres, sans clé). Un article
 *   s'ouvre découpé en blocs (titres, paragraphes, listes, images) ; on touche les blocs voulus et
 *   on les pose sur la page, le texte modifiable avec sa source, les images en grand.
 * - Vidéo : recherche YouTube (clé « YouTube Data API » de l'enseignant) ou lien collé ; la vidéo
 *   se joue dans le panneau, se pose sur le tableau, ou en donne une image : le navigateur interdit
 *   de lire l'image d'une vidéo YouTube intégrée, la capture passe donc par le partage de l'onglet
 *   (autorisé une fois, gardé tant que le panneau est ouvert).
 */
import { useEffect, useRef, useState } from 'react';
import {
  MissingKeyError,
  fetchImageBlob,
  loadApiKeys,
  saveApiKeys,
  searchCommons,
  searchWikipedia,
  searchYouTube,
  type ApiKeys,
  type SearchResult,
} from '../../lib/boardSearch';
import { youtubeId } from '../../lib/boardMedia';
import { sanitizeBoardHtml } from '../../lib/boardText';
import { blocksToBoardHtml, fetchWikiArticle, type WikiArticle, type WikiBlock } from '../../lib/wikiArticle';
import { BoardPanelKeyboard } from './BoardPanelKeyboard';

export type WebPanelMode = 'web' | 'video';

interface Props {
  mode: WebPanelMode;
  onMode: (mode: WebPanelMode) => void;
  onClose: () => void;
  onInsertText: (html: string) => void;
  onInsertImageBlob: (blob: Blob) => Promise<void> | void;
  onInsertVideo: (url: string) => void;
}

/** Même côté que le panneau Activité. */
const SIDE_KEY = 'classroom-activity-side';

interface Playing { id: string; url: string; title: string }
interface Capture { stream: MediaStream; video: HTMLVideoElement }

/** Image en grand, puis la vignette si la grande taille n'existe pas. */
async function blobFrom(...urls: string[]): Promise<Blob> {
  let last: unknown = null;
  for (const u of urls) {
    try { return await fetchImageBlob(u); } catch (err) { last = err; }
  }
  throw last instanceof Error ? last : new Error('Image indisponible');
}

/** Vignette Commons à 960 px (la recherche renvoie des vignettes de 320). */
const commonsLarge = (r: SearchResult) => (r.thumbnail ? r.thumbnail.replace(/\/\d+px-/, '/960px-') : r.url);

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

export function BoardWebPanel({ mode, onMode, onClose, onInsertText, onInsertImageBlob, onInsertVideo }: Props) {
  const [side, setSide] = useState<'left' | 'right'>(() => { try { return localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right'; } catch { return 'right'; } });
  const [queries, setQueries] = useState<Record<WebPanelMode, string>>({ web: '', video: '' });
  const [keyboard, setKeyboard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Internet
  const [webTab, setWebTab] = useState<'articles' | 'images'>('articles');
  const [articles, setArticles] = useState<SearchResult[] | null>(null);
  const [images, setImages] = useState<SearchResult[] | null>(null);
  const [article, setArticle] = useState<WikiArticle | 'loading' | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Vidéo
  const [keys, setKeys] = useState<ApiKeys>(() => loadApiKeys());
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [videos, setVideos] = useState<SearchResult[] | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const capture = useRef<Capture | null>(null);

  const query = queries[mode];
  const setQuery = (fn: (q: string) => string) => setQueries((prev) => ({ ...prev, [mode]: fn(prev[mode]) }));

  // Le partage d'onglet s'arrête avec le panneau
  useEffect(() => () => { capture.current?.stream.getTracks().forEach((t) => t.stop()); capture.current = null; }, []);
  useEffect(() => { setNotice(null); }, [mode]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const search = async () => {
    const text = query.trim();
    if (!text || busy) return;
    setKeyboard(false);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'web') {
        setArticle(null);
        setSelected(new Set());
        const [a, i] = await Promise.allSettled([searchWikipedia(text), searchCommons(text)]);
        setArticles(a.status === 'fulfilled' ? a.value : []);
        setImages(i.status === 'fulfilled' ? i.value : []);
        if (a.status === 'rejected' && i.status === 'rejected') setNotice('Recherche impossible : pas de connexion ?');
        if (a.status === 'fulfilled' && a.value.length === 0 && i.status === 'fulfilled' && i.value.length > 0) setWebTab('images');
      } else {
        const id = youtubeId(text);
        if (id) { setPlaying({ id, url: `https://www.youtube.com/watch?v=${id}`, title: 'Vidéo YouTube' }); return; }
        setPlaying(null);
        try {
          setVideos(await searchYouTube(text, keys));
          setKeyHint(null);
        } catch (err) {
          if (!(err instanceof MissingKeyError)) throw err;
          setKeyHint(err.hint);
          setVideos(null);
        }
      }
    } catch (err) {
      setNotice(`Recherche impossible : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      setBusy(false);
    }
  };

  const openArticle = async (r: SearchResult) => {
    setArticle('loading');
    setSelected(new Set());
    setNotice(null);
    try {
      setArticle(await fetchWikiArticle(r.title));
    } catch (err) {
      console.error('[recherche] article :', err);
      setArticle(null);
      setNotice('Article illisible.');
    }
  };

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const openArticleObj = article && article !== 'loading' ? article : null;
  const chosenBlocks: WikiBlock[] = openArticleObj ? openArticleObj.blocks.filter((_, i) => selected.has(`b${i}`)) : [];
  const chosenImages = (images ?? []).filter((r) => selected.has(`c${r.id}`));
  const chosenCount = chosenBlocks.length + chosenImages.length;

  const post = async () => {
    if (busy || chosenCount === 0) return;
    setBusy(true);
    setNotice(null);
    let missed = 0;
    try {
      if (openArticleObj) {
        const html = blocksToBoardHtml(chosenBlocks, openArticleObj.title);
        if (html) onInsertText(sanitizeBoardHtml(html));
        for (const b of chosenBlocks) {
          if (b.kind !== 'image') continue;
          try { await onInsertImageBlob(await blobFrom(b.full, b.src)); } catch { missed++; }
        }
      }
      for (const r of chosenImages) {
        try { await onInsertImageBlob(await blobFrom(commonsLarge(r), r.url)); } catch { missed++; }
      }
      setSelected(new Set());
      setNotice(missed > 0 ? `Posé sur le tableau (${missed} image${missed > 1 ? 's' : ''} illisible${missed > 1 ? 's' : ''}).` : 'Posé sur le tableau.');
    } catch (err) {
      console.error('[recherche] insertion :', err);
      setNotice('Insertion impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Capture d'une image de la vidéo ----

  const ensureCapture = async (): Promise<Capture> => {
    if (capture.current && capture.current.stream.active) return capture.current;
    const md = navigator.mediaDevices as MediaDevices | undefined;
    if (!md?.getDisplayMedia) throw new Error('capture indisponible dans ce navigateur');
    // preferCurrentTab propose d'emblée « Cet onglet » (Chrome, Edge)
    const options = { video: { displaySurface: 'browser', frameRate: 10 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude' };
    const stream = await md.getDisplayMedia(options as DisplayMediaStreamOptions);
    const track = stream.getVideoTracks()[0];
    const surface = (track?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface;
    if (!track || (surface && surface !== 'browser')) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('choisissez « Cet onglet » dans la fenêtre de partage');
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    track.addEventListener('ended', () => { if (capture.current?.stream === stream) capture.current = null; });
    capture.current = { stream, video };
    // Le bandeau « Vous partagez cet onglet » décale la page : on laisse la mise en page se poser
    await new Promise((res) => setTimeout(res, 500));
    return capture.current;
  };

  const snap = async () => {
    const frame = frameRef.current;
    if (!frame || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const { video } = await ensureCapture();
      await nextFrame();
      const r = frame.getBoundingClientRect();
      const sx = video.videoWidth / window.innerWidth, sy = video.videoHeight / window.innerHeight;
      const w = Math.max(1, Math.round(r.width * sx)), h = Math.max(1, Math.round(r.height * sy));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('dessin impossible');
      ctx.drawImage(video, r.left * sx, r.top * sy, r.width * sx, r.height * sy, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('image vide');
      await onInsertImageBlob(blob);
      setNotice('Image de la vidéo posée sur le tableau.');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setNotice(name === 'NotAllowedError' ? 'Partage refusé : la capture a besoin du partage de cet onglet.' : `Capture impossible : ${err instanceof Error ? err.message : 'erreur'}.`);
    } finally {
      setBusy(false);
    }
  };

  const flip = () => {
    const next = side === 'right' ? 'left' : 'right';
    setSide(next);
    try { localStorage.setItem(SIDE_KEY, next); } catch { /* stockage indisponible */ }
  };

  const width = Math.min(Math.round(window.innerWidth * 0.46), 560);

  const renderBlock = (b: WikiBlock, i: number) => {
    const key = `b${i}`;
    const cls = `wp__blk wp__blk--${b.kind}${selected.has(key) ? ' is-sel' : ''}`;
    if (b.kind === 'heading') return <div key={key} className={cls} role="button" onClick={() => toggle(key)}>{b.level === 2 ? <h3>{b.text}</h3> : <h4>{b.text}</h4>}</div>;
    if (b.kind === 'image') {
      return (
        <div key={key} className={cls} role="button" onClick={() => toggle(key)}>
          <img src={b.src} alt="" loading="lazy" />
          {b.caption && <small>{b.caption}</small>}
        </div>
      );
    }
    return <div key={key} className={cls} role="button" onClick={() => toggle(key)} dangerouslySetInnerHTML={{ __html: sanitizeBoardHtml(b.html) }} />;
  };

  return (
    <aside className={`wp wp--${side}`} style={{ width }} aria-label={mode === 'web' ? 'Recherche internet' : 'Recherche vidéo'}>
      <header className="wp__head">
        <nav className="wp__modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'web'} className={mode === 'web' ? 'is-on' : ''} onClick={() => onMode('web')}>🌐 Internet</button>
          <button type="button" role="tab" aria-selected={mode === 'video'} className={mode === 'video' ? 'is-on' : ''} onClick={() => onMode('video')}>▶ Vidéo</button>
        </nav>
        <button type="button" className="wp__ico" onClick={flip} title={side === 'right' ? 'Passer à gauche' : 'Passer à droite'}>↔</button>
        <button type="button" className="wp__ico" onClick={onClose} title="Fermer">✕</button>
      </header>

      <form className="wp__form" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input
          className="wp__input"
          value={query}
          inputMode="none"
          placeholder={mode === 'web' ? 'Chercher sur Wikipédia…' : 'Chercher une vidéo, ou coller un lien YouTube…'}
          onChange={(e) => setQuery(() => e.target.value)}
          onFocus={() => setKeyboard(true)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
        />
        {query && <button type="button" className="wp__ico" onClick={() => { setQuery(() => ''); setKeyboard(true); }} title="Vider">⌫</button>}
        <button type="button" className={`wp__ico ${keyboard ? 'is-on' : ''}`} onClick={() => setKeyboard((v) => !v)} title={keyboard ? 'Masquer le clavier' : 'Afficher le clavier'}>⌨</button>
        {!keyboard && <button type="submit" className="wp__go" disabled={busy}>{busy ? '…' : 'Chercher'}</button>}
      </form>
      {keyboard && (
        <BoardPanelKeyboard
          onKey={(k) => setQuery((q) => q + k)}
          onBackspace={() => setQuery((q) => q.slice(0, -1))}
          onEnter={() => void search()}
        />
      )}

      {mode === 'web' && (
        <>
          {articles && !openArticleObj && article !== 'loading' && (
            <nav className="wp__tabs" role="tablist">
              <button type="button" role="tab" aria-selected={webTab === 'articles'} className={webTab === 'articles' ? 'is-on' : ''} onClick={() => setWebTab('articles')}>Articles{articles.length ? ` (${articles.length})` : ''}</button>
              <button type="button" role="tab" aria-selected={webTab === 'images'} className={webTab === 'images' ? 'is-on' : ''} onClick={() => setWebTab('images')}>Images{images?.length ? ` (${images.length})` : ''}</button>
            </nav>
          )}
          {(openArticleObj || article === 'loading') && (
            <div className="wp__crumb">
              <button type="button" className="wp__back" onClick={() => { setArticle(null); setSelected(new Set()); }}>← Résultats</button>
              {openArticleObj && <b title={openArticleObj.title}>{openArticleObj.title}</b>}
            </div>
          )}
          <div className="wp__scroll">
            {!articles && !busy && <p className="wp__msg">Articles de Wikipédia et images libres de Wikimedia Commons.</p>}
            {busy && !articles && <p className="wp__msg">Recherche…</p>}
            {article === 'loading' && <p className="wp__msg">Ouverture de l’article…</p>}
            {openArticleObj && openArticleObj.blocks.map(renderBlock)}
            {openArticleObj && openArticleObj.blocks.length === 0 && <p className="wp__msg">Rien à prélever dans cet article.</p>}
            {articles && !article && webTab === 'articles' && (
              articles.length === 0
                ? <p className="wp__msg">Aucun article pour « {queries.web.trim()} ».</p>
                : articles.map((r) => (
                  <button key={r.id} type="button" className="wp__row" onClick={() => void openArticle(r)}>
                    {r.thumbnail ? <img src={r.thumbnail} alt="" loading="lazy" /> : <span className="wp__noimg">W</span>}
                    <span><b>{r.title}</b>{r.snippet && <small>{r.snippet}</small>}</span>
                  </button>
                ))
            )}
            {images && !article && webTab === 'images' && (
              images.length === 0
                ? <p className="wp__msg">Aucune image pour « {queries.web.trim()} ».</p>
                : (
                  <div className="wp__grid">
                    {images.map((r) => (
                      <button key={r.id} type="button" className={`wp__img${selected.has(`c${r.id}`) ? ' is-sel' : ''}`} onClick={() => toggle(`c${r.id}`)} title={r.credit}>
                        <img src={r.thumbnail} alt={r.title} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )
            )}
          </div>
          <footer className="wp__bar">
            {chosenCount === 0 && (
              <span className="wp__hint">
                {openArticleObj ? 'Touchez les paragraphes, titres ou images à poser.' : webTab === 'images' && images ? 'Touchez les images à poser.' : 'Touchez un article pour l’ouvrir.'}
              </span>
            )}
            {chosenCount > 0 && (
              <>
                <span className="wp__sel"><b>{chosenCount}</b> choisi{chosenCount > 1 ? 's' : ''}</span>
                <div className="wp__acts">
                  <button type="button" className="wp__go" onClick={() => void post()} disabled={busy}>Poser sur le tableau</button>
                  <button type="button" className="wp__sm" onClick={() => setSelected(new Set())} title="Effacer la sélection">✕</button>
                </div>
              </>
            )}
            {notice && <span className="wp__notice">{notice}</span>}
          </footer>
        </>
      )}

      {mode === 'video' && (
        <>
          <div className="wp__scroll">
            {playing && (
              <div className="wp__player">
                <iframe
                  ref={frameRef}
                  src={`https://www.youtube-nocookie.com/embed/${playing.id}?rel=0&modestbranding=1&playsinline=1&autoplay=1`}
                  title={playing.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
                <b className="wp__ptitle">{playing.title}</b>
              </div>
            )}
            {keyHint && !playing && (
              <div className="wp__key">
                <p>{keyHint}</p>
                <p>Sans clé, un lien YouTube collé dans le champ fonctionne.</p>
                <label>Clé YouTube Data API v3
                  <input value={keys.youtube ?? ''} onChange={(e) => setKeys({ ...keys, youtube: e.target.value.trim() })} onKeyDown={(e) => e.stopPropagation()} placeholder="AIza…" />
                </label>
                <button type="button" className="wp__go" onClick={() => { saveApiKeys(keys); setKeyHint(null); setNotice('Clé enregistrée.'); void search(); }} disabled={!keys.youtube}>Enregistrer et chercher</button>
              </div>
            )}
            {!playing && !keyHint && !videos && !busy && <p className="wp__msg">Cherchez une vidéo YouTube, ou collez son lien.</p>}
            {busy && !videos && !playing && <p className="wp__msg">Recherche…</p>}
            {videos && !keyHint && (
              <>
                {playing && <div className="wp__chapter">Autres résultats</div>}
                {videos.length === 0 && <p className="wp__msg">Aucune vidéo pour « {queries.video.trim()} ».</p>}
                {videos.map((r) => {
                  const id = youtubeId(r.url);
                  return (
                    <button key={r.id} type="button" className={`wp__row wp__row--video${playing?.id === id ? ' is-on' : ''}`} onClick={() => id && setPlaying({ id, url: r.url, title: r.title })}>
                      {r.thumbnail ? <img src={r.thumbnail} alt="" loading="lazy" /> : <span className="wp__noimg">▶</span>}
                      <span><b>{r.title}</b>{r.snippet && <small>{r.snippet}</small>}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          <footer className="wp__bar">
            {!playing && <span className="wp__hint">Touchez une vidéo pour la lire ici.</span>}
            {playing && (
              <div className="wp__acts wp__acts--full">
                <button type="button" className="wp__go" onClick={() => void snap()} disabled={busy} title="Poser sur le tableau l'image de la vidéo à cet instant">📷 Capturer l’image</button>
                <button type="button" className="wp__go wp__go--alt" onClick={() => { onInsertVideo(playing.url); setNotice('Vidéo posée sur le tableau.'); }} title="Poser le lecteur vidéo sur la page">Poser la vidéo</button>
                <button type="button" className="wp__sm" onClick={() => setPlaying(null)} title="Arrêter la vidéo">■</button>
              </div>
            )}
            {notice && <span className="wp__notice">{notice}</span>}
          </footer>
        </>
      )}
      <style>{CSS}</style>
    </aside>
  );
}

const CSS = `
.wp { position: fixed; top: 48px; bottom: 0; z-index: 25; display: flex; flex-direction: column; background: #111827; color: #F3F4F6; box-shadow: 0 0 40px rgba(0,0,0,0.45); font: 400 14px/1.4 Inter, system-ui, sans-serif; }
.wp--right { right: 0; border-radius: 14px 0 0 0; }
.wp--left { left: 0; border-radius: 0 14px 0 0; }
.wp__head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
.wp__modes { flex: 1; display: flex; gap: 6px; min-width: 0; }
.wp__modes button, .wp__tabs button { height: 36px; padding: 0 14px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wp__modes button.is-on, .wp__tabs button.is-on { background: #4F46E5; color: #FFF; }
.wp__ico { flex: none; width: 40px; height: 40px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font-size: 17px; cursor: pointer; }
.wp__ico:hover { background: #374151; }
.wp__ico.is-on { background: #374151; color: #A5B4FC; }
.wp__form { display: flex; gap: 6px; padding: 0 10px; }
.wp__input { flex: 1; min-width: 0; height: 48px; padding: 0 12px; border-radius: 10px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 18px/1 Inter, system-ui, sans-serif; }
.wp__input:focus { outline: 2px solid #6366F1; outline-offset: 0; }
.wp__form .wp__ico { height: 48px; width: 48px; }
.wp__go { height: 44px; padding: 0 16px; border: 0; border-radius: 10px; background: #4F46E5; color: #FFF; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.wp__form .wp__go { height: 48px; }
.wp__go:disabled { opacity: .6; cursor: default; }
.wp__go--alt { background: #374151; }
.wp__sm { flex: none; width: 44px; height: 44px; border: 0; border-radius: 10px; background: #374151; color: #E5E7EB; font-size: 16px; cursor: pointer; }
.wp__tabs { display: flex; gap: 6px; padding: 8px 10px 0; }
.wp__crumb { display: flex; align-items: center; gap: 8px; padding: 8px 10px 0; min-width: 0; }
.wp__crumb b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wp__back { flex: none; height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wp__scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; margin-top: 8px; padding: 8px 10px 10px; background: #1F2937; }
.wp__msg { margin: 10px 4px; color: #9CA3AF; font-size: 13px; }
.wp__chapter { margin: 12px 2px 6px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #9CA3AF; }
.wp__row { display: flex; align-items: flex-start; gap: 10px; width: 100%; margin-bottom: 6px; padding: 8px; border: 0; border-radius: 10px; background: #111827; color: #F3F4F6; text-align: left; cursor: pointer; }
.wp__row:hover { background: #0B1220; }
.wp__row.is-on { outline: 3px solid #6366F1; }
.wp__row img, .wp__noimg { flex: none; width: 72px; height: 72px; border-radius: 8px; object-fit: cover; background: #374151; }
.wp__row--video img, .wp__row--video .wp__noimg { width: 128px; height: 72px; }
.wp__noimg { display: grid; place-items: center; color: #9CA3AF; font: 700 22px/1 Georgia, serif; }
.wp__row span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.wp__row b { font-size: 15px; }
.wp__row small { color: #D1D5DB; font-size: 13px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.wp__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.wp__img { padding: 0; border: 0; border-radius: 8px; background: #374151; overflow: hidden; cursor: pointer; aspect-ratio: 1; }
.wp__img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.wp__img.is-sel, .wp__blk.is-sel { outline: 4px solid #6366F1; outline-offset: 2px; }
/* Article : blocs à toucher, sur fond clair comme une page */
.wp__blk { margin-bottom: 4px; padding: 8px 10px; border-radius: 6px; background: #FFFFFF; color: #111827; font: 400 15px/1.5 Georgia, 'Times New Roman', serif; cursor: pointer; }
.wp__blk:hover { background: #EEF2FF; }
.wp__blk.is-sel { background: #E0E7FF; }
.wp__blk h3, .wp__blk h4 { margin: 0; font-family: Inter, system-ui, sans-serif; }
.wp__blk h3 { font-size: 18px; }
.wp__blk h4 { font-size: 15px; }
.wp__blk ul { margin: 0; padding-left: 22px; }
.wp__blk--image { text-align: center; }
.wp__blk--image img { max-width: 100%; max-height: 260px; display: block; margin: 0 auto; }
.wp__blk--image small { display: block; margin-top: 4px; color: #4B5563; font: 400 12px/1.35 Inter, system-ui, sans-serif; }
.wp__player iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 8px; background: #000; }
.wp__ptitle { display: block; margin: 6px 2px 0; font-size: 14px; }
.wp__key { padding: 10px; border-radius: 10px; background: #111827; font-size: 13px; color: #D1D5DB; }
.wp__key p { margin: 0 0 8px; }
.wp__key label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; color: #9CA3AF; font-size: 12px; }
.wp__key input { height: 40px; padding: 0 10px; border-radius: 8px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 13px/1 "IBM Plex Mono", ui-monospace, monospace; }
.wp__bar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px; min-height: 64px; border-top: 1px solid #374151; background: #111827; }
.wp__hint { color: #9CA3AF; font-size: 13px; }
.wp__sel { font-size: 14px; }
.wp__acts { display: flex; gap: 6px; margin-left: auto; }
.wp__acts--full { width: 100%; margin-left: 0; }
.wp__acts--full .wp__go { flex: 1; }
.wp__notice { position: absolute; left: 10px; right: 10px; bottom: calc(100% + 6px); padding: 7px 10px; border-radius: 8px; background: rgba(17,24,39,.94); color: #FCD34D; font-size: 13px; pointer-events: none; }
`;
