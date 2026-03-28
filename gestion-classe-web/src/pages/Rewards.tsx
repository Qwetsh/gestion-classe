import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import {
  fetchCategories,
  fetchBonuses,
  fetchStudentStampOverview,
  fetchClasses,
  seedDefaultData,
  createCategory,
  updateCategory,
  deleteCategory as deleteCategoryApi,
  createBonus,
  updateBonus,
  deleteBonus as deleteBonusApi,
  awardStamp,
  markBonusUsed,
  initializeCardsForClass,
  type StampCategory,
  type Bonus,
  type StudentStampOverview,
} from '../lib/rewardsQueries';

type Tab = 'overview' | 'categories' | 'bonuses';

export function Rewards() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [categories, setCategories] = useState<StampCategory[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [overview, setOverview] = useState<StudentStampOverview[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classFilter, setClassFilter] = useState<string>('');

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StampCategory | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
  const [showStampModal, setShowStampModal] = useState(false);
  const [stampTarget, setStampTarget] = useState<StudentStampOverview | null>(null);

  // Form state
  const [catLabel, setCatLabel] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catColor, setCatColor] = useState('#4CAF50');
  const [bonusLabel, setBonusLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      // Seed defaults if needed
      await seedDefaultData(user.id);

      const [cats, bons, cls, ov] = await Promise.all([
        fetchCategories(user.id),
        fetchBonuses(user.id),
        fetchClasses(user.id),
        fetchStudentStampOverview(user.id),
      ]);

      setCategories(cats);
      setBonuses(bons);
      setClasses(cls);
      setOverview(ov);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter overview client-side based on selected class
  const filteredOverview = classFilter
    ? overview.filter(s => s.class_id === classFilter)
    : overview;

  // ============================================
  // Category handlers
  // ============================================

  const openCategoryModal = (cat?: StampCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCatLabel(cat.label);
      setCatIcon(cat.icon);
      setCatColor(cat.color);
    } else {
      setEditingCategory(null);
      setCatLabel('');
      setCatIcon('');
      setCatColor('#4CAF50');
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!user || !catLabel.trim() || !catIcon.trim()) return;
    setIsSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { label: catLabel.trim(), icon: catIcon.trim(), color: catColor });
      } else {
        await createCategory(user.id, catLabel.trim(), catIcon.trim(), catColor, categories.length);
      }
      setShowCategoryModal(false);
      await loadData();
      showSuccess(editingCategory ? 'Catégorie modifiée' : 'Catégorie créée');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = async (cat: StampCategory) => {
    try {
      await updateCategory(cat.id, { is_active: !cat.is_active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    try {
      await deleteCategoryApi(id);
      await loadData();
      showSuccess('Catégorie supprimée');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // ============================================
  // Bonus handlers
  // ============================================

  const openBonusModal = (bonus?: Bonus) => {
    if (bonus) {
      setEditingBonus(bonus);
      setBonusLabel(bonus.label);
    } else {
      setEditingBonus(null);
      setBonusLabel('');
    }
    setShowBonusModal(true);
  };

  const saveBonus = async () => {
    if (!user || !bonusLabel.trim()) return;
    setIsSaving(true);
    try {
      if (editingBonus) {
        await updateBonus(editingBonus.id, { label: bonusLabel.trim() });
      } else {
        await createBonus(user.id, bonusLabel.trim(), bonuses.length);
      }
      setShowBonusModal(false);
      await loadData();
      showSuccess(editingBonus ? 'Bonus modifié' : 'Bonus créé');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBonus = async (bonus: Bonus) => {
    try {
      await updateBonus(bonus.id, { is_active: !bonus.is_active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const deleteBonusFn = async (id: string) => {
    if (!confirm('Supprimer ce bonus ?')) return;
    try {
      await deleteBonusApi(id);
      await loadData();
      showSuccess('Bonus supprimé');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // ============================================
  // Stamp handlers
  // ============================================

  const openStampModal = (student: StudentStampOverview) => {
    setStampTarget(student);
    setShowStampModal(true);
  };

  const doAwardStamp = async (categoryId: string) => {
    if (!user || !stampTarget) return;
    try {
      const result = await awardStamp(user.id, stampTarget.student_id, categoryId);
      setShowStampModal(false);
      await loadData();
      if (result.cardComplete) {
        showSuccess(`Carte complète pour ${stampTarget.pseudo} ! L'élève peut choisir son bonus.`);
      } else {
        showSuccess(`Tampon attribué : ${result.stampCount}/10`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const doMarkBonusUsed = async (selectionId: string) => {
    try {
      await markBonusUsed(selectionId);
      await loadData();
      showSuccess('Bonus validé');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const doInitCards = async () => {
    if (!user || !classFilter) return;
    try {
      const count = await initializeCardsForClass(user.id, classFilter);
      await loadData();
      showSuccess(`${count} carte(s) créée(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // ============================================
  // Render
  // ============================================

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeCategories = categories.filter(c => c.is_active);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: '📋' },
    { key: 'categories', label: 'Catégories', icon: '🏷️' },
    { key: 'bonuses', label: 'Bonus', icon: '🎁' },
  ];

  // Count stamps per class for sidebar display
  const classStampStats = classes.map(cls => {
    const classStudents = overview.filter(s => s.class_name === cls.name);
    const totalStamps = classStudents.reduce((sum, s) => sum + s.stamp_count, 0);
    return { ...cls, studentCount: classStudents.length, totalStamps };
  });

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 md:mb-4">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-[var(--color-text)]">Récompenses</h1>
            <p className="text-xs md:text-sm text-[var(--color-text-secondary)]">Carte à tampons et bonus</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-[var(--color-error-soft)] text-[var(--color-error)] text-sm mb-2">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">x</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-green-50 text-green-700 text-sm mb-2">{successMsg}</div>
        )}

        {/* Main content area - Two column layout */}
        <div className="flex flex-1 gap-4 min-h-0">
          {/* SIDEBAR: Classes list (left) */}
          <div className={`w-12 flex-shrink-0 bg-[var(--color-surface)] rounded-xl overflow-hidden flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'md:w-12' : 'md:w-56'}`}>
            {/* Sidebar header */}
            <div className="p-1 md:p-2 border-b border-[var(--color-border)] flex items-center justify-between">
              <span className={`text-xs font-semibold text-[var(--color-text-secondary)] hidden ${sidebarCollapsed ? '' : 'md:block'}`}>
                Classes
              </span>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-[var(--color-background)] text-[var(--color-text-secondary)] text-xs"
                title={sidebarCollapsed ? 'Déplier' : 'Replier'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>

            {/* "All classes" button */}
            <div className="flex-1 overflow-y-auto p-1 md:p-2 space-y-1">
              <button
                onClick={() => setClassFilter('')}
                className={`w-full rounded-lg transition-colors ${
                  !classFilter
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'hover:bg-[var(--color-background)] text-[var(--color-text-secondary)]'
                }`}
              >
                {/* Mobile / collapsed */}
                <div className={`flex items-center justify-center p-1.5 ${sidebarCollapsed ? '' : 'md:hidden'}`}>
                  <span className="text-xs font-bold">All</span>
                </div>
                {/* Desktop expanded */}
                <div className={`hidden ${sidebarCollapsed ? '' : 'md:flex'} items-center gap-2 px-3 py-2`}>
                  <span className="text-sm font-medium truncate">Toutes</span>
                  <span className={`ml-auto text-xs ${!classFilter ? 'text-white/70' : 'text-[var(--color-text-secondary)]'}`}>
                    {overview.length}
                  </span>
                </div>
              </button>

              {classStampStats.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setClassFilter(cls.id)}
                  className={`w-full rounded-lg transition-colors ${
                    classFilter === cls.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'hover:bg-[var(--color-background)] text-[var(--color-text)]'
                  }`}
                >
                  {/* Mobile / collapsed: abbreviation */}
                  <div className={`flex items-center justify-center p-1.5 ${sidebarCollapsed ? '' : 'md:hidden'}`}>
                    <span className="text-xs font-bold">{cls.name.slice(0, 2)}</span>
                  </div>
                  {/* Desktop expanded */}
                  <div className={`hidden ${sidebarCollapsed ? '' : 'md:flex'} items-center gap-2 px-3 py-2`}>
                    <span className="text-sm font-medium truncate">{cls.name}</span>
                    <span className={`ml-auto text-xs ${classFilter === cls.id ? 'text-white/70' : 'text-[var(--color-text-secondary)]'}`}>
                      {cls.studentCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT (right) */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface)] rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--color-border)] px-2 md:px-4 pt-2">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text)]'
                  }`}
                >
                  <span className="mr-1 md:mr-1.5">{tab.icon}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              ))}
              {/* Init cards button in tab bar */}
              {classFilter && activeTab === 'overview' && (
                <button
                  onClick={doInitCards}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-blue-50 transition-colors self-center mb-1"
                >
                  Initialiser les cartes
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
              {isLoading ? (
                <div className="text-center py-12 text-[var(--color-text-secondary)]">Chargement...</div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <OverviewTab
                      overview={filteredOverview}
                      onAwardStamp={openStampModal}
                      onMarkBonusUsed={doMarkBonusUsed}
                    />
                  )}
                  {activeTab === 'categories' && (
                    <CategoriesTab
                      categories={categories}
                      onAdd={() => openCategoryModal()}
                      onEdit={openCategoryModal}
                      onToggle={toggleCategory}
                      onDelete={deleteCategory}
                    />
                  )}
                  {activeTab === 'bonuses' && (
                    <BonusesTab
                      bonuses={bonuses}
                      onAdd={() => openBonusModal()}
                      onEdit={openBonusModal}
                      onToggle={toggleBonus}
                      onDelete={deleteBonusFn}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal title={editingCategory ? 'Modifier catégorie' : 'Nouvelle catégorie'} onClose={() => setShowCategoryModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Label</label>
              <input
                type="text"
                value={catLabel}
                onChange={e => setCatLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                placeholder="Ex: Participation remarquable"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Icône (emoji)</label>
                <input
                  type="text"
                  value={catIcon}
                  onChange={e => setCatIcon(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] text-center text-2xl"
                  placeholder="⭐"
                  maxLength={4}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Couleur</label>
                <input
                  type="color"
                  value={catColor}
                  onChange={e => setCatColor(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[var(--color-border)] cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-secondary)]">
              <span className="text-2xl">{catIcon || '?'}</span>
              <span className="text-sm font-medium" style={{ color: catColor }}>{catLabel || 'Aperçu'}</span>
              <div className="w-4 h-4 rounded-full ml-auto" style={{ backgroundColor: catColor }} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]">
                Annuler
              </button>
              <button
                onClick={saveCategory}
                disabled={isSaving || !catLabel.trim() || !catIcon.trim()}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bonus Modal */}
      {showBonusModal && (
        <Modal title={editingBonus ? 'Modifier bonus' : 'Nouveau bonus'} onClose={() => setShowBonusModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Label</label>
              <input
                type="text"
                value={bonusLabel}
                onChange={e => setBonusLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                placeholder="Ex: +1 pt sur la note de son choix"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBonusModal(false)} className="px-4 py-2 text-sm rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]">
                Annuler
              </button>
              <button
                onClick={saveBonus}
                disabled={isSaving || !bonusLabel.trim()}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stamp Attribution Modal */}
      {showStampModal && stampTarget && (
        <Modal title={`Attribuer un tampon — ${stampTarget.pseudo}`} onClose={() => setShowStampModal(false)}>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Carte n°{stampTarget.card_number} — {stampTarget.stamp_count}/10
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {activeCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => doAwardStamp(cat.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-secondary)] transition-all text-left"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-sm font-medium text-[var(--color-text)]">{cat.label}</span>
                <div className="w-3 h-3 rounded-full ml-auto flex-shrink-0" style={{ backgroundColor: cat.color }} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </Layout>
  );
}

// ============================================
// Sub-components
// ============================================

function OverviewTab({
  overview, onAwardStamp, onMarkBonusUsed,
}: {
  overview: StudentStampOverview[];
  onAwardStamp: (s: StudentStampOverview) => void;
  onMarkBonusUsed: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {overview.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <p className="text-4xl mb-2">⭐</p>
          <p>Sélectionnez une classe et initialisez les cartes pour commencer</p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-secondary)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Élève</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Classe</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Carte</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Progression</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--color-text-secondary)]">Bonus</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--color-text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.map(s => (
                  <tr key={s.student_id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">{s.pseudo}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{s.class_name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">n°{s.card_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(s.stamp_count / 10) * 100}%`,
                              background: s.stamp_count === 10 ? '#22c55e' : 'var(--gradient-primary)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{s.stamp_count}/10</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.bonus_label ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                          🎁 {s.bonus_label}
                        </span>
                      ) : s.stamp_count === 10 ? (
                        <span className="text-xs text-amber-600 font-medium">En attente de choix</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.stamp_count < 10 && (
                          <button
                            onClick={() => onAwardStamp(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                            style={{ background: 'var(--gradient-primary)' }}
                          >
                            + Tampon
                          </button>
                        )}
                        {s.bonus_selection_id && (
                          <button
                            onClick={() => onMarkBonusUsed(s.bonus_selection_id!)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                          >
                            Valider bonus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesTab({
  categories, onAdd, onEdit, onToggle, onDelete,
}: {
  categories: StampCategory[];
  onAdd: () => void;
  onEdit: (c: StampCategory) => void;
  onToggle: (c: StampCategory) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">{categories.length} catégorie(s)</p>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--gradient-primary)' }}
        >
          + Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <div
            key={cat.id}
            className={`p-4 rounded-xl border transition-all ${
              cat.is_active
                ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] opacity-60'
            }`}
            style={{ boxShadow: cat.is_active ? 'var(--shadow-xs)' : undefined }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: cat.color + '20' }}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">{cat.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-[var(--color-text-secondary)]">{cat.is_active ? 'Active' : 'Désactivée'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => onToggle(cat)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                {cat.is_active ? 'Désactiver' : 'Activer'}
              </button>
              <button onClick={() => onEdit(cat)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-primary)]">
                Modifier
              </button>
              <button onClick={() => onDelete(cat.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-error-soft)] text-[var(--color-error)]">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BonusesTab({
  bonuses, onAdd, onEdit, onToggle, onDelete,
}: {
  bonuses: Bonus[];
  onAdd: () => void;
  onEdit: (b: Bonus) => void;
  onToggle: (b: Bonus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">{bonuses.length} bonus</p>
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--gradient-primary)' }}
        >
          + Ajouter
        </button>
      </div>

      <div className="space-y-2">
        {bonuses.map((bonus, i) => (
          <div
            key={bonus.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              bonus.is_active
                ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                : 'border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] opacity-60'
            }`}
          >
            <span className="text-lg w-8 text-center">{i + 1}.</span>
            <span className="text-2xl">🎁</span>
            <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{bonus.label}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{bonus.is_active ? 'Actif' : 'Désactivé'}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => onToggle(bonus)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                {bonus.is_active ? 'Désactiver' : 'Activer'}
              </button>
              <button onClick={() => onEdit(bonus)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-surface-secondary)] text-[var(--color-primary)]">
                Modifier
              </button>
              <button onClick={() => onDelete(bonus.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--color-error-soft)] text-[var(--color-error)]">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Generic Modal
// ============================================

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-lg"
        style={{ boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
