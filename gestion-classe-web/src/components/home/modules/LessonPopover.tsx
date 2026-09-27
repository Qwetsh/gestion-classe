import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useHomeData } from '../HomeDataContext';
import { formatTime, getInitials, shortGroup } from '../homeHelpers';
import { sameDay, type PlacedLesson } from '../../../lib/timetable/weekView';
import type { WeekSession } from '../../../lib/timetable/enrichmentQueries';
import { noteForLesson } from '../../../lib/timetable/lessonNotesQueries';
import { useUIFeedback } from '../../../contexts/UIFeedbackContext';

const POPOVER_WIDTH = 300;
const MARGIN = 8;

/**
 * Détail d'un cours de l'emploi du temps (lot 3 de PLAN_accueil_v2.md) : ce que l'application
 * sait et que Pronote ignore — séance enregistrée, dernier tableau projeté, élèves à surveiller —
 * et les raccourcis qui vont avec.
 */
export function LessonPopover({
  lesson, session, anchor, now, color, onClose, onManageLinks,
}: {
  lesson: PlacedLesson;
  /** séance rattachée à ce cours (cf. assignSessions) */
  session: WeekSession | null;
  anchor: DOMRect;
  now: Date;
  color: string;
  onClose: () => void;
  onManageLinks: () => void;
}) {
  const { lastBoardByClass, alertsByClass, openBoard, lessonNotes, saveNote, setNoteDone } = useHomeData();
  const { toast } = useUIFeedback();
  const ref = useRef<HTMLDivElement>(null);

  // Note pour ce cours (indépendante de la séance : rien n'est créé dans sessions)
  const note = noteForLesson(lessonNotes, lesson);
  const [draft, setDraft] = useState(note?.content ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitNote = async (content: string) => {
    setSaving(true);
    try {
      await saveNote(lesson, content);
      setDraft(content.trim());
      setEditing(false);
    } catch (err) {
      console.error(err);
      toast('Impossible d’enregistrer la note.');
    } finally {
      setSaving(false);
    }
  };

  // À droite du cours s'il y a la place, sinon à gauche ; toujours dans la fenêtre.
  // Mesure après rendu, appliquée directement au style (pas de second rendu).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.right + MARGIN;
    if (left + POPOVER_WIDTH > vw - MARGIN) left = anchor.left - POPOVER_WIDTH - MARGIN;
    left = Math.max(MARGIN, Math.min(left, vw - POPOVER_WIDTH - MARGIN));
    const top = Math.max(MARGIN, Math.min(anchor.top, vh - h - MARGIN));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchor]);

  // Fermeture : Échap, clic ailleurs, défilement ou redimensionnement (l'ancre bouge)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target) || target.closest('.wtt__lesson')) return;
      // Une note en cours de frappe ne se perd pas sur un clic malheureux
      if (ref.current?.querySelector('textarea:focus')) return;
      onClose();
    };
    const onMove = () => onClose();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [onClose]);

  const past = lesson.end < now;
  const current = lesson.start <= now && lesson.end > now;
  const canceled = lesson.status === 'canceled';
  const lastBoard = lesson.classId ? lastBoardByClass.get(lesson.classId) : undefined;
  const alerts = lesson.classId ? (alertsByClass.get(lesson.classId) ?? []).slice(0, 3) : [];
  const alertTotal = lesson.classId ? (alertsByClass.get(lesson.classId)?.length ?? 0) : 0;

  const title = lesson.className
    ? lesson.groupName ? `${lesson.className} · ${shortGroup(lesson.groupName)}` : lesson.className
    : lesson.label;
  const day = lesson.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const when = sameDay(lesson.start, now) ? "Aujourd'hui" : day.charAt(0).toUpperCase() + day.slice(1);

  // Portail : un ancêtre transformé (grille de l'accueil) fausserait le position: fixed
  return createPortal(
    <div
      ref={ref}
      className="wtt-pop"
      role="dialog"
      aria-label={`Cours ${title}`}
      style={{ left: -9999, top: -9999, width: POPOVER_WIDTH, ['--lesson-color' as string]: color }}
    >
      <div className="wtt-pop__head">
        <div style={{ minWidth: 0 }}>
          <div className="wtt-pop__title">
            {title}
            {current && <span className="wtt__badge wtt__badge--live">En cours</span>}
            {canceled && <span className="wtt__badge wtt__badge--neg">Annulé</span>}
            {lesson.status === 'modified' && <span className="wtt__badge">Modifié</span>}
          </div>
          <div className="wtt-pop__sub">
            {when} · {formatTime(lesson.start)} – {formatTime(lesson.end)}
            {lesson.room && <> · {lesson.room}</>}
          </div>
          {lesson.subject && <div className="wtt-pop__sub" style={{ textTransform: 'capitalize' }}>{lesson.subject.toLowerCase()}</div>}
        </div>
        <button type="button" className="wtt-pop__close" onClick={onClose} aria-label="Fermer">×</button>
      </div>

      {!lesson.classId ? (
        <div className="wtt-pop__section">
          <p className="wtt-pop__muted">Ce cours n'est relié à aucune de vos classes.</p>
          <button type="button" className="wtt__link" onClick={onManageLinks}>Modifier la correspondance</button>
        </div>
      ) : (
        <>
          {session ? (
            <div className="wtt-pop__section">
              <div className="wtt-pop__label">Séance enregistrée</div>
              <div className="wtt-pop__topic">{session.topic ?? 'Sans sujet renseigné'}</div>
              <div className="wtt-pop__counts">
                <span className="wtt__count wtt__count--pos">+{session.pos} bonus</span>
                <span className="wtt__count wtt__count--neg">−{session.neg} malus</span>
                <span className="wtt__count">{session.abs} abs.</span>
              </div>
              <Link to={`/sessions/${session.id}`} className="wtt-pop__action">Voir la séance →</Link>
            </div>
          ) : past && !canceled ? (
            <div className="wtt-pop__section">
              <p className="wtt-pop__muted">Aucune séance enregistrée sur ce créneau.</p>
            </div>
          ) : null}

          {/* Note pour ce cours : rédigée à l'avance, rappelée au moment du cours (accueil + téléphone) */}
          {!canceled && (note || !past) && (
            <div className={`wtt-pop__section ${note && !note.done && current ? 'wtt-pop__section--note-live' : ''}`}>
              <div className="wtt-pop__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Note pour ce cours</span>
                {note && !editing && (
                  <button
                    type="button"
                    className="wtt__link"
                    onClick={() => setNoteDone(note, !note.done).catch(() => toast('Impossible de mettre à jour la note.'))}
                    title={note.done ? 'Remettre en avant' : 'Ne plus mettre en avant'}
                  >
                    {note.done ? 'Réactiver' : '✓ Vu'}
                  </button>
                )}
              </div>
              {editing || (!note && !past) ? (
                <>
                  <textarea
                    className="wtt-pop__note-input"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Ex. : rendre les copies, interro 10 min, faire passer Léa à l’oral…"
                    rows={3}
                    autoFocus={editing}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitNote(draft); }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {(editing || draft.trim()) && (
                      <button type="button" className="wtt-pop__btn" onClick={() => { setDraft(note?.content ?? ''); setEditing(false); }} disabled={saving}>
                        Annuler
                      </button>
                    )}
                    {note && editing && (
                      <button type="button" className="wtt-pop__btn" onClick={() => submitNote('')} disabled={saving} title="Supprimer la note">
                        Supprimer
                      </button>
                    )}
                    <button
                      type="button"
                      className="wtt-pop__btn wtt-pop__btn--primary"
                      onClick={() => submitNote(draft)}
                      disabled={saving || draft.trim() === (note?.content ?? '')}
                    >
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </>
              ) : note ? (
                <>
                  <div className={`wtt-pop__note ${note.done ? 'wtt-pop__note--done' : ''}`}>{note.content}</div>
                  {!past && (
                    <button type="button" className="wtt__link" style={{ alignSelf: 'flex-start' }} onClick={() => { setDraft(note.content); setEditing(true); }}>
                      Modifier
                    </button>
                  )}
                </>
              ) : null}
            </div>
          )}

          {!past && !canceled && lastBoard && (
            <div className="wtt-pop__section">
              <div className="wtt-pop__label">Dernier tableau projeté</div>
              <button
                type="button"
                className="wtt-pop__board"
                onClick={() => { onClose(); openBoard({ id: lastBoard.boardId, title: lastBoard.title }); }}
                title="Ouvrir le tableau"
              >
                <span className="wtt-pop__board-title">{lastBoard.title}</span>
                <span className="wtt-pop__muted">
                  {lastBoard.chapter ? `${lastBoard.chapter} · ` : ''}
                  le {lastBoard.usedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            </div>
          )}

          {!past && !canceled && alerts.length > 0 && (
            <div className="wtt-pop__section">
              <div className="wtt-pop__label">
                À surveiller{alertTotal > alerts.length ? ` · ${alerts.length} sur ${alertTotal}` : ''}
              </div>
              {alerts.map(a => (
                <Link key={a.id} to={`/students?class=${lesson.classId}&student=${a.id}`} className="wtt-pop__student">
                  <span className="dash__avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>{getInitials(a.pseudo)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="wtt-pop__student-name">{a.pseudo}</span>
                    <span className="wtt-pop__muted">{a.reason}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="wtt-pop__actions">
            {(current || (!past && sameDay(lesson.start, now))) && !canceled && (
              <Link to="/classe" className="wtt-pop__btn wtt-pop__btn--primary">Mode classe</Link>
            )}
            <Link to={`/classes?class=${lesson.classId}`} className="wtt-pop__btn">Plan de classe</Link>
            <Link to={`/students?class=${lesson.classId}`} className="wtt-pop__btn">Élèves</Link>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
