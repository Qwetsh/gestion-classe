/**
 * Un document d'activité en lecture, à la largeur du panneau, dont on peut toucher les blocs :
 * le toucher est transmis (position, nœud touché) et la sélection en cours est surlignée.
 *
 * Le cours est rendu comme dans l'éditeur (feuilles A4 empilées, lecture seule) puis réduit à la
 * largeur du panneau. Les positions viennent de ProseMirror ; la sélection est une décoration de
 * nœud, jamais une modification du document.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import type { PickRange } from '../../lib/activityBlocks';
import { courseExtensions } from '../course/courseExtensions';
import { CourseSheetChrome } from '../course/CourseSheetChrome';
import { flowStyle } from '../course/courseThemes';
import '../course/course.css';

const pickKey = new PluginKey<PickRange | null>('activityPick');

/** Surligne la sélection : chaque nœud entièrement compris dans la plage reçoit `ab-picked`. */
const PickHighlight = Extension.create({
  name: 'activityPick',
  addProseMirrorPlugins() {
    return [
      new Plugin<PickRange | null>({
        key: pickKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(pickKey) as PickRange | null | undefined;
            return meta === undefined ? value : meta;
          },
        },
        props: {
          decorations(state) {
            const range = pickKey.getState(state);
            if (!range) return null;
            const decorations: Decoration[] = [];
            state.doc.nodesBetween(range.from, range.to, (node, pos) => {
              if (pos >= range.from && pos + node.nodeSize <= range.to) {
                decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'ab-picked' }));
                return false;
              }
              return true;
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export interface ReaderTouch {
  /** Position de texte sous le doigt. */
  pos: number;
  /** Position du nœud sans texte touché (image…), ou -1. */
  inside: number;
}

interface Props {
  doc: CourseDoc;
  /** Identifiant du cours : une autre activité = un autre lecteur. */
  boardId: string;
  title: string;
  /** Largeur disponible, en px d'écran. */
  width: number;
  pick: PickRange | null;
  onTouch: (touch: ReaderTouch) => void;
  /** L'éditeur de lecture est prêt (ou quitte) : sert à lire le contenu choisi et à le capturer. */
  onEditor: (editor: Editor | null) => void;
}

export function ActivityReader({ doc, boardId, title, width, pick, onTouch, onEditor }: Props) {
  const [pages, setPages] = useState(1);
  const extensions = useMemo(() => [
    ...courseExtensions(
      (layout) => setPages(layout.pages),
      { boardId, onEdit: () => { /* lecture seule */ } },
      () => { /* lecture seule */ },
      { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
    ),
    PickHighlight,
  ], [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc, extensions]);

  useEffect(() => {
    onEditor(editor ?? null);
    return () => onEditor(null);
  }, [editor, onEditor]);

  // La sélection suit l'état du panneau
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(pickKey, pick).setMeta('addToHistory', false));
  }, [editor, pick]);

  const scale = Math.max(0.2, width / PAGE_W);
  const sheetsH = pages * PAGE_H + (pages - 1) * SHEET_GAP;
  const numbering = doc.settings?.numbering;

  // Un toucher, pas un défilement : le doigt ne doit presque pas avoir bougé
  const down = useRef<{ x: number; y: number } | null>(null);
  const touch = (e: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!editor || editor.isDestroyed || !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
    const hit = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (hit) onTouch({ pos: hit.pos, inside: hit.inside });
  };

  return (
    <div className="ab-reader" style={{ width, height: sheetsH * scale }}>
      <div
        className="ce-sheets ab-reader__sheets"
        style={{ width: PAGE_W, height: sheetsH, transform: `scale(${scale})` }}
        onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={touch}
      >
        {Array.from({ length: pages }).map((_, i) => (
          <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + SHEET_GAP), width: PAGE_W, height: PAGE_H, boxShadow: 'none' }}>
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
  );
}
