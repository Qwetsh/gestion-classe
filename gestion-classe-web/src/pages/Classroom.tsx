/**
 * Mode « en classe » — vue projetée (TBI / vidéoprojecteur).
 *
 * Première brique : prouver le lien téléphone → écran.
 * - Attend qu'une séance démarre (depuis le téléphone ou le web).
 * - Affiche le plan de classe de la séance, plein écran.
 * - Réagit en direct aux événements enregistrés sur le téléphone (Realtime),
 *   avec un repli par relecture périodique si le canal décroche.
 *
 * Aucune saisie ici : l'écran est un afficheur, jamais une source de données.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  fetchEventsForSession,
  fetchSeatingPlan,
  fetchStudentsForClass,
  type RoomInfo,
  type SessionEvent,
  type StudentInfo,
} from '../lib/liveSessionQueries';
import { buildCellToGroup, tableColor } from '../lib/seatingLayouts';
import type { ClassroomCommand } from '../lib/classroomProtocol';
import { Whiteboard } from '../components/classroom/Whiteboard';
import { createClassroomBus, type ClassroomBus } from '../lib/classroomBus';

interface ActiveSession {
  id: string;
  class_id: string;
  room_id: string;
  topic: string | null;
  started_at: string;
  ended_at: string | null;
}

interface Flash {
  type: string;
  subtype: string | null;
  at: number;
}

const FLASH_MS = 2600;
const POLL_MS = 15000;
const TIMER_DONE_MS = 8000;

const EVENT_STYLE: Record<string, { color: string; label: string }> = {
  participation: { color: '#34D399', label: '+1' },
  bavardage: { color: '#FBBF24', label: 'Malus' },
  sortie: { color: '#A78BFA', label: 'Sortie' },
  retour: { color: '#22D3EE', label: 'Retour' },
  absence: { color: '#EF4444', label: 'Absent' },
  remarque: { color: '#60A5FA', label: 'Remarque' },
};

const SORTIE_LABEL: Record<string, string> = {
  infirmerie: 'Infirmerie',
  toilettes: 'Toilettes',
  vie_scolaire: 'Vie scolaire',
  autre: 'Sortie',
};

function firstName(pseudo: string): string {
  return pseudo.split(' ')[0] || pseudo;
}

function suffix(pseudo: string): string {
  const parts = pseudo.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function formatElapsed(fromIso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} h ${String(m % 60).padStart(2, '0')}`;
  return `${m} min`;
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

export function Classroom() {
  const { user } = useAuth();
  const userId = user?.id;

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [className, setClassName] = useState('');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [flashes, setFlashes] = useState<Record<string, Flash>>({});
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Commandes reçues du téléphone (canal broadcast, non persisté)
  const [timer, setTimer] = useState<{ endsAt: number; label?: string } | null>(null);
  const [timerDoneAt, setTimerDoneAt] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [pick, setPick] = useState<{ studentId: string; label?: string } | null>(null);
  const [curtain, setCurtain] = useState(false);
  const [view, setView] = useState<'plan' | 'board'>('plan');
  const [lastFlash, setLastFlash] = useState<{ text: string; at: number } | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session]);

  // Horloge pour la durée de séance
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);

  // Séance active : la plus récente non terminée de l'enseignant
  const findActiveSession = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('sessions')
      .select('id, class_id, room_id, topic, started_at, ended_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('[Classroom] findActiveSession:', error);
      return;
    }
    const next = (data?.[0] as ActiveSession | undefined) ?? null;
    setSession((prev) => (prev?.id === next?.id ? prev : next));
  }, [userId]);

  // Écoute des séances : démarrage / fin / suppression.
  // À chaque (re)connexion du canal, on relit la séance active : rien ne peut être raté.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`classroom-sessions-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? {}) as Partial<ActiveSession>;
          const old = (payload.old ?? {}) as Partial<ActiveSession>;
          if (payload.eventType === 'INSERT' && row.id && !row.ended_at) {
            setSession(row as ActiveSession);
            return;
          }
          if (payload.eventType === 'UPDATE' && row.id) {
            if (row.id === sessionIdRef.current) {
              if (row.ended_at) setSession(null);
              else setSession(row as ActiveSession);
            } else if (!row.ended_at) {
              // Une autre séance vient d'être (ré)ouverte
              setSession(row as ActiveSession);
            }
            return;
          }
          if (payload.eventType === 'DELETE' && old.id === sessionIdRef.current) {
            setSession(null);
          }
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void findActiveSession();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, findActiveSession]);

  // Chargement du contexte de la séance (classe, salle, élèves, plan, événements)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const [cls, rm, sts, pos, evs] = await Promise.all([
          supabase.from('classes').select('name').eq('id', session.class_id).single(),
          supabase
            .from('rooms')
            .select('id, name, grid_rows, grid_cols, disabled_cells, table_groups')
            .eq('id', session.room_id)
            .single(),
          fetchStudentsForClass(session.class_id),
          fetchSeatingPlan(session.class_id, session.room_id),
          fetchEventsForSession(session.id),
        ]);
        if (cancelled) return;
        setClassName(cls.data?.name ?? '');
        setRoom((rm.data as RoomInfo | null) ?? null);
        setStudents(sts);
        setPositions(pos);
        setEvents(evs);
      } catch (err) {
        console.error('[Classroom] load session context:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Écoute des événements de la séance + repli par relecture périodique
  useEffect(() => {
    if (!session) return;
    const sessionId = session.id;

    const channel = supabase
      .channel(`classroom-events-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const ev = payload.new as SessionEvent;
          setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev]));
          setFlashes((prev) => ({ ...prev, [ev.student_id]: { type: ev.type, subtype: ev.subtype, at: Date.now() } }));
          setLastFlash({ text: `${ev.student_id}|${ev.type}|${ev.subtype ?? ''}`, at: Date.now() });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'events', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const old = payload.old as Partial<SessionEvent>;
          if (old.id) setEvents((prev) => prev.filter((e) => e.id !== old.id));
        }
      )
      .subscribe();

    const poll = window.setInterval(async () => {
      try {
        const evs = await fetchEventsForSession(sessionId);
        setEvents(evs);
      } catch {
        /* réseau absent : on garde l'état courant */
      }
    }, POLL_MS);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
      // Fin ou changement de séance : on repart d'un plan vierge
      setEvents([]);
      setFlashes({});
    };
  }, [session]);

  // Canal de commandes du téléphone : minuteur, tirage au sort, rideau, photo, caméra
  const [bus, setBus] = useState<ClassroomBus | null>(null);
  useEffect(() => {
    if (!session) return;
    const b = createClassroomBus(session.id);
    // Publié après le tour courant : le tableau blanc s'y branche quand il s'affiche
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) setBus(b); });
    const unsubscribe = b.subscribe((cmd: ClassroomCommand) => {
        switch (cmd.kind) {
          case 'timer':
            if (cmd.action === 'start') {
              setTimer({ endsAt: Date.now() + cmd.seconds * 1000, label: cmd.label });
              setTimerDoneAt(null);
            } else {
              setTimer(null);
              setTimerDoneAt(null);
            }
            break;
          case 'pick':
            setPick(cmd.studentId ? { studentId: cmd.studentId, label: cmd.label } : null);
            break;
          case 'curtain':
            setCurtain(cmd.on);
            break;
          case 'view':
            setView(cmd.mode);
            break;
          case 'photo':
          case 'camera':
            // Traités par le tableau blanc : on l'affiche s'il ne l'est pas déjà
            setView('board');
            break;
        }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      b.close();
      setBus(null);
      setTimer(null);
      setTimerDoneAt(null);
      setPick(null);
      setCurtain(false);
      setView('plan');
    };
  }, [session]);

  // Tic du minuteur (4 fois par seconde pendant qu'il tourne) et fin de compte à rebours
  useEffect(() => {
    if (!timer) return;
    const t = window.setInterval(() => {
      const nowMs = Date.now();
      setTick(nowMs);
      if (nowMs >= timer.endsAt) {
        setTimer(null);
        setTimerDoneAt(Date.now());
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [timer]);

  useEffect(() => {
    if (timerDoneAt === null) return;
    const t = window.setTimeout(() => setTimerDoneAt(null), TIMER_DONE_MS);
    return () => window.clearTimeout(t);
  }, [timerDoneAt]);

  // Expiration du message court du tableau blanc
  useEffect(() => {
    if (!lastFlash) return;
    const t = window.setTimeout(() => setLastFlash(null), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [lastFlash]);

  // Expiration des flashs
  useEffect(() => {
    const ids = Object.keys(flashes);
    if (ids.length === 0) return;
    const t = window.setTimeout(() => {
      const cutoff = Date.now() - FLASH_MS;
      setFlashes((prev) => {
        const next: Record<string, Flash> = {};
        for (const [id, f] of Object.entries(prev)) if (f.at > cutoff) next[id] = f;
        return next;
      });
    }, FLASH_MS + 50);
    return () => window.clearTimeout(t);
  }, [flashes]);

  // Plein écran (bouton ou touche F), bascule plan / tableau (touche B)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') toggleFullscreen();
      else if (k === 'b') setView((v) => (v === 'plan' ? 'board' : 'plan'));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // État par élève dérivé des événements
  const stateByStudent = useMemo(() => {
    const map = new Map<string, { participation: number; bavardage: number; absent: boolean; out: string | null }>();
    for (const ev of events) {
      const st = map.get(ev.student_id) ?? { participation: 0, bavardage: 0, absent: false, out: null };
      if (ev.type === 'participation') st.participation++;
      else if (ev.type === 'bavardage') st.bavardage++;
      else if (ev.type === 'absence') st.absent = true;
      else if (ev.type === 'sortie') st.out = ev.subtype ?? 'autre';
      else if (ev.type === 'retour') st.out = null;
      map.set(ev.student_id, st);
    }
    return map;
  }, [events]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const cellToGroup = useMemo(() => buildCellToGroup(room?.table_groups ?? []), [room]);
  const groupIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    (room?.table_groups ?? []).forEach((g, i) => (idx[g.id] = i));
    return idx;
  }, [room]);

  const participationTotal = events.filter((e) => e.type === 'participation').length;

  const timerRemaining = timer ? timer.endsAt - tick : 0;

  // Message court pour le tableau blanc : « Alyssa +1 » etc.
  const tickerText = (() => {
    if (!lastFlash) return null;
    const [studentId, type, subtype] = lastFlash.text.split('|');
    const st = studentMap.get(studentId);
    const style = EVENT_STYLE[type];
    if (!st || !style) return null;
    const label = type === 'sortie' && subtype ? SORTIE_LABEL[subtype] ?? style.label : style.label;
    return `${firstName(st.pseudo)} · ${label}`;
  })();
  const pickedStudent = pick ? studentMap.get(pick.studentId) : null;
  const pickedName = pickedStudent?.pseudo ?? pick?.label ?? '';

  return (
    <div className="classroom">
      <style>{CSS}</style>

      {!session ? (
        <div className="classroom__waiting">
          <div className="classroom__pulse" />
          <h1>En attente d'une séance</h1>
          <p>Démarre une séance sur ton téléphone, elle apparaîtra ici.</p>
          <span className={`classroom__rt ${realtimeOk ? 'is-ok' : ''}`}>
            {realtimeOk ? 'Connecté en direct' : 'Connexion au direct…'}
          </span>
        </div>
      ) : (
        <>
          <header className="classroom__header">
            <div>
              <div className="classroom__class">{className || '…'}</div>
              {session.topic && <div className="classroom__topic">{session.topic}</div>}
            </div>
            <div className="classroom__meta">
              <button className="classroom__viewbtn" onClick={() => setView('board')} title="Tableau blanc (B)">
                Tableau
              </button>
              <span className="classroom__stat">
                <b>{participationTotal}</b> implication{participationTotal > 1 ? 's' : ''}
              </span>
              <span className="classroom__stat">{formatElapsed(session.started_at, now)}</span>
              <span className={`classroom__rt ${realtimeOk ? 'is-ok' : ''}`} title={realtimeOk ? 'Direct actif' : 'Direct en reconnexion'} />
            </div>
          </header>

          {room ? (
            <main
              className="classroom__grid"
              style={{ gridTemplateColumns: `repeat(${room.grid_cols}, 1fr)`, gridTemplateRows: `repeat(${room.grid_rows}, 1fr)` }}
            >
              {Array.from({ length: room.grid_rows * room.grid_cols }).map((_, idx) => {
                const r = Math.floor(idx / room.grid_cols);
                const c = idx % room.grid_cols;
                const disabled = room.disabled_cells?.includes(`${r},${c}`);
                if (disabled) return <div key={idx} className="seat seat--void" />;

                const studentId = positions[`${r}-${c}`];
                const student = studentId ? studentMap.get(studentId) : null;
                const groupId = cellToGroup[`${r},${c}`];
                const palette = groupId ? tableColor(groupIndex[groupId] ?? 0) : null;

                if (!student) {
                  return <div key={idx} className="seat seat--empty" style={palette ? { borderColor: palette.border } : undefined} />;
                }

                const st = stateByStudent.get(student.id);
                const flash = flashes[student.id];
                const flashStyle = flash ? EVENT_STYLE[flash.type] : null;
                const cls = ['seat', 'seat--student', st?.absent ? 'is-absent' : '', st?.out ? 'is-out' : '', flash ? 'is-flash' : ''].join(' ');

                return (
                  <div
                    key={idx}
                    className={cls}
                    style={{
                      borderColor: palette?.border,
                      ...(flashStyle ? ({ '--flash': flashStyle.color } as React.CSSProperties) : {}),
                    }}
                  >
                    <div className="seat__name">
                      {firstName(student.pseudo)}
                      <span className="seat__suffix">{suffix(student.pseudo)}</span>
                    </div>
                    <div className="seat__dots">
                      {Array.from({ length: Math.min(st?.participation ?? 0, 8) }).map((_, i) => (
                        <i key={`p${i}`} className="dot dot--pos" />
                      ))}
                      {Array.from({ length: Math.min(st?.bavardage ?? 0, 8) }).map((_, i) => (
                        <i key={`m${i}`} className="dot dot--neg" />
                      ))}
                    </div>
                    {st?.absent && <div className="seat__badge seat__badge--abs">ABS</div>}
                    {!st?.absent && st?.out && <div className="seat__badge seat__badge--out">{SORTIE_LABEL[st.out] ?? 'Sortie'}</div>}
                    {flash && flashStyle && (
                      <div className="seat__flash" style={{ color: flashStyle.color }}>
                        {flash.type === 'sortie' && flash.subtype ? SORTIE_LABEL[flash.subtype] ?? flashStyle.label : flashStyle.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </main>
          ) : (
            <div className="classroom__waiting">
              <p>Chargement du plan de classe…</p>
            </div>
          )}

          <footer className="classroom__footer">Bureau</footer>

          {view === 'board' && (
            <Whiteboard
              sessionId={session.id}
              userId={userId ?? ''}
              ticker={tickerText}
              classroom={bus ? { bus, students: students.map((st) => ({ id: st.id, pseudo: st.pseudo, absent: stateByStudent.get(st.id)?.absent === true })) } : undefined}
              onClose={() => setView('plan')}
            />
          )}
        </>
      )}

      {/* Minuteur piloté depuis le téléphone */}
      {timer && (
        <div className={`classroom__timer ${timerRemaining <= 10000 ? 'is-urgent' : ''}`}>
          {timer.label && <span className="classroom__timer-label">{timer.label}</span>}
          {formatCountdown(timerRemaining)}
        </div>
      )}
      {timerDoneAt !== null && (
        <div className="classroom__overlay classroom__overlay--done">
          <div className="classroom__done">Temps écoulé</div>
        </div>
      )}

      {/* Élève tiré au sort */}
      {pick && (
        <div className="classroom__overlay classroom__overlay--pick">
          <div className="classroom__pick-label">Tirage au sort</div>
          <div className="classroom__pick-name">
            {firstName(pickedName)}
            <span className="classroom__pick-suffix">{suffix(pickedName)}</span>
          </div>
        </div>
      )}

      {/* Rideau */}
      {curtain && (
        <div className="classroom__curtain">
          <span>Regarde le professeur</span>
        </div>
      )}

      <button className="classroom__fs" onClick={toggleFullscreen} title="Plein écran (F)">
        {isFullscreen ? '✕' : '⛶'}
      </button>
    </div>
  );
}

const CSS = `
.classroom {
  position: fixed; inset: 0; overflow: hidden;
  background: #0F1117; color: #E5E7EB;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  display: flex; flex-direction: column;
  user-select: none;
}
.classroom__waiting {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  text-align: center; padding: 24px;
}
.classroom__waiting h1 { font-size: clamp(28px, 4vw, 52px); font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.classroom__waiting p { font-size: clamp(16px, 1.8vw, 24px); color: #9CA3AF; margin: 0; }
.classroom__pulse {
  width: 22px; height: 22px; border-radius: 50%; background: #6366F1;
  box-shadow: 0 0 0 0 rgba(99,102,241,0.6); animation: cr-pulse 2s ease-out infinite;
}
@keyframes cr-pulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.6);} 100% { box-shadow: 0 0 0 28px rgba(99,102,241,0);} }

.classroom__header {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  padding: clamp(12px, 1.6vh, 22px) clamp(16px, 2vw, 32px) 0;
}
.classroom__class { font-size: clamp(28px, 4.2vw, 56px); font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
.classroom__topic { font-size: clamp(14px, 1.6vw, 22px); color: #9CA3AF; margin-top: 6px; }
.classroom__meta { display: flex; align-items: center; gap: 22px; font-size: clamp(14px, 1.5vw, 20px); color: #9CA3AF; padding-bottom: 6px; }
.classroom__stat b { color: #34D399; font-weight: 700; }
.classroom__viewbtn {
  background: #1C2130; color: #E5E7EB; border: 1px solid #2A3044; border-radius: 10px;
  padding: 6px 14px; font: inherit; font-weight: 600; cursor: pointer;
}
.classroom__viewbtn:hover { background: #262C3D; }
.classroom__rt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #F59E0B; }
.classroom__rt.is-ok { background: #10B981; }
.classroom__waiting .classroom__rt { width: auto; height: auto; background: none; font-size: 13px; color: #F59E0B; margin-top: 8px; }
.classroom__waiting .classroom__rt.is-ok { color: #10B981; }

.classroom__grid {
  flex: 1; display: grid; gap: clamp(6px, 0.8vw, 12px);
  padding: clamp(10px, 1.6vh, 20px) clamp(16px, 2vw, 32px);
  min-height: 0;
}
.seat { position: relative; border-radius: 12px; border: 2px solid transparent; min-width: 0; min-height: 0; }
.seat--void { background: transparent; }
.seat--empty { background: #161A24; border-color: #1F2433; }
.seat--student {
  background: #1C2130; border-color: #2A3044;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 4px 6px; overflow: hidden;
  transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
}
.seat__name { font-size: clamp(13px, 1.7vw, 26px); font-weight: 600; line-height: 1.1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.seat__suffix { font-size: 0.62em; font-weight: 500; color: #9CA3AF; margin-left: 5px; }
.seat__dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 100%; min-height: 6px; }
.dot { display: inline-block; width: clamp(6px, 0.55vw, 9px); height: clamp(6px, 0.55vw, 9px); border-radius: 50%; }
.dot--pos { background: #34D399; }
.dot--neg { background: #FBBF24; }
.seat__badge {
  position: absolute; top: 4px; right: 4px; font-size: clamp(9px, 0.8vw, 12px); font-weight: 700;
  padding: 2px 6px; border-radius: 999px; letter-spacing: 0.04em;
}
.seat__badge--abs { background: #EF4444; color: #fff; }
.seat__badge--out { background: #6D28D9; color: #EDE9FE; }
.seat--student.is-absent { background: #1A1417; border-color: #3A1D22; opacity: 0.55; }
.seat--student.is-absent .seat__name { text-decoration: line-through; color: #9CA3AF; }
.seat--student.is-out { border-style: dashed; border-color: #6D28D9; opacity: 0.8; }
.seat--student.is-flash {
  transform: scale(1.06); z-index: 2;
  box-shadow: 0 0 0 3px var(--flash), 0 0 36px 4px color-mix(in srgb, var(--flash) 55%, transparent);
  border-color: var(--flash);
}
.seat__flash {
  position: absolute; left: 50%; top: 6px; transform: translateX(-50%);
  font-size: clamp(12px, 1.3vw, 20px); font-weight: 800; pointer-events: none;
  animation: cr-rise 2.4s ease-out forwards; text-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
@keyframes cr-rise {
  0% { opacity: 0; transform: translate(-50%, 8px) scale(0.8); }
  15% { opacity: 1; transform: translate(-50%, -4px) scale(1.15); }
  70% { opacity: 1; transform: translate(-50%, -10px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -22px) scale(1); }
}

.classroom__footer {
  text-align: center; color: #6B7280; font-size: clamp(11px, 1vw, 14px); letter-spacing: 0.2em; text-transform: uppercase;
  padding: 6px 0 clamp(8px, 1.2vh, 14px);
}
.classroom__timer {
  position: fixed; top: clamp(12px, 1.6vh, 22px); left: 50%; transform: translateX(-50%); z-index: 20;
  display: flex; align-items: baseline; gap: 14px;
  background: #1C2130; border: 2px solid #2A3044; border-radius: 18px;
  padding: clamp(6px, 1vh, 12px) clamp(18px, 2.4vw, 34px);
  font-size: clamp(34px, 5vw, 76px); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
  color: #F9FAFB; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.classroom__timer-label { font-size: 0.42em; font-weight: 500; color: #9CA3AF; }
.classroom__timer.is-urgent { border-color: #EF4444; color: #FCA5A5; animation: cr-urgent 1s ease-in-out infinite; }
@keyframes cr-urgent { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0);} 50% { box-shadow: 0 0 0 10px rgba(239,68,68,0.25);} }

.classroom__overlay {
  position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  background: rgba(15,17,23,0.82); backdrop-filter: blur(6px);
  animation: cr-fade .25s ease-out;
}
@keyframes cr-fade { from { opacity: 0; } to { opacity: 1; } }
.classroom__done { font-size: clamp(48px, 8vw, 120px); font-weight: 800; color: #FCA5A5; animation: cr-blink 1s ease-in-out infinite; }
@keyframes cr-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
.classroom__pick-label { font-size: clamp(16px, 2vw, 28px); color: #A5B4FC; text-transform: uppercase; letter-spacing: 0.25em; }
.classroom__pick-name {
  font-size: clamp(56px, 10vw, 150px); font-weight: 800; letter-spacing: -0.02em; line-height: 1;
  color: #FFFFFF; text-shadow: 0 0 60px rgba(99,102,241,0.55);
  animation: cr-pop .45s cubic-bezier(.2,1.4,.4,1);
}
.classroom__pick-suffix { font-size: 0.45em; font-weight: 600; color: #9CA3AF; margin-left: 0.25em; }
@keyframes cr-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.classroom__curtain {
  position: fixed; inset: 0; z-index: 40; background: #000;
  display: flex; align-items: center; justify-content: center;
  color: #374151; font-size: clamp(18px, 2.2vw, 30px); letter-spacing: 0.1em;
}

.classroom__fs {
  position: fixed; right: 14px; bottom: 12px; width: 38px; height: 38px; border-radius: 10px;
  background: rgba(255,255,255,0.06); color: #9CA3AF; border: 1px solid rgba(255,255,255,0.08);
  cursor: pointer; font-size: 16px; opacity: 0.35; transition: opacity .2s;
}
.classroom__fs:hover { opacity: 1; }
`;
