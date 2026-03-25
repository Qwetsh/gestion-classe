import { useState, useCallback, useMemo } from 'react';
import { SVT_THEMES, SVT_VOCABULARY } from './svt-vocabulary';
import { FRENCH_THEMES, FRENCH_VOCABULARY } from './french-vocabulary';
import { ENGLISH_THEMES, ENGLISH_VOCABULARY } from './english-vocabulary';
import { HISTORY_GEO_THEMES, HISTORY_GEO_VOCABULARY } from './history-geo-vocabulary';
import { MATH_THEMES, MATH_VOCABULARY } from './math-vocabulary';
import { GERMAN_THEMES, GERMAN_VOCABULARY } from './german-vocabulary';

// --- Crossword generation algorithm ---

interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: 'H' | 'V';
  number: number;
}

interface Cell {
  letter: string;
  numbers: number[];
}

type Grid = (Cell | null)[][];

// --- Core placement engine ---

type RawPlacement = Omit<PlacedWord, 'number'>;

function getLetterAt(placed: RawPlacement[], r: number, c: number): string | null {
  for (const p of placed) {
    const len = p.word.length;
    if (p.direction === 'H' && p.row === r && c >= p.col && c < p.col + len) return p.word[c - p.col];
    if (p.direction === 'V' && p.col === c && r >= p.row && r < p.row + len) return p.word[r - p.row];
  }
  return null;
}

function canPlace(placed: RawPlacement[], word: string, row: number, col: number, dir: 'H' | 'V'): number {
  // Returns number of intersections (>0 = valid), 0 = invalid, -1 = invalid
  const dr = dir === 'V' ? 1 : 0;
  const dc = dir === 'H' ? 1 : 0;

  if (getLetterAt(placed, row - dr, col - dc) !== null) return -1;
  if (getLetterAt(placed, row + dr * word.length, col + dc * word.length) !== null) return -1;

  let intersections = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = getLetterAt(placed, r, c);
    if (existing !== null) {
      if (existing !== word[i]) return -1;
      intersections++;
    } else {
      if (getLetterAt(placed, r + dc, c + dr) !== null || getLetterAt(placed, r - dc, c - dr) !== null) return -1;
    }
  }
  if (placed.length === 0) return 1;
  return intersections > 0 ? intersections : -1;
}

function getBounds(placed: RawPlacement[]): { minR: number; minC: number; maxR: number; maxC: number } {
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const p of placed) {
    const dr = p.direction === 'V' ? 1 : 0;
    const dc = p.direction === 'H' ? 1 : 0;
    minR = Math.min(minR, p.row);
    minC = Math.min(minC, p.col);
    maxR = Math.max(maxR, p.row + dr * (p.word.length - 1));
    maxC = Math.max(maxC, p.col + dc * (p.word.length - 1));
  }
  return { minR, minC, maxR, maxC };
}

function boundingArea(placed: RawPlacement[], extraWord: string, row: number, col: number, dir: 'H' | 'V'): number {
  const b = getBounds(placed);
  const dr = dir === 'V' ? 1 : 0;
  const dc = dir === 'H' ? 1 : 0;
  const endR = row + dr * (extraWord.length - 1);
  const endC = col + dc * (extraWord.length - 1);
  const totalR = Math.max(b.maxR, endR) - Math.min(b.minR, row) + 1;
  const totalC = Math.max(b.maxC, endC) - Math.min(b.minC, col) + 1;
  return totalR * totalC;
}

function runPlacement(entries: { word: string; clue: string }[]): RawPlacement[] {
  const placed: RawPlacement[] = [];

  if (entries.length === 0) return placed;

  // Place first word horizontally at origin
  placed.push({ word: entries[0].word, clue: entries[0].clue, row: 0, col: 0, direction: 'H' });

  for (let wi = 1; wi < entries.length; wi++) {
    const { word, clue } = entries[wi];
    let bestPos: { row: number; col: number; dir: 'H' | 'V' } | null = null;
    let bestScore = Infinity;

    // Try intersecting with every placed word
    for (const pw of placed) {
      for (let pi = 0; pi < pw.word.length; pi++) {
        for (let wi2 = 0; wi2 < word.length; wi2++) {
          if (pw.word[pi] !== word[wi2]) continue;

          // Try perpendicular direction
          const tryDir = pw.direction === 'H' ? 'V' as const : 'H' as const;
          const row = tryDir === 'V' ? pw.row - wi2 : pw.row + pi;
          const col = tryDir === 'V' ? pw.col + pi : pw.col - wi2;

          const intersections = canPlace(placed, word, row, col, tryDir);
          if (intersections <= 0) continue;

          // Score = bounding area (smaller is better) minus intersection bonus
          const area = boundingArea(placed, word, row, col, tryDir);
          const score = area - intersections * 50; // heavy bonus for multiple intersections

          if (score < bestScore) {
            bestScore = score;
            bestPos = { row, col, dir: tryDir };
          }
        }
      }
    }

    if (bestPos) {
      placed.push({ word, clue, row: bestPos.row, col: bestPos.col, direction: bestPos.dir });
    }
  }

  return placed;
}

