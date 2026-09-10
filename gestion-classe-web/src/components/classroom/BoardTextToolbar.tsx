/**
 * Barre de mise en forme des zones de texte (police, taille, gras…, listes, retraits).
 * Les commandes passent par l'API exposée par le calque d'objets (`BoardTextApi`).
 */
import { BOARD_FONTS, TEXT_SIZES, type TextBox } from '../../lib/boardText';
import type { BoardTextApi, FormatState } from './BoardObjectLayer';

/**
 * Raccourcis clavier, alignés sur Word (version française, avec les équivalents
 * anglais quand ils ne se contredisent pas). Utilisés dans les infobulles.
 */
export const TEXT_KEYS = {
  bold: 'Ctrl+G ou Ctrl+B',
  italic: 'Ctrl+I',
  underline: 'Ctrl+U',
  strike: 'Ctrl+Maj+5',
  superscript: 'Ctrl+Maj+=',
  subscript: 'Ctrl+=',
  alignLeft: 'Ctrl+Maj+G ou Ctrl+L',
  alignCenter: 'Ctrl+E',
  alignRight: 'Ctrl+Maj+D ou Ctrl+R',
  justify: 'Ctrl+J',
  bullets: 'Ctrl+Maj+L',
  numbered: 'Ctrl+Maj+7',
  indentMore: 'Tab ou Ctrl+M',
  indentLess: 'Maj+Tab ou Ctrl+Maj+M',
  clearFormat: 'Ctrl+Espace ou Ctrl+Maj+N',
  sizeUp: 'Ctrl+Maj+>',
  sizeDown: 'Ctrl+Maj+<',
  font: 'Ctrl+Maj+F',
  size: 'Ctrl+Maj+P',
  toggleCase: 'Maj+F3',
  newPage: 'Ctrl+Entrée',
  exit: 'Échap',
} as const;

interface ToolbarProps {
  api: React.RefObject<BoardTextApi | null>;
  format: FormatState;
  /** Zone sélectionnée, ou null : la barre agit alors sur les réglages par défaut. */
  box: TextBox | null;
  editing: boolean;
  /** Police et taille affichées (zone sélectionnée, sinon réglages par défaut). */
  fontId: string;
  size: number;
  onFontChange: (fontId: string) => void;
  onSizeChange: (size: number) => void;
  onColor: (color: string) => void;
  colors: string[];
  highlights: string[];
  color: string;
  onDelete: () => void;
  /** Texte à trous : nombre de trous dans la zone, et actions. */
  gapCount: number;
  onGap: () => void;
  onRevealGaps: () => void;
  onRemoveGaps: () => void;
}

