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
import { CourseIconPicker } from './CourseIconPicker';
import { LINE_HEIGHTS, SPACE_AFTER, SPACE_BEFORE } from './courseParagraph';
import { CAPTION_LABELS, HEADING_NUMBERING_LABELS, type CaptionLabel, type CourseSettings, type HeadingNumbering } from '../../lib/course/courseDoc';
import { COLUMNS_LAYOUTS, findColumns, type ColumnsLayout } from './courseColumns';
import { PAGE_NUMBER_PRESETS, footerOf, pageNumberPreset } from './courseHeaderFooter';
import { COURSE_THEMES, defaultThemeId, setDefaultThemeId, themeById, type CourseThemeId } from './courseThemes';
import { DRAW_COLORS, type DrawStyle, type DrawTool } from './courseDraw';
import { IMAGE_CAPTION_EVENT, IMAGE_CROP_EVENT, IMAGE_FRAMES, flipCrop, rotateCrop, type ImageCrop, type ImageFrame } from './courseImageTypes';

export type RibbonTab = 'fichier' | 'accueil' | 'insertion' | 'miseenpage' | 'revision' | 'affichage' | 'dessin' | 'tableau' | 'encadre' | 'image' | 'encart' | 'zone' | 'dots' | 'points' | 'colonnes';

