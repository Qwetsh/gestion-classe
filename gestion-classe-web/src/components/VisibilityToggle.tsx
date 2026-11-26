/** Interrupteur d'une ligne « ce que voient les élèves » de la page Classes. */
export function VisibilityToggle({ icon, label, enabled, disabled, onToggle, accent }: {
  icon: string; label: string; enabled: boolean; disabled?: boolean; onToggle: () => void; accent?: string;
}) {
  const color = accent || 'var(--indigo)';
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, padding: '4px 6px', borderRadius: 6,
        background: enabled ? 'var(--surface-3)' : 'transparent',
        cursor: disabled ? 'wait' : 'pointer', transition: 'background 0.2s',
        fontSize: 12, color: 'var(--text)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontWeight: 500 }}>{label}</span>
      </span>
      <div
        onClick={disabled ? undefined : onToggle}
        style={{
          width: 34, height: 18, borderRadius: 9,
          background: enabled ? color : 'var(--border)',
          position: 'relative', cursor: disabled ? 'wait' : 'pointer',
          transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', position: 'absolute', top: 2,
          left: enabled ? 18 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </div>
    </label>
  );
}
