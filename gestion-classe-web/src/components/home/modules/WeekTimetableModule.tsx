import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../Modal';
import { TimetableImportPanel } from '../../timetable/TimetableImportPanel';
import { useHomeData } from '../HomeDataContext';
import { QuickIcon, formatTime, getClassColor, shortGroup } from '../homeHelpers';
import { assignSessions, percentOfDay, sameDay, type PlacedLesson } from '../../../lib/timetable/weekView';
import type { WeekSession } from '../../../lib/timetable/enrichmentQueries';
import { LessonPopover } from './LessonPopover';

/**
 * Grand emploi du temps de la semaine, en haut de l'accueil (lot 2 de PLAN_accueil_v2.md).
 * Source : Pronote en direct s'il est connecté, sinon l'emploi du temps importé (.ics).
 * La hauteur des cours suit celle du module : tout est positionné en pourcentage.
 */
export function WeekTimetableModule() {
  const {
    week, weekSource, weekLoading, weekOffset, isCurrentWeek, loadWeek,
    classNames, timetableImport, reloadTimetableImport, weekSessions,
  } = useHomeData();
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<{ lesson: PlacedLesson; anchor: DOMRect } | null>(null);

  // L'heure courante avance toute seule (ligne « maintenant »)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const importModal = (
    <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Emploi du temps" size="xl">
      <TimetableImportPanel onImported={reloadTimetableImport} />
    </Modal>
  );

  if (weekSource === 'none' && !weekLoading) {
    return (
      <div className="dash__card home-card wtt wtt--empty">
        <span className="dash__tt-banner-ic"><QuickIcon name="calendar" /></span>
        <div className="dash__card-title">Votre emploi du temps, ici en grand</div>
        <p className="dash__card-sub" style={{ maxWidth: 420, textAlign: 'center' }}>
          Connectez Pronote pour le lire en direct, ou importez l'export .ics de Pronote :
          toute l'année d'un coup, annulations et vacances comprises.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button type="button" className="dash__btn-dark" onClick={() => setImportOpen(true)}>Importer un .ics</button>
          <Link to="/pronote" className="dash__btn-dark">Connecter Pronote</Link>
        </div>
        {importModal}
      </div>
    );
  }

  const { days, startHour, endHour } = week;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const nowPct = percentOfDay(now, startHour, endHour);
  const nowVisible = now.getHours() >= startHour && now.getHours() < endHour;

  // Matière la plus fréquente : on ne l'écrit pas sur chaque cours, seulement les autres
  const subjectCount = new Map<string, number>();
  for (const d of days) for (const l of d.lessons) if (l.subject) subjectCount.set(l.subject, (subjectCount.get(l.subject) ?? 0) + 1);
  const mainSubject = [...subjectCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sessionByLesson = assignSessions(days.flatMap(d => d.lessons), weekSessions);

  const monday = week.monday;
  const friday = days[days.length - 1]?.date ?? monday;
  const rangeLabel = `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: monday.getMonth() === friday.getMonth() ? undefined : 'long' })} – ${friday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;

  const sourceLabel = weekSource === 'pronote'
    ? 'Pronote · en direct'
    : timetableImport
      ? `Importé le ${new Date(timetableImport.importedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
      : 'Emploi du temps enregistré';

  return (
    <div className="dash__card home-card wtt">
      <div className="wtt__head">
        <div style={{ minWidth: 0 }}>
          <h2 className="dash__card-title">
            {isCurrentWeek ? 'Cette semaine' : weekOffset === 1 ? 'Semaine prochaine' : weekOffset === -1 ? 'Semaine dernière' : 'Semaine'}
            <span className="wtt__range">{rangeLabel}</span>
          </h2>
          <p className="dash__card-sub">
            {sourceLabel}
            {weekSource === 'stored' && (
              <>
                {' · '}
                <button type="button" className="wtt__link" onClick={() => setImportOpen(true)}>Gérer</button>
              </>
            )}
          </p>
        </div>
        <div className="wtt__nav">
          <button type="button" className="dash__tt-nav" onClick={() => loadWeek(weekOffset - 1)} disabled={weekLoading} title="Semaine précédente">‹</button>
          {!isCurrentWeek && (
            <button type="button" className="dash__tt-nav dash__tt-nav--today" onClick={() => loadWeek(0)} disabled={weekLoading}>
              Aujourd'hui
            </button>
          )}
          <button type="button" className="dash__tt-nav" onClick={() => loadWeek(weekOffset + 1)} disabled={weekLoading} title="Semaine suivante">›</button>
        </div>
      </div>

      <div className={`wtt__grid ${weekLoading ? 'wtt__grid--loading' : ''}`} style={{ ['--wtt-days' as string]: days.length }}>
        {/* En-têtes des jours */}
        <div />
        {days.map(d => {
          const today = sameDay(d.date, now);
          return (
            <div key={d.date.toISOString()} className={`wtt__day-head ${today ? 'wtt__day-head--today' : ''}`}>
              <span className="wtt__day-name">{d.date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
              <span className="wtt__day-num">{d.date.getDate()}</span>
            </div>
          );
        })}

        {/* Axe des heures */}
        <div className="wtt__hours">
          {hours.map(h => (
            <span key={h} className="wtt__hour" style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }}>{h}h</span>
          ))}
        </div>

        {/* Colonnes */}
        {days.map(d => {
          const today = sameDay(d.date, now);
          return (
            <div key={d.date.toISOString()} className={`wtt__col ${today ? 'wtt__col--today' : ''}`}>
              {hours.map(h => (
                <div key={h} className="wtt__line" style={{ top: `${((h - startHour) / (endHour - startHour)) * 100}%` }} />
              ))}
              {d.holiday && d.lessons.length === 0 && (
                <div className="wtt__holiday"><span>{d.holiday}</span></div>
              )}
              {d.lessons.map(l => (
                <LessonBlock
                  key={l.id}
                  lesson={l}
                  startHour={startHour}
                  endHour={endHour}
                  color={l.className ? getClassColor(l.className, classNames) : 'var(--text-dim)'}
                  showSubject={!!l.subject && l.subject !== mainSubject}
                  past={l.end < now}
                  current={l.start <= now && l.end > now}
                  session={sessionByLesson.get(l.id) ?? null}
                  selected={selected?.lesson.id === l.id}
                  onSelect={(anchor) => setSelected(prev => (prev?.lesson.id === l.id ? null : { lesson: l, anchor }))}
                />
              ))}
              {today && nowVisible && (
                <div className="wtt__now" style={{ top: `${nowPct}%` }} aria-label="Maintenant" />
              )}
            </div>
          );
        })}
      </div>

      {days.every(d => d.lessons.length === 0) && !weekLoading && (
        <p className="wtt__nothing">
          {days.every(d => d.holiday) ? days[0].holiday : 'Aucun cours cette semaine'}
        </p>
      )}

      {selected && (
        <LessonPopover
          lesson={selected.lesson}
          session={sessionByLesson.get(selected.lesson.id) ?? null}
          anchor={selected.anchor}
          now={now}
          color={selected.lesson.className ? getClassColor(selected.lesson.className, classNames) : 'var(--text-dim)'}
          onClose={() => setSelected(null)}
          onManageLinks={() => { setSelected(null); setImportOpen(true); }}
        />
      )}

      {importModal}
    </div>
  );
}

function LessonBlock({
  lesson, startHour, endHour, color, showSubject, past, current, session, selected, onSelect,
}: {
  lesson: PlacedLesson;
  startHour: number;
  endHour: number;
  color: string;
  showSubject: boolean;
  past: boolean;
  current: boolean;
  session: WeekSession | null;
  selected: boolean;
  onSelect: (anchor: DOMRect) => void;
}) {
  const top = percentOfDay(lesson.start, startHour, endHour);
  const bottom = percentOfDay(lesson.end, startHour, endHour);
  const name = lesson.className
    ? lesson.groupName ? `${lesson.className} · ${shortGroup(lesson.groupName)}` : lesson.className
    : lesson.label;
  const canceled = lesson.status === 'canceled';
  const time = `${formatTime(lesson.start)} – ${formatTime(lesson.end)}`;

  return (
    <button
      type="button"
      onClick={(e) => onSelect(e.currentTarget.getBoundingClientRect())}
      aria-expanded={selected}
      className={[
        'wtt__lesson',
        selected && 'wtt__lesson--selected',
        canceled && 'wtt__lesson--canceled',
        past && 'wtt__lesson--past',
        current && 'wtt__lesson--current',
        !lesson.className && 'wtt__lesson--other',
      ].filter(Boolean).join(' ')}
      style={{
        top: `${top}%`,
        height: `calc(${bottom - top}% - 3px)`,
        left: `calc(${(lesson.lane / lesson.lanes) * 100}% + 3px)`,
        width: `calc(${100 / lesson.lanes}% - 6px)`,
        ['--lesson-color' as string]: color,
      }}
      title={[name, lesson.subject, time, lesson.room, canceled ? 'Annulé' : null].filter(Boolean).join(' · ')}
    >
      <div className="wtt__lesson-name">
        {name}
        {canceled && <span className="wtt__badge wtt__badge--neg">Annulé</span>}
        {lesson.status === 'modified' && <span className="wtt__badge">Modifié</span>}
        {lesson.status === 'exceptional' && <span className="wtt__badge">Except.</span>}
      </div>
      {showSubject && <div className="wtt__lesson-sub">{lesson.subject?.toLowerCase()}</div>}
      {session ? (
        // Séance faite : son bilan remplace l'heure et la salle (l'axe donne déjà l'heure)
        <div className="wtt__lesson-session" title="Séance enregistrée">
          {session.pos > 0 && <span className="wtt__count wtt__count--pos">+{session.pos}</span>}
          {session.neg > 0 && <span className="wtt__count wtt__count--neg">−{session.neg}</span>}
          {session.abs > 0 && <span className="wtt__count">{session.abs} abs</span>}
          {session.topic
            ? <span className="wtt__lesson-topic">{session.topic}</span>
            : session.pos + session.neg + session.abs === 0 && <span className="wtt__lesson-topic">✓ faite</span>}
        </div>
      ) : (
        <div className="wtt__lesson-meta">
          {formatTime(lesson.start)}
          {lesson.room && <> · {lesson.room.replace(/^salle\s+(?=\d)/i, '')}</>}
        </div>
      )}
    </button>
  );
}
