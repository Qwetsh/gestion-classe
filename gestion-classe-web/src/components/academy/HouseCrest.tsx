import type { HouseData } from './houses';

// Gryffondor — Lion rampant (dressé sur pattes arrières)
function SalamandreGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      {/* Crinière */}
      <path d="M-8 -58 Q-18 -52 -20 -42 Q-24 -48 -22 -38 Q-28 -42 -26 -34 Q-30 -36 -28 -28 Q-24 -22 -16 -20 Q-8 -18 -2 -22 Q4 -26 6 -34 Q10 -42 8 -50 Q4 -56 -2 -58 Z" fill={color} opacity="0.7" />
      {/* Tête */}
      <path d="M-14 -38 Q-18 -32 -16 -26 Q-14 -20 -8 -18 Q-2 -16 4 -18 Q8 -20 8 -26 Q8 -32 4 -36 Q0 -40 -6 -40 Q-12 -40 -14 -38 Z" fill={color} />
      {/* Oreilles */}
      <path d="M-10 -42 L-14 -50 L-6 -44 Z" fill={color} />
      <path d="M2 -40 L6 -48 L8 -38 Z" fill={color} />
      {/* Oeil */}
      <circle cx="-4" cy="-30" r="1.5" fill="var(--ink-void)" />
      {/* Museau */}
      <path d="M-8 -22 Q-4 -18 0 -20" fill="none" stroke={color} strokeWidth="1.2" />
      {/* Corps dressé */}
      <path d="M-6 -16 Q-10 -6 -12 6 Q-14 16 -10 26 Q-6 34 0 38" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M4 -16 Q8 -4 10 8 Q12 18 8 28 Q4 34 0 38" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Ventre */}
      <path d="M-10 0 Q-4 6 8 2" fill={color} opacity="0.4" />
      {/* Patte avant gauche levée (griffes) */}
      <path d="M-12 -4 Q-20 -8 -28 -14 Q-32 -16 -34 -12 L-30 -10 L-34 -8 L-30 -6 L-34 -4 L-28 -4 Q-22 -2 -14 0" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Patte avant droite levée */}
      <path d="M10 0 Q18 -6 24 -10 Q28 -14 30 -10 L26 -8 L30 -6 L26 -4 L30 -2 L24 0 Q18 2 12 4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Pattes arrière */}
      <path d="M-6 34 Q-10 40 -14 46 Q-16 50 -12 50 L-6 46" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 34 Q8 40 12 46 Q14 50 10 50 L6 46" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Queue */}
      <path d="M0 38 Q6 44 12 42 Q20 38 24 44 Q28 50 22 52 Q16 50 18 46" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Touffe queue */}
      <path d="M18 46 Q14 50 18 54 Q22 56 24 52" fill={color} opacity="0.7" />
    </g>
  );
}

// Serpentard — Serpent en S
function VouivreGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      {/* Corps principal en S sinueux */}
      <path d="M0 -56 Q-4 -50 -2 -44 Q2 -38 8 -34 Q18 -26 20 -16 Q22 -6 14 2 Q6 10 -4 12 Q-16 14 -22 22 Q-28 30 -24 40 Q-20 48 -10 50 Q0 52 10 48 Q18 42 20 34" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tête triangulaire */}
      <path d="M-4 -56 Q0 -64 4 -56 Q8 -52 6 -48 Q4 -44 0 -44 Q-4 -44 -6 -48 Q-8 -52 -4 -56 Z" fill={color} />
      {/* Yeux */}
      <circle cx="-2" cy="-52" r="1.2" fill="var(--ink-void)" />
      <circle cx="3" cy="-52" r="1.2" fill="var(--ink-void)" />
      {/* Langue fourchue */}
      <path d="M0 -64 L-3 -70 M0 -64 L3 -70" stroke={color} strokeWidth="1" strokeLinecap="round" />
      {/* Écailles décoratives */}
      <path d="M12 -22 Q16 -20 14 -16" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      <path d="M-14 18 Q-18 20 -16 24" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      <path d="M-22 32 Q-26 34 -24 38" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      {/* Ventre (lignes) */}
      <path d="M4 -36 L6 -34" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <path d="M16 -20 L18 -18" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <path d="M8 4 L10 6" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <path d="M-16 20 L-14 22" stroke={color} strokeWidth="0.7" opacity="0.5" />
      <path d="M-18 36 L-16 38" stroke={color} strokeWidth="0.7" opacity="0.5" />
      {/* Queue effilée */}
      <path d="M20 34 Q24 28 26 22 Q28 16 26 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M26 14 Q24 12 26 10 Q28 8 30 10" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

