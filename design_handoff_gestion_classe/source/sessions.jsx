// Séances — refonte
// Clés UX :
// - Switch Liste / Semaine / Mois — la semaine est la valeur par défaut (visuel fort)
// - Vue Semaine : grille jours × heures, blocs séances colorés par classe, tooltip + clic pour détail
// - Vue Liste : rows enrichies avec breakdown +/-/abs visuel, durée en barre, et groupement par jour
// - Détail de séance en panneau latéral : timeline des événements par élève

function SessionsScreen({ onBack }) {
  const { CLASSES } = window.GC_DATA;
  const [view, setView] = useState('week'); // week | list | month
  const [filter, setFilter] = useState('all');
  const [focus, setFocus] = useState(null); // session id
  const [weekOffset, setWeekOffset] = useState(0);

  // Generate 2 weeks of realistic sessions
  const ALL_SESSIONS = useMemo(() => buildSessions(CLASSES), []);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const weekLabel = `${weekDays[0].label} – ${weekDays[4].label}`;

  const filtered = ALL_SESSIONS.filter(s => filter === 'all' || s.classId === filter);

  return (
    <main className="page page--sessions">
      <header className="room-header">
        <div>
          <div className="track-header__eyebrow">
            <button className="crumb" onClick={onBack}>Accueil</button>
            <Icon name="chevron-right" size={12} />
            <span>Séances</span>
          </div>
          <h1>Séances</h1>
          <div className="track-header__sub">
            117 séances cette année · {filtered.length} visibles
          </div>
        </div>
        <div className="track-header__actions">
          <div className="segbtn">
            <button className={`segbtn__b ${view === 'list' ? 'is-on' : ''}`} onClick={() => setView('list')}><Icon name="list" size={14} /> Liste</button>
            <button className={`segbtn__b ${view === 'week' ? 'is-on' : ''}`} onClick={() => setView('week')}><Icon name="sessions" size={14} /> Semaine</button>
            <button className={`segbtn__b ${view === 'month' ? 'is-on' : ''}`} onClick={() => setView('month')}><Icon name="grid" size={14} /> Mois</button>
          </div>
          <button className="btn btn--accent"><Icon name="plus" size={14} /> Nouvelle séance</button>
        </div>
      </header>

      {/* filter rail */}
      <div className="ses-filters">
        <button className={`ses-filter ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>Toutes <span className="chip__count">{ALL_SESSIONS.length}</span></button>
        {CLASSES.slice(0, 8).map(c => (
          <button key={c.id}
            className={`ses-filter ${filter === c.id ? 'is-on' : ''}`}
            onClick={() => setFilter(c.id)}
            style={filter === c.id ? { background: c.color, color: '#fff' } : {}}>
            <span className="ses-filter__dot" style={{ background: c.color }} />
            {c.label}
            <span className="chip__count">{ALL_SESSIONS.filter(s => s.classId === c.id).length}</span>
          </button>
        ))}
      </div>

      {view === 'week' && (
        <div className="ses-stage">
          <div className="ses-weekbar">
            <div className="ses-weekbar__nav">
              <button className="iconbtn" onClick={() => setWeekOffset(o => o - 1)} title="Semaine précédente"><Icon name="chevron-right" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
              <div className="ses-weekbar__label">{weekLabel}</div>
              <button className="iconbtn" onClick={() => setWeekOffset(o => o + 1)} title="Semaine suivante"><Icon name="chevron-right" size={14} /></button>
              <button className="btn btn--ghost" onClick={() => setWeekOffset(0)}>Cette semaine</button>
            </div>
            <div className="ses-weekbar__legend">
              <span><i style={{background: 'var(--pos)'}}/> Séance riche (&gt; 10 évts)</span>
              <span><i style={{background: 'var(--warn)'}}/> À compléter</span>
              <span><i style={{background: 'var(--text-dim)'}}/> Pas encore eue</span>
            </div>
          </div>

          <WeekView days={weekDays} sessions={filtered} classes={CLASSES} onPick={setFocus} />
        </div>
      )}

      {view === 'list' && <ListView sessions={filtered} classes={CLASSES} onPick={setFocus} />}
      {view === 'month' && <MonthView sessions={filtered} classes={CLASSES} onPick={setFocus} />}

      {focus && <SessionDetail session={ALL_SESSIONS.find(s => s.id === focus)} classes={CLASSES} onClose={() => setFocus(null)} />}
    </main>
  );
}

// ---- helpers --------------------------------------------------------------

function buildSessions(CLASSES) {
  // Generate 2 weeks of sessions (Mon-Fri), with overlap and variety
  const out = [];
  const classPool = CLASSES.slice(0, 9);
  const topics = [
    'Lecture cursive · s.3', 'Argumentation · débat', 'DM corrigé + oral', 'Évaluation trimestrielle',
    'Séquence poésie', 'Grammaire · subordonnées', 'Dictée + correction', 'Oral blanc', 'Biographie de l\'auteur',
    'Activité 3 · atelier', 'Mission 6', 'Contrôle de lecture', 'Syte activité 5',
  ];
  let seed = 1;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let w = -1; w <= 1; w++) {
    for (let day = 0; day < 5; day++) {
      const slots = [8, 9, 10, 11, 14, 15, 16];
      slots.forEach((h, i) => {
        if (rand() < 0.55) return;
        const klass = classPool[Math.floor(rand() * classPool.length)];
        const events = Math.floor(rand() * 16);
        const durMin = [55, 60, 90, 120][Math.floor(rand() * 4)];
        out.push({
          id: `s-${w}-${day}-${i}`,
          classId: klass.id,
          className: klass.label,
          color: klass.color,
          short: klass.short,
          weekOffset: w, dayIdx: day, hour: h, minute: [0, 15, 30][Math.floor(rand()*3)],
          durMin,
          topic: topics[Math.floor(rand() * topics.length)],
          events,
          pos: Math.max(0, events - Math.floor(rand()*3)),
          neg: Math.floor(rand() * 3),
          abs: Math.floor(rand() * 2),
          status: w < 0 ? 'done' : w === 0 && day < 2 ? 'done' : w === 0 && day === 2 ? 'incomplete' : 'upcoming',
        });
      });
    }
  }
  return out;
}

function getWeekDays(offset) {
  const today = new Date('2026-04-20'); // Monday
  const base = new Date(today);
  base.setDate(base.getDate() + offset * 7);
  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
  return dayNames.map((name, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      idx: i,
      name,
      num: d.getDate(),
      month: d.toLocaleDateString('fr-FR', { month: 'short' }),
      label: `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`,
      isToday: offset === 0 && i === 0,
    };
  });
}

// ---- Week view ------------------------------------------------------------

function WeekView({ days, sessions, classes, onPick }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const HOUR_H = 56;

  const weekSessions = sessions.filter(s => s.weekOffset === 0); // current offset not passed; simplified

  return (
    <div className="weekview">
      {/* hour rail */}
      <div className="weekview__hours">
        <div className="weekview__corner" />
        {hours.map(h => (
          <div key={h} className="weekview__hour" style={{ height: HOUR_H }}>
            <span>{String(h).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>

      {days.map(day => {
        const daySessions = weekSessions.filter(s => s.dayIdx === day.idx);
        return (
          <div key={day.idx} className={`weekview__col ${day.isToday ? 'is-today' : ''}`}>
            <div className="weekview__day">
              <div className="weekview__dayname">{day.name}</div>
              <div className="weekview__daynum">{day.num}</div>
              {day.isToday && <div className="weekview__today">Aujourd'hui</div>}
            </div>
            <div className="weekview__cells" style={{ height: hours.length * HOUR_H }}>
              {hours.map((h, i) => (
                <div key={h} className="weekview__cell" style={{ top: i * HOUR_H, height: HOUR_H }} />
              ))}
              {daySessions.map(s => {
                const top = (s.hour - hours[0]) * HOUR_H + (s.minute / 60) * HOUR_H;
                const height = (s.durMin / 60) * HOUR_H - 3;
                const tone = s.status === 'upcoming' ? 'upcoming' : s.events > 10 ? 'rich' : s.events < 3 ? 'warn' : 'done';
                return (
                  <button key={s.id}
                    className={`wsession wsession--${tone}`}
                    onClick={() => onPick(s.id)}
                    style={{ top, height, borderLeftColor: s.color, background: s.status === 'upcoming' ? 'var(--surface-3)' : `${s.color}1A` }}>
                    <div className="wsession__top">
                      <span className="wsession__chip" style={{ background: s.color }}>{s.short}</span>
                      <span className="wsession__time">{String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}</span>
                    </div>
                    <div className="wsession__topic">{s.topic}</div>
                    {s.status !== 'upcoming' && height > 40 && (
                      <div className="wsession__foot">
                        <span className="break break--pos">+{s.pos}</span>
                        <span className="break break--neg">−{s.neg}</span>
                        {s.abs > 0 && <span className="break break--abs">{s.abs} abs</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- List view ------------------------------------------------------------

function ListView({ sessions, classes, onPick }) {
  const byDay = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => {
      const key = `${s.weekOffset}-${s.dayIdx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return Array.from(map.entries()).map(([k, arr]) => ({
      key: k,
      label: dayLabel(k),
      sessions: arr.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)),
    })).sort((a, b) => a.key.localeCompare(b.key));
  }, [sessions]);

  return (
    <div className="listview">
      {byDay.map(group => (
        <div key={group.key} className="listview__group">
          <div className="listview__day">{group.label}</div>
          {group.sessions.map(s => {
            const total = s.events || 1;
            const posW = (s.pos / total) * 100;
            const negW = (s.neg / total) * 100;
            const absW = (s.abs / total) * 100;
            return (
              <button key={s.id} className="lsession" onClick={() => onPick(s.id)}>
                <div className="lsession__time">
                  <div className="lsession__h">{String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}</div>
                  <div className="lsession__dur">{s.durMin}′</div>
                </div>
                <span className="wsession__chip" style={{ background: s.color, width: 30, height: 30, borderRadius: 7, fontSize: 11 }}>{s.short}</span>
                <div className="lsession__main">
                  <div className="lsession__class">{s.className}</div>
                  <div className="lsession__topic">{s.topic}</div>
                </div>
                <div className="lsession__events">
                  <div className="lsession__events-n">{s.events}<small>évts</small></div>
                  {s.events > 0 && (
                    <div className="lsession__bar">
                      <div style={{ width: `${posW}%`, background: 'var(--pos)' }} />
                      <div style={{ width: `${negW}%`, background: 'var(--neg)' }} />
                      <div style={{ width: `${absW}%`, background: 'var(--text-dim)' }} />
                    </div>
                  )}
                </div>
                <div className="lsession__break">
                  <span className="break break--pos">+{s.pos}</span>
                  <span className="break break--neg">−{s.neg}</span>
                  <span className="break break--abs">{s.abs} abs</span>
                </div>
                <Icon name="chevron-right" size={16} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function dayLabel(key) {
  const [w, d] = key.split('-').map(Number);
  const today = new Date('2026-04-20');
  const date = new Date(today);
  date.setDate(date.getDate() + w * 7 + d);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---- Month view (heatmap) -------------------------------------------------

function MonthView({ sessions, classes, onPick }) {
  // Simple heatmap of 30 days × activity
  const days = [];
  for (let i = 0; i < 35; i++) {
    const count = sessions.filter(s => Math.abs((s.weekOffset * 5 + s.dayIdx) - (i - 7)) < 1).length;
    days.push({ idx: i, count, isCurrentMonth: i >= 2 && i < 32, day: ((i - 2) % 31) + 1 });
  }
  return (
    <div className="monthview">
      <div className="monthview__head">
        {['LUN','MAR','MER','JEU','VEN','SAM','DIM'].map(d => <div key={d} className="monthview__dow">{d}</div>)}
      </div>
      <div className="monthview__grid">
        {days.map(d => (
          <div key={d.idx} className={`mday ${!d.isCurrentMonth ? 'is-out' : ''} ${d.count > 0 ? 'has-sessions' : ''}`}>
            <div className="mday__num">{d.day}</div>
            <div className="mday__count">{d.count > 0 && `${d.count} séances`}</div>
            {d.count > 0 && (
              <div className="mday__dots">
                {Array.from({ length: Math.min(d.count, 5) }).map((_, i) => (
                  <span key={i} style={{ background: classes[i % classes.length].color }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Session detail -------------------------------------------------------

function SessionDetail({ session, classes, onClose }) {
  if (!session) return null;
  const klass = classes.find(c => c.id === session.classId);
  // fake timeline
  const timeline = buildTimeline(session);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet">
        <div className="sheet__head">
          <div className="sheet__head-top">
            <div className="sheet__chip" style={{ background: session.color }}>{session.short}</div>
            <div>
              <div className="sheet__class">{session.className}</div>
              <div className="sheet__date">{dayLabel(`${session.weekOffset}-${session.dayIdx}`)} · {String(session.hour).padStart(2,'0')}:{String(session.minute).padStart(2,'0')} ({session.durMin}′)</div>
            </div>
            <button className="iconbtn" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <h2 className="sheet__topic">{session.topic}</h2>
          <div className="sheet__stats">
            <div className="stat"><div className="stat__n">{session.events}</div><div className="stat__l">événements</div></div>
            <div className="stat stat--pos"><div className="stat__n">+{session.pos}</div><div className="stat__l">positifs</div></div>
            <div className="stat stat--neg"><div className="stat__n">−{session.neg}</div><div className="stat__l">malus</div></div>
            <div className="stat"><div className="stat__n">{session.abs}</div><div className="stat__l">absents</div></div>
          </div>
        </div>

        <div className="sheet__section">
          <div className="sheet__section-title">Déroulé</div>
          <div className="timeline">
            {timeline.map((ev, i) => (
              <div key={i} className={`tl tl--${ev.tone}`}>
                <div className="tl__time">{ev.time}</div>
                <div className="tl__dot" />
                <div className="tl__body">
                  <div className="tl__who">{ev.who}</div>
                  <div className="tl__what">{ev.what}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sheet__actions">
          <button className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center' }}>Exporter</button>
          <button className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }}>Modifier la séance</button>
        </div>
      </aside>
    </>
  );
}

function buildTimeline(s) {
  const names = ['Lilia AB.', 'Adi AS.', 'Mehdi BO.', 'Ethan BR.', 'Taim BE.', 'Samy OU.', 'Adnane DO.'];
  const acts = [
    { what: 'Participation spontanée', tone: 'pos' },
    { what: 'Bonne réponse (+2)', tone: 'pos' },
    { what: 'Oral noté · 4/5', tone: 'oral' },
    { what: 'Bavardages (−1)', tone: 'neg' },
    { what: 'Refus de participer', tone: 'neg' },
    { what: 'Arrivée en retard', tone: 'abs' },
  ];
  const out = [];
  const start = s.hour * 60 + s.minute;
  for (let i = 0; i < Math.min(8, s.events); i++) {
    const off = Math.floor((i / 8) * s.durMin);
    const t = start + off;
    const act = acts[i % acts.length];
    out.push({
      time: `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`,
      who: names[i % names.length],
      what: act.what,
      tone: act.tone,
    });
  }
  return out;
}

Object.assign(window, { SessionsScreen });
