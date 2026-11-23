/**
 * Classeur virtuel : la largeur de l'écriture à la main, mesurée une fois la police chargée. Les
 * bilans sont coupés en lignes avec elle (lib/binderSummary.ts) ; tant qu'elle n'est pas là, le
 * classeur attend, pour que ses pages ne changent pas de numéro ensuite.
 */
import { useEffect, useState } from 'react';
import { INK_PX } from '../../lib/binderSummary';

export function useInkMeasure(): ((text: string) => number) | null {
  const [measure, setMeasure] = useState<((text: string) => number) | null>(null);
  useEffect(() => {
    let cancelled = false;
    const font = `${INK_PX}px "Playwrite FR Moderne"`;
    const done = () => {
      if (cancelled) return;
      const ctx = document.createElement('canvas').getContext('2d');
      // Même police de repli que l'affichage (`cursive`) : si la police d'écriture ne se charge pas,
      // les lignes restent mesurées avec celle qui sera vraiment dessinée, et ne débordent pas
      if (ctx) ctx.font = `${font}, cursive`;
      setMeasure(() => (text: string) => (ctx ? ctx.measureText(text).width : text.length * INK_PX * 0.6));
    };
    document.fonts.load(font).then(done, done);
    return () => { cancelled = true; };
  }, []);
  return measure;
}
