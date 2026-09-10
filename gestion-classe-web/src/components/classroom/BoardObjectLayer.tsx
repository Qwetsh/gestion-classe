/**
 * Calque des objets du tableau blanc (zones de texte aujourd'hui ; formes, images… ensuite).
 *
 * Un objet = un cadre DOM positionné en unités logiques au-dessus des canvas, avec une
 * mécanique commune : sélection (simple ou multiple), déplacement, redimensionnement,
 * menu contextuel (clic droit / appui long). Le contenu du cadre dépend du type.
 *
 * Règle de déplacement / édition d'une zone de texte (sans jamais s'y reprendre à deux fois) :
 * - un clic sur une zone non sélectionnée la sélectionne (poignées visibles) ;
 * - glisser depuis n'importe où sur une zone sélectionnée la déplace (seuil 6 px) ;
 * - un clic sur une zone déjà sélectionnée, ou un double-clic, place le curseur ;
 * - au doigt ou au stylet, toucher = écrire, glisser = déplacer ;
 * - la bordure de préhension (12 px autour) déplace toujours, même en cours de saisie.
 *
 * Le HTML d'une zone est nettoyé (`sanitizeBoardHtml`) puis re-dessiné sur canvas pour les
 * vignettes et l'export PDF.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  INDENT_EM,
  LINE_HEIGHT,
  MIN_TEXT_WIDTH,
  TEXT_SIZES,
  fontCss,
  isEmptyBoardHtml,
  sanitizeBoardHtml,
} from '../../lib/boardText';
import { objectRect, type BoardObject, type TextObject } from '../../lib/boardObjects';
import { MIN_SHAPE_SIZE, arrowHeadPaths, dashPattern, isLineKind, shapePath } from '../../lib/boardShapes';
import { isObjectRevealed, revealedGaps, stripGaps, wrapSelectionAsGap, type RevealState } from '../../lib/boardReveal';
import { loadPageImage, objectBounds } from '../../lib/boardRender';
import { BoardScratchCover } from './BoardScratchCover';
import { TableView } from './objects/TableView';
import { EmbedView } from './objects/EmbedView';
import { AudioView } from './objects/AudioView';
import { LinkView } from './objects/LinkView';
import { WidgetView } from './objects/WidgetView';
import { EquationView } from './objects/EquationView';
import type { TableObject, WidgetObject } from '../../lib/boardMedia';
import { LIBRARY_STROKE, libraryItem } from '../../lib/boardLibrary';

/** Objets dont le contenu se tape au clavier (zone de texte, cellule de tableau, équation). */
const EDITABLE_TYPES = new Set(['text', 'table', 'equation']);
/** Objets à hauteur automatique : seules les poignées de largeur (et les coins pour la taille). */
const WIDTH_ONLY_TYPES = new Set(['text', 'table', 'link']);

export interface StageBox { left: number; top: number; width: number; height: number }

/** État de la sélection de texte courante, pour allumer les boutons de la barre. */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  sub: boolean;
  sup: boolean;
}

const EMPTY_FORMAT: FormatState = {
  bold: false, italic: false, underline: false, strike: false,
  ul: false, ol: false, align: 'left', sub: false, sup: false,
};

export interface BoardTextApi {
  /** Commande d'édition (gras, italique, listes, alignement…) sur la sélection. */
  exec: (command: string, value?: string) => void;
  /** Taille de la sélection, en unités logiques (convertie en em relatif à la zone). */
  applyFontSize: (size: number) => void;
  applyFontFamily: (fontId: string) => void;
  applyColor: (color: string) => void;
  applyHighlight: (color: string | null) => void;
  /** Retrait : +1 / -1 niveau sur les blocs sélectionnés. */
  changeIndent: (delta: number) => void;
  clearFormatting: () => void;
  /** Cran de taille suivant (+1) ou précédent (-1) dans TEXT_SIZES. */
  stepFontSize: (direction: 1 | -1) => void;
  /** Casse de la sélection : minuscules → Première Lettre → MAJUSCULES (Maj+F3 de Word). */
  toggleCase: () => void;
  /** Texte à trous : la sélection (ou le mot sous le curseur) devient un trou. */
  makeGap: () => void;
  /** Retire tous les trous de la zone en cours de saisie. */
  removeGaps: () => void;
}

interface Props {
  objects: BoardObject[];
  stage: StageBox;
  scale: number;
  /** Vrai quand un outil « objets » (sélection, texte) est actif : les cadres deviennent cliquables. */
  active: boolean;
  selectedIds: ReadonlySet<string>;
  editingId: string | null;
  onSelect: (ids: Set<string>) => void;
  onEdit: (id: string | null) => void;
  /** `before` non nul = l'opération doit entrer dans l'historique (état avant modification). */
  onChange: (next: BoardObject[], before: BoardObject[] | null) => void;
  onFormatState: (state: FormatState) => void;
  /** Ctrl+Entrée pendant la saisie (saut de page de Word) : nouvelle page du tableau. */
  onNewPage?: () => void;
  /** Clic droit ou appui long sur un objet (déjà sélectionné à l'appel). */
  onContextMenu: (x: number, y: number, id: string) => void;
  /** État de révélation de la séance (rideaux, tickets, trous). */
  reveal: RevealState;
  onRevealObject: (id: string, value: true | string | null) => void;
  onRevealGap: (objectId: string, gapId: string) => void;
  /** Cellule de tableau qui a le focus (pour le menu contextuel lignes/colonnes). */
  onTableCell?: (objectId: string, r: number, c: number) => void;
  onEquationCommit: (id: string, latex: string, raster: Blob | null, ratio: number) => void;
  onWidgetConfig: (id: string, patch: WidgetObject['config']) => void;
  onToggleInteractive: (id: string) => void;
}

