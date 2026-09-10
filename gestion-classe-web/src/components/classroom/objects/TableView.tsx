/**
 * Tableau : grille de cellules éditables (même mécanique que les zones de texte).
 * Le calque enregistre la cellule qui a le focus comme éditeur courant, ce qui fait marcher
 * la barre de mise en forme et les raccourcis Word dans la cellule.
 */
import { useEffect, useRef } from 'react';
import { INDENT_EM, LINE_HEIGHT, fontCss } from '../../../lib/boardText';
import { TABLE_CELL_PAD, tableColWidths, type TableObject } from '../../../lib/boardMedia';

interface Props {
  o: TableObject;
  scale: number;
  editing: boolean;
  onCellFocus: (el: HTMLElement, r: number, c: number) => void;
  onCellInput: (el: HTMLElement) => void;
  onCellBlur: (el: HTMLElement) => void;
  onCellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export function TableView({ o, scale, editing, onCellFocus, onCellInput, onCellBlur, onCellKeyDown }: Props) {
  const cellsRef = useRef<Map<string, HTMLElement>>(new Map());
  const widths = tableColWidths(o);

  // Contenu des cellules : écrit dans le DOM sauf pendant la frappe
  useEffect(() => {
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const el = cellsRef.current.get(`${r}-${c}`);
        if (!el || document.activeElement === el) continue;
        const html = o.cells[r]?.[c] ?? '<div><br></div>';
        if (el.innerHTML !== html) el.innerHTML = html;
      }
    }
  }, [o.cells, o.rows, o.cols]);

  // Tab / Maj+Tab : cellule suivante / précédente
  const moveFocus = (r: number, c: number, delta: number) => {
    let idx = r * o.cols + c + delta;
    idx = Math.max(0, Math.min(o.rows * o.cols - 1, idx));
    const el = cellsRef.current.get(`${Math.floor(idx / o.cols)}-${idx % o.cols}`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  return (
    <table
      className={`wbt ${o.header ? 'has-header' : ''} ${editing ? 'is-editing' : ''}`}
      style={{
        width: o.w * scale,
        fontFamily: fontCss(o.font),
        fontSize: o.size * scale,
        lineHeight: LINE_HEIGHT,
        color: o.color,
        ['--wbo-indent' as string]: `${INDENT_EM}em`,
        ['--wbt-pad' as string]: `${TABLE_CELL_PAD}em`,
      }}
    >
      <colgroup>
        {widths.map((w, c) => <col key={c} style={{ width: `${w * 100}%` }} />)}
      </colgroup>
      <tbody>
        {Array.from({ length: o.rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: o.cols }, (_, c) => (
              <td key={c}>
                <div
                  className="wbt__cell wbo__editor"
                  data-r={r}
                  data-c={c}
                  ref={(el) => { if (el) cellsRef.current.set(`${r}-${c}`, el); else cellsRef.current.delete(`${r}-${c}`); }}
                  contentEditable={editing}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onFocus={(e) => onCellFocus(e.currentTarget, r, c)}
                  onInput={(e) => onCellInput(e.currentTarget)}
                  onBlur={(e) => onCellBlur(e.currentTarget)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      moveFocus(r, c, e.shiftKey ? -1 : 1);
                      return;
                    }
                    onCellKeyDown(e);
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <style>{CSS}</style>
    </table>
  );
}

const CSS = `
.wbt { border-collapse: collapse; table-layout: fixed; background: #FFFFFF; }
.wbt td { border: 1.5px solid #374151; padding: 0; vertical-align: top; }
.wbt.has-header tr:first-child td { background: #E5E7EB; font-weight: 600; }
.wbt__cell { min-height: 1.34em; padding: var(--wbt-pad); outline: none; white-space: pre-wrap; overflow-wrap: break-word; }
.wbt.is-editing .wbt__cell { cursor: text; }
.wbt.is-editing .wbt__cell:focus { box-shadow: inset 0 0 0 2px #6366F1; }
`;
