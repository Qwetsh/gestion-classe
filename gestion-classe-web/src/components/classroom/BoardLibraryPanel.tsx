/**
 * Panneau « Ressources » : bibliothèque d'objets (par module de matière), annales de Brevet,
 * base Notion, Google Drive. Un tap insère dans la page.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  LIBRARY_MODULES,
  LIBRARY_STROKE,
  libraryCatalog,
  loadEnabledModules,
  saveEnabledModules,
  type LibraryItem,
} from '../../lib/boardLibrary';
import {
  BREVET_SUBJECTS,
  fetchBrevetFile,
  fetchNotionImage,
  fetchNotionPage,
  listBrevets,
  loadDriveKeys,
  loadNotionDatabaseId,
  pickFromGoogleDrive,
  queryNotion,
  saveDriveKeys,
  saveNotionDatabaseId,
  type DriveKeys,
  type NotionEntry,
  type NotionPageBody,
} from '../../lib/boardSources';
import { MissingKeyError } from '../../lib/boardSearch';
import type { Matiere } from '../../lib/brevets';

interface Props {
  onInsertItem: (item: LibraryItem) => void;
  onInsertFiles: (files: File[]) => Promise<void> | void;
  onInsertText: (html: string) => void;
  onInsertImageUrl: (url: string, title: string) => Promise<void> | void;
  onInsertImageBlob: (blob: Blob, title: string) => Promise<void> | void;
  onClose: () => void;
}

type Tab = 'library' | 'brevet' | 'notion' | 'drive';

export function LibraryIcon({ item, size = 44, color = '#111827' }: { item: LibraryItem; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="-6 -6 112 112" style={{ color }}>
      {item.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.mode === 'fill' || p.mode === 'both' ? 'currentColor' : 'none'}
          fillOpacity={p.mode === 'fill' || p.mode === 'both' ? 0.25 : undefined}
          stroke={p.mode === 'fill' ? 'none' : 'currentColor'}
          strokeWidth={LIBRARY_STROKE * (p.width ?? 1)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={p.dashed ? '4 3' : undefined}
        />
      ))}
    </svg>
  );
}

export function BoardLibraryPanel({ onInsertItem, onInsertFiles, onInsertText, onInsertImageUrl, onInsertImageBlob, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [modules, setModules] = useState<string[]>(() => loadEnabledModules());
  const [showModules, setShowModules] = useState(false);
  const [subject, setSubject] = useState<Matiere | 'all'>('SVT');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notionDb, setNotionDb] = useState(() => loadNotionDatabaseId());
  const [notionResults, setNotionResults] = useState<NotionEntry[]>([]);
  /** Corps des pages ouvertes (aperçu des images), par entrée. */
  const [notionBodies, setNotionBodies] = useState<Record<string, NotionPageBody | 'loading'>>({});
  const [driveKeys, setDriveKeys] = useState<DriveKeys>(() => loadDriveKeys());

  useEffect(() => { saveEnabledModules(modules); }, [modules]);
  useEffect(() => { setNotice(null); }, [tab]);

  const catalog = useMemo(() => libraryCatalog(modules, query), [modules, query]);
  const sujets = useMemo(() => listBrevets(subject, query), [subject, query]);

  const insertBrevet = async (code: string) => {
    const b = sujets.find((s) => s.code === code);
    if (!b) return;
    setBusy(code);
    try { await onInsertFiles([await fetchBrevetFile(b)]); onClose(); }
    catch (err) { setNotice(`Sujet impossible à charger : ${err instanceof Error ? err.message : 'erreur'}`); }
    finally { setBusy(null); }
  };

  const runNotion = async () => {
    setBusy('notion');
    setNotice(null);
    try {
      const list = await queryNotion(notionDb, query);
      setNotionResults(list);
      if (list.length === 0) setNotice('Aucune entrée (vérifier le filtre, ou que la base est partagée avec la connexion « Gestion Classe »).');
    } catch (err) { setNotionResults([]); setNotice(err instanceof MissingKeyError ? err.hint : `Notion : ${err instanceof Error ? err.message : 'erreur'}`); }
    finally { setBusy(null); }
  };

  // Charge la base dès l'ouverture de l'onglet si un identifiant est connu
  useEffect(() => {
    if (tab === 'notion' && notionDb && notionResults.length === 0 && busy === null) void runNotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /** Ouvre (ou referme) l'aperçu d'une entrée : texte et images de la page. */
  const toggleNotionEntry = async (e: NotionEntry) => {
    if (notionBodies[e.id]) { setNotionBodies((prev) => { const next = { ...prev }; delete next[e.id]; return next; }); return; }
    setNotionBodies((prev) => ({ ...prev, [e.id]: 'loading' }));
    const body = await fetchNotionPage(e.id);
    setNotionBodies((prev) => ({ ...prev, [e.id]: body }));
  };

  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

  /** Insère le texte d'une entrée (étiquettes, puis paragraphes de la page si déjà chargés). */
  const insertNotionText = (e: NotionEntry) => {
    const body = notionBodies[e.id];
    const bodyText = body && body !== 'loading' ? body.text : '';
    const lines = [...e.text.split('\n'), ...(bodyText ? ['', ...bodyText.split('\n')] : [])].filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''));
    onInsertText(`<div><b>${esc(e.title)}</b></div>${lines.map((l) => `<div>${esc(l) || '<br>'}</div>`).join('')}`);
    onClose();
  };

  /**
   * Insère une image précise. Les fichiers Notion (S3 signé) sont relayés par la fonction :
   * le navigateur, qui a déjà affiché la vignette sans CORS, refuse ensuite de la relire.
   */
  const insertNotionImage = async (url: string, title: string) => {
    setBusy(url);
    try {
      const blob = await fetchNotionImage(url);
      if (blob) await onInsertImageBlob(blob, title);
      else await onInsertImageUrl(url, title);
      onClose();
    } catch (err) {
      setNotice(`Image impossible à insérer : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally {
      setBusy(null);
    }
  };

  const runDrive = async () => {
    setBusy('drive');
    setNotice(null);
    try {
      const picked = await pickFromGoogleDrive(driveKeys);
      if (!picked) return;
      await onInsertFiles([new File([picked.blob], picked.file.name, { type: picked.file.mimeType })]);
      onClose();
    } catch (err) {
      setNotice(err instanceof MissingKeyError ? err.hint : `Drive : ${err instanceof Error ? err.message : 'erreur'}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="wblb" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="wblb__box" onClick={(e) => e.stopPropagation()}>
        <div className="wblb__head">
          <div className="wblb__tabs">
            {([['library', '🧪 Bibliothèque'], ['brevet', '📚 Annales'], ['notion', '🗂 Notion'], ['drive', '☁️ Drive']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} type="button" className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          <button type="button" className="wblb__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>

        {(tab === 'library' || tab === 'brevet' || tab === 'notion') && (
          <div className="wblb__search">
            <input value={query} placeholder={tab === 'library' ? 'Chercher un objet (bécher, cellule, pile…)' : tab === 'brevet' ? 'Année, centre, thème…' : 'Filtrer les entrées'} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && tab === 'notion') void runNotion(); }} />
            {tab === 'library' && <button type="button" className={showModules ? 'is-on' : ''} onClick={() => setShowModules((v) => !v)}>Modules</button>}
            {tab === 'brevet' && (
              <select value={subject} onChange={(e) => setSubject(e.target.value as Matiere | 'all')}>
                <option value="all">Toutes matières</option>
                {BREVET_SUBJECTS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {tab === 'notion' && <button type="button" className="is-on" disabled={busy === 'notion'} onClick={() => void runNotion()}>{busy === 'notion' ? '…' : 'Charger'}</button>}
          </div>
        )}
        {notice && <div className="wblb__notice">{notice}</div>}

        {tab === 'library' && showModules && (
          <div className="wblb__modules">
            {LIBRARY_MODULES.map((m) => (
              <label key={m.id} className={modules.includes(m.id) ? 'is-on' : ''}>
                <input type="checkbox" checked={modules.includes(m.id)} onChange={(e) => setModules((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)))} />
                <span>{m.icon}</span>{m.label}
              </label>
            ))}
          </div>
        )}

        <div className="wblb__body">
          {tab === 'library' && catalog.map(({ category, items }) => (
            <section key={category.id}>
              <h3>{category.label}</h3>
              <div className="wblb__grid">
                {items.map((it) => (
                  <button key={it.id} type="button" className="wblb__item" onClick={() => { onInsertItem(it); onClose(); }} title={it.label}>
                    <LibraryIcon item={it} />
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {tab === 'library' && catalog.length === 0 && <p className="wblb__empty">Aucun objet : activer un module ou changer la recherche.</p>}

          {tab === 'brevet' && (
            <div className="wblb__list">
              {sujets.map((b) => (
                <div key={b.code} className="wblb__row">
                  <div>
                    <b>{b.annee} · {b.centre}</b>
                    <small>{b.matiere} — {b.theme} · {b.tailleKo} Ko</small>
                  </div>
                  <button type="button" disabled={busy !== null} onClick={() => void insertBrevet(b.code)}>{busy === b.code ? 'Chargement…' : 'Insérer les pages'}</button>
                  <a href={b.url} target="_blank" rel="noreferrer">↗</a>
                </div>
              ))}
              {sujets.length === 0 && <p className="wblb__empty">Aucun sujet pour cette matière (les sujets s'ajoutent depuis l'onglet Annales de l'app).</p>}
            </div>
          )}

          {tab === 'notion' && (
            <div className="wblb__list">
              <label className="wblb__field">
                Identifiant de la base Notion
                <input value={notionDb} placeholder="32 caractères, copiés depuis l'URL de la base" onChange={(e) => { setNotionDb(e.target.value); saveNotionDatabaseId(e.target.value); }} onKeyDown={(e) => e.stopPropagation()} />
              </label>
              {notionResults.map((e) => {
                const body = notionBodies[e.id];
                const open = body !== undefined;
                const images = body && body !== 'loading' ? [...(e.image ? [{ url: e.image, caption: '' }] : []), ...body.images.filter((im) => im.url !== e.image)] : [];
                return (
                  <div key={e.id} className={`wblb__entry ${open ? 'is-open' : ''}`}>
                    <div className="wblb__row">
                      {e.image && <img className="wblb__cover" src={e.image} alt="" loading="lazy" onClick={() => void insertNotionImage(e.image!, e.title)} title="Insérer cette image" />}
                      <div>
                        <b>{e.title}</b>
                        <small>{e.text.replace(/\n/g, ' · ').slice(0, 160)}</small>
                      </div>
                      <button type="button" className={open ? 'is-secondary' : ''} disabled={busy !== null} onClick={() => void toggleNotionEntry(e)}>{body === 'loading' ? 'Lecture…' : open ? 'Fermer' : 'Voir la page'}</button>
                      <button type="button" className="is-secondary" disabled={busy !== null} onClick={() => insertNotionText(e)} title="Insérer le titre et le texte en zone de texte">Texte</button>
                      <a href={e.url} target="_blank" rel="noreferrer">↗</a>
                    </div>
                    {open && body !== 'loading' && (
                      <div className="wblb__page">
                        {body.text && <p className="wblb__excerpt">{body.text.slice(0, 400)}{body.text.length > 400 ? '…' : ''}</p>}
                        {images.length > 0 ? (
                          <div className="wblb__images">
                            {images.map((im, i) => (
                              <button key={`${im.url}-${i}`} type="button" className="wblb__thumb" disabled={busy !== null} onClick={() => void insertNotionImage(im.url, im.caption || e.title)} title={im.caption || 'Insérer cette image'}>
                                <img src={im.url} alt="" loading="lazy" />
                                {im.caption && <span>{im.caption}</span>}
                                {busy === im.url && <span className="wblb__thumb-busy">…</span>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="wblb__empty">Aucune image dans cette page.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'drive' && (
            <div className="wblb__list">
              <p className="wblb__empty">Choisir un document, une image ou un PDF dans Google Drive ; les Google Docs / Slides sont convertis en PDF (une page du tableau par page).</p>
              <label className="wblb__field">Client ID OAuth Google<input value={driveKeys.clientId ?? ''} onChange={(e) => { const k = { ...driveKeys, clientId: e.target.value }; setDriveKeys(k); saveDriveKeys(k); }} onKeyDown={(e) => e.stopPropagation()} placeholder="….apps.googleusercontent.com" /></label>
              <label className="wblb__field">Clé API Google (Picker)<input value={driveKeys.apiKey ?? ''} onChange={(e) => { const k = { ...driveKeys, apiKey: e.target.value }; setDriveKeys(k); saveDriveKeys(k); }} onKeyDown={(e) => e.stopPropagation()} placeholder="AIza…" /></label>
              <button type="button" className="wblb__primary" disabled={busy === 'drive'} onClick={() => void runDrive()}>{busy === 'drive' ? 'Ouverture…' : 'Ouvrir Google Drive'}</button>
              <p className="wblb__empty">OneDrive : à venir (Microsoft Graph). En attendant, glisser-déposer le fichier depuis l'explorateur.</p>
            </div>
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wblb { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-start; justify-content: center; padding-top: 40px; background: rgba(17,24,39,0.55); font: 400 15px/1.4 Inter, system-ui, sans-serif; }
.wblb__box { width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 140px); display: flex; flex-direction: column; background: #111827; color: #F3F4F6; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.5); overflow: hidden; }
.wblb__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 0; }
.wblb__tabs { display: flex; gap: 6px; }
.wblb__tabs button { height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb__tabs button.is-on { background: #4F46E5; color: #FFFFFF; }
.wblb__close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: #1F2937; color: #E5E7EB; cursor: pointer; }
.wblb__search { display: flex; gap: 8px; padding: 12px 16px 6px; }
.wblb__search input { flex: 1; height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 17px/1 Inter, system-ui, sans-serif; }
.wblb__search button, .wblb__search select { height: 46px; padding: 0 14px; border: 0; border-radius: 12px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb__search button.is-on { background: #4F46E5; color: #FFFFFF; }
.wblb__notice { margin: 4px 16px 6px; padding: 10px 12px; border-radius: 10px; background: #1F2937; color: #FCD34D; font-size: 13px; }
.wblb__modules { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 16px 8px; }
.wblb__modules label { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #1F2937; cursor: pointer; font-size: 13px; }
.wblb__modules label.is-on { background: #312E81; }
.wblb__modules input { accent-color: #6366F1; }
.wblb__body { flex: 1; overflow-y: auto; padding: 4px 16px 16px; }
.wblb__body h3 { margin: 12px 0 8px; font: 600 12px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wblb__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.wblb__item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px; border: 0; border-radius: 12px; background: #FFFFFF; color: #111827; font: 500 12px/1.2 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb__item:hover { outline: 3px solid #6366F1; }
.wblb__item span { text-align: center; }
.wblb__empty { color: #9CA3AF; font-size: 13px; }
.wblb__list { display: flex; flex-direction: column; gap: 8px; }
.wblb__row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: #1F2937; }
.wblb__row > div { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.wblb__row small { color: #9CA3AF; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wblb__row button, .wblb__primary { height: 36px; padding: 0 12px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wblb__row button:disabled { opacity: 0.5; }
.wblb__row a { color: #A5B4FC; text-decoration: none; font-weight: 600; }
.wblb__entry { border-radius: 12px; background: #1F2937; }
.wblb__entry .wblb__row { background: transparent; }
.wblb__entry.is-open { outline: 2px solid #4F46E5; }
.wblb__cover { width: 64px; height: 48px; object-fit: cover; border-radius: 6px; background: #374151; cursor: pointer; flex: none; }
.wblb__row button.is-secondary { background: #374151; }
.wblb__page { padding: 0 12px 12px; }
.wblb__excerpt { margin: 0 0 10px; color: #D1D5DB; font-size: 13px; white-space: pre-line; }
.wblb__images { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.wblb__thumb { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 0; border: 2px solid transparent; border-radius: 10px; background: #111827; overflow: hidden; cursor: pointer; color: #E5E7EB; font: 500 11px/1.3 Inter, system-ui, sans-serif; }
.wblb__thumb:hover { border-color: #6366F1; }
.wblb__thumb img { width: 100%; height: 110px; object-fit: contain; background: #FFFFFF; display: block; }
.wblb__thumb span { padding: 0 6px 6px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wblb__thumb-busy { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.6); font-size: 24px; }
.wblb__field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #9CA3AF; }
.wblb__field input { height: 40px; padding: 0 10px; border-radius: 8px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 13px/1 "IBM Plex Mono", ui-monospace, monospace; }
.wblb__primary { align-self: flex-start; height: 44px; padding: 0 18px; }
`;
