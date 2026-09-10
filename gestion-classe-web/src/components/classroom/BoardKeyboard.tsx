/**
 * Clavier virtuel à gros boutons pour le TBI : tape dans le champ ou la zone de texte qui a le
 * focus (les touches ne prennent jamais le focus, pour ne pas perdre le curseur).
 */
import { useState } from 'react';

interface Props {
  onClose: () => void;
}

const ROWS = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n', "'", ',', '.', '?'],
];
const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ô', 'ë', 'ï', '-', '!'];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Insère du texte dans l'élément actif (champ ou contenteditable). */
function typeInto(text: string) {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (el.isContentEditable) document.execCommand('insertText', false, text);
}

function special(key: 'backspace' | 'enter') {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (key === 'backspace') {
      const start = el.selectionStart ?? 0, end = el.selectionEnd ?? start;
      if (start === end && start > 0) el.setRangeText('', start - 1, end, 'end'); else el.setRangeText('', start, end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    return;
  }
  if (el.isContentEditable) document.execCommand(key === 'backspace' ? 'delete' : 'insertParagraph');
}

export function BoardKeyboard({ onClose }: Props) {
  const [shift, setShift] = useState(false);
  const hold = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); };
  const press = (k: string) => { typeInto(shift ? k.toUpperCase() : k); if (shift) setShift(false); };

  return (
    <div className="wbk" onPointerDown={hold} onContextMenu={(e) => e.preventDefault()}>
      <div className="wbk__row">{DIGITS.map((k) => <button key={k} type="button" onPointerDown={hold} onClick={() => press(k)}>{k}</button>)}<button type="button" className="wbk__wide" onPointerDown={hold} onClick={() => special('backspace')}>⌫</button></div>
      <div className="wbk__row">{ACCENTS.map((k) => <button key={k} type="button" onPointerDown={hold} onClick={() => press(k)}>{shift ? k.toUpperCase() : k}</button>)}</div>
      {ROWS.map((row, i) => (
        <div key={i} className="wbk__row">
          {i === 2 && <button type="button" className={`wbk__wide ${shift ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => setShift((v) => !v)}>⇧</button>}
          {row.map((k) => <button key={k} type="button" onPointerDown={hold} onClick={() => press(k)}>{shift ? k.toUpperCase() : k}</button>)}
          {i === 2 && <button type="button" className="wbk__wide" onPointerDown={hold} onClick={() => special('enter')}>↵</button>}
        </div>
      ))}
      <div className="wbk__row">
        <button type="button" className="wbk__space" onPointerDown={hold} onClick={() => press(' ')}>espace</button>
        <button type="button" className="wbk__wide" onPointerDown={hold} onClick={onClose}>Fermer</button>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbk { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 22; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 16px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45); user-select: none; touch-action: none; }
.wbk__row { display: flex; justify-content: center; gap: 6px; }
.wbk button { min-width: 52px; height: 52px; padding: 0 10px; border: 0; border-radius: 10px; background: #1F2937; color: #F9FAFB; font: 600 20px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbk button:hover { background: #374151; }
.wbk button.is-on { background: #4F46E5; }
.wbk__wide { min-width: 84px !important; }
.wbk__space { flex: 1; max-width: 420px; font-size: 15px !important; }
`;