interface Props {
  editor: Editor;
  onPrint: () => void;
  onExportPdf: () => void;
  onRename: () => void;
  onInsertImage: () => void;
  onInsertQr: () => void;
  /** Banque d'images libres (Wikimedia Commons, lot T16b). */
  onSearchImage: () => void;
  onInsertLink: () => void;
  onPaste: (mode: 'adapt' | 'keep' | 'text') => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFitWidth: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  onEditEncart: (pageId: string) => void;
  settings: CourseSettings;
  onSettings: (patch: Partial<CourseSettings>) => void;
  onHistory: () => void;
  historyOpen: boolean;
  onSaveVersion: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  onFind: () => void;
  onReplace: () => void;
  onFitPage: () => void;
  showOutline: boolean;
  onToggleOutline: () => void;
  showInvisibles: boolean;
  onToggleInvisibles: () => void;
  /** Remplacer le fichier de l'image sélectionnée (lot T8). */
  onReplaceImage: () => void;
  /** Fenêtre « En-tête et pied de page » (lot T9). */
  onHeaderFooter: () => void;
  /** Importer un fichier Word ou PDF dans le cours (lot T10a). */
  onImportFile: () => void;
  /** Orthographe et grammaire (lot T11). */
  spell: { active: boolean; live: boolean; checking: boolean; count: number };
  onSpellCheck: () => void;
  onSpellNext: () => void;
  onSpellLive: () => void;
  onSpellHide: () => void;
  /** Mode Tableau (lot 3) : calque d'annotations. */
  mode: 'texte' | 'tableau';
  onMode: (m: 'texte' | 'tableau') => void;
  /** Mode En classe (lot 4). */
  onPresent: () => void;
  drawStyle: DrawStyle;
  onDrawStyle: (patch: Partial<DrawStyle>) => void;
  layerCanUndo: boolean;
  layerCanRedo: boolean;
  onLayerUndo: () => void;
  onLayerRedo: () => void;
  layerHasSelection: boolean;
  layerCount: number;
  onLayerDelete: () => void;
  onLayerClear: () => void;
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

/** « Pour les nouveaux cours » : le thème affiché devient celui des cours créés sur cet ordinateur. */
function ThemeDefaultButton({ current }: { current: CourseThemeId }) {
  const [def, setDef] = useState<CourseThemeId>(() => defaultThemeId() ?? 'classique');
  const isDefault = def === current;
  return (
    <Sm
      icon="template"
      label={isDefault ? 'Thème par défaut' : 'Par défaut'}
      title={isDefault ? 'C’est le thème des nouveaux cours sur cet ordinateur' : 'Utiliser ce thème pour les nouveaux cours (sur cet ordinateur)'}
      on={isDefault}
      onClick={() => { setDefaultThemeId(current); setDef(current); }}
    />
  );
}

/** Texte de remplacement de l'image (lu par les lecteurs d'écran), enregistré en quittant le champ. */
function AltField({ editor, value }: { editor: Editor; value: string }) {
  const [v, setV] = useState(value);
  const commit = () => {
    if (v === value) return;
    const pos = editor.state.selection.from;
    editor.chain().updateAttributes('image', { alt: v.trim() || null }).setNodeSelection(pos).run();
  };
  return (
    <input
      className="ce-input ce-input--alt"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      placeholder="Texte de remplacement"
      title="Décrit l'image pour un élève qui utilise un lecteur d'écran"
      aria-label="Texte de remplacement de l'image"
    />
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

export function CourseRibbon({ editor, onPrint, onExportPdf, onRename, onInsertImage, onInsertQr, onSearchImage, onInsertLink, onPaste, zoom, onZoom, onFitWidth, showRuler, onToggleRuler, onEditEncart, settings, onSettings, onHistory, historyOpen, onSaveVersion, onDuplicate, onSaveTemplate, onFind, onReplace, onFitPage, showOutline, onToggleOutline, showInvisibles, onToggleInvisibles, onReplaceImage, onHeaderFooter, onImportFile, spell, onSpellCheck, onSpellNext, onSpellLive, onSpellHide, mode, onMode, onPresent, drawStyle, onDrawStyle, layerCanUndo, layerCanRedo, onLayerUndo, onLayerRedo, layerHasSelection, layerCount, onLayerDelete, onLayerClear }: Props) {
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
        image: e.getAttributes('image') as { caption?: string | null; frame?: ImageFrame; alt?: string | null; rotate?: number; flip?: boolean; crop?: ImageCrop | null },
        inColumns: !!findColumns(e.state),
        columnsLayout: ((findColumns(e.state)?.node.attrs.layout as ColumnsLayout | undefined) ?? '1-1'),
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
  const ctx: RibbonTab | null = mode === 'tableau' ? 'dessin' : s.onImage ? 'image' : s.onEncart ? 'encart' : s.onZone ? 'zone' : s.onDots ? 'dots' : s.onPoints ? 'points' : null;
  if (view.ctx !== ctx) {
    const back: RibbonTab = view.ctx === 'image' ? 'accueil' : 'insertion';
    setView({ tab: ctx ?? (view.tab === view.ctx ? back : view.tab), ctx });
  }
  const tab: RibbonTab = (view.tab === 'tableau' && !s.inTable) || (view.tab === 'encadre' && !s.callout) || (view.tab === 'colonnes' && !s.inColumns) ? 'accueil' : view.tab;
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
  // Fenêtre des icônes (lot T16a), ancrée sous son bouton
  const iconBtnRef = useRef<HTMLSpanElement>(null);
  const [iconPick, setIconPick] = useState<{ left: number; top: number } | null>(null);
  const toggleIcons = () => {
    if (iconPick) { setIconPick(null); return; }
    const r = iconBtnRef.current?.querySelector('button')?.getBoundingClientRect();
    setIconPick({ left: r?.left ?? 200, top: (r?.bottom ?? 170) + 6 });
  };
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
    { id: 'revision', label: 'Révision' },
    { id: 'affichage', label: 'Affichage' },
    ...(mode === 'tableau' ? [{ id: 'dessin' as const, label: 'Dessin', contextual: true }] : []),
    ...(s.inTable ? [{ id: 'tableau' as const, label: 'Tableau', contextual: true }] : []),
    ...(s.inColumns ? [{ id: 'colonnes' as const, label: 'Colonnes', contextual: true }] : []),
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
            <Group label="Importer">
              <Big icon="openFile" label="Word ou PDF…" title="Insérer un fichier Word (.docx) ou les pages d'un PDF à l'endroit du curseur (ou déposez le fichier sur la feuille)" onClick={onImportFile} />
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

            <Group label="Modification">
              <div className="ce-stack">
                <Sm icon="search" label="Rechercher" title="Rechercher (Ctrl+F)" onClick={onFind} />
                <Sm icon="replace" label="Remplacer" title="Remplacer (Ctrl+H)" onClick={onReplace} />
              </div>
            </Group>
          </>
        )}

        {tab === 'insertion' && (
          <>
            <Group label="Illustrations">
              <Big icon="image" label="Image" title="Image depuis l'ordinateur (ou collez / glissez une image dans le cours)" onClick={onInsertImage} />
              <Big icon="imageSearch" label="Banque d'images" title="Photos et schémas libres (Wikimedia Commons) ; l'auteur et la licence s'écrivent sous l'image" onClick={onSearchImage} />
              <span ref={tableBtnRef} style={{ display: 'contents' }}>
                <Big icon="table" label="Tableau" title="Tableau : choisir le nombre de lignes et de colonnes" on={!!tableGrid} onClick={toggleTableGrid} />
              </span>
            </Group>
            <Group label="Colonnes">
              <div className="ce-stack">
                <Sm icon="cols2" label="2 colonnes" title="Deux colonnes côte à côte (le bloc reste sur une seule page)" onClick={() => c().insertColumns('1-1').run()} />
                <Sm icon="cols3" label="3 colonnes" title="Trois colonnes côte à côte" onClick={() => c().insertColumns('1-1-1').run()} />
                <Sm icon="cols12" label="Image + texte" title="Une colonne étroite à gauche (image), le texte à droite. Une image sélectionnée y est placée." onClick={() => c().insertColumns('1-2').run()} />
              </div>
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
              <span ref={iconBtnRef} style={{ display: 'contents' }}>
                <Big icon="star" label="Icône" title="Petite image dans la ligne : microscope, volcan, attention… (taille et couleur du texte)" on={!!iconPick} onClick={toggleIcons} />
              </span>
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
            <Group label="Thème">
              <div className="ce-themes" role="radiogroup" aria-label="Thème du cours">
                {COURSE_THEMES.map((t) => {
                  const on = themeById(settings.theme).id === t.id;
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={on} className={`ce-theme ${on ? 'is-on' : ''}`} title={t.hint}
                      onClick={() => onSettings({ theme: t.id === 'classique' ? undefined : t.id })}>
                      <span className="ce-theme__sw" aria-hidden>
                        <i style={{ background: t.h1 }} /><i style={{ background: t.def.line }} /><i style={{ background: t.ret.line }} /><i style={{ background: t.ex.line }} />
                      </span>
                      <span className="ce-theme__name" style={t.headFont ? { fontFamily: t.headFont, fontSize: 11 } : undefined}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <ThemeDefaultButton current={themeById(settings.theme).id} />
            </Group>
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
            <Group label="En-tête et pied">
              <Big icon="headerFooter" label="En-tête et pied" title="Texte en haut et en bas de chaque page : titre, classe, date, numéro… (ou double-clic dans la marge)" onClick={onHeaderFooter} />
              <div className="ce-stack">
                <span className="ce-minilabel">Numéro de page</span>
                <select
                  className="ce-select"
                  value={pageNumberPreset(settings) ?? 'custom'}
                  onChange={(e) => {
                    const preset = PAGE_NUMBER_PRESETS.find((p) => p.id === e.target.value);
                    if (preset) onSettings({ footer: { ...footerOf(settings), center: preset.text } });
                  }}
                  title="Numéro au centre du pied de page"
                  aria-label="Numéro de page"
                >
                  {PAGE_NUMBER_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  {pageNumberPreset(settings) === null && <option value="custom" disabled>Personnalisé</option>}
                </select>
              </div>
            </Group>
            <Group label="Pages">
              <Big icon="pagebreak" label="Saut de page" title="Saut de page (Ctrl+Entrée)" onClick={() => c().setPageBreak().run()} />
            </Group>
          </>
        )}

        {tab === 'revision' && (
          <>
            <Group label="Orthographe et grammaire">
              <Big icon="spellcheck" label={spell.checking ? 'Vérification…' : 'Vérifier le cours'} title="Souligne les fautes d'orthographe, de grammaire et de typographie (service LanguageTool, seulement quand vous le demandez)" disabled={spell.checking} onClick={onSpellCheck} />
              <Big icon="spellNext" label={spell.active ? `Faute suivante${spell.count ? ` (${spell.count})` : ''}` : 'Faute suivante'} title="Aller à la faute suivante et voir les propositions" disabled={!spell.active || spell.count === 0} onClick={onSpellNext} />
              <Big icon="spellLive" label="Pendant la frappe" title="Vérifier les paragraphes modifiés 2 secondes après la dernière touche (réglage de cet ordinateur)" on={spell.live} onClick={onSpellLive} />
              <Big icon="spellHide" label="Masquer" title="Retirer les soulignements (une nouvelle vérification les remet)" disabled={!spell.active} onClick={onSpellHide} />
            </Group>
          </>
        )}

        {tab === 'dessin' && (
          <>
            <Group label="Outils">
              {([
                ['select', 'select', 'Sélection', 'Choisir, déplacer (Suppr pour retirer) ; double-clic sur un texte pour le modifier'],
                ['pen', 'pen', 'Stylo', 'Écrire ou dessiner à main levée'],
                ['highlighter', 'highlighter', 'Surligneur', 'Surligner par-dessus le texte'],
                ['eraser', 'eraser', 'Gomme', 'Effacer une annotation en passant dessus'],
              ] as [DrawTool, IconName, string, string][]).map(([t, ic, l, title]) => (
                <Big key={t} icon={ic} label={l} title={title} on={drawStyle.tool === t} onClick={() => onDrawStyle({ tool: t })} />
              ))}
            </Group>
            <Group label="Formes">
              <div className="ce-stack">
                <Sm icon="drawLine" label="Trait" title="Trait droit" on={drawStyle.tool === 'line'} onClick={() => onDrawStyle({ tool: 'line' })} />
                <Sm icon="drawArrow" label="Flèche" title="Flèche (vers un mot, un schéma…)" on={drawStyle.tool === 'arrow'} onClick={() => onDrawStyle({ tool: 'arrow' })} />
                <Sm icon="drawText" label="Texte" title="Étiquette de texte posée sur le cours" on={drawStyle.tool === 'text'} onClick={() => onDrawStyle({ tool: 'text' })} />
              </div>
              <div className="ce-stack">
                <Sm icon="drawRect" label="Rectangle" title="Encadrer" on={drawStyle.tool === 'rect'} onClick={() => onDrawStyle({ tool: 'rect' })} />
                <Sm icon="drawEllipse" label="Ellipse" title="Entourer" on={drawStyle.tool === 'ellipse'} onClick={() => onDrawStyle({ tool: 'ellipse' })} />
              </div>
            </Group>
            <Group label="Couleur · épaisseur">
              <div className="ce-stack">
                <div className="ce-row">
                  {DRAW_COLORS.map((c) => (
                    <button key={c} type="button" className={`ce-swatch ${drawStyle.color === c ? 'is-on' : ''}`} style={{ background: c }} title={c} aria-label={`Couleur ${c}`} onClick={() => onDrawStyle({ color: c })} />
                  ))}
                </div>
                <div className="ce-row">
                  {(['S', 'M', 'L'] as const).map((sz) => (
                    <Sm key={sz} title={sz === 'S' ? 'Fin' : sz === 'M' ? 'Moyen' : 'Épais'} on={drawStyle.size === sz} onClick={() => onDrawStyle({ size: sz })}>
                      <span className="ce-thick" style={{ height: sz === 'S' ? 2 : sz === 'M' ? 4 : 7 }} />
                    </Sm>
                  ))}
                </div>
              </div>
            </Group>
            <Group label="Calque">
              <div className="ce-stack">
                <Sm icon="undo" label="Annuler" title="Annuler la dernière annotation (Ctrl+Z)" disabled={!layerCanUndo} onClick={onLayerUndo} />
                <Sm icon="redo" label="Rétablir" title="Rétablir (Ctrl+Y)" disabled={!layerCanRedo} onClick={onLayerRedo} />
              </div>
              <div className="ce-stack">
                <Sm icon="trash" label="Supprimer" title="Retirer l'annotation sélectionnée (Suppr)" disabled={!layerHasSelection} onClick={onLayerDelete} />
                <Sm icon="clearPage" label="Tout effacer" title="Retirer toutes les annotations du cours" disabled={layerCount === 0} onClick={onLayerClear} />
              </div>
              <Big icon="doc" label="Retour au texte" title="Revenir à la rédaction (le calque reste visible)" onClick={() => onMode('texte')} />
            </Group>
          </>
        )}

        {tab === 'affichage' && (
          <>
            <Group label="Mode">
              <Big icon="doc" label="Texte" on={mode === 'texte'} onClick={() => onMode('texte')} />
              <Big icon="board" label="Tableau" title="Dessiner par-dessus le cours : flèches, entourages, annotations" on={mode === 'tableau'} onClick={() => onMode('tableau')} />
              <Big icon="play" label="En classe" title="Projeter le cours (bande de la largeur du texte, Suivant / Précédent)" onClick={onPresent} />
            </Group>
            <Group label="Zoom">
              <Big icon="zoomin" label={`${Math.round(zoom * 100)} %`} title="Revenir à 100 %" onClick={() => onZoom(1)} />
              <Big icon="fitwidth" label="Largeur de page" onClick={onFitWidth} />
              <Big icon="fitPage" label="Page entière" title="Voir une page entière (Ctrl+molette pour zoomer)" onClick={onFitPage} />
            </Group>
            <Group label="Repères">
              <Big icon="outline" label="Plan du cours" title="Volet des titres : un clic amène au titre" on={showOutline} onClick={onToggleOutline} />
              <Big icon="ruler" label="Règle" on={showRuler} onClick={onToggleRuler} />
              <Big icon="pilcrow" label="Marques ¶" title="Afficher les fins de paragraphe, les espaces et les retours à la ligne (non imprimés)" on={showInvisibles} onClick={onToggleInvisibles} />
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

        {iconPick && (
          <CourseIconPicker left={iconPick.left} top={iconPick.top} onInsert={(name) => c().insertIcon(name).run()} onClose={() => setIconPick(null)} />
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
            <Group label="Légende">
              <Big icon="caption" label="Légende" title="Légende sous l'image, numérotée (« Document 1 : … »)" on={s.image.caption != null}
                onClick={() => (s.image.caption != null ? updateNode('image', { caption: null }) : window.dispatchEvent(new Event(IMAGE_CAPTION_EVENT)))} />
              <div className="ce-stack">
                <span className="ce-minilabel">Numéros</span>
                <select className="ce-select" value={settings.captionLabel ?? 'document'} onChange={(e) => onSettings({ captionLabel: e.target.value as CaptionLabel })} title="Numérotation des légendes de tout le cours" aria-label="Numérotation des légendes">
                  {(Object.keys(CAPTION_LABELS) as CaptionLabel[]).map((k) => <option key={k} value={k}>{CAPTION_LABELS[k]}</option>)}
                </select>
              </div>
            </Group>
            <Group label="Retoucher">
              <Big icon="crop" label="Rogner" title="Rogner : tirer les poignées, puis Entrée (rien n'est perdu, on peut rogner à nouveau)" onClick={() => window.dispatchEvent(new Event(IMAGE_CROP_EVENT))} />
              <div className="ce-stack">
                <Sm icon="rotateLeft" label="Pivoter à gauche" title="Quart de tour à gauche" onClick={() => updateNode('image', { rotate: ((s.image.rotate ?? 0) + 270) % 360, crop: rotateCrop(s.image.crop ?? null, false) })} />
                <Sm icon="rotateRight" label="Pivoter à droite" title="Quart de tour à droite" onClick={() => updateNode('image', { rotate: ((s.image.rotate ?? 0) + 90) % 360, crop: rotateCrop(s.image.crop ?? null, true) })} />
                <Sm icon="flipH" label="Miroir" title="Retourner horizontalement" on={!!s.image.flip} onClick={() => updateNode('image', { flip: !s.image.flip, crop: flipCrop(s.image.crop ?? null) })} />
              </div>
              <Big icon="reset" label="Rétablir" title="Annuler le rognage, la rotation et le miroir" disabled={!s.image.crop && !s.image.rotate && !s.image.flip} onClick={() => updateNode('image', { crop: null, rotate: 0, flip: false })} />
            </Group>
            <Group label="Cadre">
              <div className="ce-stack">
                <select className="ce-select" value={s.image.frame ?? 'none'} onChange={(e) => updateNode('image', { frame: e.target.value as ImageFrame })} aria-label="Cadre de l'image" title="Cadre de l'image">
                  {IMAGE_FRAMES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <AltField key={editor.state.selection.from} editor={editor} value={s.image.alt ?? ''} />
              </div>
            </Group>
            <Group label="Image">
              <Big icon="replaceImage" label="Remplacer" title="Remplacer par une autre image (taille, place et légende gardées)" onClick={onReplaceImage} />
              <Big icon="trash" label="Supprimer l'image" onClick={() => c().deleteSelection().run()} />
            </Group>
          </>
        )}

        {tab === 'colonnes' && (
          <>
            <Group label="Disposition">
              {COLUMNS_LAYOUTS.map((l) => (
                <Big key={l.id} icon={l.id === '1-1' ? 'cols2' : l.id === '1-2' ? 'cols12' : l.id === '2-1' ? 'cols21' : 'cols3'} label={l.label} title={l.title}
                  on={s.columnsLayout === l.id} onClick={() => c().setColumnsLayout(l.id).run()} />
              ))}
            </Group>
            <Group label="Colonnes">
              <Big icon="uncols" label="Retirer les colonnes" title="Remet le contenu des colonnes à la suite, sans rien effacer" onClick={() => c().unsetColumns().run()} />
            </Group>
          </>
        )}
      </div>
    </div>
  );
}
