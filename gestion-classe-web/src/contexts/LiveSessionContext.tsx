import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchClassesForUser,
  fetchRoomsForUser,
  fetchStudentsForClass,
  fetchSeatingPlan,
  createSession,
  insertEvent,
  endSession as endSessionQuery,
  deleteEvent,
  uploadEventPhoto,
  updateEventPhotoPath,
  updateSessionNotes,
  cancelSession,
  fetchEventsForSession,
  fetchOralEvaluations,
  insertOralEvaluation,
  deleteOralEvaluationsForClass,
  type ClassInfo,
  type RoomInfo,
  type StudentInfo,
  type SessionEvent,
  type OralEvaluation,
} from '../lib/liveSessionQueries';

export type LiveSessionStep = 'idle' | 'select-class' | 'select-room' | 'seating-preview' | 'recording';

export interface ActiveSortie {
  subtype: string;
  timestamp: string;
}

interface LiveSessionState {
  step: LiveSessionStep;
  minimized: boolean;
  classes: ClassInfo[];
  rooms: RoomInfo[];
  selectedClass: ClassInfo | null;
  selectedRoom: RoomInfo | null;
  students: StudentInfo[];
  positions: Record<string, string>; // "row-col" -> studentId
  sessionId: string | null;
  events: SessionEvent[];
  startedAt: string | null;
  notes: string | null;
  activeSorties: Record<string, ActiveSortie>; // studentId -> sortie info
  oralEvaluations: OralEvaluation[];
  loading: boolean;
  error: string | null;
}

interface LiveSessionActions {
  startFlow: () => void;
  selectClass: (cls: ClassInfo) => void;
  selectRoom: (room: RoomInfo) => void;
  goBack: () => void;
  startSession: () => void;
  addEvent: (studentId: string, type: string, subtype?: string | null, note?: string | null, photo?: File | null) => void;
  removeLastEvent: (studentId: string, type: string) => void;
  deleteEventById: (eventId: string) => void;
  endSession: () => void;
  cancelFlow: () => void;
  cancelSessionAction: () => void;
  minimize: () => void;
  restore: () => void;
  updateNotes: (notes: string | null) => void;
  markReturn: (studentId: string) => void;
  addOralEvaluation: (studentId: string, grade: number) => void;
  resetOralEvaluations: () => void;
  getAbsentStudentIds: () => Set<string>;
  getStudentWithSortie: (studentId: string) => ActiveSortie | null;
}

const LiveSessionContext = createContext<(LiveSessionState & LiveSessionActions) | null>(null);

