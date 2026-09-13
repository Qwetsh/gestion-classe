/**
 * Bibliothèque des tableaux préparés, vue depuis le tableau blanc.
 *
 * Deux modes :
 * - `open` : choisir un tableau préparé (rangé par niveau puis chapitre) pour en copier les pages
 *   dans le tableau courant. Le niveau de la classe (déduit de son nom) est ouvert en premier.
 *   En début de séance, le panneau s'ouvre tout seul sur un tableau vide, avec « Tableau vierge ».
 * - `save` : enregistrer le tableau courant comme nouveau tableau préparé (titre, niveau, chapitre).
 *
 * Même habillage que la bibliothèque de ressources (`.wblb`) : boîte sombre au-dessus de la scène,
 * lignes de 44 px minimum pour le TBI.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  BOARD_LEVELS,
  NO_LEVEL,
  levelRank,
  listBoards,
  type Board,
  type BoardMeta,
} from '../../lib/boardsQueries';

type Props =
  | {
      mode: 'open';
      userId: string;
      /** Niveau à déplier en premier (déduit du nom de la classe), ou null. */
      defaultLevel: string | null;
      /** Tableau courant, à ne pas proposer (on ne s'insère pas soi-même). */
      excludeBoardId?: string | null;
      /** Affiché en début de séance : le bouton « Tableau vierge » ferme sans rien copier. */
      allowBlank?: boolean;
      onPick: (board: Board) => void;
      onClose: () => void;
    }
  | {
      mode: 'save';
      defaultMeta: BoardMeta;
      onSave: (meta: BoardMeta) => Promise<void> | void;
      onClose: () => void;
    };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function BoardLibraryDialog(props: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wblb wblb--boards" onPointerDown={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="wblb__box" onPointerDown={(e) => e.stopPropagation()}>
        <style>{CSS}</style>
        {props.mode === 'open' ? <OpenView {...props} /> : <SaveView {...props} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function OpenView({ userId, defaultLevel, excludeBoardId, allowBlank, onPick, onClose }: Extract<Props, { mode: 'open' }>) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<string>(defaultLevel ?? 'all');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listBoards(userId)
      .then((b) => { if (!cancelled) setBoards(b.filter((x) => x.id !== excludeBoardId)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible'); });
    return () => { cancelled = true; };
  }, [userId, excludeBoardId]);

  /** Niveau → chapitre → tableaux, filtrés par la recherche et le niveau choisi. */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (b: Board) => !q || `${b.title} ${b.chapter ?? ''} ${b.level ?? ''}`.toLowerCase().includes(q);
    const byLevel = new Map<string, Map<string, Board[]>>();
    for (const b of boards ?? []) {
      const lv = b.level ?? NO_LEVEL;
      if (level !== 'all' && lv !== level) continue;
      if (!match(b)) continue;
      const chapters = byLevel.get(lv) ?? new Map<string, Board[]>();
      const ch = b.chapter ?? '';
      chapters.set(ch, [...(chapters.get(ch) ?? []), b]);
      byLevel.set(lv, chapters);
    }
    return [...byLevel.entries()]
      .sort((a, b) => levelRank(a[0] === NO_LEVEL ? null : a[0]) - levelRank(b[0] === NO_LEVEL ? null : b[0]))
      .map(([lv, chapters]) => ({
        level: lv,
        chapters: [...chapters.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'fr'))),
      }));
  }, [boards, query, level]);

  const levelsPresent = useMemo(() => {
    const set = new Set((boards ?? []).map((b) => b.level ?? NO_LEVEL));
    return [...BOARD_LEVELS, NO_LEVEL].filter((l) => set.has(l));
  }, [boards]);

  const pick = (b: Board) => { setBusy(b.id); onPick(b); };

  return (
    <>
      <div className="wblb__head">
        <div className="wblb__title">
          <strong>Tableaux préparés</strong>
          <small>{allowBlank ? 'Partir d’un tableau préparé, ou commencer sur une page vierge.' : 'Les pages du tableau choisi sont copiées ici ; l’original ne bouge pas.'}</small>
        </div>
        <button type="button" className="wblb__close" onClick={onClose} title="Fermer (Échap)">✕</button>
      </div>
      <div className="wblb__search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un titre ou un chapitre…" autoFocus />
        <select value={level} onChange={(e) => setLevel(e.target.value)} title="Niveau">
          <option value="all">Tous les niveaux</option>
          {levelsPresent.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="wblb__body">
        {error && <div className="wblb__notice">{error}</div>}
        {boards === null && !error && <div className="wblb__empty">Chargement…</div>}
        {boards !== null && groups.length === 0 && (
          <div className="wblb__empty">
            {boards.length === 0
              ? 'Aucun tableau préparé pour l’instant. Prépare tes cours depuis « Mes tableaux » sur l’accueil, ou enregistre ce tableau via Plus ⋯ › Fichier.'
              : 'Aucun tableau ne correspond.'}
          </div>
        )}
        {groups.map(({ level: lv, chapters }) => (
          <section key={lv} className="wblb__level">
            <h3>{lv}</h3>
            {chapters.map(([chapter, list]) => (
              <div key={chapter || '—'} className="wblb__chapter">
                {chapter && <h4>{chapter}</h4>}
                <div className="wblb__list">
                  {list.map((b) => (
                    <button key={b.id} type="button" className="wblb__row wblb__row--pick" disabled={busy !== null} onClick={() => pick(b)}>
                      <span className="wblb__icon">📋</span>
                      <div>
                        <span>{b.title}</span>
                        <small>modifié le {fmtDate(b.updated_at)}</small>
                      </div>
                      <span className="wblb__go">{busy === b.id ? '…' : 'Ouvrir'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      {allowBlank && (
        <div className="wblb__foot">
          <button type="button" className="wblb__primary is-secondary" onClick={onClose}>Tableau vierge</button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function SaveView({ defaultMeta, onSave, onClose }: Extract<Props, { mode: 'save' }>) {
  const [title, setTitle] = useState(defaultMeta.title);
  const [level, setLevel] = useState(defaultMeta.level ?? '');
  const [chapter, setChapter] = useState(defaultMeta.chapter ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), level: level || null, chapter: chapter.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="wblb__head">
        <div className="wblb__title">
          <strong>Enregistrer dans Mes tableaux</strong>
          <small>Une copie des pages actuelles devient un tableau préparé, réutilisable dans d’autres séances.</small>
        </div>
        <button type="button" className="wblb__close" onClick={onClose} title="Fermer (Échap)">✕</button>
      </div>
      <div className="wblb__form">
        <label>
          <span>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fractions — introduction" autoFocus required />
        </label>
        <div className="wblb__form-row">
          <label>
            <span>Niveau</span>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Sans niveau</option>
              {BOARD_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label>
            <span>Chapitre</span>
            <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="Nombres, Thalès, Volcans…" />
          </label>
        </div>
        {error && <div className="wblb__notice">{error}</div>}
      </div>
      <div className="wblb__foot">
        <button type="button" className="wblb__primary is-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="wblb__primary" disabled={busy || !title.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  );
}

const CSS = `
/* Socle structurel repris de BoardLibraryPanel (son <style> n'est présent que quand il est monté) ;
   l'habillage final vient de wb-theme.css (.wblb.wblb …), plus spécifique. */
.wblb { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; background: rgba(17,24,39,0.55); font: 400 15px/1.4 Inter, system-ui, sans-serif; }
.wblb__box { width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 140px); display: flex; flex-direction: column; background: #111827; color: #F3F4F6; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.5); overflow: hidden; }
.wblb__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px 0; }
.wblb__close { flex: none; width: 36px; height: 36px; border: 0; border-radius: 50%; background: #1F2937; color: #E5E7EB; cursor: pointer; }
.wblb__search { display: flex; gap: 8px; padding: 12px 16px 6px; }
.wblb__search input { flex: 1; min-width: 0; height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 17px/1 Inter, system-ui, sans-serif; }
.wblb__search select { height: 46px; padding: 0 14px; border: 0; border-radius: 12px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb__notice { margin: 4px 16px 6px; padding: 10px 12px; border-radius: 10px; background: #1F2937; color: #FCD34D; font-size: 13px; }
.wblb__body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
.wblb__body h3 { margin: 12px 0 8px; font: 600 12px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wblb__empty { color: #9CA3AF; font-size: 15px; padding: 8px 0; }
.wblb__list { display: flex; flex-direction: column; gap: 8px; }
.wblb__row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: #1F2937; }
.wblb__row > div { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.wblb__row small { color: #9CA3AF; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wblb__primary { height: 36px; padding: 0 12px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb--boards .wblb__box { width: min(760px, calc(100vw - 32px)); }
.wblb__title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.wblb__title strong { font: 700 18px/1.2 Inter, system-ui, sans-serif; }
.wblb__title small { color: #9CA3AF; font-size: 13px; }
.wblb__level h3 { margin: 14px 0 6px; }
.wblb__chapter h4 { margin: 8px 0 6px; font: 600 13px/1 Inter, system-ui, sans-serif; color: #C7D2FE; }
.wblb__row--pick { width: 100%; min-height: 56px; text-align: left; border: 0; color: #F3F4F6; font: inherit; cursor: pointer; }
.wblb__row--pick:hover { outline: 2px solid #6366F1; }
.wblb__row--pick:disabled { opacity: .6; cursor: default; }
.wblb__row--pick > div > span { font-weight: 600; font-size: 16px; }
.wblb__icon { font-size: 22px; flex: none; }
.wblb__go { flex: none; padding: 8px 12px; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif; }
.wblb__foot { display: flex; justify-content: flex-end; gap: 10px; padding: 10px 16px 16px; }
.wblb__primary { min-height: 44px; }
.wblb__primary.is-secondary { background: #374151; }
.wblb__primary:disabled { opacity: .5; cursor: default; }
.wblb__form { display: flex; flex-direction: column; gap: 12px; padding: 12px 16px 4px; }
.wblb__form label { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.wblb__form label span { font: 600 12px/1 Inter, system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; color: #9CA3AF; }
.wblb__form input, .wblb__form select { height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 16px/1 Inter, system-ui, sans-serif; }
.wblb__form-row { display: flex; gap: 12px; }
@media (max-width: 560px) { .wblb__form-row { flex-direction: column; } }
`;
