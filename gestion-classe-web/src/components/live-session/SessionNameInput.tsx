import { useState } from 'react';
import { useLiveSession } from '../../contexts/LiveSessionContext';

export function SessionNameInput() {
  const { selectedClass, selectedRoom, loading, startSession, goBack, cancelFlow } = useLiveSession();
  const [topic, setTopic] = useState('');

  const handleStart = () => {
    startSession(topic.trim() || undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white shrink-0"
        style={{ background: 'var(--gradient-header)' }}
      >
        <button onClick={goBack} className="text-white/80 text-sm font-medium">
          ← Retour
        </button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Nom de la seance</h1>
          <p className="text-white/70 text-xs">{selectedClass?.name} — {selectedRoom?.name}</p>
        </div>
        <button onClick={cancelFlow} className="text-white/80 text-sm font-medium">
          Annuler
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-dim)] mb-2">
            Sujet / titre de la seance (optionnel)
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: GIEC, Dictee, Revision..."
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
            className="w-full px-4 py-3 text-lg bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] focus:border-[var(--indigo)] focus:outline-none transition-colors"
            style={{ borderRadius: 'var(--radius)' }}
          />
        </div>

        <p className="text-sm text-[var(--text-dim)]">
          Vous pouvez laisser vide et commencer directement.
        </p>
      </div>

      {/* Start button */}
      <div className="p-4 pb-6 shrink-0">
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 text-white font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{
            background: 'var(--gradient-success)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)',
            border: 'none',
          }}
        >
          {loading ? 'Demarrage...' : 'Demarrer la seance'}
        </button>
      </div>
    </div>
  );
}
