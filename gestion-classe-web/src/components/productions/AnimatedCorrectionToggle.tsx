import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { fetchAnimatedCorrectionOpen, setAnimatedCorrectionOpen } from '../../lib/activityClassSettingsQueries';
import { animatedCorrectionLabel, animatedCorrectionToast } from '../../lib/animatedCorrection';

/**
 * Interrupteur « correction animée ouverte » d'un patient de l'Hôpital virtuel, pour une classe.
 * Fiche de l'activité (ActivityClassPanel) et page En direct. À n'afficher que pour une clé
 * `hopital-…` (hasAnimatedCorrection). Désactivé tant qu'aucune classe n'est choisie.
 */
export function AnimatedCorrectionToggle({
  activityId,
  classId,
  className,
  compact = false,
}: {
  activityId: string;
  classId: string | null;
  className: string | null;
  /** En direct : sans cadre, pour tenir dans l'en-tête. */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (!activityId || !classId) return;
    let cancelled = false;
    setLoading(true);
    fetchAnimatedCorrectionOpen(activityId, classId)
      .then((v) => { if (!cancelled) setOpen(v); })
      .catch(() => { /* table absente ou réseau : affichée fermée */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activityId, classId]);

  const disabled = !classId || !user || loading || saving;

  const toggle = async () => {
    if (!classId || !className || !user) return;
    const next = !open;
    setSaving(true);
    try {
      await setAnimatedCorrectionOpen(activityId, classId, user.id, next);
      setOpen(next);
      toast(animatedCorrectionToast(next, className), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={compact ? wrapCompact : wrap}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer' }}>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={animatedCorrectionLabel(open, classId ? className : null)}
          disabled={disabled}
          onClick={() => void toggle()}
          style={{ ...track, background: open ? 'var(--indigo)' : 'var(--border-strong, var(--border))', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer' }}
        >
          <span style={{ ...knob, transform: open ? 'translateX(18px)' : 'translateX(0)' }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: classId ? 'var(--text)' : 'var(--text-muted)' }}>
          {animatedCorrectionLabel(open, classId ? className : null)}
        </span>
      </label>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginLeft: 50 }}>
        Les élèves de cette classe la verront en cliquant sur Docteur Morel, dans la salle d’attente de l’hôpital.
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 12 };
const wrapCompact: React.CSSProperties = { marginBottom: 14 };
const track: React.CSSProperties = {
  position: 'relative', flex: 'none', width: 40, height: 22, borderRadius: 999, border: 'none', padding: 2,
  transition: 'background 0.2s', display: 'inline-flex', alignItems: 'center',
};
const knob: React.CSSProperties = {
  display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,.25)', transition: 'transform 0.2s',
};
