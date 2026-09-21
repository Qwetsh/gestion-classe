/**
 * Espace de travail du tableau blanc : plusieurs tableaux ouverts en même temps, un onglet par
 * tableau (séance, tableau préparé, brouillon). Chaque onglet monte son propre `Whiteboard`,
 * gardé en mémoire quand il est masqué (page courante, zoom, sélection, minuteurs), avec sa
 * propre sauvegarde. Seul l'onglet actif réagit au clavier, au collage et aux commandes du
 * téléphone (prop `active`).
 *
 * En classe, ce qui est à l'écran est l'onglet actif : le tableau de la séance est celui que le
 * téléphone suit ; un tableau préparé ouvert à côté sert tel quel ou se copie dans la séance.
 * Les onglets sont mémorisés par espace (`classroom-board-tabs:<clé>`) pour survivre à un
 * rechargement.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Whiteboard, type WhiteboardProps } from './Whiteboard';
import { BoardLibraryDialog } from './BoardLibraryDialog';
import { MAX_TABS, boardTab, draftTab, type BoardTab } from '../../lib/boardTabs';

const STORAGE_PREFIX = 'classroom-board-tabs:';
/** Hauteur de la barre d'onglets (px), réservée en haut de chaque tableau. */
const TAB_BAR_H = 36;

type Shared = Pick<WhiteboardProps, 'userId' | 'ticker' | 'classroom' | 'className'>;

interface Props extends Shared {
  /** Onglet de départ : la séance en classe, le tableau ouvert depuis l'accueil, le brouillon. */
  initial: BoardTab;
  onClose: () => void;
}

function loadTabs(key: string): { tabs: BoardTab[]; active: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) || 'null') as { tabs?: BoardTab[]; active?: string } | null;
    if (!raw || !Array.isArray(raw.tabs) || raw.tabs.length === 0) return null;
    return { tabs: raw.tabs.slice(0, MAX_TABS), active: typeof raw.active === 'string' ? raw.active : raw.tabs[0].key };
  } catch { return null; }
}

