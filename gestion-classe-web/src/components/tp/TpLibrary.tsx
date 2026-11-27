/**
 * Bibliothèque de « Mes TP » : niveau › séquence › TP, sur le modèle de « Mes cours ».
 * Une ligne montre ce qui sert à choisir (titre, durée, points, séances déjà faites) ; le reste
 * est dans la fiche du TP ou son menu « ⋯ ».
 */
import { FlaskConical } from 'lucide-react';
import { classTone } from '../../lib/classColors';
import { levelOnTab } from '../../lib/courseLibrary';
import type { TpLevel } from '../../lib/tpLibrary';
import { activityLabel, formatPoints, totalPoints } from '../../lib/tpLibrary';
import type { Tp } from '../../lib/tpQueries';
import { LevelTabs } from '../LevelTabs';
import { MoreMenu } from '../MoreMenu';
import { useTabChoice } from '../useTabChoice';

/** Onglet de niveau choisi la dernière fois. */
const LEVEL_TAB_KEY = 'mes-tp-niveau';
const NO_LEVEL = 'Sans niveau';
const levelName = (level: string | null) => level ?? NO_LEVEL;
const countLabel = (count: number) => `${count} TP`;

interface Props {
  levels: TpLevel<Tp>[];
  /** Recherche en cours : tous les niveaux sont montrés l'un sous l'autre, sans onglets ni toucher au choix mémorisé. */
  expandAll?: boolean;
  onOpen: (tp: Tp) => void;
  onEdit: (tp: Tp) => void;
  onDuplicate: (tp: Tp) => void;
  onPrint: (tp: Tp) => void;
  onDelete: (tp: Tp) => void;
}

export function TpLibrary({ levels, expandAll, onOpen, onEdit, onDuplicate, onPrint, onDelete }: Props) {
  // Onglets de niveau : un seul niveau à l'écran, le dernier choisi étant mémorisé
  const [pickedLevel, pickLevel] = useTabChoice(LEVEL_TAB_KEY, 'tp');
  const tabbed = !expandAll && levels.length > 1;
  const current = levelOnTab(levels, pickedLevel, levelName);
  const shownLevels = expandAll ? levels : current ? [current] : [];

  return (
    <div className="mc-levels">
      {shownLevels.map(({ level, count, sequences }) => {
        const key = levelName(level);
        const named = sequences.some((s) => s.chapter !== '');
        return (
          <section key={key} className="mc-level" aria-label={key}>
            {tabbed ? (
              <LevelTabs
                label="Niveau"
                tabs={levels.map((l) => { const name = levelName(l.level); return { key: name, label: name, count: l.count, countTitle: countLabel(l.count), tone: classTone(name).solid }; })}
                selected={key}
                onSelect={pickLevel}
              />
            ) : (
              <div className="mc-level__head">
                <span className="mc-level__name">{key}</span>
                <span className="mc-level__count">{countLabel(count)}</span>
              </div>
            )}
            {sequences.map(({ chapter, items }) => (
              <div key={chapter || '—'} className="mc-seq">
                {(chapter || named) && (
                  <div className="mc-seq__head">
                    <span className="mc-seq__name">{chapter || 'Sans séquence'}</span>
                  </div>
                )}
                <ul className="mc-rows">
                  {items.map((tp) => {
                    const points = totalPoints(tp.criteria);
                    return (
                      <li key={tp.id} className="mc-row">
                        <button type="button" className="mc-row__open" onClick={() => onOpen(tp)} title="Ouvrir la fiche du TP">
                          <FlaskConical size={17} className="mc-row__icon" aria-hidden />
                          <span className="mc-row__title">{tp.name}</span>
                        </button>
                        <span className="tp-row__meta">
                          {tp.usage_count > 0 && (
                            <span className="tp-row__used" title="Séances de groupe lancées avec ce TP">
                              {tp.usage_count} séance{tp.usage_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {tp.activity && <span className="tp-row__act">{activityLabel(tp.activity)}</span>}
                          {tp.duration_min ? <span className="tp-row__dur">{tp.duration_min} min</span> : null}
                          {points > 0 && <span className="tp-row__pts" title={`${tp.criteria.length} critère${tp.criteria.length > 1 ? 's' : ''}`}>{formatPoints(points)} pts</span>}
                        </span>
                        <MoreMenu
                          compact
                          title={`Actions de ${tp.name}`}
                          items={[
                            { label: 'Modifier', onClick: () => onEdit(tp) },
                            { label: 'Imprimer la fiche', onClick: () => onPrint(tp), title: 'Problématique, matériel, protocole, sécurité et barème sur une page' },
                            { label: 'Dupliquer', onClick: () => onDuplicate(tp) },
                            { label: 'Supprimer', onClick: () => onDelete(tp), danger: true },
                          ]}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
