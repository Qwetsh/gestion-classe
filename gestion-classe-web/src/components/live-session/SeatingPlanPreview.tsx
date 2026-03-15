import { useLiveSession } from '../../contexts/LiveSessionContext';

export function SeatingPlanPreview() {
  const { selectedClass, selectedRoom, students, positions, loading, error, startSession, goBack, cancelFlow } = useLiveSession();

  if (!selectedRoom) return null;

  const studentMap = new Map(students.map(s => [s.id, s]));

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
          <h1 className="font-bold text-lg">Plan de classe</h1>
          <p className="text-white/70 text-xs">{selectedClass?.name} — {selectedRoom.name}</p>
        </div>
        <button onClick={cancelFlow} className="text-white/80 text-sm font-medium">
          Annuler
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-3 bg-[var(--color-error-soft)] text-[var(--color-error)] rounded-xl text-sm">
            {error}
          </div>
        ) : (
          <>
            <div
              className="grid gap-1.5 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${selectedRoom.grid_cols}, 1fr)`,
                maxWidth: `${selectedRoom.grid_cols * 65}px`,
              }}
            >
              {Array.from({ length: selectedRoom.grid_rows * selectedRoom.grid_cols }).map((_, idx) => {
                const row = Math.floor(idx / selectedRoom.grid_cols);
                const col = idx % selectedRoom.grid_cols;
                const key = `${row}-${col}`;
                const isDisabled = selectedRoom.disabled_cells?.includes(`${row},${col}`);
                const studentId = positions[key];
                const student = studentId ? studentMap.get(studentId) : null;

                if (isDisabled) {
                  return <div key={key} className="h-12 rounded-lg bg-[var(--color-border-light)]" />;
                }

                return (
                  <div
                    key={key}
                    className={`h-12 rounded-lg flex items-center justify-center text-xs font-medium px-1 text-center ${
                      student
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                    }`}
                    style={{ boxShadow: student ? 'var(--shadow-xs)' : undefined }}
                  >
                    {student ? truncate(student.pseudo, 8) : ''}
                  </div>
                );
              })}
            </div>

            {/* Teacher desk indicator */}
            <div className="mt-4 text-center">
              <div
                className="inline-block px-6 py-2 bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] text-sm font-medium"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                Bureau enseignant
              </div>
            </div>

            {/* Student count info */}
            <div className="mt-3 text-center text-sm text-[var(--color-text-tertiary)]">
              {students.length} eleves — {Object.keys(positions).length} places attribuees
            </div>
          </>
        )}
      </div>

      {/* Start button */}
      <div className="p-4 pb-6">
        <button
          onClick={startSession}
          disabled={loading}
          className="w-full py-4 text-white font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{
            background: 'var(--gradient-success)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-glow)',
            border: 'none',
          }}
        >
          {loading ? 'Demarrage...' : 'Demarrer la seance'}
        </button>
      </div>
    </div>
  );
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '.' : str;
}