function finalize(placed: RawPlacement[]): { grid: Grid; placed: PlacedWord[]; rows: number; cols: number } {
  if (placed.length === 0) return { grid: [], placed: [], rows: 0, cols: 0 };

  const b = getBounds(placed);
  const rows = b.maxR - b.minR + 1;
  const cols = b.maxC - b.minC + 1;

  // Normalize coordinates
  const normalized = placed.map((p) => ({ ...p, row: p.row - b.minR, col: p.col - b.minC }));

  // Number assignment: sort by reading order (top-to-bottom, left-to-right)
  const numbered = normalized.map((p, idx) => ({ ...p, sortKey: p.row * 10000 + p.col, idx })).sort((a, b) => a.sortKey - b.sortKey);
  const cellNumbers = new Map<string, number>();
  let num = 1;
  const finalPlaced: PlacedWord[] = [];
  for (const p of numbered) {
    const key = `${p.row},${p.col}`;
    if (!cellNumbers.has(key)) cellNumbers.set(key, num++);
    finalPlaced.push({ ...normalized[p.idx], number: cellNumbers.get(key)! });
  }

  // Build grid
  const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of finalPlaced) {
    const dr = p.direction === 'V' ? 1 : 0;
    const dc = p.direction === 'H' ? 1 : 0;
    for (let i = 0; i < p.word.length; i++) {
      const r = p.row + dr * i, c = p.col + dc * i;
      if (!grid[r][c]) grid[r][c] = { letter: p.word[i], numbers: [] };
      if (i === 0 && !grid[r][c]!.numbers.includes(p.number)) grid[r][c]!.numbers.push(p.number);
    }
  }

  return { grid, placed: finalPlaced, rows, cols };
}

