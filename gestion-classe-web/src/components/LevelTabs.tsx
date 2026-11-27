/**
 * Onglets sur le dessus d'une carte de liste (styles dans mes-cours.css) : niveaux de « Mes cours »
 * et de « Mes TP », thèmes ou sessions des annales. Un seul onglet est à l'écran à la fois.
 */
import type { CSSProperties } from 'react';

export interface LevelTab {
  key: string;
  label: string;
  count: number;
  /** Ce que compte le nombre, lu au survol (« 12 TP », « 3 sujets »). */
  countTitle?: string;
  /** Teinte du trait sous l'onglet choisi (celle du niveau) ; absente : indigo. */
  tone?: string;
}

interface Props {
  /** Ce que les onglets départagent, pour les lecteurs d'écran (« Niveau », « Thème »…). */
  label: string;
  tabs: LevelTab[];
  selected: string;
  onSelect: (key: string) => void;
}

export function LevelTabs({ label, tabs, selected, onSelect }: Props) {
  return (
    <div className="mc-level-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === selected}
          className="mc-level-tab"
          style={tab.tone ? ({ '--mc-tab-tone': tab.tone } as CSSProperties) : undefined}
          onClick={() => onSelect(tab.key)}
        >
          <span className="mc-level__name">{tab.label}</span>
          <span className="mc-level__count" title={tab.countTitle}>{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
