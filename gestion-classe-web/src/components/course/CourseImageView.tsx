/**
 * Image d'un cours : affichée par URL signée (le document ne garde que le chemin du bucket),
 * redimensionnable à la souris par la poignée en bas à droite, comme dans Word.
 */
import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { signedUrl } from '../../lib/boardMedia';
import { COL_W } from '../../lib/course/coursePage';

export function CourseImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { path, src, alt, width, align } = node.attrs as { path: string | null; src: string | null; alt: string | null; width: number | null; align: 'left' | 'center' | 'right' };
  const [url, setUrl] = useState<string | null>(path ? null : src);
  const [failed, setFailed] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    signedUrl(path)
      .then((u) => { if (!cancelled) { setUrl(u); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path]);

  const shown = Math.min(COL_W, dragWidth ?? width ?? COL_W);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const startX = e.clientX;
    const startW = box.getBoundingClientRect().width;
    // Le bureau peut être zoomé : on travaille en px de document
    const scale = startW / (box.offsetWidth || startW);
    let w = startW / scale;
    const move = (ev: PointerEvent) => {
      w = Math.max(40, Math.min(COL_W, (startW + (ev.clientX - startX) * (align === 'center' ? 2 : 1)) / scale));
      setDragWidth(w);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragWidth(null);
      updateAttributes({ width: Math.round(w) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <NodeViewWrapper className={`ce-img ce-img--${align ?? 'center'} ${selected ? 'is-selected' : ''}`} data-drag-handle="">
      <div ref={boxRef} className="ce-img__box" style={{ width: shown }}>
        {url && !failed ? (
          <img src={url} alt={alt ?? ''} draggable={false} />
        ) : (
          <div className="ce-img__placeholder">{failed ? 'Image indisponible' : 'Chargement de l’image…'}</div>
        )}
        {selected && <span className="ce-img__handle" onPointerDown={startResize} title="Redimensionner" />}
      </div>
    </NodeViewWrapper>
  );
}
