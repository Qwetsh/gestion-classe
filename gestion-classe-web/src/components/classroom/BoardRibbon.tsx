/**
 * Ruban du tableau blanc — l'habillage « ordinateur » (préparation au clavier et à la souris),
 * calqué sur celui de l'éditeur de cours : barre de titre, onglets, groupes étiquetés, barre
 * d'état. Il remplace la barre flottante, la pastille, le rail de pages et le menu « … » de
 * l'habillage tactile (TBI), qui reste celui de la classe.
 *
 * Le ruban ne connaît aucun geste : `Whiteboard` lui passe une table d'actions par identifiant
 * (les mêmes que la palette et le menu « Plus »), il ne fait que les ranger.
 */
import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../course/courseIcons';
import '../course/course.css';

export interface RibbonAction {
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface RibbonInsert {
  id: string;
  label: string;
  run: () => void;
  active?: boolean;
}

type SizeKey = 'S' | 'M' | 'L';

interface Props {
  title: string;
  saveFailed: boolean;
  /** Actions disponibles, par identifiant ; une action absente n'affiche pas son bouton. */
  act: Record<string, RibbonAction | undefined>;
  tool: string;
  colors: string[];
  color: string;
  onColor: (c: string) => void;
  onOtherColor: () => void;
  sizeKey: SizeKey;
  onSize: (k: SizeKey) => void;
  eraserKey: SizeKey;
  onEraserSize: (k: SizeKey) => void;
  backgrounds: { id: string; label: string; active: boolean; onSelect: () => void }[];
  bgColors: { color: string; label: string; active: boolean; onSelect: () => void }[];
  inserts: RibbonInsert[];
  /** Encart d'un cours : une seule page, pas de gestion des pages. */
  single: boolean;
  onClose: () => void;
}

type Tab = 'fichier' | 'accueil' | 'insertion' | 'page' | 'outils' | 'affichage';

const INSERT_META: Record<string, { icon: IconName; short: string }> = {
  image: { icon: 'image', short: 'Image' },
  table: { icon: 'table', short: 'Tableau' },
  equation: { icon: 'sigma', short: 'Équation' },
  video: { icon: 'video', short: 'Vidéo' },
  web: { icon: 'web', short: 'Site web' },
  link: { icon: 'link', short: 'Lien' },
  audio: { icon: 'audio', short: 'Son' },
  record: { icon: 'mic', short: 'Micro' },
  sticky: { icon: 'sticky', short: 'Post-it' },
  window: { icon: 'windowObj', short: 'Fenêtre' },
  timer: { icon: 'timer', short: 'Minuteur' },
  clock: { icon: 'clock', short: 'Horloge' },
  meter: { icon: 'meter', short: 'Jauge' },
  noise: { icon: 'bell', short: 'Sonomètre' },
  traffic: { icon: 'traffic', short: 'Feu tricolore' },
  dice: { icon: 'dice', short: 'Dé' },
  wheel: { icon: 'wheel', short: 'Roue' },
  groups: { icon: 'groups', short: 'Groupes' },
  qr: { icon: 'qr', short: 'QR code' },
  calc: { icon: 'calc', short: 'Calculatrice' },
};

const WIDGET_IDS = ['timer', 'clock', 'dice', 'wheel', 'groups', 'traffic', 'noise', 'meter', 'calc', 'qr'];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ce-group">
      <div className="ce-group__body">{children}</div>
      <div className="ce-group__label">{label}</div>
    </div>
  );
}

