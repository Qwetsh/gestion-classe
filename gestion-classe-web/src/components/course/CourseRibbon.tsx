/**
 * Ruban de l'éditeur de cours, organisé comme Word / LibreOffice : onglets, groupes étiquetés,
 * grandes icônes pour les actions fréquentes. Onglets contextuels « Tableau » et « Image »
 * quand le curseur est dans un tableau ou sur une image.
 *
 * Les boutons ne prennent jamais le focus (mousedown annulé) : la sélection du texte reste en
 * place, comme dans un traitement de texte.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Icon, type IconName } from './courseIcons';
import { CALLOUT_COLORS, CALLOUT_LABELS, WRITING_ZONE_LABELS, type CalloutKind, type WritingZoneStyle } from './courseExtensions';
import { CourseBlocksMenu } from './CourseBlocksMenu';
import { formatPoints } from './courseEval';
import { CourseTableGrid } from './CourseTableGrid';
import { CELL_COLORS, ROW_HEIGHTS, TABLE_STYLES, type TableStyle } from './courseTable';
import { COL_W, FONT_FAMILIES, FONT_SIZES_PT } from '../../lib/course/coursePage';
import { CourseSymbolPicker } from './CourseSymbolPicker';
import { LINE_HEIGHTS, SPACE_AFTER, SPACE_BEFORE } from './courseParagraph';
import { HEADING_NUMBERING_LABELS, type CourseSettings, type HeadingNumbering } from '../../lib/course/courseDoc';

export type RibbonTab = 'fichier' | 'accueil' | 'insertion' | 'miseenpage' | 'affichage' | 'tableau' | 'encadre' | 'image' | 'encart' | 'zone' | 'dots' | 'points';

interface Props {
  editor: Editor;
  onPrint: () => void;
  onExportPdf: () => void;
  onRename: () => void;
  onInsertImage: () => void;
  onInsertQr: () => void;
  onInsertLink: () => void;
  onPaste: (mode: 'adapt' | 'keep' | 'text') => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFitWidth: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  onSoon: (what: string) => void;
  onEditEncart: (pageId: string) => void;
  settings: CourseSettings;
  onSettings: (patch: Partial<CourseSettings>) => void;
  onHistory: () => void;
  historyOpen: boolean;
  onSaveVersion: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
}

const LIST_TYPES: { label: string; value: string | null }[] = [
  { label: '1. 2. 3.', value: null },
  { label: 'a. b. c.', value: 'a' },
  { label: 'A. B. C.', value: 'A' },
  { label: 'I. II. III.', value: 'I' },
  { label: 'i. ii. iii.', value: 'i' },
];

const TEXT_COLORS = [
  { c: '#111827', n: 'Noir' }, { c: '#DC2626', n: 'Rouge' }, { c: '#2563EB', n: 'Bleu' },
  { c: '#16A34A', n: 'Vert' }, { c: '#9333EA', n: 'Violet' }, { c: '#EA580C', n: 'Orange' },
];
const HIGHLIGHTS = [
  { c: '#FEF08A', n: 'Jaune' }, { c: '#BBF7D0', n: 'Vert' }, { c: '#BFDBFE', n: 'Bleu' }, { c: '#FBCFE8', n: 'Rose' },
];

function Big({ icon, label, title, onClick, on, disabled }: { icon: IconName; label: string; title?: string; onClick: () => void; on?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`ce-big ${on ? 'is-on' : ''}`} title={title ?? label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={28} />
      <span>{label}</span>
    </button>
  );
}

function Sm({ icon, label, title, onClick, on, disabled, children }: { icon?: IconName; label?: string; title: string; onClick: () => void; on?: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="button" className={`ce-sm ${on ? 'is-on' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled} aria-pressed={on}>
      {icon && <Icon name={icon} size={16} />}
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ce-group">
      <div className="ce-group__body">{children}</div>
      <div className="ce-group__label">{label}</div>
    </div>
  );
}

export function CourseRibbon({ editor, onPrint, onExportPdf, onRename, onInsertImage, onInsertQr, onInsertLink, onPaste, zoom, onZoom, onFitWidth, showRuler, onToggleRuler, onSoon, onEditEncart, settings, onSettings, onHistory, historyOpen, onSaveVersion, onDuplicate, onSaveTemplate }: Props) {
  const [view, setView] = useState<{ tab: RibbonTab; ctx: RibbonTab | null }>({ tab: 'accueil', ctx: null });

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        superscript: e.isActive('superscript'),
        subscript: e.isActive('subscript'),
        highlight: ((e.getAttributes('highlight') as { color?: string }).color ?? '') as string,
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        listItem: e.isActive('listItem'),
        tasks: e.isActive('taskList'),
        taskItem: e.isActive('taskItem'),
        listType: ((e.getAttributes('orderedList') as { type?: string | null }).type ?? '') as string,
        lineHeight: ((e.getAttributes('heading').lineHeight ?? e.getAttributes('paragraph').lineHeight ?? '') as string),
        spaceBefore: (e.getAttributes('heading').spaceBefore ?? e.getAttributes('paragraph').spaceBefore ?? null) as number | null,
        spaceAfter: (e.getAttributes('heading').spaceAfter ?? e.getAttributes('paragraph').spaceAfter ?? null) as number | null,
        firstLine: !!e.getAttributes('paragraph').firstLine,
        alignLeft: e.isActive({ textAlign: 'left' }),
        alignCenter: e.isActive({ textAlign: 'center' }),
        alignRight: e.isActive({ textAlign: 'right' }),
        alignJustify: e.isActive({ textAlign: 'justify' }),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        paragraph: e.isActive('paragraph') && !e.isActive('callout'),
        callout: (Object.keys(CALLOUT_LABELS) as CalloutKind[]).find((k) => e.isActive('callout', { kind: k })) ?? null,
        calloutTitle: (e.getAttributes('callout') as { title?: string | null }).title ?? null,
        calloutColor: ((e.getAttributes('callout') as { color?: string | null }).color ?? '') as string,
        onDots: e.isActive('dots'),
        dotsCm: (e.getAttributes('dots') as { cm?: number | null }).cm ?? null,
        onPoints: e.isActive('points'),
        pointsValue: Number((e.getAttributes('points') as { value?: number }).value) || 0,
        fontFamily: ts.fontFamily ?? '',
        fontSize: ts.fontSize ?? '',
        color: ts.color ?? '',
        link: e.isActive('link'),
        inTable: e.isActive('table'),
        tableStyle: ((e.getAttributes('table') as { tableStyle?: string }).tableStyle ?? 'grid') as TableStyle,
        tableAlign: ((e.getAttributes('table') as { tableAlign?: string }).tableAlign ?? 'left') as string,
        cellBg: ((e.getAttributes('tableCell').backgroundColor ?? e.getAttributes('tableHeader').backgroundColor ?? '') as string),
        cellVAlign: ((e.getAttributes('tableCell').verticalAlign ?? e.getAttributes('tableHeader').verticalAlign ?? 'top') as string),
        rowHeight: (e.getAttributes('tableRow').minHeight ?? null) as number | null,
        onImage: e.isActive('image'),
        imageAlign: (e.getAttributes('image') as { align?: string }).align ?? 'center',
        onEncart: e.isActive('encart'),
        encartPageId: (e.getAttributes('encart') as { pageId?: string }).pageId ?? null,
        encartPrint: (e.getAttributes('encart') as { print?: string }).print ?? 'filled',
        onZone: e.isActive('writingZone'),
        zoneStyle: ((e.getAttributes('writingZone') as { style?: string }).style ?? 'seyes') as WritingZoneStyle,
        zoneLines: Number((e.getAttributes('writingZone') as { lines?: number }).lines) || 6,
        painter: e.storage.formatPainter?.armed ?? false,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  // Onglets contextuels (image, encart, zone) : on y bascule quand ils apparaissent ; quand ils
  // disparaissent, on revient à l'onglet d'où l'on venait. Calculé au rendu (pas d'effet).
  const ctx: RibbonTab | null = s.onImage ? 'image' : s.onEncart ? 'encart' : s.onZone ? 'zone' : s.onDots ? 'dots' : s.onPoints ? 'points' : null;
  if (view.ctx !== ctx) {
    const back: RibbonTab = view.ctx === 'image' ? 'accueil' : 'insertion';
    setView({ tab: ctx ?? (view.tab === view.ctx ? back : view.tab), ctx });
  }
  const tab: RibbonTab = (view.tab === 'tableau' && !s.inTable) || (view.tab === 'encadre' && !s.callout) ? 'accueil' : view.tab;
  const setTab = (t: RibbonTab) => setView((v) => ({ ...v, tab: t }));

  const c = () => editor.chain().focus();

  /** Retrait : dans une liste, on change de niveau ; ailleurs, on décale le paragraphe. */
  const indent = (dir: 1 | -1) => {
    const item = s.taskItem ? 'taskItem' : s.listItem ? 'listItem' : null;
    if (item) { if (dir > 0) c().sinkListItem(item).run(); else c().liftListItem(item).run(); }
    else c().indentParagraph(dir).run();
  };

  /** Taille suivante ou précédente dans la liste des tailles (12 pt = taille du style). */
  const stepFontSize = (dir: 1 | -1) => {
    const current = s.fontSize.endsWith('pt') ? Number(s.fontSize.slice(0, -2)) : 12;
    const next = dir > 0 ? FONT_SIZES_PT.find((p) => p > current) : [...FONT_SIZES_PT].reverse().find((p) => p < current);
    if (!next) return;
    if (next === 12) c().unsetFontSize().run(); else c().setFontSize(`${next}pt`).run();
  };

  // Menu « Options de collage », sous le bouton Coller
  const pasteBtnRef = useRef<HTMLDivElement>(null);
  const [pasteMenu, setPasteMenu] = useState<{ left: number; top: number } | null>(null);
  const pasteMenuRef = useRef<HTMLDivElement>(null);
  const togglePasteMenu = () => {
    if (pasteMenu) { setPasteMenu(null); return; }
    const r = pasteBtnRef.current?.getBoundingClientRect();
    setPasteMenu({ left: r?.left ?? 10, top: (r?.bottom ?? 170) + 4 });
  };
  // Fermeture : clic ailleurs (hors du menu et du bouton) ou Échap
  useEffect(() => {
    if (!pasteMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pasteMenuRef.current?.contains(t) || pasteBtnRef.current?.contains(t)) return;
      setPasteMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPasteMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pasteMenu]);

  // Grille de taille du tableau, ancrée sous son bouton
  const tableBtnRef = useRef<HTMLSpanElement>(null);
  const [tableGrid, setTableGrid] = useState<{ left: number; top: number } | null>(null);
  const toggleTableGrid = () => {
    if (tableGrid) { setTableGrid(null); return; }
    const r = tableBtnRef.current?.querySelector('button')?.getBoundingClientRect();
    setTableGrid({ left: r?.left ?? 200, top: (r?.bottom ?? 170) + 6 });
  };

  // Menu des blocs, ancré sous son bouton
  const blocksBtnRef = useRef<HTMLSpanElement>(null);
  const [blocks, setBlocks] = useState<{ left: number; top: number } | null>(null);
  const toggleBlocks = () => {
    if (blocks) { setBlocks(null); return; }
    const r = blocksBtnRef.current?.querySelector('button')?.getBoundingClientRect();
    setBlocks({ left: r?.left ?? 200, top: (r?.bottom ?? 170) + 6 });
  };

  // Palette de symboles, ancrée sous son bouton
  const symbolBtnRef = useRef<HTMLSpanElement>(null);
  const [symbols, setSymbols] = useState<{ left: number; top: number } | null>(null);
  const toggleSymbols = () => {
    if (symbols) { setSymbols(null); return; }
    const btn = symbolBtnRef.current?.querySelector('button');
    const r = btn?.getBoundingClientRect();
    setSymbols({ left: r?.left ?? 200, top: (r?.bottom ?? 170) + 6 });
  };
  /**
   * Réglage d'un bloc insécable (image, encart, zone) : ProseMirror remplace le bloc entier, et la
   * sélection retomberait sur le bloc voisin — on resélectionne le bloc modifié.
   */
  const updateNode = (type: string, attrs: Record<string, unknown>) => {
    const pos = editor.state.selection.from;
    c().updateAttributes(type, attrs).setNodeSelection(pos).run();
  };
  const sizePt = s.fontSize.endsWith('pt') ? s.fontSize.slice(0, -2) : '';

  const tabs: { id: RibbonTab; label: string; contextual?: boolean }[] = [
    { id: 'fichier', label: 'Fichier' },
    { id: 'accueil', label: 'Accueil' },
    { id: 'insertion', label: 'Insertion' },
    { id: 'miseenpage', label: 'Mise en page' },
    { id: 'affichage', label: 'Affichage' },
    ...(s.inTable ? [{ id: 'tableau' as const, label: 'Tableau', contextual: true }] : []),
    ...(s.onImage ? [{ id: 'image' as const, label: 'Image', contextual: true }] : []),
    ...(s.onEncart ? [{ id: 'encart' as const, label: 'Encart tableau', contextual: true }] : []),
    ...(s.callout ? [{ id: 'encadre' as const, label: 'Encadré', contextual: true }] : []),
    ...(s.onZone ? [{ id: 'zone' as const, label: 'Zone d’écriture', contextual: true }] : []),
    ...(s.onDots ? [{ id: 'dots' as const, label: 'Pointillés', contextual: true }] : []),
    ...(s.onPoints ? [{ id: 'points' as const, label: 'Barème', contextual: true }] : []),
  ];

  return (
    <div className="ce-ribbonwrap" onMouseDown={(e) => { const t = e.target as HTMLElement; if (t.closest('button')) e.preventDefault(); }}>
      <nav className="ce-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`ce-tab ${t.id === 'fichier' ? 'ce-tab--file' : ''} ${t.contextual ? 'ce-tab--ctx' : ''} ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ce-ribbon" role="toolbar" aria-label="Ruban">
        {tab === 'fichier' && (
          <>
            <Group label="Imprimer">
              <Big icon="print" label="Imprimer" title="Imprimer le cours (Ctrl+P)" onClick={onPrint} />
              <Big icon="pdf" label="Exporter en PDF" title="Exporter en PDF : choisir « Enregistrer au format PDF » dans la fenêtre d'impression" onClick={onExportPdf} />
            </Group>
            <Group label="Cours">
              <Big icon="rename" label="Renommer" onClick={onRename} />
              <Big icon="duplicate" label="Dupliquer" title="Faire une copie indépendante de ce cours (texte et encarts)" onClick={onDuplicate} />
              <Big icon="template" label="Enregistrer comme modèle" title="Garder ce cours comme point de départ des prochains" onClick={onSaveTemplate} />
            </Group>
            <Group label="Versions">
              <Big icon="history" label="Historique" title="Revoir et restaurer les versions précédentes du cours" onClick={onHistory} on={historyOpen} />
              <Big icon="versionSave" label="Enregistrer une version" title="Garder l'état actuel du cours dans l'historique, sous un nom" onClick={onSaveVersion} />
            </Group>
          </>
        )}

        {tab === 'accueil' && (
          <>
            <Group label="Presse-papiers">
              <div className="ce-split" ref={pasteBtnRef}>
                <Big icon="paste" label="Coller" title="Coller en adaptant au cours (Ctrl+V)" onClick={() => onPaste('adapt')} />
                <button type="button" className="ce-split__caret" title="Options de collage" aria-label="Options de collage" onClick={togglePasteMenu}>▾</button>
              </div>
              <div className="ce-stack">
                <Sm icon="cut" label="Couper" title="Couper (Ctrl+X)" onClick={() => { editor.commands.focus(); document.execCommand('cut'); }} />
                <Sm icon="copy" label="Copier" title="Copier (Ctrl+C)" onClick={() => { editor.commands.focus(); document.execCommand('copy'); }} />
                <button
                  type="button"
                  className={`ce-sm ${s.painter ? 'is-on' : ''}`}
                  title="Reproduire la mise en forme : cliquer, puis sélectionner le texte à mettre en forme. Double-clic : plusieurs fois (Échap pour arrêter)"
                  aria-pressed={s.painter}
                  onClick={(e) => {
                    if (s.painter) { editor.chain().focus().cancelFormat().run(); return; }
                    editor.chain().focus().pickFormat(e.detail >= 2).run();
                  }}
                  onDoubleClick={() => editor.chain().focus().pickFormat(true).run()}
                >
                  <Icon name="brush" size={16} />
                  <span>Reproduire</span>
                </button>
              </div>
            </Group>

            <Group label="Police">
              <div className="ce-stack">
                <div className="ce-row">
                  <select
                    className="ce-select ce-select--font"
                    value={s.fontFamily}
                    onChange={(e) => { const v = e.target.value; if (v) c().setFontFamily(v).run(); else c().unsetFontFamily().run(); }}
                    title="Police"
                    aria-label="Police"
                  >
                    {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value ?? ''}>{f.label}</option>)}
                  </select>
                  <select
                    className="ce-select"
                    value={sizePt || (s.fontSize ? '' : '12')}
                    onChange={(e) => { const v = e.target.value; if (v === '12') c().unsetFontSize().run(); else c().setFontSize(`${v}pt`).run(); }}
                    title="Taille de police"
                    aria-label="Taille de police"
                  >
                    {!sizePt && s.fontSize && <option value="">—</option>}
                    {FONT_SIZES_PT.map((p) => <option key={p} value={String(p)}>{p}</option>)}
                  </select>
                  <Sm title="Agrandir la police" onClick={() => stepFontSize(1)}><span className="ce-glyph">A<sup>+</sup></span></Sm>
                  <Sm title="Réduire la police" onClick={() => stepFontSize(-1)}><span className="ce-glyph ce-glyph--small">A<sup>−</sup></span></Sm>
                  <Sm title="Changer la casse : minuscules, MAJUSCULES, Première lettre (Maj+F3)" onClick={() => c().cycleCase().run()}><span className="ce-glyph">Aa</span></Sm>
                  <Sm icon="clear" title="Effacer la mise en forme" onClick={() => c().unsetAllMarks().unsetTextAlign().run()} />
                </div>
                <div className="ce-row">
                  <Sm title="Gras (Ctrl+B)" on={s.bold} onClick={() => c().toggleBold().run()}><b className="ce-glyph">G</b></Sm>
                  <Sm title="Italique (Ctrl+I)" on={s.italic} onClick={() => c().toggleItalic().run()}><i className="ce-glyph">I</i></Sm>
                  <Sm title="Souligné (Ctrl+U)" on={s.underline} onClick={() => c().toggleUnderline().run()}><u className="ce-glyph">S</u></Sm>
                  <Sm title="Barré" on={s.strike} onClick={() => c().toggleStrike().run()}><s className="ce-glyph">ab</s></Sm>
                  <Sm title="Indice (Ctrl+,) : H₂O" on={s.subscript} onClick={() => c().unsetSuperscript().toggleSubscript().run()}><span className="ce-glyph">x<sub>2</sub></span></Sm>
                  <Sm title="Exposant (Ctrl+.) : m²" on={s.superscript} onClick={() => c().unsetSubscript().toggleSuperscript().run()}><span className="ce-glyph">x<sup>2</sup></span></Sm>
                  <span className="ce-sep" />
                  {TEXT_COLORS.map((t) => (
                    <button
                      key={t.c}
                      type="button"
                      className={`ce-swatch ${s.color.toLowerCase() === t.c.toLowerCase() || (!s.color && t.c === '#111827') ? 'is-on' : ''}`}
                      style={{ background: t.c }}
                      title={`Couleur du texte : ${t.n}`}
                      aria-label={`Couleur du texte : ${t.n}`}
                      onClick={() => (t.c === '#111827' ? c().unsetColor().run() : c().setColor(t.c).run())}
                    />
                  ))}
                  <label className="ce-colorpick" title="Autre couleur de texte…">
                    <span className="ce-colorpick__wheel" />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#111827'} onChange={(e) => c().setColor(e.target.value).run()} aria-label="Autre couleur de texte" />
                  </label>
                </div>
                <div className="ce-row">
                  <span className="ce-minilabel"><Icon name="marker" size={15} /> Surligner</span>
                  {HIGHLIGHTS.map((h) => (
                    <button
                      key={h.c}
                      type="button"
                      className={`ce-swatch ${editor.isActive('highlight', { color: h.c }) ? 'is-on' : ''}`}
                      style={{ background: h.c }}
                      title={`Surligner en ${h.n.toLowerCase()}`}
                      aria-label={`Surligner en ${h.n.toLowerCase()}`}
                      onClick={() => c().toggleHighlight({ color: h.c }).run()}
                    />
                  ))}
                  <label className="ce-colorpick" title="Autre couleur de surlignage…">
                    <span className="ce-colorpick__wheel" />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.highlight) ? s.highlight : '#fef08a'} onChange={(e) => c().setHighlight({ color: e.target.value }).run()} aria-label="Autre couleur de surlignage" />
                  </label>
                  <Sm title="Retirer le surlignage" onClick={() => c().unsetHighlight().run()}><span className="ce-glyph ce-glyph--sm">Aucun</span></Sm>
                </div>
              </div>
            </Group>

            <Group label="Paragraphe">
              <div className="ce-stack">
                <div className="ce-row">
                  <Sm icon="ul" title="Liste à puces" on={s.bullet} onClick={() => c().toggleBulletList().run()} />
                  <Sm icon="ol" title="Liste numérotée" on={s.ordered} onClick={() => c().toggleOrderedList().run()} />
                  <Sm icon="checklist" title="Liste à cases à cocher" on={s.tasks} onClick={() => c().toggleTaskList().run()} />
                  <Sm icon="outdent" title="Diminuer le retrait (Maj+Tab dans une liste, Ctrl+Maj+M ailleurs)" onClick={() => indent(-1)} />
                  <Sm icon="indent" title="Augmenter le retrait (Tab dans une liste, Ctrl+M ailleurs)" onClick={() => indent(1)} />
                  <Sm icon="firstLine" title="Alinéa : retrait de la première ligne" on={s.firstLine} onClick={() => c().toggleFirstLine().run()} />
                </div>
                <div className="ce-row">
                  <Sm icon="left" title="Aligner à gauche (Ctrl+Maj+L)" on={s.alignLeft} onClick={() => c().setTextAlign('left').run()} />
                  <Sm icon="center" title="Centrer (Ctrl+Maj+E)" on={s.alignCenter} onClick={() => c().setTextAlign('center').run()} />
                  <Sm icon="right" title="Aligner à droite (Ctrl+Maj+R)" on={s.alignRight} onClick={() => c().setTextAlign('right').run()} />
                  <Sm icon="justify" title="Justifier (Ctrl+Maj+J)" on={s.alignJustify} onClick={() => c().setTextAlign('justify').run()} />
                  <select className="ce-select" value={s.lineHeight} onChange={(e) => c().setLineHeight(e.target.value || null).run()} title="Interligne" aria-label="Interligne">
                    {LINE_HEIGHTS.map((l) => <option key={l.label} value={l.value ?? ''}>{l.value ? `↕ ${l.label}` : '↕ Interligne'}</option>)}
                  </select>
                </div>
                <div className="ce-row">
                  <select className="ce-select" value={s.spaceBefore ?? ''} onChange={(e) => c().setSpaceBefore(e.target.value === '' ? null : Number(e.target.value)).run()} title="Espace avant le paragraphe" aria-label="Espace avant le paragraphe">
                    {SPACE_BEFORE.map((o) => <option key={o.label} value={o.value ?? ''}>{o.value === null ? 'Espace avant' : `Avant : ${o.label.toLowerCase()}`}</option>)}
                  </select>
                  <select className="ce-select" value={s.spaceAfter ?? ''} onChange={(e) => c().setSpaceAfter(e.target.value === '' ? null : Number(e.target.value)).run()} title="Espace après le paragraphe" aria-label="Espace après le paragraphe">
                    {SPACE_AFTER.map((o) => <option key={o.label} value={o.value ?? ''}>{o.value === null ? 'Espace après' : `Après : ${o.label.toLowerCase()}`}</option>)}
                  </select>
                  {s.ordered && (
                    <select className="ce-select" value={s.listType} onChange={(e) => c().updateAttributes('orderedList', { type: e.target.value || null }).run()} title="Type de numéros de la liste" aria-label="Type de numéros de la liste">
                      {LIST_TYPES.map((t) => <option key={t.label} value={t.value ?? ''}>{t.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </Group>

            <Group label="Styles">
              <div className="ce-styles">
                <button type="button" className={`ce-style ${s.paragraph && !s.h1 && !s.h2 && !s.h3 ? 'is-on' : ''}`} onClick={() => c().setParagraph().run()} title="Texte du cours (Ctrl+Alt+0)">
                  <span className="ce-style__p">Texte du cours</span><small>Normal</small>
                </button>
                <button type="button" className={`ce-style ${s.h1 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 1 }).run()} title="Titre 1 (Ctrl+Alt+1)">
                  <span className="ce-style__h1">Chapitre</span><small>Titre 1</small>
                </button>
                <button type="button" className={`ce-style ${s.h2 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Titre 2 (Ctrl+Alt+2)">
                  <span className="ce-style__h2">1. Partie</span><small>Titre 2</small>
                </button>
                <button type="button" className={`ce-style ${s.h3 ? 'is-on' : ''}`} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Titre 3 (Ctrl+Alt+3)">
                  <span className="ce-style__h3">a. Sous-partie</span><small>Titre 3</small>
                </button>
                {(Object.keys(CALLOUT_LABELS) as CalloutKind[]).filter((k) => k !== 'libre').map((k) => (
                  <button key={k} type="button" className={`ce-style ${s.callout === k ? 'is-on' : ''}`} onClick={() => c().toggleCallout(k).run()} title={`Encadré « ${CALLOUT_LABELS[k]} » (cliquer à nouveau pour le retirer)`}>
                    <span className={`ce-style__box ce-style__box--${k}`}>{CALLOUT_LABELS[k]}</span><small>Encadré</small>
                  </button>
                ))}
              </div>
            </Group>
          </>
        )}

        {tab === 'insertion' && (
          <>
            <Group label="Illustrations">
              <Big icon="image" label="Image" title="Image depuis l'ordinateur (ou collez / glissez une image dans le cours)" onClick={onInsertImage} />
              <span ref={tableBtnRef} style={{ display: 'contents' }}>
                <Big icon="table" label="Tableau" title="Tableau : choisir le nombre de lignes et de colonnes" on={!!tableGrid} onClick={toggleTableGrid} />
              </span>
            </Group>
            <Group label="Spécial cours">
              <Big icon="encart" label="Encart tableau" title="Bloc 16:9 de la largeur du texte : exactement un écran en classe. Double-clic pour y dessiner." onClick={() => c().insertEncart().run()} />
              <Big icon="zone" label="Zone d'écriture" title="Lignes Seyès, carreaux ou blanc : imprimées vides pour l'élève, on y écrit au stylet en classe" onClick={() => c().insertWritingZone().run()} />
            </Group>
            <Group label="Fiche et évaluation">
              <span ref={blocksBtnRef} style={{ display: 'contents' }}>
                <Big icon="blocks" label="Blocs" title="Cartouche d'évaluation, question avec barème, QCM, vrai ou faux, tableau de compétences, encadré libre" on={!!blocks} onClick={toggleBlocks} />
              </span>
              <Big icon="dots" label="Pointillés" title="Pointillés de réponse jusqu'au bord de la ligne (longueur réglable ensuite)" onClick={() => c().insertDots().run()} />
              <Big icon="points" label="Barème" title="Points de la question (« / 2 »), calés à droite ; le total se calcule tout seul" onClick={() => c().insertPoints(1).run()} />
              <Big icon="qr" label="QR code" title="QR code vers une adresse (vidéo, exercice en ligne…)" onClick={onInsertQr} />
            </Group>
            <Group label="Texte">
              <Big icon="link" label="Lien" title="Lien vers une page web ou une adresse e-mail (Ctrl+K)" on={s.link} onClick={onInsertLink} />
              <span ref={symbolBtnRef} style={{ display: 'contents' }}>
                <Big icon="sigma" label="Symbole" title="Flèches, signes mathématiques, lettres grecques, majuscules accentuées…" on={!!symbols} onClick={toggleSymbols} />
              </span>
              <Big icon="hr" label="Trait" title="Trait de séparation" onClick={() => c().setHorizontalRule().run()} />
            </Group>
            <Group label="Pages">
              <Big icon="pagebreak" label="Saut de page" title="Saut de page (Ctrl+Entrée) : seulement sur papier" onClick={() => c().setPageBreak().run()} />
            </Group>
          </>
        )}

        {tab === 'miseenpage' && (
          <>
            <Group label="Titres">
              <div className="ce-stack">
                <span className="ce-minilabel">Numéroter les titres</span>
                <select className="ce-select ce-select--wide" value={settings.numbering ?? 'none'} onChange={(e) => onSettings({ numbering: e.target.value as HeadingNumbering })} title="Numérotation automatique des Titres 2 et 3 (le Titre 1 est le titre du cours)" aria-label="Numérotation des titres">
                  {(Object.keys(HEADING_NUMBERING_LABELS) as HeadingNumbering[]).map((k) => <option key={k} value={k}>{HEADING_NUMBERING_LABELS[k]}</option>)}
                </select>
              </div>
            </Group>
            <Group label="Texte">
              <Big icon="hyphen" label="Couper les mots" title="Coupure des mots en fin de ligne (utile avec le texte justifié)" on={!!settings.hyphens} onClick={() => onSettings({ hyphens: !settings.hyphens })} />
            </Group>
            <Group label="Pages">
              <Big icon="pagebreak" label="Saut de page" title="Saut de page (Ctrl+Entrée)" onClick={() => c().setPageBreak().run()} />
            </Group>
          </>
        )}

        {tab === 'affichage' && (
          <>
            <Group label="Mode">
              <Big icon="doc" label="Texte" on onClick={() => undefined} />
              <Big icon="board" label="Tableau" title="Bientôt : dessiner par-dessus le cours" onClick={() => onSoon('Le mode Tableau arrive à l’étape 3.')} />
              <Big icon="play" label="En classe" title="Bientôt : le cours projeté en classe" onClick={() => onSoon('Le mode En classe arrive à l’étape 4.')} />
            </Group>
            <Group label="Zoom">
              <Big icon="zoomin" label={`${Math.round(zoom * 100)} %`} title="Revenir à 100 %" onClick={() => onZoom(1)} />
              <Big icon="fitwidth" label="Largeur de page" onClick={onFitWidth} />
            </Group>
            <Group label="Repères">
              <Big icon="ruler" label="Règle" on={showRuler} onClick={onToggleRuler} />
            </Group>
          </>
        )}

        {tab === 'tableau' && (
          <>
            <Group label="Lignes · Colonnes">
              <div className="ce-stack">
                <Sm icon="rowAbove" label="Au-dessus" title="Insérer une ligne au-dessus" onClick={() => c().addRowBefore().run()} />
                <Sm icon="rowBelow" label="En dessous" title="Insérer une ligne en dessous" onClick={() => c().addRowAfter().run()} />
                <Sm icon="delRow" label="Supprimer" title="Supprimer la ligne" onClick={() => c().deleteRow().run()} />
              </div>
              <div className="ce-stack">
                <Sm icon="colLeft" label="À gauche" title="Insérer une colonne à gauche" onClick={() => c().addColumnBefore().run()} />
                <Sm icon="colRight" label="À droite" title="Insérer une colonne à droite" onClick={() => c().addColumnAfter().run()} />
                <Sm icon="delCol" label="Supprimer" title="Supprimer la colonne" onClick={() => c().deleteColumn().run()} />
              </div>
            </Group>
            <Group label="Style">
              {TABLE_STYLES.map((st) => (
                <button key={st.id} type="button" className={`ce-tstyle ${s.tableStyle === st.id ? 'is-on' : ''}`} title={st.hint} onClick={() => c().updateAttributes('table', { tableStyle: st.id }).run()}>
                  <span className={`ce-tstyle__swatch ce-tstyle__swatch--${st.id}`}><i /><i /><i /><i /><i /><i /></span>
                  <small>{st.label}</small>
                </button>
              ))}
            </Group>
            <Group label="Cellules">
              <div className="ce-stack">
                <div className="ce-row">
                  <span className="ce-minilabel">Fond</span>
                  {CELL_COLORS.map((col) => (
                    <button key={col.c} type="button" className={`ce-swatch ${s.cellBg.toLowerCase() === col.c.toLowerCase() ? 'is-on' : ''}`} style={{ background: col.c }} title={`Fond ${col.n.toLowerCase()}`} aria-label={`Fond ${col.n.toLowerCase()}`} onClick={() => c().setCellAttribute('backgroundColor', col.c).run()} />
                  ))}
                  <label className="ce-colorpick" title="Autre couleur de fond…">
                    <span className="ce-colorpick__wheel" />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.cellBg) ? s.cellBg : '#f1f5f9'} onChange={(e) => c().setCellAttribute('backgroundColor', e.target.value).run()} aria-label="Autre couleur de fond" />
                  </label>
                  <Sm title="Sans fond" onClick={() => c().setCellAttribute('backgroundColor', null).run()}><span className="ce-glyph ce-glyph--sm">Aucun</span></Sm>
                </div>
                <div className="ce-row">
                  <span className="ce-minilabel">Texte</span>
                  <Sm icon="vTop" title="Texte en haut de la cellule" on={s.cellVAlign === 'top'} onClick={() => c().setCellAttribute('verticalAlign', null).run()} />
                  <Sm icon="vMiddle" title="Texte au milieu de la cellule" on={s.cellVAlign === 'middle'} onClick={() => c().setCellAttribute('verticalAlign', 'middle').run()} />
                  <Sm icon="vBottom" title="Texte en bas de la cellule" on={s.cellVAlign === 'bottom'} onClick={() => c().setCellAttribute('verticalAlign', 'bottom').run()} />
                  <span className="ce-sep" />
                  <Sm icon="merge" label="Fusionner" title="Fusionner les cellules sélectionnées, ou scinder une cellule fusionnée" onClick={() => c().mergeOrSplit().run()} />
                </div>
                <div className="ce-row">
                  <span className="ce-minilabel">Hauteur</span>
                  <select className="ce-select" value={s.rowHeight ?? ''} onChange={(e) => c().setRowHeight(e.target.value ? Number(e.target.value) : null).run()} title="Hauteur des lignes sélectionnées" aria-label="Hauteur des lignes">
                    {ROW_HEIGHTS.map((h) => <option key={h.label} value={h.value ?? ''}>{h.label}</option>)}
                  </select>
                </div>
              </div>
            </Group>
            <Group label="En-têtes">
              <div className="ce-stack">
                <Sm icon="header" label="Ligne d'en-tête" title="La première ligne devient une ligne de titres" onClick={() => c().toggleHeaderRow().run()} />
                <Sm icon="headerCol" label="Colonne d'en-tête" title="La première colonne devient une colonne de titres" onClick={() => c().toggleHeaderColumn().run()} />
              </div>
            </Group>
            <Group label="Taille et position">
              <div className="ce-stack">
                <div className="ce-row">
                  <span className="ce-minilabel">Largeur</span>
                  {[100, 75, 50].map((p) => <Sm key={p} label={`${p} %`} title={`Tableau sur ${p} % de la largeur du texte`} onClick={() => c().setTableWidth(p).run()} />)}
                </div>
                <div className="ce-row">
                  <Sm icon="alignImgLeft" title="Tableau à gauche" on={s.tableAlign === 'left'} onClick={() => c().updateAttributes('table', { tableAlign: 'left' }).run()} />
                  <Sm icon="alignImgCenter" title="Tableau centré" on={s.tableAlign === 'center'} onClick={() => c().updateAttributes('table', { tableAlign: 'center' }).run()} />
                  <Sm icon="alignImgRight" title="Tableau à droite" on={s.tableAlign === 'right'} onClick={() => c().updateAttributes('table', { tableAlign: 'right' }).run()} />
                </div>
                <Sm icon="equalCols" label="Colonnes égales" title="Même largeur pour toutes les colonnes" onClick={() => c().equalizeColumns().run()} />
              </div>
            </Group>
            <Group label="Tableau">
              <Big icon="trash" label="Supprimer" title="Supprimer le tableau" onClick={() => c().deleteTable().run()} />
            </Group>
          </>
        )}

        {pasteMenu && (
          <div ref={pasteMenuRef} className="ce-menu ce-menu--small" style={{ left: pasteMenu.left, top: pasteMenu.top }} role="menu" onMouseDown={(e) => e.preventDefault()}>
            {([
              ['adapt', 'Adapter au cours', 'Garde titres, listes, tableaux, gras et couleurs ; prend la police du cours (Ctrl+V)'],
              ['keep', 'Garder la mise en forme', 'Garde aussi la police et la taille d’origine'],
              ['text', 'Texte seul', 'Sans aucune mise en forme (Ctrl+Maj+V)'],
            ] as const).map(([mode, label, hint]) => (
              <button key={mode} type="button" role="menuitem" className="ce-menu__item" onClick={() => { setPasteMenu(null); onPaste(mode); }}>
                <span><strong>{label}</strong><small>{hint}</small></span>
              </button>
            ))}
          </div>
        )}

        {tableGrid && (
          <CourseTableGrid left={tableGrid.left} top={tableGrid.top} onPick={(rows, cols) => c().insertTable({ rows, cols, withHeaderRow: rows > 1 }).run()} onClose={() => setTableGrid(null)} />
        )}

        {blocks && (
          <CourseBlocksMenu left={blocks.left} top={blocks.top} onPick={(b) => c().insertContent(b.build()).run()} onClose={() => setBlocks(null)} />
        )}

        {tab === 'encadre' && (
          <>
            <Group label="Type">
              {(Object.keys(CALLOUT_LABELS) as CalloutKind[]).map((k) => (
                <button key={k} type="button" className={`ce-style ${s.callout === k ? 'is-on' : ''}`} onClick={() => c().updateAttributes('callout', { kind: k, title: null }).run()} title={k === 'libre' ? 'Encadré libre : titre et couleur au choix' : `Encadré « ${CALLOUT_LABELS[k]} »`}>
                  <span className={`ce-style__box ce-style__box--${k}`}>{k === 'libre' ? 'Libre' : CALLOUT_LABELS[k]}</span><small>Encadré</small>
                </button>
              ))}
            </Group>
            <Group label="Titre">
              <div className="ce-stack">
                <input
                  className="ce-input"
                  value={s.calloutTitle ?? (s.callout ? CALLOUT_LABELS[s.callout] : '')}
                  onChange={(e) => editor.chain().updateAttributes('callout', { title: e.target.value }).run()}
                  placeholder="Sans titre"
                  aria-label="Titre de l'encadré"
                />
                <Sm title="Reprendre le titre du type" disabled={s.calloutTitle === null} onClick={() => c().updateAttributes('callout', { title: null }).run()}><span className="ce-glyph ce-glyph--sm">Titre par défaut</span></Sm>
              </div>
            </Group>
            <Group label="Couleur (encadré libre)">
              <div className="ce-stack">
                <div className="ce-row">
                  {CALLOUT_COLORS.map((col) => (
                    <button key={col} type="button" className={`ce-swatch ${s.callout === 'libre' && s.calloutColor.toLowerCase() === col.toLowerCase() ? 'is-on' : ''}`} style={{ background: col }} title={`Couleur ${col}`} aria-label={`Couleur ${col}`} onClick={() => c().updateAttributes('callout', { kind: 'libre', color: col }).run()} />
                  ))}
                  <label className="ce-colorpick" title="Autre couleur…">
                    <span className="ce-colorpick__wheel" />
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.calloutColor) ? s.calloutColor : '#0ea5e9'} onChange={(e) => c().updateAttributes('callout', { kind: 'libre', color: e.target.value }).run()} aria-label="Autre couleur d'encadré" />
                  </label>
                </div>
              </div>
            </Group>
            <Group label="Encadré">
              <Big icon="clear" label="Retirer l'encadré" title="Le texte reste, l'encadré disparaît" onClick={() => c().lift('callout').run()} />
            </Group>
          </>
        )}

        {tab === 'dots' && (
          <>
            <Group label="Longueur">
              <Big icon="dots" label="Jusqu'au bord" on={s.dotsCm === null} onClick={() => updateNode('dots', { cm: null })} />
              <div className="ce-stack">
                <div className="ce-row ce-lines">
                  <Sm title="Plus court" onClick={() => updateNode('dots', { cm: Math.max(0.5, (s.dotsCm ?? 4) - 0.5) })}><span className="ce-glyph">−</span></Sm>
                  <span className="ce-lines__n">{s.dotsCm === null ? 'ligne' : `${String(s.dotsCm).replace('.', ',')} cm`}</span>
                  <Sm title="Plus long" onClick={() => updateNode('dots', { cm: Math.min(16, (s.dotsCm ?? 4) + 0.5) })}><span className="ce-glyph">+</span></Sm>
                </div>
                <div className="ce-row">
                  {[2, 4, 6, 8].map((n) => <Sm key={n} label={`${n} cm`} title={`${n} cm`} on={s.dotsCm === n} onClick={() => updateNode('dots', { cm: n })} />)}
                </div>
              </div>
            </Group>
            <Group label="Supprimer">
              <Big icon="trash" label="Supprimer" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}

        {tab === 'points' && (
          <>
            <Group label="Points de la question">
              <div className="ce-stack">
                <div className="ce-row ce-lines">
                  <Sm title="Un demi-point de moins" onClick={() => updateNode('points', { value: Math.max(0, s.pointsValue - 0.5) })}><span className="ce-glyph">−</span></Sm>
                  <span className="ce-lines__n">/ {formatPoints(s.pointsValue)}</span>
                  <Sm title="Un demi-point de plus" onClick={() => updateNode('points', { value: s.pointsValue + 0.5 })}><span className="ce-glyph">+</span></Sm>
                </div>
                <div className="ce-row">
                  {[1, 2, 3, 4, 5].map((n) => <Sm key={n} label={String(n)} title={`${n} point${n > 1 ? 's' : ''}`} on={s.pointsValue === n} onClick={() => updateNode('points', { value: n })} />)}
                </div>
              </div>
            </Group>
            <Group label="Total">
              <Big icon="sigma" label="Insérer le total" title="Insère le total du barème à côté (il se recalcule tout seul)" onClick={() => c().setTextSelection(editor.state.selection.to).insertPointsTotal().run()} />
            </Group>
            <Group label="Supprimer">
              <Big icon="trash" label="Supprimer" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}

        {symbols && (
          <CourseSymbolPicker left={symbols.left} top={symbols.top} onInsert={(ch) => c().insertContent(ch).run()} onClose={() => setSymbols(null)} />
        )}

        {tab === 'encart' && (
          <>
            <Group label="Encart">
              <Big icon="board" label="Modifier l'encart" title="Ouvrir dans le tableau blanc (ou double-clic sur l'encart)" onClick={() => { if (s.encartPageId) onEditEncart(s.encartPageId); }} />
            </Group>
            <Group label="Impression">
              <Big icon="print" label="Imprimé rempli" title="L'encart s'imprime avec son contenu" on={s.encartPrint !== 'blank'} onClick={() => updateNode('encart', { print: 'filled' })} />
              <Big icon="zone" label="Imprimé vide" title="L'encart s'imprime comme un cadre vide que l'élève complète" on={s.encartPrint === 'blank'} onClick={() => updateNode('encart', { print: 'blank' })} />
            </Group>
            <Group label="Supprimer">
              <Big icon="trash" label="Supprimer l'encart" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}

        {tab === 'zone' && (
          <>
            <Group label="Type de lignes">
              {(Object.keys(WRITING_ZONE_LABELS) as WritingZoneStyle[]).map((st) => (
                <button key={st} type="button" className={`ce-zonepick ${s.zoneStyle === st ? 'is-on' : ''}`} title={WRITING_ZONE_LABELS[st]} onClick={() => updateNode('writingZone', { style: st })}>
                  <span className={`ce-zonepick__swatch ce-zone--${st}`} />
                  <span>{WRITING_ZONE_LABELS[st]}</span>
                </button>
              ))}
            </Group>
            <Group label="Hauteur">
              <div className="ce-stack">
                <div className="ce-row ce-lines">
                  <Sm title="Une ligne de moins" onClick={() => updateNode('writingZone', { lines: Math.max(1, s.zoneLines - 1) })}><span className="ce-glyph">−</span></Sm>
                  <span className="ce-lines__n">{s.zoneLines} ligne{s.zoneLines > 1 ? 's' : ''}</span>
                  <Sm title="Une ligne de plus" onClick={() => updateNode('writingZone', { lines: Math.min(40, s.zoneLines + 1) })}><span className="ce-glyph">+</span></Sm>
                </div>
                <div className="ce-row">
                  {[3, 6, 10, 15].map((n) => <Sm key={n} label={String(n)} title={`${n} lignes`} on={s.zoneLines === n} onClick={() => updateNode('writingZone', { lines: n })} />)}
                </div>
              </div>
            </Group>
            <Group label="Supprimer">
              <Big icon="trash" label="Supprimer la zone" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}

        {tab === 'image' && (
          <>
            <Group label="Position">
              <Big icon="alignImgLeft" label="À gauche" on={s.imageAlign === 'left'} onClick={() => updateNode('image', { align: 'left' })} />
              <Big icon="alignImgCenter" label="Centrée" on={s.imageAlign === 'center'} onClick={() => updateNode('image', { align: 'center' })} />
              <Big icon="alignImgRight" label="À droite" on={s.imageAlign === 'right'} onClick={() => updateNode('image', { align: 'right' })} />
            </Group>
            <Group label="Taille">
              <div className="ce-stack">
                {[25, 50, 75, 100].map((p) => (
                  <Sm key={p} label={`${p} % de la largeur`} title={`${p} % de la largeur du texte`} onClick={() => updateNode('image', { width: Math.round((COL_W * p) / 100) })} />
                ))}
              </div>
            </Group>
            <Group label="Image">
              <Big icon="trash" label="Supprimer l'image" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
