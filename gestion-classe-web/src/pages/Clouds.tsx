/**
 * Page « Mes clouds » : parcourir son OneDrive et son Google Drive depuis Gestion Classe, et ouvrir
 * les fichiers sur place (PDF, Word converti en PDF, images, vidéos, pages HTML, liens Internet).
 * Connexions, clés et dossier de départ sont ceux du panneau « Ressources » du tableau blanc,
 * synchronisés entre appareils (`userKeys.ts`).
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Layout } from '../components/Layout';
import { CloudFileViewer } from '../components/clouds/CloudFileViewer';
import { useAuth } from '../hooks/useAuth';
import {
  CLOUD_PROVIDERS,
  cloudIcon,
  cloudProvider,
  formatSize,
  isCancelled,
  openCloudItem,
  openLocalFile,
  type CloudCrumb,
  type CloudId,
  type CloudItem,
  type CloudProvider,
  type CloudSession,
  type OpenedFile,
} from '../lib/cloudFiles';
import { loadDriveKeys, saveDriveKeys, type DriveKeys } from '../lib/googleDrive';
import { ONEDRIVE_REDIRECT_URI, loadOneDriveKeys, saveOneDriveKeys, type OneDriveKeys } from '../lib/oneDrive';
import { MissingKeyError } from '../lib/boardSearch';
import { pullKeys, setKeysOwner } from '../lib/userKeys';

/** Cloud ouvert : session, fil d'Ariane et contenu affiché. */
interface View { session: CloudSession; path: CloudCrumb[]; items: CloudItem[]; searching: boolean }

interface ViewerState { opened: OpenedFile; title: string; subtitle?: string; webUrl?: string | null; cloudLabel?: string }

const LAST_KEY = 'gc-clouds-last';

const sameCrumbs = (a: CloudCrumb[] | undefined, b: CloudCrumb[]) => !!a && a.length === b.length && a.every((c, i) => c.id === b[i].id);

