import { useMemo, useState, useEffect, useRef } from 'react';

// --- Starfield ---
export function Starfield({ density = 80 }: { density?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: density }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.8 + 0.4,
      delay: Math.random() * 5,
      duration: Math.random() * 4 + 3,
      opacity: Math.random() * 0.6 + 0.3,
    })), [density]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: 'var(--gold-bright)',
          boxShadow: `0 0 ${s.size * 3}px var(--gold)`,
          animation: `academy-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          opacity: s.opacity,
        }} />
      ))}
    </div>
  );
}

// --- Candle ---
export function Candle({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: { w: 10, h: 40, fw: 12, fh: 20 }, md: { w: 14, h: 60, fw: 16, fh: 28 }, lg: { w: 18, h: 80, fw: 22, fh: 36 } };
  const s = sizes[size];
  return (
    <div style={{ position: 'relative', width: s.fw * 3, height: s.h + s.fh }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', left: 0, bottom: s.h - 4,
        width: s.fw * 3, height: s.fh * 2,
        background: 'radial-gradient(ellipse, oklch(0.85 0.15 80 / 0.5) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      {/* Flame */}
      <div style={{
        position: 'absolute', left: (s.fw * 3 - s.fw) / 2, bottom: s.h - 2,
        width: s.fw, height: s.fh,
        background: 'radial-gradient(ellipse at 50% 80%, oklch(0.92 0.16 85) 0%, oklch(0.80 0.18 60) 45%, oklch(0.55 0.20 35) 85%, transparent 100%)',
        borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
        transformOrigin: 'bottom center',
        animation: 'academy-flicker 2.5s ease-in-out infinite',
        filter: 'blur(0.5px)',
      }} />
      {/* Candle stick */}
      <div style={{
        position: 'absolute', bottom: 0, left: (s.fw * 3 - s.w) / 2, width: s.w, height: s.h,
        background: 'linear-gradient(180deg, oklch(0.75 0.04 80) 0%, oklch(0.55 0.05 70) 100%)',
        borderRadius: 2,
        boxShadow: '0 0 8px oklch(0.85 0.15 75 / 0.3)',
      }} />
    </div>
  );
}

// --- FloatingCandles ---
export function FloatingCandles({ count = 12 }: { count?: number }) {
  const candles = useMemo(() =>
    Array.from({ length: count }, (_, i) => {
      // Depth layer: 0 = far (blurry, small), 1 = mid, 2 = close (sharp, large)
      const depth = i % 3;
      const drift = Math.floor(Math.random() * 4); // 0-3 animation variant
      return {
        x: (i / count) * 100 + (Math.random() - 0.5) * 10,
        y: Math.random() * 70 + 5,
        delay: Math.random() * 5,
        duration: 4 + Math.random() * 4,
        size: (depth === 0 ? 'sm' : 'md') as 'sm' | 'md',
        blur: depth === 0 ? 2.5 : depth === 1 ? 0.8 : 0,
        scale: depth === 0 ? 0.7 : depth === 1 ? 1 : 1.15,
        opacity: depth === 0 ? 0.5 : depth === 1 ? 0.8 : 1,
        drift,
      };
    }), [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden>
      {candles.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
          animation: `academy-drift-${c.drift} ${c.duration}s ease-in-out ${c.delay}s infinite`,
          filter: c.blur > 0 ? `blur(${c.blur}px)` : undefined,
          transform: `scale(${c.scale})`,
          opacity: c.opacity,
        }}>
          <Candle size={c.size} />
        </div>
      ))}
    </div>
  );
}

// --- Ornament ---
export function Ornament({ variant = 'line', color = 'var(--gold)', width = 200 }: { variant?: 'line' | 'diamond' | 'fleur'; color?: string; width?: number }) {
  if (variant === 'line') {
    return (
      <svg width={width} height="18" viewBox="0 0 200 18" style={{ display: 'block' }}>
        <line x1="0" y1="9" x2="80" y2="9" stroke={color} strokeWidth="0.8" opacity="0.6" />
        <line x1="120" y1="9" x2="200" y2="9" stroke={color} strokeWidth="0.8" opacity="0.6" />
        <g transform="translate(100 9)">
          <circle r="2" fill={color} />
          <circle r="6" fill="none" stroke={color} strokeWidth="0.6" opacity="0.6" />
          <circle r="10" fill="none" stroke={color} strokeWidth="0.4" opacity="0.4" />
          <path d="M -18 0 L -12 0 M 12 0 L 18 0" stroke={color} strokeWidth="0.8" />
        </g>
      </svg>
    );
  }
  if (variant === 'diamond') {
    return (
      <svg width={width} height="24" viewBox="0 0 200 24" style={{ display: 'block' }}>
        <line x1="0" y1="12" x2="90" y2="12" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <line x1="110" y1="12" x2="200" y2="12" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <g transform="translate(100 12)">
          <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" fill="none" stroke={color} strokeWidth="0.8" />
          <path d="M 0 -3 L 3 0 L 0 3 L -3 0 Z" fill={color} />
        </g>
      </svg>
    );
  }
  return (
    <svg width={width} height="28" viewBox="0 0 200 28" style={{ display: 'block' }}>
      <line x1="0" y1="14" x2="70" y2="14" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <line x1="130" y1="14" x2="200" y2="14" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <g transform="translate(100 14)" fill={color} opacity="0.9">
        <path d="M 0 -10 Q -6 -4 -10 0 Q -6 4 0 10 Q 6 4 10 0 Q 6 -4 0 -10 Z" fill="none" stroke={color} strokeWidth="0.8" />
        <circle r="2" />
        <path d="M -16 0 Q -12 -2 -8 0 Q -12 2 -16 0 Z" />
        <path d="M 16 0 Q 12 -2 8 0 Q 12 2 16 0 Z" />
      </g>
    </svg>
  );
}

// --- WaxSeal ---
export function WaxSeal({ letter = 'Q', size = 72 }: { letter?: string; size?: number }) {
  return (
    <div className="wax-seal" style={{
      width: size, height: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontSize: size * 0.5, fontWeight: 600,
      color: 'oklch(0.25 0.08 22)', fontStyle: 'italic',
      textShadow: '1px 1px 0 oklch(0.90 0.10 35 / 0.3)',
      transform: 'rotate(-8deg)', letterSpacing: '-0.05em',
    }}>{letter}</div>
  );
}

// --- GoldParticles ---
export function GoldParticles({ active, count = 60 }: { active: boolean; count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: 60 + Math.random() * 180,
      size: 2 + Math.random() * 4,
      duration: 1500 + Math.random() * 1500,
      delay: Math.random() * 400,
    })), [count, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden>
      {particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.distance;
        const dy = Math.sin(p.angle) * p.distance;
        return (
          <div key={i} style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: 'var(--gold-bright)',
            boxShadow: `0 0 ${p.size * 3}px var(--gold)`,
            animation: `academy-particle-burst ${p.duration}ms cubic-bezier(0.2, 0.7, 0.4, 1) ${p.delay}ms forwards`,
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
          } as React.CSSProperties} />
        );
      })}
    </div>
  );
}

// --- BokehField ---
export function BokehField({ density = 70, houseColor }: {
  density?: number;
  houseColor?: string;
}) {
  const particles = useMemo(() =>
    Array.from({ length: density }, () => {
      const r = Math.random();
      // Size: mostly small with some medium and a few larger
      const size = r < 0.6
        ? 1 + Math.random() * 2        // small: 1-3px
        : r < 0.88
        ? 3 + Math.random() * 3        // medium: 3-6px
        : 6 + Math.random() * 4;       // large: 6-10px

      return {
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        drift: Math.floor(Math.random() * 6),
        duration: 10 + Math.random() * 15,
        delay: Math.random() * 10,
        twinkle: 4 + Math.random() * 6,
        twinkleDelay: Math.random() * 5,
        colorType: Math.random() < 0.65 ? 'gold' : Math.random() < 0.5 ? 'warm' : 'house',
      };
    }), [density]);

  const getColor = (type: string) => {
    if (type === 'house' && houseColor) return houseColor;
    if (type === 'warm') return '#fff5e0';
    return '#f0d060';
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      {particles.map((p, i) => {
        const c = getColor(p.colorType);
        const glowSize = p.size * 3;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: c,
            boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px ${c}`,
            opacity: p.size < 3 ? 0.6 + Math.random() * 0.3 : p.size < 6 ? 0.4 + Math.random() * 0.3 : 0.25 + Math.random() * 0.2,
            animation: `academy-bokeh-${p.drift} ${p.duration}s ease-in-out ${p.delay}s infinite, academy-twinkle ${p.twinkle}s ease-in-out ${p.twinkleDelay}s infinite`,
          }} />
        );
      })}
    </div>
  );
}

// --- RollingNumber ---
export function RollingNumber({ value, duration = 2500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const from = prev.current;
    const to = value;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}