export function BoardTextToolbar({
  api, format, box, editing, fontId, size, onFontChange, onSizeChange, onColor, colors, highlights, color, onDelete,
  gapCount, onGap, onRevealGaps, onRemoveGaps,
}: ToolbarProps) {
  // `onPointerDown` neutralisé : la sélection dans la zone de texte ne doit pas être perdue
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const call = (fn: (a: BoardTextApi) => void) => () => { const a = api.current; if (a) fn(a); };
  const disabled = !editing;

  return (
    <>
      <div className="wb__group">
        <select
          className="wb__select wb__select--font"
          value={fontId}
          onChange={(e) => onFontChange(e.target.value)}
          title={`Police (${TEXT_KEYS.font})`}
        >
          {BOARD_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select
          className="wb__select wb__select--size"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          title={`Taille (${TEXT_KEYS.size} ; ${TEXT_KEYS.sizeUp} / ${TEXT_KEYS.sizeDown} ; sans sélection : toute la zone)`}
        >
          {TEXT_SIZES.map((v) => <option key={v} value={v}>{v}</option>)}
          {!TEXT_SIZES.includes(size) && <option value={size}>{size}</option>}
        </select>
      </div>

      <div className="wb__group">
        <button className={`wb__btn wb__txt ${format.bold ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('bold'))} title={`Gras (${TEXT_KEYS.bold})`}><b>G</b></button>
        <button className={`wb__btn wb__txt ${format.italic ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('italic'))} title={`Italique (${TEXT_KEYS.italic})`}><i>I</i></button>
        <button className={`wb__btn wb__txt ${format.underline ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('underline'))} title={`Souligné (${TEXT_KEYS.underline})`}><u>S</u></button>
        <button className={`wb__btn wb__txt ${format.strike ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('strikeThrough'))} title={`Barré (${TEXT_KEYS.strike})`}><s>B</s></button>
        <button className={`wb__btn wb__txt ${format.sup ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('superscript'))} title={`Exposant (${TEXT_KEYS.superscript})`}>x²</button>
        <button className={`wb__btn wb__txt ${format.sub ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('subscript'))} title={`Indice (${TEXT_KEYS.subscript})`}>x₂</button>
      </div>

      <div className="wb__group">
        {colors.map((c) => (
          <button
            key={c}
            className={`wb__swatch ${!box && color === c ? 'is-on' : ''}`}
            style={{ background: c }}
            onPointerDown={hold}
            onClick={() => onColor(c)}
            title="Couleur du texte (sans sélection : toute la zone)"
          />
        ))}
        {highlights.map((c) => (
          <button
            key={c}
            className="wb__swatch wb__swatch--hl"
            style={{ background: c }}
            disabled={disabled}
            onPointerDown={hold}
            onClick={() => api.current?.applyHighlight(c)}
            title="Surligner la sélection"
          />
        ))}
        <button className="wb__btn wb__txt" disabled={disabled} onPointerDown={hold} onClick={call((a) => a.applyHighlight(null))} title="Retirer le surlignage">⌫</button>
      </div>

      <div className="wb__group">
        <button className={`wb__btn ${format.align === 'left' ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('justifyLeft'))} title={`Aligner à gauche (${TEXT_KEYS.alignLeft})`}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></svg>
        </button>
        <button className={`wb__btn ${format.align === 'center' ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('justifyCenter'))} title={`Centrer (${TEXT_KEYS.alignCenter})`}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></svg>
        </button>
        <button className={`wb__btn ${format.align === 'right' ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('justifyRight'))} title={`Aligner à droite (${TEXT_KEYS.alignRight})`}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></svg>
        </button>
        <button className={`wb__btn ${format.align === 'justify' ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('justifyFull'))} title={`Justifier (${TEXT_KEYS.justify})`}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </button>
      </div>

      <div className="wb__group">
        <button className={`wb__btn ${format.ul ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('insertUnorderedList'))} title={`Liste à puces (${TEXT_KEYS.bullets})`}>
          <svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
        </button>
        <button className={`wb__btn ${format.ol ? 'is-on' : ''}`} disabled={disabled} onPointerDown={hold} onClick={call((a) => a.exec('insertOrderedList'))} title={`Liste numérotée (${TEXT_KEYS.numbered})`}>
          <svg viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 15h2v1H4v2h2" /></svg>
        </button>
        <button className="wb__btn" disabled={disabled} onPointerDown={hold} onClick={call((a) => a.changeIndent(-1))} title={`Diminuer le retrait (${TEXT_KEYS.indentLess})`}>
          <svg viewBox="0 0 24 24"><path d="M20 6H9M20 12h-8M20 18H9M7 9l-3 3 3 3" /></svg>
        </button>
        <button className="wb__btn" disabled={disabled} onPointerDown={hold} onClick={call((a) => a.changeIndent(1))} title={`Augmenter le retrait (${TEXT_KEYS.indentMore})`}>
          <svg viewBox="0 0 24 24"><path d="M20 6H9M20 12h-8M20 18H9M4 9l3 3-3 3" /></svg>
        </button>
        <button className="wb__btn wb__txt" disabled={disabled} onPointerDown={hold} onClick={call((a) => a.clearFormatting())} title={`Effacer la mise en forme (${TEXT_KEYS.clearFormat})`}>T̸</button>
        <button className="wb__btn wb__txt" disabled={disabled} onPointerDown={hold} onClick={call((a) => a.toggleCase())} title={`Changer la casse (${TEXT_KEYS.toggleCase})`}>Aa</button>
      </div>

      <div className="wb__group">
        <button className="wb__btn wb__txt" disabled={disabled} onPointerDown={hold} onClick={onGap} title="Texte à trous : masquer le mot sélectionné (ou sous le curseur)">▭</button>
        <button className="wb__btn wb__txt" disabled={!box || gapCount === 0} onPointerDown={hold} onClick={onRevealGaps} title="Révéler tous les trous de la zone">👁</button>
        <button className="wb__btn wb__txt" disabled={!box || gapCount === 0} onPointerDown={hold} onClick={onRemoveGaps} title="Retirer les trous (le texte redevient ordinaire)">⌧</button>
      </div>

      <div className="wb__group">
        <button className="wb__btn" disabled={!box} onPointerDown={hold} onClick={onDelete} title="Supprimer la zone de texte (Suppr)">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>
    </>
  );
}
