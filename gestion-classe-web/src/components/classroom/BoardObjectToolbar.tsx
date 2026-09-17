/**
 * Barre contextuelle des objets qui n'ont pas de mise en forme propre : image, tableau, widget,
 * vidéo, site, son, lien, équation. Elle se pose sur l'objet (dans `BoardFloatingToolbar`) et
 * regroupe les actions communes (dupliquer, ordre, cache, verrou, supprimer) puis celles du type.
 *
 * Le texte et les formes gardent leurs barres dédiées ; l'objet de bibliothèque emprunte celle
 * des formes. Ici, aucune action n'ouvre de dialogue : tout agit tout de suite.
 */
import type { BoardObject } from '../../lib/boardObjects';
import type { RevealCover } from '../../lib/boardReveal';
import { insertTableCol, insertTableRow, removeTableCol, removeTableRow, type TableObject } from '../../lib/boardMedia';

interface Props {
  /** Objets sélectionnés (hors texte, forme, bibliothèque). Les actions de type ne s'affichent que pour un seul objet. */
  objects: BoardObject[];
  /** Cellule active du tableau sélectionné, si connue. */
  tableCell: { r: number; c: number } | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onReorder: (dir: 'front' | 'forward' | 'backward' | 'back') => void;
  onCover: (cover: RevealCover | null) => void;
  onImageBackground: () => void;
  onImageReplace: () => void;
  onPatchTable: (id: string, fn: (t: TableObject) => TableObject) => void;
  onToggleInteractive: (id: string) => void;
  onEdit: (id: string) => void;
  /** Ouvre le panneau des interactions (l'objet devient un bouton qui affiche / masque d'autres objets). */
  onInteractions: (id: string) => void;
}

const hold = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); };

export function BoardObjectToolbar({
  objects, tableCell, onDuplicate, onDelete, onToggleLock, onReorder, onCover,
  onImageBackground, onImageReplace, onPatchTable, onToggleInteractive, onEdit, onInteractions,
}: Props) {
  const one = objects.length === 1 ? objects[0] : null;
  const locked = objects.every((o) => o.locked === true);
  const covered = objects.some((o) => o.cover);

  return (
    <>
      {/* Actions propres au type — en premier : c'est pour elles qu'on a sélectionné l'objet */}
      {one?.type === 'image' && (
        <div className="wb__group">
          <button type="button" className="wb__btn wb__txt" title="Remplacer l'image (même place, même largeur)" onPointerDown={hold} onClick={onImageReplace}>⇄</button>
          <button type="button" className="wb__btn wb__txt" title="Mettre en fond de page" onPointerDown={hold} onClick={onImageBackground}>▣</button>
        </div>
      )}
      {one?.type === 'table' && (() => {
        const t = one as TableObject;
        const cell = tableCell ?? { r: 0, c: 0 };
        return (
          <div className="wb__group">
            <button type="button" className="wb__btn wb__txt" title="Ligne en dessous" onPointerDown={hold} onClick={() => onPatchTable(t.id, (x) => insertTableRow(x, cell.r + 1))}>⊞↓</button>
            <button type="button" className="wb__btn wb__txt" title="Supprimer la ligne" disabled={t.rows <= 1} onPointerDown={hold} onClick={() => onPatchTable(t.id, (x) => removeTableRow(x, cell.r))}>⊟↓</button>
            <button type="button" className="wb__btn wb__txt" title="Colonne après" onPointerDown={hold} onClick={() => onPatchTable(t.id, (x) => insertTableCol(x, cell.c + 1))}>⊞→</button>
            <button type="button" className="wb__btn wb__txt" title="Supprimer la colonne" disabled={t.cols <= 1} onPointerDown={hold} onClick={() => onPatchTable(t.id, (x) => removeTableCol(x, cell.c))}>⊟→</button>
            <button type="button" className={`wb__btn wb__txt ${t.header ? 'is-on' : ''}`} title={t.header ? "Sans ligne d'en-tête" : 'Première ligne en en-tête'} onPointerDown={hold} onClick={() => onPatchTable(t.id, (x) => ({ ...x, header: !x.header }))}>▤</button>
          </div>
        );
      })()}
      {one?.type === 'web' && (
        <div className="wb__group">
          <button type="button" className={`wb__btn wb__txt ${one.interactive ? 'is-on' : ''}`} title={one.interactive ? 'Annoter par-dessus le site' : 'Interagir avec le site'} onPointerDown={hold} onClick={() => onToggleInteractive(one.id)}>
            {one.interactive ? '✎' : '☞'}
          </button>
        </div>
      )}
      {one?.type === 'equation' && (
        <div className="wb__group">
          <button type="button" className="wb__btn wb__txt" title="Modifier l'équation" onPointerDown={hold} onClick={() => onEdit(one.id)}>ƒ</button>
        </div>
      )}

      {/* Commun à tous */}
      <div className="wb__group">
        <button type="button" className="wb__btn wb__txt" title="Dupliquer (Ctrl+D)" onPointerDown={hold} onClick={onDuplicate}>⧉</button>
        <button type="button" className="wb__btn wb__txt" title="Avancer (Ctrl+])" onPointerDown={hold} onClick={() => onReorder('forward')}>⤒</button>
        <button type="button" className="wb__btn wb__txt" title="Reculer (Ctrl+[)" onPointerDown={hold} onClick={() => onReorder('backward')}>⤓</button>
      </div>
      <div className="wb__group">
        {covered
          ? <button type="button" className="wb__btn wb__txt is-on" title="Retirer le cache" onPointerDown={hold} onClick={() => onCover(null)}>◫</button>
          : <button type="button" className="wb__btn wb__txt" title="Poser un rideau (à découvrir en classe)" onPointerDown={hold} onClick={() => onCover({ kind: 'curtain', color: '#4B5563', label: '?' })}>◫</button>}
        <button type="button" className={`wb__btn wb__txt ${locked ? 'is-on' : ''}`} title={locked ? 'Déverrouiller (Ctrl+Maj+K)' : 'Verrouiller (Ctrl+Maj+K)'} onPointerDown={hold} onClick={onToggleLock}>{locked ? '🔒' : '🔓'}</button>
        {one && (
          <button type="button" className={`wb__btn wb__txt ${(one.interactions?.length ?? 0) > 0 ? 'is-on' : ''}`} title="Interactions : ce bouton affiche / masque d'autres objets" onPointerDown={hold} onClick={() => onInteractions(one.id)}>⚡</button>
        )}
      </div>
      <div className="wb__group">
        <button type="button" className="wb__btn wb__txt wb__btn--danger" title="Supprimer (Suppr)" disabled={locked} onPointerDown={hold} onClick={onDelete}>✕</button>
      </div>
    </>
  );
}
