/**
 * Son : fichier du bucket (importé ou enregistré au micro) avec le lecteur du navigateur.
 */
import { useEffect, useState } from 'react';
import { signedUrl, type AudioObject } from '../../../lib/boardMedia';

interface Props {
  o: AudioObject;
  scale: number;
}

export function AudioView({ o, scale }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    signedUrl(o.path).then((u) => { if (!cancelled) setSrc(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [o.path]);
  const hold = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="wba" style={{ width: o.w * scale, height: o.h * scale, fontSize: Math.max(12, 15 * scale) }}>
      <span className="wba__label" title="Glisser pour déplacer">🔊 {o.label ?? 'Son'}</span>
      {src ? <audio controls src={src} onPointerDown={hold} style={{ height: Math.max(28, 36 * scale) }} /> : <span className="wba__wait">Chargement…</span>}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wba { display: flex; align-items: center; gap: 12px; padding: 0 14px; border-radius: 999px; background: #1F2937; color: #F9FAFB; font-family: Inter, system-ui, sans-serif; font-weight: 600; overflow: hidden; user-select: none; }
.wba__label { flex: none; white-space: nowrap; cursor: move; }
.wba audio { flex: 1; min-width: 120px; }
.wba__wait { color: #9CA3AF; font-weight: 400; }
`;
