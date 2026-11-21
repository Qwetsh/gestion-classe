/**
 * Animation : scène HTML autonome jouée dans un cadre isolé (voir `lib/boardAnimation`).
 *
 * Pas de barre, pas de bordure : l'animation fait partie de l'écran. Le cadre ne reçoit pas le
 * pointeur (on écrit par-dessus, on déplace l'objet comme une image) sauf si l'animation est
 * « interactive » — un HTML hors contrat, qui porte ses propres boutons — et seulement en classe.
 * L'étape en cours vient de l'état de séance ; « rejouer » et la remise à zéro sont des commandes.
 *
 * Scène riche : le cadre attend ses bibliothèques (three, chart) avant d'être monté ; il demande
 * ses fichiers joints dès que son document est prêt (à chaque chargement), et le tableau répond.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animationInfo, animationLibs, animationSrcDoc, type AnimationObject } from '../../../lib/boardAnimation';
import type { ObjectCommand } from '../../../lib/boardReveal';
import { loadSceneAsset, loadSceneLib } from '../../../lib/sceneAssets';

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
  const libNames = useMemo(() => animationLibs(o.code), [o.code]);
  const libKey = libNames.join(',');
  const [libs, setLibs] = useState<{ key: string; sources: Record<string, string> } | null>(null);
  const libsReady = libNames.length === 0 || libs?.key === libKey;
  const srcDoc = useMemo(() => (libsReady ? animationSrcDoc(o.code, libs?.key === libKey ? libs.sources : {}) : ''), [o.code, libsReady, libs, libKey]);
  const info = animationInfo(o.code);

  useEffect(() => {
    if (libNames.length === 0) return;
    let cancelled = false;
    // Une bibliothèque introuvable n'empêche pas la scène de s'ouvrir : elle dira ce qui lui manque
    Promise.all(libNames.map((n) => loadSceneLib(n).then((src) => [n, src] as const, (err) => { console.error('[scène]', err); return null; })))
      .then((pairs) => { if (!cancelled) setLibs({ key: libKey, sources: Object.fromEntries(pairs.filter((x): x is readonly [string, string] => !!x)) }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libKey]);

  const assetsKey = JSON.stringify(o.assets ?? []);
  const sendAssets = useCallback(() => {
    const list = o.assets ?? [];
    if (list.length === 0) return;
    const target = frameRef.current?.contentWindow;
    void Promise.all(list.map((a) => loadSceneAsset(a.path).then(
      (f) => ({ name: a.name, type: f.type, buffer: f.buffer }),
      (err) => { console.error('[scène]', err); return a.name; },
    ))).then((loaded) => {
      // Le cadre a pu disparaître entre-temps ; s'il s'est rechargé, il redemande ses fichiers
      if (!target || frameRef.current?.contentWindow !== target) return;
      const files = loaded.filter((x): x is { name: string; type: string; buffer: ArrayBuffer } => typeof x !== 'string');
      const missing = loaded.filter((x): x is string => typeof x === 'string');
      // Copie (pas de transfert) : les octets restent en mémoire pour la prochaine ouverture
      target.postMessage({ gc: 'anim', cmd: 'assets', files, missing }, '*');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsKey]);

  const post = useCallback((message: Record<string, unknown>) => {
    // Origine opaque (cadre isolé) : pas de cible plus précise que « * » ; le message ne porte
    // qu'un numéro d'étape
    frameRef.current?.contentWindow?.postMessage({ gc: 'anim', ...message }, '*');
  }, []);

  useEffect(() => {
    stepRef.current = step;
    post({ cmd: 'goto', step });
  }, [step, post]);

  // L'animation s'annonce quand elle est prête : on lui donne l'étape où en est la séance ; elle
  // demande aussi ses fichiers joints
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      const data = e.data as { gc?: unknown; ev?: unknown } | null;
      if (!data || data.gc !== 'anim') return;
      if (data.ev === 'ready') post({ cmd: 'init', step: stepRef.current });
      else if (data.ev === 'assets') sendAssets();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, sendAssets]);

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
      {!libsReady && <div className="wban__wait">Chargement de la scène…</div>}
      {libsReady && <iframe
        ref={frameRef}
        srcDoc={srcDoc}
        title={o.title ?? info.title ?? 'Animation'}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        style={{ pointerEvents: play && o.interactive ? 'auto' : 'none' }}
      />}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wban { position: relative; overflow: hidden; border-radius: 6px; background: #FFFFFF; }
.wban iframe { width: 100%; height: 100%; border: 0; display: block; }
.wban__wait { position: absolute; inset: 0; display: grid; place-items: center; color: #6B7280; font: 500 14px/1.3 Inter, system-ui, sans-serif; }
`;
