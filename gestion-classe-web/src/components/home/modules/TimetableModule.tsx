import { Link } from 'react-router-dom';
import { useHomeData } from '../HomeDataContext';
import { QuickIcon, formatTime, getClassColor, isSameDay } from '../homeHelpers';

/**
 * Emploi du temps Pronote : vue liste ou calendrier de la semaine.
 * Tant que Pronote n'est pas connecte, le module se reduit a un bandeau d'invitation.
 */
export function TimetableModule() {
  const {
    pronoteConnected, pronoteLessons, todayLessons, weekDays,
    viewedMonday, isCurrentWeek, weekOffset, ttLoading, ttView, setTtView, loadWeek,
    classNames, now,
  } = useHomeData();

  if (!pronoteConnected) {
    return (
      <div className="dash__card dash__tt-banner">
        <span className="dash__tt-banner-ic"><QuickIcon name="calendar" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dash__card-title">Emploi du temps</div>
          <p className="dash__card-sub">Connectez-vous à Pronote pour afficher votre emploi du temps ici.</p>
        </div>
        <Link to="/pronote" className="dash__btn-dark">Connecter Pronote</Link>
      </div>
    );
  }

  return (
    <div className="dash__card">
      <div className="dash__card-head">
        <div>
          <h2 className="dash__card-title">Emploi du temps</h2>
          <p className="dash__card-sub">
            {!pronoteConnected
              ? 'Pronote non connecté'
              : isCurrentWeek && todayLessons.length > 0
                ? `Aujourd'hui · ${todayLessons.length} cours`
                : `Semaine du ${viewedMonday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
          </p>
        </div>
        {pronoteConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View toggle */}
            <div className="dash__tt-toggle">
              <button
                className={`dash__tt-toggle-btn ${ttView === 'list' ? 'dash__tt-toggle-btn--active' : ''}`}
                onClick={() => setTtView('list')}
                title="Vue liste"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
              <button
                className={`dash__tt-toggle-btn ${ttView === 'calendar' ? 'dash__tt-toggle-btn--active' : ''}`}
                onClick={() => setTtView('calendar')}
                title="Vue calendrier"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 6h13M5.5 2.5v11M10.5 2.5v11" stroke="currentColor" strokeWidth="1"/></svg>
              </button>
            </div>
            {/* Week nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className="dash__tt-nav"
                onClick={() => loadWeek(weekOffset - 1)}
                disabled={ttLoading}
                title="Semaine précédente"
              >
                ‹
              </button>
              {!isCurrentWeek && (
                <button
                  className="dash__tt-nav dash__tt-nav--today"
                  onClick={() => loadWeek(0)}
                  disabled={ttLoading}
                >
                  Auj.
                </button>
              )}
              <button
                className="dash__tt-nav"
                onClick={() => loadWeek(weekOffset + 1)}
                disabled={ttLoading}
                title="Semaine suivante"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {ttLoading ? (
        <div style={{ padding: '40px 22px', textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '3px solid var(--indigo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : !pronoteConnected ? (
        <div style={{ padding: '32px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
            Connectez-vous à Pronote pour afficher votre emploi du temps ici.
          </p>
          <Link
            to="/pronote"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, var(--indigo), var(--indigo-hover))',
              color: 'white', padding: '8px 20px', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            Se connecter à Pronote
          </Link>
        </div>
      ) : pronoteLessons.length === 0 ? (
        <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Aucun cours cette semaine
        </div>
      ) : ttView === 'list' ? (
        /* ---- LIST VIEW ---- */
        <div>
          {/* Today's detailed list (current week only) */}
          {isCurrentWeek && todayLessons.length > 0 && (
            <>
              <div style={{ padding: '8px 22px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--indigo)' }}>
                Aujourd'hui
              </div>
              <div className="dash__timetable">
                {todayLessons.map((lesson) => {
                  const color = getClassColor(lesson.groupNames[0] || '', classNames);
                  const isPast = lesson.endDate < now;
                  const isCurrent = lesson.startDate <= now && lesson.endDate > now;
                  return (
                    <div
                      key={lesson.id}
                      className={`dash__tt-row ${isCurrent ? 'dash__tt-row--current' : ''} ${isPast ? 'dash__tt-row--past' : ''} ${lesson.canceled ? 'dash__tt-row--canceled' : ''}`}
                    >
                      <div className="dash__tt-time">
                        <span className="dash__tt-start">{formatTime(lesson.startDate)}</span>
                        <span className="dash__tt-end">{formatTime(lesson.endDate)}</span>
                      </div>
                      <div className="dash__tt-bar" style={{ background: lesson.canceled ? 'var(--text-dim)' : color }} />
                      <div className="dash__tt-content">
                        <div className="dash__tt-subject">
                          {lesson.canceled && <span className="dash__tt-canceled-badge">Annulé</span>}
                          {lesson.groupNames[0] || lesson.subject || 'Cours'}
                        </div>
                        {lesson.subject && lesson.groupNames[0] && (
                          <div className="dash__tt-detail">{lesson.subject}</div>
                        )}
                        {lesson.classrooms.length > 0 && (
                          <div className="dash__tt-room">Salle {lesson.classrooms[0]}</div>
                        )}
                      </div>
                      {isCurrent && (
                        <div className="dash__tt-live">EN COURS</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Separator before rest of week */}
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 22px' }} />
            </>
          )}
          {/* Week list */}
          <div className="dash__week-tt">
            {weekDays
              .filter(day => !(isCurrentWeek && isSameDay(day.date, now) && todayLessons.length > 0))
              .map((day) => (
              <div key={day.label} className={`dash__week-day ${isSameDay(day.date, now) ? 'dash__week-day--today' : ''}`}>
                <div className="dash__week-day-label">{day.label}</div>
                <div className="dash__week-day-lessons">
                  {day.lessons.length === 0 ? (
                    <div className="dash__week-empty">—</div>
                  ) : (
                    day.lessons.map((lesson) => {
                      const color = getClassColor(lesson.groupNames[0] || '', classNames);
                      return (
                        <div
                          key={lesson.id}
                          className={`dash__week-lesson ${lesson.canceled ? 'dash__week-lesson--canceled' : ''}`}
                          style={{ borderLeftColor: color }}
                        >
                          <span className="dash__week-lesson-time">{formatTime(lesson.startDate)}</span>
                          <span className="dash__week-lesson-name">{lesson.groupNames[0] || lesson.subject || 'Cours'}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ---- CALENDAR VIEW ---- */
        (() => {
          // Compute time range from lessons
          const allLessons = weekDays.flatMap(d => d.lessons);
          if (allLessons.length === 0) return (
            <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Aucun cours cette semaine
            </div>
          );
          const minH = Math.min(...allLessons.map(l => l.startDate.getHours()));
          const maxH = Math.max(...allLessons.map(l => l.endDate.getHours() + (l.endDate.getMinutes() > 0 ? 1 : 0)));
          const startHour = Math.max(7, minH);
          const endHour = Math.min(19, maxH + 1);
          const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
          const HOUR_PX = 56;

          return (
            <div className="dash__cal" style={{ overflowX: 'auto' }}>
              <div className="dash__cal-grid" style={{ minWidth: 520 }}>
                {/* Header row */}
                <div className="dash__cal-header">
                  <div className="dash__cal-time-col" />
                  {weekDays.map((day) => (
                    <div
                      key={day.label}
                      className={`dash__cal-day-header ${isSameDay(day.date, now) ? 'dash__cal-day-header--today' : ''}`}
                    >
                      {day.label}
                    </div>
                  ))}
                </div>
                {/* Body */}
                <div className="dash__cal-body" style={{ position: 'relative', height: hours.length * HOUR_PX }}>
                  {/* Time labels + gridlines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="dash__cal-hour"
                      style={{ top: (h - startHour) * HOUR_PX }}
                    >
                      <span className="dash__cal-hour-label">{`${h}h`}</span>
                    </div>
                  ))}
                  {/* Day columns with lessons */}
                  <div className="dash__cal-columns">
                    {weekDays.map((day, dayIdx) => (
                      <div key={dayIdx} className={`dash__cal-col ${isSameDay(day.date, now) ? 'dash__cal-col--today' : ''}`}>
                        {day.lessons.map((lesson) => {
                          const color = getClassColor(lesson.groupNames[0] || '', classNames);
                          const topMin = (lesson.startDate.getHours() - startHour) * 60 + lesson.startDate.getMinutes();
                          const durMin = (lesson.endDate.getTime() - lesson.startDate.getTime()) / 60000;
                          const top = (topMin / 60) * HOUR_PX;
                          const height = Math.max(20, (durMin / 60) * HOUR_PX - 2);
                          return (
                            <div
                              key={lesson.id}
                              className={`dash__cal-lesson ${lesson.canceled ? 'dash__cal-lesson--canceled' : ''}`}
                              style={{
                                top, height,
                                borderLeftColor: color,
                                background: lesson.canceled ? 'var(--surface-2)' : `${color}12`,
                              }}
                              title={`${formatTime(lesson.startDate)}–${formatTime(lesson.endDate)} · ${lesson.groupNames[0] || lesson.subject || 'Cours'}${lesson.classrooms[0] ? ` · Salle ${lesson.classrooms[0]}` : ''}`}
                            >
                              <span className="dash__cal-lesson-name">
                                {lesson.groupNames[0] || lesson.subject || 'Cours'}
                              </span>
                              {height > 30 && lesson.classrooms[0] && (
                                <span className="dash__cal-lesson-room">
                                  {lesson.classrooms[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
