/**
 * Image d'un cours : affichée par URL signée (le document ne garde que le chemin du bucket),
 * redimensionnable à la souris par la poignée en bas à droite, comme dans Word.
 *
 * Lot T8 : rognage non destructif (`crop`, fractions de l'image tournée), rotation par quarts
 * de tour (`rotate`), miroir (`flip`), cadre (`frame`) et légende (`caption`, numérotée par un
 * compteur CSS : « Document 1 : … »). Le fichier n'est jamais modifié : tout est affiché.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { signedUrl } from '../../lib/boardMedia';
import { COL_W } from '../../lib/course/coursePage';
import { IMAGE_CAPTION_EVENT, IMAGE_CROP_EVENT, type ImageCrop, type ImageFrame } from './courseImageTypes';

const NO_CROP: ImageCrop = { t: 0, r: 0, b: 0, l: 0 };
/** Il reste toujours au moins 5 % de l'image dans chaque sens. */
const MIN_KEEP = 0.05;

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function CourseImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { path, src, alt, width, align, caption, crop, rotate, flip, frame } = node.attrs as {
    path: string | null; src: string | null; alt: string | null; width: number | null; align: 'left' | 'center' | 'right';
    caption: string | null; crop: ImageCrop | null; rotate: number; flip: boolean; frame: ImageFrame;
  };
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [avail, setAvail] = useState(COL_W);
  const [cropping, setCropping] = useState(false);
  const [draftCrop, setDraftCrop] = useState<ImageCrop | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    signedUrl(path)
      .then((u) => { if (!cancelled) { setSigned(u); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path]);
  const url = path ? signed : src;

  // Image désélectionnée : fin du rognage (réglé pendant le rendu, sans effet)
  const [wasSelected, setWasSelected] = useState(selected);
  if (wasSelected !== selected) {
    setWasSelected(selected);
    if (!selected) { setCropping(false); setDraftCrop(null); }
  }

  // Place disponible (une colonne est plus étroite que la page) : l'image ne la dépasse jamais
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => { const col = (el.closest('.ce-doc') as HTMLElement | null)?.clientWidth || COL_W; setAvail(Math.max(40, Math.min(col, el.offsetWidth || col))); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ruban : « Rogner » et « Légende » visent l'image sélectionnée
  useEffect(() => {
    if (!selected) return;
    const onCrop = () => setCropping((v) => !v);
    const onCaption = () => {
      if (caption === null) updateAttributes({ caption: '' });
      setEditingCaption(true);
    };
    window.addEventListener(IMAGE_CROP_EVENT, onCrop);
    window.addEventListener(IMAGE_CAPTION_EVENT, onCaption);
    return () => {
      window.removeEventListener(IMAGE_CROP_EVENT, onCrop);
      window.removeEventListener(IMAGE_CAPTION_EVENT, onCaption);
    };
  }, [selected, caption, updateAttributes]);

  useEffect(() => {
    if (!cropping) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setCropping(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cropping]);

  useEffect(() => {
    if (!editingCaption) return;
    const ta = captionRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [editingCaption]);

  // ---- Géométrie ----

  const rot = (((rotate ?? 0) % 360) + 360) % 360;
  const quarter = rot === 90 || rot === 270;
  const saved = crop ?? NO_CROP;
  const c = draftCrop ?? saved;
  // Largeur affichée de la partie gardée (attribut `width`)
  const shown = Math.min(avail, dragWidth ?? width ?? avail);
  // Image tournée entière, à l'échelle de l'affichage (calculée sur le rognage enregistré)
  const rw = natural ? (quarter ? natural.h : natural.w) : 1;
  const rh = natural ? (quarter ? natural.w : natural.h) : 1;
  const fullW = shown / Math.max(MIN_KEEP, 1 - saved.l - saved.r);
  const fullH = (fullW * rh) / rw;
  const keptH = fullH * Math.max(MIN_KEEP, 1 - saved.t - saved.b);

  /** L'image (avant rotation) dessinée au centre d'un cadre de la taille de l'image tournée. */
  const renderImg = (W: number, H: number) => {
    const iw = quarter ? H : W;
    const ih = quarter ? W : H;
    return (
      <img
        src={url ?? undefined}
        alt={alt ?? ''}
        draggable={false}
        style={{
          position: 'absolute', width: iw, height: ih, maxWidth: 'none',
          left: (W - iw) / 2, top: (H - ih) / 2,
          transform: `rotate(${rot}deg)${flip ? ' scaleX(-1)' : ''}`,
        }}
      />
    );
  };

  // ---- Redimensionner ----

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
      w = Math.max(40, Math.min(avail, (startW + (ev.clientX - startX) * (align === 'center' ? 2 : 1)) / scale));
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

  // ---- Rogner : l'image entière est montrée, la partie gardée encadrée ----

  const cropScale = Math.min(1, avail / fullW);
  const cw = fullW * cropScale;
  const ch = fullH * cropScale;

  const startCrop = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const screen = box.getBoundingClientRect().width / (box.offsetWidth || 1);
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { ...c };
    let next = start;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / screen / cw;
      const dy = (ev.clientY - sy) / screen / ch;
      next = { ...start };
      if (handle.includes('w')) next.l = Math.min(1 - start.r - MIN_KEEP, Math.max(0, start.l + dx));
      if (handle.includes('e')) next.r = Math.min(1 - start.l - MIN_KEEP, Math.max(0, start.r - dx));
      if (handle.includes('n')) next.t = Math.min(1 - start.b - MIN_KEEP, Math.max(0, start.t + dy));
      if (handle.includes('s')) next.b = Math.min(1 - start.t - MIN_KEEP, Math.max(0, start.b - dy));
      setDraftCrop(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraftCrop(null);
      // Même échelle qu'avant : la partie gardée rétrécit, l'image ne grossit pas
      const round = (v: number) => Math.round(v * 1000) / 1000;
      const kept = { t: round(next.t), r: round(next.r), b: round(next.b), l: round(next.l) };
      const empty = kept.t === 0 && kept.r === 0 && kept.b === 0 && kept.l === 0;
      updateAttributes({
        crop: empty ? null : kept,
        width: Math.round(Math.max(40, Math.min(avail, fullW * (1 - kept.l - kept.r)))),
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const ready = !!url && !failed;
  const frameClass = frame && frame !== 'none' ? `ce-img__box--${frame}` : '';

  let body: React.ReactNode;
  if (!ready) {
    body = (
      <div ref={boxRef} className="ce-img__box" style={{ width: shown }}>
        <div className="ce-img__placeholder">{failed ? 'Image indisponible' : 'Chargement de l’image…'}</div>
      </div>
    );
  } else if (!natural) {
    // Premier affichage : on attend la taille réelle de l'image pour la géométrie
    body = (
      <div ref={boxRef} className="ce-img__box" style={{ width: shown }}>
        <img src={url ?? undefined} alt={alt ?? ''} draggable={false} style={{ width: '100%', opacity: 0 }}
          onLoad={(e) => { const im = e.currentTarget; setNatural({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); }}
          onError={() => setFailed(true)} />
      </div>
    );
  } else if (cropping) {
    body = (
      <div ref={boxRef} className="ce-img__box ce-img__box--crop" style={{ width: cw, height: ch }}>
        <div className="ce-img__clip">
          {renderImg(cw, ch)}
          {/* partie retirée assombrie : une ombre immense autour du cadre gardé */}
          <div className="ce-img__crop-dim" style={{ left: c.l * cw, top: c.t * ch, width: (1 - c.l - c.r) * cw, height: (1 - c.t - c.b) * ch }} />
        </div>
        <div className="ce-img__crop" style={{ left: c.l * cw, top: c.t * ch, width: (1 - c.l - c.r) * cw, height: (1 - c.t - c.b) * ch }}>
          {HANDLES.map((h) => (
            <span key={h} className={`ce-img__ch ce-img__ch--${h}`} onPointerDown={startCrop(h)} />
          ))}
        </div>
      </div>
    );
  } else {
    body = (
      <div ref={boxRef} className={`ce-img__box ${frameClass}`} style={{ width: shown, height: keptH }}>
        <div className="ce-img__clip">
          <div className="ce-img__frame" style={{ left: -saved.l * fullW, top: -saved.t * fullH, width: fullW, height: fullH }}>
            {renderImg(fullW, fullH)}
          </div>
        </div>
        {selected && <span className="ce-img__handle" onPointerDown={startResize} title="Redimensionner" />}
      </div>
    );
  }

  return (
    <NodeViewWrapper ref={wrapRef} className={`ce-img ce-img--${align ?? 'center'} ${selected ? 'is-selected' : ''} ${cropping ? 'is-cropping' : ''}`} data-drag-handle="">
      <div className="ce-img__fig" style={{ width: cropping && natural ? cw : shown }}>
        {body}
        {cropping && <div className="ce-img__crop-hint">Tirez les poignées, puis Entrée pour finir.</div>}
        {caption !== null && !cropping && (
          <div
            className="ce-img__caption"
            onMouseDown={(e) => { if (!editingCaption) { e.preventDefault(); e.stopPropagation(); setEditingCaption(true); } }}
          >
            <span className="ce-img__num" />
            {editingCaption ? (
              <textarea
                ref={captionRef}
                className="ce-img__caption-input"
                value={caption}
                rows={1}
                placeholder="Légende de l’image"
                spellCheck
                lang="fr"
                onChange={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = 'auto';
                  ta.style.height = `${ta.scrollHeight}px`;
                  updateAttributes({ caption: ta.value.replace(/\n/g, ' ') });
                }}
                onBlur={() => setEditingCaption(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingCaption(false); } }}
              />
            ) : (
              <span className={`ce-img__caption-text ${caption ? '' : 'is-empty'}`}>{caption || 'Légende de l’image'}</span>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
