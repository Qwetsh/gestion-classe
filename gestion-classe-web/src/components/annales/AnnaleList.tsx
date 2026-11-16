/**
 * Liste des annales d'une matière : sections repliables (thème du programme ou session), une ligne
 * par sujet, sur le modèle de « Mes cours ». La ligne ouvre le sujet ; le reste est dans « ⋯ ».
 */
import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import type { AnnaleSection, AnnaleView } from '../../lib/annalesLibrary';
import { annaleLabel } from '../../lib/annalesLibrary';
import type { BrevetItem } from '../../lib/customAnnales';
import { MoreMenu } from '../MoreMenu';

const COLLAPSED_KEY = 'annales-collapsed';

function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
}

interface Props {
  /** Préfixe des sections repliées mémorisées (matière + vue). */
  scope: string;
  sections: AnnaleSection<BrevetItem>[];
  view: AnnaleView;
  /** Les points ne s'affichent que s'ils changent d'un sujet à l'autre. */
  showPoints: boolean;
  /** Recherche en cours : tout est déplié, sans toucher au choix mémorisé. */
  expandAll?: boolean;
  onOpen: (b: BrevetItem) => void;
  onNewTab: (b: BrevetItem) => void;
  onCopyLink: (b: BrevetItem) => void;
  onDelete: (b: BrevetItem) => void;
}

export function AnnaleList({ scope, sections, view, showPoints, expandAll, onOpen, onNewTab, onCopyLink, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  return (
    <div className="mc-levels">
      {sections.map(({ key, label, items }) => {
        const id = `${scope}:${key}`;
        const open = expandAll || !collapsed[id];
        return (
          <section key={id} className="mc-level">
            <button type="button" className="mc-level__head" onClick={() => toggle(id)} aria-expanded={open}>
              <ChevronDown size={16} className="mc-level__chevron" aria-hidden />
              <span className="mc-level__name">{label}</span>
              <span className="mc-level__count">{items.length} sujet{items.length > 1 ? 's' : ''}</span>
            </button>
            {open && (
              <ul className="mc-rows an-rows">
                {items.map((b) => {
                  const { title, detail } = annaleLabel(b);
                  return (
                    <li key={b.id ?? b.url} className="mc-row">
                      <button type="button" className="mc-row__open" onClick={() => onOpen(b)} title="Ouvrir le sujet">
                        <FileText size={17} className="mc-row__icon" aria-hidden />
                        <span className="mc-row__title">{title}</span>
                        {detail && <span className="an-row__detail">{detail}</span>}
                      </button>
                      <span className="an-row__meta">
                        {view === 'programme' && <span className="an-row__year">{b.annee}</span>}
                        {showPoints && b.points > 0 && <span className="an-row__pts">{b.points} pts</span>}
                      </span>
                      <MoreMenu
                        compact
                        title={`Actions du sujet ${title}`}
                        items={[
                          { label: 'Ouvrir dans un onglet', onClick: () => onNewTab(b) },
                          { label: 'Copier le lien', onClick: () => onCopyLink(b), title: 'Lien direct vers le PDF, à coller dans un message ou sur l’ENT' },
                          ...(b.isCustom ? [{ label: 'Supprimer', onClick: () => onDelete(b), danger: true }] : []),
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
