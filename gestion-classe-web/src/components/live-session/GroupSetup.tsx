import { useState } from 'react';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSetup() {
  const {
    selectedClass, students, templates, sessionName, tempCriteria, tempGroups,
    loading, error,
    setSessionName, applyTemplate, addCriteria, removeCriteria,
    addGroup, removeGroup, toggleMember, randomizeGroups,
    startGrading, goBack, cancelFlow,
  } = useGroupSession();

  const [newLabel, setNewLabel] = useState('');
  const [newPoints, setNewPoints] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [randomCount, setRandomCount] = useState('3');
  const [showRandom, setShowRandom] = useState(false);

  const assignedIds = new Set(tempGroups.flatMap(g => g.memberIds));
  const unassigned = students.filter(s => !assignedIds.has(s.id));
  const maxPoints = tempCriteria.reduce((sum, c) => sum + c.max_points, 0);

  const canStart = sessionName.trim() && tempCriteria.length > 0 && tempGroups.length > 0
    && tempGroups.every(g => g.memberIds.length > 0);

  const handleAddCriteria = () => {
    const pts = parseFloat(newPoints);
    if (newLabel.trim() && pts > 0) {
      addCriteria(newLabel.trim(), pts);
      setNewLabel('');
      setNewPoints('');
    }
  };

  const handleRandomize = () => {
    const n = parseInt(randomCount);
    if (n > 0) {
      randomizeGroups(n);
      setShowRandom(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white" style={{ background: 'var(--gradient-success)' }}>
        <button onClick={goBack} className="text-white/80 text-sm font-medium">← Retour</button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Configuration</h1>
          <p className="text-white/70 text-xs">{selectedClass?.name}</p>
        </div>
        <button onClick={cancelFlow} className="text-white/80 text-sm font-medium">Annuler</button>
      </div>

      {error && <div className="mx-4 mt-2 p-2 bg-[var(--color-error-soft)] text-[var(--color-error)] rounded-lg text-xs">{error}</div>}

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Session name */}
        <div>
          <label className="text-sm font-semibold text-[var(--color-text)] block mb-1">Nom de la seance</label>
          <input
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Ex: Dissection sardine"
            className="w-full p-3 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
            style={{ borderRadius: 'var(--radius-lg)', fontSize: '16px' }}
          />
        </div>

        {/* Criteria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-[var(--color-text)]">Criteres de notation</label>
            <span className="text-xs font-bold text-[var(--color-success)]">Total: {maxPoints} pts</span>
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  style={{ borderRadius: 'var(--radius-full)', border: 'none' }}
                >
                  {t.name} ({t.criteria.reduce((s, c) => s + c.max_points, 0)}pts)
                </button>
              ))}
            </div>
          )}

          {/* Criteria list */}
          <div className="space-y-1.5 mb-2">
            {tempCriteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-[var(--color-surface-secondary)]" style={{ borderRadius: 'var(--radius-md)' }}>
                <span className="flex-1 text-sm text-[var(--color-text)]">{c.label}</span>
                <span className="text-xs font-bold text-[var(--color-success)]">{c.max_points}pts</span>
                <button onClick={() => removeCriteria(i)} className="text-[var(--color-error)] text-sm" style={{ border: 'none', background: 'none' }}>✕</button>
              </div>
            ))}
          </div>

          {/* Add criteria */}
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Critere..."
              className="flex-1 p-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
              style={{ borderRadius: 'var(--radius-md)' }}
              onKeyDown={e => e.key === 'Enter' && handleAddCriteria()}
            />
            <input
              value={newPoints}
              onChange={e => setNewPoints(e.target.value)}
              placeholder="Pts"
              type="number"
              step="0.5"
              min="0"
              className="w-16 p-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-center text-[var(--color-text)]"
              style={{ borderRadius: 'var(--radius-md)' }}
              onKeyDown={e => e.key === 'Enter' && handleAddCriteria()}
            />
            <button
              onClick={handleAddCriteria}
              disabled={!newLabel.trim() || !newPoints}
              className="px-3 py-2 text-white font-bold text-sm disabled:opacity-40"
              style={{ background: 'var(--color-success)', borderRadius: 'var(--radius-md)', border: 'none' }}
            >
              +
            </button>
          </div>
        </div>

        {/* Groups */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-[var(--color-text)]">
              Groupes ({tempGroups.length})
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRandom(true)}
                className="px-3 py-1 text-xs font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                style={{ borderRadius: 'var(--radius-full)', border: 'none' }}
              >
                Aleatoire
              </button>
              <button
                onClick={() => addGroup(`Groupe ${tempGroups.length + 1}`)}
                className="px-3 py-1 text-xs font-medium bg-[var(--color-success-soft)] text-[var(--color-success)]"
                style={{ borderRadius: 'var(--radius-full)', border: 'none' }}
              >
                + Groupe
              </button>
            </div>
          </div>

          {/* Random modal */}
          {showRandom && (
            <div className="mb-3 p-3 bg-[var(--color-primary-soft)] flex items-center gap-2" style={{ borderRadius: 'var(--radius-lg)' }}>
              <span className="text-sm text-[var(--color-text)]">Eleves par groupe:</span>
              <input
                value={randomCount}
                onChange={e => setRandomCount(e.target.value)}
                type="number"
                min="1"
                className="w-14 p-1.5 text-center border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
                style={{ borderRadius: 'var(--radius-md)' }}
              />
              <button onClick={handleRandomize} className="px-3 py-1.5 text-xs font-bold text-white" style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-md)', border: 'none' }}>OK</button>
              <button onClick={() => setShowRandom(false)} className="text-xs text-[var(--color-text-tertiary)]" style={{ border: 'none', background: 'none' }}>✕</button>
            </div>
          )}

          {/* Group tabs */}
          {tempGroups.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
              {tempGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id === activeGroupId ? null : g.id)}
                  className={`shrink-0 px-3 py-1.5 text-xs font-medium ${
                    g.id === activeGroupId
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
                  }`}
                  style={{ borderRadius: 'var(--radius-full)', border: 'none' }}
                >
                  {g.name} ({g.memberIds.length})
                </button>
              ))}
            </div>
          )}

          {/* Active group members + unassigned */}
          {activeGroupId && (
            <div className="space-y-2">
              {/* Group members */}
              <div className="p-2 bg-[var(--color-primary-soft)]" style={{ borderRadius: 'var(--radius-lg)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[var(--color-primary)]">
                    {tempGroups.find(g => g.id === activeGroupId)?.name}
                  </span>
                  <button
                    onClick={() => { removeGroup(activeGroupId); setActiveGroupId(null); }}
                    className="text-xs text-[var(--color-error)]"
                    style={{ border: 'none', background: 'none' }}
                  >
                    Supprimer
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tempGroups.find(g => g.id === activeGroupId)?.memberIds.map(sid => {
                    const s = students.find(st => st.id === sid);
                    return s ? (
                      <button
                        key={sid}
                        onClick={() => toggleMember('__remove__', sid)}
                        className="px-2 py-1 text-xs font-medium bg-[var(--color-primary)] text-white"
                        style={{ borderRadius: 'var(--radius-full)', border: 'none' }}
                      >
                        {s.pseudo} ✕
                      </button>
                    ) : null;
                  })}
                  {(tempGroups.find(g => g.id === activeGroupId)?.memberIds.length || 0) === 0 && (
                    <span className="text-xs text-[var(--color-text-tertiary)] py-1">Tapez un eleve ci-dessous</span>
                  )}
                </div>
              </div>

              {/* Unassigned students */}
              <div className="p-2 bg-[var(--color-surface-secondary)]" style={{ borderRadius: 'var(--radius-lg)' }}>
                <span className="text-xs font-semibold text-[var(--color-text-tertiary)] block mb-1">
                  Non assignes ({unassigned.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {unassigned.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleMember(activeGroupId, s.id)}
                      className="px-2 py-1 text-xs font-medium bg-[var(--color-surface)] text-[var(--color-text)]"
                      style={{ borderRadius: 'var(--radius-full)', border: 'none', boxShadow: 'var(--shadow-xs)' }}
                    >
                      {s.pseudo}
                    </button>
                  ))}
                  {unassigned.length === 0 && (
                    <span className="text-xs text-[var(--color-text-tertiary)] py-1">Tous les eleves sont assignes</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Start button */}
      <div className="p-4 pb-6 shrink-0">
        <button
          onClick={startGrading}
          disabled={!canStart || loading}
          className="w-full py-4 text-white font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: 'var(--gradient-success)', borderRadius: 'var(--radius-xl)', border: 'none' }}
        >
          {loading ? 'Creation...' : 'Commencer la notation'}
        </button>
        {!canStart && (
          <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-2">
            {!sessionName.trim() ? 'Nom requis' : tempCriteria.length === 0 ? 'Ajoutez des criteres' : tempGroups.length === 0 ? 'Creez des groupes' : 'Chaque groupe doit avoir au moins 1 eleve'}
          </p>
        )}
      </div>
    </div>
  );
}