function generateCrossword(entries: { word: string; clue: string }[]): {
  grid: Grid;
  placed: PlacedWord[];
  rows: number;
  cols: number;
} {
  if (entries.length === 0) return { grid: [], placed: [], rows: 0, cols: 0 };

  // Try multiple strategies and keep the best (most compact with most words placed)
  const ATTEMPTS = 15;
  let bestPlaced: RawPlacement[] = [];
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // Strategy: vary word order
    let ordered: typeof entries;
    if (attempt === 0) {
      // First attempt: longest first
      ordered = [...entries].sort((a, b) => b.word.length - a.word.length);
    } else {
      // Subsequent: shuffle but keep longest word first for a stable anchor
      const longest = [...entries].sort((a, b) => b.word.length - a.word.length);
      const first = longest[0];
      const rest = shuffle(longest.slice(1));
      ordered = [first, ...rest];
    }

    const placed = runPlacement(ordered);

    // Score: prioritize placing more words, then compactness
    const b = placed.length > 0 ? getBounds(placed) : { minR: 0, minC: 0, maxR: 0, maxC: 0 };
    const area = (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
    // Count total filled cells
    let filled = 0;
    for (const p of placed) filled += p.word.length;
    // Density = filled / area (higher is better)
    const density = area > 0 ? filled / area : 0;
    // Score: words placed is king, then density
    const score = placed.length * 1000 + density * 100;

    if (score > bestScore) {
      bestScore = score;
      bestPlaced = placed;
    }
  }

  return finalize(bestPlaced);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Shared grid + clues renderer ---

function CrosswordResult({
  result,
  showSolution,
  setShowSolution,
  onRegenerate,
  extra,
}: {
  result: ReturnType<typeof generateCrossword>;
  showSolution: boolean;
  setShowSolution: (v: boolean) => void;
  onRegenerate: () => void;
  printRef?: React.RefObject<HTMLDivElement | null>;
  extra?: React.ReactNode;
}) {
  const cellSize = 36;

  function printCrossword() {
    const w = window.open('', '_blank');
    if (!w) return;

    // Build grid HTML from data (not DOM)
    let gridHtml = '<table class="grid"><tbody>';
    for (let ri = 0; ri < result.grid.length; ri++) {
      gridHtml += '<tr>';
      for (let ci = 0; ci < result.grid[ri].length; ci++) {
        const cell = result.grid[ri][ci];
        if (cell) {
          const numHtml = cell.numbers.length > 0
            ? `<span class="num">${cell.numbers.join(',')}</span>`
            : '';
          gridHtml += `<td>${numHtml}</td>`;
        } else {
          gridHtml += '<td class="empty"></td>';
        }
      }
      gridHtml += '</tr>';
    }
    gridHtml += '</tbody></table>';

    // Build clues HTML
    const horizontal = result.placed.filter((p) => p.direction === 'H').sort((a, b) => a.number - b.number);
    const vertical = result.placed.filter((p) => p.direction === 'V').sort((a, b) => a.number - b.number);

    const clueItem = (p: PlacedWord) =>
      `<li><strong>${p.number}.</strong> ${p.clue || '—'} <span class="letters">(${p.word.length} lettres)</span></li>`;

    const cluesHtml = `<div class="clues-wrap">
      <div class="clues-col">
        <h3>&#8594; Horizontalement <span class="count">(${horizontal.length})</span></h3>
        <ol>${horizontal.map(clueItem).join('')}</ol>
      </div>
      <div class="clues-col">
        <h3>&#8595; Verticalement <span class="count">(${vertical.length})</span></h3>
        <ol>${vertical.map(clueItem).join('')}</ol>
      </div>
    </div>`;

    w.document.write(`<!DOCTYPE html><html><head><title>Mots croisés</title><style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }

      .grid-wrapper { page-break-inside: avoid; break-inside: avoid; display: inline-block; margin-bottom: 20px; }
      .grid { border-collapse: separate; border-spacing: 0; }
      .grid td {
        width: 28px; height: 28px;
        border-top: 1.5px solid #334155;
        border-left: 1.5px solid #334155;
        border-right: 1.5px solid #334155;
        border-bottom: 1.5px solid #334155;
        text-align: center; vertical-align: middle;
        font-weight: bold; font-size: 14px;
        position: relative; background: #fff;
        padding: 0;
      }
      .grid td.empty { background: transparent; border: none !important; }
      .grid .num {
        position: absolute; top: 1px; left: 2px;
        font-size: 8px; font-weight: 600; color: #4A90D9;
        line-height: 1;
      }

      .clues-wrap { display: flex; gap: 28px; margin-top: 16px; }
      .clues-col { flex: 1; }
      .clues-col h3 {
        font-size: 13px; margin: 0 0 8px;
        padding-bottom: 5px; border-bottom: 2px solid #4A90D9;
        color: #1e293b;
      }
      .clues-col h3 .count { font-weight: normal; color: #94a3b8; font-size: 11px; }
      .clues-col ol { margin: 0; padding-left: 0; list-style: none; }
      .clues-col li { margin-bottom: 4px; font-size: 12px; line-height: 1.5; }
      .clues-col li strong { color: #4A90D9; margin-right: 2px; }
      .letters { color: #94a3b8; font-size: 10px; }

      @media print {
        body { margin: 12px; }
        .grid-wrapper { page-break-inside: avoid; break-inside: avoid; }
      }
    </style></head><body>
      <div class="grid-wrapper">${gridHtml}</div>
      ${cluesHtml}
    </body></html>`);
    w.document.close();
    w.print();
  }

  if (result.placed.length === 0) return null;

  const horizontal = result.placed.filter((p) => p.direction === 'H').sort((a, b) => a.number - b.number);
  const vertical = result.placed.filter((p) => p.direction === 'V').sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div
        className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]"
        style={{ boxShadow: 'var(--shadow-xs)' }}
      >
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text)]">{result.placed.length}</span> mots placés
          <span className="mx-1 text-[var(--color-border)]">|</span>
          <span className="font-semibold text-[var(--color-text)]">{result.rows}&times;{result.cols}</span> grille
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-all active:scale-95"
          >
            Regénérer
          </button>
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 text-white"
            style={{ background: showSolution ? 'var(--gradient-success)' : 'var(--gradient-primary)', boxShadow: 'var(--shadow-xs)' }}
          >
            {showSolution ? 'Masquer solution' : 'Voir solution'}
          </button>
          <button
            onClick={printCrossword}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: 'var(--gradient-header)', boxShadow: 'var(--shadow-xs)' }}
          >
            Imprimer
          </button>
        </div>
      </div>

      {/* Grid + Clues */}
      <div>
        {/* Grid card */}
        <div
          className="rounded-2xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)] inline-block"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <tbody>
              {result.grid.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) =>
                    cell ? (
                      <td
                        key={ci}
                        style={{
                          width: cellSize, height: cellSize,
                          borderTop: '1.5px solid #334155',
                          borderLeft: '1.5px solid #334155',
                          borderRight: '1.5px solid #334155',
                          borderBottom: '1.5px solid #334155',
                          textAlign: 'center',
                          fontWeight: 700, fontSize: 15,
                          position: 'relative', backgroundColor: '#fff',
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      >
                        {cell.numbers.length > 0 && (
                          <span className="num" style={{
                            position: 'absolute', top: 1, left: 3,
                            fontSize: 9, fontWeight: 600,
                            color: '#4A90D9', lineHeight: 1,
                          }}>
                            {cell.numbers.join(',')}
                          </span>
                        )}
                        {showSolution && (
                          <span style={{ color: '#1E293B' }}>{cell.letter}</span>
                        )}
                      </td>
                    ) : (
                      <td key={ci} className="empty" style={{ width: cellSize, height: cellSize, backgroundColor: 'transparent', border: 'none' }} />
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Clues */}
        <div className="clues-wrap mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Horizontal */}
          <div
            className="clues-col rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-xs)' }}
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)] mb-3 pb-2 border-b-2 border-[var(--color-primary)]">
              <span style={{ color: 'var(--color-primary)' }}>&#8594;</span>
              Horizontalement
              <span className="ml-auto text-xs font-normal text-[var(--color-text-tertiary)]">{horizontal.length} mots</span>
            </h3>
            <ol className="space-y-2">
              {horizontal.map((p) => (
                <li key={p.number} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  <strong className="text-[var(--color-primary)] mr-1">{p.number}.</strong>
                  {p.clue || '—'}
                  <span className="letters ml-1 text-xs text-[var(--color-text-tertiary)]">({p.word.length} lettres)</span>
                </li>
              ))}
            </ol>
          </div>
          {/* Vertical */}
          <div
            className="clues-col rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-xs)' }}
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)] mb-3 pb-2 border-b-2 border-[var(--color-primary)]">
              <span style={{ color: 'var(--color-primary)' }}>&#8595;</span>
              Verticalement
              <span className="ml-auto text-xs font-normal text-[var(--color-text-tertiary)]">{vertical.length} mots</span>
            </h3>
            <ol className="space-y-2">
              {vertical.map((p) => (
                <li key={p.number} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  <strong className="text-[var(--color-primary)] mr-1">{p.number}.</strong>
                  {p.clue || '—'}
                  <span className="letters ml-1 text-xs text-[var(--color-text-tertiary)]">({p.word.length} lettres)</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {extra}
    </div>
  );
}

// --- Vocabulary source configs ---

interface VocabTerm { word: string; definition: string; theme: string; }

interface VocabSource {
  key: string;
  icon: string;
  label: string;
  desc: string;
  themes: readonly string[];
  vocabulary: VocabTerm[];
}

const VOCAB_SOURCES: VocabSource[] = [
  { key: 'svt', icon: '🧬', label: 'SVT Collège', desc: `${SVT_VOCABULARY.length} termes du programme officiel`, themes: SVT_THEMES, vocabulary: SVT_VOCABULARY },
  { key: 'francais', icon: '📖', label: 'Français Collège', desc: `${FRENCH_VOCABULARY.length} termes littéraires et grammaticaux`, themes: FRENCH_THEMES, vocabulary: FRENCH_VOCABULARY },
  { key: 'anglais', icon: '🇬🇧', label: 'Anglais Collège', desc: `${ENGLISH_VOCABULARY.length} termes et verbes irréguliers`, themes: ENGLISH_THEMES, vocabulary: ENGLISH_VOCABULARY },
  { key: 'histoire', icon: '🏛️', label: 'Histoire-Géo Collège', desc: `${HISTORY_GEO_VOCABULARY.length} termes d'histoire et géographie`, themes: HISTORY_GEO_THEMES, vocabulary: HISTORY_GEO_VOCABULARY },
  { key: 'maths', icon: '📐', label: 'Maths Collège', desc: `${MATH_VOCABULARY.length} termes mathématiques`, themes: MATH_THEMES, vocabulary: MATH_VOCABULARY },
  { key: 'allemand', icon: '🇩🇪', label: 'Allemand Collège', desc: `${GERMAN_VOCABULARY.length} termes et verbes forts`, themes: GERMAN_THEMES, vocabulary: GERMAN_VOCABULARY },
];

// --- Main component with tabs ---

type Mode = 'libre' | 'svt' | 'francais' | 'anglais' | 'histoire' | 'maths' | 'allemand';

export default function CrosswordGenerator() {
  const [mode, setMode] = useState<Mode>('libre');

  // Libre mode state
  const [wordList, setWordList] = useState<{ word: string; clue: string }[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [libreView, setLibreView] = useState<'form' | 'text'>('form');
  const [textInput, setTextInput] = useState('');

  // Vocabulary mode state (shared across svt/francais/anglais)
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [wordCount, setWordCount] = useState(10);
  const [usedTerms, setUsedTerms] = useState<VocabTerm[]>([]);
  const [hideEnglishForms, setHideEnglishForms] = useState(false);

  // Shared state
  const [showSolution, setShowSolution] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof generateCrossword> | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  // Current vocabulary source (null for libre mode)
  const vocabSource = useMemo(
    () => VOCAB_SOURCES.find((s) => s.key === mode) ?? null,
    [mode],
  );

  const termsByTheme = useMemo(() => {
    if (!vocabSource) return new Map<string, VocabTerm[]>();
    const map = new Map<string, VocabTerm[]>();
    for (const t of vocabSource.vocabulary) {
      if (!map.has(t.theme)) map.set(t.theme, []);
      map.get(t.theme)!.push(t);
    }
    return map;
  }, [vocabSource]);

  const availableCount = useMemo(() => {
    if (!vocabSource) return 0;
    if (selectedThemes.size === 0) return vocabSource.vocabulary.length;
    return vocabSource.vocabulary.filter((t) => selectedThemes.has(t.theme)).length;
  }, [vocabSource, selectedThemes]);

  function toggleTheme(theme: string) {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }

  function addWord() {
    const w = newWord.trim().toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, '');
    if (w.length < 2) return;
    setWordList((prev) => [...prev, { word: w, clue: newClue.trim() }]);
    setNewWord('');
    setNewClue('');
  }

  function removeWord(idx: number) {
    setWordList((prev) => prev.filter((_, i) => i !== idx));
  }

  function importExcel(file: File) {
    import('xlsx').then(({ read, utils }) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = utils.sheet_to_json(sheet, { header: 1 });

        const imported: { word: string; clue: string }[] = [];
        for (const row of rows) {
          if (!row[0]) continue;
          const w = String(row[0]).trim().toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, '');
          if (w.length < 2) continue;
          imported.push({ word: w, clue: row[1] ? String(row[1]).trim() : '' });
        }
        setWordList((prev) => [...prev, ...imported]);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function syncTextToList() {
    const lines = textInput.split('\n').map((l) => l.trim()).filter(Boolean);
    const entries = lines.map((line) => {
      const sep = line.indexOf(':');
      if (sep > 0) {
        return {
          word: line.slice(0, sep).trim().toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, ''),
          clue: line.slice(sep + 1).trim(),
        };
      }
      return { word: line.toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, ''), clue: '' };
    }).filter((e) => e.word.length >= 2);
    setWordList(entries);
    setLibreView('form');
  }

  function syncListToText() {
    setTextInput(wordList.map((e) => e.clue ? `${e.word} : ${e.clue}` : e.word).join('\n'));
    setLibreView('text');
  }

  const generateLibre = useCallback(() => {
    const entries = wordList.filter((e) => e.word.length >= 2);
    if (entries.length === 0) return;

    const res = generateCrossword(entries);
    const placedWords = new Set(res.placed.map((p) => p.word));
    setSkipped(entries.filter((e) => !placedWords.has(e.word)).map((e) => e.word));
    setResult(res);
    setShowSolution(false);
  }, [wordList]);

  const generateVocab = useCallback(() => {
    if (!vocabSource) return;
    const pool = selectedThemes.size === 0
      ? vocabSource.vocabulary
      : vocabSource.vocabulary.filter((t) => selectedThemes.has(t.theme));

    const unique = new Map<string, VocabTerm>();
    for (const t of shuffle(pool)) {
      if (!unique.has(t.word)) unique.set(t.word, t);
    }

    const selected = [...unique.values()].slice(0, wordCount);
    setUsedTerms(selected);

    const entries = selected.map((t) => {
      let clue = t.definition;
      // Strip verb forms "(preterit — past participle)" when option is active
      if (hideEnglishForms && (mode === 'anglais' || mode === 'allemand')) {
        clue = clue.replace(/\s*\(.*\)\s*$/, '').trim();
      }
      return { word: t.word, clue };
    });
    const res = generateCrossword(entries);
    const placedWords = new Set(res.placed.map((p) => p.word));
    setSkipped(entries.filter((e) => !placedWords.has(e.word)).map((e) => e.word));
    setResult(res);
    setShowSolution(false);
  }, [vocabSource, selectedThemes, wordCount, hideEnglishForms, mode]);

  const generate = mode === 'libre' ? generateLibre : generateVocab;

  function switchMode(m: Mode) {
    setMode(m);
    setResult(null);
    setSkipped([]);
    setShowSolution(false);
    setSelectedThemes(new Set());
    setUsedTerms([]);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Mode selector */}
      <div
        className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]"
        style={{ boxShadow: 'var(--shadow-xs)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Source des mots</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: 'libre' as const, icon: '✍️', label: 'Saisie libre', desc: 'Vos propres mots et définitions' },
            ...VOCAB_SOURCES.map((s) => ({ key: s.key as Mode, icon: s.icon, label: s.label, desc: s.desc })),
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => switchMode(opt.key)}
              className={`flex-1 p-4 rounded-xl text-left transition-all border-2 ${
                mode === opt.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)] hover:border-[var(--color-text-tertiary)]'
              }`}
            >
              <div className="text-xl mb-1">{opt.icon}</div>
              <div className={`text-sm font-semibold ${mode === opt.key ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Libre mode */}
      {mode === 'libre' && (
        <div
          className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-xs)' }}
        >
          {/* Header with toggle + import */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Mots et définitions
              </h2>
              {wordList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                  {wordList.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle form/text */}
              <button
                onClick={() => libreView === 'form' ? syncListToText() : syncTextToList()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-all"
              >
                {libreView === 'form' ? 'Mode texte' : 'Mode formulaire'}
              </button>
              {/* Import Excel */}
              <label className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-all cursor-pointer">
                Importer Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importExcel(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="p-5">
            {libreView === 'form' ? (
              <>
                {/* Add word row */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
                    placeholder="Mot"
                    className="w-40 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newClue}
                    onChange={(e) => setNewClue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
                    placeholder="Définition (optionnelle)"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  />
                  <button
                    onClick={addWord}
                    disabled={newWord.trim().length < 2}
                    className="w-11 h-11 rounded-xl text-white text-lg font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center shrink-0"
                    style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-xs)' }}
                  >
                    +
                  </button>
                </div>

                {/* Word list */}
                {wordList.length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                    <div className="text-3xl mb-2">&#9998;</div>
                    <p className="text-sm">Ajoutez des mots pour commencer</p>
                    <p className="text-xs mt-1">ou importez un fichier Excel</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                    {wordList.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] group hover:border-[var(--color-primary)] transition-all"
                      >
                        <span className="text-xs font-bold text-[var(--color-text-tertiary)] w-5 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text)] uppercase min-w-[80px]">
                          {entry.word}
                        </span>
                        {entry.clue && (
                          <>
                            <span className="text-[var(--color-border)]">&mdash;</span>
                            <span className="text-sm text-[var(--color-text-secondary)] flex-1 truncate">
                              {entry.clue}
                            </span>
                          </>
                        )}
                        {!entry.clue && <span className="flex-1" />}
                        <button
                          onClick={() => removeWord(idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-all opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clear all */}
                {wordList.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => setWordList([])}
                      className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
                    >
                      Tout effacer
                    </button>
                    <button
                      onClick={generate}
                      className="px-6 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
                    >
                      Générer les mots croisés
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Text mode */
              <>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={"CHAT : Animal domestique qui miaule\nCHIEN : Meilleur ami de l'homme\nOISEAU : Il a des plumes"}
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  autoFocus
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                  Un mot par ligne &middot; Format : <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">MOT : définition</code>
                </p>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={syncTextToList}
                    disabled={!textInput.trim()}
                    className="px-6 py-2.5 rounded-xl text-white font-medium text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
                  >
                    Valider et revenir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Vocabulary mode (SVT / Français / Anglais) */}
      {vocabSource && (
        <>
          {/* Themes */}
          <div
            className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-xs)' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
              Thèmes
              {selectedThemes.size > 0 && (
                <span className="ml-2 text-[var(--color-primary)]">({selectedThemes.size} sélectionné{selectedThemes.size > 1 ? 's' : ''})</span>
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {vocabSource.themes.map((theme) => {
                const active = selectedThemes.has(theme);
                const count = termsByTheme.get(theme)?.length ?? 0;
                return (
                  <button
                    key={theme}
                    onClick={() => toggleTheme(theme)}
                    className={`flex flex-col items-center justify-center text-center p-3 rounded-xl transition-all active:scale-95 min-h-[72px] ${
                      active
                        ? 'text-white border-2 border-transparent'
                        : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                    }`}
                    style={active ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-xs)' } : undefined}
                  >
                    <span className="text-xs font-semibold leading-tight">{theme}</span>
                    <span className={`text-[10px] mt-1 ${active ? 'opacity-75' : 'opacity-40'}`}>{count} mots</span>
                  </button>
                );
              })}
            </div>
            {selectedThemes.size === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-3 flex items-center gap-1">
                <span>Aucune sélection = tous les thèmes</span>
                <span className="font-semibold">({vocabSource.vocabulary.length} mots)</span>
              </p>
            )}
          </div>

          {/* Language option: hide verb forms */}
          {(mode === 'anglais' || mode === 'allemand') && (
            <div
              className="rounded-2xl p-4 bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between"
              style={{ boxShadow: 'var(--shadow-xs)' }}
            >
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Options</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Masquer les formes verbales dans les définitions
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  N'affiche que la traduction française (ex : « Être » au lieu de « Être ({mode === 'allemand' ? 'war — gewesen' : 'was/were — been'}) »)
                </p>
              </div>
              <button
                onClick={() => setHideEnglishForms(!hideEnglishForms)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ml-4 ${
                  hideEnglishForms ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                }`}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
                  style={{ transform: hideEnglishForms ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          )}

          {/* Word count + generate */}
          <div
            className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-wrap items-end gap-6"
            style={{ boxShadow: 'var(--shadow-xs)' }}
          >
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">Nombre de mots</h2>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={4}
                  max={Math.min(30, availableCount)}
                  value={Math.min(wordCount, availableCount)}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-primary)]"
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                  style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-xs)' }}
                >
                  {Math.min(wordCount, availableCount)}
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                {availableCount} mots disponibles dans {selectedThemes.size || vocabSource.themes.length} thème{(selectedThemes.size || vocabSource.themes.length) > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={generate}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              Générer les mots croisés
            </button>
          </div>
        </>
      )}

      {/* Skipped warning */}
      {skipped.length > 0 && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--color-remarque-soft)] border border-[var(--color-remarque)]"
        >
          <span className="text-lg">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">
              {skipped.length} mot{skipped.length > 1 ? 's' : ''} non placé{skipped.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Pas d'intersection trouvée : {skipped.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <CrosswordResult
          result={result}
          showSolution={showSolution}
          setShowSolution={setShowSolution}
          onRegenerate={generate}
          extra={
            vocabSource && usedTerms.length > 0 ? (
              <details className="mt-2 rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <summary className="px-5 py-3 text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-colors bg-[var(--color-surface)]">
                  Voir les {usedTerms.length} mots sélectionnés
                </summary>
                <div className="p-5 bg-[var(--color-surface)] grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[var(--color-border)]">
                  {usedTerms.map((t) => (
                    <div key={t.word} className="text-xs text-[var(--color-text-secondary)] py-1">
                      <span className="font-semibold text-[var(--color-text)]">{t.word}</span>
                      <span className="mx-1.5 text-[var(--color-border)]">&mdash;</span>
                      {t.definition}
                    </div>
                  ))}
                </div>
              </details>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
