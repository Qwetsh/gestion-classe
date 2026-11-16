/**
 * Un sujet d'annale ouvert en grand : lecteur PDF commun (pdfjs, lisible aussi sur téléphone), dont
 * la barre porte l'ouverture dans un onglet. Fermeture par Échap, la croix ou un clic à côté.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PdfUrlReader } from '../clouds/PdfUrlReader';
import { annaleLabel } from '../../lib/annalesLibrary';
import type { BrevetItem } from '../../lib/customAnnales';

export function AnnaleViewer({ annale, onClose }: { annale: BrevetItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const { title, detail } = annaleLabel(annale);
  const meta = [detail, String(annale.annee), annale.code].filter(Boolean).join(' · ');

  return (
    <div className="gc-overlay an-viewer" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="an-viewer__panel" onClick={(e) => e.stopPropagation()}>
        <header className="an-viewer__head">
          <div className="an-viewer__titles">
            <div className="an-viewer__title">{title}</div>
            <div className="an-viewer__meta">{meta}</div>
          </div>
          <button type="button" className="an-viewer__close" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer">
            <X size={18} aria-hidden />
          </button>
        </header>
        <PdfUrlReader url={annale.url} name={title} />
      </div>
    </div>
  );
}
