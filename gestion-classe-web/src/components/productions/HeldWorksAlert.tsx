import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { acceptHeldWorks, fetchHeldWorks, type HeldWorkRow } from '../../lib/productionsQueries';

/**
 * Alerte « des élèves travaillent sur une activité fermée » (migration 051).
 * Quand les envois d'une activité sont fermés, les fiches des élèves (brouillons compris, toutes les 20 s
 * environ) sont mises de côté au lieu d'être refusées. Ce bandeau, affiché sur toutes les pages, le signale
 * dans la minute et propose « Rouvrir et récupérer ». Si le navigateur l'autorise, une notification système
 * prévient aussi quand gestion-classe est dans un autre onglet.
 */
const INTERVALLE_MS = 60_000;
const heure = (t: string) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

interface Groupe { activityId: string; title: string; rows: HeldWorkRow[]; last: string }

function grouper(rows: HeldWorkRow[]): Groupe[] {
  const map = new Map<string, Groupe>();
  for (const r of rows) {
    const g = map.get(r.activity_id) ?? { activityId: r.activity_id, title: r.activities?.title ?? 'Activité', rows: [], last: r.last_at };
    g.rows.push(r);
    if (r.last_at > g.last) g.last = r.last_at;
    map.set(r.activity_id, g);
  }
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

export function HeldWorksAlert() {
  const { toast, confirm } = useUIFeedback();
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notifPossible, setNotifPossible] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'default');
  const dernierVu = useRef<string>('');

  const charger = useCallback(async () => {
    try {
      const rows = await fetchHeldWorks();
      const gs = grouper(rows);
      setGroupes(gs);
      // Nouvelle fiche bloquée depuis le dernier passage : notification système (si autorisée et onglet caché).
      const plusRecent = rows[0]?.last_at ?? '';
      if (plusRecent && dernierVu.current && plusRecent > dernierVu.current
          && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification('Envois fermés : des élèves travaillent', {
          body: gs.map((g) => `${g.title} : ${g.rows.length} fiche${g.rows.length > 1 ? 's' : ''} bloquée${g.rows.length > 1 ? 's' : ''}`).join('\n'),
          tag: 'gc-held-works',
        });
      }
      if (plusRecent) dernierVu.current = plusRecent;
    } catch { /* hors ligne ou table absente : on réessaiera */ }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, INTERVALLE_MS);
    const focus = () => { if (!document.hidden) charger(); };
    document.addEventListener('visibilitychange', focus);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', focus); };
  }, [charger]);

  // Onglet du navigateur : « ⚠ » devant le titre tant qu'il y a des fiches bloquées.
  useEffect(() => {
    const base = document.title.replace(/^⚠ /, '');
    document.title = groupes.length ? `⚠ ${base}` : base;
  }, [groupes.length]);

  if (groupes.length === 0) return null;

  const recuperer = async (g: Groupe) => {
    const ok = await confirm({
      title: 'Rouvrir les envois et récupérer les fiches ?',
      message: `« ${g.title} » sera rouverte et les ${g.rows.length} fiche${g.rows.length > 1 ? 's' : ''} mise${g.rows.length > 1 ? 's' : ''} de côté seront enregistrées comme des envois normaux.`,
      details: 'Une copie déjà corrigée sera remplacée par la version reçue (elle sera marquée « modifiée après correction »). Une copie validée n’est jamais touchée.',
      confirmLabel: 'Rouvrir et récupérer',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(g.activityId);
    try {
      const r = await acceptHeldWorks(g.activityId);
      toast(`${r.accepted} fiche${r.accepted > 1 ? 's' : ''} récupérée${r.accepted > 1 ? 's' : ''}, envois rouverts.${r.failed ? ` ${r.failed} en échec (code supprimé ?).` : ''}`, r.failed ? 'warning' : 'success');
      await charger();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 16px', background: '#B3261E', color: '#fff' }}>
      {groupes.map((g) => {
        const classes = [...new Set(g.rows.map((r) => r.class_name).filter(Boolean))].join(', ');
        const pseudos = g.rows.flatMap((r) => r.pseudos);
        return (
          <div key={g.activityId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', fontSize: 14 }}>
            <span style={{ flex: '1 1 380px' }}>
              <strong>⚠ Envois fermés pour « {g.title} », mais des élèves travaillent dessus.</strong>{' '}
              {g.rows.length} fiche{g.rows.length > 1 ? 's' : ''} mise{g.rows.length > 1 ? 's' : ''} de côté{classes ? ` (${classes})` : ''}, dernière à {heure(g.last)}
              <span style={{ opacity: 0.85 }}> · {pseudos.slice(0, 6).join(', ')}{pseudos.length > 6 ? `… (+${pseudos.length - 6})` : ''}</span>
            </span>
            <button
              onClick={() => recuperer(g)}
              disabled={busy === g.activityId}
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#fff', color: '#B3261E', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {busy === g.activityId ? 'Récupération…' : 'Rouvrir et récupérer'}
            </button>
            <Link to="/productions" style={{ color: '#fff', fontSize: 13 }}>Voir dans Productions</Link>
          </div>
        );
      })}
      {notifPossible && (
        <button
          onClick={async () => { await Notification.requestPermission(); setNotifPossible(false); }}
          style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'none', color: '#fff', textDecoration: 'underline', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Me prévenir aussi par une notification quand gestion-classe est dans un autre onglet
        </button>
      )}
    </div>
  );
}
