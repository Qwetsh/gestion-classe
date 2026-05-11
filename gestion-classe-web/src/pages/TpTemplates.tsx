import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import type { TpTemplatePhoto } from '../lib/tpTemplatePhotos';
import {
  fetchTemplatePhotos,
  uploadTemplatePhoto,
  deleteTemplatePhoto,
  getPhotoUrl,
} from '../lib/tpTemplatePhotos';

// ─── Types ───────────────────────────────────────────────

interface TpTemplate {
  id: string;
  name: string;
  color: string;
  theme: string | null;
  materials: string[];
  created_at: string;
  criteria_count: number;
  total_points: number;
  usage_count: number;
}

interface EditingCriteria {
  id?: string;
  label: string;
  max_points: number;
  isNew?: boolean;
}

interface TemplateUsage {
  session_id: string;
  session_name: string;
  class_name: string;
  completed_at: string | null;
  success_pct: number;
}

// ─── Color presets ───────────────────────────────────────

const COLOR_PRESETS: { key: string; label: string; accent: string; accentLight: string }[] = [
  { key: 'green',  label: 'Vert',     accent: '#22c55e', accentLight: '#dcfce7' },
  { key: 'blue',   label: 'Bleu',     accent: '#3b82f6', accentLight: '#dbeafe' },
  { key: 'purple', label: 'Violet',   accent: '#8b5cf6', accentLight: '#ede9fe' },
  { key: 'orange', label: 'Orange',   accent: '#f97316', accentLight: '#ffedd5' },
  { key: 'red',    label: 'Rouge',    accent: '#ef4444', accentLight: '#fee2e2' },
  { key: 'pink',   label: 'Rose',     accent: '#ec4899', accentLight: '#fce7f3' },
  { key: 'teal',   label: 'Sarcelle', accent: '#14b8a6', accentLight: '#ccfbf1' },
  { key: 'amber',  label: 'Ambre',    accent: '#f59e0b', accentLight: '#fef3c7' },
];

function getColorPreset(key: string) {
  return COLOR_PRESETS.find(c => c.key === key) || COLOR_PRESETS[0];
}

// ─── Helpers ─────────────────────────────────────────────

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 30) return `il y a ${diffDays}j`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `il y a ${diffMonths} mois`;
  const diffYears = Math.floor(diffDays / 365);
  return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

// ─── Component ───────────────────────────────────────────

