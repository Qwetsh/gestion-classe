/**
 * Correcteur du tableau blanc : souligne les fautes des zones de texte et propose des
 * corrections, à la manière de Word.
 *
 * - Analyse : toutes les zones de texte de la page en une seule requête LanguageTool (voir
 *   `lib/boardSpell.ts`), 1,2 s après la dernière modification, jamais plus d'une fois toutes
 *   les 3 s (API publique limitée à 20 requêtes par minute). Un échec réseau met l'analyse en
 *   pause 30 s puis on réessaie à la prochaine modification.
 * - Soulignement : API CSS Custom Highlight — des `Range` posées sur les nœuds texte, stylées
 *   par `::highlight(wb-spell)` (orthographe, rouge) et `::highlight(wb-grammar)` (grammaire,
 *   bleu). Le DOM et le HTML stocké ne bougent pas : rien dans l'export ni chez les élèves.
 * - Bulle : un tap sur un mot souligné (en saisie ou non) ouvre les propositions ; choisir une
 *   proposition remplace le mot dans l'éditeur, le calque remonte le HTML comme après une frappe.
 *
 * Le composant ne rend que la bulle et le CSS ; l'état des fautes vit dans des refs pour ne pas
 * re-rendre le calque à chaque analyse.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BoardObject } from '../../lib/boardObjects';
import {
  MAX_TEXT_LENGTH,
  checkText,
  extractText,
  ignoreKey,
  isIgnored,
  loadDictionary,
  rangeForIssue,
  saveDictionary,
  supportsHighlights,
  type SpellIssue,
  type TextMap,
} from '../../lib/boardSpell';

export interface SpellStatus {
  checking: boolean;
  /** Fautes visibles (hors mots ignorés ou ajoutés au dictionnaire). */
  count: number;
  /** Le moteur n'a pas répondu à la dernière analyse (réseau, quota). */
  error: boolean;
}

export interface SpellApi {
  /** Tap dans une zone de texte : ouvre la bulle si un mot souligné est sous le doigt. */
  handleClick: (objectId: string, clientX: number, clientY: number) => boolean;
}

interface Props {
  enabled: boolean;
  objects: BoardObject[];
  editingId: string | null;
  /** Éditeurs contentEditable du calque, par id d'objet. */
  editors: React.RefObject<Map<string, HTMLDivElement>>;
  onReplace: (objectId: string, range: Range, replacement: string) => void;
  onStatus?: (status: SpellStatus) => void;
}

const DEBOUNCE_MS = 1200;
const MIN_INTERVAL_MS = 3000;
const ERROR_BACKOFF_MS = 30000;
/** Séparateur entre zones dans le texte envoyé : deux sauts de ligne, jamais une faute à cheval. */
const JOIN = '\n\n';

interface Popover {
  objectId: string;
  issue: SpellIssue;
  range: Range;
  rect: DOMRect;
}

const KIND_LABEL = { spelling: 'Orthographe', grammar: 'Grammaire', style: 'Typographie' } as const;

