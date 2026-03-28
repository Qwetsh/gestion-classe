import { supabase } from './supabase';

// ============================================
// Types
// ============================================

export interface StampCategory {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Bonus {
  id: string;
  user_id: string;
  label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface StampCard {
  id: string;
  student_id: string;
  user_id: string;
  card_number: number;
  status: 'active' | 'completed';
  completed_at: string | null;
  created_at: string;
}

export interface Stamp {
  id: string;
  card_id: string;
  student_id: string;
  user_id: string;
  category_id: string | null;
  slot_number: number;
  awarded_at: string;
}

export interface BonusSelection {
  id: string;
  card_id: string;
  bonus_id: string | null;
  student_id: string;
  user_id: string;
  selected_at: string;
  used_at: string | null;
}

// Computed types for UI
export interface StudentStampOverview {
  student_id: string;
  pseudo: string;
  class_id: string;
  class_name: string;
  card_id: string;
  card_number: number;
  stamp_count: number;
  bonus_selection_id: string | null;
  bonus_label: string | null;
  bonus_used: boolean;
}

// ============================================
// Card tier system (visual progression)
// ============================================

export interface CardTier {
  name: string;
  emoji: string;
  gradient: string;
  borderColor: string;
  progressGradient: string;
  progressGradientComplete: string;
  bgPattern: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  slotBorder: string;
  slotBg: string;
  emptyIcon: string;
}

export function getCardTier(cardNumber: number): CardTier {
  if (cardNumber >= 4) return CARD_TIERS.gold;
  if (cardNumber === 3) return CARD_TIERS.silver;
  if (cardNumber === 2) return CARD_TIERS.bronze;
  return CARD_TIERS.wood;
}

export const CARD_TIERS: Record<string, CardTier> = {
  wood: {
    name: 'Bois',
    emoji: '🪵',
    gradient: 'linear-gradient(135deg, #8B7355 0%, #6B4F36 30%, #A0826D 50%, #7C5B44 70%, #5C3D2E 100%)',
    borderColor: '#8B7355',
    progressGradient: 'linear-gradient(90deg, #8B7355, #A0826D)',
    progressGradientComplete: 'linear-gradient(90deg, #6B8E23, #8FBC3B)',
    bgPattern: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(139,115,85,0.08) 3px, rgba(139,115,85,0.08) 6px)',
    textColor: '#5C3D2E',
    badgeBg: '#8B735520',
    badgeText: '#6B4F36',
    slotBorder: '#8B735540',
    slotBg: '#8B735508',
    emptyIcon: '🌰',
  },
  bronze: {
    name: 'Bronze',
    emoji: '🥉',
    gradient: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 30%, #DDA15E 50%, #B87333 70%, #8B4513 100%)',
    borderColor: '#CD7F32',
    progressGradient: 'linear-gradient(90deg, #CD7F32, #DDA15E)',
    progressGradientComplete: 'linear-gradient(90deg, #CD7F32, #FFD700, #CD7F32)',
    bgPattern: 'radial-gradient(circle at 20% 80%, rgba(205,127,50,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(205,127,50,0.04) 0%, transparent 50%)',
    textColor: '#8B4513',
    badgeBg: '#CD7F3220',
    badgeText: '#A0522D',
    slotBorder: '#CD7F3240',
    slotBg: '#CD7F3208',
    emptyIcon: '🔸',
  },
  silver: {
    name: 'Argent',
    emoji: '🥈',
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 25%, #E8E8E8 50%, #A9A9A9 75%, #696969 100%)',
    borderColor: '#A9A9A9',
    progressGradient: 'linear-gradient(90deg, #A9A9A9, #D3D3D3)',
    progressGradientComplete: 'linear-gradient(90deg, #A9A9A9, #F5F5F5, #A9A9A9)',
    bgPattern: 'linear-gradient(135deg, rgba(192,192,192,0.08) 25%, transparent 25%, transparent 50%, rgba(192,192,192,0.08) 50%, rgba(192,192,192,0.08) 75%, transparent 75%)',
    textColor: '#4A4A4A',
    badgeBg: '#C0C0C020',
    badgeText: '#696969',
    slotBorder: '#C0C0C050',
    slotBg: '#C0C0C00A',
    emptyIcon: '◇',
  },
  gold: {
    name: 'Or',
    emoji: '🥇',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #DAA520 25%, #FFF8DC 45%, #FFD700 55%, #B8860B 75%, #DAA520 100%)',
    borderColor: '#DAA520',
    progressGradient: 'linear-gradient(90deg, #DAA520, #FFD700)',
    progressGradientComplete: 'linear-gradient(90deg, #DAA520, #FFF8DC, #FFD700, #FFF8DC, #DAA520)',
    bgPattern: 'radial-gradient(circle at 30% 30%, rgba(255,215,0,0.1) 0%, transparent 40%), radial-gradient(circle at 70% 70%, rgba(255,215,0,0.08) 0%, transparent 40%)',
    textColor: '#8B6914',
    badgeBg: '#FFD70025',
    badgeText: '#B8860B',
    slotBorder: '#FFD70050',
    slotBg: '#FFD70010',
    emptyIcon: '✦',
  },
};

// ============================================
// Default data
// ============================================

export const DEFAULT_STAMP_CATEGORIES = [
  { label: 'Aider/Encourager un camarade', icon: '🤝', color: '#4CAF50' },
  { label: 'Utilisation d\'outils', icon: '🔧', color: '#2196F3' },
  { label: 'Participation remarquable', icon: '✋', color: '#FF9800' },
  { label: 'Comportement remarquable', icon: '⭐', color: '#FFC107' },
  { label: 'Accepter une responsabilité', icon: '🎯', color: '#9C27B0' },
  { label: 'Écriture remarquable', icon: '✍️', color: '#3F51B5' },
  { label: 'Créativité remarquable', icon: '🎨', color: '#E91E63' },
  { label: 'Travail supplémentaire', icon: '📚', color: '#795548' },
  { label: 'Avis constructif', icon: '💡', color: '#FFEB3B' },
  { label: 'Serviabilité', icon: '🤲', color: '#00BCD4' },
  { label: 'Rappel utile', icon: '🔔', color: '#FF5722' },
  { label: 'Mémoire remarquable', icon: '🧠', color: '#673AB7' },
  { label: 'Oral remarquable', icon: '🎤', color: '#F44336' },
  { label: 'Rédaction remarquable', icon: '📝', color: '#009688' },
  { label: 'Orthographe remarquable', icon: '📖', color: '#8BC34A' },
  { label: 'Lecture remarquable', icon: '📗', color: '#CDDC39' },
  { label: 'Rattrapage du cours', icon: '🔄', color: '#607D8B' },
  { label: 'Autonomie', icon: '🦾', color: '#FF6F00' },
  { label: 'Travail de groupe remarquable', icon: '👥', color: '#1565C0' },
];

export const DEFAULT_BONUSES = [
  'Choisir sa place de la semaine',
  '+1 pt sur la note de son choix',
  'Rendre un devoir une semaine plus tard',
  '−1 faute en devoir de langue',
  '+1 indice en évaluation',
  'Pas de cours à écrire la semaine',
  'Pas de prise de parole de la semaine',
  'Un article de papeterie au choix',
];

// ============================================
// Seed
// ============================================

export async function seedDefaultData(userId: string): Promise<void> {
  // Check if categories already exist
  const { count: catCount } = await supabase
    .from('stamp_categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!catCount || catCount === 0) {
    const categories = DEFAULT_STAMP_CATEGORIES.map((cat, i) => ({
      user_id: userId,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      display_order: i,
      is_active: true,
    }));
    await supabase.from('stamp_categories').insert(categories);
  }

  // Check if bonuses already exist (separately — mobile sync may have added categories but not bonuses)
  const { count: bonusCount } = await supabase
    .from('bonuses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!bonusCount || bonusCount === 0) {
    const bonuses = DEFAULT_BONUSES.map((label, i) => ({
      user_id: userId,
      label,
      display_order: i,
      is_active: true,
    }));
    await supabase.from('bonuses').insert(bonuses);
  }
}

// ============================================
// Categories CRUD
// ============================================

export async function fetchCategories(userId: string): Promise<StampCategory[]> {
  const { data, error } = await supabase
    .from('stamp_categories')
    .select('*')
    .eq('user_id', userId)
    .order('display_order');

  if (error) throw error;
  // Deduplicate by label (mobile sync + web seed can create doubles)
  const seen = new Set<string>();
  return (data || []).filter(cat => {
    if (seen.has(cat.label)) return false;
    seen.add(cat.label);
    return true;
  });
}

export async function createCategory(userId: string, label: string, icon: string, color: string, displayOrder: number): Promise<StampCategory> {
  const { data, error } = await supabase
    .from('stamp_categories')
    .insert({ user_id: userId, label, icon, color, display_order: displayOrder, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: Partial<Pick<StampCategory, 'label' | 'icon' | 'color' | 'display_order' | 'is_active'>>): Promise<void> {
  const { error } = await supabase.from('stamp_categories').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('stamp_categories').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// Bonuses CRUD
// ============================================

export async function fetchBonuses(userId: string): Promise<Bonus[]> {
  const { data, error } = await supabase
    .from('bonuses')
    .select('*')
    .eq('user_id', userId)
    .order('display_order');

  if (error) throw error;
  // Deduplicate by label (mobile sync + web seed can create doubles)
  const seen = new Set<string>();
  return (data || []).filter(bonus => {
    if (seen.has(bonus.label)) return false;
    seen.add(bonus.label);
    return true;
  });
}

export async function createBonus(userId: string, label: string, displayOrder: number): Promise<Bonus> {
  const { data, error } = await supabase
    .from('bonuses')
    .insert({ user_id: userId, label, display_order: displayOrder, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBonus(id: string, updates: Partial<Pick<Bonus, 'label' | 'display_order' | 'is_active'>>): Promise<void> {
  const { error } = await supabase.from('bonuses').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteBonus(id: string): Promise<void> {
  const { error } = await supabase.from('bonuses').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// Student stamp overview (teacher view)
// ============================================

export async function fetchStudentStampOverview(userId: string, classFilter?: string): Promise<StudentStampOverview[]> {
  // Get all students for this teacher
  let studentsQuery = supabase
    .from('students')
    .select('id, pseudo, class_id, classes!inner(name)')
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (classFilter) {
    studentsQuery = studentsQuery.eq('class_id', classFilter);
  }

  const { data: students, error: studentsError } = await studentsQuery;
  if (studentsError) throw studentsError;
  if (!students || students.length === 0) return [];

  const studentIds = students.map(s => s.id);

  // Get active cards for these students
  const { data: cards, error: cardsError } = await supabase
    .from('stamp_cards')
    .select('id, student_id, card_number')
    .in('student_id', studentIds)
    .eq('status', 'active');

  if (cardsError) throw cardsError;

  const cardMap = new Map<string, { id: string; card_number: number }>();
  for (const card of (cards || [])) {
    cardMap.set(card.student_id, { id: card.id, card_number: card.card_number });
  }

  // Get stamp counts per card
  const cardIds = (cards || []).map(c => c.id);
  let stampCounts = new Map<string, number>();

  if (cardIds.length > 0) {
    const { data: stamps, error: stampsError } = await supabase
      .from('stamps')
      .select('card_id')
      .in('card_id', cardIds);

    if (stampsError) throw stampsError;

    for (const stamp of (stamps || [])) {
      stampCounts.set(stamp.card_id, (stampCounts.get(stamp.card_id) || 0) + 1);
    }
  }

  // Get pending bonus selections
  const { data: selections, error: selectionsError } = await supabase
    .from('bonus_selections')
    .select('id, card_id, student_id, used_at, bonuses(label)')
    .eq('user_id', userId)
    .is('used_at', null);

  if (selectionsError) throw selectionsError;

  const selectionMap = new Map<string, { id: string; label: string }>();
  for (const sel of (selections || [])) {
    const bonusLabel = (sel.bonuses as any)?.label || 'Bonus inconnu';
    selectionMap.set(sel.student_id, { id: sel.id, label: bonusLabel });
  }

  // Build overview
  return students.map(s => {
    const card = cardMap.get(s.id);
    const className = (s.classes as any)?.name || '';
    const selection = selectionMap.get(s.id);

    return {
      student_id: s.id,
      pseudo: s.pseudo,
      class_id: s.class_id,
      class_name: className,
      card_id: card?.id || '',
      card_number: card?.card_number || 1,
      stamp_count: card ? (stampCounts.get(card.id) || 0) : 0,
      bonus_selection_id: selection?.id || null,
      bonus_label: selection?.label || null,
      bonus_used: false,
    };
  }).sort((a, b) => a.pseudo.localeCompare(b.pseudo));
}

// ============================================
// Stamp operations
// ============================================

export async function awardStamp(userId: string, studentId: string, categoryId: string): Promise<{ stampCount: number; cardComplete: boolean }> {
  // Get or create active card
  let { data: card } = await supabase
    .from('stamp_cards')
    .select('id, card_number')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .single();

  if (!card) {
    // Get max card number
    const { data: maxCard } = await supabase
      .from('stamp_cards')
      .select('card_number')
      .eq('student_id', studentId)
      .order('card_number', { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (maxCard?.card_number || 0) + 1;

    const { data: newCard, error: createError } = await supabase
      .from('stamp_cards')
      .insert({ student_id: studentId, user_id: userId, card_number: nextNumber, status: 'active' })
      .select()
      .single();

    if (createError) throw createError;
    card = newCard;
  }

  if (!card) throw new Error('Impossible de créer la carte');

  // Count current stamps
  const { count } = await supabase
    .from('stamps')
    .select('*', { count: 'exact', head: true })
    .eq('card_id', card.id);

  const currentCount = count || 0;
  if (currentCount >= 10) throw new Error('Carte déjà complète');

  const slotNumber = currentCount + 1;

  // Insert stamp
  const { error: stampError } = await supabase
    .from('stamps')
    .insert({
      card_id: card.id,
      student_id: studentId,
      user_id: userId,
      category_id: categoryId,
      slot_number: slotNumber,
    });

  if (stampError) throw stampError;

  return { stampCount: slotNumber, cardComplete: slotNumber === 10 };
}

export async function markBonusUsed(selectionId: string): Promise<void> {
  const { error } = await supabase
    .from('bonus_selections')
    .update({ used_at: new Date().toISOString() })
    .eq('id', selectionId);

  if (error) throw error;
}

// ============================================
// Student stamp detail (for modals)
// ============================================

export interface StampDetail {
  id: string;
  slot_number: number;
  category_label: string;
  category_icon: string;
  category_color: string;
  awarded_at: string;
}

export interface StudentStampDetail {
  card_id: string;
  card_number: number;
  stamp_count: number;
  stamps: StampDetail[];
  completed_cards: {
    card_number: number;
    completed_at: string | null;
    bonus_label: string | null;
    bonus_used: boolean;
  }[];
}

export async function fetchStudentStampDetail(studentId: string): Promise<StudentStampDetail | null> {
  // Get active card
  const { data: card } = await supabase
    .from('stamp_cards')
    .select('id, card_number')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .single();

  if (!card) return null;

  // Get stamps with category info
  const { data: stamps } = await supabase
    .from('stamps')
    .select('id, slot_number, awarded_at, stamp_categories(label, icon, color)')
    .eq('card_id', card.id)
    .order('slot_number');

  // Get completed cards with bonus info
  const { data: completedCards } = await supabase
    .from('stamp_cards')
    .select('card_number, completed_at, bonus_selections(bonuses(label), used_at)')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('card_number', { ascending: false });

  const stampDetails: StampDetail[] = (stamps || []).map(s => ({
    id: s.id,
    slot_number: s.slot_number,
    category_label: (s.stamp_categories as any)?.label || '?',
    category_icon: (s.stamp_categories as any)?.icon || '⭐',
    category_color: (s.stamp_categories as any)?.color || '#999',
    awarded_at: s.awarded_at,
  }));

  const completed = (completedCards || []).map(c => {
    const sel = Array.isArray(c.bonus_selections) ? c.bonus_selections[0] : c.bonus_selections;
    return {
      card_number: c.card_number,
      completed_at: c.completed_at,
      bonus_label: sel ? (sel.bonuses as any)?.label || null : null,
      bonus_used: sel ? !!sel.used_at : false,
    };
  });

  return {
    card_id: card.id,
    card_number: card.card_number,
    stamp_count: stampDetails.length,
    stamps: stampDetails,
    completed_cards: completed,
  };
}

export async function removeStamp(stampId: string): Promise<void> {
  const { error } = await supabase.from('stamps').delete().eq('id', stampId);
  if (error) throw error;
}

// ============================================
// Classes list (for filters)
// ============================================

export async function fetchClasses(userId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('name');

  if (error) throw error;
  return data || [];
}

// ============================================
// Init: create cards for all students
// ============================================

export async function resetAllStampCards(userId: string): Promise<number> {
  // Delete in dependency order: bonus_selections → stamps → stamp_cards
  await supabase.from('bonus_selections').delete().eq('user_id', userId);
  await supabase.from('stamps').delete().eq('user_id', userId);
  const { data: deleted } = await supabase
    .from('stamp_cards')
    .delete()
    .eq('user_id', userId)
    .select('id');

  const deletedCount = deleted?.length || 0;

  // Recreate card n°1 for all non-deleted students
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .eq('is_deleted', false);

  if (students && students.length > 0) {
    const cards = students.map(s => ({
      student_id: s.id,
      user_id: userId,
      card_number: 1,
      status: 'active',
    }));
    await supabase.from('stamp_cards').insert(cards);
  }

  return deletedCount;
}

export async function initializeCardsForClass(userId: string, classId: string): Promise<number> {
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('is_deleted', false);

  if (!students || students.length === 0) return 0;

  let created = 0;
  for (const student of students) {
    // Check if already has an active card
    const { data: existing } = await supabase
      .from('stamp_cards')
      .select('id')
      .eq('student_id', student.id)
      .eq('status', 'active')
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase
        .from('stamp_cards')
        .insert({ student_id: student.id, user_id: userId, card_number: 1, status: 'active' });
      created++;
    }
  }

  return created;
}
