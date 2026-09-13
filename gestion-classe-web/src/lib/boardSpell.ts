/**
 * Correcteur orthographique et grammatical des zones de texte du tableau blanc.
 *
 * Moteur : l'API publique de LanguageTool (https://api.languagetool.org/v2/check), gratuite
 * sans clé, limitée à 20 requêtes par minute et 20 Ko de texte par requête. Elle relève
 * l'orthographe, la grammaire et la typographie en français, avec des propositions.
 *
 * Ce module ne touche pas au DOM au-delà de la lecture : il extrait le texte brut d'un
 * éditeur en gardant la correspondance décalage → nœud texte, interroge le moteur, et rend
 * pour chaque faute une `Range` que le composant souligne avec l'API CSS Custom Highlight.
 * Le HTML stocké dans l'objet n'est jamais modifié par le soulignement : rien ne fuit dans
 * l'export, les vignettes ni l'écran des élèves.
 */

export type SpellKind = 'spelling' | 'grammar' | 'style';

export interface SpellIssue {
  /** Décalage et longueur dans le texte brut de la zone. */
  offset: number;
  length: number;
  /** Texte fautif tel qu'écrit. */
  text: string;
  message: string;
  short: string;
  suggestions: string[];
  kind: SpellKind;
  ruleId: string;
}

/** Correspondance entre le texte brut et les nœuds texte de l'éditeur. */
export interface TextMap {
  text: string;
  segments: { node: Text; start: number; length: number }[];
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'TR', 'TD', 'TH', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);

/**
 * Texte brut d'un éditeur contentEditable, avec un saut de ligne entre blocs, et la table des
 * nœuds texte pour retrouver chaque décalage dans le DOM.
 */
export function extractText(root: HTMLElement): TextMap {
  let text = '';
  const segments: TextMap['segments'] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data;
      if (!data) return;
      segments.push({ node: node as Text, start: text.length, length: data.length });
      text += data;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === 'BR') { text += '\n'; return; }
    const block = BLOCK_TAGS.has(el.tagName);
    if (block && text && !text.endsWith('\n')) text += '\n';
    for (const child of Array.from(el.childNodes)) walk(child);
    if (block && text && !text.endsWith('\n')) text += '\n';
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return { text, segments };
}

/** Position DOM d'un décalage du texte brut (null s'il tombe sur un saut de ligne virtuel). */
function positionAt(map: TextMap, offset: number, end: boolean): { node: Text; offset: number } | null {
  for (const s of map.segments) {
    // Pour une fin de plage, le décalage `start + length` appartient encore au segment
    if (offset >= s.start && (end ? offset <= s.start + s.length : offset < s.start + s.length)) {
      if (!s.node.isConnected) return null;
      return { node: s.node, offset: offset - s.start };
    }
  }
  return null;
}

/** `Range` DOM couvrant une faute, ou null si le texte a bougé depuis l'analyse. */
export function rangeForIssue(map: TextMap, issue: SpellIssue): Range | null {
  const a = positionAt(map, issue.offset, false);
  const b = positionAt(map, issue.offset + issue.length, true);
  if (!a || !b) return null;
  try {
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    if (r.toString() !== issue.text) return null;
    return r;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Appel du moteur
// ---------------------------------------------------------------------------------------------

const API_URL = 'https://api.languagetool.org/v2/check';
/** Le moteur refuse au-delà de 20 000 caractères ; on garde une marge. */
export const MAX_TEXT_LENGTH = 18000;

/** Règles trop bavardes au tableau : majuscule de début de phrase (listes, fragments), espaces insécables, doubles espaces, ponctuation fine. */
const IGNORED_RULES = /UPPERCASE_SENTENCE_START|ESPACE|WHITESPACE|NBSP|DOUBLE_PUNCTUATION|COMMA_PARENTHESIS|UNPAIRED_BRACKETS|APOS_TYP|POINTS_2|GUILLEMETS|TYPO_GUILLEMETS|ARROWS|MULTIPLICATION_SIGN|DASH_RULE/;

interface LtMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { id?: string; issueType?: string; category?: { id?: string } };
}

function kindOf(m: LtMatch): SpellKind {
  const issue = m.rule?.issueType ?? '';
  const cat = m.rule?.category?.id ?? '';
  if (issue === 'misspelling' || cat === 'TYPOS') return 'spelling';
  if (issue === 'style' || issue === 'typographical' || cat === 'STYLE' || cat === 'TYPOGRAPHY') return 'style';
  return 'grammar';
}

/**
 * Analyse un texte (français). Les espaces insécables sont envoyés comme des espaces ordinaires,
 * ce qui ne change pas les décalages. Lève en cas d'échec réseau ou de refus du moteur.
 */
export async function checkText(text: string, signal?: AbortSignal): Promise<SpellIssue[]> {
  const body = new URLSearchParams({
    text: text.replace(/\u00A0/g, ' '),
    language: 'fr',
    level: 'default',
  });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal,
  });
  if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
  const data = (await res.json()) as { matches?: LtMatch[] };
  const out: SpellIssue[] = [];
  for (const m of data.matches ?? []) {
    const ruleId = m.rule?.id ?? '';
    if (IGNORED_RULES.test(ruleId)) continue;
    if (m.length <= 0) continue;
    const covered = text.slice(m.offset, m.offset + m.length);
    if (!covered.trim()) continue;
    out.push({
      offset: m.offset,
      length: m.length,
      text: covered,
      message: m.message,
      short: m.shortMessage || defaultShort(kindOf(m)),
      suggestions: (m.replacements ?? []).map((r) => r.value).filter((v, i, arr) => v.trim() && arr.indexOf(v) === i).slice(0, 5),
      kind: kindOf(m),
      ruleId,
    });
  }
  return out;
}

function defaultShort(kind: SpellKind): string {
  return kind === 'spelling' ? 'Faute d’orthographe' : kind === 'grammar' ? 'Faute de grammaire' : 'Typographie';
}

// ---------------------------------------------------------------------------------------------
// Dictionnaire personnel (mots ajoutés) et mots ignorés pour la séance
// ---------------------------------------------------------------------------------------------

const DICT_KEY = 'classroom-board-spell-dict';

export function loadDictionary(): Set<string> {
  try {
    const raw = localStorage.getItem(DICT_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveDictionary(words: ReadonlySet<string>) {
  try { localStorage.setItem(DICT_KEY, JSON.stringify([...words])); } catch { /* stockage indisponible */ }
}

/** Clé d'ignorance : le mot pour l'orthographe, règle + texte pour le reste. */
export function ignoreKey(issue: SpellIssue): string {
  return issue.kind === 'spelling' ? issue.text.toLowerCase() : `${issue.ruleId}:${issue.text.toLowerCase()}`;
}

export function isIgnored(issue: SpellIssue, dictionary: ReadonlySet<string>, ignored: ReadonlySet<string>): boolean {
  if (ignored.has(ignoreKey(issue))) return true;
  return issue.kind === 'spelling' && dictionary.has(issue.text.toLowerCase());
}

/** Vrai si le navigateur sait souligner sans toucher au DOM (Chrome 105+, Edge, Safari 17.2+). */
export const supportsHighlights = (): boolean => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';
