/**
 * Orthographe et grammaire des cours (AUDIT_editeur_texte.md, lot T11).
 *
 * Moteur : LanguageTool, comme le tableau blanc (`lib/boardSpell.ts`, API publique gratuite :
 * 20 requêtes par minute, 20 Ko par requête). Le texte n'est envoyé que si l'enseignant le
 * demande : bouton « Vérifier le cours », ou interrupteur « Pendant la frappe » (éteint par
 * défaut, réglé sur cet ordinateur). Rien ne part tout seul.
 *
 * - Le cours est envoyé paragraphe par paragraphe, regroupés en aussi peu de requêtes que
 *   possible ; les résultats sont gardés par texte de paragraphe : un paragraphe inchangé n'est
 *   jamais renvoyé, un paragraphe modifié perd ses soulignements jusqu'à la vérification suivante.
 * - Soulignements : décorations ProseMirror (rien n'est écrit dans le document ni imprimé).
 * - Clic sur un mot souligné : bulle de propositions (CourseSpellPopover).
 * - Dictionnaire personnel partagé avec le tableau blanc ; « Ignorer » vaut pour la séance.
 */
import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { MAX_TEXT_LENGTH, checkText, ignoreKey, isIgnored, loadDictionary, saveDictionary, type SpellIssue } from '../../lib/boardSpell';

/** Séparateur entre paragraphes d'une même requête : le moteur ne relie pas deux paragraphes. */
const SEP = '\n\n';
const MIN_INTERVAL_MS = 3000;
const LIVE_DELAY_MS = 2000;

// ---------------------------------------------------------------------------------------------
// Fonctions pures (testées à part)
// ---------------------------------------------------------------------------------------------

export interface BlockText {
  /** Texte du paragraphe (un élément en ligne qui n'est pas du texte compte pour un espace). */
  text: string;
  /** Position dans le document de chaque caractère du texte. */
  starts: number[];
}

/** Paragraphes du document (blocs de texte), dans l'ordre. */
export function textBlocks(doc: PMNode): BlockText[] {
  const out: BlockText[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const starts: number[] = [];
    node.forEach((child, offset) => {
      const at = pos + 1 + offset;
      if (child.isText) {
        for (let k = 0; k < child.text!.length; k++) starts.push(at + k);
        text += child.text;
      } else {
        starts.push(at);
        text += ' ';
      }
    });
    out.push({ text, starts });
    return false;
  });
  return out;
}

/** Vaut-il la peine d'envoyer ce paragraphe ? (au moins un mot de deux lettres) */
export const worthChecking = (text: string) => /\p{L}{2}/u.test(text);

