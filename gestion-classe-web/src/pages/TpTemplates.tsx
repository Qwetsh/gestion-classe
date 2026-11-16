/**
 * Mes TP : les modèles de TP rangés niveau › séquence, comme « Mes cours » (migration 079).
 *
 * Un TP porte sa fiche complète (problématique, matériel par poste, protocole, sécurité) et son
 * barème, repris tel quel au lancement d'une séance de groupe. `?ouvrir=<id>` ouvre une fiche.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { TpLibrary } from '../components/tp/TpLibrary';
import { TpSheet } from '../components/tp/TpSheet';
import { TpForm } from '../components/tp/TpForm';
import { activityIndex, activityOfTp, filterTps, groupTps, themesOf, tpSearchWords, type ActivityBoard } from '../lib/tpLibrary';
import { listBoards } from '../lib/boardsQueries';
import { deleteTp, listTps, saveTp, type Tp, type TpDraft } from '../lib/tpQueries';
import { printTp } from '../lib/tpPrint';
import '../styles/mes-cours.css';
import '../styles/mes-tp.css';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function TpTemplates() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { toast, confirm } = useUIFeedback();
  const [params, setParams] = useSearchParams();

  const [tps, setTps] = useState<Tp[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tp | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<string | null>(null);
  // Cours de « Mes cours » : chaque TP s'y relie à son activité (même séquence, même numéro)
  const [boards, setBoards] = useState<ActivityBoard[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setTps(await listTps(userId));
      setError(null);
    } catch (err) {
      setError(message(err, 'La liste des TP ne répond pas.'));
    } finally {
      setReady(true);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listBoards(userId)
      .then((list) => { if (!cancelled) setBoards(list.map(({ id, title, level, chapter }) => ({ id, title, level: level ?? null, chapter: chapter ?? null }))); })
      .catch(() => { /* sans les cours, les TP restent lisibles, simplement pas reliés */ });
    return () => { cancelled = true; };
  }, [userId]);
  const activities = useMemo(() => activityIndex(boards), [boards]);

  // ---- Fiche ouverte par l'adresse ----
  const openId = params.get('ouvrir');
  const opened = openId ? tps.find((t) => t.id === openId) ?? null : null;
  const open = (tp: Tp) => setParams({ ouvrir: tp.id });
  const closeSheet = () => setParams({}, { replace: true });

  // ---- Recherche et filtre par thème ----
  const words = useMemo(() => tpSearchWords(query), [query]);
  const themes = useMemo(() => themesOf(tps), [tps]);
  const activeTheme = theme && themes.includes(theme) ? theme : null;
  const shown = useMemo(() => filterTps(tps, words, activeTheme), [tps, words, activeTheme]);
  const levels = useMemo(() => groupTps(shown), [shown]);
  const filtering = words.length > 0 || activeTheme !== null;

  // ---- Actions ----
  const save = async (draft: TpDraft) => {
    const id = await saveTp(userId, draft, editing && editing !== 'new' ? editing.id : undefined);
    setEditing(null);
    await refresh();
    setParams({ ouvrir: id }, { replace: true });
  };

  const duplicate = async (tp: Tp) => {
    try {
      const draft: TpDraft = {
        name: `${tp.name} (copie)`, color: tp.color, theme: tp.theme, level: tp.level, chapter: tp.chapter,
        activity: tp.activity, problem: tp.problem, duration_min: tp.duration_min, modality: tp.modality,
        materials: tp.materials, protocol: tp.protocol, safety: tp.safety,
        criteria: tp.criteria.map((c) => ({ label: c.label, max_points: c.max_points, hint: c.hint })),
      };
      await saveTp(userId, draft);
      toast(`Copie créée : « ${tp.name} (copie) ».`, 'success');
      await refresh();
    } catch (err) {
      toast(message(err, 'Copie impossible.'));
    }
  };

  const print = (tp: Tp) => {
    if (!printTp(tp)) toast('Le navigateur a bloqué la fenêtre d’impression : autorise les fenêtres pour ce site.');
  };

  const remove = async (tp: Tp) => {
    const ok = await confirm({
      title: 'Supprimer ce TP ?',
      message: `« ${tp.name} », son barème et ses photos seront supprimés.`,
      details: tp.usage_count > 0 ? `Les séances déjà notées gardent leur propre barème et leurs notes.` : undefined,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteTp(tp.id);
      setTps((prev) => prev.filter((x) => x.id !== tp.id));
      if (openId === tp.id) closeSheet();
    } catch (err) {
      toast(message(err, 'Suppression impossible.'));
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Mes TP</h1>
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>+ Nouveau TP</button>
        </div>

        {error && <p className="mc-error" role="alert">{error}</p>}

        {ready && !error && tps.length === 0 && (
          <div className="mc-empty">
            Aucun TP pour l’instant. « + Nouveau TP » crée une fiche avec son matériel, son protocole et son barème ; elle se range ici par niveau et par séquence.
          </div>
        )}

        {tps.length > 0 && (
          <div className="tp-toolbar">
            <label className="mc-search">
              <Search size={16} className="mc-search__icon" aria-hidden />
              <input
                type="search"
                className="mc-search__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
                placeholder="Chercher un TP, une séquence, du matériel"
                aria-label="Chercher dans mes TP"
              />
            </label>
            {themes.length > 1 && (
              <div className="mc-views" role="tablist" aria-label="Thème">
                <button type="button" role="tab" aria-selected={activeTheme === null} className="mc-view" onClick={() => setTheme(null)}>Tous</button>
                {themes.map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={activeTheme === t} className="mc-view" onClick={() => setTheme(activeTheme === t ? null : t)}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {filtering && shown.length === 0 && (
          <div className="mc-empty">Aucun TP ne correspond{query.trim() ? ` à « ${query.trim()} »` : ''}.</div>
        )}

        {levels.length > 0 && (
          <TpLibrary
            levels={levels}
            expandAll={filtering}
            onOpen={open}
            onEdit={setEditing}
            onDuplicate={(tp) => void duplicate(tp)}
            onPrint={print}
            onDelete={(tp) => void remove(tp)}
          />
        )}
      </div>

      {opened && !editing && (
        <TpSheet tp={opened} activity={activityOfTp(opened, activities)} onClose={closeSheet} onEdit={() => setEditing(opened)} onPrint={() => print(opened)} />
      )}

      {editing && (
        <TpForm
          userId={userId}
          tp={editing === 'new' ? null : editing}
          all={tps}
          boards={boards}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </Layout>
  );
}
