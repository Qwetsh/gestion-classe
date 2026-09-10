/**
 * Ticket à gratter : un canvas de couverture (couleur ou image) qu'on gratte au doigt, au
 * stylet ou à la souris. Le masque en cours est remonté (data URL) pour survivre à un
 * changement de page ; au-delà d'un seuil de surface grattée, tout se découvre.
 */
import { useCallback, useEffect, useRef } from 'react';

const REVEAL_THRESHOLD = 0.7;
const SAMPLE_STEP = 4;

interface Props {
  width: number;
  height: number;
  color: string;
  imageUrl?: string | null;
  /** Masque déjà gratté (data URL PNG du canvas), pour reprendre où on en était. */
  initialMask?: string | null;
  /** Rayon de grattage, en px écran. */
  radius?: number;
  onChange: (mask: string, fraction: number) => void;
  onRevealed: () => void;
}

export function BoardScratchCover({ width, height, color, imageUrl, initialMask, radius = 22, onChange, onRevealed }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ pointerId: number; last: { x: number; y: number } } | null>(null);
  const dirty = useRef(false);

  // Couverture initiale : masque repris, sinon couleur puis image
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    let cancelled = false;
    const paintCover = () => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      if (!imageUrl) {
        // Texture « argent » discrète : bandes claires en diagonale
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#FFFFFF';
        for (let x = -height; x < width; x += 22) {
          ctx.beginPath();
          ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 10 + height, height); ctx.lineTo(x + height, height);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        // « cover » : l'image remplit la zone sans déformation
        const k = Math.max(width / img.width, height / img.height);
        const w = img.width * k, h = img.height * k;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      };
      img.src = imageUrl;
    };
    if (initialMask) {
      const img = new Image();
      img.onload = () => { if (!cancelled) { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height); } };
      img.onerror = paintCover;
      img.src = initialMask;
    } else {
      paintCover();
    }
    return () => { cancelled = true; };
    // Le masque initial n'est lu qu'au montage : le composant est remonté quand l'objet change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, color, imageUrl]);

  const scratchAt = useCallback((x: number, y: number, from?: { x: number; y: number }) => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2;
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(from?.x ?? x, from?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    dirty.current = true;
  }, [radius]);

  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const finish = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || e.pointerId !== drawing.current.pointerId) return;
    drawing.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !dirty.current) return;
    dirty.current = false;
    // Part de surface grattée : échantillonnage de l'alpha
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0, clear = 0;
    for (let y = 0; y < canvas.height; y += SAMPLE_STEP) {
      for (let x = 0; x < canvas.width; x += SAMPLE_STEP) {
        total++;
        if (data[(y * canvas.width + x) * 4 + 3] < 40) clear++;
      }
    }
    const fraction = total ? clear / total : 0;
    if (fraction >= REVEAL_THRESHOLD) onRevealed();
    else onChange(canvas.toDataURL('image/png'), fraction);
  }, [onChange, onRevealed]);

  return (
    <canvas
      ref={ref}
      className="wbo__scratch"
      style={{ width, height }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
        const p = local(e);
        drawing.current = { pointerId: e.pointerId, last: p };
        scratchAt(p.x, p.y);
      }}
      onPointerMove={(e) => {
        const d = drawing.current;
        if (!d || e.pointerId !== d.pointerId) return;
        const p = local(e);
        scratchAt(p.x, p.y, d.last);
        d.last = p;
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}
