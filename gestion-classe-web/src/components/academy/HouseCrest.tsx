import type { HouseData } from './houses';

function SalamandreGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      <path d="M0 -60 Q-8 -44 -4 -32 Q-12 -40 -14 -28 Q-20 -38 -18 -22 Q-26 -28 -22 -14 L22 -14 Q26 -28 18 -22 Q20 -38 14 -28 Q12 -40 4 -32 Q8 -44 0 -60 Z" fill={color} opacity="0.85" />
      <path d="M-28 -6 Q-34 4 -26 12 Q-10 18 -4 6 Q2 -6 14 0 Q26 8 28 18 Q30 30 18 34 Q6 36 -2 30 Q-14 24 -22 30 Q-32 36 -34 26 Q-36 14 -28 -6 Z" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="-18" cy="8" r="1.8" fill={color} />
      <circle cx="-6" cy="18" r="1.8" fill={color} />
      <circle cx="10" cy="22" r="1.8" fill={color} />
      <circle cx="22" cy="26" r="1.8" fill={color} />
      <circle cx="-26" cy="2" r="1.4" fill="var(--ink-void)" />
      <path d="M28 30 Q38 36 40 46" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function VouivreGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      <path d="M-22 -58 Q-15 -48 -8 -58 Q0 -48 8 -58 Q15 -48 22 -58 L22 -46 L-22 -46 Z" fill={color} opacity="0.75" />
      <path d="M0 -40 Q-22 -32 -22 -16 Q-22 0 -4 4 Q10 6 14 -4 Q16 -14 6 -16 Q-2 -14 -2 -6 Q0 2 10 4 Q24 6 28 -4 Q32 -20 22 -30 Q14 -36 4 -34" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-20 8 Q-30 20 -20 32 Q-4 40 14 34 Q28 28 26 14" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
      <path d="M0 -44 L-6 -36 L6 -36 Z" fill={color} />
      <circle cx="-2" cy="-40" r="0.9" fill="var(--ink-void)" />
      <path d="M0 -36 L-3 -30 M0 -36 L3 -30" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="-30" cy="20" r="2" fill={color} opacity="0.7" />
      <circle cx="32" cy="22" r="2" fill={color} opacity="0.7" />
    </g>
  );
}

function ZephyrGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      <path d="M0 -20 Q-40 -30 -54 -8 Q-48 -16 -38 -14 Q-44 -6 -36 0 Q-30 -6 -22 -4 Q-28 4 -18 8 Q-10 0 -4 0 L0 -2 Z" fill={color} opacity="0.9" />
      <path d="M0 -20 Q40 -30 54 -8 Q48 -16 38 -14 Q44 -6 36 0 Q30 -6 22 -4 Q28 4 18 8 Q10 0 4 0 L0 -2 Z" fill={color} opacity="0.9" />
      <path d="M-12 -12 Q-22 -12 -32 -8" stroke={color} strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d="M12 -12 Q22 -12 32 -8" stroke={color} strokeWidth="0.7" fill="none" opacity="0.5" />
      <ellipse cx="0" cy="6" rx="6" ry="14" fill={color} />
      <path d="M0 -8 Q-4 -14 0 -20 Q4 -14 0 -8" fill={color} />
      <path d="M0 -20 L-2 -24 L2 -24 Z" fill={color} />
      <circle cx="0" cy="-16" r="1" fill="var(--ink-void)" />
      <path d="M-6 18 L0 34 L6 18 Z" fill={color} />
      <path d="M-34 30 Q-24 24 -14 30 Q-4 36 6 30" fill="none" stroke={color} strokeWidth="1.2" opacity="0.7" />
      <path d="M6 40 Q16 34 26 40" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />
    </g>
  );
}

function TaissonGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      <path d="M-26 -52 L-14 -38 L-4 -50 L6 -38 L18 -52 L26 -40 L-30 -40 Z" fill={color} opacity="0.75" />
      <ellipse cx="0" cy="6" rx="28" ry="18" fill="none" stroke={color} strokeWidth="2.3" />
      <path d="M-6 -28 L-6 -8 M6 -28 L6 -8" stroke={color} strokeWidth="1.8" />
      <ellipse cx="0" cy="-18" rx="12" ry="10" fill="none" stroke={color} strokeWidth="2.3" />
      <path d="M-4 -10 L0 -6 L4 -10 Z" fill={color} />
      <circle cx="-4" cy="-20" r="1.5" fill={color} />
      <circle cx="4" cy="-20" r="1.5" fill={color} />
      <path d="M-10 -26 L-8 -30 L-6 -26 Z" fill={color} />
      <path d="M6 -26 L8 -30 L10 -26 Z" fill={color} />
      <g stroke={color} strokeWidth="1" fill="none">
        <path d="M-36 10 L-40 30" />
        <path d="M-36 14 L-42 18 M-36 18 L-42 22 M-36 22 L-42 26" />
        <path d="M36 10 L40 30" />
        <path d="M36 14 L42 18 M36 18 L42 22 M36 22 L42 26" />
      </g>
      <path d="M-30 26 L30 26" stroke={color} strokeWidth="1.2" opacity="0.6" />
    </g>
  );
}

const GLYPHS = {
  salamandre: SalamandreGlyph,
  vouivre: VouivreGlyph,
  zephyr: ZephyrGlyph,
  taisson: TaissonGlyph,
} as const;

export function HouseCrest({ house, size = 140, ornate = true, glow = false }: {
  house: HouseData;
  size?: number;
  ornate?: boolean;
  glow?: boolean;
}) {
  const Glyph = GLYPHS[house.id];
  const gradId = `shield-${house.id}`;

  return (
    <div style={{
      filter: glow ? `drop-shadow(0 0 18px ${house.c1}) drop-shadow(0 0 6px var(--gold))` : 'none',
    }}>
      <svg viewBox="0 0 200 240" width={size} height={size * 1.2} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={house.c1} stopOpacity={0.95} />
            <stop offset="1" stopColor={house.c1} stopOpacity={0.75} />
          </linearGradient>
          <filter id="crestShadow">
            <feGaussianBlur stdDeviation="2" />
            <feOffset dx="0" dy="2" />
            <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {ornate && (
          <path d="M100 8 L108 16 L120 14 L118 26 L128 32 L120 40 L124 52 L112 52 L108 62 L100 58 L92 62 L88 52 L76 52 L80 40 L72 32 L82 26 L80 14 L92 16 Z" fill="none" stroke="var(--gold-deep)" strokeWidth="0.8" opacity="0.5" />
        )}
        <path d="M40 40 L160 40 L160 140 Q160 200 100 230 Q40 200 40 140 Z" fill={`url(#${gradId})`} stroke="var(--gold)" strokeWidth="2.5" />
        <path d="M48 48 L152 48 L152 138 Q152 194 100 220 Q48 194 48 138 Z" fill="none" stroke="var(--gold-deep)" strokeWidth="0.7" opacity="0.7" />
        <g transform="translate(100, 130)">
          <Glyph color="var(--gold-bright)" />
        </g>
        <path d="M40 40 L160 40 L160 60 L40 60 Z" fill={house.c2} opacity="0.22" />
        <line x1="40" y1="60" x2="160" y2="60" stroke="var(--gold-deep)" strokeWidth="0.6" opacity="0.6" />
      </svg>
    </div>
  );
}