/** Regroupe des textes en lots de moins de `max` caractères (un texte trop long est écarté). */
export function batchTexts(texts: string[], max = MAX_TEXT_LENGTH): string[][] {
  const batches: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const t of texts) {
    if (t.length > max) continue;
    const add = (cur.length ? SEP.length : 0) + t.length;
    if (size + add > max && cur.length) { batches.push(cur); cur = []; size = 0; }
    cur.push(t);
    size += (cur.length > 1 ? SEP.length : 0) + t.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** Fautes d'une requête rendues à chaque texte, décalages relatifs au texte. */
export function splitIssues(batch: string[], issues: SpellIssue[]): Map<string, SpellIssue[]> {
  const out = new Map<string, SpellIssue[]>(batch.map((t) => [t, []]));
  let start = 0;
  const ranges = batch.map((t) => { const r = { t, start, end: start + t.length }; start += t.length + SEP.length; return r; });
  for (const issue of issues) {
    const r = ranges.find((x) => issue.offset >= x.start && issue.offset + issue.length <= x.end);
    if (r) out.get(r.t)!.push({ ...issue, offset: issue.offset - r.start });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------------------------

export interface SpellHit { issue: SpellIssue; from: number; to: number }

export interface SpellStorage {
  /** Fautes trouvées, par texte de paragraphe. */
  cache: Map<string, SpellIssue[]>;
  /** Paragraphes corrigés par une proposition : soulignements gardés, mais à renvoyer au moteur. */
  stale: Set<string>;
  ignored: Set<string>;
  dictionary: Set<string>;
  /** Soulignements affichés (une vérification a eu lieu). */
  active: boolean;
  /** Vérification pendant la frappe. */
  live: boolean;
  checking: boolean;
  error: boolean;
  lastRequest: number;
  timer: number;
  /** Clic sur un mot souligné (branché par l'éditeur). */
  onOpen: ((hit: SpellHit, rect: DOMRect) => void) | null;
}

declare module '@tiptap/core' {
  interface Storage {
    courseSpell: SpellStorage;
  }
}

export const spellKey = new PluginKey<DecorationSet>('courseSpell');

function buildDecorations(doc: PMNode, s: SpellStorage): DecorationSet {
  if (!s.active) return DecorationSet.empty;
  const decos: Decoration[] = [];
  for (const b of textBlocks(doc)) {
    const issues = s.cache.get(b.text);
    if (!issues) continue;
    for (const issue of issues) {
      if (isIgnored(issue, s.dictionary, s.ignored)) continue;
      const from = b.starts[issue.offset];
      const last = b.starts[issue.offset + issue.length - 1];
      if (from == null || last == null) continue;
      decos.push(Decoration.inline(from, last + 1, { class: `ce-spell ce-spell--${issue.kind}`, title: issue.short }, { issue }));
    }
  }
  return DecorationSet.create(doc, decos);
}

/** Fautes affichées, dans l'ordre du document. */
export function spellHits(state: EditorState): SpellHit[] {
  const set = spellKey.getState(state);
  if (!set) return [];
  return set.find().map((d) => ({ issue: (d.spec as { issue: SpellIssue }).issue, from: d.from, to: d.to })).sort((a, b) => a.from - b.from);
}

const refresh = (editor: Editor) => {
  if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(spellKey, 'refresh').setMeta('addToHistory', false));
};

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Envoie au moteur les paragraphes pas encore vérifiés. Renvoie le nombre de fautes affichées,
 * ou lève si le moteur ne répond pas (réseau, quota).
 */
export async function checkCourse(editor: Editor): Promise<number> {
  const s = editor.storage.courseSpell;
  if (s.checking) return spellHits(editor.state).length;
  s.checking = true;
  s.error = false;
  s.active = true;
  refresh(editor);
  try {
    const todo = [...new Set(textBlocks(editor.state.doc).map((b) => b.text))].filter((t) => (!s.cache.has(t) || s.stale.has(t)) && worthChecking(t));
    for (const batch of batchTexts(todo)) {
      const since = Date.now() - s.lastRequest;
      if (since < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - since);
      s.lastRequest = Date.now();
      const issues = await checkText(batch.join(SEP));
      for (const [t, list] of splitIssues(batch, issues)) { s.cache.set(t, list); s.stale.delete(t); }
      refresh(editor);
    }
    // Paragraphes trop courts ou trop longs : rien à souligner
    for (const t of todo) if (!s.cache.has(t)) s.cache.set(t, []);
  } catch (err) {
    s.error = true;
    throw err;
  } finally {
    s.checking = false;
    refresh(editor);
  }
  return spellHits(editor.state).length;
}

/** Masque les soulignements (les résultats restent en mémoire). */
export function hideSpell(editor: Editor): void {
  editor.storage.courseSpell.active = false;
  refresh(editor);
}

/**
 * Applique une proposition. Les autres fautes du même paragraphe restent soulignées (le
 * paragraphe corrigé est mis en mémoire avec elles, décalées) : pas besoin de revérifier.
 */
export function applySuggestion(editor: Editor, hit: SpellHit, value: string): boolean {
  const { state } = editor;
  if (state.doc.textBetween(hit.from, hit.to) !== hit.issue.text) return false;
  const s = editor.storage.courseSpell;
  const block = textBlocks(state.doc).find((b) => b.starts.includes(hit.from));
  if (block) {
    const off = block.starts.indexOf(hit.from);
    const end = off + hit.issue.length;
    const delta = value.length - hit.issue.length;
    const rest = (s.cache.get(block.text) ?? [])
      .filter((i) => i !== hit.issue && (i.offset + i.length <= off || i.offset >= end))
      .map((i) => (i.offset >= end ? { ...i, offset: i.offset + delta } : i));
    const corrected = block.text.slice(0, off) + value + block.text.slice(end);
    s.cache.set(corrected, rest);
    // Une correction peut en appeler une autre (« les élèves travaille ») : à revérifier
    s.stale.add(corrected);
  }
  // insertText garde la mise en forme du mot (gras, couleur…)
  editor.chain().focus().command(({ tr }) => { tr.insertText(value, hit.from, hit.to); return true; }).run();
  return true;
}

export function ignoreIssue(editor: Editor, issue: SpellIssue): void {
  editor.storage.courseSpell.ignored.add(ignoreKey(issue));
  refresh(editor);
}

export function addToDictionary(editor: Editor, issue: SpellIssue): void {
  const s = editor.storage.courseSpell;
  s.dictionary.add(issue.text.toLowerCase());
  saveDictionary(s.dictionary);
  refresh(editor);
}

export function setLiveSpell(editor: Editor, live: boolean): void {
  editor.storage.courseSpell.live = live;
  if (live) void checkCourse(editor).catch(() => { /* silence : on réessaiera à la prochaine frappe */ });
  refresh(editor);
}

export const CourseSpell = Extension.create<Record<string, never>, SpellStorage>({
  name: 'courseSpell',

  addStorage() {
    return {
      cache: new Map(),
      stale: new Set(),
      ignored: new Set(),
      dictionary: loadDictionary(),
      active: false,
      live: false,
      checking: false,
      error: false,
      lastRequest: 0,
      timer: 0,
      onOpen: null,
    };
  },

  onDestroy() {
    window.clearTimeout(this.storage.timer);
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const editor = this.editor;
    return [
      new Plugin<DecorationSet>({
        key: spellKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, prev, _old, next) => {
            if (tr.getMeta(spellKey) || (tr.docChanged && storage.active)) return buildDecorations(next.doc, storage);
            return prev;
          },
        },
        props: {
          decorations: (state) => spellKey.getState(state) ?? DecorationSet.empty,
          handleClick: (view, pos, event) => {
            const set = spellKey.getState(view.state);
            const hit = set?.find(pos, pos).find((d) => d.from <= pos && d.to >= pos);
            if (!hit || !storage.onOpen) return false;
            const el = (event.target as HTMLElement).closest('.ce-spell') as HTMLElement | null;
            storage.onOpen({ issue: (hit.spec as { issue: SpellIssue }).issue, from: hit.from, to: hit.to }, (el ?? (event.target as HTMLElement)).getBoundingClientRect());
            return false;
          },
        },
        view: () => ({
          update: (view, prevState) => {
            // Pendant la frappe : les paragraphes modifiés partent 2 s après la dernière touche
            if (!storage.live || view.state.doc.eq(prevState.doc)) return;
            window.clearTimeout(storage.timer);
            storage.timer = window.setTimeout(() => {
              void checkCourse(editor).catch(() => { /* hors connexion ou quota : silence */ });
            }, LIVE_DELAY_MS);
          },
        }),
      }),
    ];
  },
});
