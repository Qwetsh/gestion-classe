/**
 * Fenêtre du tableau (objet `window`) : contenu ouvert par-dessus la page.
 *
 * Deux modes du même composant, sur le patron de boîte modale `.wbx` (thème TBI hérité) :
 * - `view` : en classe, un bouton l'a ouverte ; titre, image, texte, ✕ ou tap hors boîte.
 * - `edit` : en édition, titre, texte riche (gras, italique, souligné, liste, couleur) et image
 *   choisie dans le bucket ; Valider écrit l'objet.
 */
import { useEffect, useRef, useState } from 'react';
import type { WindowObject } from '../../lib/boardMedia';
import { loadPageImage } from '../../lib/boardRender';
import { fontCss, sanitizeBoardHtml } from '../../lib/boardText';

interface Props {
  window: WindowObject;
  mode: 'view' | 'edit';
  onClose: () => void;
  /** Édition : écrit titre et texte. */
  onSave?: (patch: { title: string; html: string }) => void;
  /** Édition : choisir une image (input fichier caché du tableau) ou la retirer. */
  onPickImage?: () => void;
  onRemoveImage?: () => void;
}

const COLORS = ['#111827', '#1D4ED8', '#DC2626', '#059669', '#F97316'];

export function BoardWindowDialog({ window: win, mode, onClose, onSave, onPickImage, onRemoveImage }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(win.title);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setImageUrl(null);
    if (win.imagePath) loadPageImage(win.imagePath).then((img) => { if (!cancelled) setImageUrl(img.src); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [win.imagePath]);

  // Le texte est posé une fois dans l'éditeur (jamais réécrit pendant la frappe)
  useEffect(() => {
    const el = editorRef.current;
    if (el && mode === 'edit') { el.innerHTML = win.html || '<div><br></div>'; el.focus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, win.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };
  const save = () => {
    onSave?.({ title: title.trim() || 'Fenêtre', html: sanitizeBoardHtml(editorRef.current?.innerHTML ?? '') });
  };
  // Image large : au-dessus du texte ; image haute : à gauche
  const portrait = !!win.imageW && !!win.imageH && win.imageH > win.imageW * 1.1;

  return (
    <div className="wbx wbwin" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className={`wbx__box wbwin__box ${mode === 'edit' ? 'is-edit' : ''}`} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
        <div className="wbx__head">
          {mode === 'edit'
            ? <input className="wbwin__title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la fenêtre" aria-label="Titre" />
            : <h2>{win.title}</h2>}
          <button type="button" className="wbx__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>

        {mode === 'edit' && (
          <div className="wbwin__tools" onPointerDown={(e) => e.preventDefault()}>
            <button type="button" onClick={() => exec('bold')} title="Gras"><b>G</b></button>
            <button type="button" onClick={() => exec('italic')} title="Italique"><i>I</i></button>
            <button type="button" onClick={() => exec('underline')} title="Souligné"><u>S</u></button>
            <button type="button" onClick={() => exec('insertUnorderedList')} title="Liste">•≡</button>
            <span className="wbwin__sep" />
            {COLORS.map((c) => <button key={c} type="button" className="wbwin__swatch" style={{ background: c }} onClick={() => exec('foreColor', c)} title="Couleur du texte" />)}
            <span className="wbwin__spacer" />
            <button type="button" onClick={onPickImage} title="Choisir une image">🖼 Image…</button>
            {win.imagePath && <button type="button" onClick={onRemoveImage} title="Retirer l'image">Retirer l'image</button>}
          </div>
        )}

        <div className={`wbwin__body ${portrait ? 'is-portrait' : ''}`}>
          {win.imagePath && (
            <div className="wbwin__image">
              {imageUrl ? <img src={imageUrl} alt="" draggable={false} /> : <span className="wbwin__wait">Chargement…</span>}
            </div>
          )}
          {mode === 'edit'
            ? <div ref={editorRef} className="wbwin__text wbwin__editor" contentEditable suppressContentEditableWarning spellCheck={false} style={{ fontFamily: fontCss('sans') }} />
            : <div className="wbwin__text" style={{ fontFamily: fontCss('sans') }} dangerouslySetInnerHTML={{ __html: sanitizeBoardHtml(win.html) }} />}
        </div>

        {mode === 'edit' && (
          <div className="wbx__foot">
            <button type="button" className="wbx__btn" onClick={onClose}>Annuler</button>
            <button type="button" className="wbx__btn wbx__btn--primary" onClick={save}>Valider</button>
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbx.wbwin { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.6); font: 400 15px/1.4 Inter, system-ui, sans-serif; }
.wbwin__box { width: min(960px, calc(100vw - 32px)); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #111827; color: #F3F4F6; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.5); overflow: hidden; }
.wbwin .wbx__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px 10px; }
.wbwin .wbx__head h2 { margin: 0; font-size: 26px; font-weight: 700; }
.wbwin .wbx__close { flex: none; border: 0; background: #1F2937; color: #E5E7EB; width: 44px; height: 44px; border-radius: 50%; font-size: 18px; cursor: pointer; }
.wbwin__title-input { flex: 1; min-width: 0; height: 48px; padding: 0 12px; border: 1px solid #374151; border-radius: 12px; background: #1F2937; color: #F9FAFB; font: 700 20px/1 Inter, system-ui, sans-serif; }
.wbwin__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 0 22px 8px; }
.wbwin__tools button { min-height: 40px; padding: 0 12px; border: 1px solid #374151; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbwin__tools button:hover { background: #374151; }
.wbwin__swatch { width: 32px; min-width: 32px; padding: 0 !important; border-radius: 50% !important; }
.wbwin__sep { width: 1px; height: 28px; background: #374151; margin: 0 4px; }
.wbwin__spacer { flex: 1; }
.wbwin__body { display: flex; flex-direction: column; gap: 16px; padding: 6px 22px 22px; overflow: auto; }
.wbwin__body.is-portrait { flex-direction: row; align-items: flex-start; }
.wbwin__image { flex: none; display: flex; justify-content: center; }
.wbwin__body:not(.is-portrait) .wbwin__image img { max-width: 100%; max-height: 46vh; border-radius: 12px; object-fit: contain; }
.wbwin__body.is-portrait .wbwin__image { width: 40%; }
.wbwin__body.is-portrait .wbwin__image img { width: 100%; max-height: 70vh; border-radius: 12px; object-fit: contain; }
.wbwin__wait { color: #9CA3AF; }
.wbwin__text { flex: 1; min-width: 0; font-size: 22px; line-height: 1.45; color: #F9FAFB; white-space: pre-wrap; overflow-wrap: break-word; }
.wbwin__text ul, .wbwin__text ol { margin: 0.3em 0; padding-left: 1.4em; }
.wbwin__editor { min-height: 160px; padding: 12px 14px; border: 1px solid #374151; border-radius: 12px; background: #0B1220; outline: none; caret-color: #6366F1; user-select: text; }
.wbwin__editor:focus { border-color: #6366F1; }
.wbwin .wbx__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 0 22px 18px; }
.wbwin .wbx__btn { min-height: 44px; padding: 0 18px; border: 1px solid #374151; border-radius: 12px; background: transparent; color: #E5E7EB; font: 600 15px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbwin .wbx__btn--primary { background: #4F46E5; border-color: #4F46E5; color: #FFFFFF; }
`;
