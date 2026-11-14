/**
 * Aperçu d'une version du cours (lot T6) : le document de l'époque, en lecture seule, sur ses
 * feuilles A4, par-dessus le cours en cours d'édition. Bandeau : date, « Restaurer », « Retour ».
 */
import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { courseExtensions } from './courseExtensions';
import { PAGE_H, PAGE_W, SHEET_GAP, pageGeometry } from '../../lib/course/coursePage';
import { relayoutNow } from './coursePagination';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { VERSION_KIND_LABELS, type CourseVersion } from '../../lib/course/courseVersions';
import { CourseSheetChrome } from './CourseSheetChrome';
import { flowStyle, sheetVars } from './courseThemes';
import { CourseLayer } from './CourseLayer';
import type { FieldValues } from './courseHeaderFooter';

interface Props {
  boardId: string;
  version: CourseVersion;
  doc: CourseDoc;
  zoom: number;
  /** Titre, classe, date des en-têtes (lot T9). */
  chromeValues?: Omit<FieldValues, 'page' | 'pages'>;
  onRestore: () => void;
  onClose: () => void;
}

export function CourseVersionPreview({ boardId, version, doc, zoom, chromeValues, onRestore, onClose }: Props) {
  const [pages, setPages] = useState(1);
  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: () => { /* lecture seule */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

  // Marges de la version (lot Q4)
  const geo = pageGeometry(doc.settings?.margins);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    relayoutNow(editor, undefined, geo.contentH);
  }, [editor, geo]);

  const at = new Date(version.created_at);
  const when = `${at.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const sheetsH = pages * PAGE_H + (pages - 1) * SHEET_GAP;
  const numbering = doc.settings?.numbering;

  return (
    <div className="ce-preview" role="region" aria-label="Aperçu d’une version">
      <div className="ce-preview__bar">
        <span className="ce-preview__what">
          <strong>Version du {when}</strong>
          <span>{version.label || VERSION_KIND_LABELS[version.kind]}{version.words != null ? ` · ${version.words} mot${version.words > 1 ? 's' : ''}` : ''}</span>
        </span>
        <span className="ce-spacer-flex" />
        <button type="button" className="ce-btn" onClick={onClose}>Retour au cours</button>
        <button type="button" className="ce-btn ce-btn--primary" onClick={onRestore}>Restaurer cette version</button>
      </div>
      <div className="ce-desk ce-preview__desk">
        <div className="ce-sheets-outer" style={{ width: PAGE_W * zoom, height: sheetsH * zoom }}>
          <div className="ce-sheets" style={{ width: PAGE_W, height: sheetsH, transform: `scale(${zoom})`, ...sheetVars(geo) }}>
            {Array.from({ length: pages }).map((_, i) => (
              <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + SHEET_GAP), width: PAGE_W, height: PAGE_H }}>
                <CourseSheetChrome page={i + 1} pages={pages} settings={doc.settings ?? {}} values={chromeValues ?? { titre: '', classe: '', date: '' }} />
              </div>
            ))}
            <div className="ce-flow" style={{ left: geo.marginX, top: geo.marginY, width: geo.colW, ...flowStyle(doc.settings) }} data-numbering={numbering && numbering !== 'none' ? numbering : undefined} data-hyphens={doc.settings?.hyphens ? '' : undefined} data-caption={doc.settings?.captionLabel ?? 'document'}>
              {editor && <EditorContent editor={editor} />}
            </div>
            {editor && (
              <CourseLayer editor={editor} items={doc.layer?.items ?? []} height={sheetsH} active={false} readOnly
                style={{ tool: 'select', color: '#000', size: 'M' }} selected={null} onSelect={() => {}} onChange={() => {}} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
