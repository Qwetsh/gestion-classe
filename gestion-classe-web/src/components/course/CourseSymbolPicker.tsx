/**
 * Palette de symboles (Insertion › Symbole) : flèches, signes mathématiques, lettres grecques,
 * majuscules accentuées… Un clic insère le caractère ; la palette reste ouverte pour en poser
 * plusieurs. Les derniers symboles utilisés sont gardés sur l'appareil.
 */
import { useEffect, useRef, useState } from 'react';

const GROUPS: { title: string; chars: string }[] = [
  { title: 'Flèches', chars: '→ ← ↑ ↓ ↔ ⇒ ⇐ ⇔ ↗ ↘ ⇌ ➜' },
  { title: 'Calcul', chars: '× ÷ ± ≈ ≠ ≤ ≥ √ ∞ % ‰ ° ′ ″ · ∝' },
  { title: 'Maths', chars: 'π ∈ ∉ ⊂ ∪ ∩ ∅ ∑ ∆ ∠ ⊥ ∥ ≡ ℕ ℤ ℚ ℝ' },
  { title: 'Exposants et indices', chars: '⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ½ ¼ ¾' },
  { title: 'Lettres grecques', chars: 'α β γ δ ε θ λ μ ρ σ τ φ ω Δ Σ Ω Φ Λ' },
  { title: 'Majuscules accentuées', chars: 'À Â Ç É È Ê Ë Î Ï Ô Ù Û Œ Æ œ æ' },
  { title: 'Ponctuation', chars: '« » “ ” ’ … – — • § † ¿ ¡' },
  { title: 'Sciences et divers', chars: '℃ µ Å ♀ ♂ ☉ ☾ ♻ ☢ ⚠ ✓ ✗ ★ ☆ € £ © ♪' },
];

const RECENT_KEY = 'course-editor-symbols';
const MAX_RECENT = 16;

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

interface Props {
  /** Position de la palette (px, fenêtre) : sous le bouton du ruban. */
  left: number;
  top: number;
  onInsert: (char: string) => void;
  onClose: () => void;
}

export function CourseSymbolPicker({ left, top, onInsert, onClose }: Props) {
  const [recent, setRecent] = useState(loadRecent);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Au tour suivant : le clic qui ouvre la palette ne doit pas la refermer
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const pick = (ch: string) => {
    onInsert(ch);
    setRecent((prev) => {
      const next = [ch, ...prev.filter((c) => c !== ch)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  const row = (title: string, chars: string[]) => (
    <div key={title} className="ce-sym__group">
      <div className="ce-sym__title">{title}</div>
      <div className="ce-sym__grid">
        {chars.map((ch) => (
          <button key={ch} type="button" className="ce-sym__btn" onClick={() => pick(ch)} title={`Insérer ${ch}`}>{ch}</button>
        ))}
      </div>
    </div>
  );

  return (
    // mousedown annulé : le curseur reste dans le texte pendant qu'on choisit
    <div ref={ref} className="ce-sym" style={{ left: Math.max(8, Math.min(left, window.innerWidth - 428)), top }} role="dialog" aria-label="Symboles" onMouseDown={(e) => e.preventDefault()}>
      {recent.length > 0 && row('Récents', recent)}
      {GROUPS.map((g) => row(g.title, g.chars.split(' ')))}
    </div>
  );
}