type Handle = 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';
/** Poignées selon le type : le texte n'a que la largeur (hauteur automatique), les formes tout. */
const TEXT_HANDLES: Handle[] = ['w', 'e', 'nw', 'ne', 'sw', 'se'];
const SHAPE_HANDLES: Handle[] = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];

interface Press {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  /** L'objet était-il déjà sélectionné avant cet appui ? (clic = placer le curseur) */
  wasSelected: boolean;
  moved: boolean;
  mode: 'move' | 'resize';
  handle?: Handle;
  before: BoardObject[];
  /** Géométrie de départ des objets entraînés. */
  start: Map<string, BoardObject>;
  timer: number | null;
}

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 500;

/** Bloc (ligne logique : div, p, li) qui contient `node`, borné à l'éditeur `root`. */
function blockOf(root: HTMLElement, node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === Node.ELEMENT_NODE && ['DIV', 'P', 'LI'].includes((n as HTMLElement).tagName)) return n as HTMLElement;
    n = n.parentNode;
  }
  return null;
}

/** Vrai si le bloc ne contient aucun caractère (juste un <br> ou rien). */
function isBlankBlock(block: HTMLElement): boolean {
  return (block.textContent || '').replace(/\u00a0/g, ' ').trim() === '';
}

/** Place le curseur de saisie au point cliqué (Chrome et Firefox n'ont pas la même API). */
function placeCaret(el: HTMLElement, x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let range: Range | null = null;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos && el.contains(pos.offsetNode)) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
    }
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r && el.contains(r.startContainer)) range = r;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export const BoardObjectLayer = forwardRef<BoardTextApi, Props>(function BoardObjectLayer(
  {
    objects, stage, scale, active, selectedIds, editingId, onSelect, onEdit, onChange, onFormatState, onNewPage, onContextMenu,
    reveal, onRevealObject, onRevealGap, onTableCell, onEquationCommit, onWidgetConfig, onToggleInteractive,
  },
  ref
) {
  const editorsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const objectsRef = useRef(objects);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  const selectedRef = useRef(selectedIds);
  useEffect(() => { selectedRef.current = selectedIds; }, [selectedIds]);
  /** Objets tels qu'ils étaient à l'entrée en édition (pour un seul pas d'annulation). */
  const editStartRef = useRef<BoardObject[] | null>(null);
  const pressRef = useRef<Press | null>(null);
  const [, forceRender] = useState(0);

  /** URL signée des images (objets image, couvertures de tickets), par chemin. */
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    for (const o of objects) {
      for (const path of [o.cover?.imagePath, o.type === 'image' ? o.path : undefined]) {
        if (!path || coverUrls[path]) continue;
        loadPageImage(path).then((img) => setCoverUrls((prev) => (prev[path] ? prev : { ...prev, [path]: img.src }))).catch(() => undefined);
      }
    }
  }, [objects, coverUrls]);

  // -- Écriture du contenu des zones de texte dans le DOM (jamais pendant la frappe) --
  // Les trous non révélés reçoivent la classe is-hidden (pas en saisie : on voit tout).
  useEffect(() => {
    for (const o of objects) {
      if (o.type !== 'text') continue;
      const el = editorsRef.current.get(o.id);
      if (!el) continue;
      if (document.activeElement !== el && el.innerHTML !== o.html) el.innerHTML = o.html;
      const shown = revealedGaps(reveal, o.id);
      const editing = editingId === o.id;
      for (const g of Array.from(el.querySelectorAll<HTMLElement>('[data-gap]'))) {
        const id = g.getAttribute('data-gap') || '';
        g.classList.toggle('is-hidden', !editing && !shown.has(id));
      }
    }
  }, [objects, reveal, editingId]);

  /** Émet un nouvel état d'objets ; `objectsRef` suit tout de suite, sans attendre le rendu. */
  const emit = useCallback((next: BoardObject[], before: BoardObject[] | null) => {
    objectsRef.current = next;
    onChange(next, before);
  }, [onChange]);

  const patch = useCallback((id: string, fn: (o: BoardObject) => BoardObject, before: BoardObject[] | null) => {
    emit(objectsRef.current.map((o) => (o.id === id ? fn(o) : o)), before);
  }, [emit]);

  /** Zone de texte ou tableau (mêmes réglages : taille, police, couleur). */
  const textById = useCallback((id: string | null): TextObject | TableObject | null => {
    const o = id ? objectsRef.current.find((t) => t.id === id) : null;
    return o && (o.type === 'text' || o.type === 'table') ? o : null;
  }, []);

  /** Cellule de tableau → état (nettoyé). `commit` = fin d'édition de la cellule. */
  const syncTableCell = useCallback((id: string, el: HTMLElement, commit: boolean) => {
    const r = Number(el.dataset.r), c = Number(el.dataset.c);
    const html = sanitizeBoardHtml(el.innerHTML) || '<div><br></div>';
    const current = objectsRef.current.find((t) => t.id === id);
    if (!current || current.type !== 'table' || !Number.isFinite(r) || !Number.isFinite(c)) return;
    if ((current.cells[r]?.[c] ?? '') === html && !commit) return;
    const before = commit ? editStartRef.current : null;
    if (commit) editStartRef.current = null;
    if ((current.cells[r]?.[c] ?? '') === html) return;
    patch(id, (o) => (o.type === 'table' ? { ...o, cells: o.cells.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? html : cell)) : row)) } : o), before);
  }, [patch]);

  /** Remonte le contenu du DOM vers l'état (nettoyé). `commit` = fin d'édition. */
  const syncFromDom = useCallback((id: string, commit: boolean) => {
    const el = editorsRef.current.get(id);
    if (!el) return;
    const html = sanitizeBoardHtml(el.innerHTML);
    const before = commit ? editStartRef.current : null;
    if (commit) editStartRef.current = null;
    const current = textById(id);
    if (!current || current.type !== 'text') return;
    if (commit && isEmptyBoardHtml(html)) {
      // Une zone laissée vide disparaît
      emit(objectsRef.current.filter((t) => t.id !== id), before ?? objectsRef.current);
      return;
    }
    if (current.html === html && !commit) return;
    patch(id, (o) => ({ ...o, html }), before);
  }, [emit, patch, textById]);

  // -- État de la sélection de texte (barre d'outils) --
  const refreshFormat = useCallback(() => {
    if (!editingId) { onFormatState(EMPTY_FORMAT); return; }
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    onFormatState({
      bold: q('bold'),
      italic: q('italic'),
      underline: q('underline'),
      strike: q('strikeThrough'),
      ul: q('insertUnorderedList'),
      ol: q('insertOrderedList'),
      sub: q('subscript'),
      sup: q('superscript'),
      align: q('justifyCenter') ? 'center' : q('justifyRight') ? 'right' : q('justifyFull') ? 'justify' : 'left',
    });
  }, [editingId, onFormatState]);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshFormat);
    return () => document.removeEventListener('selectionchange', refreshFormat);
  }, [refreshFormat]);

  // -- Commandes de mise en forme --
  const withEditor = useCallback((fn: (el: HTMLDivElement, box: TextObject | TableObject) => void) => {
    if (!editingId) return;
    const el = editorsRef.current.get(editingId);
    const box = textById(editingId);
    if (!el || !box) return;
    el.focus();
    fn(el, box);
    if (box.type === 'table') syncTableCell(editingId, el, false);
    else syncFromDom(editingId, false);
    refreshFormat();
  }, [editingId, syncFromDom, syncTableCell, refreshFormat, textById]);

  const exec = useCallback((command: string, value?: string) => {
    withEditor(() => {
      try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignoré */ }
      document.execCommand(command, false, value);
    });
  }, [withEditor]);

  /**
   * `execCommand('fontSize')` ne sait produire que 7 tailles : on pose le repère 7
   * puis on le remplace par une taille relative (em) à la zone, stable à toute échelle.
   */
  const applyFontSize = useCallback((size: number) => {
    withEditor((el, box) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        // Sans sélection : on change la taille de base de la zone
        patch(box.id, (o) => ({ ...o, size }), objectsRef.current);
        return;
      }
      // Sans styleWithCSS, la commande produit <font size="7"> ; avec, un font-size mot-clé.
      // Les deux repères sont convertis en em, seule forme conservée par le nettoyage.
      try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* ignoré */ }
      document.execCommand('fontSize', false, '7');
      const em = Math.round((size / box.size) * 100) / 100;
      const marked = [
        ...Array.from(el.querySelectorAll('font[size="7"]')),
        ...Array.from(el.querySelectorAll<HTMLElement>('[style*="xxx-large"]')),
      ];
      // Taille déjà héritée d'un span parent : l'em posé doit compenser pour ne pas se cumuler
      const inheritedEm = (node: Element): number => {
        let m = 1;
        for (let p = node.parentElement; p && p !== el; p = p.parentElement) {
          const match = /^([\d.]+)em$/.exec(p.style.fontSize);
          if (match) m *= parseFloat(match[1]);
        }
        return m;
      };
      for (const node of marked) {
        const own = Math.round((em / inheritedEm(node)) * 100) / 100;
        const span = document.createElement('span');
        // On garde les autres styles éventuellement posés sur le même élément
        if (node instanceof HTMLElement && node.tagName !== 'FONT') {
          node.style.fontSize = '';
          const rest = node.getAttribute('style') || '';
          if (rest) span.setAttribute('style', rest);
        }
        span.style.fontSize = `${own}em`;
        while (node.firstChild) span.appendChild(node.firstChild);
        // Les tailles posées plus tôt à l'intérieur de la sélection s'effacent
        for (const inner of Array.from(span.querySelectorAll<HTMLElement>('[style*="font-size"]'))) inner.style.fontSize = '';
        node.replaceWith(span);
      }
    });
  }, [withEditor, patch]);

  const applyFontFamily = useCallback((fontId: string) => {
    withEditor((_el, box) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        patch(box.id, (o) => ({ ...o, font: fontId }), objectsRef.current);
        return;
      }
      document.execCommand('fontName', false, fontCss(fontId));
    });
  }, [withEditor, patch]);

  const applyColor = useCallback((color: string) => {
    withEditor((_el, box) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        patch(box.id, (o) => ({ ...o, color }), objectsRef.current);
        return;
      }
      try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignoré */ }
      document.execCommand('foreColor', false, color);
    });
  }, [withEditor, patch]);

  const applyHighlight = useCallback((color: string | null) => {
    withEditor(() => {
      try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* ignoré */ }
      document.execCommand('hiliteColor', false, color ?? 'transparent');
    });
  }, [withEditor]);

  /** Retrait géré nous-mêmes (`data-indent`) : indépendant du zoom, contrairement aux marges en px. */
  const changeIndent = useCallback((delta: number) => {
    withEditor((el) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const blocks = new Set<HTMLElement>();
      const start = blockOf(el, range.startContainer);
      const end = blockOf(el, range.endContainer);
      if (start) blocks.add(start);
      if (end) blocks.add(end);
      for (const node of Array.from(el.querySelectorAll('div, p, li'))) {
        if (range.intersectsNode(node)) blocks.add(node as HTMLElement);
      }
      if (blocks.size === 0) {
        // Zone d'un seul paragraphe implicite : on enveloppe le contenu
        const div = document.createElement('div');
        while (el.firstChild) div.appendChild(el.firstChild);
        el.appendChild(div);
        blocks.add(div);
      }
      for (const block of blocks) {
        const next = Math.max(0, Math.min(8, (Number(block.getAttribute('data-indent')) || 0) + delta));
        if (next === 0) block.removeAttribute('data-indent');
        else block.setAttribute('data-indent', String(next));
      }
    });
  }, [withEditor]);

  const clearFormatting = useCallback(() => {
    withEditor(() => {
      document.execCommand('removeFormat');
      document.execCommand('justifyLeft');
    });
  }, [withEditor]);

  const stepFontSize = useCallback((direction: 1 | -1) => {
    const box = textById(editingId);
    if (!box) return;
    // Taille effective au point d'insertion (span éventuel), ramenée en unités logiques
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const px = node instanceof HTMLElement ? parseFloat(getComputedStyle(node).fontSize) : NaN;
    const current = Number.isFinite(px) && px > 0 ? Math.round(px / scale) : box.size;
    const next = direction > 0
      ? TEXT_SIZES.find((v) => v > current) ?? current + 6
      : [...TEXT_SIZES].reverse().find((v) => v < current) ?? Math.max(8, current - 6);
    applyFontSize(next);
  }, [editingId, scale, applyFontSize, textById]);

  const toggleCase = useCallback(() => {
    withEditor((el) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts: { node: Text; start: number; end: number }[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n as Text;
        if (!range.intersectsNode(t)) continue;
        parts.push({
          node: t,
          start: t === range.startContainer ? range.startOffset : 0,
          end: t === range.endContainer ? range.endOffset : t.length,
        });
      }
      const selected = parts.map(({ node, start, end }) => node.data.slice(start, end)).join('');
      if (!selected.trim()) return;
      // Cycle de Word : minuscules → Première Lettre De Chaque Mot → MAJUSCULES → minuscules
      const isUpper = selected === selected.toLocaleUpperCase('fr');
      const isLower = selected === selected.toLocaleLowerCase('fr');
      const transform = (t: string) => {
        if (isUpper) return t.toLocaleLowerCase('fr');
        if (isLower) return t.toLocaleLowerCase('fr').replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr'));
        return t.toLocaleUpperCase('fr');
      };
      const first = parts[0];
      const last = parts[parts.length - 1];
      for (const { node, start, end } of parts) {
        node.data = node.data.slice(0, start) + transform(node.data.slice(start, end)) + node.data.slice(end);
      }
      // La sélection reste posée sur le même passage
      const r = document.createRange();
      r.setStart(first.node, Math.min(first.start, first.node.length));
      r.setEnd(last.node, Math.min(last.end, last.node.length));
      sel.removeAllRanges();
      sel.addRange(r);
    });
  }, [withEditor]);

  const makeGap = useCallback(() => {
    withEditor((el) => { wrapSelectionAsGap(el); });
  }, [withEditor]);

  const removeGaps = useCallback(() => {
    withEditor((el) => { el.innerHTML = stripGaps(el.innerHTML); });
  }, [withEditor]);

  useImperativeHandle(ref, () => ({
    exec, applyFontSize, applyFontFamily, applyColor, applyHighlight, changeIndent, clearFormatting, stepFontSize, toggleCase, makeGap, removeGaps,
  }), [exec, applyFontSize, applyFontFamily, applyColor, applyHighlight, changeIndent, clearFormatting, stepFontSize, toggleCase, makeGap, removeGaps]);

  /**
   * Raccourcis de Word pendant la saisie. Renvoie vrai si la touche a été consommée.
   * Les deux conventions (FR : Ctrl+G gras, Ctrl+Maj+G gauche ; EN : Ctrl+B, Ctrl+L) cohabitent.
   */
  const handleShortcut = useCallback((e: React.KeyboardEvent): boolean => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Tab' && !ctrl && !e.altKey) { changeIndent(e.shiftKey ? -1 : 1); return true; }
    if (e.key === 'Enter' && !ctrl && !e.shiftKey && !e.altKey) {
      // Comme Word : Entrée sur une ligne vide en retrait la ramène d'un niveau au lieu
      // d'ouvrir une nouvelle ligne au même retrait.
      const el = editingId ? editorsRef.current.get(editingId) : null;
      const sel = window.getSelection();
      const block = el && sel?.isCollapsed ? blockOf(el, sel.anchorNode) : null;
      if (block && (Number(block.getAttribute('data-indent')) || 0) > 0 && isBlankBlock(block)) {
        changeIndent(-1);
        return true;
      }
      return false;
    }
    if (e.key === 'F3' && e.shiftKey) { toggleCase(); return true; }
    if (!ctrl || e.altKey) return false;
    if (e.key === 'Enter') { if (onNewPage) { onNewPage(); return true; } return false; }
    const focusSelect = (kind: 'font' | 'size') => document.querySelector<HTMLSelectElement>(`.wb__select--${kind}`)?.focus();
    if (e.shiftKey) {
      switch (k) {
        case 'g': exec('justifyLeft'); return true;
        case 'd': exec('justifyRight'); return true;
        case 'l': case '8': exec('insertUnorderedList'); return true;
        case '7': exec('insertOrderedList'); return true;
        case 'm': changeIndent(-1); return true;
        case 'n': clearFormatting(); return true;
        case 'f': focusSelect('font'); return true;
        case 'p': focusSelect('size'); return true;
        case '>': case '.': stepFontSize(1); return true;
        case '<': case ',': stepFontSize(-1); return true;
        case '+': case '=': exec('superscript'); return true;
        case '5': case '(': exec('strikeThrough'); return true;
        case 'a': toggleCase(); return true;
        default: return false;
      }
    }
    switch (k) {
      case 'b': case 'g': exec('bold'); return true;
      case 'i': exec('italic'); return true;
      case 'u': exec('underline'); return true;
      case 'e': exec('justifyCenter'); return true;
      case 'l': exec('justifyLeft'); return true;
      case 'r': exec('justifyRight'); return true;
      case 'j': exec('justifyFull'); return true;
      case 'm': changeIndent(1); return true;
      case '=': exec('subscript'); return true;
      case ']': stepFontSize(1); return true;
      case '[': stepFontSize(-1); return true;
      case ' ': exec('removeFormat'); return true;
      default: return false;
    }
  }, [editingId, exec, changeIndent, clearFormatting, stepFontSize, toggleCase, onNewPage]);

  // -- Entrée en saisie d'une zone de texte, curseur au point touché --
  const beginEdit = useCallback((id: string, clientX?: number, clientY?: number) => {
    editStartRef.current = objectsRef.current;
    onEdit(id);
    // Le focus doit attendre que contentEditable soit posé
    requestAnimationFrame(() => {
      const o = objectsRef.current.find((t) => t.id === id);
      let el: HTMLElement | null | undefined = editorsRef.current.get(id);
      if (o?.type === 'table') {
        const frame = document.querySelector<HTMLElement>(`[data-obj="${id}"]`);
        const under = clientX !== undefined && clientY !== undefined ? document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('.wbt__cell') : null;
        el = under && frame?.contains(under) ? under : frame?.querySelector<HTMLElement>('.wbt__cell');
      }
      if (!el) return;
      el.focus();
      if (clientX !== undefined && clientY !== undefined) placeCaret(el, clientX, clientY);
    });
  }, [onEdit]);

  // -- Sélection, déplacement, redimensionnement --
  const clearPress = useCallback((e?: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p) return;
    if (p.timer) window.clearTimeout(p.timer);
    if (e) { try { (e.currentTarget as HTMLElement).releasePointerCapture(p.pointerId); } catch { /* déjà relâché */ } }
    pressRef.current = null;
  }, []);

  const startPress = useCallback((e: React.PointerEvent, o: BoardObject, mode: 'move' | 'resize', handle?: Handle) => {
    if (!active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const wasSelected = selectedRef.current.has(o.id);
    let ids = new Set(selectedRef.current);
    if (mode === 'move' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      if (wasSelected) ids.delete(o.id); else ids.add(o.id);
    } else if (!wasSelected) {
      ids = new Set([o.id]);
    }
    if (editingId && editingId !== o.id) onEdit(null);
    onSelect(ids);
    selectedRef.current = ids;

    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
    const start = new Map<string, BoardObject>();
    for (const obj of objectsRef.current) if (ids.has(obj.id) && !obj.locked) start.set(obj.id, obj);
    const press: Press = {
      id: o.id, pointerId: e.pointerId, pointerType: e.pointerType,
      startX: e.clientX, startY: e.clientY, wasSelected, moved: false, mode, handle,
      before: objectsRef.current, start, timer: null,
    };
    // Appui long (doigt, stylet) = menu contextuel
    if (e.pointerType !== 'mouse' && mode === 'move') {
      const { clientX, clientY } = e;
      press.timer = window.setTimeout(() => {
        if (pressRef.current === press && !press.moved) {
          pressRef.current = null;
          onContextMenu(clientX, clientY, o.id);
        }
      }, LONG_PRESS_MS);
    }
    pressRef.current = press;
  }, [active, editingId, onEdit, onSelect, onContextMenu]);

  const movePress = useCallback((e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const dxPx = e.clientX - p.startX;
    const dyPx = e.clientY - p.startY;
    if (!p.moved) {
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      p.moved = true;
      if (p.timer) { window.clearTimeout(p.timer); p.timer = null; }
      if (editingId === p.id) {
        // On glisse une zone en cours de saisie : on sort de la saisie, le déplacement prime
        editorsRef.current.get(p.id)?.blur();
        onEdit(null);
      }
    }
    if (p.start.size === 0) return;
    const dx = dxPx / scale;
    const dy = dyPx / scale;
    const next = objectsRef.current.map((o) => {
      const s = p.start.get(o.id);
      if (!s) return o;
      if (p.mode === 'move') return { ...o, x: Math.round(s.x + dx), y: Math.round(s.y + dy) };
      // Redimensionnement
      const h = p.handle ?? 'e';
      const left = h.includes('w');
      const top = h.includes('n');
      const horizontal = h.includes('e') || h.includes('w');
      const vertical = h.includes('n') || h.includes('s');
      if (WIDTH_ONLY_TYPES.has(o.type) && 'size' in s && typeof s.size === 'number') {
        // Hauteur automatique : largeur par les bords, largeur + taille de police par les coins
        let w = left ? s.w - dx : s.w + dx;
        w = Math.max(MIN_TEXT_WIDTH, Math.round(w));
        const x = left ? Math.round(s.x + (s.w - w)) : s.x;
        if (h.length === 2) {
          const size = Math.max(8, Math.round(s.size * (w / s.w)));
          return { ...o, x, w, size } as BoardObject;
        }
        return { ...o, x, w };
      }
      if ('h' in o && 'h' in s && typeof o.h === 'number' && typeof s.h === 'number') {
        let w = horizontal ? (left ? s.w - dx : s.w + dx) : s.w;
        let hh = vertical ? (top ? s.h - dy : s.h + dy) : s.h;
        // Proportions conservées : Maj sur une forme, toujours sur une image ou une équation par les coins
        const keepRatio = h.length === 2 && s.w > 0 && s.h > 0 && (e.shiftKey || o.type === 'image' || o.type === 'equation' || o.type === 'library');
        if (keepRatio) {
          const k = Math.max(w / s.w, hh / s.h);
          w = s.w * k;
          hh = s.h * k;
        }
        const line = s.type === 'shape' && isLineKind(s.kind);
        const minH = line ? 0 : MIN_SHAPE_SIZE;
        w = Math.max(line ? 0 : MIN_SHAPE_SIZE, Math.round(w));
        hh = Math.max(minH, Math.round(hh));
        const x = left ? Math.round(s.x + (s.w - w)) : s.x;
        const y = top ? Math.round(s.y + (s.h - hh)) : s.y;
        return { ...o, x, y, w, h: hh } as BoardObject;
      }
      return o;
    });
    emit(next, null);
    forceRender((v) => v + 1);
  }, [scale, emit, editingId, onEdit]);

  const endPress = useCallback((e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    clearPress(e);
    if (p.moved) {
      if (p.start.size > 0) emit(objectsRef.current, p.before);
      return;
    }
    if (p.mode !== 'move') return;
    const o = objectsRef.current.find((t) => t.id === p.id);
    if (!o || !EDITABLE_TYPES.has(o.type) || o.locked) return;
    // Clic sans déplacement : curseur si la zone était déjà sélectionnée, ou au doigt / stylet
    if (editingId === p.id) return;
    if (p.wasSelected || p.pointerType !== 'mouse') beginEdit(p.id, e.clientX, e.clientY);
  }, [clearPress, emit, editingId, beginEdit]);

  const removeObject = useCallback((id: string) => {
    onEdit(null);
    onSelect(new Set());
    emit(objectsRef.current.filter((t) => t.id !== id), objectsRef.current);
  }, [emit, onEdit, onSelect]);

  const single = selectedIds.size === 1 ? objects.find((o) => selectedIds.has(o.id)) ?? null : null;

  return (
    <div className="wbo" style={{ left: stage.left, top: stage.top, width: stage.width, height: stage.height }}>
      {objects.map((o) => {
        const rect = objectRect(o);
        const isEditing = editingId === o.id;
        const isSelected = selectedIds.has(o.id);
        const showHandles = active && single?.id === o.id && !o.locked;
        return (
          <div
            key={o.id}
            data-obj={o.id}
            className={`wbo__frame wbo__frame--${o.type} ${active ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''} ${isEditing ? 'is-editing' : ''} ${o.locked ? 'is-locked' : ''}`}
            style={{
              left: o.x * scale,
              top: o.y * scale,
              width: o.w * scale,
              minHeight: (o.type === 'shape' || o.type === 'image' || o.type === 'library' ? o.h : rect.h) * scale,
              opacity: o.opacity ?? 1,
            }}
            onPointerDown={(e) => {
              // En saisie, le contenu appartient à l'éditeur (curseur, sélection de texte)
              if (isEditing && (e.target as HTMLElement).closest('.wbo__editor')) { e.stopPropagation(); return; }
              startPress(e, o, 'move');
            }}
            onPointerMove={movePress}
            onPointerUp={endPress}
            onPointerCancel={(e) => { const p = pressRef.current; clearPress(e); if (p?.moved) emit(objectsRef.current, p.before); }}
            onDoubleClick={(e) => {
              if (!active || !EDITABLE_TYPES.has(o.type) || o.locked || isEditing) return;
              e.stopPropagation();
              beginEdit(o.id, e.clientX, e.clientY);
            }}
            onContextMenu={(e) => {
              if (!active) return;
              e.preventDefault();
              e.stopPropagation();
              if (!selectedRef.current.has(o.id)) { const ids = new Set([o.id]); onSelect(ids); selectedRef.current = ids; }
              onContextMenu(e.clientX, e.clientY, o.id);
            }}
          >
            {o.type === 'table' && (
              <TableView
                o={o}
                scale={scale}
                editing={isEditing}
                onCellFocus={(el, r, c) => { editorsRef.current.set(o.id, el as HTMLDivElement); onTableCell?.(o.id, r, c); refreshFormat(); }}
                onCellInput={(el) => syncTableCell(o.id, el, false)}
                onCellBlur={(el) => { if (isEditing) syncTableCell(o.id, el, true); }}
                onCellKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); onEdit(null); return; }
                  if (handleShortcut(e)) e.preventDefault();
                }}
              />
            )}
            {(o.type === 'video' || o.type === 'web') && (
              <EmbedView o={o} scale={scale} active={active} onToggleInteractive={() => onToggleInteractive(o.id)} />
            )}
            {o.type === 'audio' && <AudioView o={o} scale={scale} />}
            {o.type === 'link' && <LinkView o={o} scale={scale} active={active} />}
            {o.type === 'widget' && <WidgetView o={o} scale={scale} onConfig={(patchCfg) => onWidgetConfig(o.id, patchCfg)} />}
            {o.type === 'equation' && (
              <EquationView
                o={o}
                scale={scale}
                editing={isEditing}
                onCommit={(latex, raster, ratio) => { onEquationCommit(o.id, latex, raster, ratio); onEdit(null); }}
                onCancel={() => { if (!o.latex) onChange(objectsRef.current.filter((t) => t.id !== o.id), null); onEdit(null); }}
              />
            )}
            {o.type === 'library' && (() => {
              const item = libraryItem(o.item);
              if (!item) return null;
              return (
                <svg className="wbo__lib" width={Math.max(1, o.w * scale)} height={Math.max(1, o.h * scale)} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined }}>
                  {item.paths.map((p, i) => (
                    <path
                      key={i}
                      d={p.d}
                      fill={p.mode === 'fill' || p.mode === 'both' ? (o.fill ?? o.stroke) : 'none'}
                      stroke={p.mode === 'fill' ? 'none' : o.stroke}
                      strokeWidth={LIBRARY_STROKE * (p.width ?? 1) * (o.strokeWidth / LIBRARY_STROKE)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={p.dashed ? '4 3' : undefined}
                      vectorEffect="non-scaling-stroke"
                      style={{ strokeWidth: LIBRARY_STROKE * (p.width ?? 1) * (o.strokeWidth / LIBRARY_STROKE) * ((o.w * scale) / 100) }}
                    />
                  ))}
                </svg>
              );
            })()}
            {o.type === 'image' && (
              <div className="wbo__image" style={{ width: o.w * scale, height: o.h * scale, transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined }}>
                {coverUrls[o.path] ? <img src={coverUrls[o.path]} alt="" draggable={false} /> : <span>Image…</span>}
              </div>
            )}
            {o.type === 'shape' && (
              <svg
                className="wbo__shape"
                width={Math.max(1, o.w * scale)}
                height={Math.max(1, o.h * scale)}
                viewBox={`0 0 ${Math.max(1, o.w)} ${Math.max(1, o.h)}`}
                preserveAspectRatio="none"
                style={{ transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined }}
              >
                <path
                  d={shapePath(o)}
                  fill={o.fill && !isLineKind(o.kind) ? o.fill : 'none'}
                  stroke={o.stroke}
                  strokeWidth={o.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={o.dashed ? dashPattern(o.strokeWidth).join(' ') : undefined}
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: o.strokeWidth * scale }}
                />
                {arrowHeadPaths(o).map((d, i) => (
                  <path key={i} d={d} fill={o.stroke} stroke={o.stroke} strokeWidth={o.strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: o.strokeWidth * scale }} />
                ))}
              </svg>
            )}
            {o.type === 'text' && (
              <div
                className="wbo__editor"
                ref={(el) => {
                  if (el) editorsRef.current.set(o.id, el);
                  else editorsRef.current.delete(o.id);
                }}
                contentEditable={isEditing}
                suppressContentEditableWarning
                spellCheck={false}
                style={{
                  fontFamily: fontCss(o.font),
                  fontSize: o.size * scale,
                  lineHeight: LINE_HEIGHT,
                  color: o.color,
                  background: o.background,
                  padding: o.background ? o.size * 0.5 * scale : undefined,
                  borderRadius: o.background ? 6 : undefined,
                  boxShadow: o.background ? '0 4px 12px rgba(0,0,0,0.18)' : undefined,
                  // Retraits en em : identiques au rendu canvas quelle que soit l'échelle
                  ['--wbo-indent' as string]: `${INDENT_EM}em`,
                }}
                onClick={(e) => {
                  if (isEditing) return;
                  const gap = (e.target as HTMLElement).closest<HTMLElement>('[data-gap].is-hidden');
                  if (gap) { e.stopPropagation(); onRevealGap(o.id, gap.getAttribute('data-gap') || ''); }
                }}
                onInput={() => syncFromDom(o.id, false)}
                onBlur={() => { if (isEditing) syncFromDom(o.id, true); }}
                onKeyUp={refreshFormat}
                onMouseUp={refreshFormat}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).blur();
                    onEdit(null);
                    return;
                  }
                  if (handleShortcut(e)) e.preventDefault();
                }}
              />
            )}
            {o.cover && !isObjectRevealed(reveal, o.id) && (() => {
              const b = objectBounds(o);
              const cover = o.cover;
              const style = { left: (b.x - o.x) * scale, top: (b.y - o.y) * scale, width: b.w * scale, height: b.h * scale };
              if (cover.kind === 'scratch') {
                const mask = reveal.objects[o.id];
                return (
                  <div className="wbo__cover" style={style} onDoubleClick={(e) => { e.stopPropagation(); onRevealObject(o.id, true); }}>
                    <BoardScratchCover
                      key={`${o.id}-${Math.round(b.w * scale)}x${Math.round(b.h * scale)}`}
                      width={b.w * scale}
                      height={b.h * scale}
                      color={cover.color}
                      imageUrl={cover.imagePath ? coverUrls[cover.imagePath] ?? null : null}
                      initialMask={typeof mask === 'string' ? mask : null}
                      onChange={(m) => onRevealObject(o.id, m)}
                      onRevealed={() => onRevealObject(o.id, true)}
                    />
                  </div>
                );
              }
              return (
                <div
                  className="wbo__cover wbo__cover--curtain"
                  style={{ ...style, background: cover.color }}
                  onPointerDown={(e) => { if (!active) e.stopPropagation(); }}
                  onClick={(e) => { if (!active) { e.stopPropagation(); onRevealObject(o.id, true); } }}
                  onDoubleClick={(e) => { e.stopPropagation(); onRevealObject(o.id, true); }}
                  title={active ? 'Double-clic pour découvrir' : 'Découvrir'}
                >
                  <span>{cover.label ?? '?'}</span>
                </div>
              );
            })()}
            {active && isSelected && (
              // Bordure de préhension : déplace toujours, même pendant la saisie
              <div className="wbo__grab" onPointerDown={(e) => startPress(e, o, 'move')} />
            )}
            {o.locked && isSelected && <span className="wbo__lock" title="Objet verrouillé">🔒</span>}
            {showHandles && (
              <>
                {(WIDTH_ONLY_TYPES.has(o.type) ? TEXT_HANDLES : SHAPE_HANDLES).map((h) => (
                  <div
                    key={h}
                    className={`wbo__handle wbo__handle--${h}`}
                    title={o.type === 'text' ? (h.length === 1 ? 'Largeur' : 'Taille') : 'Redimensionner (Maj : proportions)'}
                    onPointerDown={(e) => startPress(e, o, 'resize', h)}
                  />
                ))}
                <button
                  type="button"
                  className="wbo__del"
                  title="Supprimer (Suppr)"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={() => removeObject(o.id)}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        );
      })}
      <style>{CSS}</style>
    </div>
  );
});

