/**
 * Fenêtre « Imprimer » du cours (lot T13) : version normale ou adaptée, un ou deux exemplaires
 * par feuille, couleur / noir et blanc / économie d'encre. Les choix sont gardés sur
 * l'ordinateur. Ctrl+P imprime directement la version normale.
 */
import { useEffect, useState } from 'react';
import { loadPrintOptions, savePrintOptions, type PrintColor, type PrintOptions, type PrintVersion } from './coursePrint';

interface Props {
  /** Exporter en PDF : même fenêtre, avec le rappel « Enregistrer au format PDF ». */
  pdf?: boolean;
  onPrint: (options: PrintOptions) => void;
  onClose: () => void;
}

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { id: T; label: string; hint: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="ce-printd__choices" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={`ce-printd__choice ${value === o.id ? 'is-on' : ''}`} onClick={() => onChange(o.id)}>
          <strong>{o.label}</strong>
          <span>{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function CoursePrintDialog({ pdf, onPrint, onClose }: Props) {
  const [o, setO] = useState<PrintOptions>(loadPrintOptions);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const go = () => { savePrintOptions(o); onPrint(o); };

  return (
    <div className="ce-modal" onMouseDown={onClose}>
      <div className="ce-dialog ce-printd" role="dialog" aria-label={pdf ? 'Exporter en PDF' : 'Imprimer'} onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="ce-dialog__title">{pdf ? 'Exporter en PDF' : 'Imprimer le cours'}</h3>

        <div className="ce-printd__row">
          <span className="ce-minilabel">Version</span>
          <Choice<PrintVersion>
            name="Version"
            value={o.version}
            onChange={(version) => setO({ ...o, version })}
            options={[
              { id: 'normal', label: 'Normale', hint: 'Le cours tel qu’à l’écran' },
              { id: 'adapted', label: 'Adaptée (dys)', hint: 'Texte plus grand, plus espacé, sans justification ni coupure' },
            ]}
          />
        </div>

        <div className="ce-printd__row">
          <span className="ce-minilabel">Par feuille</span>
          <Choice<'1' | '2'>
            name="Exemplaires par feuille"
            value={o.twoUp ? '2' : '1'}
            onChange={(v) => setO({ ...o, twoUp: v === '2' })}
            options={[
              { id: '1', label: 'Une page A4', hint: 'Comme d’habitude' },
              { id: '2', label: 'Deux demi-feuilles', hint: 'Chaque page deux fois en A5, à couper et coller dans le cahier' },
            ]}
          />
        </div>

        <div className="ce-printd__row">
          <span className="ce-minilabel">Couleurs</span>
          <Choice<PrintColor>
            name="Couleurs"
            value={o.color}
            onChange={(color) => setO({ ...o, color })}
            options={[
              { id: 'color', label: 'Couleur', hint: 'Encadrés et titres en couleur' },
              { id: 'bw', label: 'Noir et blanc', hint: 'Texte noir, fonds gris clair : propre à la photocopieuse' },
              { id: 'eco', label: 'Économie d’encre', hint: 'Sans fonds colorés, images éclaircies' },
            ]}
          />
        </div>

        <p className="ce-dialog__hint">
          {o.version === 'adapted' && 'La version adaptée prend plus de pages : la mise en page est recalculée pour l’impression. '}
          {pdf ? 'Dans la fenêtre qui s’ouvre, choisissez « Enregistrer au format PDF ».' : 'Ctrl+P imprime directement la version normale.'}
        </p>

        <div className="ce-dialog__foot">
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="ce-btn ce-btn--primary" onClick={go}>{pdf ? 'Exporter' : 'Imprimer'}</button>
        </div>
      </div>
    </div>
  );
}
