import { useLiveSession } from '../../contexts/LiveSessionContext';

export function RoomSelector() {
  const { rooms, selectedClass, loading, error, selectRoom, goBack, cancelFlow } = useLiveSession();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 text-white"
        style={{ background: 'var(--gradient-header)' }}
      >
        <button onClick={goBack} className="text-white/80 text-sm font-medium">
          ← Retour
        </button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Choisir une salle</h1>
          <p className="text-white/70 text-xs">{selectedClass?.name}</p>
        </div>
        <button onClick={cancelFlow} className="text-white/80 text-sm font-medium">
          Annuler
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="p-3 bg-[var(--color-error-soft)] text-[var(--color-error)] rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-tertiary)]">
            <div className="text-4xl mb-3">🏫</div>
            <p>Aucune salle trouvee</p>
            <p className="text-sm mt-1">Configurez une salle depuis le menu Salles</p>
          </div>
        ) : (
          rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => selectRoom(room)}
              className="w-full p-4 bg-[var(--color-surface)] flex items-center gap-4 active:scale-[0.98] transition-transform"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center text-xl bg-[var(--color-remarque-soft)] rounded-xl"
              >
                🏫
              </div>
              <div className="text-left">
                <span className="font-semibold text-[var(--color-text)] text-lg block">{room.name}</span>
                <span className="text-sm text-[var(--color-text-tertiary)]">
                  {room.grid_rows} × {room.grid_cols} places
                </span>
              </div>
              <span className="ml-auto text-[var(--color-text-tertiary)] text-xl">›</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
