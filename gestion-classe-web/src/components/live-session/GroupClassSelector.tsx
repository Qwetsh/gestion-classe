import { useGroupSession } from '../../contexts/GroupSessionContext';

const CLASS_COLORS = [
  'linear-gradient(135deg, #4A90D9, #357ABD)',
  'linear-gradient(135deg, #81C784, #66BB6A)',
  'linear-gradient(135deg, #FFB74D, #FFA726)',
  'linear-gradient(135deg, #E57373, #EF5350)',
  'linear-gradient(135deg, #9575CD, #7E57C2)',
];

export function GroupClassSelector() {
  const { classes, loading, error, selectClass, cancelFlow, epreuveIntent } = useGroupSession();

  const hp = epreuveIntent;
  const bgMain = hp ? '#1a1410' : 'var(--bg)';
  const bgCard = hp ? '#251c15' : 'var(--surface)';
  const bgCardBorder = hp ? '#3a2e22' : 'transparent';
  const textMain = hp ? '#e8dcc8' : 'var(--text)';
  const textDim = hp ? '#8a7a66' : 'var(--text-dim)';
  const goldAccent = '#d4a843';
  const fontDisplay = hp ? "'Cormorant Garamond', Georgia, serif" : 'inherit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bgMain }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px',
        color: '#fff',
        background: hp
          ? 'linear-gradient(135deg, #2a1f14, #1a1410)'
          : 'var(--gradient-success)',
        borderBottom: hp ? '1px solid #3a2e22' : 'none',
      }}>
        <button
          onClick={cancelFlow}
          style={{
            color: hp ? goldAccent : 'rgba(255,255,255,0.8)',
            fontSize: 14, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: fontDisplay,
          }}
        >Annuler</button>
        <h1 style={{
          fontWeight: 700, fontSize: 18, margin: 0,
          fontFamily: fontDisplay,
          color: hp ? '#e8dcc8' : '#fff',
        }}>
          {hp ? '🏰 Choisir une classe' : 'Travail de groupe'}
        </h1>
        <div style={{ width: 64 }} />
      </div>

      {/* Subtitle for HP */}
      {hp && (
        <div style={{
          textAlign: 'center', padding: '12px 16px 0',
          fontSize: 13, color: '#8a7a66',
          fontFamily: fontDisplay, fontStyle: 'italic',
        }}>
          Sélectionnez la classe pour l'épreuve des Quatre Maisons
        </div>
      )}

      {/* Class list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{
            padding: 12, borderRadius: 12, fontSize: 13,
            background: hp ? '#3a1515' : 'var(--neg-soft)',
            color: hp ? '#f87171' : 'var(--neg)',
          }}>{error}</div>
        )}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
            <div style={{
              width: 32, height: 32,
              border: `3px solid ${hp ? goldAccent : 'var(--pos)'}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : (
          classes.map((cls, i) => (
            <button
              key={cls.id}
              onClick={() => selectClass(cls)}
              style={{
                width: '100%', padding: 16,
                display: 'flex', alignItems: 'center', gap: 14,
                background: bgCard,
                borderRadius: 12,
                boxShadow: hp ? 'none' : 'var(--shadow-1)',
                border: `1px solid ${bgCardBorder}`,
                cursor: 'pointer',
                transition: 'transform 100ms',
              }}
            >
              <div style={{
                width: 48, height: 48,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, borderRadius: 12,
                background: hp
                  ? `linear-gradient(135deg, ${goldAccent}, #b8860b)`
                  : CLASS_COLORS[i % CLASS_COLORS.length],
              }}>
                {cls.name.substring(0, 2).toUpperCase()}
              </div>
              <span style={{
                fontWeight: 600, fontSize: 17, color: textMain,
                fontFamily: fontDisplay,
              }}>{cls.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 20, color: textDim }}>›</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
