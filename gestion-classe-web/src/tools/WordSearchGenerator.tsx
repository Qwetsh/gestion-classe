import { useState, useCallback, useMemo } from 'react';
import { SVT_THEMES, SVT_VOCABULARY } from './svt-vocabulary';
import { FRENCH_THEMES, FRENCH_VOCABULARY } from './french-vocabulary';
import { ENGLISH_THEMES, ENGLISH_VOCABULARY } from './english-vocabulary';
import { HISTORY_GEO_THEMES, HISTORY_GEO_VOCABULARY } from './history-geo-vocabulary';
import { MATH_THEMES, MATH_VOCABULARY } from './math-vocabulary';
import { GERMAN_THEMES, GERMAN_VOCABULARY } from './german-vocabulary';

// --- Word search generation algorithm ---

type Direction = [number, number]; // [dr, dc]

const DIRECTIONS: Direction[] = [
  [0, 1],   // →
  [0, -1],  // ←
  [1, 0],   // ↓
  [-1, 0],  // ↑
  [1, 1],   // ↘
  [-1, -1], // ↖
  [1, -1],  // ↙
  [-1, 1],  // ↗
];

interface PlacedSearchWord {
  word: string;
  row: number;
  col: number;
  dir: Direction;
}

interface WordSearchResult {
  grid: string[][];
  size: number;
  placed: PlacedSearchWord[];
  notPlaced: string[];
}

function generateWordSearch(words: string[]): WordSearchResult {
  // Sanitize & sort longest first
  const clean = words
    .map((w) => w.toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, ''))
    .filter((w) => w.length >= 2);

  const longest = Math.max(...clean.map((w) => w.length), 0);
  // Grid size: at least longest word + 2, scale with word count
  const size = Math.max(longest + 2, Math.ceil(Math.sqrt(clean.length * 12)), 10);

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: PlacedSearchWord[] = [];
  const notPlaced: string[] = [];

  // Sort longest first for better placement
  const sorted = [...clean].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    let didPlace = false;

    // Try many random placements
    const shuffledDirs = shuffle(DIRECTIONS);
    const attempts = 100;

    for (let att = 0; att < attempts && !didPlace; att++) {
      const dir = shuffledDirs[att % shuffledDirs.length];
      const [dr, dc] = dir;

      // Random start position
      const maxRow = size - (dr !== 0 ? (word.length - 1) * Math.abs(dr) : 0);
      const maxCol = size - (dc !== 0 ? (word.length - 1) * Math.abs(dc) : 0);
      const startRow = dr < 0 ? word.length - 1 + Math.floor(Math.random() * (size - word.length + 1)) : Math.floor(Math.random() * maxRow);
      const startCol = dc < 0 ? word.length - 1 + Math.floor(Math.random() * (size - word.length + 1)) : Math.floor(Math.random() * maxCol);

      if (canPlaceWord(grid, word, startRow, startCol, dir, size)) {
        placeWord(grid, word, startRow, startCol, dir);
        placed.push({ word, row: startRow, col: startCol, dir });
        didPlace = true;
      }
    }

    if (!didPlace) notPlaced.push(word);
  }

  // Fill empty cells with random letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const finalGrid = grid.map((row) =>
    row.map((cell) => cell ?? alphabet[Math.floor(Math.random() * alphabet.length)])
  );

  return { grid: finalGrid, size, placed, notPlaced };
}

function canPlaceWord(grid: (string | null)[][], word: string, row: number, col: number, [dr, dc]: Direction, size: number): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const existing = grid[r][c];
    if (existing !== null && existing !== word[i]) return false;
  }
  return true;
}

function placeWord(grid: (string | null)[][], word: string, row: number, col: number, [dr, dc]: Direction) {
  for (let i = 0; i < word.length; i++) {
    grid[row + dr * i][col + dc * i] = word[i];
  }
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Vocabulary source configs (shared with CrosswordGenerator) ---

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
  { key: 'svt', icon: '🧬', label: 'SVT Collège', desc: `${SVT_VOCABULARY.length} termes`, themes: SVT_THEMES, vocabulary: SVT_VOCABULARY },
  { key: 'francais', icon: '📖', label: 'Français Collège', desc: `${FRENCH_VOCABULARY.length} termes`, themes: FRENCH_THEMES, vocabulary: FRENCH_VOCABULARY },
  { key: 'anglais', icon: '🇬🇧', label: 'Anglais Collège', desc: `${ENGLISH_VOCABULARY.length} termes`, themes: ENGLISH_THEMES, vocabulary: ENGLISH_VOCABULARY },
  { key: 'histoire', icon: '🏛️', label: 'Histoire-Géo', desc: `${HISTORY_GEO_VOCABULARY.length} termes`, themes: HISTORY_GEO_THEMES, vocabulary: HISTORY_GEO_VOCABULARY },
  { key: 'maths', icon: '📐', label: 'Maths Collège', desc: `${MATH_VOCABULARY.length} termes`, themes: MATH_THEMES, vocabulary: MATH_VOCABULARY },
  { key: 'allemand', icon: '🇩🇪', label: 'Allemand Collège', desc: `${GERMAN_VOCABULARY.length} termes`, themes: GERMAN_THEMES, vocabulary: GERMAN_VOCABULARY },
];