export const BoardSpellChecker = forwardRef<SpellApi, Props>(function BoardSpellChecker(
  { enabled, objects, editingId, editors, onReplace, onStatus },
  ref
) {
  /** Fautes par zone, avec la table texte ↔ DOM de l'analyse. */
  const issuesRef = useRef<Map<string, { map: TextMap; issues: SpellIssue[] }>>(new Map());
  const lastTextRef = useRef('');
  const lastRequestRef = useRef(0);
  const errorUntilRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef(0);
  const dictionaryRef = useRef<Set<string>>(loadDictionary());
  const ignoredRef = useRef<Set<string>>(new Set());
  const [popover, setPopover] = useState<Popover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Correcteur coupé : la bulle disparaît — ajusté au rendu, pas dans un effet (pas de rendu en cascade)
  if (!enabled && popover) setPopover(null);
  const statusRef = useRef<SpellStatus>({ checking: false, count: 0, error: false });
  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  const setStatus = useCallback((patch: Partial<SpellStatus>) => {
    const next = { ...statusRef.current, ...patch };
    if (next.checking === statusRef.current.checking && next.count === statusRef.current.count && next.error === statusRef.current.error) return;
    statusRef.current = next;
    onStatusRef.current?.(next);
  }, []);

  const clearHighlights = useCallback(() => {
    if (!supportsHighlights()) return;
    CSS.highlights.delete('wb-spell');
    CSS.highlights.delete('wb-grammar');
    CSS.highlights.delete('wb-spell-active');
  }, []);

  /** Repose les soulignements depuis l'état courant du DOM (les nœuds ont pu être réécrits). */
  const applyHighlights = useCallback((active?: { objectId: string; issue: SpellIssue }) => {
    if (!supportsHighlights()) return;
    const spelling: Range[] = [];
    const grammar: Range[] = [];
    const activeRanges: Range[] = [];
    let count = 0;
    for (const [id, entry] of issuesRef.current) {
      const el = editors.current.get(id);
      if (!el) continue;
      // Table refaite à chaque pose : après une réécriture d'innerHTML, les anciens nœuds sont orphelins
      const map = extractText(el);
      entry.map = map;
      for (const issue of entry.issues) {
        if (isIgnored(issue, dictionaryRef.current, ignoredRef.current)) continue;
        const r = rangeForIssue(map, issue);
        if (!r) continue;
        count++;
        (issue.kind === 'spelling' ? spelling : grammar).push(r);
        if (active && active.objectId === id && active.issue === issue) activeRanges.push(r);
      }
    }
    CSS.highlights.set('wb-spell', new Highlight(...spelling));
    CSS.highlights.set('wb-grammar', new Highlight(...grammar));
    if (activeRanges.length) CSS.highlights.set('wb-spell-active', new Highlight(...activeRanges));
    else CSS.highlights.delete('wb-spell-active');
    setStatus({ count });
  }, [editors, setStatus]);

  /** Texte de toutes les zones, avec la position de chacune dans le texte joint. */
  const collect = useCallback(() => {
    const parts: { id: string; start: number; map: TextMap }[] = [];
    let joined = '';
    for (const o of objects) {
      if (o.type !== 'text') continue;
      const el = editors.current.get(o.id);
      if (!el) continue;
      const map = extractText(el);
      if (!map.text.trim()) continue;
      if (joined.length + map.text.length + JOIN.length > MAX_TEXT_LENGTH) break;
      if (joined) joined += JOIN;
      parts.push({ id: o.id, start: joined.length, map });
      joined += map.text;
    }
    return { joined, parts };
  }, [objects, editors]);

  const runCheck = useCallback(async () => {
    const { joined, parts } = collect();
    if (joined === lastTextRef.current) { applyHighlights(); return; }
    if (!joined.trim()) {
      lastTextRef.current = joined;
      issuesRef.current.clear();
      applyHighlights();
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequestRef.current = Date.now();
    setStatus({ checking: true });
    try {
      const all = await checkText(joined, controller.signal);
      if (controller.signal.aborted) return;
      lastTextRef.current = joined;
      const next = new Map<string, { map: TextMap; issues: SpellIssue[] }>();
      for (const p of parts) next.set(p.id, { map: p.map, issues: [] });
      for (const issue of all) {
        const part = [...parts].reverse().find((p) => issue.offset >= p.start);
        if (!part) continue;
        const local = issue.offset - part.start;
        if (local + issue.length > part.map.text.length) continue;
        next.get(part.id)?.issues.push({ ...issue, offset: local });
      }
      issuesRef.current = next;
      errorUntilRef.current = 0;
      setStatus({ checking: false, error: false });
      applyHighlights();
    } catch (e) {
      if (controller.signal.aborted) return;
      errorUntilRef.current = Date.now() + ERROR_BACKOFF_MS;
      setStatus({ checking: false, error: true });
      if (import.meta.env.DEV) console.warn('[correcteur]', e);
    }
  }, [collect, applyHighlights, setStatus]);

  // Analyse différée à chaque changement du contenu (objets) ou d'état d'édition
  useEffect(() => {
    if (!enabled) {
      window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
      issuesRef.current.clear();
      lastTextRef.current = '';
      clearHighlights();
      setStatus({ checking: false, count: 0, error: false });
      return;
    }
    // Les soulignements suivent tout de suite le DOM (frappe, undo…), l'analyse attend la pause
    applyHighlights();
    window.clearTimeout(timerRef.current);
    const now = Date.now();
    const wait = Math.max(DEBOUNCE_MS, lastRequestRef.current + MIN_INTERVAL_MS - now, errorUntilRef.current - now);
    timerRef.current = window.setTimeout(() => { void runCheck(); }, wait);
    return () => window.clearTimeout(timerRef.current);
  }, [enabled, objects, editingId, runCheck, applyHighlights, clearHighlights, setStatus]);

  // Nettoyage au démontage (changement de page : les nœuds disparaissent)
  useEffect(() => () => { abortRef.current?.abort(); clearHighlights(); }, [clearHighlights]);

  // -- Bulle de propositions --
  const closePopover = useCallback(() => {
    setPopover(null);
    applyHighlights();
  }, [applyHighlights]);

  useImperativeHandle(ref, () => ({
    handleClick: (objectId, clientX, clientY) => {
      if (!enabled) return false;
      const entry = issuesRef.current.get(objectId);
      const el = editors.current.get(objectId);
      if (!entry || !el || entry.issues.length === 0) return false;
      const pos = caretFromPoint(clientX, clientY);
      if (!pos || !el.contains(pos.node)) return false;
      const map = extractText(el);
      for (const issue of entry.issues) {
        if (isIgnored(issue, dictionaryRef.current, ignoredRef.current)) continue;
        const r = rangeForIssue(map, issue);
        if (!r) continue;
        let hit = false;
        try { hit = r.isPointInRange(pos.node, pos.offset); } catch { hit = false; }
        if (!hit) continue;
        setPopover({ objectId, issue, range: r, rect: r.getBoundingClientRect() });
        applyHighlights({ objectId, issue });
        return true;
      }
      return false;
    },
  }), [enabled, editors, applyHighlights]);

  // Fermeture : tap hors de la bulle, Échap, zone quittée
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) closePopover();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopover(); };
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('keydown', onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [popover, closePopover]);

  const choose = (replacement: string) => {
    if (!popover) return;
    const { objectId, issue } = popover;
    // La plage est recalculée au moment du clic : le texte a pu bouger depuis l'ouverture
    const el = editors.current.get(objectId);
    const r = el ? rangeForIssue(extractText(el), issue) : null;
    setPopover(null);
    if (!r) { applyHighlights(); return; }
    onReplace(objectId, r, replacement);
    // Le mot corrigé ne doit plus être souligné en attendant la prochaine analyse
    const entry = issuesRef.current.get(objectId);
    if (entry) entry.issues = entry.issues.filter((i) => i !== issue);
    lastTextRef.current = '';
    applyHighlights();
  };

  const ignore = () => {
    if (!popover) return;
    ignoredRef.current.add(ignoreKey(popover.issue));
    closePopover();
  };

  const addToDictionary = () => {
    if (!popover) return;
    dictionaryRef.current.add(popover.issue.text.toLowerCase());
    saveDictionary(dictionaryRef.current);
    closePopover();
  };

  // La bulle garde le focus dans l'éditeur : aucun bouton ne prend la sélection
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

  return (
    <>
      <style>{STYLE}</style>
      {popover && createPortal(
        <div ref={popoverRef} className="wbsp" style={popoverStyle(popover.rect)} onPointerDown={hold} onMouseDown={hold}>
          <div className="wbsp__head">
            <span className={`wbsp__kind wbsp__kind--${popover.issue.kind}`}>{KIND_LABEL[popover.issue.kind]}</span>
            <span className="wbsp__msg">{popover.issue.message}</span>
          </div>
          {popover.issue.suggestions.length > 0 ? (
            <div className="wbsp__list">
              {popover.issue.suggestions.map((s) => (
                <button key={s} type="button" className="wbsp__sug" onClick={() => choose(s)}>{s}</button>
              ))}
            </div>
          ) : (
            <div className="wbsp__none">Aucune proposition</div>
          )}
          <div className="wbsp__foot">
            <button type="button" className="wbsp__act" onClick={ignore}>Ignorer</button>
            {popover.issue.kind === 'spelling' && (
              <button type="button" className="wbsp__act" onClick={addToDictionary}>Ajouter au dictionnaire</button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

const POP_WIDTH = 340;
const GAP = 8;
const MARGIN = 8;

/** Sous le mot si la place existe, sinon au-dessus ; jamais hors de l'écran. */
function popoverStyle(rect: DOMRect): React.CSSProperties {
  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - POP_WIDTH - MARGIN));
  const estimated = 220;
  const below = rect.bottom + GAP;
  const top = below + estimated <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, rect.top - GAP - estimated);
  return { left, top, width: POP_WIDTH };
}

const STYLE = `
/* Soulignements : ondulé rouge (orthographe) et bleu (grammaire, typographie), sans toucher au DOM. */
::highlight(wb-spell) { text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #DC2626; text-decoration-thickness: 2px; text-decoration-skip-ink: none; }
::highlight(wb-grammar) { text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: #2563EB; text-decoration-thickness: 2px; text-decoration-skip-ink: none; }
::highlight(wb-spell-active) { background-color: rgba(79,70,229,.16); }

/* Bulle de propositions : portalée sur body, au-dessus du tableau (z-index 100) comme .wbpop. */
.wbsp {
  position: fixed; z-index: 130; box-sizing: border-box; padding: 12px;
  background: var(--wb-chrome, #171C24); color: var(--wb-on-chrome, #E7ECF3);
  border: 1px solid var(--wb-chrome-line, #2E3846); border-radius: var(--wb-r-panel, 20px);
  box-shadow: 0 18px 40px -14px rgba(0,0,0,.75);
  font-family: var(--wb-font-ui, system-ui, sans-serif);
}
.wbsp__head { display: flex; flex-direction: column; gap: 4px; padding: 2px 4px 10px; }
.wbsp__kind { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.wbsp__kind--spelling { color: #FCA5A5; }
.wbsp__kind--grammar, .wbsp__kind--style { color: #93C5FD; }
.wbsp__msg { font-size: 15px; line-height: 1.3; color: var(--wb-on-chrome-dim, #93A0B4); }
.wbsp__list { display: flex; flex-wrap: wrap; gap: 8px; }
.wbsp__sug {
  min-height: 44px; padding: 0 16px; border: 0; border-radius: var(--wb-r-btn, 14px); cursor: pointer;
  background: #FFFFFF; color: #14181F; font: 600 20px/1 inherit; font-family: inherit;
}
.wbsp__sug:hover { background: #E0E7FF; }
.wbsp__none { padding: 8px 4px; font-size: 15px; color: var(--wb-on-chrome-mute, #6E7C92); }
.wbsp__foot { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--wb-chrome-line, #2E3846); }
.wbsp__act {
  min-height: 44px; padding: 0 14px; border: 0; border-radius: var(--wb-r-btn, 14px); cursor: pointer;
  background: var(--wb-chrome-sunk, #1E2530); color: var(--wb-on-chrome, #E7ECF3); font: 500 15px/1 inherit; font-family: inherit;
}
.wbsp__act:hover { background: var(--wb-chrome-hover, #212936); color: #FFFFFF; }
`;
