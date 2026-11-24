import { Check } from 'lucide-react';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { classGroupColor } from '../../lib/classGroupColors';
import { DB } from './directionB';
import { FlowHeader, SectionLabel } from './FlowHeader';

export function RoomSelector() {
  const {
    rooms, selectedClass, selectedRoom, loading, error, selectRoom, goBack, cancelFlow,
    classGroups, groupMemberCounts, selectedGroupId, groupHint, selectGroup,
  } = useLiveSession();
  const hasGroups = classGroups.length > 0;
  const chip = (selected: boolean, main: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', borderRadius: 999, fontSize: 15, fontWeight: 600,
    border: `1px solid ${selected ? main : DB.border}`,
    background: selected ? main : DB.surface,
    color: selected ? '#fff' : DB.text,
  });

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
        {/* Groupe de classe (demi-groupe), seulement si la classe en a */}
        {hasGroups && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>2 · Groupe</SectionLabel>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              <button onClick={() => selectGroup(null)} style={chip(selectedGroupId === null, DB.primary)}>
                Classe entière
              </button>
              {classGroups.map((g, index) => {
                const color = classGroupColor(g.color, index);
                const selected = selectedGroupId === g.id;
                return (
                  <button key={g.id} onClick={() => selectGroup(g.id)} style={chip(selected, color.main)}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: selected ? '#fff' : color.main }} />
                    {g.name}
                    <span style={{ fontWeight: 400, fontSize: 13, opacity: 0.8 }}>{groupMemberCounts[g.id] ?? 0}</span>
                  </button>
                );
              })}
            </div>
            {groupHint && <p style={{ fontSize: 12.5, color: DB.textTertiary, marginTop: 8 }}>{groupHint}</p>}
          </div>
        )}

        <SectionLabel>{hasGroups ? 3 : 2} · Choisir une salle</SectionLabel>

        {error && (
          <div
            className="p-3 text-sm mb-3"
            style={{ background: DB.errorSoft, color: DB.error, borderRadius: 10 }}
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
              borderRadius: 14,
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
                    <span style={{ fontSize: 13, color: DB.textTertiary }}>
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
