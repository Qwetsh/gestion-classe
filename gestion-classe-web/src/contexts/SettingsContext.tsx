import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ── Types ──

export interface EstablishmentInfo {
  name: string;
  tel: string;
  address: string;
  codePostal: string;
}

export interface TeacherProfile {
  nom: string;
  matiere: string;
  fonction: string;
}

export interface SchoolYear {
  label: string;       // e.g. "2025-2026"
  trimestre: number;   // 1, 2, or 3
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface HiddenTabs {
  rewards: boolean;
  'group-sessions': boolean;
  evaluations: boolean;
  academy: boolean;
  'tp-templates': boolean;
  brevets: boolean;
  tools: boolean;
  pronote: boolean;
}

export interface AppSettings {
  hiddenTabs: HiddenTabs;
  establishment: EstablishmentInfo;
  teacher: TeacherProfile;
  schoolYear: SchoolYear;
  theme: ThemeMode;
}

// Annee scolaire courante deduite de la date (bascule au 1er aout).
export function currentSchoolYear(now: Date = new Date()): SchoolYear {
  const m = now.getMonth(); // 0 = janvier
  const y = now.getFullYear();
  const startYear = m >= 7 ? y : y - 1;
  // T1 : septembre -> novembre | T2 : decembre -> mars | T3 : avril -> aout
  const trimestre = m >= 7 && m <= 10 ? 1 : (m === 11 || m <= 2) ? 2 : 3;
  return { label: `${startYear}-${startYear + 1}`, trimestre };
}

const DEFAULT_SETTINGS: AppSettings = {
  hiddenTabs: {
    rewards: false,
    'group-sessions': false,
    evaluations: false,
    academy: false,
    'tp-templates': false,
    brevets: false,
    tools: false,
    pronote: false,
  },
  establishment: {
    name: 'College Pierre Mendes France',
    tel: '03 87 54 36 40',
    address: '57140 WOIPPY',
    codePostal: '57140 WOIPPY',
  },
  teacher: { nom: '', matiere: '', fonction: '' },
  schoolYear: currentSchoolYear(),
  theme: 'light',
};

const STORAGE_KEY = 'gc-app-settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // Une annee scolaire perimee (reglage d'une annee precedente) est reinitialisee.
    const current = currentSchoolYear();
    if (!merged.schoolYear?.label || merged.schoolYear.label < current.label) {
      merged.schoolYear = current;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── Context ──

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  isTabVisible: (tabKey: string) => boolean;
  exportData: () => string;
  clearLocalData: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  const isTabVisible = useCallback((tabKey: string) => {
    const key = tabKey as keyof HiddenTabs;
    if (key in settings.hiddenTabs) return !settings.hiddenTabs[key];
    return true;
  }, [settings.hiddenTabs]);

  const exportData = useCallback(() => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) data[k] = localStorage.getItem(k);
    }
    return JSON.stringify(data, null, 2);
  }, []);

  const clearLocalData = useCallback(() => {
    const settingsBackup = localStorage.getItem(STORAGE_KEY);
    localStorage.clear();
    if (settingsBackup) localStorage.setItem(STORAGE_KEY, settingsBackup);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isTabVisible, exportData, clearLocalData }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
