import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { HIDDEN_TABS_PREFERENCE, NO_HIDDEN_TABS, hasHiddenTab, sameHiddenTabs, sanitizeHiddenTabs, type HiddenTabs } from '../lib/appTabs';
import { fetchPreference, savePreference } from '../lib/userPreferences';
import {
  EMPTY_ESTABLISHMENT, ESTABLISHMENT_PREFERENCE, establishmentFromLegacy, isEstablishmentEmpty,
  sameEstablishment, sanitizeEstablishment, type EstablishmentInfo,
} from '../lib/establishment';

export type { HiddenTabs, EstablishmentInfo };

// ── Types ──

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
  hiddenTabs: NO_HIDDEN_TABS,
  establishment: EMPTY_ESTABLISHMENT,
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
    // Onglets d'aujourd'hui seulement (un réglage ancien peut citer des onglets retirés du menu)
    merged.hiddenTabs = sanitizeHiddenTabs(merged.hiddenTabs);
    // L'ancien pré-remplissage commun à tous les comptes n'est pas repris.
    merged.establishment = establishmentFromLegacy(merged.establishment);
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  /** Onglets masqués à l'instant, lisibles hors du rendu (réponse du compte). */
  const hiddenTabsRef = useRef(settings.hiddenTabs);
  useEffect(() => { hiddenTabsRef.current = settings.hiddenTabs; }, [settings.hiddenTabs]);
  /** Le professeur a touché aux onglets avant la réponse du compte : son geste l'emporte. */
  const tabsTouched = useRef(false);
  const establishmentRef = useRef(settings.establishment);
  useEffect(() => { establishmentRef.current = settings.establishment; }, [settings.establishment]);
  const establishmentTouched = useRef(false);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    if (patch.hiddenTabs) {
      tabsTouched.current = true;
      // Onglets visibles : rangés dans le compte, pour suivre le professeur d'un appareil à l'autre
      if (userIdRef.current) void savePreference(userIdRef.current, HIDDEN_TABS_PREFERENCE, patch.hiddenTabs);
    }
    if (patch.establishment) {
      establishmentTouched.current = true;
      if (userIdRef.current) void savePreference(userIdRef.current, ESTABLISHMENT_PREFERENCE, patch.establishment);
    }
    setSettings(prev => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  // À la connexion : le réglage du compte fait foi. S'il n'y en a pas encore, celui de cet
  // appareil y est envoyé (premier passage après la mise à jour), sauf s'il ne masque rien.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    tabsTouched.current = false;
    void fetchPreference<unknown>(userId, HIDDEN_TABS_PREFERENCE).then((remote) => {
      if (cancelled || tabsTouched.current) return;
      if (remote === null) {
        const local = hiddenTabsRef.current;
        if (hasHiddenTab(local)) void savePreference(userId, HIDDEN_TABS_PREFERENCE, local);
        return;
      }
      const hiddenTabs = sanitizeHiddenTabs(remote);
      setSettings(prev => {
        if (sameHiddenTabs(prev.hiddenTabs, hiddenTabs)) return prev;
        const next = { ...prev, hiddenTabs };
        persistSettings(next);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Même règle pour l'établissement : le compte fait foi ; à défaut, celui de cet appareil y est
  // envoyé s'il a été saisi (l'ancien pré-remplissage, lui, est déjà écarté au chargement).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    establishmentTouched.current = false;
    void fetchPreference<unknown>(userId, ESTABLISHMENT_PREFERENCE).then((remote) => {
      if (cancelled || establishmentTouched.current) return;
      if (remote === null) {
        const local = establishmentRef.current;
        if (!isEstablishmentEmpty(local)) void savePreference(userId, ESTABLISHMENT_PREFERENCE, local);
        return;
      }
      const establishment = sanitizeEstablishment(remote);
      setSettings(prev => {
        if (sameEstablishment(prev.establishment, establishment)) return prev;
        const next = { ...prev, establishment };
        persistSettings(next);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [userId]);

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
