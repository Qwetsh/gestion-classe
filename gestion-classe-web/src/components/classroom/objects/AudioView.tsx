/**
 * Son : fichier du bucket (importé ou enregistré au micro) avec le lecteur du navigateur.
 */
import { useEffect, useRef, useState } from 'react';
import { signedUrl, type AudioObject } from '../../../lib/boardMedia';
import type { ObjectCommand } from '../../../lib/boardReveal';

interface Props {
  o: AudioObject;
  scale: number;
  /** Commande d'un bouton d'interaction (lire, pause, lire / pause, remise à zéro). */
  command?: ObjectCommand;
}

export function AudioView({ o, scale, command }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!command || !el) return;
    const c = command.command;
    if (c === 'play' || (c === 'playToggle' && el.paused)) void el.play().catch(() => undefined);
    else if (c === 'pause' || c === 'playToggle') el.pause();
    else if (c === 'reset') { el.pause(); el.currentTime = 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);
  useEffect(() => {
    let cancelled = false;
    signedUrl(o.path).then((u) => { if (!cancelled) setSrc(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [o.path]);
  const hold = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="wba" style={{ width: o.w * scale, height: o.h * scale, fontSize: Math.max(12, 15 * scale) }}>
      <span className="wba__label" title="Glisser pour déplacer">🔊 {o.label ?? 'Son'}</span>
      {src ? <audio ref={audioRef} controls src={src} onPointerDown={hold} style={{ height: Math.max(28, 36 * scale) }} /> : <span className="wba__wait">Chargement…</span>}
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
