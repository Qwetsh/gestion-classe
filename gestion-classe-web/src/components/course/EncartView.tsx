/**
 * Encart tableau dans le texte d'un cours : un bloc 16:9 de la largeur de la colonne, qui fait
 * exactement un écran en classe. Il affiche l'aperçu de sa page du tableau (dessinée par le même
 * moteur que les vignettes) ; double-clic = l'ouvrir dans le tableau blanc.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { renderPageToCanvas } from '../../lib/boardRender';
import { COL_W } from '../../lib/course/coursePage';
import { encartPagesLoaded, encartsVersion, getEncartOverride, getEncartPage, loadEncartPages, subscribeEncarts } from './encartStore';

export interface EncartOptions {
  boardId: string;
  onEdit: (pageId: string) => void;
  /** En classe (lot 4e) : version de la séance ou de l'essai, affichée à la place de l'encart préparé. */
  scope?: string;
}

/** Largeur de rendu de l'aperçu (2 × la colonne : net à l'écran comme à l'impression). */
const PREVIEW_W = Math.round(COL_W * 2);

export function EncartView({ node, selected, extension }: NodeViewProps) {
  const { pageId, print } = node.attrs as { pageId: string; print: 'filled' | 'blank' };
  const { boardId, onEdit, scope } = extension.options as EncartOptions;
  useSyncExternalStore(subscribeEncarts, encartsVersion);
  const override = scope ? getEncartOverride(scope, pageId) : undefined;
  const page = override ?? getEncartPage(boardId, pageId);
  const loaded = !!override || encartPagesLoaded(boardId);
  const [preview, setPreview] = useState<{ page: typeof page; url: string } | null>(null);

  useEffect(() => { void loadEncartPages(boardId); }, [boardId]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    renderPageToCanvas(page, PREVIEW_W)
      .then((canvas) => { if (!cancelled) setPreview({ page, url: canvas.toDataURL('image/png') }); })
      .catch((err) => console.warn('[encart] aperçu impossible :', err));
    return () => { cancelled = true; };
  }, [page]);

  const empty = loaded && (!page || (page.strokes.length === 0 && (page.objects ?? []).length === 0 && !page.image));
  const url = preview && preview.page === page ? preview.url : null;

  return (
    <NodeViewWrapper
      className={`ce-encart ${selected ? 'is-selected' : ''} ${print === 'blank' ? 'ce-encart--print-blank' : ''}`}
      data-drag-handle=""
      data-page-id={pageId}
      onDoubleClick={(e: React.MouseEvent) => { e.preventDefault(); onEdit(pageId); }}
      title="Double-cliquez pour dessiner dans l'encart"
    >
      <span className="ce-encart__label" contentEditable={false}>
        ▦ Encart tableau <em>= un écran en classe{print === 'blank' ? ' · imprimé vide' : ''}</em>
      </span>
      {empty ? (
        <div className="ce-encart__empty">
          <strong>Encart vide</strong>
          <span>Double-cliquez pour dessiner, écrire, poser des formes ou des images</span>
        </div>
      ) : url ? (
        <img className="ce-encart__img" src={url} alt="" draggable={false} />
      ) : (
        <div className="ce-encart__empty"><span>Chargement…</span></div>
      )}
      {selected && (
        <button type="button" className="ce-encart__edit" contentEditable={false} onClick={() => onEdit(pageId)}>
          ✎ Modifier l'encart
        </button>
      )}
    </NodeViewWrapper>
  );
}