export function BoardWorkspace({ initial, onClose, ...shared }: Props) {
  const [state, setState] = useState<{ tabs: BoardTab[]; active: string }>(() => {
    const saved = loadTabs(initial.key);
    if (saved && saved.tabs.some((t) => t.key === initial.key)) return saved;
    return { tabs: [initial], active: initial.key };
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { tabs, active } = state;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_PREFIX + initial.key, JSON.stringify(state)); } catch { /* stockage indisponible */ }
  }, [state, initial.key]);

  const openTab = useCallback((tab: BoardTab) => {
    setState((s) => {
      if (s.tabs.some((t) => t.key === tab.key)) return { ...s, active: tab.key };
      if (s.tabs.length >= MAX_TABS) { window.alert(`Au plus ${MAX_TABS} tableaux ouverts à la fois : fermez-en un d'abord.`); return s; }
      return { tabs: [...s.tabs, tab], active: tab.key };
    });
  }, []);
  const closeTab = useCallback((key: string) => {
    setState((s) => {
      const i = s.tabs.findIndex((t) => t.key === key);
      if (i < 0) return s;
      const tabs = s.tabs.filter((t) => t.key !== key);
      if (tabs.length === 0) return s; // le dernier onglet se ferme par « Retour », pas par sa croix
      const active = s.active === key ? tabs[Math.max(0, i - 1)].key : s.active;
      return { tabs, active };
    });
  }, []);
  const step = useCallback((dir: 1 | -1) => {
    setState((s) => {
      const i = s.tabs.findIndex((t) => t.key === s.active);
      return { ...s, active: s.tabs[(i + dir + s.tabs.length) % s.tabs.length].key };
    });
  }, []);

  // Ctrl+Alt+← / → : onglet précédent / suivant (Ctrl+Tab est réservé par le navigateur)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const single = tabs.length === 1;
  const barH = single ? 0 : TAB_BAR_H;
  const openMenu = useMemo(() => [
    { label: '📚 Tableau préparé…', run: () => setLibraryOpen(true) },
    ...(tabs.some((t) => t.kind === 'draft') ? [] : [{ label: '🖊 Brouillon', run: () => openTab(draftTab()) }]),
  ], [tabs, openTab]);

  return (
    <>
      {!single && (
        <div className="wbws" role="tablist">
          {tabs.map((t) => (
            <div key={t.key} role="tab" aria-selected={t.key === active} className={`wbws__tab ${t.key === active ? 'is-active' : ''}`} onClick={() => setState((s) => ({ ...s, active: t.key }))} title={t.kind === 'draft' ? 'Brouillon local (gardé sur cet appareil)' : t.kind === 'session' ? 'Tableau de la séance (suivi par le téléphone)' : 'Tableau préparé'}>
              <span className="wbws__icon" aria-hidden>{t.kind === 'session' ? '🏫' : t.kind === 'draft' ? '🖊' : '📋'}</span>
              <span className="wbws__title">{t.title}</span>
              {t.kind === 'session' && shared.classroom && <span className="wbws__dot" title="Suivi par le téléphone" />}
              <button type="button" className="wbws__close" title="Fermer cet onglet" onClick={(e) => { e.stopPropagation(); closeTab(t.key); }}>✕</button>
            </div>
          ))}
          <div className="wbws__add">
            {openMenu.map((m) => <button key={m.label} type="button" className="wbws__addbtn" onClick={m.run} disabled={tabs.length >= MAX_TABS}>{m.label}</button>)}
          </div>
        </div>
      )}
      {tabs.map((t) => (
        <div key={t.key} className={t.key === active ? undefined : 'wbws__hidden'} aria-hidden={t.key !== active}>
          <Whiteboard
            {...shared}
            sessionId={t.sessionId}
            boardId={t.boardId}
            remote={t.remote}
            title={t.title}
            active={t.key === active}
            topOffset={barH}
            onOpenInTab={(b) => openTab(boardTab(b))}
            onOpenDraftTab={() => openTab(draftTab())}
            onClose={onClose}
          />
        </div>
      ))}
      {libraryOpen && (
        <BoardLibraryDialog
          mode="open"
          userId={shared.userId}
          defaultLevel={null}
          excludeBoardId={null}
          allowBlank={false}
          onPick={(b) => { setLibraryOpen(false); openTab(boardTab(b)); }}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.wbws { position: fixed; left: 0; right: 0; top: 0; z-index: 101; display: flex; align-items: stretch; gap: 2px; height: ${TAB_BAR_H}px; padding: 4px 6px 0; box-sizing: border-box; background: #0D1015; border-bottom: 1px solid #2E3846; font: 500 13px/1 Inter, system-ui, sans-serif; user-select: none; overflow-x: auto; }
.wbws__tab { display: flex; align-items: center; gap: 6px; max-width: 260px; padding: 0 6px 0 10px; border-radius: 8px 8px 0 0; background: #171C24; color: #93A0B4; cursor: pointer; }
.wbws__tab:hover { background: #212936; color: #E7ECF3; }
.wbws__tab.is-active { background: #FFFFFF; color: #111827; }
.wbws__icon { font-size: 13px; }
.wbws__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbws__dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; flex: none; }
.wbws__close { width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: 600 11px/1 Inter, system-ui, sans-serif; cursor: pointer; opacity: 0.6; }
.wbws__close:hover { opacity: 1; background: rgba(0,0,0,0.12); }
.wbws__add { display: flex; align-items: center; gap: 4px; margin-left: 6px; }
.wbws__addbtn { height: 26px; padding: 0 10px; border: 1px solid #2E3846; border-radius: 8px; background: transparent; color: #93A0B4; font: 500 12px/1 Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.wbws__addbtn:hover:not(:disabled) { background: #212936; color: #E7ECF3; }
.wbws__addbtn:disabled { opacity: 0.4; cursor: default; }
.wbws__hidden { display: none; }
`;
