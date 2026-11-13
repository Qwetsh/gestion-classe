/**
 * Aperçu d'une version du cours (lot T6) : le document de l'époque, en lecture seule, sur ses
 * feuilles A4, par-dessus le cours en cours d'édition. Bandeau : date, « Restaurer », « Retour ».
 */
import { useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { courseExtensions } from './courseExtensions';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { VERSION_KIND_LABELS, type CourseVersion } from '../../lib/course/courseVersions';

interface Props {
  boardId: string;
  version: CourseVersion;
  doc: CourseDoc;
  zoom: number;
  onRestore: () => void;
  onClose: () => void;
}

export function CourseVersionPreview({ boardId, version, doc, zoom, onRestore, onClose }: Props) {
  const [pages, setPages] = useState(1);
  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: () => { /* lecture seule */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);

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
          <div className="ce-sheets" style={{ width: PAGE_W, height: sheetsH, transform: `scale(${zoom})` }}>
            {Array.from({ length: pages }).map((_, i) => (
              <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + SHEET_GAP), width: PAGE_W, height: PAGE_H }}>
                <span className="ce-sheet__num">{i + 1}</span>
              </div>
            ))}
            <div className="ce-flow" style={{ left: MARGIN, top: MARGIN, width: COL_W }} data-numbering={numbering && numbering !== 'none' ? numbering : undefined} data-hyphens={doc.settings?.hyphens ? '' : undefined}>
              {editor && <EditorContent editor={editor} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
