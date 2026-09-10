/**
 * Équation LaTeX rendue par KaTeX. En édition : champ de saisie et aperçu ; à la validation,
 * le rendu est rasterisé (html2canvas) pour les vignettes et l'export PDF.
 */
import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import html2canvas from 'html2canvas';
import 'katex/dist/katex.min.css';
import type { EquationObject } from '../../../lib/boardMedia';

interface Props {
  o: EquationObject;
  scale: number;
  editing: boolean;
  /** Validation : LaTeX, image rasterisée (ou null si échec), rapport largeur/hauteur du rendu. */
  onCommit: (latex: string, raster: Blob | null, ratio: number) => void;
  onCancel: () => void;
}

const EXAMPLES = ['\\frac{a}{b}', 'x^{2}', '\\sqrt{x}', '\\sum_{i=1}^{n}', '\\int_a^b', '\\vec{v}', '\\ce{CO2}', '\\times', '\\rightarrow', '\\Delta'];

function renderKatex(el: HTMLElement | null, latex: string, color: string) {
  if (!el) return;
  try {
    katex.render(latex || '\\;', el, { throwOnError: false, displayMode: true, output: 'html' });
    el.style.color = color;
  } catch {
    el.textContent = latex;
  }
}

export function EquationView({ o, scale, editing, onCommit, onCancel }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(o.latex);
  const [busy, setBusy] = useState(false);

  useEffect(() => { renderKatex(viewRef.current, o.latex, o.color); }, [o.latex, o.color]);
  useEffect(() => { if (editing) { setDraft(o.latex); } }, [editing, o.latex]);
  useEffect(() => { if (editing) renderKatex(previewRef.current, draft, o.color); }, [draft, editing, o.color]);

  const commit = async () => {
    const latex = draft.trim();
    if (!latex) { onCancel(); return; }
    setBusy(true);
    try {
      const node = previewRef.current;
      let raster: Blob | null = null;
      let ratio = 3;
      if (node) {
        const canvas = await html2canvas(node, { backgroundColor: null, scale: 3 });
        ratio = canvas.width / Math.max(1, canvas.height);
        raster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      }
      onCommit(latex, raster, ratio);
    } catch {
      onCommit(latex, null, 3);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="wbq wbq--edit" onPointerDown={(e) => e.stopPropagation()} style={{ fontSize: Math.max(12, 14 * scale) }}>
        <div ref={previewRef} className="wbq__preview" style={{ fontSize: o.size * scale }} />
        <input
          className="wbq__input"
          value={draft}
          autoFocus
          spellCheck={false}
          placeholder="LaTeX : \\frac{a}{b}, x^{2}, \\sqrt{x}…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); void commit(); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
        />
        <div className="wbq__examples">
          {EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => setDraft((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}${ex}`)}>{ex}</button>)}
        </div>
        <div className="wbq__row">
          <button type="button" onClick={onCancel}>Annuler</button>
          <button type="button" className="is-primary" disabled={busy} onClick={() => void commit()}>{busy ? '…' : 'Valider (Entrée)'}</button>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div className="wbq" style={{ width: o.w * scale, height: o.h * scale, fontSize: o.size * scale }}>
      <div ref={viewRef} className="wbq__view" />
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbq { display: flex; align-items: center; justify-content: center; overflow: hidden; user-select: none; }
.wbq__view .katex-display { margin: 0; }
.wbq--edit { position: absolute; left: 0; top: 0; z-index: 3; min-width: 360px; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; border-radius: 12px; background: #111827; color: #F9FAFB; box-shadow: 0 16px 48px rgba(0,0,0,0.45); font-family: Inter, system-ui, sans-serif; }
.wbq__preview { min-height: 2.2em; padding: 8px; border-radius: 8px; background: #FFFFFF; color: #111827; display: flex; align-items: center; justify-content: center; }
.wbq__preview .katex-display { margin: 0; }
.wbq__input { height: 40px; padding: 0 10px; border-radius: 8px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB; font: 500 15px/1 "IBM Plex Mono", ui-monospace, monospace; }
.wbq__examples { display: flex; flex-wrap: wrap; gap: 4px; }
.wbq__examples button { padding: 4px 8px; border: 0; border-radius: 6px; background: #374151; color: #E5E7EB; font: 500 12px/1 "IBM Plex Mono", ui-monospace, monospace; cursor: pointer; }
.wbq__row { display: flex; justify-content: flex-end; gap: 8px; }
.wbq__row button { height: 36px; padding: 0 14px; border: 0; border-radius: 8px; background: #374151; color: #F9FAFB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbq__row button.is-primary { background: #4F46E5; }
`;
