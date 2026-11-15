/**
 * Bibliothèque de « Mes cours » : les originaux, rangés niveau › séquence › activité.
 * Une ligne ne montre que ce qui sert à choisir (type, titre, essai en classe) ; le reste est
 * dans son menu « ⋯ ». Lot C1 de PLAN_mes_cours.md.
 * Une activité et sa correction (et ses documents) tiennent sur une seule ligne : le titre de
 * l'activité, puis un bouton par original, avec ses classes et son essai en classe.
 */
import { useRef, useState } from 'react';
import { ChevronDown, FileText, Play, Presentation } from 'lucide-react';
import { NO_LEVEL, type Board } from '../../lib/boardsQueries';
import { classTone } from '../../lib/classColors';
import { ACCEPTED_FILES, filesOfSequence, sequenceKey, type CourseFile } from '../../lib/courseFiles';
import { groupActivities, VARIANT_LABEL, type CourseVariant, type LibraryLevel } from '../../lib/courseLibrary';
import { formatSlot, type PlacementChip } from '../../lib/coursePlacements';
import { MoreMenu, type MoreMenuItem } from '../MoreMenu';
import { SequenceFiles } from './SequenceFiles';

const COLLAPSED_KEY = 'mes-cours-collapsed';

function readCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
}

interface Props {
  levels: LibraryLevel[];
  /** Recherche en cours : tous les niveaux sont dépliés, sans toucher au choix mémorisé. */
  expandAll?: boolean;
  /** Classes où chaque original est placé (par identifiant d'original). */
  chips: Map<string, PlacementChip[]>;
  /** Ouvrir la copie d'une classe (pastille). */
  onOpenCopy: (boardId: string) => void;
  onPlace: (board: Board) => void;
  onOpen: (board: Board) => void;
  /** Cours rédigé : l'essayer en classe (rien n'est gardé en quittant). */
  onPresent: (board: Board) => void;
  onEdit: (board: Board) => void;
  onDuplicate: (board: Board) => void;
  onSaveAsTemplate: (board: Board) => void;
  onDelete: (board: Board) => void;
  onRenameSequence: (level: string | null, from: string, to: string) => Promise<void>;
  /** Fichiers des séquences (lot F1) ; null : le stockage des fichiers n'est pas disponible. */
  files: SequenceFilesApi | null;
}

export interface SequenceFilesApi {
  list: CourseFile[];
  /** Séquence qui reçoit un envoi en ce moment (`sequenceKey`), ou null. */
  uploadingKey: string | null;
  onAdd: (level: string | null, chapter: string, files: File[]) => void;
  onOpen: (file: CourseFile) => void;
  onDownload: (file: CourseFile) => void;
  onRename: (file: CourseFile, name: string) => Promise<void>;
  onDelete: (file: CourseFile) => void;
}


