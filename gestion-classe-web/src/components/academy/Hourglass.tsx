/**
 * Hourglass SVG — HP-style with tall top chamber (infinite magic sand),
 * shorter bottom chamber that fills based on points.
 * Sand particles stream through the neck continuously.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** 0–100 fill percentage */
  pct: number;
  /** Primary sand color (house color) */
  color: string;
  /** Lighter accent for glow/highlights */
  colorLight: string;
  /** Component width in px */
  size?: number;
}

// Unique ID counter to avoid SVG ID collisions when multiple hourglasses render
let idCounter = 0;

export function Hourglass({ pct, color, colorLight, size = 200 }: Props) {
  const uid = useRef(`hg-${++idCounter}`).current;
  const fill = Math.max(0, Math.min(100, pct));

  // Animate the displayed fill smoothly
  const [displayFill, setDisplayFill] = useState(fill);
  const prevFill = useRef(fill);

  useEffect(() => {
    const from = prevFill.current;
    const to = fill;
    prevFill.current = to;
    if (from === to) return;

    const duration = 2000; // ms
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayFill(from + (to - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [fill]);

  // ViewBox: 100 wide × 200 tall
  // Top chamber: y=10 to y=100 (90 units tall)
  // Neck: y=100 to y=115
  // Bottom chamber: y=115 to y=175 (60 units tall — shorter)

  // Bottom sand height based on displayFill
  const bottomChamberHeight = 55; // inner height of bottom chamber
  const bottomSandHeight = (displayFill / 100) * bottomChamberHeight;
  const bottomSandY = 170 - bottomSandHeight;

  // Sand is always streaming (magic hourglass)
  const isStreaming = true;

  const frameColor = '#c9a84c';
  const frameHighlight = '#e8d48b';
  const frameShadow = '#8b6f2a';
  const glassColor = 'rgba(255,255,255,0.06)';

  // Top bulb path (taller)
  const topBulb = 'M22,14 Q22,10 26,10 L74,10 Q78,10 78,14 L78,85 Q78,98 50,107 Q22,98 22,85 Z';
  // Bottom bulb path (shorter)
  const bottomBulb = 'M22,173 Q22,178 26,178 L74,178 Q78,178 78,173 L78,130 Q78,118 50,110 Q22,118 22,130 Z';

  // Generate sand particles along the stream
  const particles = Array.from({ length: 12 }, (_, i) => ({
    delay: (i / 12) * 2,
    x: 50 + (Math.random() - 0.5) * 4,
    size: 1 + Math.random() * 1.5,
  }));

  return (
    <svg
      width={size}
      height={size * 1.9}
      viewBox="0 0 100 190"
      style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
    >
      <defs>
        <linearGradient id={`${uid}-sand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>

        <clipPath id={`${uid}-top`}>
          <path d={topBulb} />
        </clipPath>
        <clipPath id={`${uid}-bottom`}>
          <path d={bottomBulb} />
        </clipPath>
        <clipPath id={`${uid}-glass`}>
          <path d={topBulb} />
          <path d={bottomBulb} />
        </clipPath>

        <filter id={`${uid}-glow`}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* === Frame === */}
      {/* Top cap */}
      <rect x="16" y="4" width="68" height="9" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="18" y="5.5" width="64" height="3.5" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Bottom cap */}
      <rect x="16" y="175" width="68" height="9" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="18" y="176.5" width="64" height="3.5" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Left pillar */}
      <path d="M19,13 Q15,95 19,175" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M18,13 Q14,95 18,175" fill="none"
        stroke={frameHighlight} strokeWidth="0.5" opacity="0.5" />

      {/* Right pillar */}
      <path d="M81,13 Q85,95 81,175" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M82,13 Q86,95 82,175" fill="none"
        stroke={frameShadow} strokeWidth="0.5" opacity="0.5" />

      {/* === Glass background === */}
      <g clipPath={`url(#${uid}-glass)`}>
        <rect x="0" y="0" width="100" height="190" fill={glassColor} />
      </g>

      {/* === Glass outlines === */}
      <path d={topBulb} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <path d={bottomBulb} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* === Top chamber sand (always full — magic!) === */}
      <g clipPath={`url(#${uid}-top)`}>
        <rect x="15" y="10" width="70" height="97"
          fill={color} opacity="0.15" filter={`url(#${uid}-glow)`} />
        <rect x="15" y="10" width="70" height="97"
          fill={`url(#${uid}-sand)`} opacity="0.85" />
        {/* Sand surface with funnel dip in center */}
        <ellipse cx="50" cy="95" rx="28" ry="4"
          fill={colorLight} opacity="0.25" />
        {/* Funnel opening at bottom of top sand */}
        <ellipse cx="50" cy="100" rx="6" ry="2"
          fill="#0a0908" opacity="0.4" />
      </g>

      {/* === Bottom chamber sand === */}
      {displayFill > 0 && (
        <g clipPath={`url(#${uid}-bottom)`}>
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={color} opacity="0.15" filter={`url(#${uid}-glow)`} />
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={`url(#${uid}-sand)`} opacity="0.85" />
          {/* Sand pile surface highlight */}
          <ellipse cx="50" cy={bottomSandY} rx="24" ry="3"
            fill={colorLight} opacity="0.35" />
          {/* Sand cone at top of pile */}
          {displayFill < 90 && (
            <path
              d={`M42,${bottomSandY + 2} Q50,${bottomSandY - 5} 58,${bottomSandY + 2}`}
              fill={colorLight} opacity="0.2" />
          )}
        </g>
      )}

      {/* === Falling sand stream through neck === */}
      {isStreaming && (
        <>
          {/* Main stream line */}
          <line x1="50" y1="100" x2="50" y2={Math.min(bottomSandY + 3, 165)}
            stroke={color} strokeWidth="1.8" opacity="0.5">
            <animate attributeName="opacity" values="0.35;0.6;0.35" dur="1.5s" repeatCount="indefinite" />
          </line>

          {/* Sand particles falling */}
          {particles.map((p, i) => (
            <circle key={i} cx={p.x} cy="100" r={p.size} fill={colorLight} opacity="0.7">
              <animate
                attributeName="cy"
                from="100"
                to={Math.min(bottomSandY + 5, 168).toString()}
                dur="2s"
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cx"
                values={`${p.x};${50 + (Math.random() - 0.5) * 10};${p.x}`}
                dur="2s"
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.7;0.5;0"
                dur="2s"
                begin={`${p.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}

          {/* Splash particles at landing point */}
          {displayFill > 0 && displayFill < 95 && [0, 1, 2].map(i => (
            <circle key={`sp-${i}`} cx="50" cy={bottomSandY} r="1" fill={colorLight} opacity="0">
              <animate
                attributeName="cx"
                from="50"
                to={`${44 + i * 6}`}
                dur="0.8s"
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                from={bottomSandY.toString()}
                to={`${bottomSandY - 4}`}
                dur="0.8s"
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0"
                dur="0.8s"
                begin={`${i * 0.7}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </>
      )}

      {/* === Glass reflections === */}
      <path d="M32,18 Q29,50 36,85" fill="none"
        stroke="rgba(255,255,255,0.10)" strokeWidth="2" strokeLinecap="round" />
      <path d="M32,125 Q29,145 36,168" fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
