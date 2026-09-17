// Shared shell: top nav, classroom chip, small atoms. Global.
const { useState, useEffect, useRef, useMemo, Fragment } = React;

// ---- Atoms ----------------------------------------------------------------

function ClassChip({ klass, size = 28, muted = false }) {
  const style = {
    width: size, height: size, borderRadius: size * 0.3,
    background: muted ? 'transparent' : klass.color,
    color: muted ? klass.color : '#fff',
    border: muted ? `1.5px solid ${klass.color}` : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.38, letterSpacing: '-0.02em',
    fontFamily: 'var(--font-display)',
    flexShrink: 0,
  };
  return <span style={style}>{klass.short}</span>;
}

function Sparkline({ history, w = 72, h = 24, color = 'currentColor', lastColor }) {
  // history: array of numbers and nulls. Draw a baseline at 0, positive above (green), negative below (red).
  // We plot points with skips for null. Render as polyline on a 0-center axis.
  const values = history.map(v => v === null ? null : v);
  const max = 2, min = -2;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    if (v === null) return null;
    const y = h / 2 - ((v - 0) / (max - min)) * h;
    return { x, y, v };
  });

  // split into segments across nulls
  const segs = [];
  let cur = [];
  pts.forEach(p => {
    if (p === null) { if (cur.length) segs.push(cur); cur = []; }
    else cur.push(p);
  });
  if (cur.length) segs.push(cur);

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

function TrendBadge({ delta }) {
  const up = delta > 0;
  const flat = Math.abs(delta) < 0.15;
  const color = flat ? 'var(--text-muted)' : up ? 'var(--pos)' : 'var(--neg)';
  const arrow = flat ? '→' : up ? '↗' : '↘';
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

function Icon({ name, size = 16, stroke = 1.6 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V11z"/></svg>;
    case 'classes': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></svg>;
    case 'students': return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M2 21c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M15 15c3-.5 6 1.5 7 5"/></svg>;
    case 'sessions': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'analytics': return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-6M22 19H2"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'check': return <svg {...common}><path d="M5 12l4 4L19 7"/></svg>;
    case 'x': return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'alert': return <svg {...common}><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'pin': return <svg {...common}><path d="M12 22s-7-7-7-12a7 7 0 1114 0c0 5-7 12-7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>;
    case 'filter': return <svg {...common}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'grid': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'list': return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'qr': return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M17 20h4M14 20v-1"/></svg>;
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 0112 0v5l2 3H4l2-3V8z"/><path d="M10 20a2 2 0 004 0"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'plus-circle': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
    case 'minus-circle': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>;
    case 'mic': return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>;
    case 'calendar-plus': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4"/></svg>;
    case 'door': return <svg {...common}><path d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16"/><path d="M3 21h18M15 12h.01"/></svg>;
    case 'eye': return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    default: return null;
  }
}

// ---- Top navigation ------------------------------------------------------

function TopNav({ current, onNavigate }) {
  const items = [
    { id: 'home', label: 'Accueil', icon: 'home' },
    { id: 'classes', label: 'Classes', icon: 'classes' },
    { id: 'students', label: 'Suivi élèves', icon: 'students' },
    { id: 'sessions', label: 'Séances', icon: 'sessions' },
    { id: 'analytics', label: 'Analyses', icon: 'analytics' },
  ];
  return (
    <header className="topnav">
      <div className="topnav__inner">
        <div className="brand">
          <div className="brand__mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="15" fill="url(#bg)" />
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366F1" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <text x="16" y="21" textAnchor="middle" fontFamily="var(--font-display)" fontSize="13" fontWeight="700" fill="#fff">GC</text>
            </svg>
          </div>
          <div className="brand__text">
            <span className="brand__name">Gestion Classe</span>
            <span className="brand__sub">T3 · 2025–2026</span>
          </div>
        </div>

        <nav className="nav">
          {items.map(it => (
            <button key={it.id}
              className={`nav__item ${current === it.id ? 'is-active' : ''}`}
              onClick={() => onNavigate && onNavigate(it.id)}>
              <Icon name={it.icon} size={15} />
              <span>{it.label}</span>
            </button>
          ))}
          <button className="nav__item nav__item--muted">
            <Icon name="plus" size={15} />
            <span>Plus</span>
          </button>
        </nav>

        <div className="topnav__right">
          <button className="iconbtn" title="Notifications"><Icon name="bell" size={16} /></button>
          <button className="iconbtn" title="Réglages"><Icon name="settings" size={16} /></button>
          <div className="avatar">T</div>
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { ClassChip, Sparkline, TrendBadge, Icon, TopNav });
