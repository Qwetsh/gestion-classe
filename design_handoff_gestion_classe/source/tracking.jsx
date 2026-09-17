// Notes d'implication — refondu
// Clés UX :
// - Carte élève centrée sur le signal (tendance + breakdown) plutôt que la note chiffrée.
// - Mode liste dense pour saisie rapide en séance, mode grille pour lecture/bilan.
// - Ajout d'événement en 2 clics depuis la carte (popover).

function StudentTracking({ onBack }) {
  const { CLASSES, STUDENTS_3G1 } = window.GC_DATA;
  const [selectedClassId, setSelectedClassId] = useState('g1');
  const [sort, setSort] = useState('name'); // name | mark | trend | abs
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState('grid'); // grid | list
  const [openMenuId, setOpenMenuId] = useState(null);
  const [eventFeed, setEventFeed] = useState([]); // recent quick-added events for toast
  const [filter, setFilter] = useState('all'); // all | attention | top

  const klass = CLASSES.find(c => c.id === selectedClassId);

  // compute deltas + aggregated signal per student
  const students = useMemo(() => {
    return STUDENTS_3G1.map(s => {
      // weighted average of history: last 5 vs previous 5
      const h = s.history;
      const last5 = h.slice(5).filter(v => v !== null);
      const prev5 = h.slice(0, 5).filter(v => v !== null);
      const avgL = last5.length ? last5.reduce((a, b) => a + b, 0) / last5.length : 0;
      const avgP = prev5.length ? prev5.reduce((a, b) => a + b, 0) / prev5.length : 0;
      const delta = (avgL - avgP);
      return { ...s, delta };
    });
  }, []);

  const filtered = useMemo(() => {
    let arr = students;
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(s => s.name.toLowerCase().includes(q));
    }
    if (filter === 'attention') arr = arr.filter(s => s.mark < 8 || s.delta < -0.3);
    if (filter === 'top') arr = arr.filter(s => s.mark >= 12);
    arr = [...arr];
    if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'mark') arr.sort((a, b) => b.mark - a.mark);
    if (sort === 'trend') arr.sort((a, b) => b.delta - a.delta);
    if (sort === 'abs') arr.sort((a, b) => b.abs - a.abs);
    return arr;
  }, [students, query, sort, filter]);

  const counts = useMemo(() => ({
    all: students.length,
    attention: students.filter(s => s.mark < 8 || s.delta < -0.3).length,
    top: students.filter(s => s.mark >= 12).length,
  }), [students]);

  const onQuickAdd = (student, kind) => {
    setEventFeed(f => [{ id: Date.now(), student: student.name, kind }, ...f].slice(0, 3));
    setOpenMenuId(null);
  };

  return (
    <main className="page page--tracking">
      <header className="track-header">
        <div>
          <div className="track-header__eyebrow">
            <button className="crumb" onClick={onBack}>Accueil</button>
            <Icon name="chevron-right" size={12} />
            <span>Suivi élèves</span>
            <Icon name="chevron-right" size={12} />
            <span className="is-current">Notes d'implication</span>
          </div>
          <h1>Notes d'implication</h1>
          <div className="track-header__sub">
            T3 · 2025–2026 · <b>Note de base 10/20</b> · Pénalité malus active
          </div>
        </div>
        <div className="track-header__actions">
          <button className="btn btn--ghost"><Icon name="qr" size={14} /> QR</button>
          <button className="btn btn--ghost">Codes élèves</button>
          <button className="btn btn--accent">Finir l'année scolaire</button>
        </div>
      </header>

      <div className="track-body">
        {/* Sidebar: classes */}
        <aside className="classes-pane">
          <div className="classes-pane__head">
            <span>Classes</span>
            <span className="count">{CLASSES.length}</span>
          </div>
          <div className="classes-pane__list">
            {CLASSES.map(c => (
              <button key={c.id}
                className={`class-row ${c.id === selectedClassId ? 'is-active' : ''}`}
                onClick={() => setSelectedClassId(c.id)}>
                <ClassChip klass={c} size={26} muted={c.id !== selectedClassId} />
                <div className="class-row__main">
                  <div className="class-row__name">{c.label}</div>
                  <div className="class-row__meta">
                    <span>{c.students} élèves</span>
                    <span className="dot">·</span>
                    <span>Moy. <b>{c.avg.toFixed(1)}</b></span>
                  </div>
                </div>
                <AvgRing value={c.avg} color={c.color} />
              </button>
            ))}
          </div>
          <div className="classes-pane__foot">
            283 élèves au total · 13 classes
          </div>
        </aside>

        {/* Main: class detail */}
        <section className="class-detail">
          <div className="class-detail__head">
            <div className="class-detail__title">
              <ClassChip klass={klass} size={44} />
              <div>
                <h2>{klass.label}</h2>
                <div className="class-detail__meta">
                  <span>{klass.students} élèves</span>
                  <span>·</span>
                  <span>24 séances ce trimestre</span>
                  <span>·</span>
                  <span>Dernière : <b>9 avr. 2026</b></span>
                </div>
              </div>
            </div>
            <div className="class-detail__score">
              <div className="class-detail__score-label">Moyenne de classe</div>
              <div className="class-detail__score-val" style={{ color: klass.color }}>
                {klass.avg.toFixed(1)}<span>/20</span>
              </div>
              <TrendBadge delta={+0.3} />
            </div>
          </div>

          {/* toolbar */}
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={14} />
              <input placeholder="Rechercher un élève…" value={query} onChange={e => setQuery(e.target.value)} />
              {query && <button onClick={() => setQuery('')} className="search__clear"><Icon name="x" size={12} /></button>}
            </div>
            <div className="chips">
              <button className={`chip ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>Tous <span className="chip__count">{counts.all}</span></button>
              <button className={`chip chip--warn ${filter === 'attention' ? 'is-on' : ''}`} onClick={() => setFilter('attention')}>À suivre <span className="chip__count">{counts.attention}</span></button>
              <button className={`chip chip--good ${filter === 'top' ? 'is-on' : ''}`} onClick={() => setFilter('top')}>En tête <span className="chip__count">{counts.top}</span></button>
            </div>
            <div className="toolbar__spacer" />
            <div className="segbtn">
              <button className={`segbtn__b ${sort === 'name' ? 'is-on' : ''}`} onClick={() => setSort('name')}>A‑Z</button>
              <button className={`segbtn__b ${sort === 'mark' ? 'is-on' : ''}`} onClick={() => setSort('mark')}>Note</button>
              <button className={`segbtn__b ${sort === 'trend' ? 'is-on' : ''}`} onClick={() => setSort('trend')}>Tendance</button>
              <button className={`segbtn__b ${sort === 'abs' ? 'is-on' : ''}`} onClick={() => setSort('abs')}>Absences</button>
            </div>
            <div className="segbtn">
              <button className={`segbtn__b segbtn__b--icon ${layout === 'grid' ? 'is-on' : ''}`} onClick={() => setLayout('grid')}><Icon name="grid" size={14} /></button>
              <button className={`segbtn__b segbtn__b--icon ${layout === 'list' ? 'is-on' : ''}`} onClick={() => setLayout('list')}><Icon name="list" size={14} /></button>
            </div>
          </div>

          {/* class strip: distribution + indicators */}
          <div className="class-strip">
            <Distribution students={students} color={klass.color} />
            <div className="class-strip__indicators">
              <Indic label="Oral fait" value="12/18" hint="sur 5 tours" />
              <Indic label="Participation" value="132" hint="événements +/- cumulés" />
              <Indic label="Absences" value="24" tone="warn" hint="dont 3 non justifiées" />
              <Indic label="Bonus" value="0" hint="non distribué au T3" />
            </div>
          </div>

          {/* student grid */}
          {layout === 'grid' ? (
            <div className="sgrid">
              {filtered.map(s => (
                <StudentCard key={s.id}
                  student={s}
                  klass={klass}
                  open={openMenuId === s.id}
                  onOpen={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                  onQuickAdd={kind => onQuickAdd(s, kind)}
                />
              ))}
              {filtered.length === 0 && <div className="empty">Aucun élève avec ces filtres.</div>}
            </div>
          ) : (
            <div className="slist">
              <div className="slist__head">
                <span>Élève</span>
                <span>Note</span>
                <span>Tendance (10 dernières séances)</span>
                <span>+</span>
                <span>−</span>
                <span>Abs</span>
                <span>Oral</span>
                <span></span>
              </div>
              {filtered.map(s => (
                <StudentRow key={s.id} student={s} klass={klass}
                  open={openMenuId === s.id}
                  onOpen={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                  onQuickAdd={kind => onQuickAdd(s, kind)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* toast feed */}
      <div className="feed">
        {eventFeed.map(e => (
          <div key={e.id} className={`toast toast--${e.kind.tone}`}>
            <Icon name={e.kind.icon} size={14} />
            <span><b>{e.kind.label}</b> ajouté à <b>{e.student}</b></span>
          </div>
        ))}
      </div>
    </main>
  );
}

// ---- small bits for the tracking screen -----------------------------------

function AvgRing({ value, color }) {
  const pct = Math.max(0, Math.min(1, value / 20));
  const r = 12, c = 2 * Math.PI * r;
  return (
    <svg width={30} height={30} className="avgring">
      <circle cx={15} cy={15} r={r} stroke="var(--border)" strokeWidth={2.5} fill="none" />
      <circle cx={15} cy={15} r={r} stroke={color} strokeWidth={2.5} fill="none"
        strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
        transform="rotate(-90 15 15)" />
      <text x={15} y={18} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--text)" style={{ fontFamily: 'var(--font-display)' }}>
        {value.toFixed(0)}
      </text>
    </svg>
  );
}

function Indic({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`indic indic--${tone}`}>
      <div className="indic__label">{label}</div>
      <div className="indic__value">{value}</div>
      {hint && <div className="indic__hint">{hint}</div>}
    </div>
  );
}

function Distribution({ students, color }) {
  // Build a 0..20 histogram of marks (integer bins)
  const bins = new Array(21).fill(0);
  students.forEach(s => { const b = Math.round(s.mark); bins[Math.max(0, Math.min(20, b))] += 1; });
  const max = Math.max(...bins, 1);
  return (
    <div className="distrib">
      <div className="distrib__label">Distribution des notes</div>
      <div className="distrib__bars">
        {bins.map((n, i) => (
          <div key={i} className="distrib__b" title={`${n} élève(s) à ${i}/20`}>
            <div className="distrib__f" style={{ height: `${(n/max)*100}%`, background: i < 8 ? 'var(--neg-soft)' : i < 12 ? 'var(--muted-2)' : color }} />
          </div>
        ))}
      </div>
      <div className="distrib__axis">
        <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span>
      </div>
    </div>
  );
}

// ---- Student card (grid) --------------------------------------------------

function StudentCard({ student, klass, open, onOpen, onQuickAdd }) {
  const s = student;
  const mk = s.mark;
  const tone = mk < 6 ? 'crit' : mk < 8 ? 'warn' : mk < 12 ? 'neutral' : 'good';

  return (
    <div className={`scard scard--${tone}`}>
      <div className="scard__head">
        <div className="scard__id">
          <div className="scard__avatar" style={{ background: klass.color + '22', color: klass.color }}>
            {initials(s.name)}
          </div>
          <div>
            <div className="scard__name">{s.name}</div>
            <div className="scard__meta">{s.events}/{25} sessions</div>
          </div>
        </div>
        <div className="scard__mark">
          <span>{s.mark.toFixed(1)}</span>
          <small>/20</small>
        </div>
      </div>

      <div className="scard__trend">
        <Sparkline history={s.history} w={168} h={28} color="var(--text)" />
        <div className="scard__trend-meta">
          <span className="scard__trend-label">10 dernières séances</span>
          <TrendBadge delta={s.delta} />
        </div>
      </div>

      <div className="scard__breakdown">
        <Token kind="pos" value={s.pos} label="+" />
        <Token kind="neg" value={s.neg} label="−" />
        <Token kind="abs" value={s.abs} label="abs" />
        <Token kind="oral" value={s.oral ? `${s.oral}/5` : '—'} label="oral" />
      </div>

      <div className="scard__actions">
        <button className="scard__add" onClick={onOpen}>
          <Icon name="plus" size={14} /> Ajouter un événement
        </button>
        <button className="scard__eye" title="Ouvrir la fiche"><Icon name="eye" size={14} /></button>
      </div>

      {open && <QuickMenu onPick={onQuickAdd} />}
    </div>
  );
}

function StudentRow({ student, klass, open, onOpen, onQuickAdd }) {
  const s = student;
  return (
    <div className="srow">
      <div className="srow__id">
        <div className="srow__avatar" style={{ background: klass.color + '22', color: klass.color }}>{initials(s.name)}</div>
        <div className="srow__name">{s.name}</div>
      </div>
      <div className="srow__mark" style={{ color: s.mark < 8 ? 'var(--neg)' : s.mark >= 12 ? 'var(--pos)' : 'var(--text)' }}>{s.mark.toFixed(1)}</div>
      <div className="srow__spark">
        <Sparkline history={s.history} w={180} h={22} color="var(--text-muted)" />
        <TrendBadge delta={s.delta} />
      </div>
      <div className="srow__n srow__n--pos">+{s.pos}</div>
      <div className="srow__n srow__n--neg">−{s.neg}</div>
      <div className="srow__n">{s.abs}</div>
      <div className="srow__n">{s.oral ? `${s.oral}/5` : '—'}</div>
      <div className="srow__end" style={{ position: 'relative' }}>
        <button className="srow__add" onClick={onOpen}><Icon name="plus" size={14} /></button>
        {open && <QuickMenu onPick={onQuickAdd} align="right" />}
      </div>
    </div>
  );
}

function Token({ kind, value, label }) {
  return (
    <div className={`tok tok--${kind}`}>
      <span className="tok__v">{value}</span>
      <span className="tok__l">{label}</span>
    </div>
  );
}

function QuickMenu({ onPick, align = 'left' }) {
  const items = [
    { label: 'Participation +', icon: 'plus-circle', tone: 'pos' },
    { label: 'Bonne réponse +2', icon: 'sparkle', tone: 'pos' },
    { label: 'Malus −1', icon: 'minus-circle', tone: 'neg' },
    { label: 'Gros malus −2', icon: 'alert', tone: 'neg' },
    { label: 'Absent', icon: 'x', tone: 'abs' },
    { label: 'Oral noté', icon: 'mic', tone: 'oral' },
  ];
  return (
    <div className={`qmenu qmenu--${align}`}>
      {items.map((it, i) => (
        <button key={i} className={`qmenu__item qmenu__item--${it.tone}`} onClick={() => onPick(it)}>
          <Icon name={it.icon} size={14} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function initials(name) {
  const parts = name.replace('.', '').split(' ').filter(Boolean);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

Object.assign(window, { StudentTracking });