const CSS = `
.wbo { position: absolute; pointer-events: none; }
.wbo__frame { position: absolute; pointer-events: none; touch-action: none; }
.wbo__frame.is-active { pointer-events: auto; }
.wbo__editor { outline: none; white-space: pre-wrap; overflow-wrap: break-word; caret-color: #4F46E5; cursor: default; }
.wbo__frame.is-editing .wbo__editor { cursor: text; }
.wbo__frame.is-active:hover .wbo__editor { box-shadow: 0 0 0 1px rgba(99,102,241,0.35); }
.wbo__frame.is-selected .wbo__editor,
.wbo__frame.is-editing .wbo__editor { box-shadow: 0 0 0 1.5px #6366F1; }
.wbo__frame.is-locked.is-selected .wbo__editor { box-shadow: 0 0 0 1.5px #9CA3AF; }
.wbo__editor p, .wbo__editor div { margin: 0; }
.wbo__editor ul, .wbo__editor ol { margin: 0; padding-left: 1.4em; }
.wbo__editor [data-indent="1"] { padding-left: var(--wbo-indent); }
.wbo__editor [data-indent="2"] { padding-left: calc(var(--wbo-indent) * 2); }
.wbo__editor [data-indent="3"] { padding-left: calc(var(--wbo-indent) * 3); }
.wbo__editor [data-indent="4"] { padding-left: calc(var(--wbo-indent) * 4); }
.wbo__editor [data-indent="5"] { padding-left: calc(var(--wbo-indent) * 5); }
.wbo__editor [data-indent="6"] { padding-left: calc(var(--wbo-indent) * 6); }
.wbo__editor [data-indent="7"] { padding-left: calc(var(--wbo-indent) * 7); }
.wbo__editor [data-indent="8"] { padding-left: calc(var(--wbo-indent) * 8); }

.wbo__image { display: flex; align-items: center; justify-content: center; overflow: hidden; background: #F3F4F6; color: #9CA3AF; font: 500 13px/1 Inter, system-ui, sans-serif; user-select: none; }
.wbo__image img { display: block; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
.wbo__frame.is-active:hover .wbo__image { outline: 1px solid rgba(99,102,241,0.35); }
.wbo__frame.is-selected .wbo__image { outline: 1.5px solid #6366F1; }
.wbo__lib { display: block; overflow: visible; }
.wbo__frame.is-active:hover .wbo__lib { outline: 1px solid rgba(99,102,241,0.35); }
.wbo__frame.is-selected .wbo__lib { outline: 1.5px solid #6366F1; }
.wbo__shape { display: block; overflow: visible; }
.wbo__frame.is-active:hover .wbo__shape { outline: 1px solid rgba(99,102,241,0.35); }
.wbo__frame.is-selected .wbo__shape { outline: 1.5px solid #6366F1; }
.wbo__frame.is-locked.is-selected .wbo__shape { outline-color: #9CA3AF; }
.wbo__editor [data-gap] { border-radius: 3px; }
.wbo__frame.is-editing .wbo__editor [data-gap] { outline: 1.5px dashed #6366F1; outline-offset: 1px; }
.wbo__editor [data-gap].is-hidden { color: transparent !important; background: #FFFFFF !important; border-bottom: 2px solid currentColor; pointer-events: auto; cursor: pointer; }
.wbo__editor [data-gap].is-hidden * { color: transparent !important; background: transparent !important; text-decoration: none !important; }
.wbo__editor [data-gap].is-hidden { border-bottom-color: #374151; }
.wbo__cover { position: absolute; z-index: 2; pointer-events: auto; overflow: hidden; border-radius: 4px; }
.wbo__cover--curtain { display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.92); font: 600 clamp(14px, 2vw, 28px)/1 Inter, system-ui, sans-serif; cursor: pointer; user-select: none; }
.wbo__scratch { display: block; touch-action: none; cursor: crosshair; }
.wbo__grab { position: absolute; inset: -12px; cursor: move; border-radius: 6px; }
.wbo__lock { position: absolute; right: -8px; top: -14px; font-size: 14px; pointer-events: none; }
.wbo__handle {
  position: absolute; width: 14px; height: 14px; border-radius: 4px; background: #FFFFFF;
  border: 2px solid #6366F1; box-shadow: 0 1px 4px rgba(0,0,0,0.25); touch-action: none; z-index: 1;
}
.wbo__handle--w { left: -8px; top: 50%; margin-top: -7px; cursor: ew-resize; height: 28px; margin-top: -14px; border-radius: 7px; }
.wbo__handle--e { right: -8px; top: 50%; cursor: ew-resize; height: 28px; margin-top: -14px; border-radius: 7px; }
.wbo__handle--n { left: 50%; top: -8px; margin-left: -14px; width: 28px; cursor: ns-resize; border-radius: 7px; }
.wbo__handle--s { left: 50%; bottom: -8px; margin-left: -14px; width: 28px; cursor: ns-resize; border-radius: 7px; }
.wbo__handle--nw { left: -8px; top: -8px; cursor: nwse-resize; }
.wbo__handle--ne { right: -8px; top: -8px; cursor: nesw-resize; }
.wbo__handle--sw { left: -8px; bottom: -8px; cursor: nesw-resize; }
.wbo__handle--se { right: -8px; bottom: -8px; cursor: nwse-resize; }
.wbo__del {
  position: absolute; right: -14px; top: -30px; width: 26px; height: 26px; border-radius: 50%;
  border: 0; padding: 0; background: #DC2626; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif;
  cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25); z-index: 1;
}
`;
