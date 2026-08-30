import { useState } from 'react';
import { Play } from 'lucide-react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { DB } from './directionB';
import { FlowHeader, SectionLabel } from './FlowHeader';

export function SessionNameInput() {
  const { selectedClass, selectedRoom, loading, startSession, goBack, cancelFlow } = useLiveSession();
  const [topic, setTopic] = useState('');

  const handleStart = () => {
    startSession(topic.trim() || undefined);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: DB.background }}>
      <FlowHeader
        title="Nouvelle séance"
        subtitle={`${selectedClass?.name} · ${selectedRoom?.name}`}
        onBack={goBack}
        onCancel={cancelFlow}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 20px 20px' }}>
        <div className="flex items-baseline justify-between">
          <SectionLabel>3 · Thème de la séance</SectionLabel>
          <span style={{ fontSize: 12, color: DB.textTertiary }}>Optionnel</span>
        </div>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ex : Chapitre 3 - Les fonctions linéaires..."
          rows={2}
          maxLength={200}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleStart();
            }
          }}
          className="w-full resize-none"
          style={{
            padding: '14px 16px',
            fontSize: 16,
            background: DB.surface,
            color: DB.text,
            border: `1px solid ${DB.border}`,
            borderRadius: 12,
            outline: 'none',
          }}
        />
        {topic.length > 0 && (
          <p className="text-right" style={{ fontSize: 11, color: DB.textTertiary, margin: '4px 0 0' }}>
            {topic.length}/200
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0"
        style={{
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
          background: DB.surface,
          borderTop: `1px solid ${DB.border}`,
        }}
      >
        <p className="text-center" style={{ fontSize: 13, fontWeight: 600, color: DB.textSecondary, margin: '0 0 10px' }}>
          {selectedClass?.name} · {selectedRoom?.name}
        </p>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          style={{
            padding: '16px',
            background: DB.action,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 12,
            border: 'none',
          }}
        >
          <Play size={17} color="#fff" fill="#fff" strokeWidth={0} />
          {loading ? 'Démarrage…' : 'Démarrer la séance'}
        </button>
      </div>
    </div>
  );
}
