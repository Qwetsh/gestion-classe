import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

interface TpTemplate {
  id: string;
  name: string;
  created_at: string;
  criteria_count: number;
  total_points: number;
}

interface EditingCriteria {
  id?: string;
  label: string;
  max_points: number;
  isNew?: boolean;
}

export function TpTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TpTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TpTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [criteria, setCriteria] = useState<EditingCriteria[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<TpTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        .select('id, name, created_at')
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
    setCriteria([{ label: '', max_points: 5, isNew: true }]);
    setShowModal(true);
  };

  const handleOpenEdit = async (template: TpTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);

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

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setTemplateName('');
    setCriteria([]);
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

  const handleSave = async () => {
    if (!user || !templateName.trim()) return;

    // Validate criteria
    const validCriteria = criteria.filter(c => c.label.trim());
    if (validCriteria.length === 0) {
      alert('Ajoutez au moins un critere');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('tp_templates')
          .update({ name: templateName.trim() })
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
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (template: TpTemplate) => {
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
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
      alert('Erreur lors de la suppression');
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
            <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--color-text-secondary)]">Chargement...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Error banner */}
        {error && (
          <div
            className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 flex items-center justify-between"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--color-error)] hover:opacity-70">
              x
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Mes TP</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {templates.length} modele{templates.length > 1 ? 's' : ''} de TP enregistre{templates.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 text-white font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
          >
            + Nouveau TP
          </button>
        </div>

        {/* Templates list */}
        {templates.length === 0 ? (
          <div
            className="bg-[var(--color-surface)] p-12 text-center"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div
              className="w-20 h-20 mx-auto mb-4 bg-[var(--color-primary-soft)] flex items-center justify-center"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              <span className="text-4xl">📋</span>
            </div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Aucun modele de TP</h2>
            <p className="text-[var(--color-text-tertiary)] mt-2">
              Creez des modeles de TP avec leurs criteres de notation
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2.5 text-white font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
            >
              Creer mon premier TP
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <div
                key={template.id}
                className="bg-[var(--color-surface)] p-5 hover:shadow-md transition-shadow"
                style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-12 h-12 bg-[var(--color-primary-soft)] flex items-center justify-center"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    <span className="text-2xl">📋</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(template)}
                      className="p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                      style={{ borderRadius: 'var(--radius-md)' }}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteClick(template)}
                      className="p-2 hover:bg-[var(--color-error-soft)] transition-colors"
                      style={{ borderRadius: 'var(--radius-md)' }}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-[var(--color-text)] text-lg mb-1">{template.name}</h3>
                <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
                  Cree le {formatDate(template.created_at)}
                </p>

                <div className="flex gap-3">
                  <span
                    className="px-3 py-1.5 text-sm font-medium bg-[var(--color-surface-secondary)]"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    {template.criteria_count} critere{template.criteria_count > 1 ? 's' : ''}
                  </span>
                  <span
                    className="px-3 py-1.5 text-sm font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    {template.total_points} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-[var(--color-surface)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">
                  {editingTemplate ? 'Modifier le TP' : 'Nouveau TP'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  x
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Template name */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Nom du TP
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Ex: TP Circuits electriques"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                />
              </div>

              {/* Criteria */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Criteres de notation
                  </label>
                  <span className="text-sm text-[var(--color-text-tertiary)]">
                    Total: {criteria.reduce((sum, c) => sum + (c.max_points || 0), 0)} pts
                  </span>
                </div>

                <div className="space-y-3">
                  {criteria.map((crit, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={crit.label}
                        onChange={e => handleCriteriaChange(index, 'label', e.target.value)}
                        placeholder="Nom du critere"
                        className="flex-1 px-3 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
                        style={{ borderRadius: 'var(--radius-md)' }}
                      />
                      <input
                        type="number"
                        value={crit.max_points}
                        onChange={e => handleCriteriaChange(index, 'max_points', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.5"
                        className="w-20 px-3 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm text-center"
                        style={{ borderRadius: 'var(--radius-md)' }}
                      />
                      <span className="text-sm text-[var(--color-text-tertiary)] w-8">pts</span>
                      <button
                        onClick={() => handleRemoveCriteria(index)}
                        disabled={criteria.length <= 1}
                        className="p-2 hover:bg-[var(--color-error-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        style={{ borderRadius: 'var(--radius-md)' }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddCriteria}
                  className="mt-3 w-full py-2 border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors text-sm font-medium"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  + Ajouter un critere
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] shrink-0 flex gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !templateName.trim()}
                className="flex-1 px-4 py-2.5 text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
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
            className="bg-[var(--color-surface)] w-full max-w-md p-6"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 bg-[var(--color-error-soft)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                Supprimer ce modele ?
              </h3>
              <p className="text-[var(--color-text-secondary)] mt-2">
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
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-[var(--color-error)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