// Serdaigle — Aigle aux ailes déployées
function ZephyrGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      {/* Aile gauche */}
      <path d="M-6 -10 Q-16 -18 -28 -26 Q-36 -30 -44 -28 Q-50 -26 -52 -20 Q-54 -14 -48 -10 Q-42 -6 -34 -8 Q-28 -10 -22 -6 Q-16 -2 -10 -4 Z" fill={color} opacity="0.85" />
      {/* Plumes aile gauche */}
      <path d="M-28 -26 Q-34 -22 -38 -16" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M-36 -28 Q-42 -22 -46 -16" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M-44 -26 Q-48 -20 -50 -14" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      {/* Aile droite */}
      <path d="M6 -10 Q16 -18 28 -26 Q36 -30 44 -28 Q50 -26 52 -20 Q54 -14 48 -10 Q42 -6 34 -8 Q28 -10 22 -6 Q16 -2 10 -4 Z" fill={color} opacity="0.85" />
      {/* Plumes aile droite */}
      <path d="M28 -26 Q34 -22 38 -16" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M36 -28 Q42 -22 46 -16" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      <path d="M44 -26 Q48 -20 50 -14" fill="none" stroke={color} strokeWidth="0.8" opacity="0.5" />
      {/* Corps */}
      <ellipse cx="0" cy="8" rx="8" ry="18" fill={color} opacity="0.8" />
      {/* Tête */}
      <circle cx="0" cy="-18" r="9" fill={color} />
      {/* Yeux */}
      <circle cx="-3" cy="-20" r="1.8" fill="var(--ink-void)" />
      <circle cx="3" cy="-20" r="1.8" fill="var(--ink-void)" />
      {/* Reflets yeux */}
      <circle cx="-2.5" cy="-20.5" r="0.6" fill={color} />
      <circle cx="3.5" cy="-20.5" r="0.6" fill={color} />
      {/* Bec crochu */}
      <path d="M-2 -14 L0 -10 L2 -14 Q1 -12 0 -8 Q-1 -12 -2 -14 Z" fill={color} />
      <path d="M0 -8 L0 -6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Sourcils (expression fière) */}
      <path d="M-6 -24 Q-3 -25 -1 -23" fill="none" stroke="var(--ink-void)" strokeWidth="0.8" />
      <path d="M6 -24 Q3 -25 1 -23" fill="none" stroke="var(--ink-void)" strokeWidth="0.8" />
      {/* Queue */}
      <path d="M-4 26 L-8 40 M0 26 L0 42 M4 26 L8 40" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Serres */}
      <path d="M-6 24 Q-10 30 -12 34 L-14 32 L-12 36 L-10 34" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 24 Q10 30 12 34 L14 32 L12 36 L10 34" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

// Poufsouffle — Blaireau
function TaissonGlyph({ color = 'var(--gold-bright)' }: { color?: string }) {
  return (
    <g>
      {/* Corps trapu */}
      <ellipse cx="0" cy="10" rx="30" ry="20" fill={color} opacity="0.7" />
      {/* Tête */}
      <ellipse cx="0" cy="-20" rx="16" ry="14" fill={color} />
      {/* Bandes caractéristiques du blaireau (face) */}
      <path d="M-8 -30 Q-8 -20 -8 -10" fill="none" stroke="var(--ink-void)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M8 -30 Q8 -20 8 -10" fill="none" stroke="var(--ink-void)" strokeWidth="3.5" strokeLinecap="round" />
      {/* Bande blanche centrale */}
      <path d="M0 -34 Q0 -24 0 -12" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Oreilles */}
      <ellipse cx="-12" cy="-32" rx="4" ry="5" fill={color} />
      <ellipse cx="12" cy="-32" rx="4" ry="5" fill={color} />
      {/* Yeux */}
      <circle cx="-5" cy="-22" r="2" fill="var(--ink-void)" />
      <circle cx="5" cy="-22" r="2" fill="var(--ink-void)" />
      {/* Reflets */}
      <circle cx="-4.5" cy="-22.5" r="0.7" fill={color} />
      <circle cx="5.5" cy="-22.5" r="0.7" fill={color} />
      {/* Museau/nez */}
      <ellipse cx="0" cy="-14" rx="4" ry="3" fill={color} opacity="0.9" />
      <ellipse cx="0" cy="-13" rx="2.5" ry="1.8" fill="var(--ink-void)" opacity="0.8" />
      {/* Pattes avant */}
      <path d="M-18 24 Q-20 32 -22 38 Q-24 42 -20 42 Q-16 42 -16 38 Q-16 34 -14 30" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M18 24 Q20 32 22 38 Q24 42 20 42 Q16 42 16 38 Q16 34 14 30" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Griffes */}
      <path d="M-22 42 L-24 46 M-20 42 L-20 46 M-18 42 L-16 46" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <path d="M22 42 L24 46 M20 42 L20 46 M18 42 L16 46" stroke={color} strokeWidth="1" strokeLinecap="round" />
      {/* Pattes arrière (juste visibles) */}
      <path d="M-24 18 Q-30 22 -32 28" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 18 Q30 22 32 28" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Queue courte */}
      <path d="M0 30 Q4 36 2 40 Q-2 42 -4 38" fill={color} opacity="0.6" />
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
        <g transform="translate(100, 135)">
          <Glyph color="var(--gold-bright)" />
        </g>
        <path d="M40 40 L160 40 L160 60 L40 60 Z" fill={house.c2} opacity="0.22" />
        <line x1="40" y1="60" x2="160" y2="60" stroke="var(--gold-deep)" strokeWidth="0.6" opacity="0.6" />
      </svg>
    </div>
  );
}