const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function Clouds() {
  const { user } = useAuth();
  const [keysReady, setKeysReady] = useState(false);
  const [providerId, setProviderId] = useState<CloudId>(() => {
    try { const v = localStorage.getItem(LAST_KEY) as CloudId | null; if (v && CLOUD_PROVIDERS.some((p) => p.id === v)) return v; } catch { /* stockage indisponible */ }
    return 'onedrive';
  });
  const [views, setViews] = useState<Partial<Record<CloudId, View>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [oneDriveKeys, setOneDriveKeys] = useState<OneDriveKeys>({});
  const [driveKeys, setDriveKeys] = useState<DriveKeys>({});
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  /** Fichier en cours d'ouverture (téléchargement, conversion) et étape affichée. */
  const [opening, setOpening] = useState<{ id: string; step: string } | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [dragging, setDragging] = useState(false);
  const attempted = useRef<Set<CloudId>>(new Set());

  const provider = cloudProvider(providerId);
  const view = views[providerId] ?? null;
  const configured = providerId === 'onedrive' ? !!oneDriveKeys.clientId?.trim() : !!driveKeys.clientId?.trim();
  const connecting = busy === `connect:${providerId}`;
  const listing = busy === `list:${providerId}`;
  const home = providerId === 'onedrive' ? oneDriveKeys.home : driveKeys.home;

  const reloadKeys = useCallback(() => { setOneDriveKeys(loadOneDriveKeys()); setDriveKeys(loadDriveKeys()); }, []);

  // Clés du compte → navigateur (comme au démarrage du tableau blanc), puis lecture locale
  useEffect(() => {
    let cancelled = false;
    setKeysOwner(user?.id ?? null);
    reloadKeys();
    pullKeys().finally(() => { if (!cancelled) { reloadKeys(); setKeysReady(true); } });
    return () => { cancelled = true; };
  }, [user?.id, reloadKeys]);

  useEffect(() => { try { localStorage.setItem(LAST_KEY, providerId); } catch { /* stockage indisponible */ } setNotice(null); setShowSetup(false); setQuery(''); }, [providerId]);

  const setView = (id: CloudId, v: View | null) => setViews((prev) => { const next = { ...prev }; if (v) next[id] = v; else delete next[id]; return next; });

  /** Erreur : message lisible ; une session expirée referme la vue pour se reconnecter. */
  const fail = (p: CloudProvider, err: unknown) => {
    if (p.isExpired(err)) setView(p.id, null);
    if (isCancelled(err)) return;
    setNotice(err instanceof MissingKeyError ? err.hint : `${p.label} : ${err instanceof Error ? err.message : 'erreur'}`);
  };

  /** Connexion (silencieuse si possible, sinon fenêtre du fournisseur) puis dossier de départ, ou racine. */
  const open = useCallback(async (p: CloudProvider, interactive: boolean) => {
    setBusy(`connect:${p.id}`);
    setNotice(null);
    try {
      const session = await p.connect(interactive);
      if (!session) return;
      const wanted = p.home() ?? [];
      const target = wanted[wanted.length - 1] ?? null;
      try {
        const items = await p.list(session, target?.id ?? null);
        setView(p.id, { session, path: wanted, items, searching: false });
      } catch (err) {
        if (!target || p.isExpired(err)) throw err;
        const items = await p.list(session, null);
        setView(p.id, { session, path: [], items, searching: false });
        setNotice(`Dossier de départ « ${target.name} » introuvable : ouverture à la racine. Réépingler un dossier si besoin.`);
      }
    } catch (err) { fail(p, err); }
    finally { setBusy(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnexion silencieuse dès l'affichage d'un cloud dont la clé est connue (une fois par cloud)
  useEffect(() => {
    if (!keysReady || view || !configured || busy || attempted.current.has(providerId)) return;
    attempted.current.add(providerId);
    void open(provider, false);
  }, [keysReady, view, configured, busy, providerId, provider, open]);

  /** Ouvre un dossier (`depth` = position dans le fil d'Ariane, -1 pour la racine) ou une racine alternative. */
  const go = async (folder: CloudCrumb | null, depth: number) => {
    if (!view) return;
    setBusy(`list:${providerId}`);
    setNotice(null);
    setQuery('');
    try {
      const path = folder ? [...view.path.slice(0, depth), folder] : view.path.slice(0, depth + 1);
      const target = path[path.length - 1] ?? null;
      const items = await provider.list(view.session, target?.id ?? null);
      setView(providerId, { ...view, path, items, searching: false });
    } catch (err) { fail(provider, err); }
    finally { setBusy(null); }
  };

  const search = async () => {
    if (!view) return;
    const q = query.trim();
    if (!q) { await go(null, view.path.length - 1); return; }
    setBusy(`list:${providerId}`);
    setNotice(null);
    try {
      const scope = provider.scopedSearch ? view.path[view.path.length - 1] ?? null : null;
      const items = await provider.search(view.session, q, scope?.id ?? null);
      setView(providerId, { ...view, items, searching: true });
      if (items.length === 0) setNotice(scope ? `Aucun résultat dans « ${scope.name} » (remonter d'un dossier pour élargir).` : `Aucun résultat dans ${provider.label}.`);
    } catch (err) { fail(provider, err); }
    finally { setBusy(null); }
  };

  const togglePin = () => {
    if (!view) return;
    const pinned = sameCrumbs(home, view.path);
    provider.setHome(pinned || view.path.length === 0 ? undefined : view.path);
    reloadKeys();
  };

  const disconnect = async () => {
    setView(providerId, null);
    attempted.current.add(providerId);
    try { await provider.disconnect(); } catch { /* cache déjà vide */ }
  };

  const openItem = async (item: CloudItem) => {
    if (!view) return;
    if (item.isFolder) { await go({ id: item.id, name: item.name }, view.path.length); return; }
    setOpening({ id: item.id, step: 'Ouverture…' });
    setNotice(null);
    try {
      const opened = await openCloudItem(provider, view.session, item, (step) => setOpening({ id: item.id, step }));
      setViewer({ opened, title: opened.kind === 'link' ? opened.url : item.name, subtitle: `${provider.label}${item.modified ? ` · ${fmtDate(item.modified)}` : ''}`, webUrl: item.webUrl, cloudLabel: provider.label });
    } catch (err) { fail(provider, err); }
    finally { setOpening(null); }
  };

  const download = async (item: CloudItem) => {
    if (!view) return;
    setOpening({ id: item.id, step: 'Téléchargement…' });
    try {
      const file = await provider.fetch(view.session, item);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) { fail(provider, err); }
    finally { setOpening(null); }
  };

  const openLink = () => {
    const raw = linkInput.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setViewer({ opened: { kind: 'link', url }, title: url, subtitle: 'Lien' });
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setOpening({ id: 'local', step: 'Ouverture…' });
    try {
      const opened = await openLocalFile(file, (step) => setOpening({ id: 'local', step }));
      setViewer({ opened, title: opened.kind === 'link' ? opened.url : file.name, subtitle: 'Fichier local' });
    } catch (err) { setNotice(`Fichier impossible à ouvrir : ${err instanceof Error ? err.message : 'erreur'}`); }
    finally { setOpening(null); }
  };

  const saveOneDrive = (k: OneDriveKeys) => { setOneDriveKeys(k); saveOneDriveKeys(k); attempted.current.delete('onedrive'); };
  const saveDrive = (k: DriveKeys) => { setDriveKeys(k); saveDriveKeys(k); attempted.current.delete('google'); };

  const pinned = !!view && sameCrumbs(home, view.path);

  return (
    <Layout>
      <div className={`clouds ${dragging ? 'is-dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => void onDrop(e)}>
        <div className="clouds__top">
          <div>
            <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Mes clouds</h1>
            <p className="text-[var(--text-muted)] mt-1">Parcourir OneDrive et Google Drive, ouvrir PDF, Word, images, vidéos et liens sans quitter Gestion Classe.</p>
          </div>
          <form className="clouds__link" onSubmit={(e) => { e.preventDefault(); openLink(); }}>
            <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="Ouvrir un lien (site, vidéo YouTube, Genially…)" />
            <button type="submit" disabled={!linkInput.trim()}>Ouvrir</button>
          </form>
        </div>

        <div className="clouds__tabs">
          {CLOUD_PROVIDERS.map((p) => (
            <button key={p.id} type="button" className={p.id === providerId ? 'is-on' : ''} onClick={() => setProviderId(p.id)}>
              <span>{p.icon}</span>{p.label}
              {views[p.id] && <i className="clouds__dot" title="Connecté" />}
            </button>
          ))}
        </div>

        {notice && <div className="clouds__notice">{notice}</div>}

        <div className="clouds__panel">
          {!view && connecting && (
            <div className="clouds__loading"><div className="clouds__progress"><span /></div><p>Connexion à {provider.label}…</p></div>
          )}

          {!view && !connecting && (
            <div className="clouds__setup">
              {(!configured || showSetup) && providerId === 'onedrive' && (
                <>
                  <p>Parcourir son OneDrive (personnel ou établissement). Les documents Word, PowerPoint et Excel sont convertis en PDF par Microsoft à l'ouverture.</p>
                  <label>ID d'application (client) Azure<input value={oneDriveKeys.clientId ?? ''} onChange={(e) => saveOneDrive({ ...oneDriveKeys, clientId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
                  <p className="clouds__help">Inscription gratuite sur portal.azure.com › Microsoft Entra ID › Inscriptions d'applications : comptes « organisation et personnels », plateforme « Application monopage », URI de redirection <code>{ONEDRIVE_REDIRECT_URI}</code>.</p>
                </>
              )}
              {(!configured || showSetup) && providerId === 'google' && (
                <>
                  <p>Parcourir « Mon Drive » et les fichiers partagés. Les Google Docs, Slides et Sheets sont exportés en PDF par Google ; un fichier Word déposé tel quel est converti dans le navigateur.</p>
                  <label>ID client OAuth Google<input value={driveKeys.clientId ?? ''} onChange={(e) => saveDrive({ ...driveKeys, clientId: e.target.value })} placeholder="….apps.googleusercontent.com" /></label>
                  <label>Clé API Google (facultative : sélecteur du tableau blanc)<input value={driveKeys.apiKey ?? ''} onChange={(e) => saveDrive({ ...driveKeys, apiKey: e.target.value })} placeholder="AIza…" /></label>
                  <p className="clouds__help">Projet gratuit sur console.cloud.google.com : API « Google Drive » activée, identifiant OAuth « Application Web » avec pour origine JavaScript autorisée <code>{window.location.origin}</code>.</p>
                </>
              )}
              <div className="clouds__actions">
                <button type="button" className="clouds__primary" onClick={() => void open(provider, true)}>Ouvrir {provider.label}</button>
                {configured && !showSetup && <button type="button" className="clouds__ghost" onClick={() => setShowSetup(true)}>Modifier l'identifiant</button>}
              </div>
            </div>
          )}

          {view && (
            <>
              <div className="clouds__bar">
                <div className="clouds__crumbs">
                  <button type="button" disabled={listing} onClick={() => void go(null, -1)}>{provider.icon} {provider.rootLabel}</button>
                  {provider.extraRoots.map((r) => (
                    <button key={r.id} type="button" className={view.path[0]?.id === r.id ? 'is-root' : ''} disabled={listing} onClick={() => void go(r, 0)}>{r.name}</button>
                  ))}
                  {view.path.filter((c) => !provider.extraRoots.some((r) => r.id === c.id)).map((c) => {
                    const i = view.path.indexOf(c);
                    return <span key={c.id ?? i}>› <button type="button" disabled={listing} onClick={() => void go(null, i)}>{c.name}</button></span>;
                  })}
                  {view.searching && <span>› <em>Résultats de recherche</em></span>}
                </div>
                <div className="clouds__tools">
                  {view.path.length > 0 && (
                    <button type="button" className={pinned ? 'is-pinned' : ''} onClick={togglePin} title={pinned ? 'Ne plus ouvrir ce dossier au départ' : 'Ouvrir ce dossier au départ, sur tous mes appareils'}>{pinned ? '📌 Dossier de départ' : '📌 Épingler'}</button>
                  )}
                  {view.session.account && <small>{view.session.account}</small>}
                  <button type="button" onClick={() => void disconnect()} title="Oublier ce compte sur cet appareil">Déconnecter</button>
                </div>
              </div>
              <div className="clouds__search">
                <input value={query} placeholder={provider.scopedSearch && view.path.length > 0 ? `Chercher dans « ${view.path[view.path.length - 1].name} » et ses sous-dossiers` : `Chercher dans tout ${provider.label}`} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} />
                <button type="button" disabled={listing} onClick={() => void search()}>{listing ? '…' : 'Chercher'}</button>
              </div>
              {listing && <div className="clouds__progress"><span /></div>}
              <div className="clouds__list">
                {view.items.map((item) => {
                  const isOpening = opening?.id === item.id;
                  return (
                    <div key={item.id} className={`clouds__row ${item.isFolder ? 'is-folder' : ''} ${isOpening ? 'is-busy' : ''}`}>
                      <button type="button" className="clouds__main" disabled={listing || !!opening} onClick={() => void openItem(item)}>
                        <span className="clouds__ico">{cloudIcon(item)}</span>
                        <span className="clouds__meta">
                          <b>{item.name}</b>
                          <small>
                            {isOpening ? opening.step : item.isFolder ? (item.childCount === null ? 'Dossier' : `${item.childCount} élément${item.childCount > 1 ? 's' : ''}`) : [formatSize(item.size), fmtDate(item.modified), item.kind === 'office' ? (item.serverPdf ? 'converti en PDF à l\'ouverture' : /\.docx$/i.test(item.name) ? 'converti en PDF dans le navigateur' : 'non convertible ici') : ''].filter(Boolean).join(' · ')}
                          </small>
                        </span>
                        {item.isFolder && <span className="clouds__chev">›</span>}
                      </button>
                      {!item.isFolder && (
                        <span className="clouds__side">
                          <button type="button" disabled={!!opening} onClick={() => void download(item)} title="Télécharger">⬇</button>
                          {item.webUrl && <a href={item.webUrl} target="_blank" rel="noreferrer" title={`Ouvrir dans ${provider.label}`}>↗</a>}
                        </span>
                      )}
                    </div>
                  );
                })}
                {view.items.length === 0 && !listing && <p className="clouds__empty">{view.searching ? 'Aucun résultat.' : 'Dossier vide.'}</p>}
              </div>
            </>
          )}
        </div>

        <p className="clouds__foot">Astuce : glisser un fichier de l'ordinateur sur cette page pour l'ouvrir ici (PDF, Word, image, vidéo, page HTML, raccourci Internet).</p>
        {opening?.id === 'local' && <div className="clouds__notice">{opening.step}</div>}
      </div>

      {viewer && <CloudFileViewer opened={viewer.opened} title={viewer.title} subtitle={viewer.subtitle} webUrl={viewer.webUrl} cloudLabel={viewer.cloudLabel} onClose={() => setViewer(null)} />}
      <style>{CSS}</style>
    </Layout>
  );
}

const CSS = `
.clouds { display: flex; flex-direction: column; gap: 16px; min-height: 60vh; border-radius: var(--radius); outline: 3px dashed transparent; outline-offset: 8px; transition: outline-color 120ms; }
.clouds.is-dragging { outline-color: var(--indigo); }
.clouds__top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.clouds__link { display: flex; gap: 8px; flex: 1 1 320px; max-width: 520px; }
.clouds__link input { flex: 1; height: 42px; padding: 0 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; }
.clouds__link button { height: 42px; padding: 0 16px; border: 0; border-radius: var(--radius-sm); background: var(--indigo); color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
.clouds__link button:disabled { opacity: 0.5; cursor: default; }
.clouds__tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.clouds__tabs button { position: relative; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-weight: 600; font-size: 14px; cursor: pointer; }
.clouds__tabs button.is-on { background: var(--indigo); border-color: var(--indigo); color: #fff; }
.clouds__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pos, #16A34A); }
.clouds__tabs button.is-on .clouds__dot { background: #A7F3D0; }
.clouds__notice { padding: 10px 14px; border-radius: var(--radius-sm); background: var(--warn-soft, #FEF3C7); color: var(--text); font-size: 13px; }
.clouds__panel { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-1); }
.clouds__loading { display: flex; flex-direction: column; gap: 10px; color: var(--text-muted); font-size: 14px; }
.clouds__progress { position: relative; height: 6px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
.clouds__progress span { position: absolute; top: 0; bottom: 0; left: 0; width: 38%; border-radius: 999px; background: linear-gradient(90deg, var(--indigo), #818CF8); animation: clouds-slide 1.1s ease-in-out infinite; }
@keyframes clouds-slide { 0% { left: -40%; } 100% { left: 100%; } }
.clouds__setup { display: flex; flex-direction: column; gap: 12px; max-width: 720px; color: var(--text-muted); font-size: 14px; }
.clouds__setup label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-dim); }
.clouds__setup input { height: 40px; padding: 0 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text); font: 500 13px/1 "IBM Plex Mono", ui-monospace, monospace; }
.clouds__help { font-size: 12px; color: var(--text-dim); }
.clouds__help code { font: 500 12px/1.4 "IBM Plex Mono", ui-monospace, monospace; color: var(--text); word-break: break-all; user-select: all; }
.clouds__actions { display: flex; align-items: center; gap: 12px; }
.clouds__primary { height: 44px; padding: 0 18px; border: 0; border-radius: var(--radius-sm); background: var(--indigo); color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; }
.clouds__ghost { border: 0; background: transparent; color: var(--indigo); font-weight: 600; font-size: 13px; cursor: pointer; }
.clouds__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.clouds__crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 13px; color: var(--text-dim); }
.clouds__crumbs button { padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--indigo); font-weight: 600; font-size: 13px; cursor: pointer; }
.clouds__crumbs button:hover { background: var(--surface-3); }
.clouds__crumbs button:disabled { opacity: 0.5; cursor: default; }
.clouds__crumbs button.is-root { background: var(--indigo-soft); }
.clouds__tools { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); }
.clouds__tools small { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clouds__tools button { height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-weight: 600; font-size: 12px; cursor: pointer; }
.clouds__tools button.is-pinned { background: var(--indigo-soft); border-color: var(--indigo); color: var(--indigo); }
.clouds__search { display: flex; gap: 8px; }
.clouds__search input { flex: 1; height: 40px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 14px; }
.clouds__search button { height: 40px; padding: 0 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-3); color: var(--text); font-weight: 600; font-size: 13px; cursor: pointer; }
.clouds__list { display: flex; flex-direction: column; gap: 6px; }
.clouds__row { display: flex; align-items: stretch; gap: 4px; border-radius: var(--radius-sm); background: var(--bg); border: 1px solid transparent; }
.clouds__row:hover { border-color: var(--border); }
.clouds__row.is-busy { border-color: var(--indigo); }
.clouds__main { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; padding: 10px 12px; border: 0; background: transparent; color: var(--text); text-align: left; font: inherit; cursor: pointer; border-radius: var(--radius-sm); }
.clouds__main:disabled { cursor: default; }
.clouds__ico { flex: none; width: 28px; font-size: 20px; text-align: center; }
.clouds__meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.clouds__meta b { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clouds__meta small { color: var(--text-dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clouds__row.is-busy .clouds__meta small { color: var(--indigo); }
.clouds__chev { flex: none; color: var(--text-dim); font-size: 20px; }
.clouds__side { display: flex; align-items: center; gap: 2px; padding-right: 6px; }
.clouds__side button, .clouds__side a { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--indigo); font-weight: 700; font-size: 15px; cursor: pointer; text-decoration: none; }
.clouds__side button:hover, .clouds__side a:hover { background: var(--surface-3); }
.clouds__side button:disabled { opacity: 0.4; cursor: default; }
.clouds__empty { color: var(--text-dim); font-size: 13px; padding: 8px 0; }
.clouds__foot { color: var(--text-dim); font-size: 12px; }
`;
