/**
 * Liste des annales d'une matière : un onglet par section (thème du programme ou session), une
 * ligne par sujet, sur le modèle de « Mes cours ». La ligne ouvre le sujet ; le reste est dans « ⋯ ».
 */
import { FileText } from 'lucide-react';
import type { AnnaleSection, AnnaleView } from '../../lib/annalesLibrary';
import { annaleLabel } from '../../lib/annalesLibrary';
import type { BrevetItem } from '../../lib/customAnnales';
import { pickedOrFirst } from '../../lib/tabChoice';
import { LevelTabs } from '../LevelTabs';
import { MoreMenu } from '../MoreMenu';
import { useTabChoice } from '../useTabChoice';

/** Onglet choisi la dernière fois, gardé à part pour chaque matière et chaque rangement. */
const SECTION_TAB_KEY = 'annales-onglet';
const countLabel = (count: number) => `${count} sujet${count > 1 ? 's' : ''}`;

interface Props {
  /** Liste dont l'onglet est mémorisé (matière + vue). */
  scope: string;
  sections: AnnaleSection<BrevetItem>[];
  view: AnnaleView;
  /** Les points ne s'affichent que s'ils changent d'un sujet à l'autre. */
  showPoints: boolean;
  /** Recherche en cours : toutes les sections sont montrées l'une sous l'autre, sans onglets ni toucher au choix mémorisé. */
  expandAll?: boolean;
  onOpen: (b: BrevetItem) => void;
  onNewTab: (b: BrevetItem) => void;
  onCopyLink: (b: BrevetItem) => void;
  onDelete: (b: BrevetItem) => void;
}

export function AnnaleList({ scope, sections, view, showPoints, expandAll, onOpen, onNewTab, onCopyLink, onDelete }: Props) {
  // Un onglet par section : une seule à l'écran, la dernière choisie étant mémorisée
  const [picked, pick] = useTabChoice(SECTION_TAB_KEY, scope);
  const tabbed = !expandAll && sections.length > 1;
  const current = pickedOrFirst(sections, picked, (s) => s.key);
  const shownSections = expandAll ? sections : current ? [current] : [];

  return (
    <div className="mc-levels">
      {shownSections.map(({ key, label, items }) => {
        const id = `${scope}:${key}`;
        return (
          <section key={id} className="mc-level" aria-label={label}>
            {tabbed ? (
              <LevelTabs
                label={view === 'programme' ? 'Thème' : 'Session'}
                tabs={sections.map((s) => ({ key: s.key, label: s.label, count: s.items.length, countTitle: countLabel(s.items.length) }))}
                selected={key}
                onSelect={pick}
              />
            ) : (
              <div className="mc-level__head">
                <span className="mc-level__name">{label}</span>
                <span className="mc-level__count">{countLabel(items.length)}</span>
              </div>
            )}
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
          </section>
        );
      })}
    </div>
  );
}
