/**
 * Hourglass SVG — HP-style with small top chamber (infinite magic sand),
 * tall bottom chamber that fills based on points.
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

let idCounter = 0;

export function Hourglass({ pct, color, colorLight, size = 200 }: Props) {
  const uid = useRef(`hg-${++idCounter}`).current;
  const fill = Math.max(0, Math.min(100, pct));

  // Animate the displayed fill smoothly
  const [displayFill, setDisplayFill] = useState(fill);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevFill = useRef(fill);

  useEffect(() => {
    const from = prevFill.current;
    const to = fill;
    prevFill.current = to;
    if (from === to) return;

    setIsAnimating(true);
    const duration = 2000;
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayFill(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [fill]);

  // ViewBox: 100 wide × 380 tall (doubled height)
  // Top chamber (small): y=12 to y=110 (~98 units)
  // Neck: y=110 to y=130
  // Bottom chamber (tall): y=130 to y=350 (~220 units)

  const bottomChamberTop = 140;
  const bottomChamberBottom = 345;
  const bottomChamberHeight = bottomChamberBottom - bottomChamberTop;
  const bottomSandHeight = (displayFill / 100) * bottomChamberHeight;
  const bottomSandY = bottomChamberBottom - bottomSandHeight;

  const frameColor = '#c9a84c';
  const frameHighlight = '#e8d48b';
  const frameShadow = '#8b6f2a';
  const glassColor = 'rgba(255,255,255,0.06)';

  // Top bulb (smaller)
  const topBulb = 'M22,18 Q22,12 26,12 L74,12 Q78,12 78,18 L78,95 Q78,112 50,122 Q22,112 22,95 Z';
  // Bottom bulb (taller)
  const bottomBulb = 'M22,352 Q22,358 26,358 L74,358 Q78,358 78,352 L78,155 Q78,138 50,128 Q22,138 22,155 Z';

  // Particle speed: slow when idle, fast when filling
  const particleDur = isAnimating ? 2.5 : 7;
  const particleCount = isAnimating ? 14 : 6;

  // Sand particles — idle ones get a feather-like swaying path
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const startX = 50 + (Math.random() - 0.5) * 4;
    // Generate a sinuous cx path with 6 waypoints for idle mode
    const sway = isAnimating
      ? `${startX};${50 + (Math.random() - 0.5) * 12};${startX}`
      : Array.from({ length: 7 }, (_, j) => {
          if (j === 0 || j === 6) return startX;
          // Gentle sway ±6px, alternating direction with randomness
          const dir = j % 2 === 0 ? 1 : -1;
          return 50 + dir * (2 + Math.random() * 4);
        }).join(';');
    return {
      delay: (i / particleCount) * particleDur + Math.random() * 0.8,
      x: startX,
      size: isAnimating ? 1 + Math.random() * 1.5 : 0.8 + Math.random() * 0.8,
      sway,
    };
  });

  return (
    <svg
      width={size}
      height={size * 3.8}
      viewBox="0 0 100 380"
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
      <rect x="16" y="5" width="68" height="10" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="18" y="6.5" width="64" height="4" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Bottom cap */}
      <rect x="16" y="355" width="68" height="10" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="18" y="356.5" width="64" height="4" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Left pillar */}
      <path d="M19,15 Q14,190 19,355" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M18,15 Q13,190 18,355" fill="none"
        stroke={frameHighlight} strokeWidth="0.5" opacity="0.5" />

      {/* Right pillar */}
      <path d="M81,15 Q86,190 81,355" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M82,15 Q87,190 82,355" fill="none"
        stroke={frameShadow} strokeWidth="0.5" opacity="0.5" />

      {/* === Glass background === */}
      <g clipPath={`url(#${uid}-glass)`}>
        <rect x="0" y="0" width="100" height="380" fill={glassColor} />
      </g>

      {/* === Glass outlines === */}
      <path d={topBulb} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <path d={bottomBulb} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

      {/* === Top chamber sand (always full — magic!) === */}
      <g clipPath={`url(#${uid}-top)`}>
        <rect x="15" y="12" width="70" height="110"
          fill={color} opacity="0.15" filter={`url(#${uid}-glow)`} />
        <rect x="15" y="12" width="70" height="110"
          fill={`url(#${uid}-sand)`} opacity="0.85" />
        <ellipse cx="50" cy="100" rx="28" ry="4"
          fill={colorLight} opacity="0.25" />
        {/* Funnel opening */}
        <ellipse cx="50" cy="112" rx="6" ry="2"
          fill="#0a0908" opacity="0.4" />
      </g>

      {/* === Bottom chamber sand === */}
      {displayFill > 0 && (
        <g clipPath={`url(#${uid}-bottom)`}>
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={color} opacity="0.15" filter={`url(#${uid}-glow)`} />
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={`url(#${uid}-sand)`} opacity="0.85" />
          <ellipse cx="50" cy={bottomSandY} rx="24" ry="3"
            fill={colorLight} opacity="0.35" />
          {displayFill < 90 && (
            <path
              d={`M42,${bottomSandY + 2} Q50,${bottomSandY - 6} 58,${bottomSandY + 2}`}
              fill={colorLight} opacity="0.2" />
          )}
        </g>
      )}

      {/* === Falling sand stream === */}
      <>
        {/* Particles */}
        {particles.map((p, i) => {
          const endY = Math.min(bottomSandY + 5, 342);
          // Smooth spline: one per segment (n values = n-1 splines)
          const smoothSpline = '0.25 0.1 0.25 1';
          return (
            <circle key={`${i}-${isAnimating}`} cx={p.x} cy="115" r={p.size} fill={colorLight} opacity="0">
              <animate
                attributeName="cy"
                values={isAnimating
                  ? `115;${endY}`
                  : `115;${endY}`
                }
                dur={`${particleDur}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines={smoothSpline}
              />
              <animate
                attributeName="cx"
                values={p.sway}
                dur={`${particleDur}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines={isAnimating
                  ? `${smoothSpline};${smoothSpline}`
                  : Array(6).fill(smoothSpline).join(';')
                }
              />
              <animate
                attributeName="opacity"
                values={isAnimating ? '0;0.7;0.5;0' : '0;0.35;0.4;0.35;0.3;0.25;0'}
                dur={`${particleDur}s`}
                begin={`${p.delay}s`}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines={isAnimating
                  ? '0.25 0.1 0.25 1;0.25 0.1 0.25 1;0.25 0.1 0.25 1'
                  : Array(6).fill(smoothSpline).join(';')
                }
              />
            </circle>
          );
        })}

        {/* Splash at impact */}
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
              to={`${bottomSandY - 5}`}
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

      {/* === Glass reflections === */}
      <path d="M32,20 Q29,55 36,95" fill="none"
        stroke="rgba(255,255,255,0.10)" strokeWidth="2" strokeLinecap="round" />
      <path d="M32,155 Q28,220 36,320" fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
