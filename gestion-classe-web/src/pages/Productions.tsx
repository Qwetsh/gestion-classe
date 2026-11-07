import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { ActivityClassPanel } from '../components/productions/ActivityClassPanel';
import { fetchActivities, type ActivityRow, type WorkRow } from '../lib/productionsQueries';

/**
 * Productions : les fiches d'activité que les élèves remplissent dans une application
 * (« Terre en mouvement »…) et envoient avec leur code. Liste des activités à gauche ; à droite,
 * l'activité pour une classe (components/productions/ActivityClassPanel.tsx, partagé avec la
 * fiche de l'éval liée). Depuis la phase 6 du hub Évaluations, la page n'est plus dans le menu :
 * tout se fait depuis la fiche de l'éval. Elle reste joignable (bandeau des envois mis de côté).
 */
export function Productions() {
  const { toast: showToast } = useUIFeedback();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const activity = useMemo(() => activities.find((a) => a.id === activityId) ?? null, [activities, activityId]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchActivities();
      setActivities(rows);
      setActivityId((cur) => cur ?? rows[0]?.id ?? null);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadActivities(); }, [loadActivities]);

  // Classes présentes dans les envois de cette activité.
  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of works) if (w.class_id && w.activity_id === activityId) m.set(w.class_id, w.classes?.name ?? '?');
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [works, activityId]);
  const shownClassId = classId && classOptions.some(([id]) => id === classId) ? classId : classOptions[0]?.[0] ?? '';
  const className = classOptions.find(([id]) => id === shownClassId)?.[1] ?? '';

  const classPicker = (
    <>
      <label htmlFor="productions-classe" style={{ fontSize: 13, fontWeight: 600 }}>Classe</label>
      <select id="productions-classe" value={shownClassId} onChange={(e) => setClassId(e.target.value)} style={{ ...inp, width: 160 }}>
        {classOptions.length === 0 && <option value="">—</option>}
        {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </>
  );

  return (
    <Layout fluid>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Productions</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Fiches d’activité remplies dans une application et envoyées par les élèves avec leur code.
          Chaque activité se retrouve aussi dans la fiche de son éval, dans Évaluations.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
      ) : activities.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune production reçue pour l’instant. Une activité apparaît ici dès qu’un élève envoie sa première fiche depuis l’application.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          {/* ---- Activités ---- */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              {activities.length} activité{activities.length > 1 ? 's' : ''}
            </div>
            {activities.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActivityId(a.id); setClassId(''); setWorks([]); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', cursor: 'pointer',
                  background: a.id === activityId ? 'var(--surface-3)' : 'transparent', borderBottom: '1px solid var(--border)',
                  color: 'var(--text)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[a.level, a.sequence].filter(Boolean).join(' · ')} · /{a.bareme_total}
                  {!a.accepting_submissions && <span style={{ marginLeft: 6, color: 'var(--neg)' }}>· envois fermés</span>}
                </div>
              </button>
            ))}
          </div>

          {activity && (
            <ActivityClassPanel
              key={activity.id}
              activity={activity}
              classId={shownClassId}
              className={className}
              classPicker={classPicker}
              onActivityChange={(a) => setActivities((as) => as.map((x) => (x.id === a.id ? a : x)))}
              onWorksLoaded={setWorks}
            />
          )}
        </div>
      )}
    </Layout>
  );
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 };
