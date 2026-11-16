/**
 * Animation : scène HTML autonome jouée dans un cadre isolé (voir `lib/boardAnimation`).
 *
 * Pas de barre, pas de bordure : l'animation fait partie de l'écran. Le cadre ne reçoit pas le
 * pointeur (on écrit par-dessus, on déplace l'objet comme une image) sauf si l'animation est
 * « interactive » — un HTML hors contrat, qui porte ses propres boutons — et seulement en classe.
 * L'étape en cours vient de l'état de séance ; « rejouer » et la remise à zéro sont des commandes.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { animationInfo, animationSrcDoc, type AnimationObject } from '../../../lib/boardAnimation';
import type { ObjectCommand } from '../../../lib/boardReveal';

interface Props {
  o: AnimationObject;
  scale: number;
  /** Lecture (en classe, « Essayer ») : seul cas où une animation interactive reçoit le pointeur. */
  play: boolean;
  /** Étape en cours (état de séance). */
  step: number;
  /** Commande d'un bouton d'interaction (rejouer, pause, remise à zéro). */
  command?: ObjectCommand;
}

export function AnimationView({ o, scale, play, step, command }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stepRef = useRef(step);
  const srcDoc = useMemo(() => animationSrcDoc(o.code), [o.code]);
  const info = animationInfo(o.code);

  const post = useCallback((message: Record<string, unknown>) => {
    // Origine opaque (cadre isolé) : pas de cible plus précise que « * » ; le message ne porte
    // qu'un numéro d'étape
    frameRef.current?.contentWindow?.postMessage({ gc: 'anim', ...message }, '*');
  }, []);

  useEffect(() => {
    stepRef.current = step;
    post({ cmd: 'goto', step });
  }, [step, post]);

  // L'animation s'annonce quand elle est prête : on lui donne l'étape où en est la séance
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const data = e.data as { gc?: unknown; ev?: unknown } | null;
      if (!data || data.gc !== 'anim') return;
      if (data.ev === 'ready') post({ cmd: 'init', step: stepRef.current });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  useEffect(() => {
    if (!command) return;
    const c = command.command;
    if (c === 'replay' || c === 'reset') post({ cmd: 'replay' });
    else if (c === 'play' || c === 'pause') post({ cmd: c });
    else if (c === 'playToggle') post({ cmd: 'toggle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);

  return (
    <div className="wban" style={{ width: o.w * scale, height: o.h * scale }}>
      <iframe
        ref={frameRef}
        srcDoc={srcDoc}
        title={o.title ?? info.title ?? 'Animation'}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        style={{ pointerEvents: play && o.interactive ? 'auto' : 'none' }}
      />
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wban { position: relative; overflow: hidden; border-radius: 6px; background: #FFFFFF; }
.wban iframe { width: 100%; height: 100%; border: 0; display: block; }
`;