export function TpTemplates() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();

  // List
  const [templates, setTemplates] = useState<TpTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search / filter / sort
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'points' | 'used' | 'az'>('recent');

  // Detail modal
  const [selectedTemplate, setSelectedTemplate] = useState<TpTemplate | null>(null);
  const [detailCriteria, setDetailCriteria] = useState<{ label: string; max_points: number }[]>([]);
  const [detailPhotos, setDetailPhotos] = useState<TpTemplatePhoto[]>([]);
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<Record<string, string>>({});
  const [detailUsages, setDetailUsages] = useState<TemplateUsage[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TpTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateColor, setTemplateColor] = useState('green');
  const [templateTheme, setTemplateTheme] = useState('');
  const [criteria, setCriteria] = useState<EditingCriteria[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Photos (edit modal)
  const [photos, setPhotos] = useState<TpTemplatePhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TpTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Data loading ────────────────────────────────────

  useEffect(() => { loadTemplates(); }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: tData, error: tErr } = await supabase
        .from('tp_templates')
        .select('id, name, color, theme, materials, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (tErr) throw tErr;
      if (!tData || tData.length === 0) { setTemplates([]); return; }

      const ids = tData.map(t => t.id);

      // Criteria stats
      const { data: cData } = await supabase
        .from('tp_template_criteria')
        .select('template_id, max_points')
        .in('template_id', ids);
      const statsMap = new Map<string, { count: number; points: number }>();
      (cData || []).forEach(c => {
        const cur = statsMap.get(c.template_id) || { count: 0, points: 0 };
        statsMap.set(c.template_id, { count: cur.count + 1, points: cur.points + c.max_points });
      });

      // Usage counts
      const { data: uData } = await supabase
        .from('group_sessions')
        .select('template_id')
        .in('template_id', ids);
      const usageMap = new Map<string, number>();
      (uData || []).forEach(s => {
        usageMap.set(s.template_id, (usageMap.get(s.template_id) || 0) + 1);
      });

      setTemplates(tData.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || 'green',
        theme: t.theme || null,
        materials: t.materials || [],
        created_at: t.created_at,
        criteria_count: statsMap.get(t.id)?.count || 0,
        total_points: statsMap.get(t.id)?.points || 0,
        usage_count: usageMap.get(t.id) || 0,
      })));
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Erreur lors du chargement des modeles.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId: string) => {
    setIsLoadingDetail(true);
    try {
      // Criteria
      const { data: cData } = await supabase
        .from('tp_template_criteria')
        .select('label, max_points, display_order')
        .eq('template_id', templateId)
        .order('display_order');
      setDetailCriteria(cData || []);

      // Photos
      const tPhotos = await fetchTemplatePhotos(templateId);
      setDetailPhotos(tPhotos);
      const urls: Record<string, string> = {};
      await Promise.all(tPhotos.map(async (p) => {
        const url = await getPhotoUrl(p.file_path);
        if (url) urls[p.id] = url;
      }));
      setDetailPhotoUrls(urls);

      // Usages
      const { data: sessions } = await supabase
        .from('group_sessions')
        .select('id, name, completed_at, classes(name)')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessions && sessions.length > 0) {
        const usages: TemplateUsage[] = [];
        for (const s of sessions) {
          const { data: criteria } = await supabase
            .from('grading_criteria')
            .select('max_points')
            .eq('session_id', s.id);
          const maxPts = (criteria || []).reduce((sum, c) => sum + c.max_points, 0);

          const { data: groups } = await supabase
            .from('session_groups')
            .select('id')
            .eq('session_id', s.id);

          let totalPct = 0;
          let groupCount = 0;
          for (const g of (groups || [])) {
            const { data: grades } = await supabase
              .from('group_grades')
              .select('points_awarded')
              .eq('group_id', g.id);
            const grpTotal = (grades || []).reduce((sum, gr) => sum + gr.points_awarded, 0);
            if (maxPts > 0) { totalPct += (grpTotal / maxPts) * 100; groupCount++; }
          }

          usages.push({
            session_id: s.id,
            session_name: s.name,
            class_name: (s as any).classes?.name || '?',
            completed_at: s.completed_at,
            success_pct: groupCount > 0 ? Math.round(totalPct / groupCount) : 0,
          });
        }
        setDetailUsages(usages);
      } else {
        setDetailUsages([]);
      }
    } catch (err) {
      console.error('Error loading template detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ─── Filtering & sorting ────────────────────────────

  const uniqueThemes = Array.from(
    new Set(templates.map(t => t.theme).filter((t): t is string => !!t))
  );

  const filteredTemplates = templates
    .filter(t => {
      if (selectedTheme && t.theme !== selectedTheme) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.theme && t.theme.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'points': return b.total_points - a.total_points;
        case 'used': return b.usage_count - a.usage_count;
        case 'az': return a.name.localeCompare(b.name, 'fr');
      }
    });

  const totalSessions = templates.reduce((s, t) => s + t.usage_count, 0);

  // ─── Detail modal ───────────────────────────────────

  const handleOpenDetail = async (template: TpTemplate) => {
    setSelectedTemplate(template);
    await loadTemplateDetail(template.id);
  };

  const handleCloseDetail = () => {
    setSelectedTemplate(null);
    setDetailCriteria([]);
    setDetailPhotos([]);
    setDetailPhotoUrls({});
    setDetailUsages([]);
  };

  // ─── Create / Edit modal ───────────────────────────

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateColor('green');
    setTemplateTheme('');
    setCriteria([{ label: '', max_points: 5, isNew: true }]);
    setMaterials([]);
    setNewMaterial('');
    setPhotos([]);
    setPhotoUrls({});
    setShowModal(true);
  };

  const handleOpenEdit = async (template: TpTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateColor(template.color || 'green');
    setTemplateTheme(template.theme || '');
    setMaterials(template.materials || []);
    setNewMaterial('');

    const { data: cData } = await supabase
      .from('tp_template_criteria')
      .select('id, label, max_points, display_order')
      .eq('template_id', template.id)
      .order('display_order');
    setCriteria(
      cData && cData.length > 0
        ? cData.map(c => ({ id: c.id, label: c.label, max_points: c.max_points }))
        : [{ label: '', max_points: 5, isNew: true }]
    );

    try {
      const tPhotos = await fetchTemplatePhotos(template.id);
      setPhotos(tPhotos);
      const urls: Record<string, string> = {};
      await Promise.all(tPhotos.map(async (p) => {
        const url = await getPhotoUrl(p.file_path);
        if (url) urls[p.id] = url;
      }));
      setPhotoUrls(urls);
    } catch {
      setPhotos([]);
      setPhotoUrls({});
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateColor('green');
    setTemplateTheme('');
    setCriteria([]);
    setMaterials([]);
    setNewMaterial('');
    setPhotos([]);
    setPhotoUrls({});
  };

  const handleSave = async () => {
    if (!user || !templateName.trim()) return;
    const validCriteria = criteria.filter(c => c.label.trim());
    if (validCriteria.length === 0) { toast('Ajoutez au moins un critere', 'warning'); return; }

    setIsSaving(true);
    try {
      const themeValue = templateTheme.trim() || null;
      if (editingTemplate) {
        const { error: uErr } = await supabase
          .from('tp_templates')
          .update({ name: templateName.trim(), color: templateColor, theme: themeValue, materials })
          .eq('id', editingTemplate.id);
        if (uErr) throw uErr;

        await supabase.from('tp_template_criteria').delete().eq('template_id', editingTemplate.id);
        const rows = validCriteria.map((c, i) => ({
          template_id: editingTemplate.id, label: c.label.trim(), max_points: c.max_points, display_order: i,
        }));
        const { error: cErr } = await supabase.from('tp_template_criteria').insert(rows);
        if (cErr) throw cErr;
      } else {
        const { data: newT, error: iErr } = await supabase
          .from('tp_templates')
          .insert({ user_id: user.id, name: templateName.trim(), color: templateColor, theme: themeValue, materials })
          .select()
          .single();
        if (iErr) throw iErr;

        const rows = validCriteria.map((c, i) => ({
          template_id: newT.id, label: c.label.trim(), max_points: c.max_points, display_order: i,
        }));
        const { error: cErr } = await supabase.from('tp_template_criteria').insert(rows);
        if (cErr) throw cErr;
      }

      handleCloseModal();
      setSelectedTemplate(null);
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Criteria handlers ─────────────────────────────

  const handleAddCriteria = () => setCriteria([...criteria, { label: '', max_points: 5, isNew: true }]);
  const handleRemoveCriteria = (i: number) => { if (criteria.length > 1) setCriteria(criteria.filter((_, idx) => idx !== i)); };
  const handleCriteriaChange = (i: number, field: 'label' | 'max_points', value: string | number) => {
    const u = [...criteria];
    if (field === 'label') u[i].label = value as string; else u[i].max_points = value as number;
    setCriteria(u);
  };

  // ─── Materials handlers ────────────────────────────

  const handleAddMaterial = () => {
    const t = newMaterial.trim();
    if (t && !materials.includes(t)) { setMaterials([...materials, t]); setNewMaterial(''); }
  };
  const handleRemoveMaterial = (i: number) => setMaterials(materials.filter((_, idx) => idx !== i));

  // ─── Photo handlers ────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !editingTemplate) return;
    setIsUploadingPhoto(true);
    try {
      const photo = await uploadTemplatePhoto(user.id, editingTemplate.id, file, '');
      const url = await getPhotoUrl(photo.file_path);
      setPhotos(prev => [...prev, photo]);
      if (url) setPhotoUrls(prev => ({ ...prev, [photo.id]: url }));
      toast('Photo ajoutee', 'success');
    } catch (err) {
      console.error('Error uploading photo:', err);
      toast("Erreur lors de l'upload");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: TpTemplatePhoto) => {
    try {
      await deleteTemplatePhoto(photo);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setPhotoUrls(prev => { const c = { ...prev }; delete c[photo.id]; return c; });
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast('Erreur lors de la suppression');
    }
  };

  // ─── Delete handlers ──────────────────────────────

  const handleDeleteClick = (template: TpTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('tp_templates').delete().eq('id', templateToDelete.id);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
      setSelectedTemplate(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      toast('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Render: Loading ──────────────────────────────

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--text-muted)]">Chargement...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5">
        {/* Error */}
        {error && (
          <div className="bg-[var(--neg-soft)] text-[var(--neg)] p-4 flex items-center justify-between" style={{ borderRadius: 'var(--radius)' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--neg)] hover:opacity-70">x</button>
          </div>
        )}

        {/* ─── Header ───────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
              Mes TP
            </h1>
            <p className="text-[var(--text-muted)] mt-1">
              {templates.length} modele{templates.length > 1 ? 's' : ''}
              {totalSessions > 0 && <> &middot; {totalSessions} seance{totalSessions > 1 ? 's' : ''} notee{totalSessions > 1 ? 's' : ''}</>}
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 text-white font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}
          >
            + Nouveau TP
          </button>
        </div>

        {/* ─── Empty state ──────────────────────── */}
        {templates.length === 0 ? (
          <div className="bg-[var(--surface)] p-12 text-center border border-[var(--border)]" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}>
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius-full)' }}>
              <span className="text-4xl">📋</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Aucun modele de TP</h2>
            <p className="text-[var(--text-dim)] mt-2">Creez des modeles de TP avec leurs criteres de notation</p>
            <button onClick={handleOpenCreate} className="mt-5 px-5 py-2.5 text-white font-medium transition-all hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}>
              Creer mon premier TP
            </button>
          </div>
        ) : (
          <>
            {/* ─── Search / Filter / Sort bar ─── */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 bg-[var(--surface)] p-3 border border-[var(--border)]" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}>
              {/* Search */}
              <div className="relative flex-shrink-0 w-full md:w-56">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] text-sm">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un TP, un theme..."
                  className="w-full pl-9 pr-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]"
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </div>

              {/* Theme pills */}
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                <button
                  onClick={() => setSelectedTheme(null)}
                  className="px-3 py-1 text-xs font-semibold transition-colors"
                  style={{
                    borderRadius: 'var(--radius-full)',
                    background: selectedTheme === null ? 'var(--indigo)' : 'var(--surface-3)',
                    color: selectedTheme === null ? 'white' : 'var(--text-muted)',
                  }}
                >
                  Tous {templates.length}
                </button>
                {uniqueThemes.map(theme => {
                  const count = templates.filter(t => t.theme === theme).length;
                  const sampleT = templates.find(t => t.theme === theme);
                  const preset = getColorPreset(sampleT?.color || 'green');
                  return (
                    <button
                      key={theme}
                      onClick={() => setSelectedTheme(selectedTheme === theme ? null : theme)}
                      className="px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      style={{
                        borderRadius: 'var(--radius-full)',
                        background: selectedTheme === theme ? preset.accent : 'var(--surface-3)',
                        color: selectedTheme === theme ? 'white' : 'var(--text-muted)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: preset.accent }} />
                      {theme} {count}
                    </button>
                  );
                })}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 flex-shrink-0 text-xs">
                <span className="text-[var(--text-dim)] font-semibold tracking-wider mr-1">TRIER</span>
                {([['recent', 'Recent'], ['points', 'Points'], ['used', 'Utilise'], ['az', 'A-Z']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className="px-2 py-1 transition-colors"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      fontWeight: sortBy === key ? 600 : 400,
                      color: sortBy === key ? 'var(--indigo)' : 'var(--text-muted)',
                      background: sortBy === key ? 'var(--indigo-soft)' : 'transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Table ──────────────────────── */}
            <div className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}>
              {/* Header */}
              <div className="grid items-center px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-3)] text-xs font-semibold text-[var(--text-dim)] tracking-wider uppercase"
                style={{ gridTemplateColumns: '1fr 140px 1fr 90px 90px' }}>
                <span>Titre</span>
                <span>Theme</span>
                <span>Criteres</span>
                <span className="text-right">Points</span>
                <span className="text-right">Utilise</span>
              </div>

              {/* Rows */}
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                  Aucun TP ne correspond a votre recherche
                </div>
              ) : (
                filteredTemplates.map(template => {
                  const preset = getColorPreset(template.color);
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleOpenDetail(template)}
                      className="grid items-center px-4 py-3 border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                      style={{ gridTemplateColumns: '1fr 140px 1fr 90px 90px' }}
                    >
                      {/* Titre */}
                      <div className="flex items-center gap-3">
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: preset.accent }} />
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text)] truncate">{template.name}</div>
                          <div className="text-xs text-[var(--text-dim)]">
                            Cree le {formatDate(template.created_at)} &middot; {formatTimeAgo(template.created_at)}
                          </div>
                        </div>
                      </div>

                      {/* Theme */}
                      <div>
                        {template.theme ? (
                          <span
                            className="text-xs font-bold tracking-wider uppercase px-2.5 py-1"
                            style={{ borderRadius: 'var(--radius-md)', color: preset.accent, background: preset.accentLight }}
                          >
                            {template.theme}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-dim)]">&mdash;</span>
                        )}
                      </div>

                      {/* Criteres */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {/* We show criteria_count info — actual labels loaded on detail */}
                        <span className="text-sm text-[var(--text-muted)]">
                          {template.criteria_count} critere{template.criteria_count > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <span className="text-xl font-bold text-[var(--text)]">{template.total_points}</span>
                        <span className="text-xs text-[var(--text-dim)] ml-0.5">pts</span>
                      </div>

                      {/* Utilise */}
                      <div className="text-right">
                        <span className="text-xl font-bold text-[var(--text)]">{template.usage_count}</span>
                        <div className="text-xs text-[var(--text-dim)]">
                          seance{template.usage_count > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ─── Detail Modal ─────────────────────── */}
        {selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCloseDetail}>
            <div
              className="bg-[var(--surface)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              {(() => {
                const preset = getColorPreset(selectedTemplate.color);
                return (
                  <div className="p-5 shrink-0" style={{ background: `linear-gradient(135deg, ${preset.accent} 0%, ${preset.accent}99 100%)` }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white drop-shadow-sm">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          {selectedTemplate.theme && (
                            <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 bg-white/20 text-white backdrop-blur-sm" style={{ borderRadius: 'var(--radius-md)' }}>
                              {selectedTemplate.theme}
                            </span>
                          )}
                          <span className="text-white/70 text-sm">
                            {selectedTemplate.criteria_count} critere{selectedTemplate.criteria_count > 1 ? 's' : ''} &middot; {selectedTemplate.total_points} pts
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(selectedTemplate)}
                          className="p-2 bg-white/20 hover:bg-white/40 transition-colors text-white"
                          style={{ borderRadius: 'var(--radius-md)' }}
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteClick(selectedTemplate)}
                          className="p-2 bg-white/20 hover:bg-red-500/80 transition-colors text-white"
                          style={{ borderRadius: 'var(--radius-md)' }}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                        <button
                          onClick={handleCloseDetail}
                          className="p-2 hover:bg-white/20 transition-colors text-white"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {isLoadingDetail ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Criteres */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Criteres de notation</h4>
                      {detailCriteria.length === 0 ? (
                        <p className="text-sm text-[var(--text-dim)]">Aucun critere</p>
                      ) : (
                        <div className="space-y-2">
                          {detailCriteria.map((crit, idx) => {
                            const preset = getColorPreset(selectedTemplate.color);
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-[var(--surface-3)] border border-[var(--border)]" style={{ borderRadius: 'var(--radius-md)' }}>
                                <span className="text-sm text-[var(--text)]">{crit.label}</span>
                                <span className="text-sm font-semibold px-2.5 py-0.5" style={{ borderRadius: 'var(--radius-md)', color: preset.accent, background: preset.accentLight }}>
                                  {crit.max_points} pts
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Materiel */}
                    {selectedTemplate.materials && selectedTemplate.materials.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Materiel necessaire</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTemplate.materials.map((mat, idx) => {
                            const preset = getColorPreset(selectedTemplate.color);
                            return (
                              <span key={idx} className="text-sm px-3 py-1.5 font-medium" style={{ borderRadius: 'var(--radius-full)', background: preset.accentLight, color: preset.accent }}>
                                {mat}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Photos */}
                    {detailPhotos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                          Photos de reference ({detailPhotos.length})
                        </h4>
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                          {detailPhotos.map(photo => (
                            <div key={photo.id} className="aspect-square overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                              {detailPhotoUrls[photo.id] ? (
                                <img src={detailPhotoUrls[photo.id]} alt={photo.caption || 'Photo TP'} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[var(--surface-3)] flex items-center justify-center">
                                  <span className="text-[var(--text-dim)] text-xs">...</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Utilisations recentes */}
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                        Utilisations recentes
                      </h4>
                      {detailUsages.length === 0 ? (
                        <p className="text-sm text-[var(--text-dim)] py-2">Aucune utilisation enregistree</p>
                      ) : (
                        <div className="space-y-2">
                          {detailUsages.map(usage => {
                            const pct = usage.success_pct;
                            const pctColor = pct >= 70 ? 'var(--pos)' : pct >= 50 ? '#f59e0b' : 'var(--neg)';
                            return (
                              <div key={usage.session_id} className="flex items-center justify-between p-3 bg-[var(--surface-3)] border border-[var(--border)]" style={{ borderRadius: 'var(--radius-md)' }}>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-[var(--text)] truncate">{usage.session_name}</div>
                                  <div className="text-xs text-[var(--text-dim)]">
                                    {usage.class_name}
                                    {usage.completed_at && <> &middot; {formatTimeAgo(usage.completed_at)}</>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                  <div className="w-16 h-2 bg-[var(--surface)] overflow-hidden" style={{ borderRadius: 'var(--radius-full)' }}>
                                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: pctColor, borderRadius: 'var(--radius-full)' }} />
                                  </div>
                                  <span className="text-sm font-bold w-10 text-right" style={{ color: pctColor }}>{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border)] shrink-0 bg-[var(--surface-3)]">
                <button
                  onClick={handleCloseDetail}
                  className="w-full px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Create/Edit Modal ────────────────── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div
              className="bg-[var(--surface)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
              style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
            >
              {/* Header */}
              <div className="p-5 shrink-0" style={{ background: `linear-gradient(135deg, ${getColorPreset(templateColor).accent} 0%, ${getColorPreset(templateColor).accent}99 100%)` }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white drop-shadow-sm">
                    {editingTemplate ? 'Modifier le TP' : 'Nouveau TP'}
                  </h3>
                  <button onClick={handleCloseModal} className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors text-white" style={{ borderRadius: 'var(--radius)' }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Nom du TP</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Ex: TP Circuits electriques"
                    className="w-full px-4 py-3 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-[var(--indigo)]"
                    style={{ borderRadius: 'var(--radius)' }}
                  />
                </div>

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Theme</label>
                  <input
                    type="text"
                    value={templateTheme}
                    onChange={e => setTemplateTheme(e.target.value)}
                    placeholder="Ex: Anatomie, Electricite..."
                    list="theme-suggestions"
                    className="w-full px-4 py-3 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-[var(--indigo)]"
                    style={{ borderRadius: 'var(--radius)' }}
                  />
                  <datalist id="theme-suggestions">
                    {uniqueThemes.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Couleur</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setTemplateColor(c.key)}
                        className="w-9 h-9 transition-all hover:scale-110"
                        style={{
                          borderRadius: 'var(--radius-full)',
                          background: c.accent,
                          boxShadow: templateColor === c.key ? `0 0 0 3px white, 0 0 0 5px ${c.accent}` : 'none',
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Criteria */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-[var(--text-muted)]">Criteres de notation</label>
                    <span className="text-sm font-semibold px-2 py-1" style={{ borderRadius: 'var(--radius-md)', color: getColorPreset(templateColor).accent, background: getColorPreset(templateColor).accentLight }}>
                      Total: {criteria.reduce((sum, c) => sum + (c.max_points || 0), 0)} pts
                    </span>
                  </div>
                  <div className="space-y-3">
                    {criteria.map((crit, index) => (
                      <div key={index} className="flex gap-2 items-center p-3 bg-[var(--surface-3)] border border-[var(--border)]" style={{ borderRadius: 'var(--radius)' }}>
                        <input
                          type="text"
                          value={crit.label}
                          onChange={e => handleCriteriaChange(index, 'label', e.target.value)}
                          placeholder="Nom du critere"
                          className="flex-1 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] text-sm"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        />
                        <input
                          type="number"
                          value={crit.max_points}
                          onChange={e => handleCriteriaChange(index, 'max_points', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.5"
                          className="w-20 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] text-sm text-center font-semibold"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        />
                        <span className="text-sm text-[var(--indigo)] font-medium w-8">pts</span>
                        <button
                          onClick={() => handleRemoveCriteria(index)}
                          disabled={criteria.length <= 1}
                          className="p-2 hover:bg-[var(--neg-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleAddCriteria}
                    className="mt-3 w-full py-3 border-2 border-dashed border-[var(--indigo)]/30 text-[var(--indigo)] hover:border-[var(--indigo)] hover:bg-[var(--indigo-soft)] transition-colors text-sm font-medium"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    + Ajouter un critere
                  </button>
                </div>

                {/* Materials */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Materiel necessaire</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newMaterial}
                      onChange={e => setNewMaterial(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMaterial(); } }}
                      placeholder="Ex: Microscope, lames..."
                      className="flex-1 px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] text-sm"
                      style={{ borderRadius: 'var(--radius-md)' }}
                    />
                    <button
                      onClick={handleAddMaterial}
                      disabled={!newMaterial.trim()}
                      className="px-4 py-2 text-sm font-medium text-white disabled:opacity-40 transition-colors"
                      style={{ background: getColorPreset(templateColor).accent, borderRadius: 'var(--radius-md)' }}
                    >
                      +
                    </button>
                  </div>
                  {materials.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {materials.map((mat, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium" style={{ borderRadius: 'var(--radius-full)', background: getColorPreset(templateColor).accentLight, color: getColorPreset(templateColor).accent }}>
                          {mat}
                          <button onClick={() => handleRemoveMaterial(idx)} className="ml-1 hover:opacity-60 transition-opacity font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Photos (edit only) */}
                {editingTemplate && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Photos de reference</label>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    {photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {photos.map(photo => (
                          <div key={photo.id} className="relative group/photo aspect-square overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                            {photoUrls[photo.id] ? (
                              <img src={photoUrls[photo.id]} alt={photo.caption || 'Photo TP'} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[var(--surface-3)] flex items-center justify-center">
                                <span className="text-[var(--text-dim)] text-xs">Chargement...</span>
                              </div>
                            )}
                            <button
                              onClick={() => handleDeletePhoto(photo)}
                              className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                              style={{ borderRadius: 'var(--radius-full)' }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="w-full py-3 border-2 border-dashed border-[var(--indigo)]/30 text-[var(--indigo)] hover:border-[var(--indigo)] hover:bg-[var(--indigo-soft)] transition-colors text-sm font-medium disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius)' }}
                    >
                      {isUploadingPhoto ? 'Upload en cours...' : 'Ajouter une photo'}
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border)] shrink-0 flex gap-3 bg-[var(--surface-3)]">
                <button
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !templateName.trim()}
                  className="flex-1 px-4 py-2.5 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: getColorPreset(templateColor).accent, borderRadius: 'var(--radius)' }}
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Delete Confirmation ──────────────── */}
        {showDeleteConfirm && templateToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-[var(--surface)] w-full max-w-md p-6" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-[var(--neg-soft)] flex items-center justify-center" style={{ borderRadius: 'var(--radius-full)' }}>
                  <span className="text-3xl">🗑️</span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Supprimer ce modele ?</h3>
                <p className="text-[var(--text-muted)] mt-2">
                  Le modele <strong>{templateToDelete.name}</strong> sera definitivement supprime.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setTemplateToDelete(null); }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-[var(--neg)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
