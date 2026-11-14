/**
 * Lecteur PDF à partir d'une adresse : le fichier est téléchargé puis confié au lecteur commun
 * (`PdfReader`, pdfjs), qui marche aussi sur téléphone — l'aperçu natif dans une `<iframe>` n'y
 * affiche rien. Sert aux annales (page du professeur et espace élève). Lot N1 de PLAN_mes_cours.md.
 *
 * Si le téléchargement échoue (site qui interdit la lecture depuis une autre page), on retombe
 * sur l'aperçu natif : le bouton « Ouvrir » de la fenêtre reste le recours.
 */
import { useEffect, useState } from 'react';
import { PdfReader } from './PdfReader';

interface Props {
  url: string;
  /** Nom du document (titre de l'aperçu de repli, nom du fichier). */
  name: string;
}

type State = { url: string; file: File } | { url: string; failed: true } | null;

export function PdfUrlReader({ url, name }: Props) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => setState({ url, file: new File([blob], `${name}.pdf`, { type: 'application/pdf' }) }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('[PdfUrlReader] téléchargement impossible, aperçu natif :', err);
        setState({ url, failed: true });
      });
    return () => controller.abort();
  }, [url, name]);

  // Réponse d'une adresse précédente : on attend celle de l'adresse demandée
  const current = state && state.url === url ? state : null;

  if (current && 'file' in current) return <PdfReader file={current.file} />;
  if (current) return <iframe src={url} title={name} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} />;
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: '#52525B', color: '#E4E4E7', font: '500 14px/1.4 Inter, system-ui, sans-serif' }}>
      Ouverture du document…
    </div>
  );
}
