import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, step } = useGroupSession();

  if (!isMobile || step !== 'idle') return null;

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={startFlow}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          background: 'var(--gradient-success)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-1)',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 44, height: 44, background: 'rgba(255,255,255,0.2)',
          borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>👥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Travail de groupe</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Noter un TP collaboratif</div>
        </div>
      </button>

      <button
        onClick={startFlow}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-1)',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 44, height: 44, background: 'rgba(255,255,255,0.2)',
          borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>🏰</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Épreuve</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>Points de maison</div>
        </div>
      </button>
    </div>
  );
}
