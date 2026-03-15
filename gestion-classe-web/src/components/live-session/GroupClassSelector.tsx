import { useGroupSession } from '../../contexts/GroupSessionContext';

const CLASS_COLORS = [
  'linear-gradient(135deg, #4A90D9, #357ABD)',
  'linear-gradient(135deg, #81C784, #66BB6A)',
  'linear-gradient(135deg, #FFB74D, #FFA726)',
  'linear-gradient(135deg, #E57373, #EF5350)',
  'linear-gradient(135deg, #9575CD, #7E57C2)',
];

export function GroupClassSelector() {
  const { classes, loading, error, selectClass, cancelFlow } = useGroupSession();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 text-white" style={{ background: 'var(--gradient-success)' }}>
        <button onClick={cancelFlow} className="text-white/80 text-sm font-medium">Annuler</button>
        <h1 className="font-bold text-lg">Travail de groupe</h1>
        <div className="w-16" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && <div className="p-3 bg-[var(--color-error-soft)] text-[var(--color-error)] rounded-xl text-sm">{error}</div>}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-3 border-[var(--color-success)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          classes.map((cls, i) => (
            <button
              key={cls.id}
              onClick={() => selectClass(cls)}
              className="w-full p-4 bg-[var(--color-surface)] flex items-center gap-4 active:scale-[0.98] transition-transform"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-12 h-12 flex items-center justify-center text-white font-bold rounded-xl" style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }}>
                {cls.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="font-semibold text-[var(--color-text)] text-lg">{cls.name}</span>
              <span className="ml-auto text-[var(--color-text-tertiary)] text-xl">›</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
