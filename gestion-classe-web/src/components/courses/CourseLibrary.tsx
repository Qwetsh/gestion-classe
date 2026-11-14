/**
 * Bibliothèque de « Mes cours » : les originaux, rangés niveau › séquence › activité.
 * Une ligne ne montre que ce qui sert à choisir (type, titre, essai en classe) ; le reste est
 * dans son menu « ⋯ ». Lot C1 de PLAN_mes_cours.md.
 */
import { useState } from 'react';
import { ChevronDown, FileText, Play, Presentation } from 'lucide-react';
import { NO_LEVEL, type Board } from '../../lib/boardsQueries';
import type { LibraryLevel } from '../../lib/courseLibrary';
import { MoreMenu } from '../MoreMenu';

const COLLAPSED_KEY = 'mes-cours-collapsed';

function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
}

interface Props {
  levels: LibraryLevel[];
  onOpen: (board: Board) => void;
  /** Cours rédigé : l'essayer en classe (rien n'est gardé en quittant). */
  onPresent: (board: Board) => void;
  onEdit: (board: Board) => void;
  onDuplicate: (board: Board) => void;
  onSaveAsTemplate: (board: Board) => void;
  onDelete: (board: Board) => void;
  onRenameSequence: (level: string | null, from: string, to: string) => Promise<void>;
}

export function CourseLibrary({ levels, onOpen, onPresent, onEdit, onDuplicate, onSaveAsTemplate, onDelete, onRenameSequence }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  /** Séquence en cours de renommage : son niveau, son nom d'origine, la saisie. */
  const [renaming, setRenaming] = useState<{ level: string | null; from: string; value: string; busy: boolean } | null>(null);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  const commitRename = async () => {
    if (!renaming || renaming.busy) return;
    const to = renaming.value.trim();
    if (!to || to === renaming.from) { setRenaming(null); return; }
    setRenaming({ ...renaming, busy: true });
    try { await onRenameSequence(renaming.level, renaming.from, to); }
    finally { setRenaming(null); }
  };

  return (
    <div className="mc-levels">
      {levels.map(({ level, count, sequences }) => {
        const key = level ?? NO_LEVEL;
        const open = !collapsed[key];
        const named = sequences.some((s) => s.chapter !== '');
        return (
          <section key={key} className="mc-level">
            <button type="button" className="mc-level__head" onClick={() => toggle(key)} aria-expanded={open}>
              <ChevronDown size={16} className="mc-level__chevron" aria-hidden />
              <span className="mc-level__name">{key}</span>
              <span className="mc-level__count">{count}</span>
            </button>
            {open && sequences.map(({ chapter, boards }) => {
              const isRenaming = renaming !== null && renaming.level === level && renaming.from === chapter;
              return (
                <div key={chapter || '—'} className="mc-seq">
                  {/* Sans séquence : un titre seulement s'il faut distinguer ces cours des séquences voisines */}
                  {(chapter || named) && (
                    <div className="mc-seq__head">
                      {isRenaming ? (
                        <input
                          className="mc-seq__input"
                          value={renaming.value}
                          autoFocus
                          disabled={renaming.busy}
                          aria-label={`Nouveau nom de la séquence ${chapter}`}
                          onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                          onBlur={() => void commitRename()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
                            if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
                          }}
                        />
                      ) : (
                        <>
                          <span className="mc-seq__name">{chapter || 'Sans séquence'}</span>
                          {chapter && (
                            <span className="mc-seq__menu">
                              <MoreMenu
                                compact
                                title={`Actions de la séquence ${chapter}`}
                                items={[{ label: 'Renommer la séquence', onClick: () => setRenaming({ level, from: chapter, value: chapter, busy: false }) }]}
                              />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <ul className="mc-rows">
                    {boards.map((b) => (
                      <li key={b.id} className="mc-row">
                        <button type="button" className="mc-row__open" onClick={() => onOpen(b)} title={b.is_course ? 'Ouvrir le cours' : 'Ouvrir le tableau blanc'}>
                          {b.is_course
                            ? <FileText size={17} className="mc-row__icon" aria-label="Cours rédigé" />
                            : <Presentation size={17} className="mc-row__icon" aria-label="Tableau blanc" />}
                          <span className="mc-row__title">{b.title}</span>
                        </button>
                        {b.is_course && (
                          <button type="button" className="mc-row__play" onClick={() => onPresent(b)} title="Essayer en classe (rien n'est gardé en quittant)" aria-label={`Essayer ${b.title} en classe`}>
                            <Play size={15} aria-hidden />
                          </button>
                        )}
                        <MoreMenu
                          compact
                          title={`Actions de ${b.title}`}
                          items={[
                            { label: 'Dupliquer', onClick: () => onDuplicate(b) },
                            ...(b.is_course ? [{ label: 'Enregistrer comme modèle', onClick: () => onSaveAsTemplate(b), title: 'Proposé ensuite à la création d\'un cours' }] : []),
                            { label: 'Renommer, ranger', onClick: () => onEdit(b), title: 'Titre, niveau, séquence' },
                            { label: 'Supprimer', onClick: () => onDelete(b), danger: true },
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