export function CourseLibrary({ levels, expandAll, chips, onOpenCopy, onPlace, onOpen, onPresent, onEdit, onDuplicate, onSaveAsTemplate, onDelete, onRenameSequence, files }: Props) {
  /** Sélecteur de fichiers unique : la séquence visée est notée au moment du clic. */
  const fileInput = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<{ level: string | null; chapter: string } | null>(null);
  /** Séquence survolée par des fichiers que l'on glisse. */
  const [dropKey, setDropKey] = useState<string | null>(null);

  const pickFiles = (level: string | null, chapter: string) => {
    fileTarget.current = { level, chapter };
    fileInput.current?.click();
  };
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

  /** Classes où l'original est placé ; `variant` précise, dans une activité, de quel original il s'agit. */
  const renderChips = (b: Board, variant?: CourseVariant) => {
    const list = chips.get(b.id) ?? [];
    if (list.length === 0) return null;
    const what = variant && variant !== 'fiche' ? ` (${VARIANT_LABEL[variant].toLowerCase()})` : '';
    return (
      <span className="mc-row__chips">
        {list.map((chip) => {
          const tone = classTone(chip.name);
          return (
            <button
              key={chip.key}
              type="button"
              className="mc-chip"
              style={{ background: tone.soft, color: tone.ink }}
              onClick={() => onOpenCopy(chip.boardId)}
              title={[`Ouvrir la copie de ${chip.name}${what}`, ...chip.dates.map(formatSlot)].join(' · ')}
              aria-label={`Ouvrir la copie de ${chip.name}${what}`}
            >
              {chip.name}
            </button>
          );
        })}
      </span>
    );
  };

  /** Actions d'un original ; dans une activité, rangées sous l'intitulé de son rôle. */
  const menuItems = (b: Board, group?: string): MoreMenuItem[] => [
    { label: 'Placer sur un cours…', onClick: () => onPlace(b), title: 'Poser une copie sur des cours à venir', group },
    { label: 'Dupliquer', onClick: () => onDuplicate(b), group },
    ...(b.is_course ? [{ label: 'Enregistrer comme modèle', onClick: () => onSaveAsTemplate(b), title: 'Proposé ensuite à la création d\'un cours', group }] : []),
    { label: 'Renommer, ranger', onClick: () => onEdit(b), title: 'Titre, niveau, séquence', group },
    { label: 'Supprimer', onClick: () => onDelete(b), danger: true, group },
  ];

  const kindIcon = (b: Board) => (b.is_course
    ? <FileText size={17} className="mc-row__icon" aria-label="Cours rédigé" />
    : <Presentation size={17} className="mc-row__icon" aria-label="Tableau blanc" />);

  return (
    <div className="mc-levels">
      {files && (
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_FILES}
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = '';
            const target = fileTarget.current;
            if (target && picked.length > 0) files.onAdd(target.level, target.chapter, picked);
          }}
        />
      )}
      {levels.map(({ level, count, sequences }) => {
        const key = level ?? NO_LEVEL;
        const open = expandAll || !collapsed[key];
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
              const seqKey = sequenceKey(level, chapter);
              // Une séquence nommée accepte des fichiers : par son menu, ou glissés dessus
              const acceptsFiles = files !== null && chapter !== '';
              return (
                <div
                  key={chapter || '—'}
                  className={`mc-seq${dropKey === seqKey ? ' mc-seq--drop' : ''}`}
                  onDragOver={acceptsFiles ? (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropKey(seqKey); } } : undefined}
                  onDragLeave={acceptsFiles ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropKey(null); } : undefined}
                  onDrop={acceptsFiles ? (e) => {
                    e.preventDefault();
                    setDropKey(null);
                    const dropped = [...e.dataTransfer.files];
                    if (dropped.length > 0) files.onAdd(level, chapter, dropped);
                  } : undefined}
                >
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
                                items={[
                                  ...(files ? [{ label: 'Ajouter un fichier…', onClick: () => pickFiles(level, chapter), title: 'PDF, image, son ou document, 20 Mo au plus. On peut aussi glisser un fichier sur la séquence.' }] : []),
                                  { label: 'Renommer la séquence', onClick: () => setRenaming({ level, from: chapter, value: chapter, busy: false }) },
                                ]}
                              />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <ul className="mc-rows">
                    {groupActivities(boards).map(({ key: groupKey, title, members }) => {
                      if (members.length === 1) {
                        // Original seul (correction orpheline comprise) : son titre complet
                        const b = members[0].board;
                        return (
                          <li key={groupKey} className="mc-row">
                            <button type="button" className="mc-row__open" onClick={() => onOpen(b)} title={b.is_course ? 'Ouvrir le cours' : 'Ouvrir le tableau blanc'}>
                              {kindIcon(b)}
                              <span className="mc-row__title">{b.title}</span>
                            </button>
                            {renderChips(b)}
                            {b.is_course && (
                              <button type="button" className="mc-row__play" onClick={() => onPresent(b)} title="Essayer en classe (rien n'est gardé en quittant)" aria-label={`Essayer ${b.title} en classe`}>
                                <Play size={15} aria-hidden />
                              </button>
                            )}
                            <MoreMenu compact title={`Actions de ${b.title}`} items={menuItems(b)} />
                          </li>
                        );
                      }
                      // Activité : son titre ouvre la fiche (à défaut, le premier original)
                      const first = members[0];
                      return (
                        <li key={groupKey} className="mc-row mc-row--activity">
                          <button type="button" className="mc-row__open" onClick={() => onOpen(first.board)} title={`Ouvrir ${first.board.title}`}>
                            {kindIcon(first.board)}
                            <span className="mc-row__title">{title}</span>
                          </button>
                          <span className="mc-variants">
                            {members.map(({ variant, board: b }) => (
                              <span key={b.id} className={`mc-variant mc-variant--${variant}`}>
                                <button type="button" className="mc-variant__open" onClick={() => onOpen(b)} title={`Ouvrir ${b.title}`}>
                                  {VARIANT_LABEL[variant]}
                                </button>
                                {renderChips(b, variant)}
                                {b.is_course && (
                                  <button type="button" className="mc-variant__play" onClick={() => onPresent(b)} title="Essayer en classe (rien n'est gardé en quittant)" aria-label={`Essayer ${b.title} en classe`}>
                                    <Play size={13} aria-hidden />
                                  </button>
                                )}
                              </span>
                            ))}
                          </span>
                          <MoreMenu
                            compact
                            title={`Actions de ${title}`}
                            items={members.flatMap(({ variant, board: b }) => menuItems(b, VARIANT_LABEL[variant]))}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  {acceptsFiles && (
                    <SequenceFiles
                      files={filesOfSequence(files.list, level, chapter)}
                      uploading={files.uploadingKey === seqKey}
                      onOpen={files.onOpen}
                      onDownload={files.onDownload}
                      onRename={files.onRename}
                      onDelete={files.onDelete}
                    />
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
