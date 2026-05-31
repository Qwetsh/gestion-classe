import { useState, useCallback, useEffect } from 'react';
import { useSettings, type HiddenTabs, type ThemeMode } from '../contexts/SettingsContext';

// ── Types ──

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SectionKey = 'tabs' | 'establishment' | 'teacher' | 'schoolYear' | 'theme' | 'data';

interface SidebarItem {
  key: SectionKey;
  label: string;
  icon: string;
}

// ── Configuration sidebar ──

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'tabs', label: 'Onglets visibles', icon: 'M4 6h16M4 12h16M4 18h16' },
  { key: 'establishment', label: 'Etablissement', icon: 'M3 21h18M9 21V7l6-3v17M9 7l-6 3v11M15 4l6 3v14' },
  { key: 'teacher', label: 'Profil enseignant', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { key: 'schoolYear', label: 'Annee scolaire', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'theme', label: 'Theme', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  { key: 'data', label: 'Donnees', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 5h16' },
];

// ── Configuration des onglets masquables ──

const TAB_OPTIONS: { key: keyof HiddenTabs; label: string }[] = [
  { key: 'rewards', label: 'Recompenses' },
  { key: 'group-sessions', label: 'Groupes' },
  { key: 'academy', label: 'Academie' },
  { key: 'tp-templates', label: 'Mes TP' },
  { key: 'brevets', label: 'Annales' },
  { key: 'tools', label: 'Outils' },
  { key: 'pronote', label: 'Pronote' },
];

// ── Composant Toggle Switch ──

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--indigo)] focus-visible:ring-offset-2"
      style={{ backgroundColor: checked ? 'var(--indigo)' : 'var(--border)' }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
        style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
      />
    </button>
  );
}

