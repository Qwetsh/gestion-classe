/**
 * Un cours lu par un élève, en entier : les feuilles A4 de l'éditeur, en lecture seule, empilées
 * et réduites à la largeur de l'écran (onglet TP de l'espace élève). Même rendu que la fiche collée
 * du classeur (GluedSheet), sans le format A5 ni le retournement.
 * À monter avec `key` = l'identifiant du cours.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { courseExtensions } from '../course/courseExtensions';
import { CourseSheetChrome } from '../course/CourseSheetChrome';
import { CourseLayer } from '../course/CourseLayer';
import { flowStyle } from '../course/courseThemes';
import '../course/course.css';

export function CourseReadOnly({ boardId, title, doc }: { boardId: string; title: string; doc: CourseDoc }) {
  const [pages, setPages] = useState(1);
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

  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: () => { /* lecture seule */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

  const scale = width > 0 ? width / PAGE_W : 0.4;
  const sheetsH = pages * PAGE_H + (pages - 1) * SHEET_GAP;
  const numbering = doc.settings?.numbering;

  return (
    <div ref={boxRef} style={{ width: '100%', height: sheetsH * scale, position: 'relative', overflow: 'hidden' }} aria-label={title}>
      <div
        className="ce-sheets"
        style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: sheetsH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
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
        {editor && (doc.layer?.items?.length ?? 0) > 0 && (
          <CourseLayer editor={editor} items={doc.layer?.items ?? []} height={sheetsH} active={false} readOnly
            style={{ tool: 'select', color: '#000', size: 'M' }} selected={null} onSelect={() => {}} onChange={() => {}} />
        )}
      </div>
    </div>
  );
}
