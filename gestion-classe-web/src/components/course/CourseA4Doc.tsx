/**
 * Un cours lu en feuilles A4, en lecture seule, réduit à la largeur de l'écran (page publique
 * `/d/<jeton>`, vue « Pages A4 ») : les mêmes feuilles que dans l'éditeur, en-têtes et pieds de page
 * compris, pour lire la fiche telle qu'elle est distribuée et l'imprimer. Pas de calque
 * d'annotations : le serveur ne le rend pas (supabase/functions/version-mobile/rules.ts).
 *
 * `sheetsRef` reçoit le bloc des feuilles mises en page (`.ce-sheets`) : l'impression en prend une
 * copie figée par page (lib/binderPrint.ts, comme le bouton « Imprimer » du classeur).
 * À monter avec `key` : un nouveau document refait l'éditeur.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { courseExtensions } from './courseExtensions';
import { CourseSheetChrome } from './CourseSheetChrome';
import { flowStyle } from './courseThemes';
import './course.css';

const noop = () => undefined;

export function CourseA4Doc({ doc, title, sheetsRef }: { doc: CourseDoc; title: string; sheetsRef?: RefObject<HTMLDivElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId: '', onEdit: noop },
    noop,
    { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop },
  ), []);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

  // Jamais plus grand qu'en vrai : une feuille A4 à sa taille sur un grand écran, réduite sur un téléphone
  const zoom = width > 0 ? Math.min(1, width / PAGE_W) : 0.45;
  const sheetsH = pages * PAGE_H + (pages - 1) * SHEET_GAP;
  const numbering = doc.settings?.numbering;

  return (
    <div ref={boxRef} className="ce-a4" aria-label={title}>
      <div className="ce-a4__outer" style={{ width: PAGE_W * zoom, height: sheetsH * zoom }}>
        <div ref={sheetsRef} className="ce-sheets" style={{ width: PAGE_W, height: sheetsH, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          {Array.from({ length: pages }).map((_, i) => (
            <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + SHEET_GAP), width: PAGE_W, height: PAGE_H }}>
              <CourseSheetChrome page={i + 1} pages={pages} settings={doc.settings ?? {}} values={{ titre: title, classe: '', date: '' }} />
            </div>
          ))}
          <div
            className="ce-flow"
            style={{ left: MARGIN, top: MARGIN, width: COL_W, ...flowStyle(doc.settings) }}
            data-numbering={numbering && numbering !== 'none' ? numbering : undefined}
            data-hyphens={doc.settings?.hyphens ? '' : undefined}
            data-caption={doc.settings?.captionLabel ?? 'document'}
          >
            {editor && <EditorContent editor={editor} />}
          </div>
        </div>
      </div>
    </div>
  );
}
