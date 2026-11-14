/**
 * Vue « Par classe » de « Mes cours » (lot C4 de PLAN_mes_cours.md) : les documents placés sur les
 * cours d'une classe, à venir puis passés. Un cours joué en séance ouvre son tableau de fin de
 * séance (pages annotées, export PDF pour les absents). « Voir les autres classes » montre la même
 * activité dans toutes les classes qui en ont une copie.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, Play, Presentation } from 'lucide-react';
import { classTone } from '../../lib/classColors';
import {
  NO_CLASS,
  buildTimeline,
  classesWithDocuments,
  documentsOfActivity,
  documentsOfClass,
  formatSlot,
  type ClassRef,
  type DocumentSession,
  type PlacedDocument,
  type TimelineEntry,
} from '../../lib/coursePlacements';
import type { OpenMode } from '../../lib/courseLibrary';
import { BoardPagesGallery } from '../classroom/BoardPagesGallery';
import { MoreMenu } from '../MoreMenu';

interface Props {
  documents: PlacedDocument[];
  classes: ClassRef[];
  /** Nom des demi-groupes, par identifiant. */
  groupNames: Map<string, string>;
  /** Séances parties de chaque document, par identifiant de tableau. */
  sessions: Map<string, DocumentSession[]>;
  /** Classe demandée par l'adresse (identifiant, ou `NO_CLASS`) ; null : la première qui a des documents. */
  classKey: string | null;
  /** Original dont on regarde toutes les copies, ou null. */
  activity: string | null;
  /** Titre de cet original, s'il est encore dans la bibliothèque. */
  activityTitle: string | null;
  onClass: (key: string) => void;
  onActivity: (sourceBoardId: string | null) => void;
  onOpen: (boardId: string, mode?: OpenMode) => void;
}

