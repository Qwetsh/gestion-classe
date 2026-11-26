/**
 * Un cours lu sur un téléphone (version couleur d'un document imprimé, page `/d/<jeton>`) : le texte
 * du cours sur une seule colonne, à la largeur de l'écran, en lecture seule. Pas de feuilles A4 :
 * les blocs se suivent, les colonnes s'empilent, un tableau trop large défile de côté, les images
 * prennent toute la largeur, une image « page entière » est réduite à la largeur de l'écran (le
 * zoom du doigt reste permis). Le cartouche est mis à plat (lib/mobileVersion.ts, phoneContent).
 * À monter avec `key` : un nouveau document refait l'éditeur.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { PAGE_W } from '../../lib/course/coursePage';
import { phoneContent } from '../../lib/mobileVersion';
import { courseExtensions } from './courseExtensions';
import { flowStyle } from './courseThemes';
import './course.css';
import './coursePhone.css';

/** Ce qui ne sert qu'à écrire ou à paginer : retiré du lecteur. */
const SKIPPED = new Set(['coursePagination', 'courseSpell', 'courseInvisibles', 'courseSearch', 'coursePaste', 'formatPainter', 'placeholder']);

const noop = () => undefined;

export function CoursePhoneDoc({ doc, title }: { doc: CourseDoc; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const content = useMemo(() => phoneContent(doc.content), [doc]);
  const extensions = useMemo(() => courseExtensions(
    noop,
    { boardId: '', onEdit: noop },
    noop,
    { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop },
  ).filter((ext) => !SKIPPED.has(ext.name)), []);
  const editor = useEditor({ extensions, content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [content]);

  const numbering = doc.settings?.numbering;
  // Une page entière (793,7 px de large) est réduite à la largeur de la colonne
  const style = { '--ce-phone-page': String(width > 0 ? width / PAGE_W : 0.45) } as CSSProperties;

  return (
    <div ref={boxRef} className="ce-phone" style={style} aria-label={title}>
      <div
        className="ce-flow"
        style={flowStyle(doc.settings)}
        data-numbering={numbering && numbering !== 'none' ? numbering : undefined}
        data-caption={doc.settings?.captionLabel ?? 'document'}
      >
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
}
