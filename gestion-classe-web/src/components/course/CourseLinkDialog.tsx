/**
 * Fenêtre « Lien » de l'éditeur de cours (Ctrl+K), à la manière de Word : texte affiché et
 * adresse. Remplace l'ancienne boîte du navigateur.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Adresse actuelle si le curseur est déjà dans un lien. */
  initialHref: string;
  /** Texte sélectionné (ou vide) : sert de texte du lien s'il n'y a pas de sélection. */
  initialText: string;
  /** Vrai s'il faut demander le texte (rien de sélectionné et pas dans un lien). */
  askText: boolean;
  onApply: (href: string, text: string) => void;
  onRemove: (() => void) | null;
  onClose: () => void;
}

/** « www.exemple.fr » → « https://www.exemple.fr » ; une adresse e-mail → « mailto: ». */
function normalizeHref(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('#') || v.startsWith('/')) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return `https://${v}`;
}

export function CourseLinkDialog({ initialHref, initialText, askText, onApply, onRemove, onClose }: Props) {
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const hrefRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hrefRef.current?.focus();
    hrefRef.current?.select();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeHref(href);
    if (!url) { onRemove?.(); onClose(); return; }
    onApply(url, text.trim() || url);
  };

  const preview = normalizeHref(href);

  return (
    <div className="ce-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="ce-dialog" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }} role="dialog" aria-label="Lien">
        <h3 className="ce-dialog__title">{onRemove ? 'Modifier le lien' : 'Insérer un lien'}</h3>
        {askText && (
          <label className="ce-field">
            <span>Texte affiché</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Texte du lien" />
          </label>
        )}
        <label className="ce-field">
          <span>Adresse</span>
          <input ref={hrefRef} value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://… ou adresse e-mail" inputMode="url" spellCheck={false} />
        </label>
        <div className="ce-dialog__foot">
          {onRemove && <button type="button" className="ce-btn ce-btn--danger" onClick={() => { onRemove(); onClose(); }}>Retirer le lien</button>}
          {preview && <a className="ce-dialog__open" href={preview} target="_blank" rel="noopener noreferrer">Ouvrir ↗</a>}
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="ce-btn ce-btn--primary" disabled={!preview}>OK</button>
        </div>
      </form>
    </div>
  );
}