// --- Result display ---

function WordSearchResult({
  result,
  words,
  showSolution,
  setShowSolution,
  onRegenerate,
  showDefinitions,
}: {
  result: WordSearchResult;
  words: { word: string; definition?: string }[];
  showSolution: boolean;
  setShowSolution: (v: boolean) => void;
  onRegenerate: () => void;
  showDefinitions: boolean;
}) {
  const cellSize = 32;

  // Build set of solution cells for highlighting
  const solutionCells = useMemo(() => {
    const set = new Set<string>();
    if (!showSolution) return set;
    for (const p of result.placed) {
      for (let i = 0; i < p.word.length; i++) {
        set.add(`${p.row + p.dir[0] * i},${p.col + p.dir[1] * i}`);
      }
    }
    return set;
  }, [result, showSolution]);

  function printWordSearch() {
    const w = window.open('', '_blank');
    if (!w) return;

    let gridHtml = '<table class="grid"><tbody>';
    for (let ri = 0; ri < result.size; ri++) {
      gridHtml += '<tr>';
      for (let ci = 0; ci < result.size; ci++) {
        gridHtml += `<td>${result.grid[ri][ci]}</td>`;
      }
      gridHtml += '</tr>';
    }
    gridHtml += '</tbody></table>';

    const wordListHtml = showDefinitions
      ? words.filter((e) => result.placed.some((p) => p.word === e.word)).map((e) =>
          `<li><strong>${e.word}</strong>${e.definition ? ` — ${e.definition}` : ''}</li>`
        ).join('')
      : words.filter((e) => result.placed.some((p) => p.word === e.word)).map((e) =>
          `<li>${e.word}</li>`
        ).join('');

    w.document.write(`<!DOCTYPE html><html><head><title>Mots mêlés</title><style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
      .grid-wrapper { page-break-inside: avoid; break-inside: avoid; display: inline-block; margin-bottom: 20px; }
      .grid { border-collapse: separate; border-spacing: 0; }
      .grid td {
        width: 28px; height: 28px;
        text-align: center; vertical-align: middle;
        font-weight: bold; font-size: 15px;
        font-family: 'Courier New', monospace;
        letter-spacing: 0;
        padding: 0;
      }
      h3 { font-size: 14px; margin: 16px 0 8px; color: #1e293b; border-bottom: 2px solid #4A90D9; padding-bottom: 5px; }
      .words { column-count: 3; column-gap: 20px; }
      .words li { font-size: 12px; margin-bottom: 3px; break-inside: avoid; }
      .words li strong { color: #1e293b; }
      @media print {
        body { margin: 12px; }
        .grid-wrapper { page-break-inside: avoid; break-inside: avoid; }
      }
    </style></head><body>
      <div class="grid-wrapper">${gridHtml}</div>
      <h3>Mots à trouver (${result.placed.length})</h3>
      <ul class="words">${wordListHtml}</ul>
    </body></html>`);
    w.document.close();
    w.print();
  }

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
          <span className="font-semibold text-[var(--color-text)]">{result.size}&times;{result.size}</span> grille
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
            onClick={printWordSearch}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: 'var(--gradient-header)', boxShadow: 'var(--shadow-xs)' }}
          >
            Imprimer
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        className="rounded-2xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)] inline-block"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <tbody>
            {result.grid.map((row, ri) => (
              <tr key={ri}>
                {row.map((letter, ci) => {
                  const isHighlighted = solutionCells.has(`${ri},${ci}`);
                  return (
                    <td
                      key={ci}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        fontFamily: "'Courier New', monospace",
                        color: isHighlighted ? '#fff' : 'var(--color-text)',
                        backgroundColor: isHighlighted ? 'var(--color-primary)' : 'transparent',
                        borderRadius: isHighlighted ? 4 : 0,
                        transition: 'all 0.2s',
                      }}
                    >
                      {letter}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Word list */}
      <div
        className="rounded-2xl p-5 bg-[var(--color-surface)] border border-[var(--color-border)]"
        style={{ boxShadow: 'var(--shadow-xs)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
          Mots à trouver
          <span className="ml-2 text-[var(--color-primary)]">({result.placed.length})</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {words
            .filter((e) => result.placed.some((p) => p.word === e.word))
            .map((e) => (
              <div
                key={e.word}
                className="text-sm py-1.5 px-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)]"
              >
                <span className="font-bold text-[var(--color-text)]">{e.word}</span>
                {showDefinitions && e.definition && (
                  <span className="block text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
                    {e.definition}
                  </span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// --- Main component ---

type Mode = 'libre' | 'svt' | 'francais' | 'anglais' | 'histoire' | 'maths' | 'allemand';

export default function WordSearchGenerator() {
  const [mode, setMode] = useState<Mode>('libre');

  // Libre mode state
  const [wordList, setWordList] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [libreView, setLibreView] = useState<'form' | 'text'>('form');
  const [textInput, setTextInput] = useState('');

  // Vocabulary mode state
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [wordCount, setWordCount] = useState(10);
  const [showDefinitions, setShowDefinitions] = useState(true);

  // Shared state
  const [showSolution, setShowSolution] = useState(false);
  const [result, setResult] = useState<WordSearchResult | null>(null);
  const [usedWords, setUsedWords] = useState<{ word: string; definition?: string }[]>([]);

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
    setWordList((prev) => [...prev, w]);
    setNewWord('');
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
        const imported: string[] = [];
        for (const row of rows) {
          if (!row[0]) continue;
          const w = String(row[0]).trim().toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, '');
          if (w.length >= 2) imported.push(w);
        }
        setWordList((prev) => [...prev, ...imported]);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function syncTextToList() {
    const lines = textInput.split('\n').map((l) => l.trim()).filter(Boolean);
    const entries = lines
      .map((l) => l.toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, ''))
      .filter((w) => w.length >= 2);
    setWordList(entries);
    setLibreView('form');
  }

  function syncListToText() {
    setTextInput(wordList.join('\n'));
    setLibreView('text');
  }

  const generateLibre = useCallback(() => {
    if (wordList.length === 0) return;
    const res = generateWordSearch(wordList);
    setUsedWords(wordList.map((w) => ({ word: w })));
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
    const words = selected.map((t) => t.word);
    const res = generateWordSearch(words);
    setUsedWords(selected.map((t) => ({ word: t.word, definition: t.definition })));
    setResult(res);
    setShowSolution(false);
  }, [vocabSource, selectedThemes, wordCount]);

  const generate = mode === 'libre' ? generateLibre : generateVocab;

  function switchMode(m: Mode) {
    setMode(m);
    setResult(null);
    setShowSolution(false);
    setSelectedThemes(new Set());
    setUsedWords([]);
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
            { key: 'libre' as const, icon: '✍️', label: 'Saisie libre', desc: 'Vos propres mots' },
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
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Mots
              </h2>
              {wordList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                  {wordList.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => libreView === 'form' ? syncListToText() : syncTextToList()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-all"
              >
                {libreView === 'form' ? 'Mode texte' : 'Mode formulaire'}
              </button>
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
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
                    placeholder="Mot"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    autoFocus
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

                {wordList.length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                    <div className="text-3xl mb-2">&#128300;</div>
                    <p className="text-sm">Ajoutez des mots pour commencer</p>
                    <p className="text-xs mt-1">ou importez un fichier Excel</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-1">
                    {wordList.map((word, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] group hover:border-[var(--color-primary)] transition-all"
                      >
                        <span className="text-sm font-bold text-[var(--color-text)] uppercase">{word}</span>
                        <button
                          onClick={() => removeWord(idx)}
                          className="w-5 h-5 rounded flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-all opacity-0 group-hover:opacity-100 text-xs"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
                      Générer les mots mêlés
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={"CHAT\nCHIEN\nOISEAU\nPOISSON"}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                  autoFocus
                />
                <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Un mot par ligne</p>
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

      {/* Vocabulary mode */}
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

          {/* Options + Word count + generate */}
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

            {/* Show definitions toggle */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--color-text-secondary)] cursor-pointer select-none flex items-center gap-2">
                <button
                  onClick={() => setShowDefinitions(!showDefinitions)}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                    showDefinitions ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: showDefinitions ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                </button>
                Définitions
              </label>
            </div>

            <button
              onClick={generate}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              Générer les mots mêlés
            </button>
          </div>
        </>
      )}

      {/* Not placed warning */}
      {result && result.notPlaced.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--color-remarque-soft)] border border-[var(--color-remarque)]">
          <span className="text-lg">&#9888;</span>
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">
              {result.notPlaced.length} mot{result.notPlaced.length > 1 ? 's' : ''} non placé{result.notPlaced.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {result.notPlaced.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && result.placed.length > 0 && (
        <WordSearchResult
          result={result}
          words={usedWords}
          showSolution={showSolution}
          setShowSolution={setShowSolution}
          onRegenerate={generate}
          showDefinitions={showDefinitions}
        />
      )}
    </div>
  );
}