const initialState: LiveSessionState = {
  step: 'idle',
  minimized: false,
  classes: [],
  rooms: [],
  selectedClass: null,
  selectedRoom: null,
  students: [],
  positions: {},
  sessionId: null,
  events: [],
  startedAt: null,
  notes: null,
  activeSorties: {},
  oralEvaluations: [],
  loading: false,
  error: null,
};

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<LiveSessionState>(initialState);

  const startFlow = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, step: 'select-class', loading: true, error: null }));
    try {
      const classes = await fetchClassesForUser(user.id);
      setState(s => ({ ...s, classes, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de chargement des classes', loading: false }));
    }
  }, [user]);

  const selectClass = useCallback(async (cls: ClassInfo) => {
    if (!user) return;
    setState(s => ({ ...s, selectedClass: cls, step: 'select-room', loading: true, error: null }));
    try {
      const rooms = await fetchRoomsForUser(user.id);
      setState(s => ({ ...s, rooms, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de chargement des salles', loading: false }));
    }
  }, [user]);

  const selectRoom = useCallback(async (room: RoomInfo) => {
    if (!state.selectedClass) return;
    setState(s => ({ ...s, selectedRoom: room, step: 'seating-preview', loading: true, error: null }));
    try {
      const [students, positions] = await Promise.all([
        fetchStudentsForClass(state.selectedClass.id),
        fetchSeatingPlan(state.selectedClass.id, room.id),
      ]);
      setState(s => ({ ...s, students, positions, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de chargement du plan', loading: false }));
    }
  }, [state.selectedClass]);

  const goBack = useCallback(() => {
    setState(s => {
      if (s.step === 'select-room') return { ...s, step: 'select-class', selectedClass: null };
      if (s.step === 'seating-preview') return { ...s, step: 'select-room', selectedRoom: null, students: [], positions: {} };
      return s;
    });
  }, []);

  const startSession = useCallback(async () => {
    if (!user || !state.selectedClass || !state.selectedRoom) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const sessionId = await createSession(user.id, state.selectedClass.id, state.selectedRoom.id);
      const now = new Date().toISOString();
      // Load oral evaluations for this class
      let oralEvaluations: OralEvaluation[] = [];
      try {
        oralEvaluations = await fetchOralEvaluations(user.id, state.selectedClass.id);
      } catch {
        // Non-critical - oral eval table might not exist yet
      }
      setState(s => ({ ...s, sessionId, startedAt: now, step: 'recording', events: [], notes: null, activeSorties: {}, oralEvaluations, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors du demarrage de la seance', loading: false }));
    }
  }, [user, state.selectedClass, state.selectedRoom]);

  const addEvent = useCallback(async (
    studentId: string,
    type: string,
    subtype?: string | null,
    note?: string | null,
    photo?: File | null
  ) => {
    if (!state.sessionId || !user) return;
    try {
      const event = await insertEvent(state.sessionId, studentId, type, subtype, note);
      setState(s => {
        const newEvents = [...s.events, event];
        const newSorties = { ...s.activeSorties };

        // Track active sorties
        if (type === 'sortie' && subtype) {
          newSorties[studentId] = { subtype, timestamp: event.timestamp };
        }

        return { ...s, events: newEvents, activeSorties: newSorties };
      });

      // Haptic feedback via Vibration API
      if (navigator.vibrate) navigator.vibrate(15);

      // Upload photo in background if provided
      if (photo) {
        try {
          const photoPath = await uploadEventPhoto(user.id, event.id, photo);
          await updateEventPhotoPath(event.id, photoPath);
          setState(s => ({
            ...s,
            events: s.events.map(e => e.id === event.id ? { ...e, photo_path: photoPath } : e),
          }));
        } catch {
          console.warn('Photo upload failed for event', event.id);
        }
      }
    } catch {
      setState(s => ({ ...s, error: 'Erreur d\'enregistrement' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, [state.sessionId, user]);

  const removeLastEvent = useCallback(async (studentId: string, type: string) => {
    const matching = state.events
      .filter(e => e.student_id === studentId && e.type === type);
    const last = matching[matching.length - 1];
    if (!last) return;
    try {
      await deleteEvent(last.id);
      setState(s => {
        const newEvents = s.events.filter(e => e.id !== last.id);
        const newSorties = { ...s.activeSorties };
        // If deleting a sortie, remove from active sorties
        if (type === 'sortie') {
          delete newSorties[studentId];
        }
        return { ...s, events: newEvents, activeSorties: newSorties };
      });
    } catch {
      // silently fail
    }
  }, [state.events]);

  const deleteEventById = useCallback(async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      setState(s => {
        const deletedEvent = s.events.find(e => e.id === eventId);
        const newEvents = s.events.filter(e => e.id !== eventId);
        const newSorties = { ...s.activeSorties };
        // If deleting a sortie event, remove active sortie tracking
        if (deletedEvent?.type === 'sortie') {
          delete newSorties[deletedEvent.student_id];
        }
        return { ...s, events: newEvents, activeSorties: newSorties };
      });
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors de la suppression' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, []);

  const endSessionAction = useCallback(async () => {
    if (!state.sessionId) return;
    setState(s => ({ ...s, loading: true }));
    try {
      await endSessionQuery(state.sessionId);
      setState({ ...initialState });
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors de la fin de seance', loading: false }));
    }
  }, [state.sessionId]);

  const cancelSessionAction = useCallback(async () => {
    if (!state.sessionId) return;
    setState(s => ({ ...s, loading: true }));
    try {
      await cancelSession(state.sessionId);
      setState({ ...initialState });
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors de l\'annulation', loading: false }));
    }
  }, [state.sessionId]);

  const cancelFlow = useCallback(() => {
    // Only cancel if no active session (not in recording)
    if (state.step !== 'recording') {
      setState({ ...initialState });
    }
  }, [state.step]);

  const minimize = useCallback(() => {
    setState(s => ({ ...s, minimized: true }));
  }, []);

  const restore = useCallback(() => {
    setState(s => ({ ...s, minimized: false }));
  }, []);

  const updateNotesAction = useCallback(async (notes: string | null) => {
    if (!state.sessionId) return;
    try {
      await updateSessionNotes(state.sessionId, notes);
      setState(s => ({ ...s, notes }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de sauvegarde des notes' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, [state.sessionId]);

  const markReturn = useCallback(async (studentId: string) => {
    if (!state.sessionId) return;
    try {
      // Add a 'retour' event to mark the student's return
      const event = await insertEvent(state.sessionId, studentId, 'retour');
      setState(s => {
        const newSorties = { ...s.activeSorties };
        delete newSorties[studentId];
        return { ...s, events: [...s.events, event], activeSorties: newSorties };
      });
      if (navigator.vibrate) navigator.vibrate(15);
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors du marquage retour' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, [state.sessionId]);

  const addOralEvaluation = useCallback(async (studentId: string, grade: number) => {
    if (!user || !state.selectedClass) return;
    try {
      const evaluation = await insertOralEvaluation(user.id, studentId, state.selectedClass.id, grade);
      setState(s => ({ ...s, oralEvaluations: [...s.oralEvaluations, evaluation] }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur d\'enregistrement de l\'evaluation' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, [user, state.selectedClass]);

  const resetOralEvaluations = useCallback(async () => {
    if (!user || !state.selectedClass) return;
    try {
      await deleteOralEvaluationsForClass(user.id, state.selectedClass.id);
      setState(s => ({ ...s, oralEvaluations: [] }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur lors de la reinitialisation' }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 2000);
    }
  }, [user, state.selectedClass]);

  const getAbsentStudentIds = useCallback((): Set<string> => {
    const absents = new Set<string>();
    const counts: Record<string, number> = {};
    for (const e of state.events) {
      if (e.type === 'absence') {
        counts[e.student_id] = (counts[e.student_id] || 0) + 1;
      }
    }
    for (const [id, count] of Object.entries(counts)) {
      if (count % 2 === 1) absents.add(id);
    }
    return absents;
  }, [state.events]);

  const getStudentWithSortie = useCallback((studentId: string): ActiveSortie | null => {
    return state.activeSorties[studentId] || null;
  }, [state.activeSorties]);

  return (
    <LiveSessionContext.Provider
      value={{
        ...state,
        startFlow,
        selectClass,
        selectRoom,
        goBack,
        startSession,
        addEvent,
        removeLastEvent,
        deleteEventById,
        endSession: endSessionAction,
        cancelFlow,
        cancelSessionAction,
        minimize,
        restore,
        updateNotes: updateNotesAction,
        markReturn,
        addOralEvaluation,
        resetOralEvaluations,
        getAbsentStudentIds,
        getStudentWithSortie,
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) throw new Error('useLiveSession must be used within LiveSessionProvider');
  return ctx;
}
