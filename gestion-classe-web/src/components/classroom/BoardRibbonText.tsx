/**
 * Onglet contextuel « Texte » du ruban du tableau blanc.
 *
 * Avec le ruban, la mise en forme d'une zone de texte ne flotte plus au-dessus d'elle : elle se
 * range dans le ruban, comme les onglets Tableau ou Image de l'éditeur de cours. Mêmes commandes
 * que la barre flottante de l'habillage tactile (`BoardTextToolbar`), mêmes propriétés.
 */
import type { ReactNode } from 'react';
import { BOARD_FONTS, TEXT_SIZES } from '../../lib/boardText';
import { SWATCHES, SWATCH_HINT, customizeSwatch, useSwatches } from '../../lib/boardSwatches';
import { Icon, type IconName } from '../course/courseIcons';
import { TEXT_KEYS, type TextToolbarProps } from './BoardTextToolbar';
import type { BoardTextApi } from './BoardObjectLayer';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ce-group">
      <div className="ce-group__body">{children}</div>
      <div className="ce-group__label">{label}</div>
    </div>
  );
}

function Sm({ icon, label, title, onClick, on, disabled, children }: { icon?: IconName; label?: string; title: string; onClick: () => void; on?: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="button" className={`ce-sm ${on ? 'is-on' : ''}`} title={title} aria-label={title} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

export function BoardRibbonText({
  api, format, box, editing, fontId, size, onFontChange, onSizeChange, onColor, color, onDelete, onInteractions,
  spell, spellStatus, onToggleSpell, gapCount, onGap, onRevealGaps, onRemoveGaps,
}: TextToolbarProps) {
  // Nuanciers personnalisables (clic droit sur une pastille), partagés avec la barre tactile
  const colors = useSwatches(SWATCHES.text);
  const highlights = useSwatches(SWATCHES.highlights);
  const off = !editing;
  const call = (fn: (a: BoardTextApi) => void) => () => { const a = api.current; if (a) fn(a); };
  const spellState = !spell
    ? 'Désactivé'
    : spellStatus.error
      ? 'Service muet'
      : spellStatus.checking
        ? 'Analyse…'
        : spellStatus.count === 0
          ? 'Aucune faute'
          : `${spellStatus.count} faute${spellStatus.count > 1 ? 's' : ''}`;
  const interactions = ((box as { interactions?: unknown[] } | null)?.interactions?.length ?? 0) > 0;

  return (
    // Un appui sur un bouton ne doit pas faire perdre la sélection dans la zone de texte
    <div
      className="wbrib__text"
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('select')) e.preventDefault(); }}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('select')) e.preventDefault(); }}
    >
      <Group label="Police">
        <div className="ce-stack">
          <div className="ce-row">
            <select className="ce-select ce-select--font" value={fontId} onChange={(e) => onFontChange(e.target.value)} title={`Police (${TEXT_KEYS.font})`} aria-label="Police">
              {BOARD_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select className="ce-select" value={size} onChange={(e) => onSizeChange(Number(e.target.value))} title={`Taille (${TEXT_KEYS.sizeUp} / ${TEXT_KEYS.sizeDown} ; sans sélection : toute la zone)`} aria-label="Taille du texte">
              {TEXT_SIZES.map((v) => <option key={v} value={v}>{v}</option>)}
              {!TEXT_SIZES.includes(size) && <option value={size}>{size}</option>}
            </select>
            <Sm title={`Agrandir le texte (${TEXT_KEYS.sizeUp})`} disabled={off} onClick={call((a) => a.stepFontSize(1))}><span className="ce-glyph">A<sup>+</sup></span></Sm>
            <Sm title={`Réduire le texte (${TEXT_KEYS.sizeDown})`} disabled={off} onClick={call((a) => a.stepFontSize(-1))}><span className="ce-glyph ce-glyph--small">A<sup>−</sup></span></Sm>
            <Sm title={`Changer la casse (${TEXT_KEYS.toggleCase})`} disabled={off} onClick={call((a) => a.toggleCase())}><span className="ce-glyph">Aa</span></Sm>
            <Sm icon="clear" title={`Effacer la mise en forme (${TEXT_KEYS.clearFormat})`} disabled={off} onClick={call((a) => a.clearFormatting())} />
          </div>
          <div className="ce-row">
            <Sm title={`Gras (${TEXT_KEYS.bold})`} on={format.bold} disabled={off} onClick={call((a) => a.exec('bold'))}><b className="ce-glyph">G</b></Sm>
            <Sm title={`Italique (${TEXT_KEYS.italic})`} on={format.italic} disabled={off} onClick={call((a) => a.exec('italic'))}><i className="ce-glyph">I</i></Sm>
            <Sm title={`Souligné (${TEXT_KEYS.underline})`} on={format.underline} disabled={off} onClick={call((a) => a.exec('underline'))}><u className="ce-glyph">S</u></Sm>
            <Sm title={`Barré (${TEXT_KEYS.strike})`} on={format.strike} disabled={off} onClick={call((a) => a.exec('strikeThrough'))}><s className="ce-glyph">ab</s></Sm>
            <Sm title={`Indice (${TEXT_KEYS.subscript})`} on={format.sub} disabled={off} onClick={call((a) => a.exec('subscript'))}><span className="ce-glyph">x<sub>2</sub></span></Sm>
            <Sm title={`Exposant (${TEXT_KEYS.superscript})`} on={format.sup} disabled={off} onClick={call((a) => a.exec('superscript'))}><span className="ce-glyph">x<sup>2</sup></span></Sm>
            <span className="ce-sep" />
            {colors.map((c, i) => (
              <button
                key={i}
                type="button"
                className={`ce-swatch ${!box && color === c ? 'is-on' : ''}`}
                style={{ background: c }}
                title={`Couleur du texte (sans sélection : toute la zone) — ${SWATCH_HINT}`}
                aria-label={`Couleur du texte ${c}`}
                onClick={() => onColor(c)}
                onContextMenu={customizeSwatch(SWATCHES.text, i, onColor)}
              />
            ))}
          </div>
          <div className="ce-row">
            <span className="ce-minilabel"><Icon name="marker" size={15} /> Surligner</span>
            {highlights.map((c, i) => (
              <button
                key={i}
                type="button"
                className="ce-swatch"
                style={{ background: c }}
                disabled={off}
                title={`Surligner la sélection — ${SWATCH_HINT}`}
                aria-label={`Surligner en ${c}`}
                onClick={() => api.current?.applyHighlight(c)}
                onContextMenu={customizeSwatch(SWATCHES.highlights, i, (hex) => { if (!off) api.current?.applyHighlight(hex); })}
              />
            ))}
            <Sm title="Retirer le surlignage" disabled={off} onClick={call((a) => a.applyHighlight(null))}><span className="ce-glyph ce-glyph--sm">Aucun</span></Sm>
          </div>
        </div>
      </Group>

      <Group label="Paragraphe">
        <div className="ce-stack">
          <div className="ce-row">
            <Sm icon="ul" title={`Liste à puces (${TEXT_KEYS.bullets})`} on={format.ul} disabled={off} onClick={call((a) => a.exec('insertUnorderedList'))} />
            <Sm icon="ol" title={`Liste numérotée (${TEXT_KEYS.numbered})`} on={format.ol} disabled={off} onClick={call((a) => a.exec('insertOrderedList'))} />
            <Sm icon="outdent" title={`Diminuer l’alinéa (${TEXT_KEYS.indentLess})`} disabled={off} onClick={call((a) => a.changeIndent(-1))} />
            <Sm icon="indent" title={`Alinéa (${TEXT_KEYS.indentMore}) — première ligne du paragraphe ; item entier dans une liste`} disabled={off} onClick={call((a) => a.changeIndent(1))} />
          </div>
          <div className="ce-row">
            <Sm icon="left" title={`Aligner à gauche (${TEXT_KEYS.alignLeft})`} on={format.align === 'left'} disabled={off} onClick={call((a) => a.exec('justifyLeft'))} />
            <Sm icon="center" title={`Centrer (${TEXT_KEYS.alignCenter})`} on={format.align === 'center'} disabled={off} onClick={call((a) => a.exec('justifyCenter'))} />
            <Sm icon="right" title={`Aligner à droite (${TEXT_KEYS.alignRight})`} on={format.align === 'right'} disabled={off} onClick={call((a) => a.exec('justifyRight'))} />
            <Sm icon="justify" title={`Justifier (${TEXT_KEYS.justify})`} on={format.align === 'justify'} disabled={off} onClick={call((a) => a.exec('justifyFull'))} />
          </div>
        </div>
      </Group>

      <Group label="Texte à trous">
        <div className="ce-stack">
          <Sm icon="dots" label="Faire un trou" title="Texte à trous : masquer le mot sélectionné (ou sous le curseur)" disabled={off} onClick={onGap} />
          <Sm icon="spotlight" label="Tout révéler" title="Révéler tous les trous de la zone" disabled={!box || gapCount === 0} onClick={onRevealGaps} />
          <Sm icon="clear" label="Retirer les trous" title="Retirer les trous (le texte redevient ordinaire)" disabled={!box || gapCount === 0} onClick={onRemoveGaps} />
        </div>
      </Group>

      <Group label="Vérification">
        <div className="ce-stack">
          <Sm icon="spellcheck" label="Correcteur" title="Correcteur orthographique et grammatical (LanguageTool, réseau nécessaire) — toucher un mot souligné pour voir les propositions" on={spell} onClick={onToggleSpell} />
          <span className={`ce-minilabel wbrib__spellstate ${spell && spellStatus.error ? 'is-warn' : ''}`} role="status">{spellState}</span>
        </div>
      </Group>

      <Group label="Zone de texte">
        <div className="ce-stack">
          {onInteractions && box && (
            <Sm icon="bolt" label="Bouton" title="Bouton : relier la zone à un objet à afficher / masquer" on={interactions} onClick={() => onInteractions(box.id)} />
          )}
          <Sm icon="trash" label="Supprimer" title="Supprimer la zone de texte (Suppr)" disabled={!box} onClick={onDelete} />
        </div>
      </Group>
    </div>
  );
}
