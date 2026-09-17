// Plan de salle — refondu
// UX :
// - Vue du haut isométrique légère, tableau ancré en haut
// - Bureaux comme objets 3D light (table + chaise), pas des carrés plats
// - Indicateur de tendance sur la pastille (barre latérale colorée + mini sparkline)
// - Zones vides = grille fine discrète, PAS de gros blocs hachurés
// - Drag & drop : tirer depuis "Non placés" vers un bureau, ou échanger deux élèves
// - Hover/clic → peek card avec mini dossier de l'élève

function RoomPlan({ onBack }) {
  const { CLASSES, STUDENTS_3G1 } = window.GC_DATA;

  // Layout: 6 columns × 4 rows of desks, with aisle down the middle
  // Seats: id "r-c" where r in 1..4, c in 1..6; aisle between col 3 and 4
  const ROWS = 4, COLS = 6;

  const [selectedClassId, setSelectedClassId] = useState('g1');
  const [roomId, setRoomId] = useState('s210');
  const [focus, setFocus] = useState(null); // student id
  const [dragging, setDragging] = useState(null); // {sid, from:'pool'|'seat', seatId?}
  const [dragOver, setDragOver] = useState(null);

  const klass = CLASSES.find(c => c.id === selectedClassId);

  // Seating state: seatId -> studentId | null
  const INITIAL_SEATING = useMemo(() => {
    const seats = {};
    const ids = STUDENTS_3G1.map(s => s.id);
    // realistic uneven placement
    const placements = [
      '1-2:adn', '1-3:hat', '1-4:tai', '1-5:eth',
      '2-1:ale', '2-5:efe', '2-6:adi',
      '3-1:djy', '3-2:lin', '3-5:meh', '3-6:nel',
      '4-2:erd', '4-5:let', '4-6:kyl',
      '5-1:azr', '5-2:lia', '5-5:noa', '5-6:yas',
      '6-3:sam', '6-5:tho', '6-6:ila',
    ];
    placements.forEach(p => {
      const [seat, sid] = p.split(':');
      if (ids.includes(sid)) seats[seat] = sid;
    });
    return seats;
  }, []);
  const [seating, setSeating] = useState(INITIAL_SEATING);

  const byId = useMemo(() => Object.fromEntries(STUDENTS_3G1.map(s => [s.id, s])), []);
  const seated = new Set(Object.values(seating).filter(Boolean));
  const pool = STUDENTS_3G1.filter(s => !seated.has(s.id));

  const handleDrop = (seatId) => {
    if (!dragging) return;
    setSeating(prev => {
      const next = { ...prev };
      const occupant = next[seatId] || null;
      if (dragging.from === 'pool') {
        next[seatId] = dragging.sid;
      } else if (dragging.from === 'seat') {
        next[dragging.seatId] = occupant; // swap
        next[seatId] = dragging.sid;
      }
      return next;
    });
    setDragging(null); setDragOver(null);
  };

  const handleDropPool = () => {
    if (!dragging || dragging.from !== 'seat') return;
    setSeating(prev => {
      const next = { ...prev };
      next[dragging.seatId] = null;
      return next;
    });
    setDragging(null); setDragOver(null);
  };

  const rooms = [
    { id: 's210', label: 'Salle 210', note: 'info' },
    { id: 's310', label: 'Salle 310', note: '' },
  ];

  return (
    <main className="page page--room">
      <header className="room-header">
        <div>
          <div className="track-header__eyebrow">
            <button className="crumb" onClick={onBack}>Accueil</button>
            <Icon name="chevron-right" size={12} />
            <span>Plans de classe</span>
          </div>
          <h1>Plan de salle</h1>
          <div className="track-header__sub">
            Glissez-déposez les élèves depuis le panneau latéral. Survolez un bureau pour voir la fiche.
          </div>
        </div>
        <div className="track-header__actions">
          <button className="btn btn--ghost"><Icon name="grid" size={14} /> Vue tableau</button>
          <button className="btn btn--ghost">Imprimer le plan</button>
          <button className="btn btn--accent">Sauvegarder</button>
        </div>
      </header>

      <div className="room-body">
        {/* left: classes */}
        <aside className="classes-pane">
          <div className="classes-pane__head">
            <span>Classes</span>
            <button className="iconbtn" title="Nouvelle classe"><Icon name="plus" size={14} /></button>
          </div>
          <div className="classes-pane__list">
            {CLASSES.map(c => (
              <button key={c.id}
                className={`class-row ${c.id === selectedClassId ? 'is-active' : ''}`}
                onClick={() => setSelectedClassId(c.id)}>
                <ClassChip klass={c} size={26} muted={c.id !== selectedClassId} />
                  <div className="class-row__main">
                    <div className="class-row__name">{c.label}</div>
                    <div className="class-row__meta">{c.students} élèves</div>
                  </div>
              </button>
            ))}
          </div>
        </aside>

        {/* center: the room itself */}
        <section className="room-stage">
          <div className="room-stage__tabs">
            <div className="room-tabs">
              {rooms.map(r => (
                <button key={r.id} className={`room-tab ${roomId === r.id ? 'is-on' : ''}`}
                  onClick={() => setRoomId(r.id)}>
                  <span>{r.label}</span>
                  {r.note && <span className="room-tab__tag">{r.note}</span>}
                </button>
              ))}
              <button className="room-tab room-tab--new"><Icon name="plus" size={12} /> Salle</button>
            </div>
            <div className="room-stage__meta">
              <span><ClassChip klass={klass} size={22} /> {klass.label}</span>
              <span className="dim">·</span>
              <span><b>{seated.size}/{klass.students}</b> placés</span>
              <span className="dim">·</span>
              <span>{rooms.find(r => r.id === roomId).label}</span>
            </div>
          </div>

          <div className="room-legend">
            <span className="leg"><i style={{background: 'var(--pos)'}}/>16-20</span>
            <span className="leg"><i style={{background: 'var(--indigo)'}}/>12-16</span>
            <span className="leg"><i style={{background: 'var(--warn)'}}/>8-12</span>
            <span className="leg"><i style={{background: 'var(--neg)'}}/>&lt;8</span>
            <span className="leg leg--sep">Tendance</span>
            <span className="leg"><span className="leg-trend">↗</span> en hausse</span>
            <span className="leg"><span className="leg-trend leg-trend--down">↘</span> en baisse</span>
          </div>

          <div className="room-canvas">
            {/* the grid */}
            <div className="seatgrid">
              {Array.from({ length: ROWS }).map((_, rIdx) => (
                <div className="seatrow" key={rIdx}>
                  {Array.from({ length: COLS }).map((_, cIdx) => {
                    const r = rIdx + 1, c = cIdx + 1;
                    const seatId = `${r}-${c}`;
                    const sid = seating[seatId];
                    const student = sid ? byId[sid] : null;
                    const isAisle = c === 3; // after this column
                    return (
                      <Fragment key={seatId}>
                        <Seat
                          seatId={seatId}
                          student={student}
                          klass={klass}
                          isDragOver={dragOver === seatId}
                          onDragStart={() => student && setDragging({ sid: student.id, from: 'seat', seatId })}
                          onDragEnd={() => { setDragging(null); setDragOver(null); }}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(seatId); }}
                          onDrop={(e) => { e.preventDefault(); handleDrop(seatId); }}
                          onClick={() => student && setFocus(focus === student.id ? null : student.id)}
                          focused={focus === sid}
                        />
                        {isAisle && <div className="aisle" aria-hidden />}
                      </Fragment>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* teacher desk */}
            <div className="teacher-desk" aria-label="Bureau professeur">
              <div className="teacher-desk__top">Prof</div>
            </div>

            {/* blackboard at the bottom */}
            <div className="chalkboard">
              <div className="chalkboard__inner">Tableau</div>
            </div>

            {/* door indicator */}
            <div className="door" aria-label="Porte"><Icon name="door" size={14} /><span>Porte</span></div>

            {focus && <PeekCard student={byId[focus]} klass={klass} onClose={() => setFocus(null)} />}
          </div>
        </section>

        {/* right: unplaced pool */}
        <aside className="pool"
          onDragOver={(e) => { e.preventDefault(); setDragOver('pool'); }}
          onDrop={() => handleDropPool()}>
          <div className="pool__head">
            <div>
              <div className="pool__title">Non placés</div>
              <div className="pool__sub">{pool.length} sur {klass.students}</div>
            </div>
            <button className="iconbtn" title="Filtrer"><Icon name="filter" size={14} /></button>
          </div>
          {pool.length === 0 ? (
            <div className="pool__empty">
              <div className="pool__empty-mark">✓</div>
              <div>Tous les élèves sont placés.</div>
              <small>Glissez ici un élève d'un bureau pour le retirer.</small>
            </div>
          ) : (
            <div className="pool__list">
              {pool.map(s => (
                <div key={s.id}
                  className="pool-item"
                  draggable
                  onDragStart={() => setDragging({ sid: s.id, from: 'pool' })}
                  onDragEnd={() => { setDragging(null); setDragOver(null); }}>
                  <StudentPill student={s} klass={klass} compact />
                  <div className="pool-item__meta">
                    <TrendBadge delta={deltaOf(s)} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pool__foot">
            <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'center' }}>Import CSV / Excel</button>
            <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
              <Icon name="plus" size={14} /> Ajouter un élève
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function deltaOf(s) {
  const h = s.history;
  const last5 = h.slice(5).filter(v => v !== null);
  const prev5 = h.slice(0, 5).filter(v => v !== null);
  const avgL = last5.length ? last5.reduce((a, b) => a + b, 0) / last5.length : 0;
  const avgP = prev5.length ? prev5.reduce((a, b) => a + b, 0) / prev5.length : 0;
  return avgL - avgP;
}

// ---- Seat (desk + optional student pill) ----------------------------------

function Seat({ seatId, student, klass, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop, onClick, focused }) {
  const empty = !student;
  return (
    <div
      className={`seat ${empty ? 'seat--empty' : 'seat--taken'} ${isDragOver ? 'is-over' : ''} ${focused ? 'is-focused' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
    >
      {/* desk silhouette */}
      <div className="desk">
        <div className="desk__chair" />
      </div>

      {empty ? (
        <div className="seat__empty-label">{seatId}</div>
      ) : (
        <div
          className="seat__pill"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}>
          <StudentPill student={student} klass={klass} />
        </div>
      )}
    </div>
  );
}

// ---- Student pill ---------------------------------------------------------

function StudentPill({ student, klass, compact = false }) {
  const mk = student.mark;
  const tone = mk < 8 ? 'neg' : mk < 12 ? 'warn' : mk < 16 ? 'indigo' : 'pos';
  const d = deltaOf(student);
  const trend = Math.abs(d) < 0.15 ? 'flat' : d > 0 ? 'up' : 'down';
  return (
    <div className={`pill pill--${tone} ${compact ? 'pill--compact' : ''}`}>
      <div className="pill__bar" />
      <div className="pill__inner">
        <div className="pill__top">
          <div className="pill__initial">{initials(student.name)}</div>
          <div className={`pill__trend pill__trend--${trend}`}>
            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
          </div>
        </div>
        <div className="pill__name">{student.name}</div>
        <div className="pill__bottom">
          <div className="pill__mark">{student.mark.toFixed(0)}<span>/20</span></div>
          {!compact && <MiniSpark history={student.history} />}
        </div>
      </div>
    </div>
  );
}

function MiniSpark({ history }) {
  const w = 38, h = 14;
  const vals = history.map(v => v === null ? null : v);
  const max = 2, min = -2;
  const pts = vals.map((v, i) => v === null ? null : { x: (i / (vals.length - 1)) * w, y: h/2 - ((v - 0) / (max - min)) * h });
  const segs = [];
  let cur = [];
  pts.forEach(p => { if (!p) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); });
  if (cur.length) segs.push(cur);
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="currentColor" strokeWidth={0.5} opacity="0.25" />
      {segs.map((seg, i) => (
        <polyline key={i} points={seg.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.3} opacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// ---- Peek card ------------------------------------------------------------

function PeekCard({ student, klass, onClose }) {
  const d = deltaOf(student);
  return (
    <div className="peek" onClick={(e) => e.stopPropagation()}>
      <button className="peek__close" onClick={onClose}><Icon name="x" size={14} /></button>
      <div className="peek__head">
        <div className="peek__avatar" style={{ background: klass.color + '22', color: klass.color }}>{initials(student.name)}</div>
        <div>
          <div className="peek__name">{student.name}</div>
          <div className="peek__class">{klass.label}</div>
        </div>
      </div>
      <div className="peek__scores">
        <div className="peek__score">
          <div className="peek__score-v">{student.mark.toFixed(1)}<span>/20</span></div>
          <div className="peek__score-l">Implication</div>
        </div>
        <div className="peek__score">
          <TrendBadge delta={d} />
          <div className="peek__score-l">10 dern. séances</div>
        </div>
      </div>
      <div className="peek__spark">
        <Sparkline history={student.history} w={200} h={28} color="var(--text)" />
      </div>
      <div className="peek__stats">
        <Stat n={student.pos} l="Participations +" tone="pos" />
        <Stat n={student.neg} l="Malus" tone="neg" />
        <Stat n={student.abs} l="Absences" tone="neutral" />
        <Stat n={student.oral ? `${student.oral}/5` : '—'} l="Oral" tone="indigo" />
      </div>
      <div className="peek__actions">
        <button className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center' }}>Fiche complète</button>
        <button className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }}><Icon name="plus" size={12} /> Événement</button>
      </div>
    </div>
  );
}

function Stat({ n, l, tone }) {
  return (
    <div className={`peek-stat peek-stat--${tone}`}>
      <div className="peek-stat__n">{n}</div>
      <div className="peek-stat__l">{l}</div>
    </div>
  );
}

function initials(name) {
  const parts = name.replace('.', '').split(' ').filter(Boolean);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

Object.assign(window, { RoomPlan });
