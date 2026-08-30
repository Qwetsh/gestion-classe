import { Check } from 'lucide-react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { DB } from './directionB';
import { FlowHeader, SectionLabel } from './FlowHeader';

export function RoomSelector() {
  const { rooms, selectedClass, selectedRoom, loading, error, selectRoom, goBack, cancelFlow } = useLiveSession();

  return (
    <div className="flex flex-col h-full" style={{ background: DB.background }}>
      <FlowHeader
        title="Nouvelle séance"
        subtitle={selectedClass?.name}
        onBack={goBack}
        onCancel={cancelFlow}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 20px 20px' }}>
        <SectionLabel>2 · Choisir une salle</SectionLabel>

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
        ) : rooms.length === 0 ? (
          <div className="text-center py-12" style={{ color: DB.textTertiary }}>
            <p style={{ color: DB.text, fontWeight: 600 }}>Aucune salle trouvée</p>
            <p className="text-sm mt-1">Configurez une salle depuis la page Classes</p>
          </div>
        ) : (
          <div
            style={{
              background: DB.surface,
              border: `1px solid ${DB.border}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {rooms.map((room, index) => {
              const isSelected = selectedRoom?.id === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => selectRoom(room)}
                  className="w-full flex items-center text-left active:bg-black/5"
                  style={{
                    padding: '13px 16px',
                    border: 'none',
                    borderTop: index > 0 ? `1px solid ${DB.borderLight}` : 'none',
                    background: isSelected ? DB.primarySoft : 'transparent',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className="block truncate"
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: isSelected ? DB.primary : DB.text,
                      }}
                    >
                      {room.name}
                    </span>
                    <span style={{ fontSize: 12.5, color: DB.textTertiary }}>
                      {room.grid_rows} × {room.grid_cols} places
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: DB.primary }}
                    >
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
