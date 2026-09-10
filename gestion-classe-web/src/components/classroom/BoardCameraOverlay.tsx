/**
 * Caméra du téléphone en direct sur le tableau (visualiseur) : réception WebRTC.
 * Le téléphone envoie une offre sur le canal de la séance ; l'écran répond, affiche le flux,
 * et peut geler une image (capture) pour la poser sur la page et l'annoter.
 *
 * Signalisation = commandes `camera` du protocole (offer / answer / ice / stop).
 * Serveurs STUN publics de Google ; en réseau fermé, les deux appareils sur le même Wi-Fi
 * se trouvent en local sans STUN.
 */
import { useEffect, useRef, useState } from 'react';
import type { ClassroomBus } from '../../lib/classroomBus';
import type { ClassroomCommand } from '../../lib/classroomProtocol';

interface Props {
  bus: ClassroomBus;
  /** Offre reçue qui a déclenché l'ouverture. */
  offer: string;
  onCapture: (blob: Blob, width: number, height: number) => void;
  onClose: () => void;
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function BoardCameraOverlay({ bus, offer, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'failed' | 'ended'>('connecting');
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setStatus('live');
      }
    };
    pc.onicecandidate = (e) => { if (e.candidate) bus.send({ kind: 'camera', action: 'ice', candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setStatus('failed');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') setStatus((s) => (s === 'live' ? 'ended' : s));
    };
    const unsubscribe = bus.subscribe((cmd: ClassroomCommand) => {
      if (cmd.kind !== 'camera') return;
      if (cmd.action === 'ice' && cmd.candidate) void pc.addIceCandidate(cmd.candidate).catch(() => undefined);
      if (cmd.action === 'stop') setStatus('ended');
    });
    (async () => {
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: offer });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        bus.send({ kind: 'camera', action: 'answer', sdp: answer.sdp });
      } catch (err) {
        console.warn('[camera] réponse WebRTC :', err);
        setStatus('failed');
      }
    })();
    return () => {
      unsubscribe();
      pc.close();
      pcRef.current = null;
    };
    // L'offre initiale suffit : une nouvelle offre remonte le composant (key)
  }, [bus, offer]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob((blob) => { if (blob) onCapture(blob, c.width, c.height); }, 'image/jpeg', 0.9);
  };

  const close = () => {
    bus.send({ kind: 'camera', action: 'stop' });
    onClose();
  };

  return (
    <div className="wbcam" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wbcam__box">
        <video ref={videoRef} autoPlay playsInline muted className={frozen ? 'is-frozen' : ''} onPause={() => setFrozen(true)} onPlay={() => setFrozen(false)} />
        {status !== 'live' && (
          <div className="wbcam__status">
            {status === 'connecting' ? 'Connexion à la caméra du téléphone…' : status === 'failed' ? 'Connexion impossible (réseau ?)' : 'Caméra arrêtée'}
          </div>
        )}
        <div className="wbcam__bar">
          <button type="button" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }} disabled={status !== 'live'}>{frozen ? 'Reprendre' : 'Figer'}</button>
          <button type="button" className="is-primary" onClick={capture} disabled={status !== 'live'}>Capturer sur la page</button>
          <button type="button" onClick={close}>Fermer</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbcam { position: fixed; inset: 0; z-index: 26; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.8); font-family: Inter, system-ui, sans-serif; }
.wbcam__box { position: relative; width: min(1100px, calc(100vw - 40px)); border-radius: 18px; overflow: hidden; background: #000; box-shadow: 0 30px 90px rgba(0,0,0,0.6); }
.wbcam video { display: block; width: 100%; max-height: calc(100vh - 160px); background: #000; }
.wbcam video.is-frozen { filter: saturate(0.8); }
.wbcam__status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #F9FAFB; font: 600 20px/1.3 Inter, system-ui, sans-serif; background: rgba(0,0,0,0.5); }
.wbcam__bar { display: flex; justify-content: center; gap: 10px; padding: 12px; background: #111827; }
.wbcam__bar button { height: 46px; padding: 0 18px; border: 0; border-radius: 12px; background: #1F2937; color: #F9FAFB; font: 600 15px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbcam__bar button.is-primary { background: #4F46E5; }
.wbcam__bar button:disabled { opacity: 0.45; cursor: default; }
`;
