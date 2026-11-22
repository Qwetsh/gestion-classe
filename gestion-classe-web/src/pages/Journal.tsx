import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { JournalEntryDialog } from '../components/journal/JournalEntryDialog';
import { shortGroup } from '../components/home/homeHelpers';
import { useAuth } from '../hooks/useAuth';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { supabase } from '../lib/supabase';
import { classTone } from '../lib/classColors';
import { fetchClassGroupsForUser } from '../lib/classGroupQueries';
import {
  copyJournalEntry, fetchJournalEntries, journalHeadline, type JournalEntry,
} from '../lib/timetable/lessonJournalQueries';

interface ClassRow { id: string; name: string }

/** 1er août de l'année scolaire en cours : le cahier de texte se lit par année. */
function schoolYearStart(now = new Date()): Date {
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 7, 1);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Cahier de texte (migration 084) : toutes les entrées de l'année, les plus récentes en haut.
 * Sert surtout à rattraper le recopiage dans Pronote (filtre « À recopier »).
 */
export function Journal() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const [params, setParams] = useSearchParams();
  const classFilter = params.get('class');
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [groups, setGroups] = useState<Map<string, string>>(new Map());
  const [open, setOpen] = useState<JournalEntry | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchJournalEntries(user.id, { from: schoolYearStart() }).then(rows => { if (!cancelled) setEntries(rows); });
    supabase.from('classes').select('id, name').eq('user_id', user.id).eq('is_deleted', false).order('name')
      .then(({ data }) => { if (!cancelled) setClasses((data || []) as ClassRow[]); });
    fetchClassGroupsForUser(user.id)
      .then(rows => { if (!cancelled) setGroups(new Map(rows.map(g => [g.id, g.name]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const className = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
  const titleOf = (e: JournalEntry) => {
    const name = (e.classId && className.get(e.classId)) || e.label;
    const group = e.groupId ? groups.get(e.groupId) : null;
    return group ? `${name} · ${shortGroup(group)}` : name;
  };

  const all = useMemo(() => entries ?? [], [entries]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all) if (e.classId) m.set(e.classId, (m.get(e.classId) ?? 0) + 1);
    return m;
  }, [all]);
  const shown = all.filter(e => (!classFilter || e.classId === classFilter) && (!onlyTodo || !e.copiedAt));
  const todo = all.filter(e => (!classFilter || e.classId === classFilter) && !e.copiedAt).length;

  // Regroupées par jour, dans l'ordre (déjà triées du plus récent au plus ancien)
  const days: { key: string; date: Date; items: JournalEntry[] }[] = [];
  for (const e of shown) {
    const key = dayKey(e.startsAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(e); else days.push({ key, date: e.startsAt, items: [e] });
  }
  for (const d of days) d.items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const replace = (prev: JournalEntry, next: JournalEntry | null) => {
    setEntries(list => (list ?? []).flatMap(e => (e.id === prev.id ? (next ? [next] : []) : [e])));
    setOpen(o => (o && o.id === prev.id ? next : o));
  };

  const copy = async (e: JournalEntry) => {
    setCopyingId(e.id);
    try {
      replace(e, await copyJournalEntry(e));
      toast('Entrée copiée : à coller dans Pronote.', 'success');
    } catch (err) {
      console.error(err);
      toast('Impossible de copier l’entrée.');
    } finally {
      setCopyingId(null);
    }
  };

  const setClass = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('class', id); else next.delete('class');
    setParams(next, { replace: true });
  };

  return (
    <Layout fluid>
      <div className="rf-seances journal-page">
        <div className="rf-head">
          <div style={{ minWidth: 0 }}>
            <div className="breadcrumb">
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 12 }}>Accueil</Link>
              <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>›</span>
              <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>Cahier de texte</span>
            </div>
            <div className="rf-head__title">
              <h1 className="page-title">Cahier de texte</h1>
              {todo > 0 && <span className="rf-head__meta">{todo} à recopier dans Pronote</span>}
            </div>
          </div>
          {all.length > 0 && (
            <div className="rf-head__actions">
              <div className="segbtn">
                <button className={`segbtn__b ${!onlyTodo ? 'is-on' : ''}`} onClick={() => setOnlyTodo(false)}>Toutes</button>
                <button className={`segbtn__b ${onlyTodo ? 'is-on' : ''}`} onClick={() => setOnlyTodo(true)}>À recopier</button>
              </div>
            </div>
          )}
        </div>

        {counts.size > 1 && (
          <div className="ses-filters filter-strip rf-filters">
            <button onClick={() => setClass(null)} className={`ses-filter ses-filter--all ${classFilter === null ? 'is-on' : ''}`}>
              Toutes
            </button>
            {classes.filter(c => counts.has(c.id)).map(c => {
              const tone = classTone(c.name);
              return (
                <button
                  key={c.id}
                  onClick={() => setClass(classFilter === c.id ? null : c.id)}
                  className={`ses-filter ${classFilter === c.id ? 'is-on' : ''}`}
                  style={{ '--rf-soft': tone.soft, '--rf-ink': tone.ink, '--rf-solid': tone.solid } as React.CSSProperties}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {entries === null ? (
          <p className="journal-page__muted">Chargement…</p>
        ) : shown.length === 0 ? (
          <div className="rf-empty">
            <h2>{all.length === 0 ? 'Aucune entrée' : onlyTodo ? 'Tout est recopié' : 'Aucune entrée pour cette classe'}</h2>
            {all.length === 0 && (
              <p>Les entrées préparées avec les séances arrivent ici. On en écrit une depuis un cours de l’emploi du temps, sur l’accueil.</p>
            )}
          </div>
        ) : (
          <div className="journal-list">
            {days.map(d => (
              <section key={d.key} className="journal-day">
                <h2 className="journal-day__title">
                  {d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                {d.items.map(e => {
                  const title = titleOf(e);
                  const tone = classTone(title);
                  return (
                    <div key={e.id} className="journal-row">
                      <button type="button" className="journal-row__main" onClick={() => setOpen(e)} title="Lire et retoucher l’entrée">
                        <span className="journal-row__time">
                          {e.startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="journal-row__class" style={{ background: tone.soft, color: tone.ink }}>{title}</span>
                        <span className="journal-row__head journal-headline">{journalHeadline(e.content)}</span>
                      </button>
                      <span className={`journal-chip ${e.copiedAt ? 'journal-chip--done' : ''}`} style={{ cursor: 'default' }}>
                        {e.copiedAt ? '✓ Copiée' : 'À recopier'}
                      </span>
                      <button type="button" className="btn btn--ghost journal-row__copy" onClick={() => copy(e)} disabled={copyingId === e.id}>
                        {copyingId === e.id ? 'Copie…' : 'Copier'}
                      </button>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}

        {open && user && (
          <JournalEntryDialog
            key={open.id}
            userId={user.id}
            lesson={{ start: open.startsAt, end: open.endsAt, label: open.label, classId: open.classId, groupId: open.groupId }}
            title={titleOf(open)}
            entry={open}
            onChange={next => replace(open, next)}
            onClose={() => setOpen(null)}
          />
        )}
      </div>
    </Layout>
  );
}
