/**
 * Protocole du canal de commandes téléphone → écran projeté (mode « en classe »).
 * Doit rester identique à gestion-classe-mobile/services/sync/classroomChannel.ts.
 *
 * Realtime broadcast, non persisté : perdre une commande est sans conséquence.
 */
export type ClassroomCommand =
  | { kind: 'timer'; action: 'start'; seconds: number; label?: string }
  | { kind: 'timer'; action: 'stop' }
  /** Tirage au sort ; `source: 'board'` quand il vient du tableau (le téléphone l'affiche). */
  | { kind: 'pick'; studentId: string | null; label?: string; source?: 'phone' | 'board' }
  | { kind: 'curtain'; on: boolean }
  | { kind: 'view'; mode: 'plan' | 'board' }
  /** Téléphone → écran : photo déposée dans le bucket board-assets, à poser sur la page du tableau. */
  | { kind: 'photo'; path: string; width: number; height: number; caption?: string }
  /** Écran → téléphone : « +1 tampon » demandé depuis le tableau (le téléphone reste la source de vérité). */
  | { kind: 'stamp'; studentId: string; source: 'board' }
  /** Caméra du téléphone en direct (WebRTC) : signalisation dans les deux sens. */
  | { kind: 'camera'; action: 'offer'; sdp: string }
  | { kind: 'camera'; action: 'answer'; sdp?: string }
  | { kind: 'camera'; action: 'ice'; candidate: RTCIceCandidateInit }
  | { kind: 'camera'; action: 'stop' };

export const CLASSROOM_EVENT = 'cmd';
export const classroomChannelName = (sessionId: string) => `classroom:${sessionId}`;
