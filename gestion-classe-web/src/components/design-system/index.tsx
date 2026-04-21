import { useMemo } from 'react';

// ---- ClassChip ----
export function ClassChip({ label, color, size = 28, muted = false }: {
  label: string;
  color: string;
  size?: number;
  muted?: boolean;
}) {
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: size * 0.3,
    background: muted ? 'transparent' : color,
    color: muted ? color : '#fff',
    border: muted ? `1.5px solid ${color}` : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.38, letterSpacing: '-0.02em',
    fontFamily: 'var(--font-display)',
    flexShrink: 0,
  };
  return <span style={style}>{label}</span>;
}

// ---- Sparkline ----
export function Sparkline({ history, w = 72, h = 24, color = 'currentColor' }: {
  history: (number | null)[];
  w?: number;
  h?: number;
  color?: string;
}) {
  const { segs, pts } = useMemo(() => {
    const max = 2, min = -2;
    const points = history.map((v, i) => {
      const x = (i / (history.length - 1)) * w;
      if (v === null) return null;
      const y = h / 2 - ((v - 0) / (max - min)) * h;
      return { x, y, v };
    });

    const segments: { x: number; y: number; v: number }[][] = [];
    let cur: { x: number; y: number; v: number }[] = [];
    points.forEach(p => {
      if (p === null) { if (cur.length) segments.push(cur); cur = []; }
      else cur.push(p);
    });
    if (cur.length) segments.push(cur);

    return { segs: segments, pts: points };
  }, [history, w, h]);

  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />
      {segs.map((seg, i) => (
        <polyline key={i}
          points={seg.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      ))}
      {pts.map((p, i) => {
        if (p === null) return null;
        const isLast = i === pts.length - 1;
        const fill = p.v > 0 ? 'var(--pos)' : p.v < 0 ? 'var(--neg)' : 'var(--muted-2)';
        return <circle key={i} cx={p.x} cy={p.y} r={isLast ? 2.5 : 1.7} fill={fill} stroke={isLast ? 'var(--surface)' : 'none'} strokeWidth={isLast ? 1.5 : 0} />;
      })}
    </svg>
  );
}

// ---- TrendBadge ----
export function TrendBadge({ delta }: { delta: number }) {
  const flat = Math.abs(delta) < 0.15;
  const up = delta > 0;
  const color = flat ? 'var(--text-muted)' : up ? 'var(--pos)' : 'var(--neg)';
  const arrow = flat ? '\u2192' : up ? '\u2197' : '\u2198';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      color, fontVariantNumeric: 'tabular-nums',
      fontSize: 11, fontWeight: 600,
    }}>
      <span>{arrow}</span>
      <span>{up ? '+' : ''}{delta.toFixed(1)}</span>
    </span>
  );
}

// ---- AvgRing ----
export function AvgRing({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value / 20));
  const r = 12, c = 2 * Math.PI * r;
  return (
    <svg width={30} height={30}>
      <circle cx={15} cy={15} r={r} stroke="var(--border)" strokeWidth={2.5} fill="none" />
      <circle cx={15} cy={15} r={r} stroke={color} strokeWidth={2.5} fill="none"
        strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
        transform="rotate(-90 15 15)" />
      <text x={15} y={18} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text)" style={{ fontFamily: 'var(--font-display)' }}>
        {value.toFixed(0)}
      </text>
    </svg>
  );
}

// ---- Token ----
export function Token({ kind, value, label }: { kind: string; value: string | number; label: string }) {
  return (
    <div className={`tok tok--${kind}`}>
      <span className="tok__v">{value}</span>
      <span className="tok__l">{label}</span>
    </div>
  );
}

// ---- Distribution ----
export function Distribution({ grades, color }: { grades: number[]; color: string }) {
  const bins = new Array(21).fill(0);
  grades.forEach(g => { const b = Math.round(g); bins[Math.max(0, Math.min(20, b))] += 1; });
  const max = Math.max(...bins, 1);
  return (
    <div className="distrib">
      <div className="distrib__label">Distribution des notes</div>
      <div className="distrib__bars">
        {bins.map((n, i) => (
          <div key={i} className="distrib__b" title={`${n} \u00e9l\u00e8ve(s) \u00e0 ${i}/20`}>
            <div className="distrib__f" style={{ height: `${(n/max)*100}%`, background: i < 8 ? 'var(--neg-soft)' : i < 12 ? 'var(--muted-2)' : color }} />
          </div>
        ))}
      </div>
      <div className="distrib__axis">
        <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span>
      </div>
    </div>
  );
}

// ---- Indic ----
export function Indic({ label, value, hint, tone = 'neutral' }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className={`indic indic--${tone}`}>
      <div className="indic__label">{label}</div>
      <div className="indic__value">{value}</div>
      {hint && <div className="indic__hint">{hint}</div>}
    </div>
  );
}

// ---- QuickMenu ----
export function QuickMenu({ onPick, align = 'left' }: {
  onPick: (item: { label: string; icon: string; tone: string }) => void;
  align?: 'left' | 'right';
}) {
  const items = [
    { label: 'Participation +', icon: 'plus-circle', tone: 'pos' },
    { label: 'Bonne r\u00e9ponse +2', icon: 'sparkle', tone: 'pos' },
    { label: 'Malus \u22121', icon: 'minus-circle', tone: 'neg' },
    { label: 'Gros malus \u22122', icon: 'alert', tone: 'neg' },
    { label: 'Absent', icon: 'x', tone: 'abs' },
    { label: 'Oral not\u00e9', icon: 'mic', tone: 'oral' },
  ];
  return (
    <div className={`qmenu qmenu--${align}`}>
      {items.map((it, i) => (
        <button key={i} className={`qmenu__item qmenu__item--${it.tone}`} onClick={() => onPick(it)}>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Icon (SVG icons) ----
export function Icon({ name, size = 16, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'x': return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'eye': return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'grid': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'list': return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'plus-circle': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
    case 'minus-circle': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>;
    case 'alert': return <svg {...common}><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>;
    case 'mic': return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    case 'qr': return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M17 20h4M14 20v-1"/></svg>;
    case 'trash': return <svg {...common}><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    default: return null;
  }
}
