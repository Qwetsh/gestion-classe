import { Users, Castle, Play } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';
import { DB } from './directionB';

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
          className="active:scale-[0.98] transition-transform"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            background: DB.surface,
            borderRadius: 16,
            border: '1.5px solid #d4a843',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 44, height: 44, background: '#FDF6E3',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Play size={19} color="#b8860b" fill="#b8860b" strokeWidth={0} style={{ marginLeft: 2 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: DB.text, fontSize: 16 }}>Reprendre la notation</div>
            <div style={{ color: DB.textSecondary, fontSize: 13, marginTop: 1 }}>
              {sessionData?.name || 'Session en cours'}
            </div>
          </div>
        </button>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={startFlow}
          className="active:scale-[0.98] transition-transform"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            background: DB.surface,
            borderRadius: 16,
            border: `1px solid ${DB.border}`,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 40, height: 40, background: DB.primarySoft,
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users size={19} color={DB.primary} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: DB.text, fontSize: 14 }}>Travail de groupe</div>
            <div style={{ color: DB.textSecondary, fontSize: 12, marginTop: 1 }}>Noter un TP</div>
          </div>
        </button>

        <button
          onClick={startEpreuveFlow}
          className="active:scale-[0.98] transition-transform"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            background: DB.surface,
            borderRadius: 16,
            border: `1px solid ${DB.border}`,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 40, height: 40, background: '#F5F3FF',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Castle size={19} color="#7c3aed" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: DB.text, fontSize: 14 }}>Épreuve</div>
            <div style={{ color: DB.textSecondary, fontSize: 12, marginTop: 1 }}>Points de maison</div>
          </div>
        </button>
      </div>
    </div>
  );
}
