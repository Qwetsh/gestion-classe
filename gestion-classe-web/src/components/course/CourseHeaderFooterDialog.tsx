/**
 * Réglages de l'en-tête et du pied de page (lot T9a) : trois cases chacun, des champs à insérer
 * au curseur, « rien sur la première page ». Chaque modification s'applique tout de suite au
 * cours (on voit le résultat sur les feuilles derrière la fenêtre).
 */
import { useEffect, useRef } from 'react';
import type { CourseSettings, HeaderFooterLine } from '../../lib/course/courseDoc';
import { HEADER_FIELDS, footerOf } from './courseHeaderFooter';

interface Props {
  settings: CourseSettings;
  onSettings: (patch: Partial<CourseSettings>) => void;
  onClose: () => void;
}

type Slot = { line: 'header' | 'footer'; pos: keyof HeaderFooterLine };

const NAME_LINE = 'Nom : ……………………  Prénom : ……………………';

export function CourseHeaderFooterDialog({ settings, onSettings, onClose }: Props) {
  const header = settings.header ?? {};
  const footer = footerOf(settings);
  /** Dernière case touchée (et position du curseur) : les champs s'y insèrent. */
  const lastSlot = useRef<{ slot: Slot; el: HTMLInputElement } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const set = (slot: Slot, value: string) => {
    const base = slot.line === 'header' ? header : footer;
    onSettings({ [slot.line]: { ...base, [slot.pos]: value } });
  };

  const insert = (token: string) => {
    const last = lastSlot.current;
    if (!last) return;
    const { el, slot } = last;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const value = el.value.slice(0, start) + token + el.value.slice(end);
    set(slot, value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const field = (line: 'header' | 'footer', pos: keyof HeaderFooterLine, label: string) => {
    const values = line === 'header' ? header : footer;
    return (
      <label className="ce-field ce-hfd__cell">
        <span>{label}</span>
        <input
          value={values[pos] ?? ''}
          onChange={(e) => set({ line, pos }, e.target.value)}
          onFocus={(e) => { lastSlot.current = { slot: { line, pos }, el: e.currentTarget }; }}
          onSelect={(e) => { lastSlot.current = { slot: { line, pos }, el: e.currentTarget }; }}
          spellCheck
          lang="fr"
        />
      </label>
    );
  };

  return (
    <div className="ce-modal" onMouseDown={onClose}>
      <div className="ce-dialog ce-hfd" role="dialog" aria-label="En-tête et pied de page" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="ce-dialog__title">En-tête et pied de page</h3>

        <div className="ce-hfd__fields" role="group" aria-label="Champs à insérer">
          <span className="ce-minilabel">Insérer dans la case choisie :</span>
          {HEADER_FIELDS.map((f) => (
            <button key={f.token} type="button" className="ce-chipbtn" title={f.title} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(f.token)}>
              {f.label}
            </button>
          ))}
          <button type="button" className="ce-chipbtn" title="« Nom : …  Prénom : … » pour une fiche élève" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(NAME_LINE)}>
            Nom, prénom
          </button>
        </div>

        <fieldset className="ce-hfd__line">
          <legend>En-tête (haut de chaque page)</legend>
          {field('header', 'left', 'À gauche')}
          {field('header', 'center', 'Au centre')}
          {field('header', 'right', 'À droite')}
        </fieldset>
        <fieldset className="ce-hfd__line">
          <legend>Pied de page (bas de chaque page)</legend>
          {field('footer', 'left', 'À gauche')}
          {field('footer', 'center', 'Au centre')}
          {field('footer', 'right', 'À droite')}
        </fieldset>

        <label className="ce-check">
          <input type="checkbox" checked={!!settings.firstPageBlank} onChange={(e) => onSettings({ firstPageBlank: e.target.checked })} />
          Rien sur la première page (page de titre, fiche avec cartouche)
        </label>
        <p className="ce-dialog__hint">Les champs entre accolades se remplacent tout seuls : <code>{'{page}'}</code> devient le numéro de la page, <code>{'{pages}'}</code> le nombre de pages.</p>

        <div className="ce-dialog__foot">
          <button type="button" className="ce-btn" onClick={() => onSettings({ header: {}, footer: { center: '{page}' }, firstPageBlank: false })}>Revenir au numéro seul</button>
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn ce-btn--primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
