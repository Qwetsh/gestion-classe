/**
 * Vidéo (YouTube, lecteur embarqué) et site web en iframe.
 * Une barre de titre sert de prise pour déplacer l'objet (l'iframe avale les événements).
 * Un site est « annotable » par défaut : un voile transparent laisse l'encre passer par-dessus ;
 * le bouton « Interagir » retire le voile pour cliquer dans le site.
 *
 * Site pilotable (contrat « gc-anim », comme une animation : l'hôpital virtuel…) : il annonce ses
 * étapes à son chargement ; l'étape de la séance lui est envoyée à chaque changement (boutons du
 * tableau, « Suivant » du téléphone). Les messages ne partent que vers l'origine du site, et seuls
 * ceux de son cadre et de cette origine sont écoutés.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { videoEmbedUrl, type VideoObject, type WebObject } from '../../../lib/boardMedia';
import { learnSiteSteps, type ObjectCommand } from '../../../lib/boardReveal';

interface Props {
  o: VideoObject | WebObject;
  scale: number;
  active: boolean;
  onToggleInteractive: () => void;
  /** Étape de la séance (site pilotable). */
  step?: number;
  /** Commande d'un bouton (rejouer l'étape). */
  command?: ObjectCommand;
}

const BAR_UNITS = 26;

export function EmbedView({ o, scale, active, onToggleInteractive, step = 0, command }: Props) {
  const interactive = o.type === 'video' ? true : o.interactive === true;
  const src = o.type === 'video' ? videoEmbedUrl(o) : o.url;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stepRef = useRef(step);
  const origin = useMemo(() => { try { return new URL(src).origin; } catch { return null; } }, [src]);
  const pilotable = o.type === 'web' && origin !== null;
  const [announced, setAnnounced] = useState<number | null>(null);
  const stepCount = o.type === 'web' ? o.steps ?? announced ?? 0 : 0;

  const post = useCallback((message: Record<string, unknown>) => {
    if (!pilotable || !origin) return;
    frameRef.current?.contentWindow?.postMessage({ gc: 'anim', ...message }, origin);
  }, [pilotable, origin]);

  useEffect(() => {
    stepRef.current = step;
    post({ cmd: 'goto', step });
  }, [step, post]);

  // Le site s'annonce : on retient ses étapes et on lui donne celle où en est la séance
  useEffect(() => {
    if (!pilotable) return;
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || e.origin !== origin) return;
      const data = e.data as { gc?: unknown; ev?: unknown; steps?: unknown } | null;
      if (!data || data.gc !== 'anim' || data.ev !== 'ready') return;
      if (typeof data.steps === 'number') { learnSiteSteps(o.id, data.steps); setAnnounced(data.steps); }
      post({ cmd: 'init', step: stepRef.current });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pilotable, origin, o.id, post]);

  useEffect(() => {
    if (command?.command === 'replay' || command?.command === 'reset') post({ cmd: 'replay' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);
  const label = o.title ?? (o.type === 'video' ? 'Vidéo' : o.url.replace(/^https?:\/\//, ''));
  const barH = BAR_UNITS * scale;
  const hold = (e: React.PointerEvent | React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className="wbe" style={{ width: o.w * scale, height: o.h * scale }}>
      <div className="wbe__bar" style={{ height: barH, fontSize: Math.max(11, 13 * scale) }} title="Glisser pour déplacer">
        <span className="wbe__title">{o.type === 'video' ? '▶ ' : '🌐 '}{label}{stepCount > 1 && <span className="wbe__step"> · {Math.min(step, stepCount - 1) + 1} / {stepCount}</span>}</span>
        <span className="wbe__actions" onPointerDown={hold}>
          {o.type === 'web' && (
            <button type="button" onClick={onToggleInteractive} title={interactive ? 'Repasser en mode annotation (l\'encre passe au-dessus)' : 'Interagir avec le site (cliquer, défiler)'}>
              {interactive ? 'Annoter' : 'Interagir'}
            </button>
          )}
          <a href={o.url} target="_blank" rel="noreferrer" title="Ouvrir dans un nouvel onglet (si le site refuse l'affichage ici)">↗</a>
        </span>
      </div>
      <div className="wbe__body" style={{ top: barH }}>
        <iframe
          ref={frameRef}
          src={src}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          style={{ pointerEvents: interactive && !active ? 'auto' : interactive && active ? 'auto' : 'none' }}
        />
        {!interactive && <div className="wbe__veil" title="Site en mode annotation : cliquer « Interagir » pour l'utiliser" />}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbe { position: relative; overflow: hidden; border-radius: 8px; background: #111827; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
.wbe__bar { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 10px; background: #1F2937; color: #E5E7EB; font-family: Inter, system-ui, sans-serif; font-weight: 500; cursor: move; user-select: none; }
.wbe__title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wbe__step { color: #A5B4FC; }
.wbe__actions { display: flex; align-items: center; gap: 6px; flex: none; }
.wbe__actions button, .wbe__actions a { height: 22px; padding: 0 8px; border: 0; border-radius: 6px; background: #4F46E5; color: #FFFFFF; font: 600 11px/22px Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; }
.wbe__actions a { background: #374151; }
.wbe__body { position: absolute; left: 0; right: 0; bottom: 0; background: #FFFFFF; }
.wbe__body iframe { width: 100%; height: 100%; border: 0; display: block; }
.wbe__veil { position: absolute; inset: 0; }
`;