// ── Composant principal ──

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, exportData, clearLocalData } = useSettings();
  const [activeSection, setActiveSection] = useState<SectionKey>('tabs');
  const [confirmClear, setConfirmClear] = useState(false);

  // Fermeture avec Echap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  // Reset la confirmation quand on change de section
  useEffect(() => {
    setConfirmClear(false);
  }, [activeSection]);

  if (!open) return null;

  // ── Handlers ──

  const handleToggleTab = (key: keyof HiddenTabs) => {
    updateSettings({
      hiddenTabs: { ...settings.hiddenTabs, [key]: !settings.hiddenTabs[key] },
    });
  };

  const handleEstablishment = (field: string, value: string) => {
    updateSettings({
      establishment: { ...settings.establishment, [field]: value },
    });
  };

  const handleTeacher = (field: string, value: string) => {
    updateSettings({
      teacher: { ...settings.teacher, [field]: value },
    });
  };

  const handleSchoolYear = (field: string, value: string | number) => {
    updateSettings({
      schoolYear: { ...settings.schoolYear, [field]: value },
    });
  };

  const handleTheme = (theme: ThemeMode) => {
    updateSettings({ theme });
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestion-classe-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearLocalData();
    setConfirmClear(false);
  };

  // ── Rendu des sections ──

  const renderSection = () => {
    switch (activeSection) {
      // Section 1 : Onglets visibles
      case 'tabs':
        return (
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Onglets visibles</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Masquez les onglets que vous n'utilisez pas. Ils disparaitront de la barre de navigation.
            </p>
            <div className="space-y-3">
              {TAB_OPTIONS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                >
                  <span className="text-sm text-[var(--text)]">{label}</span>
                  <Toggle
                    checked={!settings.hiddenTabs[key]}
                    onChange={() => handleToggleTab(key)}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      // Section 2 : Etablissement
      case 'establishment':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Etablissement</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nom</label>
              <input
                type="text"
                value={settings.establishment.name}
                onChange={(e) => handleEstablishment('name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Telephone</label>
              <input
                type="text"
                value={settings.establishment.tel}
                onChange={(e) => handleEstablishment('tel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Adresse</label>
              <input
                type="text"
                value={settings.establishment.address}
                onChange={(e) => handleEstablishment('address', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Code postal / Commune</label>
              <input
                type="text"
                value={settings.establishment.codePostal}
                onChange={(e) => handleEstablishment('codePostal', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
          </div>
        );

      // Section 3 : Profil enseignant
      case 'teacher':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Profil enseignant</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Nom Prenom</label>
              <input
                type="text"
                value={settings.teacher.nom}
                onChange={(e) => handleTeacher('nom', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Matiere</label>
              <input
                type="text"
                value={settings.teacher.matiere}
                onChange={(e) => handleTeacher('matiere', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Fonction</label>
              <input
                type="text"
                value={settings.teacher.fonction}
                onChange={(e) => handleTeacher('fonction', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
          </div>
        );

      // Section 4 : Annee scolaire
      case 'schoolYear':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Annee scolaire</h3>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Annee</label>
              <input
                type="text"
                value={settings.schoolYear.label}
                onChange={(e) => handleSchoolYear('label', e.target.value)}
                placeholder="2025-2026"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Trimestre</label>
              <div className="flex gap-3">
                {[1, 2, 3].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSchoolYear('trimestre', t)}
                    className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      borderColor: settings.schoolYear.trimestre === t ? 'var(--indigo)' : 'var(--border)',
                      backgroundColor: settings.schoolYear.trimestre === t ? 'var(--indigo-soft)' : 'var(--surface)',
                      color: settings.schoolYear.trimestre === t ? 'var(--indigo)' : 'var(--text)',
                    }}
                  >
                    T{t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      // Section 5 : Theme
      case 'theme':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Theme</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'light' as ThemeMode, label: 'Clair', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
                { value: 'dark' as ThemeMode, label: 'Sombre', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
                { value: 'system' as ThemeMode, label: 'Systeme', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              ]).map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTheme(value)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: settings.theme === value ? 'var(--indigo)' : 'var(--border)',
                    backgroundColor: settings.theme === value ? 'var(--indigo-soft)' : 'var(--surface)',
                  }}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{ color: settings.theme === value ? 'var(--indigo)' : 'var(--text-muted)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                  <span
                    className="text-sm font-medium"
                    style={{ color: settings.theme === value ? 'var(--indigo)' : 'var(--text)' }}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      // Section 6 : Donnees
      case 'data':
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-[var(--indigo)] mb-4">Donnees</h3>
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Exportez vos donnees locales ou videz le cache du navigateur.
            </p>
            <div className="space-y-3">
              {/* Bouton export */}
              <button
                type="button"
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--indigo)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
                </svg>
                Exporter mes donnees
              </button>

              {/* Bouton vider le cache */}
              <button
                type="button"
                onClick={handleClearData}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors"
                style={{
                  borderColor: confirmClear ? 'var(--neg)' : 'var(--border)',
                  backgroundColor: confirmClear ? 'var(--neg-soft)' : 'var(--surface)',
                  color: confirmClear ? 'var(--neg)' : 'var(--text)',
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  style={{ color: confirmClear ? 'var(--neg)' : 'var(--text-muted)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {confirmClear ? 'Confirmer la suppression' : 'Vider le cache local'}
              </button>

              {confirmClear && (
                <p className="text-xs text-[var(--neg)] px-1">
                  Attention : cette action supprimera toutes les donnees locales (sauf les parametres).
                  Cliquez a nouveau pour confirmer.
                </p>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tete */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-[var(--text)]">
            Parametres
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corps : sidebar + contenu */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar gauche */}
          <nav className="w-48 shrink-0 border-r border-[var(--border)] py-2 overflow-y-auto">
            {SIDEBAR_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSection(key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  activeSection === key
                    ? 'bg-[var(--indigo-soft)] text-[var(--indigo)] font-medium'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </nav>

          {/* Contenu de la section active */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
}
