import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, startEpreuveFlow, resumeFlow, step, sessionId, sessionData } = useGroupSession();

  if (!isMobile || step !== 'idle') return null;

  const hasSuspended = !!(sessionId && sessionData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Resume button if session suspended */}
      {hasSuspended && (
        <button
          onClick={resumeFlow}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            background: 'linear-gradient(135deg, #d4a843, #b8860b)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 16px rgba(180,130,50,0.3)',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 44, height: 44, background: 'rgba(255,255,255,0.2)',
            borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>▶</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#1a1410', fontSize: 15 }}>Reprendre la notation</div>
            <div style={{ color: 'rgba(26,20,16,0.7)', fontSize: 11, marginTop: 2 }}>
              {sessionData?.name || 'Session en cours'}
            </div>
          </div>
        </button>
      )}

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
          onClick={startEpreuveFlow}
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
    </div>
  );
}
