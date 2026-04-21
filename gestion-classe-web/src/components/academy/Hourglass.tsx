/**
 * Hourglass SVG — house-colored sand fills from bottom based on percentage.
 * Inspired by the Great Hall hourglasses in Harry Potter.
 */

interface Props {
  /** 0–100 fill percentage */
  pct: number;
  /** Primary sand color (house color) */
  color: string;
  /** Lighter accent for glow/highlights */
  colorLight: string;
  /** Component height in px */
  size?: number;
}

export function Hourglass({ pct, color, colorLight, size = 200 }: Props) {
  // Clamp
  const fill = Math.max(0, Math.min(100, pct));

  // The hourglass is drawn in a 100×160 viewBox
  // Bottom chamber fills up, top chamber drains down
  const bottomFill = fill;        // 0→100 = empty→full bottom
  const topFill = 100 - fill;     // 100→0 = full→empty top

  // Bottom sand: clip rectangle rises from bottom
  // Chamber bottom spans roughly y=95 to y=145
  const bottomSandHeight = (bottomFill / 100) * 50;
  const bottomSandY = 145 - bottomSandHeight;

  // Top sand: clip rectangle drops from top
  // Chamber top spans roughly y=15 to y=65
  const topSandHeight = (topFill / 100) * 50;
  const topSandY = 15;

  const frameColor = '#c9a84c';
  const frameHighlight = '#e8d48b';
  const frameShadow = '#8b6f2a';
  const glassColor = 'rgba(255,255,255,0.06)';

  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 100 160"
      style={{ filter: `drop-shadow(0 0 8px ${color}44)` }}
    >
      <defs>
        {/* Sand gradient */}
        <linearGradient id={`sand-${color}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>

        {/* Glass shape — two bulbs connected by narrow neck */}
        <clipPath id="glass-clip">
          {/* Top bulb */}
          <path d="M20,15 Q20,10 25,10 L75,10 Q80,10 80,15 L80,55 Q80,65 50,72 Q20,65 20,55 Z" />
          {/* Bottom bulb */}
          <path d="M20,145 Q20,150 25,150 L75,150 Q80,150 80,145 L80,105 Q80,95 50,88 Q20,95 20,105 Z" />
        </clipPath>

        {/* Top bulb only */}
        <clipPath id="top-clip">
          <path d="M20,15 Q20,10 25,10 L75,10 Q80,10 80,15 L80,55 Q80,65 50,72 Q20,65 20,55 Z" />
        </clipPath>

        {/* Bottom bulb only */}
        <clipPath id="bottom-clip">
          <path d="M20,145 Q20,150 25,150 L75,150 Q80,150 80,145 L80,105 Q80,95 50,88 Q20,95 20,105 Z" />
        </clipPath>

        {/* Glow filter */}
        <filter id="sand-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>

      {/* === Frame (golden wood) === */}
      {/* Top cap */}
      <rect x="15" y="5" width="70" height="8" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="17" y="6" width="66" height="3" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Bottom cap */}
      <rect x="15" y="147" width="70" height="8" rx="3"
        fill={frameColor} stroke={frameShadow} strokeWidth="0.5" />
      <rect x="17" y="148" width="66" height="3" rx="1.5"
        fill={frameHighlight} opacity="0.4" />

      {/* Left pillar */}
      <path d="M18,13 Q15,80 18,147" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M17,13 Q14,80 17,147" fill="none"
        stroke={frameHighlight} strokeWidth="0.5" opacity="0.5" />

      {/* Right pillar */}
      <path d="M82,13 Q85,80 82,147" fill="none"
        stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
      <path d="M83,13 Q86,80 83,147" fill="none"
        stroke={frameShadow} strokeWidth="0.5" opacity="0.5" />

      {/* === Glass background === */}
      <g clipPath="url(#glass-clip)">
        <rect x="0" y="0" width="100" height="160" fill={glassColor} />
      </g>

      {/* === Glass outline === */}
      {/* Top bulb outline */}
      <path d="M20,15 Q20,10 25,10 L75,10 Q80,10 80,15 L80,55 Q80,65 50,72 Q20,65 20,55 Z"
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Bottom bulb outline */}
      <path d="M20,145 Q20,150 25,150 L75,150 Q80,150 80,145 L80,105 Q80,95 50,88 Q20,95 20,105 Z"
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Neck */}
      <path d="M50,72 L50,88" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* === Sand in top bulb === */}
      {topFill > 0 && (
        <g clipPath="url(#top-clip)">
          {/* Glow behind sand */}
          <rect x="15" y={topSandY} width="70" height={topSandHeight}
            fill={color} opacity="0.15" filter="url(#sand-glow)" />
          {/* Sand body */}
          <rect x="15" y={topSandY} width="70" height={topSandHeight}
            fill={`url(#sand-${color})`} opacity="0.85" />
          {/* Surface highlight */}
          <ellipse cx="50" cy={topSandY + topSandHeight} rx="25" ry="3"
            fill={colorLight} opacity="0.3" />
        </g>
      )}

      {/* === Sand in bottom bulb === */}
      {bottomFill > 0 && (
        <g clipPath="url(#bottom-clip)">
          {/* Glow behind sand */}
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={color} opacity="0.15" filter="url(#sand-glow)" />
          {/* Sand body */}
          <rect x="15" y={bottomSandY} width="70" height={bottomSandHeight}
            fill={`url(#sand-${color})`} opacity="0.85" />
          {/* Surface highlight */}
          <ellipse cx="50" cy={bottomSandY} rx="25" ry="3"
            fill={colorLight} opacity="0.4" />
        </g>
      )}

      {/* === Falling sand stream (when not 0 or 100) === */}
      {fill > 0 && fill < 100 && (
        <line x1="50" y1="68" x2="50" y2="92"
          stroke={color} strokeWidth="1.5" opacity="0.5">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
        </line>
      )}

      {/* === Glass reflection === */}
      <path d="M30,18 Q28,40 35,60" fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" />
      <path d="M30,100 Q28,120 35,140" fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
