/**
 * Volet « Plan du cours » (lot T7) : les titres du document, numérotés comme sur la feuille ;
 * un clic amène le curseur et le bureau sur le titre. Le titre où se trouve le curseur est
 * mis en avant.
 */
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import type { HeadingNumbering } from '../../lib/course/courseDoc';
import { outlineOf } from './courseHeadings';

interface Props {
  editor: Editor;
  numbering: HeadingNumbering | undefined;
  onGo: (pos: number) => void;
  onClose: () => void;
}

export function CourseOutline({ editor, numbering, onGo, onClose }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const items = outlineOf(e.state.doc, numbering);
      const at = e.state.selection.from;
      let active = -1;
      items.forEach((it, i) => { if (it.pos <= at) active = i; });
      return { items, active };
    },
  });
  const items = state?.items ?? [];
  const active = state?.active ?? -1;

  return (
    <nav className="ce-outline" aria-label="Plan du cours">
      <div className="ce-outline__head">
        <strong>Plan du cours</strong>
        <button type="button" className="ce-versions__x" aria-label="Fermer le plan" title="Fermer" onClick={onClose}>✕</button>
      </div>
      {items.length === 0 ? (
        <p className="ce-outline__empty">Les titres du cours (Titre 1, 2, 3) apparaîtront ici.</p>
      ) : (
        <ul>
          {items.map((it, i) => (
            <li key={it.pos}>
              <button
                type="button"
                className={`ce-outline__item ce-outline__item--h${Math.min(it.level, 3)} ${i === active ? 'is-active' : ''} ${it.text ? '' : 'is-empty'}`}
                onClick={() => onGo(it.pos)}
                title={it.text || 'Titre vide'}
              >
                {it.number && <span className="ce-outline__num">{it.number}</span>}
                <span className="ce-outline__text">{it.text || 'Titre vide'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
