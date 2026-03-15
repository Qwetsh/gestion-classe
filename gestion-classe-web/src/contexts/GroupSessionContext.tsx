import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchClassesForUser, fetchStudentsForClass, type ClassInfo, type StudentInfo } from '../lib/liveSessionQueries';
import {
  fetchTpTemplates,
  createGroupSession,
  loadGroupSession,
  updateGrade,
  updateMalus,
  completeGroupSession,
  type TpTemplate,
  type GroupSessionData,
} from '../lib/groupSessionQueries';

export type GroupSessionStep = 'idle' | 'select-class' | 'setup' | 'grading' | 'summary';

interface TempCriteria {
  label: string;
  max_points: number;
}

interface TempGroup {
  id: string;
  name: string;
  memberIds: string[];
}

interface GroupSessionState {
  step: GroupSessionStep;
  classes: ClassInfo[];
  selectedClass: ClassInfo | null;
  students: StudentInfo[];
  templates: TpTemplate[];
  sessionName: string;
  tempCriteria: TempCriteria[];
  tempGroups: TempGroup[];
  // Active grading
  sessionId: string | null;
  sessionData: GroupSessionData | null;
  activeGroupIndex: number;
  loading: boolean;
  error: string | null;
}

interface GroupSessionActions {
  startFlow: () => void;
  selectClass: (cls: ClassInfo) => void;
  setSessionName: (name: string) => void;
  applyTemplate: (template: TpTemplate) => void;
  addCriteria: (label: string, maxPoints: number) => void;
  removeCriteria: (index: number) => void;
  addGroup: (name: string) => void;
  removeGroup: (id: string) => void;
  toggleMember: (groupId: string, studentId: string) => void;
  randomizeGroups: (perGroup: number) => void;
  startGrading: () => void;
  setActiveGroup: (index: number) => void;
  setGrade: (groupId: string, criteriaId: string, points: number) => void;
  applyMalus: (groupId: string) => void;
  resetMalus: (groupId: string) => void;
  finishSession: () => void;
  cancelFlow: () => void;
  goBack: () => void;
}

const GroupSessionContext = createContext<(GroupSessionState & GroupSessionActions) | null>(null);

const initialState: GroupSessionState = {
  step: 'idle',
  classes: [],
  selectedClass: null,
  students: [],
  templates: [],
  sessionName: '',
  tempCriteria: [],
  tempGroups: [],
  sessionId: null,
  sessionData: null,
  activeGroupIndex: 0,
  loading: false,
  error: null,
};

let groupCounter = 0;

