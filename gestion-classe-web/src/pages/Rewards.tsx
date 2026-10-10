import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { CategoryIcon } from '../components/rewards/CategoryIcon';
import { IconPicker } from '../components/rewards/IconPicker';
import { ChevronDown, ChevronUp, Gift, Pencil, Plus, RotateCcw, Settings2, Stamp, Trash2 } from 'lucide-react';
import {
  fetchCategories,
  fetchBonuses,
  fetchStudentStampOverview,
  fetchClasses,
  seedDefaultData,
  createCategory,
  updateCategory,
  deleteCategory as deleteCategoryApi,
  reorderCategories,
  deactivateAllCategories,
  createBonus,
  updateBonus,
  deleteBonus as deleteBonusApi,
  awardStamp,
  markBonusUsed,
  selectBonusForStudent,
  resetAllStampCards,
  resetStudentStampCards,
  fetchStudentStampDetail,
  removeStamp,
  getCardTier,
  type StampCategory,
  type Bonus,
  type StudentStampOverview,
  type StudentStampDetail,
} from '../lib/rewardsQueries';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { supabase } from '../lib/supabase';

type ConfigTab = 'categories' | 'bonuses';

export function Rewards() {
  const { user } = useAuth();
  const { confirm: showConfirm } = useUIFeedback();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>('categories');
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
  const [bonusTarget, setBonusTarget] = useState<StudentStampOverview | null>(null);
  const [stampTarget, setStampTarget] = useState<StudentStampOverview | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTarget, setDetailTarget] = useState<StudentStampOverview | null>(null);
  const [stampDetail, setStampDetail] = useState<StudentStampDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form state
  const [catLabel, setCatLabel] = useState('');
  const [catIconRef, setCatIconRef] = useState<string | null>(null);
  const [catIcon, setCatIcon] = useState('');
  const [catColor, setCatColor] = useState('#4CAF50');
  const [bonusLabel, setBonusLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
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

  // Realtime : un tampon donne depuis le telephone apparait sans recharger (migration 035)
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { loadData(true); }, 600);
    };
    const channel = supabase.channel(`rewards-${user.id}`);
    for (const table of ['stamps', 'stamp_cards', 'bonus_selections']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${user.id}` }, scheduleReload);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, loadData]);

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
      setCatIconRef(cat.icon_ref ?? null);
      setCatColor(cat.color);
    } else {
      setEditingCategory(null);
      setCatLabel('');
      setCatIcon('⭐');
      setCatIconRef(null);
      setCatColor('#4CAF50');
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!user || !catLabel.trim()) return;
    if (duplicateCategory) return;
    // L'emoji reste toujours renseigné : c'est le repli des anciens clients (APK mobile installé).
    const iconFallback = catIcon.trim() || '⭐';
    setIsSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { label: catLabel.trim(), icon: iconFallback, icon_ref: catIconRef, color: catColor });
      } else {
        const nextOrder = categories.reduce((max, c) => Math.max(max, c.display_order + 1), 0);
        await createCategory(user.id, catLabel.trim(), iconFallback, catColor, nextOrder, catIconRef);
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

  // Le libelle sert de cle d'affichage (dedoublonnage web/mobile) : pas deux categories au meme nom
  const duplicateCategory = showCategoryModal
    ? categories.find(c => c.label === catLabel.trim() && c.id !== editingCategory?.id) ?? null
    : null;

  const toggleCategory = async (cat: StampCategory) => {
    try {
      await updateCategory(cat.id, { is_active: !cat.is_active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const deleteCategory = async (id: string) => {
    const ok = await showConfirm({
      title: 'Supprimer la catégorie',
      message: 'Supprimer cette catégorie ?\n\nSi des tampons ont déjà été donnés avec, elle sera seulement désactivée : les cartes des élèves restent intactes.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const { deleted, usedBy } = await deleteCategoryApi(id);
      await loadData();
      showSuccess(deleted ? 'Catégorie supprimée' : `Catégorie désactivée (utilisée par ${usedBy} tampon${usedBy > 1 ? 's' : ''})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const moveCategory = async (id: string, direction: -1 | 1) => {
    const index = categories.findIndex(c => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const ordered = [...categories];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setCategories(ordered.map((c, i) => ({ ...c, display_order: i })));
    try {
      await reorderCategories(ordered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
    await loadData(true);
  };

  const startFromScratch = async () => {
    if (!user) return;
    const ok = await showConfirm({
      title: 'Repartir de zéro',
      message: 'Désactiver toutes les catégories pour créer les vôtres ?\n\nLes tampons déjà donnés restent sur les cartes des élèves, et chaque catégorie pourra être réactivée.',
      confirmLabel: 'Tout désactiver',
    });
    if (!ok) return;
    try {
      await deactivateAllCategories(user.id);
      await loadData();
      showSuccess('Catégories désactivées : ajoutez les vôtres');
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
        const nextOrder = bonuses.reduce((max, b) => Math.max(max, b.display_order + 1), 0);
        await createBonus(user.id, bonusLabel.trim(), nextOrder);
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
    const ok = await showConfirm({
      title: 'Supprimer le bonus',
      message: 'Supprimer ce bonus ?\n\nS\'il a déjà été choisi par un élève, il sera seulement désactivé.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const { deleted } = await deleteBonusApi(id);
      await loadData();
      showSuccess(deleted ? 'Bonus supprimé' : 'Bonus désactivé (déjà choisi par un élève)');
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

  const doChooseBonus = async (bonusId: string) => {
    if (!bonusTarget) return;
    try {
      const { newCardNumber } = await selectBonusForStudent(bonusTarget.student_id, bonusId);
      setBonusTarget(null);
      await loadData(true);
      showSuccess(`Bonus enregistré pour ${bonusTarget.pseudo} — carte n°${newCardNumber} ouverte`);
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

  const doResetStudent = async (student: StudentStampOverview) => {
    if (!user) return;
    const ok = await showConfirm({ title: 'Reinitialiser cet eleve', message: `Reinitialiser ${student.pseudo} ?\n\nTous ses tampons, cartes et bonus seront supprimes. Il repartira a la carte n°1.`, confirmLabel: 'Reinitialiser', variant: 'danger' });
    if (!ok) return;
    try {
      await resetStudentStampCards(user.id, student.student_id);
      await loadData();
      showSuccess(`${student.pseudo} réinitialisé — carte n°1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const doResetAll = async () => {
    if (!user) return;
    const ok = await showConfirm({ title: 'Tout reinitialiser', message: 'Remettre TOUS les eleves a la carte n°1 ?\n\nCette action supprimera tous les tampons, cartes et bonus selectionnes. Irreversible.', confirmLabel: 'Tout reinitialiser', variant: 'danger' });
    if (!ok) return;
    const ok2 = await showConfirm({ title: 'Derniere chance', message: 'Vraiment tout reinitialiser ?', confirmLabel: 'Confirmer', variant: 'danger' });
    if (!ok2) return;
    try {
      const count = await resetAllStampCards(user.id);
      await loadData();
      showSuccess(`Reset effectue (${count} carte(s) supprimee(s)). Tous les eleves sont a la carte n°1.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // ============================================
  // Detail modal handlers
  // ============================================

  const openDetailModal = async (student: StudentStampOverview) => {
    setDetailTarget(student);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const detail = await fetchStudentStampDetail(student.student_id);
      setStampDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDetailLoading(false);
    }
  };

  const doRemoveStamp = async (stampId: string) => {
    const ok = await showConfirm({ title: 'Retirer le tampon', message: 'Retirer ce tampon ?', confirmLabel: 'Retirer', variant: 'warning' });
    if (!ok) return;
    try {
      await removeStamp(stampId);
      // Refresh detail + overview
      if (detailTarget) {
        const detail = await fetchStudentStampDetail(detailTarget.student_id);
        setStampDetail(detail);
      }
      await loadData();
      showSuccess('Tampon retiré');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  // ============================================
  // Render
  // ============================================

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeCategories = categories.filter(c => c.is_active);

  // Count stamps per class for sidebar display
  const classStampStats = classes.map(cls => {
    const classStudents = overview.filter(s => s.class_name === cls.name);
    const totalStamps = classStudents.reduce((sum, s) => sum + s.stamp_count, 0);
    return { ...cls, studentCount: classStudents.length, totalStamps };
  });

  return (
    <Layout fluid>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 md:mb-4">
          <div>
            <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Récompenses</h1>
            <p className="text-xs md:text-sm" style={{ color: 'var(--text-muted)' }}>Carte à tampons et bonus</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--surface-3)] transition-colors flex items-center gap-1.5"
            >
              <Settings2 size={14} />
              <span>Personnaliser</span>
            </button>
            <button
              onClick={doResetAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--neg)] border border-[var(--neg)] hover:bg-red-50 transition-colors"
            >
              <span className="hidden md:inline">Reinitialiser les cartes</span>
              <span className="md:hidden">Reset</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-[var(--neg-soft)] text-[var(--neg)] text-sm mb-2">
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
          <div className={`w-12 flex-shrink-0 bg-[var(--surface)] rounded-xl overflow-hidden flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'md:w-12' : 'md:w-56'}`}>
            {/* Sidebar header */}
            <div className="p-1 md:p-2 border-b border-[var(--border)] flex items-center justify-between">
              <span className={`text-xs font-semibold text-[var(--text-muted)] hidden ${sidebarCollapsed ? '' : 'md:block'}`}>
                Classes
              </span>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] text-xs"
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
                    ? 'bg-[var(--indigo)] text-white'
                    : 'hover:bg-[var(--bg)] text-[var(--text-muted)]'
                }`}
              >
                {/* Mobile / collapsed */}
                <div className={`flex items-center justify-center p-1.5 ${sidebarCollapsed ? '' : 'md:hidden'}`}>
                  <span className="text-xs font-bold">All</span>
                </div>
                {/* Desktop expanded */}
                <div className={`hidden ${sidebarCollapsed ? '' : 'md:flex'} items-center gap-2 px-3 py-2`}>
                  <span className="text-sm font-medium truncate">Toutes</span>
                  <span className={`ml-auto text-xs ${!classFilter ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
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
                      ? 'bg-[var(--indigo)] text-white'
                      : 'hover:bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  {/* Mobile / collapsed: abbreviation */}
                  <div className={`flex items-center justify-center p-1.5 ${sidebarCollapsed ? '' : 'md:hidden'}`}>
                    <span className="text-xs font-bold">{cls.name.slice(0, 2)}</span>
                  </div>
                  {/* Desktop expanded */}
                  <div className={`hidden ${sidebarCollapsed ? '' : 'md:flex'} items-center gap-2 px-3 py-2`}>
                    <span className="text-sm font-medium truncate">{cls.name}</span>
                    <span className={`ml-auto text-xs ${classFilter === cls.id ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                      {cls.studentCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* MAIN CONTENT (right) */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] rounded-xl overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-2 md:px-4 py-2">
              <span className="text-sm font-medium text-[var(--text)]">Vue d'ensemble</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
              {isLoading ? (
                <div className="text-center py-12 text-[var(--text-muted)]">Chargement...</div>
              ) : (
                <OverviewTab
                  overview={filteredOverview}
                  onAwardStamp={openStampModal}
                  onChooseBonus={setBonusTarget}
                  onMarkBonusUsed={doMarkBonusUsed}
                  onStudentClick={openDetailModal}
                  onResetStudent={doResetStudent}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal (au-dessus du panneau Personnaliser) */}
      {showCategoryModal && (
        <Modal
          isOpen
          title={editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          icon={<Stamp size={20} className="text-[var(--indigo)]" />}
          size="lg"
          zIndex={60}
          onClose={() => setShowCategoryModal(false)}
          footer={(
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-3)]">
                Annuler
              </button>
              <button
                onClick={saveCategory}
                disabled={isSaving || !catLabel.trim() || !!duplicateCategory}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'var(--gradient-primary, linear-gradient(135deg, #6366F1, #8B5CF6))' }}
              >
                {isSaving ? 'Enregistrement…' : editingCategory ? 'Enregistrer' : 'Créer la catégorie'}
              </button>
            </div>
          )}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Nom</label>
              <input
                type="text"
                value={catLabel}
                onChange={e => setCatLabel(e.target.value)}
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--indigo)] outline-none"
                placeholder="Ex. : Participation remarquable"
              />
              {duplicateCategory && (
                <p className="text-xs mt-1.5 text-[var(--neg)]">
                  {duplicateCategory.is_active
                    ? 'Cette catégorie existe déjà.'
                    : 'Cette catégorie existe déjà (désactivée) : réactive-la plutôt.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Couleur</label>
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatColor(c)}
                    title={c}
                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: catColor.toLowerCase() === c.toLowerCase() ? 'var(--text)' : 'transparent' }}
                  />
                ))}
                <label className="w-8 h-8 rounded-full border border-dashed border-[var(--border)] grid place-items-center cursor-pointer text-[var(--text-muted)] text-xs" title="Couleur personnalisée">
                  +
                  <input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="sr-only" />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Icône</label>
              <IconPicker
                value={{ icon: catIcon, iconRef: catIconRef }}
                color={catColor}
                userId={user?.id ?? ''}
                onChange={v => { setCatIcon(v.icon); setCatIconRef(v.iconRef); }}
              />
            </div>

            {editingCategory && !duplicateCategory && (
              <p className="text-xs text-[var(--text-muted)]">
                Le changement s’applique aussi aux tampons déjà donnés avec cette catégorie.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Bonus Modal */}
      {showBonusModal && (
        <Modal isOpen title={editingBonus ? 'Modifier le bonus' : 'Nouveau bonus'} icon={<Gift size={20} className="text-[var(--indigo)]" />} zIndex={60} onClose={() => setShowBonusModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Label</label>
              <input
                type="text"
                value={bonusLabel}
                onChange={e => setBonusLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                placeholder="Ex: +1 pt sur la note de son choix"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBonusModal(false)} className="px-4 py-2 text-sm rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-3)]">
                Annuler
              </button>
              <button
                onClick={saveBonus}
                disabled={isSaving || !bonusLabel.trim()}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stamp Attribution Modal */}
      {showStampModal && stampTarget && (
        <Modal isOpen title={`Attribuer un tampon — ${stampTarget.pseudo}`} onClose={() => setShowStampModal(false)}>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Carte n°{stampTarget.card_number} — {stampTarget.stamp_count}/10
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {activeCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => doAwardStamp(cat.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--indigo)] hover:bg-[var(--surface-3)] transition-all text-left"
              >
                <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                  <CategoryIcon icon={cat.icon} iconRef={cat.icon_ref} size={20} color={cat.color} />
                </span>
                <span className="text-sm font-medium text-[var(--text)]">{cat.label}</span>
                <div className="w-3 h-3 rounded-full ml-auto flex-shrink-0" style={{ backgroundColor: cat.color }} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {bonusTarget && (
        <Modal isOpen title={`Choisir le bonus — ${bonusTarget.pseudo}`} onClose={() => setBonusTarget(null)}>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Carte n°{bonusTarget.card_number} complète. Le bonus choisi termine la carte et en ouvre une nouvelle.
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
            {bonuses.filter(b => b.is_active).map(b => (
              <button
                key={b.id}
                onClick={() => doChooseBonus(b.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--indigo)] hover:bg-[var(--surface-3)] transition-all text-left"
              >
                <span className="text-xl">🎁</span>
                <span className="text-sm font-medium text-[var(--text)]">{b.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Panneau Personnaliser (catégories et bonus) */}
      {showConfigModal && (
        <Modal
          isOpen
          title="Personnaliser les récompenses"
          icon={<Settings2 size={20} className="text-[var(--indigo)]" />}
          size="2xl"
          zIndex={50}
          onClose={() => setShowConfigModal(false)}
        >
          <div className="space-y-4">
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface-3)]" role="tablist">
              {([
                { id: 'categories' as ConfigTab, label: 'Catégories de tampons', Icon: Stamp, count: categories.filter(c => c.is_active).length },
                { id: 'bonuses' as ConfigTab, label: 'Bonus de fin de carte', Icon: Gift, count: bonuses.filter(b => b.is_active).length },
              ]).map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={configTab === t.id}
                  onClick={() => setConfigTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    configTab === t.id ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <t.Icon size={15} className={configTab === t.id ? 'text-[var(--indigo)]' : ''} />
                  <span>{t.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${configTab === t.id ? 'bg-[var(--indigo-soft)] text-[var(--indigo)]' : 'bg-[var(--surface)] text-[var(--text-muted)]'}`}>{t.count}</span>
                </button>
              ))}
            </div>

            <div className="max-h-[62vh] overflow-y-auto -mx-1 px-1 pb-1">
              {configTab === 'categories' ? (
                <CategoriesTab
                  categories={categories}
                  onAdd={() => openCategoryModal()}
                  onMove={moveCategory}
                  onStartFromScratch={startFromScratch}
                  onEdit={openCategoryModal}
                  onToggle={toggleCategory}
                  onDelete={deleteCategory}
                />
              ) : (
                <BonusesTab
                  bonuses={bonuses}
                  onAdd={() => openBonusModal()}
                  onEdit={openBonusModal}
                  onToggle={toggleBonus}
                  onDelete={deleteBonusFn}
                />
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Student Stamp Detail Modal */}
      {showDetailModal && detailTarget && (
        <Modal isOpen title={`${detailTarget.pseudo} — Carte à tampons`} onClose={() => setShowDetailModal(false)}>
          {detailLoading ? (
            <div className="text-center py-8 text-[var(--text-muted)]">Chargement...</div>
          ) : !stampDetail ? (
            <div className="text-center py-8 text-[var(--text-muted)]">Pas de carte active</div>
          ) : (() => {
            const tier = getCardTier(stampDetail.card_number);
            const isComplete = stampDetail.stamp_count >= 10;
            return (
            <div className="space-y-4">
              {/* Card visual */}
              <div
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: tier.gradient,
                  boxShadow: `0 4px 20px ${tier.borderColor}30`,
                }}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: tier.bgPattern }} />

                {/* Card header */}
                <div className="relative flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tier.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-white drop-shadow-sm">Carte n°{stampDetail.card_number}</p>
                      <p className="text-xs text-white/70">{tier.name}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                    {stampDetail.stamp_count}/10
                  </span>
                </div>

                {/* Progress bar */}
                <div className="relative h-2.5 bg-black/20 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(stampDetail.stamp_count / 10) * 100}%`,
                      background: isComplete ? tier.progressGradientComplete : tier.progressGradient,
                      backgroundSize: isComplete ? '200% 100%' : undefined,
                    }}
                  />
                </div>

                {/* Stamp grid 2x5 */}
                <div className="relative grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => {
                    const stamp = stampDetail.stamps.find(s => s.slot_number === i + 1);
                    return (
                      <div
                        key={i}
                        className={`relative aspect-square rounded-xl flex items-center justify-center transition-all ${
                          stamp ? 'cursor-pointer hover:scale-110 group' : ''
                        }`}
                        style={{
                          border: stamp ? `2px solid ${stamp.category_color}90` : '2px dashed rgba(255,255,255,0.3)',
                          backgroundColor: stamp ? `${stamp.category_color}25` : 'rgba(0,0,0,0.15)',
                          backdropFilter: 'blur(4px)',
                        }}
                        title={stamp ? `${stamp.category_label} — ${new Date(stamp.awarded_at).toLocaleDateString('fr-FR')}` : `Slot ${i + 1}`}
                      >
                        {stamp
                          ? <CategoryIcon icon={stamp.category_icon} iconRef={stamp.category_icon_ref} size={22} color="#fff" title={stamp.category_label} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }} />
                          : <span className="text-xl drop-shadow-sm">{tier.emptyIcon}</span>}
                        {stamp && (
                          <button
                            onClick={() => doRemoveStamp(stamp.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                            title="Retirer ce tampon"
                          >
                            x
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stamp list (details) */}
              {stampDetail.stamps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Détails des tampons</p>
                  {stampDetail.stamps.map(s => (
                    <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--bg)] group/row">
                      <span className="w-6 h-6 rounded-md grid place-items-center" style={{ backgroundColor: s.category_color + '22', color: s.category_color }}>
                        <CategoryIcon icon={s.category_icon} iconRef={s.category_icon_ref} size={14} color={s.category_color} />
                      </span>
                      <span className="text-xs text-[var(--text)] flex-1">{s.category_label}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(s.awarded_at).toLocaleDateString('fr-FR')}
                      </span>
                      <button
                        onClick={() => doRemoveStamp(s.id)}
                        className="text-xs px-1.5 py-0.5 rounded text-red-500 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-opacity"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed cards history */}
              {stampDetail.completed_cards.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Cartes terminées</p>
                  <div className="space-y-1">
                    {stampDetail.completed_cards.map((c, i) => {
                      const cTier = getCardTier(c.card_number);
                      return (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)]">
                          <span className="text-xs font-medium text-[var(--text)]">
                            {cTier.emoji} Carte n°{c.card_number} <span className="text-[var(--text-muted)]">({cTier.name})</span>
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {c.bonus_label
                              ? `🎁 ${c.bonus_label} ${c.bonus_used ? '✓' : '⏳'}`
                              : 'Pas de bonus'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick action: award stamp */}
              {stampDetail.stamp_count < 10 && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openStampModal(detailTarget);
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                >
                  + Attribuer un tampon
                </button>
              )}
            </div>
            );
          })()}
        </Modal>
      )}
    </Layout>
  );
}

// ============================================
// Sub-components
// ============================================

function OverviewTab({
  overview, onAwardStamp, onChooseBonus, onMarkBonusUsed, onStudentClick, onResetStudent,
}: {
  overview: StudentStampOverview[];
  onAwardStamp: (s: StudentStampOverview) => void;
  onChooseBonus: (s: StudentStampOverview) => void;
  onMarkBonusUsed: (id: string) => void;
  onStudentClick: (s: StudentStampOverview) => void;
  onResetStudent: (s: StudentStampOverview) => void;
}) {
  return (
    <div className="space-y-4">
      {overview.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-4xl mb-2">⭐</p>
          <p>Sélectionnez une classe pour commencer</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden" style={{ boxShadow: 'var(--shadow-1)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-3)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Élève</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Classe</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Carte</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Progression</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Bonus</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.map(s => (
                  <tr key={s.student_id} className="border-t border-[var(--border)] hover:bg-[var(--surface-3)] transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onStudentClick(s)}
                        className="font-medium text-[var(--indigo)] hover:underline"
                      >
                        {s.pseudo}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{s.class_name}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {getCardTier(s.card_number).emoji} n°{s.card_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--surface-3)] rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(s.stamp_count / 10) * 100}%`,
                              background: s.stamp_count === 10 ? '#22c55e' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-[var(--text-muted)]">{s.stamp_count}/10</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.bonus_label ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          s.bonus_used
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          🎁 {s.bonus_label} {s.bonus_used ? '✓' : '⏳'}
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
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                          >
                            + Tampon
                          </button>
                        )}
                        {s.stamp_count >= 10 && !s.bonus_selection_id && (
                          <button
                            onClick={() => onChooseBonus(s)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                            title="Choisir le bonus avec l'élève"
                          >
                            🎁 Choisir le bonus
                          </button>
                        )}
                        {s.bonus_selection_id && !s.bonus_used && (
                          <button
                            onClick={() => onMarkBonusUsed(s.bonus_selection_id!)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                          >
                            Valider bonus
                          </button>
                        )}
                        <button
                          onClick={() => onResetStudent(s)}
                          className="px-2 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--neg)] hover:bg-red-50 transition-colors"
                          title={`Réinitialiser ${s.pseudo}`}
                        >
                          ↺
                        </button>
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

/** Palette proposée pour la couleur d'une catégorie (la roue reste disponible). */
const CATEGORY_COLORS = ['#4CAF50', '#2196F3', '#6366F1', '#9C27B0', '#E91E63', '#F44336', '#FF9800', '#FFC107', '#00BCD4', '#8BC34A', '#795548', '#607D8B'];

function Switch({ checked, onChange, title }: { checked: boolean; onChange: () => void; title: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={onChange}
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: checked ? 'var(--indigo)' : 'var(--border-strong, var(--border))' }}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? 18 : 2 }} />
    </button>
  );
}

function IconButton({ onClick, title, danger, disabled, children }: { onClick: () => void; title: string; danger?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg grid place-items-center transition-colors disabled:opacity-30 ${
        danger ? 'text-[var(--text-muted)] hover:text-[var(--neg)] hover:bg-[var(--neg-soft)]' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]'
      }`}
    >
      {children}
    </button>
  );
}

function CategoriesTab({
  categories, onAdd, onMove, onStartFromScratch, onEdit, onToggle, onDelete,
}: {
  categories: StampCategory[];
  onAdd: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onStartFromScratch: () => void;
  onEdit: (c: StampCategory) => void;
  onToggle: (c: StampCategory) => void;
  onDelete: (id: string) => void;
}) {
  const active = categories.filter(c => c.is_active).length;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)] leading-snug">
          Les motifs pour lesquels tu donnes un tampon. <b className="text-[var(--text)] font-medium">{active}</b> proposée{active > 1 ? 's' : ''} en séance sur {categories.length}.
          Cette liste t’appartient : chaque enseignant a la sienne.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {active > 0 && (
            <button onClick={onStartFromScratch} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)]" title="Désactiver toutes les catégories pour recomposer la liste">
              <RotateCcw size={13} /> Repartir de zéro
            </button>
          )}
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--gradient-primary, linear-gradient(135deg, #6366F1, #8B5CF6))' }}>
            <Plus size={15} /> Nouvelle catégorie
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <Stamp size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text)]">Aucune catégorie pour l’instant.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Crée la première : un nom, une couleur, une icône.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {categories.map((cat, i) => (
            <li
              key={cat.id}
              className={`flex items-center gap-3 pl-1.5 pr-2 py-2 rounded-xl border transition-colors ${
                cat.is_active ? 'border-[var(--border)] bg-[var(--surface)]' : 'border-dashed border-[var(--border)] bg-[var(--surface-3)]'
              }`}
            >
              <div className="flex flex-col -my-1">
                <button onClick={() => onMove(cat.id, -1)} disabled={i === 0} title="Monter" aria-label="Monter" className="w-6 h-4 grid place-items-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => onMove(cat.id, 1)} disabled={i === categories.length - 1} title="Descendre" aria-label="Descendre" className="w-6 h-4 grid place-items-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-20">
                  <ChevronDown size={14} />
                </button>
              </div>
              <span
                className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${cat.is_active ? '' : 'opacity-50 grayscale'}`}
                style={{ backgroundColor: cat.color + '22', color: cat.color }}
              >
                <CategoryIcon icon={cat.icon} iconRef={cat.icon_ref} size={22} color={cat.color} />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${cat.is_active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{cat.label}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {cat.is_active ? 'Proposée en séance' : 'Désactivée · les tampons déjà donnés restent sur les cartes'}
                </p>
              </div>
              <Switch checked={cat.is_active} onChange={() => onToggle(cat)} title={cat.is_active ? 'Désactiver' : 'Activer'} />
              <IconButton onClick={() => onEdit(cat)} title="Modifier"><Pencil size={15} /></IconButton>
              <IconButton onClick={() => onDelete(cat.id)} title="Supprimer" danger><Trash2 size={15} /></IconButton>
            </li>
          ))}
        </ul>
      )}
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
  const active = bonuses.filter(b => b.is_active).length;
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)] leading-snug">
          Ce que l’élève peut choisir quand sa carte est complète. <b className="text-[var(--text)] font-medium">{active}</b> proposé{active > 1 ? 's' : ''} sur {bonuses.length}.
        </p>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white shrink-0" style={{ background: 'var(--gradient-primary, linear-gradient(135deg, #6366F1, #8B5CF6))' }}>
          <Plus size={15} /> Nouveau bonus
        </button>
      </div>

      {bonuses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
          <Gift size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text)]">Aucun bonus pour l’instant.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Ex. : « +1 point sur la note de son choix », « Choisir sa place une semaine ».</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {bonuses.map((bonus, i) => (
            <li
              key={bonus.id}
              className={`flex items-center gap-3 pl-3 pr-2 py-2 rounded-xl border transition-colors ${
                bonus.is_active ? 'border-[var(--border)] bg-[var(--surface)]' : 'border-dashed border-[var(--border)] bg-[var(--surface-3)]'
              }`}
            >
              <span className="w-7 h-7 rounded-lg grid place-items-center text-xs font-bold bg-[var(--indigo-soft)] text-[var(--indigo)] shrink-0">{i + 1}</span>
              <Gift size={18} className={bonus.is_active ? 'text-[var(--indigo)]' : 'text-[var(--text-muted)]'} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${bonus.is_active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{bonus.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{bonus.is_active ? 'Proposé aux élèves' : 'Désactivé'}</p>
              </div>
              <Switch checked={bonus.is_active} onChange={() => onToggle(bonus)} title={bonus.is_active ? 'Désactiver' : 'Activer'} />
              <IconButton onClick={() => onEdit(bonus)} title="Modifier"><Pencil size={15} /></IconButton>
              <IconButton onClick={() => onDelete(bonus.id)} title="Supprimer" danger><Trash2 size={15} /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
