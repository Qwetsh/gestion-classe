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

interface TpTemplate {
  id: string;
  name: string;
  color: string;
  materials: string[];
  created_at: string;
  criteria_count: number;
  total_points: number;
}

const COLOR_PRESETS: { key: string; label: string; gradient: string; accent: string; accentLight: string }[] = [
  { key: 'green',  label: 'Vert',    gradient: 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #ffffff 100%)', accent: '#22c55e', accentLight: '#dcfce7' },
  { key: 'blue',   label: 'Bleu',    gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #ffffff 100%)', accent: '#3b82f6', accentLight: '#dbeafe' },
  { key: 'purple', label: 'Violet',  gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #ffffff 100%)', accent: '#8b5cf6', accentLight: '#ede9fe' },
  { key: 'orange', label: 'Orange',  gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #ffffff 100%)', accent: '#f97316', accentLight: '#ffedd5' },
  { key: 'red',    label: 'Rouge',   gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 50%, #ffffff 100%)', accent: '#ef4444', accentLight: '#fee2e2' },
  { key: 'pink',   label: 'Rose',    gradient: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #ffffff 100%)', accent: '#ec4899', accentLight: '#fce7f3' },
  { key: 'teal',   label: 'Sarcelle',gradient: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 50%, #ffffff 100%)', accent: '#14b8a6', accentLight: '#ccfbf1' },
  { key: 'amber',  label: 'Ambre',   gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #ffffff 100%)', accent: '#f59e0b', accentLight: '#fef3c7' },
];

function getColorPreset(key: string) {
  return COLOR_PRESETS.find(c => c.key === key) || COLOR_PRESETS[0];
}

interface EditingCriteria {
  id?: string;
  label: string;
  max_points: number;
  isNew?: boolean;
}

export function TpTemplates() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const [templates, setTemplates] = useState<TpTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TpTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateColor, setTemplateColor] = useState('green');
  const [criteria, setCriteria] = useState<EditingCriteria[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<TpTemplatePhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TpTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Expanded criteria view
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<{ label: string; max_points: number }[]>([]);
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      // Load templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('tp_templates')
        .select('id, name, color, materials, created_at')
        .eq('user_id', user.id)
        .order('name');

      if (templatesError) throw templatesError;

      if (templatesData && templatesData.length > 0) {
        // Load criteria counts and points
        const templateIds = templatesData.map(t => t.id);
        const { data: criteriaData } = await supabase
          .from('tp_template_criteria')
          .select('template_id, max_points')
          .in('template_id', templateIds);

        // Aggregate
        const statsMap = new Map<string, { count: number; points: number }>();
        (criteriaData || []).forEach(c => {
          const current = statsMap.get(c.template_id) || { count: 0, points: 0 };
          statsMap.set(c.template_id, {
            count: current.count + 1,
            points: current.points + c.max_points,
          });
        });

        const templatesWithStats = templatesData.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color || 'green',
          materials: t.materials || [],
          created_at: t.created_at,
          criteria_count: statsMap.get(t.id)?.count || 0,
          total_points: statsMap.get(t.id)?.points || 0,
        }));

        setTemplates(templatesWithStats);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Erreur lors du chargement des modeles.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateColor('green');
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
    setMaterials(template.materials || []);
    setNewMaterial('');

    // Load criteria for this template
    const { data: criteriaData } = await supabase
      .from('tp_template_criteria')
      .select('id, label, max_points, display_order')
      .eq('template_id', template.id)
      .order('display_order');

    if (criteriaData && criteriaData.length > 0) {
      setCriteria(criteriaData.map(c => ({
        id: c.id,
        label: c.label,
        max_points: c.max_points,
      })));
    } else {
      setCriteria([{ label: '', max_points: 5, isNew: true }]);
    }

    // Load photos
    try {
      const templatePhotos = await fetchTemplatePhotos(template.id);
      setPhotos(templatePhotos);
      // Load signed URLs
      const urls: Record<string, string> = {};
      await Promise.all(templatePhotos.map(async (p) => {
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
    setCriteria([]);
    setMaterials([]);
    setNewMaterial('');
    setPhotos([]);
    setPhotoUrls({});
  };

  const handleAddCriteria = () => {
    setCriteria([...criteria, { label: '', max_points: 5, isNew: true }]);
  };

  const handleRemoveCriteria = (index: number) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((_, i) => i !== index));
    }
  };

  const handleCriteriaChange = (index: number, field: 'label' | 'max_points', value: string | number) => {
    const updated = [...criteria];
    if (field === 'label') {
      updated[index].label = value as string;
    } else {
      updated[index].max_points = value as number;
    }
    setCriteria(updated);
  };

  const handleAddMaterial = () => {
    const trimmed = newMaterial.trim();
    if (trimmed && !materials.includes(trimmed)) {
      setMaterials([...materials, trimmed]);
      setNewMaterial('');
    }
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

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
      toast('Erreur lors de l\'upload');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: TpTemplatePhoto) => {
    try {
      await deleteTemplatePhoto(photo);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setPhotoUrls(prev => {
        const copy = { ...prev };
        delete copy[photo.id];
        return copy;
      });
    } catch (err) {
      console.error('Error deleting photo:', err);
      toast('Erreur lors de la suppression');
    }
  };

  const handleSave = async () => {
    if (!user || !templateName.trim()) return;

    // Validate criteria
    const validCriteria = criteria.filter(c => c.label.trim());
    if (validCriteria.length === 0) {
      toast('Ajoutez au moins un critere', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('tp_templates')
          .update({ name: templateName.trim(), color: templateColor, materials })
          .eq('id', editingTemplate.id);

        if (updateError) throw updateError;

        // Delete old criteria and insert new ones
        await supabase
          .from('tp_template_criteria')
          .delete()
          .eq('template_id', editingTemplate.id);

        const criteriaToInsert = validCriteria.map((c, idx) => ({
          template_id: editingTemplate.id,
          label: c.label.trim(),
          max_points: c.max_points,
          display_order: idx,
        }));

        const { error: criteriaError } = await supabase
          .from('tp_template_criteria')
          .insert(criteriaToInsert);

        if (criteriaError) throw criteriaError;
      } else {
        // Create new template
        const { data: newTemplate, error: insertError } = await supabase
          .from('tp_templates')
          .insert({
            user_id: user.id,
            name: templateName.trim(),
            color: templateColor,
            materials,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert criteria
        const criteriaToInsert = validCriteria.map((c, idx) => ({
          template_id: newTemplate.id,
          label: c.label.trim(),
          max_points: c.max_points,
          display_order: idx,
        }));

        const { error: criteriaError } = await supabase
          .from('tp_template_criteria')
          .insert(criteriaToInsert);

        if (criteriaError) throw criteriaError;
      }

      handleCloseModal();
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (template: TpTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  };

  const handleToggleCriteria = async (template: TpTemplate) => {
    if (expandedTemplateId === template.id) {
      // Collapse
      setExpandedTemplateId(null);
      setExpandedCriteria([]);
      return;
    }

    // Expand and load criteria
    setExpandedTemplateId(template.id);
    setIsLoadingCriteria(true);

    try {
      const { data: criteriaData } = await supabase
        .from('tp_template_criteria')
        .select('label, max_points, display_order')
        .eq('template_id', template.id)
        .order('display_order');

      setExpandedCriteria(criteriaData || []);
    } catch (err) {
      console.error('Error loading criteria:', err);
      setExpandedCriteria([]);
    } finally {
      setIsLoadingCriteria(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tp_templates')
        .delete()
        .eq('id', templateToDelete.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      toast('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

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
      <div>
        <div className="space-y-6">
        {/* Error banner */}
        {error && (
          <div
            className="bg-[var(--neg-soft)] text-[var(--neg)] p-4 flex items-center justify-between"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--neg)] hover:opacity-70">
              x
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Mes TP</h1>
            <p className="text-[var(--text-muted)] mt-1">
              {templates.length} modele{templates.length > 1 ? 's' : ''} de TP enregistre{templates.length > 1 ? 's' : ''}
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

        {/* Templates list */}
        {templates.length === 0 ? (
          <div
            className="bg-[var(--surface)] p-12 text-center border border-[var(--border)]"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
          >
            <div
              className="w-20 h-20 mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius-full)' }}
            >
              <span className="text-4xl">📋</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Aucun modele de TP</h2>
            <p className="text-[var(--text-dim)] mt-2">
              Creez des modeles de TP avec leurs criteres de notation
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-5 px-5 py-2.5 text-white font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: 'var(--radius)' }}
            >
              Creer mon premier TP
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => {
              const preset = getColorPreset(template.color);
              return (
              <div
                key={template.id}
                className="group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                style={{
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-1)',
                  background: preset.gradient,
                }}
              >
                {/* Header avec nom et actions */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-white text-lg leading-tight flex-1 mr-2 drop-shadow-sm">
                      {template.name}
                    </h3>
                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(template)}
                        className="p-1.5 bg-white/20 hover:bg-white/40 transition-colors backdrop-blur-sm"
                        style={{ borderRadius: 'var(--radius-md)' }}
                        title="Modifier"
                      >
                        <span className="text-sm">✏️</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(template)}
                        className="p-1.5 bg-white/20 hover:bg-red-500/80 transition-colors backdrop-blur-sm"
                        style={{ borderRadius: 'var(--radius-md)' }}
                        title="Supprimer"
                      >
                        <span className="text-sm">🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Corps avec stats */}
                <div className="bg-[var(--surface)] p-4 pt-5">
                  <div className="flex gap-4 mb-4">
                    {/* Points */}
                    <div
                      className="flex-1 text-center p-3 border"
                      style={{ borderRadius: 'var(--radius)', background: `${preset.accentLight}`, borderColor: `${preset.accent}33` }}
                    >
                      <div className="text-2xl font-bold" style={{ color: preset.accent }}>{template.total_points}</div>
                      <div className="text-xs font-medium" style={{ color: `${preset.accent}b3` }}>points</div>
                    </div>
                    {/* Critères - cliquable */}
                    <button
                      onClick={() => handleToggleCriteria(template)}
                      className="flex-1 text-center p-3 border transition-all"
                      style={{
                        borderRadius: 'var(--radius)',
                        background: expandedTemplateId === template.id ? preset.accentLight : undefined,
                        borderColor: expandedTemplateId === template.id ? `${preset.accent}55` : undefined,
                      }}
                    >
                      <div className="text-2xl font-bold" style={{ color: expandedTemplateId === template.id ? preset.accent : 'var(--text)' }}>
                        {template.criteria_count}
                      </div>
                      <div className="text-xs font-medium flex items-center justify-center gap-1" style={{ color: expandedTemplateId === template.id ? `${preset.accent}b3` : 'var(--text-muted)' }}>
                        critere{template.criteria_count > 1 ? 's' : ''}
                        <span className={`transition-transform ${expandedTemplateId === template.id ? 'rotate-180' : ''}`}>&#9660;</span>
                      </div>
                    </button>
                  </div>

                  {/* Liste des critères dépliée */}
                  {expandedTemplateId === template.id && (
                    <div className="mb-4 p-3 bg-[var(--surface-3)] border border-[var(--border)]" style={{ borderRadius: 'var(--radius)' }}>
                      {isLoadingCriteria ? (
                        <div className="text-center text-sm text-[var(--text-muted)] py-2">Chargement...</div>
                      ) : expandedCriteria.length === 0 ? (
                        <div className="text-center text-sm text-[var(--text-muted)] py-2">Aucun critere</div>
                      ) : (
                        <div className="space-y-2">
                          {expandedCriteria.map((crit, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-[var(--text)]">{crit.label}</span>
                              <span className="font-semibold px-2 py-0.5" style={{ borderRadius: 'var(--radius-md)', color: preset.accent, background: preset.accentLight }}>
                                {crit.max_points} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Materials badge */}
                  {template.materials && template.materials.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {template.materials.slice(0, 3).map((mat, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5"
                          style={{
                            borderRadius: 'var(--radius-full)',
                            background: preset.accentLight,
                            color: preset.accent,
                          }}
                        >
                          {mat}
                        </span>
                      ))}
                      {template.materials.length > 3 && (
                        <span className="text-xs text-[var(--text-muted)]">
                          +{template.materials.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-[var(--text-dim)] text-center">
                    Cree le {formatDate(template.created_at)}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
        </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-[var(--surface)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
          >
            {/* Header avec dégradé dynamique */}
            <div
              className="p-5 shrink-0"
              style={{ background: `linear-gradient(135deg, ${getColorPreset(templateColor).accent} 0%, ${getColorPreset(templateColor).accent}99 100%)` }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white drop-shadow-sm">
                  {editingTemplate ? 'Modifier le TP' : 'Nouveau TP'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors text-white"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Template name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                  Nom du TP
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Ex: TP Circuits electriques"
                  className="w-full px-4 py-3 bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--indigo)] focus:border-[var(--indigo)]"
                  style={{ borderRadius: 'var(--radius)' }}
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                  Couleur
                </label>
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
                  <label className="text-sm font-medium text-[var(--text-muted)]">
                    Criteres de notation
                  </label>
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
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                  Materiel necessaire
                </label>
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
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium"
                        style={{
                          borderRadius: 'var(--radius-full)',
                          background: getColorPreset(templateColor).accentLight,
                          color: getColorPreset(templateColor).accent,
                        }}
                      >
                        {mat}
                        <button
                          onClick={() => handleRemoveMaterial(idx)}
                          className="ml-1 hover:opacity-60 transition-opacity font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos (only when editing an existing template) */}
              {editingTemplate && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                    Photos de reference
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative group/photo aspect-square overflow-hidden" style={{ borderRadius: 'var(--radius-md)' }}>
                          {photoUrls[photo.id] ? (
                            <img
                              src={photoUrls[photo.id]}
                              alt={photo.caption || 'Photo TP'}
                              className="w-full h-full object-cover"
                            />
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
                    {isUploadingPhoto ? 'Upload en cours...' : '📷 Ajouter une photo'}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && templateToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className="bg-[var(--surface)] w-full max-w-md p-6"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
          >
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 bg-[var(--neg-soft)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Supprimer ce modele ?
              </h3>
              <p className="text-[var(--text-muted)] mt-2">
                Le modele <strong>{templateToDelete.name}</strong> sera definitivement supprime.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTemplateToDelete(null);
                }}
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