export function GroupSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GroupSessionState>(initialState);

  const startFlow = useCallback(async () => {
    if (!user) return;
    setState(s => ({ ...s, step: 'select-class', loading: true, error: null }));
    try {
      const classes = await fetchClassesForUser(user.id);
      setState(s => ({ ...s, classes, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de chargement', loading: false }));
    }
  }, [user]);

  const selectClass = useCallback(async (cls: ClassInfo) => {
    if (!user) return;
    setState(s => ({ ...s, selectedClass: cls, step: 'setup', loading: true, error: null }));
    try {
      const [students, templates] = await Promise.all([
        fetchStudentsForClass(cls.id),
        fetchTpTemplates(user.id),
      ]);
      groupCounter = 0;
      setState(s => ({ ...s, students, templates, loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur de chargement', loading: false }));
    }
  }, [user]);

  const setSessionName = useCallback((name: string) => {
    setState(s => ({ ...s, sessionName: name }));
  }, []);

  const applyTemplate = useCallback((template: TpTemplate) => {
    setState(s => ({
      ...s,
      tempCriteria: template.criteria.map(c => ({ label: c.label, max_points: c.max_points })),
    }));
  }, []);

  const addCriteria = useCallback((label: string, maxPoints: number) => {
    setState(s => ({ ...s, tempCriteria: [...s.tempCriteria, { label, max_points: maxPoints }] }));
  }, []);

  const removeCriteria = useCallback((index: number) => {
    setState(s => ({ ...s, tempCriteria: s.tempCriteria.filter((_, i) => i !== index) }));
  }, []);

  const addGroup = useCallback((name: string) => {
    groupCounter++;
    setState(s => ({
      ...s,
      tempGroups: [...s.tempGroups, { id: `temp-${groupCounter}`, name, memberIds: [] }],
    }));
  }, []);

  const removeGroup = useCallback((id: string) => {
    setState(s => ({ ...s, tempGroups: s.tempGroups.filter(g => g.id !== id) }));
  }, []);

  const toggleMember = useCallback((groupId: string, studentId: string) => {
    setState(s => {
      // Remove from any group first
      const groups = s.tempGroups.map(g => ({
        ...g,
        memberIds: g.memberIds.filter(id => id !== studentId),
      }));
      // Add to target group
      return {
        ...s,
        tempGroups: groups.map(g =>
          g.id === groupId ? { ...g, memberIds: [...g.memberIds, studentId] } : g
        ),
      };
    });
  }, []);

  const randomizeGroups = useCallback((perGroup: number) => {
    setState(s => {
      const shuffled = [...s.students].sort(() => Math.random() - 0.5);
      const numGroups = Math.ceil(shuffled.length / perGroup);
      const groups: TempGroup[] = [];
      for (let i = 0; i < numGroups; i++) {
        groupCounter++;
        groups.push({
          id: `temp-${groupCounter}`,
          name: `Groupe ${i + 1}`,
          memberIds: shuffled.slice(i * perGroup, (i + 1) * perGroup).map(s => s.id),
        });
      }
      return { ...s, tempGroups: groups };
    });
  }, []);

  const startGrading = useCallback(async () => {
    if (!user || !state.selectedClass) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const sessionId = await createGroupSession(
        user.id,
        state.selectedClass.id,
        state.sessionName,
        state.tempCriteria,
        state.tempGroups,
      );
      const sessionData = await loadGroupSession(sessionId);
      setState(s => ({ ...s, sessionId, sessionData, step: 'grading', activeGroupIndex: 0, loading: false }));
    } catch (e) {
      setState(s => ({ ...s, error: 'Erreur de creation', loading: false }));
    }
  }, [user, state.selectedClass, state.sessionName, state.tempCriteria, state.tempGroups]);

  const setActiveGroup = useCallback((index: number) => {
    setState(s => ({ ...s, activeGroupIndex: index }));
  }, []);

  const setGrade = useCallback(async (groupId: string, criteriaId: string, points: number) => {
    try {
      await updateGrade(groupId, criteriaId, points);
      setState(s => {
        if (!s.sessionData) return s;
        const groups = s.sessionData.groups.map(g => {
          if (g.id !== groupId) return g;
          const grades = g.grades.map(gr =>
            gr.criteria_id === criteriaId ? { ...gr, points_awarded: points } : gr
          );
          // If grade doesn't exist yet, add it
          if (!grades.find(gr => gr.criteria_id === criteriaId)) {
            grades.push({ criteria_id: criteriaId, points_awarded: points });
          }
          return { ...g, grades };
        });
        return { ...s, sessionData: { ...s.sessionData, groups } };
      });
    } catch {
      // silent
    }
  }, []);

  const applyMalusAction = useCallback(async (groupId: string) => {
    setState(s => {
      if (!s.sessionData) return s;
      const groups = s.sessionData.groups.map(g =>
        g.id === groupId ? { ...g, conduct_malus: g.conduct_malus + 1 } : g
      );
      const newMalus = groups.find(g => g.id === groupId)!.conduct_malus;
      updateMalus(groupId, newMalus).catch(() => {});
      return { ...s, sessionData: { ...s.sessionData, groups } };
    });
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const resetMalusAction = useCallback(async (groupId: string) => {
    setState(s => {
      if (!s.sessionData) return s;
      const groups = s.sessionData.groups.map(g =>
        g.id === groupId ? { ...g, conduct_malus: 0 } : g
      );
      updateMalus(groupId, 0).catch(() => {});
      return { ...s, sessionData: { ...s.sessionData, groups } };
    });
  }, []);

  const finishSession = useCallback(async () => {
    if (!state.sessionId) return;
    setState(s => ({ ...s, loading: true }));
    try {
      await completeGroupSession(state.sessionId);
      setState(s => ({ ...s, step: 'summary', loading: false }));
    } catch {
      setState(s => ({ ...s, error: 'Erreur', loading: false }));
    }
  }, [state.sessionId]);

  const cancelFlow = useCallback(() => {
    setState({ ...initialState });
  }, []);

  const goBack = useCallback(() => {
    setState(s => {
      if (s.step === 'setup') return { ...s, step: 'select-class', selectedClass: null };
      return s;
    });
  }, []);

  return (
    <GroupSessionContext.Provider
      value={{
        ...state,
        startFlow,
        selectClass,
        setSessionName,
        applyTemplate,
        addCriteria,
        removeCriteria,
        addGroup,
        removeGroup,
        toggleMember,
        randomizeGroups,
        startGrading,
        setActiveGroup,
        setGrade,
        applyMalus: applyMalusAction,
        resetMalus: resetMalusAction,
        finishSession,
        cancelFlow,
        goBack,
      }}
    >
      {children}
    </GroupSessionContext.Provider>
  );
}

export function useGroupSession() {
  const ctx = useContext(GroupSessionContext);
  if (!ctx) throw new Error('useGroupSession must be used within GroupSessionProvider');
  return ctx;
}