export function ClassCourses({ documents, classes, groupNames, sessions, classKey, activity, activityTitle, onClass, onActivity, onOpen }: Props) {
  /** Document dont le tableau de fin de séance est déplié. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const classNames = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const tabs = useMemo(() => classesWithDocuments(documents, classes), [documents, classes]);

  const validKey = classKey !== null && (tabs.classes.some((c) => c.id === classKey) || (classKey === NO_CLASS && tabs.other));
  const shownKey = validKey ? classKey : tabs.classes[0]?.id ?? (tabs.other ? NO_CLASS : null);

  const now = useMemo(() => new Date(), []);
  const timeline = useMemo(() => {
    const list = activity ? documentsOfActivity(documents, activity) : shownKey ? documentsOfClass(documents, shownKey, classes) : [];
    return buildTimeline(list, sessions, now);
  }, [activity, documents, shownKey, classes, sessions, now]);

  /** Originaux placés dans plus d'une classe : « Voir les autres classes » n'est proposé que pour eux. */
  const shared = useMemo(() => {
    const perSource = new Map<string, Set<string>>();
    for (const d of documents) {
      if (!d.sourceBoardId) continue;
      const set = perSource.get(d.sourceBoardId) ?? new Set<string>();
      set.add(d.classId ?? d.label);
      perSource.set(d.sourceBoardId, set);
    }
    return new Set([...perSource.entries()].filter(([, set]) => set.size > 1).map(([source]) => source));
  }, [documents]);

  if (documents.length === 0) {
    return (
      <div className="mc-empty">
        Aucun document n’est placé sur un cours. Depuis la bibliothèque : « ⋯ » d’un cours, puis « Placer sur un cours… ».
      </div>
    );
  }

  const nameOf = (d: PlacedDocument) => (d.classId && classNames.get(d.classId)) || d.label;

  const row = ({ doc, session }: TimelineEntry) => {
    const isOpen = expanded === doc.boardId;
    const group = doc.groupId ? groupNames.get(doc.groupId) : undefined;
    const tone = classTone(nameOf(doc));
    return (
      <li key={doc.boardId} className="mc-doc">
        <div className="mc-row">
          <span className="mc-doc__when">{formatSlot(doc.startsAt)}{group ? ` · ${group}` : ''}</span>
          {activity && <span className="mc-chip mc-chip--static" style={{ background: tone.soft, color: tone.ink }}>{nameOf(doc)}</span>}
          <button type="button" className="mc-row__open" onClick={() => onOpen(doc.boardId)} title={doc.isCourse ? 'Ouvrir le cours de cette classe' : 'Ouvrir le tableau de cette classe'}>
            {doc.isCourse
              ? <FileText size={17} className="mc-row__icon" aria-label="Cours rédigé" />
              : <Presentation size={17} className="mc-row__icon" aria-label="Tableau blanc" />}
            <span className="mc-row__title">{doc.title}</span>
          </button>
          {session && (
            <button
              type="button"
              className="mc-doc__session"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : doc.boardId)}
              title="Les pages du tableau telles qu’elles étaient à la fin de la séance"
            >
              Fin de séance
              <ChevronDown size={14} aria-hidden style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
            </button>
          )}
          {doc.isCourse && (
            <button type="button" className="mc-row__play" onClick={() => onOpen(doc.boardId, 'classe')} title="Essayer en classe (rien n'est gardé en quittant)" aria-label={`Essayer ${doc.title} en classe`}>
              <Play size={15} aria-hidden />
            </button>
          )}
          {!activity && doc.sourceBoardId && shared.has(doc.sourceBoardId) && (
            <MoreMenu
              compact
              title={`Actions de ${doc.title}`}
              items={[{ label: 'Voir les autres classes', onClick: () => onActivity(doc.sourceBoardId), title: 'La même activité dans toutes les classes où elle est placée' }]}
            />
          )}
        </div>
        {isOpen && session && (
          <div className="mc-doc__gallery">
            <BoardPagesGallery
              sessionId={session.sessionId}
              exportName={`${nameOf(doc)} ${doc.title}`}
              emptyText="Cette séance n’a laissé aucune page de tableau."
            />
          </div>
        )}
      </li>
    );
  };

  const section = (label: string, entries: TimelineEntry[]) => entries.length > 0 && (
    <section className="mc-level" aria-label={label}>
      <div className="mc-seq__head"><span className="mc-seq__name">{label}</span></div>
      <ul className="mc-rows">{entries.map(row)}</ul>
    </section>
  );

  return (
    <div className="mc-levels">
      {activity ? (
        <div className="mc-activity">
          <button type="button" className="btn btn--ghost" onClick={() => onActivity(null)}>
            <ArrowLeft size={15} aria-hidden /> Par classe
          </button>
          <span className="mc-activity__title">{activityTitle ?? timeline.upcoming[0]?.doc.title ?? timeline.past[0]?.doc.title ?? 'Activité'}</span>
        </div>
      ) : (
        <div className="mc-place__classes" role="tablist" aria-label="Classe">
          {tabs.classes.map((c) => {
            const tone = classTone(c.name);
            const on = c.id === shownKey;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                className="mc-place__class"
                style={{ background: on ? tone.soft : 'var(--surface)', color: on ? tone.ink : 'var(--text)', borderColor: on ? tone.solid : 'var(--border)' }}
                onClick={() => { setExpanded(null); onClass(c.id); }}
              >
                {c.name}
              </button>
            );
          })}
          {tabs.other && (
            <button
              type="button"
              role="tab"
              aria-selected={shownKey === NO_CLASS}
              className="mc-place__class"
              style={shownKey === NO_CLASS ? { background: 'var(--surface-2)', borderColor: 'var(--text-muted)' } : { background: 'var(--surface)' }}
              onClick={() => { setExpanded(null); onClass(NO_CLASS); }}
              title="Documents dont la classe est inconnue ou a été supprimée"
            >
              Sans classe
            </button>
          )}
        </div>
      )}

      {section('À venir', timeline.upcoming)}
      {section('Passé', timeline.past)}
    </div>
  );
}