/** Découpe une liste en colonnes de `n` (petits boutons empilés par trois, comme dans Word). */
function columns<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export function BoardRibbon({ title, saveFailed, act, tool, colors, color, onColor, onOtherColor, sizeKey, onSize, eraserKey, onEraserSize, backgrounds, bgColors, inserts, single, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('accueil');

  const big = (id: string, icon: IconName, label: string, tip?: string) => {
    const a = act[id];
    if (!a) return null;
    return (
      <button key={id} type="button" className={`ce-big ${a.active ? 'is-on' : ''}`} title={tip ?? label} onClick={a.onSelect} disabled={a.disabled}>
        <Icon name={icon} size={28} />
        <span>{label}</span>
      </button>
    );
  };
  const sm = (id: string, icon: IconName, label: string, tip?: string) => {
    const a = act[id];
    if (!a) return null;
    return (
      <button key={id} type="button" className={`ce-sm ${a.active ? 'is-on' : ''}`} title={tip ?? label} onClick={a.onSelect} disabled={a.disabled} aria-pressed={a.active}>
        <Icon name={icon} size={16} />
        <span>{label}</span>
      </button>
    );
  };
  const insertBig = (id: string) => {
    const it = inserts.find((x) => x.id === id);
    const meta = INSERT_META[id];
    if (!it || !meta) return null;
    return (
      <button key={id} type="button" className={`ce-big ${it.active ? 'is-on' : ''}`} title={it.label} onClick={it.run}>
        <Icon name={meta.icon} size={28} />
        <span>{it.active && id === 'record' ? 'Arrêter' : meta.short}</span>
      </button>
    );
  };
  const insertSm = (id: string) => {
    const it = inserts.find((x) => x.id === id);
    const meta = INSERT_META[id];
    if (!it || !meta) return null;
    return (
      <button key={id} type="button" className={`ce-sm ${it.active ? 'is-on' : ''}`} title={it.label} onClick={it.run}>
        <Icon name={meta.icon} size={16} />
        <span>{it.active && id === 'record' ? 'Arrêter' : meta.short}</span>
      </button>
    );
  };

  const erasing = tool === 'eraser';
  const widgets = WIDGET_IDS.filter((id) => inserts.some((x) => x.id === id));

  const tabs: { id: Tab; label: string }[] = [
    { id: 'fichier', label: 'Fichier' },
    { id: 'accueil', label: 'Accueil' },
    { id: 'insertion', label: 'Insertion' },
    { id: 'page', label: single ? 'Fond' : 'Page' },
    { id: 'outils', label: 'Outils' },
    { id: 'affichage', label: 'Affichage' },
  ];

  return (
    <div className="ce-chrome wbrib" onPointerDown={(e) => e.stopPropagation()}>
      <header className="ce-titlebar">
        <div className="ce-logo" aria-hidden>GC</div>
        <div className="ce-qa">
          <button type="button" title="Annuler (Ctrl+Z)" aria-label="Annuler" onClick={act.undo?.onSelect} disabled={act.undo?.disabled}><Icon name="undo" size={16} /></button>
          <button type="button" title="Rétablir (Ctrl+Y)" aria-label="Rétablir" onClick={act.redo?.onSelect} disabled={act.redo?.disabled}><Icon name="redo" size={16} /></button>
        </div>
        <span className="wbrib__title">{title}</span>
        <span className={`ce-saved ${saveFailed ? 'ce-saved--error' : ''}`} role="status">{saveFailed ? 'Pas enregistré — nouvel essai bientôt' : 'Enregistré automatiquement'}</span>
        <span className="ce-spacer-flex" />
        <button type="button" className="ce-btn ce-btn--primary" onClick={onClose}>{single ? 'Revenir au cours' : 'Fermer'}</button>
      </header>

      <div className="ce-ribbonwrap">
        <nav className="ce-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ce-tab ${t.id === 'fichier' ? 'ce-tab--file' : ''} ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ce-ribbon" role="toolbar" aria-label="Ruban">
          {tab === 'fichier' && (
            <>
              <Group label="Ouvrir">
                {big("file-open", "openFile", "Importer", "Importer un fichier .gcboard, un PDF ou une image")}
                {big("file-library-open", "library", "Tableau préparé", "Copier ici les pages d'un tableau de « Mes tableaux »")}
              </Group>
              <Group label="Enregistrer">
                {big("file-library-save", "saveLibrary", "Dans Mes tableaux", "Enregistrer une copie dans « Mes tableaux »")}
                {big("file-save", "save", "Fichier .gcboard", "Enregistrer un fichier ré-ouvrable (images comprises)")}
              </Group>
              <Group label="Exporter">
                {big("file-pdf", "pdf", "PDF", "Exporter en PDF (version élève ou corrigé)")}
                {big("file-png", "png", "Image de la page", "Image PNG de la page courante")}
              </Group>
            </>
          )}

          {tab === 'accueil' && (
            <>
              <Group label="Presse-papiers">
                {big("paste", "paste", "Coller", "Coller (Ctrl+V)")}
                <div className="ce-stack">
                  {sm("cut", "cut", "Couper", "Couper (Ctrl+X)")}
                  {sm("copy", "copy", "Copier", "Copier (Ctrl+C)")}
                  {sm("duplicate", "duplicate", "Dupliquer", "Dupliquer (Ctrl+D)")}
                </div>
              </Group>

              <Group label="Outils">
                {big("select", "select", "Sélection", "Sélection (V)")}
                {big("pen", "pen", "Stylo", "Stylo (P)")}
                {big("highlighter", "highlighter", "Surligneur", "Surligneur (S)")}
                {big("eraser", "eraser", "Gomme", "Gomme (E)")}
                {big("text", "textTool", "Texte", "Zone de texte au clavier (T)")}
                {big("shape", "shapes", "Formes", "Formes et flèches (F)")}
                {big("laser", "laser", "Laser", "Pointeur laser (L) : trait qui s'efface seul")}
              </Group>

              <Group label={erasing ? 'Gomme' : 'Couleur et trait'}>
                <div className="ce-stack">
                  <div className="ce-row">
                    {colors.map((c) => (
                      <button key={c} type="button" className={`ce-swatch ${color.toUpperCase() === c.toUpperCase() ? 'is-on' : ''}`} style={{ background: c }} title={`Couleur ${c}`} aria-label={`Couleur ${c}`} onClick={() => onColor(c)} />
                    ))}
                    <button type="button" className="ce-sm" title="Autre couleur…" onClick={onOtherColor}><span className="wbrib__wheel" /><span>Autre…</span></button>
                  </div>
                  <div className="ce-row">
                    <span className="ce-minilabel">{erasing ? 'Diamètre' : 'Épaisseur'}</span>
                    {(['S', 'M', 'L'] as SizeKey[]).map((k) => {
                      const on = erasing ? eraserKey === k : sizeKey === k;
                      const d = k === 'S' ? 5 : k === 'M' ? 9 : 14;
                      return (
                        <button key={k} type="button" className={`ce-sm wbrib__size ${on ? 'is-on' : ''}`} title={k === 'S' ? 'Fin' : k === 'M' ? 'Moyen' : 'Épais'} aria-pressed={on} onClick={() => (erasing ? onEraserSize(k) : onSize(k))}>
                          <i style={{ width: d, height: d, background: erasing ? 'transparent' : color, border: erasing ? '1.5px solid #6B7280' : 0 }} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="ce-row">
                    {sm("auto-shapes", "autoShape", "Formes automatiques", "Chaque trait fermé ou droit devient une forme nette")}
                  </div>
                </div>
              </Group>

              <Group label="Disposition">
                <div className="ce-stack">
                  {sm("order-front", "bringFront", "Premier plan")}
                  {sm("order-back", "sendBack", "Arrière-plan")}
                  {sm("lock", "lock", "Verrouiller", "Verrouiller / déverrouiller (Ctrl+L)")}
                </div>
                <div className="ce-stack">
                  {sm("group", "group", "Grouper", "Grouper (Ctrl+G)")}
                  {sm("ungroup", "ungroup", "Dissocier", "Dissocier (Ctrl+Maj+G)")}
                  {sm("delete", "trash", "Supprimer", "Supprimer (Suppr)")}
                </div>
              </Group>

              <Group label="Sélection">
                {big("select-all", "selectAll", "Tout sélectionner", "Tout sélectionner (Ctrl+A)")}
              </Group>
            </>
          )}

          {tab === 'insertion' && (
            <>
              <Group label="Illustrations">
                {insertBig("image")}
                {insertBig("table")}
                {insertBig("equation")}
              </Group>
              <Group label="Médias">
                {insertBig("video")}
                {insertBig("web")}
                {insertBig("link")}
                <div className="ce-stack">
                  {insertSm("audio")}
                  {insertSm("record")}
                </div>
              </Group>
              <Group label="Notes et fenêtres">
                {insertBig("sticky")}
                {insertBig("window")}
              </Group>
              <Group label="Widgets de classe">
                {columns(widgets, 3).map((col) => (
                  <div key={col.join('-')} className="ce-stack">
                    {col.map((id) => insertSm(id))}
                  </div>
                ))}
              </Group>
              <Group label="Bibliothèque">
                {big("library", "library", "Ressources", "Schémas, annales, Notion, clouds…")}
                {big("events", "bolt", "Événements", "Boutons d'action prêts à poser")}
                {big("search", "search", "Rechercher", "Rechercher une image, une vidéo… (Ctrl+K)")}
              </Group>
            </>
          )}

          {tab === 'page' && (
            <>
              {!single && (
                <Group label="Pages">
                  {big("page-new", "newPage", "Nouvelle page", "Nouvelle page (Ctrl+Entrée)")}
                  <div className="ce-stack">
                    {sm("page-duplicate", "duplicate", "Dupliquer la page")}
                    {sm("page-delete", "trash", "Supprimer la page")}
                  </div>
                </Group>
              )}
              <Group label="Lignage du fond">
                {columns(backgrounds, 3).map((col) => (
                  <div key={col.map((b) => b.id).join('-')} className="ce-stack">
                    {col.map((b) => (
                      <button key={b.id} type="button" className={`ce-sm ${b.active ? 'is-on' : ''}`} onClick={b.onSelect} aria-pressed={b.active} title={`Fond : ${b.label}`}>
                        <Icon name="bgPage" size={16} />
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </Group>
              <Group label="Couleur du fond">
                <div className="ce-stack">
                  <div className="ce-row wbrib__bgcolors">
                    {bgColors.map((c) => (
                      <button key={c.color} type="button" className={`ce-swatch ${c.active ? 'is-on' : ''}`} style={{ background: c.color }} title={c.label} aria-label={c.label} onClick={c.onSelect} />
                    ))}
                  </div>
                  <div className="ce-row">
                    {sm("bgc-other", "gear", "Autre couleur…")}
                  </div>
                </div>
              </Group>
              <Group label="Masquer">
                {big("page-curtain", "curtain", "Rideau", "Rideau de page : la page reste couverte tant qu'on ne la découvre pas")}
                {big("page-cover", "cover", "Tout recouvrir", "Remet tous les caches de la page")}
              </Group>
              {!single && (
                <Group label="Hauteur">
                  {big("page-extend", "extend", "Allonger", "Allonger la page d'un demi-écran")}
                  {big("page-fit", "fit", "Ajuster", "Ajuster la hauteur au contenu")}
                </Group>
              )}
              <Group label="Nettoyer">
                {big("page-clear", "clearPage", "Effacer la page")}
              </Group>
            </>
          )}

          {tab === 'outils' && (
            <>
              <Group label="Instruments">
                {big("ruler", "ruler", "Règle")}
                {big("setsquare", "setsquare", "Équerre")}
                {big("protractor", "protractor", "Rapporteur")}
              </Group>
              <Group label="Attention">
                {big("spotlight", "spotlight", "Projecteur", "Assombrit l'écran sauf une zone")}
                {big("laser", "laser", "Laser", "Pointeur laser (L)")}
              </Group>
              <Group label="Classe">
                {big("pick", "target", "Tirage au sort")}
                {big("keyboard", "keyboard", "Clavier virtuel")}
              </Group>
            </>
          )}

          {tab === 'affichage' && (
            <>
              <Group label="Zoom">
                {big("zoom-out", "zoomout", "Zoom −", "Zoom arrière (Ctrl+−)")}
                {big("zoom-reset", "fitwidth", "Page entière", "Revenir à la page entière")}
                {big("zoom-in", "zoomin", "Zoom +", "Zoom avant (Ctrl++ ou Ctrl+molette)")}
              </Group>
              {!single && (
                <Group label="Afficher">
                  {big("page-nav", "pagesPanel", "Volet des pages")}
                </Group>
              )}
              <Group label="Présenter">
                {big("display", "present", "Mode affichage", "Plein écran sans outils, comme en classe (Échap pour sortir)")}
              </Group>
              <Group label="Interface">
                {big("chrome-tbi", "touch", "Tactile (TBI)", "Revenir à l'interface tactile : barre flottante, pastille, gros boutons")}
              </Group>
              <Group label="Réglages">
                <div className="ce-stack">
                  {sm("set-doc-full", "extend", "Documents importés en pleine largeur")}
                  {sm("set-doc-fit", "fit", "Documents importés réduits à la page")}
                  {sm("set-gestures", "touch", "Pincer pour zoomer")}
                </div>
              </Group>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Barre d'état du tableau blanc (habillage ordinateur) : pages et zoom. */
export function BoardStatusBar({ act, pageIndex, pageCount, zoom, single }: { act: Record<string, RibbonAction | undefined>; pageIndex: number; pageCount: number; zoom: number; single: boolean }) {
  return (
    <footer className="ce-chrome ce-status wbrib__status" onPointerDown={(e) => e.stopPropagation()}>
      {single ? (
        <span>Encart 16:9 — un écran en classe</span>
      ) : (
        <>
          <div className="ce-zoom">
            <button type="button" onClick={act['page-prev']?.onSelect} disabled={act['page-prev']?.disabled} aria-label="Page précédente" title="Page précédente (Page préc.)">‹</button>
            <span>Page {pageIndex + 1} sur {pageCount}</span>
            <button type="button" onClick={act['page-next']?.onSelect} disabled={act['page-next']?.disabled} aria-label="Page suivante" title="Page suivante (Page suiv.)">›</button>
          </div>
          <button type="button" className="wbrib__statusbtn" onClick={act['page-new']?.onSelect} title="Nouvelle page (Ctrl+Entrée)">＋ Nouvelle page</button>
        </>
      )}
      <span className="ce-spacer-flex" />
      <div className="ce-zoom">
        <button type="button" onClick={act['zoom-out']?.onSelect} disabled={act['zoom-out']?.disabled} aria-label="Zoom arrière">−</button>
        <button type="button" className="wbrib__zoompct" onClick={act['zoom-reset']?.onSelect} title="Revenir à la page entière">{Math.round(zoom * 100)} %</button>
        <button type="button" onClick={act['zoom-in']?.onSelect} aria-label="Zoom avant">+</button>
      </div>
    </footer>
  );
}
