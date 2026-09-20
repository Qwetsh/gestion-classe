/**
 * Visionneuse plein écran de « Mes clouds » : PDF (lecteur pdfjs), image, vidéo, son, texte,
 * page HTML (iframe isolée) et lien Internet (iframe, ou nouvel onglet si le site refuse).
 */
import { useEffect, useMemo, useState } from 'react';
import { embedUrl, type OpenedFile } from '../../lib/cloudFiles';
import { formatSize } from '../../lib/cloudFiles';
import { PdfReader } from './PdfReader';

interface Props {
  opened: OpenedFile;
  /** Titre affiché (nom du fichier ou adresse). */
  title: string;
  subtitle?: string;
  /** Page du fichier sur le site du cloud. */
  webUrl?: string | null;
  cloudLabel?: string;
  onClose: () => void;
}

export function CloudFileViewer({ opened, title, subtitle, webUrl, cloudLabel, onClose }: Props) {
  const file = 'file' in opened ? opened.file : null;
  const blobUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);
  /** Contenu textuel lu (texte brut, page HTML), rattaché au fichier dont il provient. */
  const [read, setRead] = useState<{ file: File; text: string } | null>(null);
  const text = read && read.file === file ? read.text : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!file || (opened.kind !== 'text' && opened.kind !== 'html')) return;
    let cancelled = false;
    void file.text().then((t) => { if (!cancelled) setRead({ file, text: t }); });
    return () => { cancelled = true; };
  }, [file, opened.kind]);

  const link = opened.kind === 'link' ? opened.url : null;
  const embedded = link ? embedUrl(link) : null;

  return (
    <div className="cfv" onClick={onClose}>
      <div className="cfv__box" onClick={(e) => e.stopPropagation()}>
        <div className="cfv__head">
          <div className="cfv__title">
            <b title={title}>{title}</b>
            <small>
              {subtitle}
              {'source' in opened && opened.source && opened.source !== title ? ` · converti depuis ${opened.source}` : ''}
              {file && opened.kind !== 'link' ? `${subtitle ? ' · ' : ''}${formatSize(file.size)}` : ''}
            </small>
          </div>
          <div className="cfv__actions">
            {link && <a href={link} target="_blank" rel="noreferrer" className="cfv__btn is-primary">Nouvel onglet ↗</a>}
            {webUrl && <a href={webUrl} target="_blank" rel="noreferrer" className="cfv__btn">Ouvrir dans {cloudLabel ?? 'le cloud'} ↗</a>}
            {blobUrl && file && <a href={blobUrl} download={file.name} className="cfv__btn">Télécharger</a>}
            <button type="button" className="cfv__close" onClick={onClose} title="Fermer (Échap)">✕</button>
          </div>
        </div>

        {opened.kind === 'pdf' && file && <PdfReader file={file} />}
        {opened.kind === 'image' && blobUrl && <div className="cfv__center"><img src={blobUrl} alt={title} /></div>}
        {opened.kind === 'video' && blobUrl && <div className="cfv__center"><video src={blobUrl} controls autoPlay /></div>}
        {opened.kind === 'audio' && blobUrl && <div className="cfv__center"><audio src={blobUrl} controls autoPlay /></div>}
        {opened.kind === 'text' && <pre className="cfv__text">{text ?? 'Chargement…'}</pre>}
        {opened.kind === 'html' && (
          text === null ? <p className="cfv__msg">Chargement…</p> : <iframe className="cfv__frame" title={title} srcDoc={text} sandbox="allow-scripts allow-forms allow-popups allow-modals" />
        )}
        {opened.kind === 'link' && (
          embedded ? (
            <>
              <div className="cfv__hint">Si la page reste vide ou affiche une erreur, le site refuse d'être intégré : utiliser « Nouvel onglet ».</div>
              <iframe className="cfv__frame" title={title} src={embedded} allow="autoplay; fullscreen; clipboard-write" allowFullScreen />
            </>
          ) : (
            <div className="cfv__blocked">
              <p>Ce site n'accepte pas d'être affiché dans une autre page.</p>
              <a href={link!} target="_blank" rel="noreferrer" className="cfv__btn is-primary">Ouvrir dans un nouvel onglet ↗</a>
              <code>{link}</code>
            </div>
          )
        )}
        {opened.kind === 'download' && (
          <div className="cfv__blocked">
            <p>{opened.reason}</p>
            {blobUrl && <a href={blobUrl} download={opened.file.name} className="cfv__btn is-primary">Télécharger {opened.file.name}</a>}
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.cfv { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; padding: 16px; background: rgba(0,0,0,0.72); box-sizing: border-box; }
.cfv__box { flex: 1; min-height: 0; display: flex; flex-direction: column; width: 100%; max-width: 1400px; margin: 0 auto; background: var(--surface); border-radius: var(--radius); overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.45); }
.cfv__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); }
.cfv__title { min-width: 0; display: flex; flex-direction: column; }
.cfv__title b { color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfv__title small { color: var(--text-dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfv__actions { display: flex; align-items: center; gap: 8px; flex: none; }
.cfv__btn { display: inline-flex; align-items: center; height: 34px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface-3); color: var(--text); font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; white-space: nowrap; }
.cfv__btn.is-primary { background: var(--indigo); border-color: var(--indigo); color: #fff; }
.cfv__close { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-3); color: var(--text-muted); font-size: 15px; cursor: pointer; }
.cfv__center { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: #27272A; padding: 12px; }
.cfv__center img, .cfv__center video { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; }
.cfv__center audio { width: min(600px, 100%); }
.cfv__text { flex: 1; margin: 0; padding: 16px; overflow: auto; background: var(--surface); color: var(--text); font: 13px/1.5 "IBM Plex Mono", ui-monospace, monospace; white-space: pre-wrap; }
.cfv__frame { flex: 1; width: 100%; border: 0; background: #fff; }
.cfv__hint { padding: 6px 14px; background: var(--warn-soft, #FEF3C7); color: var(--text); font-size: 12px; }
.cfv__msg { padding: 24px; color: var(--text-muted); }
.cfv__blocked { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; text-align: center; color: var(--text-muted); }
.cfv__blocked code { font-size: 12px; color: var(--text-dim); word-break: break-all; max-width: 640px; }
@media (max-width: 640px) { .cfv { padding: 0; } .cfv__box { border-radius: 0; } .cfv__btn { padding: 0 8px; font-size: 12px; } }
`;
