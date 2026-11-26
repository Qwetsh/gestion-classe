/** Petite courbe des dix dernières séances d'un élève, sur sa place du plan de classe. */
export function MiniSpark({ history }: { history: (number | null)[] }) {
  const w = 38, h = 14;
  const max = 2, min = -2;
  const pts = history.map((v, i) => {
    if (v === null) return null;
    const x = (i / (history.length - 1)) * w;
    const y = h / 2 - ((v - 0) / (max - min)) * h;
    return { x, y };
  }).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return null;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block', opacity: 0.85 }}>
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="currentColor" opacity={0.25} strokeWidth={0.5} />
      <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
