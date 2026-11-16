/**
 * Bibliothèque de « Mes TP » : niveau › séquence › TP, sur le modèle de « Mes cours ».
 * Une ligne montre ce qui sert à choisir (titre, durée, points, séances déjà faites) ; le reste
 * est dans la fiche du TP ou son menu « ⋯ ».
 */
import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import type { TpLevel } from '../../lib/tpLibrary';
import { activityLabel, formatPoints, totalPoints } from '../../lib/tpLibrary';
import type { Tp } from '../../lib/tpQueries';
import { MoreMenu } from '../MoreMenu';

const COLLAPSED_KEY = 'mes-tp-collapsed';
const NO_LEVEL = 'Sans niveau';

function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
}

interface Props {
  levels: TpLevel<Tp>[];
  /** Recherche ou filtre en cours : tout est déplié, sans toucher au choix mémorisé. */
  expandAll?: boolean;
  onOpen: (tp: Tp) => void;
  onEdit: (tp: Tp) => void;
  onDuplicate: (tp: Tp) => void;
  onPrint: (tp: Tp) => void;
  onDelete: (tp: Tp) => void;
}

export function TpLibrary({ levels, expandAll, onOpen, onEdit, onDuplicate, onPrint, onDelete }: Props) {
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
      {levels.map(({ level, count, sequences }) => {
        const key = level ?? NO_LEVEL;
        const open = expandAll || !collapsed[key];
        const named = sequences.some((s) => s.chapter !== '');
        return (
          <section key={key} className="mc-level">
            <button type="button" className="mc-level__head" onClick={() => toggle(key)} aria-expanded={open}>
              <ChevronDown size={16} className="mc-level__chevron" aria-hidden />
              <span className="mc-level__name">{key}</span>
              <span className="mc-level__count">{count} TP</span>
            </button>
            {open && sequences.map(({ chapter, items }) => (
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
