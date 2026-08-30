import { BookOpen } from 'lucide-react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { DB } from './directionB';
import { FlowHeader, SectionLabel } from './FlowHeader';

export function ClassSelector() {
  const { classes, loading, error, selectClass, cancelFlow } = useLiveSession();

  return (
    <div className="flex flex-col h-full" style={{ background: DB.background }}>
      <FlowHeader title="Nouvelle séance" onBack={cancelFlow} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 20px 20px' }}>
        <SectionLabel>1 · Choisir une classe</SectionLabel>

        {error && (
          <div
            className="p-3 text-sm mb-3"
            style={{ background: DB.errorSoft, color: DB.error, borderRadius: 12 }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: `3px solid ${DB.primary}`, borderTopColor: 'transparent' }}
            />
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-12" style={{ color: DB.textTertiary }}>
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: DB.primarySoft }}
            >
              <BookOpen size={28} color={DB.primary} strokeWidth={1.7} />
            </div>
            <p style={{ color: DB.text, fontWeight: 600 }}>Aucune classe trouvée</p>
            <p className="text-sm mt-1">Créez d'abord une classe depuis le menu Classes</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => selectClass(cls)}
                className="active:scale-[0.97] transition-transform"
                style={{
                  padding: '14px 8px',
                  background: DB.surface,
                  border: `1px solid ${DB.border}`,
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  color: DB.text,
                }}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
