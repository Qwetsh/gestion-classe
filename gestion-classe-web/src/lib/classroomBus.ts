/**
 * Bus de commandes du mode « en classe » : un canal Realtime par séance, partagé entre
 * l'écran (/classe, tableau blanc) et le téléphone. L'écran s'y abonne une fois ; les
 * composants (plan de classe, tableau) écoutent et envoient à travers ce bus.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { CLASSROOM_EVENT, classroomChannelName, type ClassroomCommand } from './classroomProtocol';

export interface ClassroomBus {
  sessionId: string;
  send: (cmd: ClassroomCommand) => void;
  subscribe: (listener: (cmd: ClassroomCommand) => void) => () => void;
  close: () => void;
}

export function createClassroomBus(sessionId: string): ClassroomBus {
  const listeners = new Set<(cmd: ClassroomCommand) => void>();
  const channel: RealtimeChannel = supabase
    .channel(classroomChannelName(sessionId), { config: { broadcast: { self: false } } })
    .on('broadcast', { event: CLASSROOM_EVENT }, ({ payload }) => {
      const cmd = payload as ClassroomCommand;
      for (const l of listeners) {
        try { l(cmd); } catch (err) { console.warn('[classroomBus] écouteur :', err); }
      }
    })
    .subscribe();

  return {
    sessionId,
    send: (cmd) => { void channel.send({ type: 'broadcast', event: CLASSROOM_EVENT, payload: cmd }); },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    close: () => { listeners.clear(); void supabase.removeChannel(channel); },
  };
}
