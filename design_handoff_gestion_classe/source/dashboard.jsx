// Dashboard — refondu. Hero "prochaine séance", 3 KPI utiles, bloc attention,
// séances récentes repensées, raccourcis.

function Dashboard({ onOpenStudents, onOpenRoom }) {
  const { CLASSES, UPCOMING, RECENT_SESSIONS, ATTENTION } = window.GC_DATA;
  const classOf = id => CLASSES.find(c => c.id === id);
  const next = UPCOMING[0];
  const nextClass = classOf(next.classId);

  // KPI cards — only 3 that are actionable
  return (
    <main className="page">
      {/* Hero row: next session + 3 KPIs */}
      <section className="hero">
        <div className="hero__title">
          <div className="kicker">
            <Icon name="clock" size={13} />
            <span>Lundi 20 avril · fin de journée</span>
          </div>
          <h1>Bonsoir Thomas.</h1>
          <p className="hero__lede">
            Demain, <b>3 séances</b>. Commence par <b>{nextClass.label}</b>, <b>{next.time}</b>.
          </p>
        </div>

        <div className="hero__next">
          <div className="next-card">
            <div className="next-card__head">
              <ClassChip klass={nextClass} size={40} />
              <div>
                <div className="next-card__eyebrow">Prochaine séance</div>
                <div className="next-card__class">{nextClass.label}</div>
              </div>
              <div className="next-card__when">
                <div className="next-card__date">{next.date}</div>
                <div className="next-card__time">{next.time}</div>
              </div>
            </div>
            <div className="next-card__topic">{next.topic}</div>
            <div className="next-card__meta">
              <span><Icon name="door" size={13} /> Salle {next.room}</span>
              <span><Icon name="students" size={13} /> {next.students} élèves</span>
              <span><Icon name="pin" size={13} /> 3 à suivre de près</span>
            </div>
            <div className="next-card__actions">
              <button className="btn btn--primary"><Icon name="sessions" size={14} /> Ouvrir la séance</button>
              <button className="btn btn--ghost">Plan de classe</button>
              <button className="btn btn--ghost">Notes de prépa</button>
            </div>
          </div>
        </div>
      </section>

      <section className="kpi-row">
        <KpiCard
          label="Moyenne d'implication"
          value="10.6"
          unit="/20"
          delta={+0.4}
          hint="T3 en cours · +0.4 vs T2"
          tone="neutral"
        />
        <KpiCard
          label="Élèves à suivre"
          value="5"
          unit=""
          delta={+2}
          deltaUnit=" cette semaine"
          hint="Décrochage ou absences répétées"
          tone="warn"
        />
        <KpiCard
          label="Séances de la semaine"
          value="11"
          unit=""
          delta={0}
          hint="4 faites · 7 à venir · 0 annulée"
          tone="neutral"
        />
      </section>

      <div className="cols">
        {/* Left: attention + recent */}
        <div className="col col--main">
          <Card
            title="À regarder avant demain"
            subtitle="Élèves qui décrochent ou multiplient les absences"
            action={<button className="link">Voir tous →</button>}
          >
            <div className="attn-list">
              {ATTENTION.map(s => (
                <button key={s.id + s.classLabel} className="attn-row" onClick={onOpenStudents}>
                  <div className="attn-row__id">
                    <span className="attn-row__dot" style={{ background: s.classColor }} />
                    <div>
                      <div className="attn-row__name">{s.name}</div>
                      <div className="attn-row__class">{s.classLabel}</div>
                    </div>
                  </div>
                  <div className="attn-row__reason">{s.reason}</div>
                  <div className="attn-row__score">
                    <div className="attn-row__mark">{s.mark.toFixed(1)}<span>/20</span></div>
                    <TrendBadge delta={s.delta} />
                  </div>
                  <Icon name="chevron-right" size={16} />
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Séances récentes"
            subtitle="10 derniers jours · 5 séances"
            action={<button className="link">Tout l'historique →</button>}
          >
            <div className="sessions-list">
              {RECENT_SESSIONS.map((s, i) => {
                const k = classOf(s.classId);
                const { pos, neg, abs } = approxBreakdown(s.events, i);
                return (
                  <div key={i} className="ses-row">
                    <ClassChip klass={k} size={34} />
                    <div className="ses-row__main">
                      <div className="ses-row__top">
                        <span className="ses-row__class">{k.label}</span>
                        <span className="ses-row__dot">·</span>
                        <span className="ses-row__date">{s.date}, {s.time}</span>
                      </div>
                      <div className="ses-row__topic">{s.topic}</div>
                    </div>
                    <div className="ses-row__break">
                      <span className="break break--pos"><Icon name="plus-circle" size={12} /> {pos}</span>
                      <span className="break break--neg"><Icon name="minus-circle" size={12} /> {neg}</span>
                      <span className="break break--abs">{abs} abs</span>
                    </div>
                    <div className="ses-row__events">
                      <div className="ses-row__events-n">{s.events}</div>
                      <div className="ses-row__events-l">événements</div>
                    </div>
                    <Icon name="chevron-right" size={16} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: planner + shortcuts */}
        <div className="col col--side">
          <Card title="Demain · mardi 21 avril" subtitle="3 séances · 2 salles">
            <div className="planner">
              {UPCOMING.map((u, i) => {
                const k = classOf(u.classId);
                return (
                  <div key={i} className={`planner__row ${i === 0 ? 'is-next' : ''}`}>
                    <div className="planner__time">
                      <div className="planner__h">{u.time}</div>
                      {i === 0 && <div className="planner__next">Prochaine</div>}
                    </div>
                    <div className="planner__chip">
                      <ClassChip klass={k} size={26} />
                    </div>
                    <div className="planner__main">
                      <div className="planner__class">{k.label}</div>
                      <div className="planner__topic">{u.topic}</div>
                      <div className="planner__meta">Salle {u.room} · {u.students} élèves</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Raccourcis">
            <div className="shortcuts">
              <button className="short"><Icon name="calendar-plus" size={18} /><div><div>Nouvelle séance</div><small>Saisie rapide</small></div></button>
              <button className="short"><Icon name="mic" size={18} /><div><div>Oral blanc</div><small>Lancer une rotation</small></div></button>
              <button className="short" onClick={onOpenStudents}><Icon name="students" size={18} /><div><div>Suivi élèves</div><small>Notes d'implication</small></div></button>
              <button className="short" onClick={onOpenRoom}><Icon name="door" size={18} /><div><div>Plans de classe</div><small>13 classes</small></div></button>
            </div>
          </Card>

          <Card title="Moyenne par classe" subtitle="T3 en cours">
            <div className="classbars">
              {CLASSES.slice(0, 7).map(k => (
                <div key={k.id} className="classbar">
                  <ClassChip klass={k} size={22} />
                  <div className="classbar__label">{k.label}</div>
                  <div className="classbar__track">
                    <div className="classbar__fill" style={{ width: `${(k.avg/20)*100}%`, background: k.color }} />
                    <div className="classbar__mid" />
                  </div>
                  <div className="classbar__val">{k.avg.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function approxBreakdown(total, seed) {
  // deterministic pretend breakdown for each session
  const negs = [2, 1, 1, 6, 2][seed % 5] ?? 1;
  const abs = [1, 0, 0, 2, 1][seed % 5] ?? 0;
  const pos = Math.max(0, total - negs - abs);
  return { pos, neg: negs, abs };
}

function KpiCard({ label, value, unit, delta, deltaUnit = '', hint, tone = 'neutral' }) {
  const up = delta > 0, flat = delta === 0;
  return (
    <div className={`kpi kpi--${tone}`}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">
        <span>{value}</span>
        {unit && <span className="kpi__unit">{unit}</span>}
      </div>
      <div className="kpi__row">
        {!flat && (
          <span className={`kpi__delta ${up ? 'is-up' : 'is-down'}`}>
            {up ? '↗ +' : '↘ '}{delta}{deltaUnit}
          </span>
        )}
        {flat && <span className="kpi__delta is-flat">→ stable{deltaUnit}</span>}
        <span className="kpi__hint">{hint}</span>
      </div>
    </div>
  );
}

function Card({ title, subtitle, action, children }) {
  return (
    <section className="card">
      <header className="card__head">
        <div>
          <h3 className="card__title">{title}</h3>
          {subtitle && <p className="card__sub">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="card__body">{children}</div>
    </section>
  );
}

Object.assign(window, { Dashboard });
