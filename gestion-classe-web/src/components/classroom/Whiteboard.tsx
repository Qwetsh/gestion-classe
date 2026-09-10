/**
 * Tableau blanc « fait maison » pour le mode « en classe » (TBI / vidéoprojecteur).
 *
 * Principes :
 * - Pointer Events : stylet, souris et doigt écrivent. Quand un vrai stylet est détecté,
 *   les contacts « touch » sont ignorés pendant un court délai (rejet de paume).
 * - Encre : coordonnées en unités logiques (largeur = 1000) pour survivre au redimensionnement,
 *   tracé par courbes quadratiques passant par les milieux des points (lissage), largeur
 *   modulée par la pression, événements coalescés pour ne perdre aucun point.
 * - Trois calques canvas : fond (quadrillage), traits validés, trait en cours.
 * - Pages multiples, annuler / rétablir, gomme par trait, sauvegarde locale par séance.
 *
 * Aucune dépendance externe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BACKGROUNDS,
  BOARD_UNIT,
  BOARD_PAGE_H,
  BOARD_RATIO,
  drawBackground,
  drawPenSegment,
  loadPageImage,
  renderStroke,
  setupStrokeStyle,
  eraseStrokeAt,
  type Background,
  type BoardPage,
  type Stroke,
} from '../../lib/boardRender';
import { DEFAULT_TEXT_SIZE, DEFAULT_TEXT_WIDTH, MIN_TEXT_WIDTH, sanitizeBoardHtml } from '../../lib/boardText';

/** HTML collé depuis Word ou le web : on ne garde que le corps, nettoyé au sous-ensemble du tableau. */
function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cleaned = sanitizeBoardHtml(doc.body.innerHTML);
  return cleaned.trim() || '<div><br></div>';
}
import {
  cloneObjects,
  migrateLegacyTexts,
  objectRect,
  rectContains,
  rectsIntersect,
  reorder,
  type BoardObject,
  type TextObject,
} from '../../lib/boardObjects';
import { copyObjects, hasObjects as clipboardHasObjects, pasteObjects } from '../../lib/boardClipboard';
import { BoardObjectLayer, type BoardTextApi, type FormatState, type StageBox } from './BoardObjectLayer';
import { BoardTextToolbar } from './BoardTextToolbar';
import { BoardContextMenu, type MenuItem } from './BoardContextMenu';
import { BoardPageNavigator } from './BoardPageNavigator';
import { BoardShapeToolbar, type ShapeStyle } from './BoardShapeToolbar';
import { BoardColorPicker } from './BoardColorPicker';
import { defaultShapeBox, isLineKind, renderShape, type ShapeKind, type ShapeObject } from '../../lib/boardShapes';
import { recognizeShape, type RecognizedShape } from '../../lib/boardRecognize';
import {
  gapIdsIn,
  stripGaps as stripGapsHtml,
  loadRevealState,
  pageRevealedFraction,
  recoverPage,
  saveRevealState,
  type RevealCover,
  type RevealState,
} from '../../lib/boardReveal';
import { BoardExportDialog } from './BoardExportDialog';
import { BoardRadialMenu, type RadialItem } from './BoardRadialMenu';
import { BoardInstruments } from './BoardInstruments';
import { BoardSpotlight } from './BoardSpotlight';
import { BoardSearchPanel } from './BoardSearchPanel';
import { BoardKeyboard } from './BoardKeyboard';
import { BoardLibraryPanel } from './BoardLibraryPanel';
import { BoardPickOverlay, type PickableStudent } from './BoardPickOverlay';
import { BoardCameraOverlay } from './BoardCameraOverlay';
import type { ClassroomBus } from '../../lib/classroomBus';
import type { ClassroomCommand } from '../../lib/classroomProtocol';
import { fetchImageBlob } from '../../lib/boardSearch';
import type { LibraryItem, LibraryObject } from '../../lib/boardLibrary';
import { recognizeHandwriting } from '../../lib/boardHandwriting';
import { pullKeys, setKeysOwner } from '../../lib/userKeys';
import { newInstrument, snapToInstruments, type Instrument, type InstrumentKind } from '../../lib/boardInstruments';
import { fetchBoardPages, upsertBoardPages } from '../../lib/boardQueries';
import { importFilesToPages, isImportableFile, isImageFile, uploadBoardImage, uploadCoverImage, type ImportProgress } from '../../lib/boardImport';
import { downloadBlob, exportGcboard, importGcboard, isGcboardFile, safeFileName, GCBOARD_EXTENSION } from '../../lib/boardFile';
import { renderPageToCanvas } from '../../lib/boardRender';
import type { ImageObject } from '../../lib/boardObjects';
import {
  WIDGET_LABELS,
  emptyTable,
  insertTableCol,
  insertTableRow,
  looksLikeUrl,
  normalizeUrl,
  objectForUrl,
  removeTableCol,
  removeTableRow,
  tableFromTsv,
  uploadBoardFile,
  type AudioObject,
  type EquationObject,
  type LinkObject,
  type TableObject,
  type VideoObject,
  type WebObject,
  type WidgetKind,
  type WidgetObject,
} from '../../lib/boardMedia';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'select' | 'shape' | 'laser';
/** Outils qui manipulent les objets de la page (les cadres deviennent cliquables). */
const OBJECT_TOOLS: Tool[] = ['select', 'text'];
type SizeKey = 'S' | 'M' | 'L';
type Page = BoardPage;
type HistoryOp =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokes: Stroke[] }
  | { type: 'clear'; strokes: Stroke[] }
  | { type: 'replace'; removed: Stroke[]; added: Stroke[] }
  | { type: 'objects'; before: BoardObject[]; after: BoardObject[] }
  /** Trait converti en forme (formes intelligentes) : annuler rend l'encre. */
  | { type: 'convert'; stroke: Stroke; object: BoardObject }
  /** Encre manuscrite convertie en zone de texte : annuler rend les traits. */
  | { type: 'convertInk'; strokes: Stroke[]; object: BoardObject };

interface WhiteboardProps {
  sessionId: string;
  userId: string;
  /** Message à afficher en coin (ex. dernier événement reçu du téléphone). */
  ticker?: string | null;
  /**
   * Sauvegarde distante (table board_pages, rattachée à une séance).
   * `false` pour un tableau libre hors séance : tout reste dans le navigateur.
   */
  remote?: boolean;
  /** Tableau nommé (hors séance) : les pages sont rattachées à `boards.id` au lieu de la séance. */
  boardId?: string;
  /** Titre, pour les noms de fichiers exportés. */
  title?: string;
  /** Mode « en classe » : élèves de la séance et bus de commandes partagé avec le téléphone. */
  classroom?: { bus: ClassroomBus; students: PickableStudent[] };
  onClose: () => void;
}

const UNIT = BOARD_UNIT;
const COLORS = ['#111827', '#1D4ED8', '#DC2626', '#059669'];
const HIGHLIGHT_COLOR = '#FDE047';
/** Couleurs de surlignage proposées pour le texte. */
const TEXT_HIGHLIGHTS = ['#FDE047', '#BBF7D0', '#BFDBFE'];
const SIZES: Record<SizeKey, number> = { S: 2.2, M: 4, L: 7.5 };
const HIGHLIGHT_SIZE = 22;
/** Rayons de gomme (unités logiques, largeur de page = 1000). */
const ERASER_SIZES: Record<SizeKey, number> = { S: 6, M: 14, L: 32 };
const PALM_REJECT_MS = 1500;
const STORAGE_PREFIX = 'classroom-board:';
const LOCAL_SAVE_MS = 400;
const REMOTE_SAVE_MS = 1500;
const REMOTE_RETRY_MS = 15000;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const newPage = (background: Background = 'blank'): Page => ({ id: uid(), background, strokes: [], objects: [] });
const NAV_STORAGE_KEY = 'classroom-board-nav';
const AUTO_SHAPES_KEY = 'classroom-board-autoshapes';
const TBI_SETTINGS_KEY = 'classroom-board-tbi';
/** Deux doigts immobiles pendant ce délai : menu radial. */
const RADIAL_HOLD_MS = 280;
/** Deux doigts posés et relevés plus vite que ça : annuler (trois doigts : rétablir). */
const MULTI_TAP_MS = 320;
const MAX_ZOOM = 4;

type BarSide = 'bottom' | 'left' | 'right';
interface TbiSettings { gestures: boolean; bar: BarSide; hand: 'left' | 'right' | 'center' }
const DEFAULT_TBI: TbiSettings = { gestures: true, bar: 'bottom', hand: 'center' };

function loadTbi(): TbiSettings {
  try { return { ...DEFAULT_TBI, ...(JSON.parse(localStorage.getItem(TBI_SETTINGS_KEY) || '{}') as Partial<TbiSettings>) }; } catch { return DEFAULT_TBI; }
}

interface ViewState { zoom: number; tx: number; ty: number }
const IDENTITY_VIEW: ViewState = { zoom: 1, tx: 0, ty: 0 };

interface TouchGesture {
  kind: 'pending' | 'pinch' | 'three' | 'done';
  startAt: number;
  ids: number[];
  startPoints: Map<number, { x: number; y: number }>;
  startDist: number;
  startMid: { x: number; y: number };
  startView: ViewState;
  timer: number | null;
  moved: boolean;
}
/** Stylet immobile en fin de tracé : le trait devient une forme (comme Samsung Notes). */
const SHAPE_HOLD_MS = 400;
/** Durée de vie d'un trait du pointeur laser après le relâchement. */
const LASER_FADE_MS = 1400;

interface LaserStroke { points: { x: number; y: number }[]; endedAt: number | null }

/** Hauteur minimale quand une ligne devient une forme pleine. */
const MIN_SHAPE_H = 60;

/**
 * Forme décrite par un étirement (outil forme). Maj : carré / cercle, ou ligne à 45°.
 * Renvoie null si l'étirement est trop court (un simple clic).
 */
function draftToShape(
  d: { x0: number; y0: number; x1: number; y1: number; shift: boolean },
  kind: ShapeKind,
  style: ShapeStyle
): ShapeObject | null {
  let { x1, y1 } = d;
  const dx = x1 - d.x0, dy = y1 - d.y0;
  if (Math.hypot(dx, dy) < 4) return null;
  if (d.shift) {
    if (isLineKind(kind)) {
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      x1 = d.x0 + Math.cos(ang) * len;
      y1 = d.y0 + Math.sin(ang) * len;
    } else {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      x1 = d.x0 + Math.sign(dx || 1) * m;
      y1 = d.y0 + Math.sign(dy || 1) * m;
    }
  }
  const x = Math.min(d.x0, x1), y = Math.min(d.y0, y1);
  const w = Math.abs(x1 - d.x0), h = Math.abs(y1 - d.y0);
  const shape: ShapeObject = {
    id: 'draft', type: 'shape', kind, x, y, w, h,
    stroke: style.stroke, strokeWidth: style.strokeWidth, fill: style.fill, dashed: style.dashed,
  };
  if (isLineKind(kind)) {
    shape.a = { x: w > 0 ? (d.x0 - x) / w : 0, y: h > 0 ? (d.y0 - y) / h : 0 };
    shape.b = { x: w > 0 ? (x1 - x) / w : 0, y: h > 0 ? (y1 - y) / h : 0 };
  }
  return shape;
}

/** Boîte englobante d'un ensemble de traits (unités logiques). */
function strokesBounds(strokes: Stroke[]): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of strokes) for (const pt of st.points) {
    if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Pages lues du stockage (v1 sans objets, ou avec l'ancien champ `texts`) ramenées au modèle courant. */
function normalizePages(pages: Page[]): Page[] {
  return pages.map((p) => ({ ...p, objects: migrateLegacyTexts(p.objects, p.texts), texts: undefined }));
}
const clampPressure = (p: number) => (p > 0 ? Math.min(1, Math.max(0.15, p)) : 0.5);

interface LocalBoard { savedAt: number; pages: Page[] }

function loadLocal(sessionId: string): LocalBoard {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalBoard | Page[];
      if (Array.isArray(parsed)) return { savedAt: 0, pages: parsed.length > 0 ? normalizePages(parsed) : [newPage()] };
      if (Array.isArray(parsed.pages) && parsed.pages.length > 0) return { savedAt: parsed.savedAt || 0, pages: normalizePages(parsed.pages) };
    }
  } catch {
    /* stockage indisponible : on repart d'une page vierge */
  }
  return { savedAt: 0, pages: [newPage()] };
}

let localSaveWarned = false;
function saveLocal(sessionId: string, pages: Page[]) {
  try {
    const board: LocalBoard = { savedAt: Date.now(), pages };
    localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(board));
  } catch (err) {
    // Quota plein ou stockage bloqué : la sauvegarde distante reste le filet de sécurité
    if (!localSaveWarned) {
      localSaveWarned = true;
      console.warn('[Whiteboard] sauvegarde locale impossible (quota ?) :', err);
    }
  }
}

const hasInk = (pages: Page[]) => pages.some((p) => p.strokes.length > 0 || (p.objects ?? []).length > 0);

// ---- Composant ----

export function Whiteboard({ sessionId, userId, ticker, remote = true, boardId, title = 'Tableau', classroom, onClose }: WhiteboardProps) {
  /** Propriétaire des pages côté serveur. */
  const remoteRef = boardId ? { boardId } : sessionId;
  const [pages, setPages] = useState<Page[]>(() => loadLocal(sessionId).pages);
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [sizeKey, setSizeKey] = useState<SizeKey>('M');
  const [eraserKey, setEraserKey] = useState<SizeKey>('M');
  const [historyLen, setHistoryLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(() => { try { return localStorage.getItem(NAV_STORAGE_KEY) !== '0'; } catch { return true; } });
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect');
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>({ stroke: COLORS[0], strokeWidth: 4, fill: null, dashed: false });
  const [autoShapes, setAutoShapes] = useState(() => { try { return localStorage.getItem(AUTO_SHAPES_KEY) === '1'; } catch { return false; } });
  /** Encre sélectionnée (outil sélection) : identifiants de traits de la page courante. */
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<ReadonlySet<string>>(() => new Set());
  /** Ce qui a été découvert pendant la séance (hors document). */
  const [reveal, setReveal] = useState<RevealState>(() => loadRevealState(sessionId));
  const [exportOpen, setExportOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** Point de la page visé par un dépôt ou une insertion d'image (unités logiques). */
  const dropPoint = useRef<{ x: number; y: number } | null>(null);
  /** Objet visé par le choix d'une image de ticket à gratter. */
  const coverTargetIds = useRef<string[]>([]);
  const curtainDrag = useRef<{ pointerId: number } | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [tbi, setTbi] = useState<TbiSettings>(loadTbi);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<ViewState>(IDENTITY_VIEW);
  const viewRef = useRef<ViewState>(IDENTITY_VIEW);
  const [radial, setRadial] = useState<{ x: number; y: number } | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const instrumentsRef = useRef<Instrument[]>([]);
  const [spotlight, setSpotlight] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  /** Élèves déjà tirés dans la séance (sans remise), mémorisés sur l'appareil. */
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(() => {
    try { const raw = localStorage.getItem(`classroom-board-picked:${sessionId}`); return new Set(raw ? (JSON.parse(raw) as string[]) : []); } catch { return new Set(); }
  });
  /** Offre WebRTC reçue du téléphone (caméra en direct). */
  const [cameraOffer, setCameraOffer] = useState<string | null>(null);
  const touchPoints = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<TouchGesture | null>(null);
  const tbiRef = useRef<TbiSettings>(DEFAULT_TBI);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);
  const [recording, setRecording] = useState(false);
  /** Dernière cellule de tableau active (menu lignes / colonnes). */
  const tableCellRef = useRef<{ id: string; r: number; c: number } | null>(null);
  const [format, setFormat] = useState<FormatState>({
    bold: false, italic: false, underline: false, strike: false,
    ul: false, ol: false, align: 'left', sub: false, sup: false,
  });
  const [stageBox, setStageBox] = useState<StageBox>({ left: 0, top: 0, width: 0, height: 0 });
  const [textScale, setTextScale] = useState(1);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_SIZE);
  const [textFont, setTextFont] = useState('sans');
  const textApiRef = useRef<BoardTextApi | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const scaleRef = useRef(1);
  const pagesRef = useRef(pages);
  const pageIndexRef = useRef(pageIndex);
  const toolRef = useRef(tool);
  const editingIdRef = useRef<string | null>(null);
  const selectedIdsRef = useRef<ReadonlySet<string>>(new Set());
  /** Rectangle de sélection en cours (outil sélection), en unités logiques. */
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null>(null);
  /** Appui long sur le fond (doigt / stylet) : menu contextuel du vide. */
  const canvasPressTimer = useRef<number | null>(null);
  const pasteGeneration = useRef(0);
  const shapeKindRef = useRef(shapeKind);
  const shapeStyleRef = useRef(shapeStyle);
  const autoShapesRef = useRef(autoShapes);
  const selectedStrokeIdsRef = useRef<ReadonlySet<string>>(new Set());
  /** Forme en cours d'étirement (outil forme), en unités logiques. */
  const shapeDraft = useRef<{ x0: number; y0: number; x1: number; y1: number; shift: boolean } | null>(null);
  /** Minuteur « stylet immobile » des formes intelligentes. */
  const holdTimer = useRef<number | null>(null);
  const laserStrokes = useRef<LaserStroke[]>([]);
  const laserRaf = useRef<number | null>(null);
  /** Déplacement / mise à l'échelle de l'encre sélectionnée. */
  const inkDrag = useRef<{ mode: 'move' | 'scale'; startX: number; startY: number; originals: Stroke[]; box: { x: number; y: number; w: number; h: number }; pointerId: number } | null>(null);
  // Miroirs pour les gestionnaires d'événements (déclaré avant les effets de redessin)
  useEffect(() => {
    pagesRef.current = pages;
    pageIndexRef.current = pageIndex;
    toolRef.current = tool;
    eraserKeyRef.current = eraserKey;
    editingIdRef.current = editingId;
    selectedIdsRef.current = selectedIds;
    shapeKindRef.current = shapeKind;
    shapeStyleRef.current = shapeStyle;
    autoShapesRef.current = autoShapes;
    selectedStrokeIdsRef.current = selectedStrokeIds;
  }, [pages, pageIndex, tool, eraserKey, editingId, selectedIds, shapeKind, shapeStyle, autoShapes, selectedStrokeIds]);

  useEffect(() => {
    try { localStorage.setItem(AUTO_SHAPES_KEY, autoShapes ? '1' : '0'); } catch { /* stockage indisponible */ }
  }, [autoShapes]);
  useEffect(() => {
    tbiRef.current = tbi;
    try { localStorage.setItem(TBI_SETTINGS_KEY, JSON.stringify(tbi)); } catch { /* stockage indisponible */ }
  }, [tbi]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { instrumentsRef.current = instruments; }, [instruments]);

  useEffect(() => { saveRevealState(sessionId, reveal); }, [sessionId, reveal]);

  // Clés d'intégrations (YouTube, Notion, Drive…) : le compte alimente cet appareil
  useEffect(() => {
    setKeysOwner(userId || null);
    void pullKeys();
  }, [userId]);

  const historyRef = useRef<Record<string, { undo: HistoryOp[]; redo: HistoryOp[] }>>({});
  const activePointer = useRef<number | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const eraserMode = useRef(false);
  const eraserKeyRef = useRef(eraserKey);
  // Geste de gomme en cours : traits de départ (pour l'historique) et état de travail
  const eraseStartStrokes = useRef<Stroke[] | null>(null);
  const eraseWorking = useRef<Stroke[] | null>(null);
  const lastPenAt = useRef(0);

  const page = pages[pageIndex] ?? pages[0];

  const getHistory = useCallback((pageId: string) => {
    if (!historyRef.current[pageId]) historyRef.current[pageId] = { undo: [], redo: [] };
    return historyRef.current[pageId];
  }, []);

  const syncHistoryCounters = useCallback((pageId: string) => {
    const h = getHistory(pageId);
    setHistoryLen(h.undo.length);
    setRedoLen(h.redo.length);
  }, [getHistory]);

  // -- Redraw --
  const redrawMain = useCallback(() => {
    const canvas = mainRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    for (const s of p.strokes) renderStroke(ctx, s, scaleRef.current);
  }, []);

  const redrawBackground = useCallback(() => {
    const canvas = bgRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const idx = pageIndexRef.current;
    const p = pagesRef.current[idx];
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    drawBackground(ctx, p?.background ?? 'blank', w, h, scaleRef.current, null);
    const meta = p?.image;
    if (!meta) return;
    // Image importée (PDF, photo) : dessinée dès qu'elle est chargée, si la page n'a pas changé entre-temps
    loadPageImage(meta.path)
      .then((el) => {
        if (pageIndexRef.current !== idx || pagesRef.current[idx]?.image?.path !== meta.path) return;
        const c = bgRef.current;
        const cx = c?.getContext('2d');
        if (!c || !cx) return;
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackground(cx, p.background, c.width / dpr, c.height / dpr, scaleRef.current, { el, meta });
      })
      .catch((err) => console.warn('[Whiteboard] image de fond :', err));
  }, []);

  const resize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Page 16:9 « letterbox » dans l'écran : l'encre et les fonds importés coïncident partout
    const w = Math.floor(Math.min(rect.width, rect.height * BOARD_RATIO));
    const h = Math.floor(w / BOARD_RATIO);
    const left = Math.floor((rect.width - w) / 2);
    const top = Math.floor((rect.height - h) / 2);
    for (const ref of [bgRef, mainRef, liveRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.style.left = `${left}px`;
      c.style.top = `${top}px`;
    }
    scaleRef.current = w / UNIT;
    setStageBox((prev) => (prev.left === left && prev.top === top && prev.width === w && prev.height === h ? prev : { left, top, width: w, height: h }));
    setTextScale(w / UNIT);
    redrawBackground();
    redrawMain();
  }, [redrawBackground, redrawMain]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [resize]);

  // Changement de page ou de fond : tout redessiner
  useEffect(() => {
    redrawBackground();
    redrawMain();
    syncHistoryCounters(page.id);
  }, [pageIndex, page.id, page.background, redrawBackground, redrawMain, syncHistoryCounters]);

  // -- Persistance --
  // Local (navigateur) : immédiat, sert de cache et de secours hors ligne.
  // Distant (Supabase, table board_pages) : différé, rattache les pages à la séance.
  const remoteReady = useRef(false);
  const syncedRef = useRef<Map<string, Page>>(new Map());
  const syncedPosRef = useRef<Map<string, number>>(new Map());
  const [remoteDirty, setRemoteDirty] = useState(0);

  // Chargement initial : le plus récent des deux (serveur vs local) l'emporte
  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    (async () => {
      const local = loadLocal(sessionId);
      try {
        const remote = await fetchBoardPages(remoteRef);
        if (cancelled) return;
        const useRemote = remote.pages.length > 0 && (remote.updatedAt >= local.savedAt || !hasInk(local.pages));
        if (useRemote) {
          const remotePages = normalizePages(remote.pages);
          syncedRef.current = new Map(remotePages.map((p) => [p.id, p]));
          syncedPosRef.current = new Map(remotePages.map((p, i) => [p.id, i]));
          setPages(remotePages);
          setPageIndex(0);
        }
      } catch (err) {
        console.warn('[Whiteboard] chargement distant impossible, on garde le local :', err);
      } finally {
        if (!cancelled) {
          remoteReady.current = true;
          setRemoteDirty((v) => v + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, boardId, remote]);

  useEffect(() => {
    const t = window.setTimeout(() => saveLocal(sessionId, pages), LOCAL_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [pages, sessionId]);

  const flushRemote = useCallback(async () => {
    if (!remote || !remoteReady.current) return;
    const current = pagesRef.current;
    const dirty = current
      .map((page, position) => ({ page, position }))
      .filter(({ page, position }) => syncedRef.current.get(page.id) !== page || syncedPosRef.current.get(page.id) !== position);
    if (dirty.length === 0) return;
    try {
      await upsertBoardPages(userId, remoteRef, dirty);
      for (const { page, position } of dirty) {
        syncedRef.current.set(page.id, page);
        syncedPosRef.current.set(page.id, position);
      }
    } catch (err) {
      console.warn('[Whiteboard] sauvegarde distante échouée, nouvel essai plus tard :', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, boardId, userId, remote]);

  useEffect(() => {
    const t = window.setTimeout(() => void flushRemote(), REMOTE_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [pages, remoteDirty, flushRemote]);

  useEffect(() => {
    const t = window.setInterval(() => void flushRemote(), REMOTE_RETRY_MS);
    return () => window.clearInterval(t);
  }, [flushRemote]);

  // -- Mutations de page --
  const updatePage = useCallback((pageId: string, fn: (p: Page) => Page) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? fn(p) : p)));
  }, []);

  const pushOp = useCallback((pageId: string, op: HistoryOp) => {
    const h = getHistory(pageId);
    h.undo.push(op);
    if (h.undo.length > 200) h.undo.shift();
    h.redo = [];
    syncHistoryCounters(pageId);
  }, [getHistory, syncHistoryCounters]);

  const applyUndo = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const h = getHistory(p.id);
    const op = h.undo.pop();
    if (!op) return;
    h.redo.push(op);
    if (op.type === 'objects') updatePage(p.id, (pg) => ({ ...pg, objects: op.before }));
    else if (op.type === 'convert') updatePage(p.id, (pg) => ({ ...pg, objects: (pg.objects ?? []).filter((o) => o.id !== op.object.id), strokes: [...pg.strokes, op.stroke] }));
    else if (op.type === 'convertInk') updatePage(p.id, (pg) => ({ ...pg, objects: (pg.objects ?? []).filter((o) => o.id !== op.object.id), strokes: [...pg.strokes, ...op.strokes] }));
    else if (op.type === 'add') updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((s) => s.id !== op.stroke.id) }));
    else if (op.type === 'replace') {
      const addedIds = new Set(op.added.map((s) => s.id));
      updatePage(p.id, (pg) => ({ ...pg, strokes: [...pg.strokes.filter((s) => !addedIds.has(s.id)), ...op.removed] }));
    } else updatePage(p.id, (pg) => ({ ...pg, strokes: [...pg.strokes, ...op.strokes] }));
    syncHistoryCounters(p.id);
  }, [getHistory, updatePage, syncHistoryCounters]);

  const applyRedo = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const h = getHistory(p.id);
    const op = h.redo.pop();
    if (!op) return;
    h.undo.push(op);
    if (op.type === 'objects') updatePage(p.id, (pg) => ({ ...pg, objects: op.after }));
    else if (op.type === 'convert') updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((s) => s.id !== op.stroke.id), objects: [...(pg.objects ?? []), op.object] }));
    else if (op.type === 'convertInk') { const ids = new Set(op.strokes.map((st) => st.id)); updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((s) => !ids.has(s.id)), objects: [...(pg.objects ?? []), op.object] })); }
    else if (op.type === 'add') updatePage(p.id, (pg) => ({ ...pg, strokes: [...pg.strokes, op.stroke] }));
    else if (op.type === 'replace') {
      const removedIds = new Set(op.removed.map((s) => s.id));
      updatePage(p.id, (pg) => ({ ...pg, strokes: [...pg.strokes.filter((s) => !removedIds.has(s.id)), ...op.added] }));
    } else {
      const ids = new Set(op.strokes.map((s) => s.id));
      updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((s) => !ids.has(s.id)) }));
    }
    syncHistoryCounters(p.id);
  }, [getHistory, updatePage, syncHistoryCounters]);

  const clearPage = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const objects = p.objects ?? [];
    if (p.strokes.length === 0 && objects.length === 0) return;
    if (objects.length > 0) pushOp(p.id, { type: 'objects', before: objects, after: [] });
    if (p.strokes.length > 0) pushOp(p.id, { type: 'clear', strokes: p.strokes });
    setEditingId(null);
    setSelectedIds(new Set());
    updatePage(p.id, (pg) => ({ ...pg, strokes: [], objects: [] }));
  }, [pushOp, updatePage]);

  const setBackground = useCallback((bg: Background) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (p) updatePage(p.id, (pg) => ({ ...pg, background: bg }));
  }, [updatePage]);

  const addPage = useCallback(() => {
    const current = pagesRef.current[pageIndexRef.current];
    setPages((prev) => [...prev, newPage(current?.background ?? 'blank')]);
    setPageIndex(pagesRef.current.length);
  }, []);

  const insertPageAfter = useCallback((index: number) => {
    const current = pagesRef.current[index];
    setPages((prev) => [...prev.slice(0, index + 1), newPage(current?.background ?? 'blank'), ...prev.slice(index + 1)]);
    setPageIndex(index + 1);
  }, []);

  /** Copie complète d'une page (encre et objets avec de nouveaux identifiants), insérée juste après. */
  const duplicatePage = useCallback((index: number) => {
    const src = pagesRef.current[index];
    if (!src) return;
    const copy: Page = {
      ...src,
      id: uid(),
      strokes: src.strokes.map((st) => ({ ...st, id: uid() })),
      objects: cloneObjects(src.objects ?? [], 0, 0),
    };
    setPages((prev) => [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]);
    setPageIndex(index + 1);
  }, []);

  const deletePage = useCallback((index: number) => {
    if (pagesRef.current.length <= 1) return;
    setPages((prev) => prev.filter((_, i) => i !== index));
    setPageIndex((i) => Math.max(0, Math.min(i > index ? i - 1 : i, pagesRef.current.length - 2)));
  }, []);

  const movePage = useCallback((from: number, to: number) => {
    setPages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setPageIndex(to);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(NAV_STORAGE_KEY, navOpen ? '1' : '0'); } catch { /* stockage indisponible */ }
  }, [navOpen]);


  // -- Objets de la page (texte aujourd'hui ; formes, images… ensuite) --
  const pageObjects = page.objects ?? [];

  const handleObjectsChange = useCallback((next: BoardObject[], before: BoardObject[] | null) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    if (before) pushOp(p.id, { type: 'objects', before, after: next });
    updatePage(p.id, (pg) => ({ ...pg, objects: next }));
  }, [pushOp, updatePage]);

  /** Objets sélectionnés de la page courante, non verrouillés sauf demande. */
  const selectedObjects = useCallback((includeLocked = false): BoardObject[] => {
    const p = pagesRef.current[pageIndexRef.current];
    return (p?.objects ?? []).filter((o) => selectedIdsRef.current.has(o.id) && (includeLocked || !o.locked));
  }, []);

  /** Nouvelle zone de texte au point cliqué, prête à la saisie. */
  const createTextBox = useCallback((x: number, y: number) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const before = p.objects ?? [];
    const box: TextObject = {
      id: uid(),
      type: 'text',
      x: Math.round(Math.max(4, Math.min(x, UNIT - MIN_TEXT_WIDTH - 4))),
      y: Math.round(Math.max(4, y - textSize * 0.7)),
      w: Math.round(Math.max(MIN_TEXT_WIDTH, Math.min(DEFAULT_TEXT_WIDTH, UNIT - x - 8))),
      size: textSize,
      font: textFont,
      color,
      html: '<div><br></div>',
    };
    handleObjectsChange([...before, box], before);
    setSelectedIds(new Set([box.id]));
    setEditingId(box.id);
  }, [color, handleObjectsChange, textFont, textSize]);

  const deleteSelected = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    const ids = new Set(selectedObjects().map((o) => o.id));
    if (!p || ids.size === 0) return;
    setEditingId(null);
    setSelectedIds(new Set());
    handleObjectsChange((p.objects ?? []).filter((o) => !ids.has(o.id)), p.objects ?? []);
  }, [handleObjectsChange, selectedObjects]);

  const duplicateSelected = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    const src = selectedObjects(true);
    if (!p || src.length === 0) return;
    const copies = cloneObjects(src);
    handleObjectsChange([...(p.objects ?? []), ...copies], p.objects ?? []);
    setEditingId(null);
    setSelectedIds(new Set(copies.map((o) => o.id)));
  }, [handleObjectsChange, selectedObjects]);

  const copySelected = useCallback(() => {
    const src = selectedObjects(true);
    if (src.length === 0) return;
    copyObjects(src);
    pasteGeneration.current = 0;
  }, [selectedObjects]);

  const cutSelected = useCallback(() => {
    copySelected();
    deleteSelected();
  }, [copySelected, deleteSelected]);

  const pasteFromClipboard = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p || !clipboardHasObjects()) return;
    pasteGeneration.current += 1;
    const pasted = pasteObjects(pasteGeneration.current);
    handleObjectsChange([...(p.objects ?? []), ...pasted], p.objects ?? []);
    setEditingId(null);
    setSelectedIds(new Set(pasted.map((o) => o.id)));
    if (!OBJECT_TOOLS.includes(toolRef.current)) setTool('select');
  }, [handleObjectsChange]);

  const reorderSelected = useCallback((move: 'front' | 'back' | 'forward' | 'backward') => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p || selectedIdsRef.current.size === 0) return;
    const before = p.objects ?? [];
    const next = reorder(before, new Set(selectedIdsRef.current), move);
    if (next !== before) handleObjectsChange(next, before);
  }, [handleObjectsChange]);

  const toggleLockSelected = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    const src = selectedObjects(true);
    if (!p || src.length === 0) return;
    const lock = src.some((o) => !o.locked);
    const ids = new Set(src.map((o) => o.id));
    setEditingId(null);
    handleObjectsChange((p.objects ?? []).map((o) => (ids.has(o.id) ? { ...o, locked: lock } : o)), p.objects ?? []);
  }, [handleObjectsChange, selectedObjects]);

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    const p = pagesRef.current[pageIndexRef.current];
    const ids = new Set(selectedObjects().map((o) => o.id));
    if (!p || ids.size === 0) return;
    handleObjectsChange((p.objects ?? []).map((o) => (ids.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o)), p.objects ?? []);
  }, [handleObjectsChange, selectedObjects]);

  const selectAll = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    setEditingId(null);
    setSelectedIds(new Set((p.objects ?? []).map((o) => o.id)));
    if (!OBJECT_TOOLS.includes(toolRef.current)) setTool('select');
  }, []);

  // Changement de page : on repart sans sélection ; outil de dessin : idem
  useEffect(() => {
    setEditingId(null);
    setSelectedIds(new Set());
    setSelectedStrokeIds(new Set());
  }, [pageIndex]);
  useEffect(() => {
    if (!OBJECT_TOOLS.includes(tool)) { setEditingId(null); setSelectedIds(new Set()); setSelectedStrokeIds(new Set()); }
    else setEditingId(null);
    if (tool !== 'laser') { laserStrokes.current = []; }
  }, [tool]);

  /** Insère une image (déjà dans le bucket) comme objet, centrée sur `at` ou sur la page. */
  const insertImage = useCallback((img: { path: string; width: number; height: number }, at?: { x: number; y: number }) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return null;
    const maxW = UNIT * 0.5, maxH = BOARD_PAGE_H * 0.7;
    const k = Math.min(1, maxW / img.width, maxH / img.height, 0.6);
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const cx = at?.x ?? UNIT / 2, cy = at?.y ?? BOARD_PAGE_H / 2;
    const obj: ImageObject = {
      id: uid(), type: 'image', path: img.path, naturalWidth: img.width, naturalHeight: img.height,
      x: Math.round(Math.max(0, Math.min(UNIT - w, cx - w / 2))), y: Math.round(Math.max(0, Math.min(BOARD_PAGE_H - h, cy - h / 2))), w, h,
    };
    handleObjectsChange([...(p.objects ?? []), obj], p.objects ?? []);
    setSelectedIds(new Set([obj.id]));
    if (!OBJECT_TOOLS.includes(toolRef.current)) setTool('select');
    return obj;
  }, [handleObjectsChange]);

  /**
   * Fichiers déposés, ouverts ou collés : images → objets au point donné ; .gcboard → ses pages
   * après la page courante ; PDF → une page par page.
   */
  const importFiles = useCallback(async (list: FileList | File[], at?: { x: number; y: number }) => {
    const all = Array.from(list);
    const boards = all.filter(isGcboardFile);
    const images = all.filter((f) => isImageFile(f) && !isGcboardFile(f));
    const pdfs = all.filter((f) => isImportableFile(f) && !isImageFile(f));
    if (boards.length + images.length + pdfs.length === 0 || importing) return;
    setImporting({ done: 0, total: all.length, label: 'Préparation…' });
    try {
      for (let i = 0; i < images.length; i++) {
        setImporting({ done: i, total: images.length, label: images[i].name });
        const img = await uploadBoardImage(images[i], userId, sessionId);
        insertImage(img, at ? { x: at.x + i * 24, y: at.y + i * 24 } : undefined);
      }
      let inserted: Page[] = [];
      for (const f of boards) {
        const { pages: got } = await importGcboard(f, userId, sessionId, (label) => setImporting({ done: 0, total: 1, label }));
        inserted = [...inserted, ...got];
      }
      if (pdfs.length > 0) inserted = [...inserted, ...(await importFilesToPages(pdfs, userId, sessionId, setImporting))];
      if (inserted.length === 0) return;
      const atIndex = pageIndexRef.current;
      setPages((prev) => [...prev.slice(0, atIndex + 1), ...inserted, ...prev.slice(atIndex + 1)]);
      setPageIndex(atIndex + 1);
    } catch (err) {
      console.error('[Whiteboard] import :', err);
      window.alert(`Import impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      setImporting(null);
    }
  }, [importing, sessionId, userId, insertImage]);

  /** Enregistre tout le tableau en .gcboard (ré-ouvrable, images comprises). */
  const saveGcboard = useCallback(async () => {
    setImporting({ done: 0, total: 1, label: 'Préparation du fichier…' });
    try {
      const blob = await exportGcboard(pagesRef.current, title);
      downloadBlob(blob, `${safeFileName(title)}${GCBOARD_EXTENSION}`);
    } catch (err) {
      window.alert(`Enregistrement impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      setImporting(null);
    }
  }, [title]);

  /** Image PNG de la page courante (1920 px de large). */
  const exportPageImage = useCallback(async () => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const canvas = await renderPageToCanvas(p, 1920);
    canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${safeFileName(title)}-page${pageIndexRef.current + 1}.png`); }, 'image/png');
  }, [title]);

  /** Image PNG de la sélection (objets et encre), fond transparent, recadrée. */
  const exportSelectionImage = useCallback(async () => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const objects = (p.objects ?? []).filter((o) => selectedIdsRef.current.has(o.id));
    const strokes = p.strokes.filter((st) => selectedStrokeIdsRef.current.has(st.id));
    if (objects.length + strokes.length === 0) return;
    const boxes = [...objects.map(objectRect), strokesBounds(strokes)].filter((b): b is { x: number; y: number; w: number; h: number } => !!b);
    const pad = 12;
    const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad), y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
    const x1 = Math.min(UNIT, Math.max(...boxes.map((b) => b.x + b.w)) + pad), y1 = Math.min(BOARD_PAGE_H, Math.max(...boxes.map((b) => b.y + b.h)) + pad);
    const width = 1920, scale = width / UNIT;
    const full = await renderPageToCanvas({ ...p, background: 'blank', image: null, strokes, objects }, width);
    const out = document.createElement('canvas');
    out.width = Math.round((x1 - x0) * scale);
    out.height = Math.round((y1 - y0) * scale);
    const ctx = out.getContext('2d');
    if (!ctx) return;
    // Le fond blanc du rendu de page devient transparent
    ctx.drawImage(full, x0 * scale, y0 * scale, out.width, out.height, 0, 0, out.width, out.height);
    const data = ctx.getImageData(0, 0, out.width, out.height);
    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i] > 250 && data.data[i + 1] > 250 && data.data[i + 2] > 250) data.data[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    out.toBlob((blob) => { if (blob) downloadBlob(blob, `${safeFileName(title)}-selection.png`); }, 'image/png');
  }, [title]);

  /** Une image sélectionnée devient le fond de la page (et quitte les objets). */
  const sendImageToBackground = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    const img = (p?.objects ?? []).find((o): o is ImageObject => o.type === 'image' && selectedIdsRef.current.has(o.id));
    if (!p || !img) return;
    setSelectedIds(new Set());
    handleObjectsChange((p.objects ?? []).filter((o) => o.id !== img.id), p.objects ?? []);
    updatePage(p.id, (pg) => ({ ...pg, image: { path: img.path, width: img.naturalWidth, height: img.naturalHeight } }));
  }, [handleObjectsChange, updatePage]);

  // -- Médias et widgets --
  /** Ajoute un objet, le sélectionne, passe en outil sélection ; `edit` = entre en saisie. */
  const addObject = useCallback((obj: BoardObject, edit = false) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    handleObjectsChange([...(p.objects ?? []), obj], p.objects ?? []);
    setSelectedIds(new Set([obj.id]));
    if (!OBJECT_TOOLS.includes(toolRef.current)) setTool('select');
    if (edit) setEditingId(obj.id);
  }, [handleObjectsChange]);

  const centered = (w: number, h: number, at?: { x: number; y: number }) => ({
    x: Math.round(Math.max(0, Math.min(UNIT - w, (at?.x ?? UNIT / 2) - w / 2))),
    y: Math.round(Math.max(0, Math.min(BOARD_PAGE_H - h, (at?.y ?? BOARD_PAGE_H / 2) - h / 2))),
  });

  const insertTable = useCallback((rows = 3, cols = 3, cells?: string[][], at?: { x: number; y: number }) => {
    const w = Math.min(720, 120 * cols + 120);
    const obj: TableObject = { id: uid(), type: 'table', ...centered(w, 40 * rows, at), w, rows, cols, cells: cells ?? emptyTable(rows, cols), header: true, size: 24, font: textFont, color };
    addObject(obj, true);
  }, [addObject, textFont, color]);

  const insertFromUrl = useCallback((raw: string, at?: { x: number; y: number }) => {
    const url = normalizeUrl(raw);
    if (!url) { window.alert('Adresse invalide'); return; }
    const kind = objectForUrl(url);
    if (kind.type === 'video') {
      const obj: VideoObject = { id: uid(), type: 'video', ...centered(560, 315 + 26, at), w: 560, h: 315 + 26, url, provider: kind.provider };
      addObject(obj);
    } else {
      const label = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const obj: LinkObject = { id: uid(), type: 'link', ...centered(360, 44, at), w: Math.min(600, Math.max(200, label.length * 13 + 60)), url, label, size: 22 };
      addObject(obj);
    }
  }, [addObject]);

  const insertWeb = useCallback((raw: string) => {
    const url = normalizeUrl(raw);
    if (!url) { window.alert('Adresse invalide'); return; }
    const obj: WebObject = { id: uid(), type: 'web', ...centered(760, 460), w: 760, h: 460, url, interactive: false };
    addObject(obj);
  }, [addObject]);

  const insertSticky = useCallback((bg = '#FDE68A') => {
    const obj: TextObject = { id: uid(), type: 'text', ...centered(240, 160), w: 240, size: 24, font: textFont, color: '#111827', html: '<div><br></div>', background: bg };
    addObject(obj, true);
  }, [addObject, textFont]);

  const insertEquation = useCallback(() => {
    const obj: EquationObject = { id: uid(), type: 'equation', ...centered(320, 90), w: 320, h: 90, latex: '', size: 40, color };
    addObject(obj, true);
  }, [addObject, color]);

  const insertWidget = useCallback((widget: WidgetKind) => {
    const sizes: Record<WidgetKind, [number, number]> = { timer: [320, 170], dice: [260, 180], wheel: [340, 180], noise: [360, 230], calc: [280, 360] };
    const [w, h] = sizes[widget];
    const config: WidgetObject['config'] = widget === 'timer' ? { seconds: 300 } : widget === 'dice' ? { faces: 6 } : widget === 'wheel' ? { entries: ['A', 'B', 'C'] } : widget === 'noise' ? { level: 0 } : {};
    const obj: WidgetObject = { id: uid(), type: 'widget', ...centered(w, h), w, h, widget, config };
    addObject(obj);
  }, [addObject]);

  const insertLibraryItem = useCallback((item: LibraryItem) => {
    const w = 180;
    const h = Math.round(w / item.ratio);
    const st = shapeStyleRef.current;
    const obj: LibraryObject = { id: uid(), type: 'library', item: item.id, ...centered(w, h), w, h, stroke: st.stroke, fill: st.fill, strokeWidth: st.strokeWidth };
    addObject(obj);
  }, [addObject]);

  const insertAudio = useCallback(async (blob: Blob, label: string) => {
    setImporting({ done: 0, total: 1, label: 'Envoi du son…' });
    try {
      const ext = blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const path = await uploadBoardFile(blob, userId, sessionId, ext, blob.type || 'audio/webm');
      const obj: AudioObject = { id: uid(), type: 'audio', ...centered(380, 58), w: 380, h: 58, path, label };
      addObject(obj);
    } catch (err) {
      window.alert(`Son impossible à ajouter : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      setImporting(null);
    }
  }, [addObject, sessionId, userId]);

  /** Enregistrement au micro : un clic démarre, le suivant arrête et insère le son. */
  const toggleRecording = useCallback(async () => {
    const current = recorderRef.current;
    if (current) {
      current.rec.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 0) void insertAudio(blob, `Enregistrement ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      };
      recorderRef.current = { rec, chunks, stream };
      rec.start();
      setRecording(true);
    } catch (err) {
      window.alert(`Micro indisponible : ${err instanceof Error ? err.message : 'accès refusé'}`);
    }
  }, [insertAudio]);

  const onEquationCommit = useCallback(async (id: string, latex: string, raster: Blob | null, ratio: number) => {
    const p = pagesRef.current[pageIndexRef.current];
    const o = (p?.objects ?? []).find((t) => t.id === id);
    if (!p || !o || o.type !== 'equation') return;
    if (!latex) { handleObjectsChange((p.objects ?? []).filter((t) => t.id !== id), p.objects ?? []); return; }
    let imagePath = o.imagePath;
    if (raster) {
      try { imagePath = await uploadBoardFile(raster, userId, sessionId, 'png', 'image/png'); } catch (err) { console.warn('[Whiteboard] rendu équation :', err); }
    }
    const h = Math.max(30, Math.round(o.w / Math.max(0.5, ratio)));
    const before = pagesRef.current[pageIndexRef.current]?.objects ?? [];
    handleObjectsChange(before.map((t) => (t.id === id && t.type === 'equation' ? { ...t, latex, imagePath, h } : t)), before);
  }, [handleObjectsChange, sessionId, userId]);

  const onWidgetConfig = useCallback((id: string, patchCfg: WidgetObject['config']) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    handleObjectsChange((p.objects ?? []).map((t) => (t.id === id && t.type === 'widget' ? { ...t, config: { ...t.config, ...patchCfg } } : t)), p.objects ?? []);
  }, [handleObjectsChange]);

  const onToggleInteractive = useCallback((id: string) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    handleObjectsChange((p.objects ?? []).map((t) => (t.id === id && t.type === 'web' ? { ...t, interactive: !t.interactive } : t)), p.objects ?? []);
  }, [handleObjectsChange]);

  const patchTable = useCallback((id: string, fn: (t: TableObject) => TableObject) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    handleObjectsChange((p.objects ?? []).map((t) => (t.id === id && t.type === 'table' ? fn(t) : t)), p.objects ?? []);
  }, [handleObjectsChange]);

  // -- Formes --
  /** Ajoute une forme avec le style courant ; renvoie l'objet créé. */
  const addShape = useCallback((box: { x: number; y: number; w: number; h: number }, kind: ShapeKind, extra: Partial<ShapeObject> = {}, before?: BoardObject[]): ShapeObject | null => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return null;
    const st = shapeStyleRef.current;
    const obj: ShapeObject = {
      id: uid(), type: 'shape', kind,
      x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h),
      stroke: st.stroke, strokeWidth: st.strokeWidth, fill: st.fill, dashed: st.dashed,
      ...extra,
    };
    const prev = before ?? p.objects ?? [];
    handleObjectsChange([...prev, obj], prev);
    return obj;
  }, [handleObjectsChange]);

  /** Trait à main levée → forme (mêmes couleur et épaisseur), avec un pas d'annulation qui rend l'encre. */
  const convertStroke = useCallback((stroke: Stroke, rec: RecognizedShape): ShapeObject | null => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return null;
    const obj: ShapeObject = {
      id: uid(), type: 'shape', kind: rec.kind,
      x: Math.round(rec.x), y: Math.round(rec.y), w: Math.round(rec.w), h: Math.round(rec.h),
      stroke: stroke.color, strokeWidth: Math.max(2, Math.round(stroke.size)), fill: null,
      a: rec.a, b: rec.b, points: rec.points,
    };
    pushOp(p.id, { type: 'convert', stroke, object: obj });
    updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((st) => st.id !== stroke.id), objects: [...(pg.objects ?? []), obj] }));
    return obj;
  }, [pushOp, updatePage]);

  const patchSelectedShapes = useCallback((fn: (o: ShapeObject) => ShapeObject) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const ids = selectedIdsRef.current;
    const before = p.objects ?? [];
    if (!before.some((o) => o.type === 'shape' && ids.has(o.id))) return;
    handleObjectsChange(before.map((o) => (o.type === 'shape' && ids.has(o.id) ? fn(o) : o)), before);
  }, [handleObjectsChange]);

  // -- Encre sélectionnée (outil sélection) --
  const selectedStrokes = useCallback((): Stroke[] => {
    const p = pagesRef.current[pageIndexRef.current];
    return (p?.strokes ?? []).filter((st) => selectedStrokeIdsRef.current.has(st.id));
  }, []);

  const deleteSelectedStrokes = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    const removed = selectedStrokes();
    if (!p || removed.length === 0) return;
    const ids = new Set(removed.map((st) => st.id));
    pushOp(p.id, { type: 'replace', removed, added: [] });
    updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((st) => !ids.has(st.id)) }));
    setSelectedStrokeIds(new Set());
  }, [selectedStrokes, pushOp, updatePage]);

  /** Remplace les traits sélectionnés (déplacement, mise à l'échelle) avec un pas d'annulation. */
  const replaceSelectedStrokes = useCallback((originals: Stroke[], next: Stroke[]) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    pushOp(p.id, { type: 'replace', removed: originals, added: next });
  }, [pushOp]);

  /** L'encre sélectionnée devient une zone de texte (écriture manuscrite reconnue). */
  const convertInkToText = useCallback(async () => {
    const p = pagesRef.current[pageIndexRef.current];
    const strokes = selectedStrokes();
    if (!p || strokes.length === 0) return;
    setImporting({ done: 0, total: 1, label: 'Lecture de l\'écriture…' });
    try {
      const { text, engine } = await recognizeHandwriting(strokes, (label) => setImporting({ done: 0, total: 1, label }));
      if (!text) { window.alert('Rien de lisible : écrire plus gros, en script, sur une ligne.'); return; }
      const box = strokesBounds(strokes);
      if (!box) return;
      const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
      const html = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => `<div>${esc(l.trim())}</div>`).join('') || `<div>${esc(text)}</div>`;
      const size = Math.max(16, Math.min(48, Math.round(box.h / Math.max(1, text.split(/\r?\n/).length) * 0.8)));
      const obj: TextObject = { id: uid(), type: 'text', x: Math.round(box.x), y: Math.round(box.y), w: Math.max(MIN_TEXT_WIDTH, Math.round(box.w + size * 2)), size, font: textFont, color: strokes[0].color, html };
      const ids = new Set(strokes.map((st) => st.id));
      pushOp(p.id, { type: 'convertInk', strokes, object: obj });
      updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.filter((st) => !ids.has(st.id)), objects: [...(pg.objects ?? []), obj] }));
      setSelectedStrokeIds(new Set());
      setSelectedIds(new Set([obj.id]));
      if (engine === 'tesseract') console.info('[Whiteboard] écriture reconnue par Tesseract (API native indisponible)');
    } catch (err) {
      window.alert(`Reconnaissance impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    } finally {
      setImporting(null);
    }
  }, [selectedStrokes, pushOp, updatePage, textFont]);

  const laserTick = useCallback(() => {
    laserRaf.current = null;
    const live = liveRef.current;
    const ctx = live?.getContext('2d');
    if (!live || !ctx) return;
    const now = Date.now();
    const dpr = window.devicePixelRatio || 1;
    const sc = scaleRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
    laserStrokes.current = laserStrokes.current.filter((ls) => ls.endedAt === null || now - ls.endedAt < LASER_FADE_MS);
    for (const ls of laserStrokes.current) {
      const alpha = ls.endedAt === null ? 1 : 1 - (now - ls.endedAt) / LASER_FADE_MS;
      if (ls.points.length === 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(239,68,68,0.9)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ls.points[0].x * sc, ls.points[0].y * sc);
      for (let i = 1; i < ls.points.length; i++) ctx.lineTo(ls.points[i].x * sc, ls.points[i].y * sc);
      ctx.stroke();
      ctx.restore();
    }
    if (laserStrokes.current.length > 0) laserRaf.current = requestAnimationFrame(laserTick);
  }, []);

  // -- Révélation : rideaux, tickets, trous --
  const revealObject = useCallback((id: string, value: true | string | null) => {
    setReveal((r) => {
      const objects = { ...r.objects };
      if (value === null) delete objects[id]; else objects[id] = value;
      return { ...r, objects };
    });
  }, []);

  const revealGap = useCallback((objectId: string, gapId: string) => {
    setReveal((r) => {
      const current = r.gaps[objectId] ?? [];
      if (current.includes(gapId)) return r;
      return { ...r, gaps: { ...r.gaps, [objectId]: [...current, gapId] } };
    });
  }, []);

  const revealAllGaps = useCallback((objectId: string) => {
    const p = pagesRef.current[pageIndexRef.current];
    const o = (p?.objects ?? []).find((t) => t.id === objectId);
    if (!o || o.type !== 'text') return;
    const ids = gapIdsIn(o.html);
    setReveal((r) => ({ ...r, gaps: { ...r.gaps, [objectId]: ids } }));
  }, []);

  const setPageReveal = useCallback((pageId: string, fraction: number) => {
    const f = Math.max(0, Math.min(1, fraction));
    setReveal((r) => ({ ...r, pages: { ...r.pages, [pageId]: f } }));
  }, []);

  const recoverCurrentPage = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (p) setReveal((r) => recoverPage(r, p));
  }, []);

  const recoverAll = useCallback(() => {
    setReveal({ pages: {}, objects: {}, gaps: {} });
  }, []);

  /** Pose (ou retire) un cache sur les objets sélectionnés, avec un pas d'annulation. */
  const setCoverOnSelected = useCallback((cover: RevealCover | null) => {
    const p = pagesRef.current[pageIndexRef.current];
    const ids = new Set(selectedObjects(true).map((o) => o.id));
    if (!p || ids.size === 0) return;
    handleObjectsChange((p.objects ?? []).map((o) => {
      if (!ids.has(o.id)) return o;
      const next = { ...o };
      if (cover) next.cover = cover; else delete next.cover;
      return next;
    }), p.objects ?? []);
    // Un nouveau cache repart couvert
    setReveal((r) => { const objects = { ...r.objects }; for (const id of ids) delete objects[id]; return { ...r, objects }; });
  }, [handleObjectsChange, selectedObjects]);

  const pickCoverImage = useCallback(() => {
    coverTargetIds.current = selectedObjects(true).map((o) => o.id);
    if (coverTargetIds.current.length > 0) coverInputRef.current?.click();
  }, [selectedObjects]);

  const onCoverImageChosen = useCallback(async (file: File) => {
    const ids = new Set(coverTargetIds.current);
    coverTargetIds.current = [];
    if (ids.size === 0) return;
    try {
      const img = await uploadCoverImage(file, userId, sessionId);
      const p = pagesRef.current[pageIndexRef.current];
      if (!p) return;
      handleObjectsChange((p.objects ?? []).map((o) => (ids.has(o.id) ? { ...o, cover: { kind: 'scratch', color: '#9CA3AF', imagePath: img.path } } : o)), p.objects ?? []);
      setReveal((r) => { const objects = { ...r.objects }; for (const id of ids) delete objects[id]; return { ...r, objects }; });
    } catch (err) {
      window.alert(`Image impossible à utiliser : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    }
  }, [handleObjectsChange, sessionId, userId]);

  const togglePageCurtain = useCallback(() => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    updatePage(p.id, (pg) => ({ ...pg, curtain: !pg.curtain }));
    setReveal((r) => { const pages = { ...r.pages }; delete pages[p.id]; return { ...r, pages }; });
  }, [updatePage]);

  const addInstrument = useCallback((kind: InstrumentKind) => {
    setInstruments((prev) => [...prev, newInstrument(kind, UNIT / 2, BOARD_PAGE_H / 2)]);
  }, []);

  // -- Classe connectée : photos et caméra du téléphone, tirage et tampons depuis le tableau --
  useEffect(() => {
    try { localStorage.setItem(`classroom-board-picked:${sessionId}`, JSON.stringify([...pickedIds])); } catch { /* stockage indisponible */ }
  }, [pickedIds, sessionId]);

  useEffect(() => {
    const bus = classroom?.bus;
    if (!bus) return;
    return bus.subscribe((cmd: ClassroomCommand) => {
      if (cmd.kind === 'photo') {
        insertImage({ path: cmd.path, width: cmd.width, height: cmd.height });
      } else if (cmd.kind === 'camera' && cmd.action === 'offer') {
        setCameraOffer(cmd.sdp);
      } else if (cmd.kind === 'camera' && cmd.action === 'stop') {
        setCameraOffer(null);
      }
    });
  }, [classroom?.bus, insertImage]);

  const onPicked = useCallback((ids: string[]) => {
    setPickedIds((prev) => new Set([...prev, ...ids]));
    const bus = classroom?.bus;
    if (!bus) return;
    const names = ids.map((id) => classroom?.students.find((st) => st.id === id)?.pseudo ?? '').filter(Boolean);
    bus.send({ kind: 'pick', studentId: ids[0] ?? null, label: names.join(' + '), source: 'board' });
  }, [classroom]);

  const sendStamp = useCallback((studentId: string) => {
    classroom?.bus.send({ kind: 'stamp', studentId, source: 'board' });
  }, [classroom]);

  const onCameraCapture = useCallback(async (blob: Blob) => {
    try {
      const img = await uploadBoardImage(blob, userId, sessionId);
      insertImage(img);
    } catch (err) {
      window.alert(`Capture impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    }
  }, [insertImage, sessionId, userId]);

  // -- Menu contextuel --
  const closeMenu = useCallback(() => setMenu(null), []);

  const openObjectMenu = useCallback((x: number, y: number, id: string) => {
    const p = pagesRef.current[pageIndexRef.current];
    const target = (p?.objects ?? []).find((o) => o.id === id);
    if (!target) return;
    const count = selectedIdsRef.current.size;
    const many = count > 1;
    const locked = target.locked === true;
    const items: MenuItem[] = [
      { label: many ? `Couper (${count} objets)` : 'Couper', shortcut: 'Ctrl+X', disabled: locked, onSelect: cutSelected },
      { label: 'Copier', shortcut: 'Ctrl+C', onSelect: copySelected },
      { label: 'Coller', shortcut: 'Ctrl+V', disabled: !clipboardHasObjects(), onSelect: pasteFromClipboard },
      { label: 'Dupliquer', shortcut: 'Ctrl+D', onSelect: duplicateSelected },
      { separator: true, label: '' },
      ...(target.type === 'text' && !many && !locked
        ? [{ label: 'Modifier le texte', shortcut: 'Double-clic', onSelect: () => setEditingId(id) }]
        : []),
      { label: 'Mettre au premier plan', shortcut: 'Ctrl+Maj+]', onSelect: () => reorderSelected('front') },
      { label: 'Avancer', shortcut: 'Ctrl+]', onSelect: () => reorderSelected('forward') },
      { label: 'Reculer', shortcut: 'Ctrl+[', onSelect: () => reorderSelected('backward') },
      { label: "Mettre à l'arrière-plan", shortcut: 'Ctrl+Maj+[', onSelect: () => reorderSelected('back') },
      { separator: true, label: '' },
      ...(target.cover
        ? [
            ...(reveal.objects[target.id] === true
              ? [{ label: 'Recouvrir', onSelect: () => revealObject(target.id, null) }]
              : [{ label: 'Découvrir', onSelect: () => revealObject(target.id, true) }]),
            { label: 'Retirer le cache', onSelect: () => setCoverOnSelected(null) },
          ]
        : [
            { label: 'Poser un rideau', onSelect: () => setCoverOnSelected({ kind: 'curtain', color: '#4B5563', label: '?' }) },
            { label: 'Ticket à gratter (uni)', onSelect: () => setCoverOnSelected({ kind: 'scratch', color: '#9CA3AF' }) },
            { label: 'Ticket à gratter (image…)', onSelect: pickCoverImage },
          ]),
      ...(target.type === 'text' && gapIdsIn(target.html).length > 0
        ? [{ label: 'Révéler tous les trous', onSelect: () => revealAllGaps(target.id) }]
        : []),
      ...(target.type === 'image' && !many ? [{ label: 'Mettre en fond de page', onSelect: sendImageToBackground }] : []),
      ...(target.type === 'web' && !many ? [{ label: target.interactive ? 'Annoter par-dessus le site' : 'Interagir avec le site', onSelect: () => onToggleInteractive(target.id) }] : []),
      ...(target.type === 'table' && !many ? (() => {
        const cell = tableCellRef.current?.id === target.id ? tableCellRef.current : { r: 0, c: 0 };
        return [
          { separator: true, label: '' },
          { label: 'Ligne au-dessus', onSelect: () => patchTable(target.id, (t) => insertTableRow(t, cell.r)) },
          { label: 'Ligne en dessous', onSelect: () => patchTable(target.id, (t) => insertTableRow(t, cell.r + 1)) },
          { label: 'Colonne avant', onSelect: () => patchTable(target.id, (t) => insertTableCol(t, cell.c)) },
          { label: 'Colonne après', onSelect: () => patchTable(target.id, (t) => insertTableCol(t, cell.c + 1)) },
          { label: 'Supprimer la ligne', disabled: target.rows <= 1, onSelect: () => patchTable(target.id, (t) => removeTableRow(t, cell.r)) },
          { label: 'Supprimer la colonne', disabled: target.cols <= 1, onSelect: () => patchTable(target.id, (t) => removeTableCol(t, cell.c)) },
          { label: target.header ? 'Sans ligne d\'en-tête' : 'Première ligne en en-tête', onSelect: () => patchTable(target.id, (t) => ({ ...t, header: !t.header })) },
        ];
      })() : []),
      { label: many ? 'Exporter la sélection en image' : 'Exporter en image (PNG)', onSelect: () => void exportSelectionImage() },
      { separator: true, label: '' },
      { label: locked ? 'Déverrouiller' : 'Verrouiller', shortcut: 'Ctrl+Maj+K', onSelect: toggleLockSelected },
      { label: many ? `Supprimer (${count})` : 'Supprimer', shortcut: 'Suppr', danger: true, disabled: locked, onSelect: deleteSelected },
    ];
    setMenu({ x, y, items });
  }, [cutSelected, copySelected, pasteFromClipboard, duplicateSelected, reorderSelected, toggleLockSelected, deleteSelected, reveal.objects, revealObject, setCoverOnSelected, pickCoverImage, revealAllGaps, sendImageToBackground, exportSelectionImage, onToggleInteractive, patchTable]);

  const openCanvasMenu = useCallback((x: number, y: number, unit: { x: number; y: number }) => {
    const p = pagesRef.current[pageIndexRef.current];
    if (!p) return;
    const items: MenuItem[] = [
      { label: 'Coller', shortcut: 'Ctrl+V', disabled: !clipboardHasObjects(), onSelect: pasteFromClipboard },
      { label: 'Nouvelle zone de texte ici', shortcut: 'T', onSelect: () => { setTool('text'); createTextBox(unit.x, unit.y); } },
      { label: 'Insérer une image…', onSelect: () => { dropPoint.current = unit; imageInputRef.current?.click(); } },
      { label: 'Tout sélectionner', shortcut: 'Ctrl+A', disabled: (p.objects ?? []).length === 0, onSelect: selectAll },
      { separator: true, label: '' },
      ...BACKGROUNDS.map((b) => ({ label: `Fond : ${b.label}`, onSelect: () => setBackground(b.id) })),
      { separator: true, label: '' },
      { label: p.curtain ? 'Retirer le rideau de page' : 'Rideau sur la page', onSelect: togglePageCurtain },
      { label: 'Tout recouvrir (cette page)', onSelect: recoverCurrentPage },
      { label: 'Tout recouvrir (tout le tableau)', onSelect: recoverAll },
      { label: 'Règle', onSelect: () => addInstrument('ruler') },
      { label: 'Équerre', onSelect: () => addInstrument('setsquare') },
      { label: 'Rapporteur', onSelect: () => addInstrument('protractor') },
      { label: 'Projecteur', onSelect: () => setSpotlight(true) },
      { separator: true, label: '' },
      { label: 'Exporter en PDF…', onSelect: () => setExportOpen(true) },
      { label: 'Exporter la page en image (PNG)', onSelect: () => void exportPageImage() },
      { label: `Enregistrer le tableau (${GCBOARD_EXTENSION})`, onSelect: () => void saveGcboard() },
      { label: 'Ouvrir un tableau, un PDF, une image…', onSelect: () => fileInputRef.current?.click() },
      { separator: true, label: '' },
      { label: 'Nouvelle page', shortcut: 'Ctrl+Entrée', onSelect: addPage },
      { label: 'Dupliquer la page', onSelect: () => duplicatePage(pageIndexRef.current) },
      { label: 'Effacer la page', danger: true, disabled: p.strokes.length === 0 && (p.objects ?? []).length === 0, onSelect: clearPage },
    ];
    setMenu({ x, y, items });
  }, [pasteFromClipboard, createTextBox, selectAll, setBackground, addPage, duplicatePage, clearPage, togglePageCurtain, recoverCurrentPage, recoverAll, exportPageImage, saveGcboard, addInstrument]);

  const openInkMenu = useCallback((x: number, y: number) => {
    const count = selectedStrokeIdsRef.current.size;
    const items: MenuItem[] = [
      { label: `Convertir l'écriture en texte (${count} trait${count > 1 ? 's' : ''})`, onSelect: () => void convertInkToText() },
      { label: 'Exporter en image (PNG)', onSelect: () => void exportSelectionImage() },
      { separator: true, label: '' },
      { label: 'Supprimer l\'encre', shortcut: 'Suppr', danger: true, onSelect: deleteSelectedStrokes },
    ];
    setMenu({ x, y, items });
  }, [convertInkToText, exportSelectionImage, deleteSelectedStrokes]);

  const openPageMenu = useCallback((index: number, x: number, y: number) => {
    const count = pagesRef.current.length;
    const items: MenuItem[] = [
      { label: 'Afficher', onSelect: () => setPageIndex(index) },
      { label: 'Insérer une page après', onSelect: () => insertPageAfter(index) },
      { label: 'Dupliquer', onSelect: () => duplicatePage(index) },
      { separator: true, label: '' },
      { label: 'Monter', disabled: index === 0, onSelect: () => movePage(index, index - 1) },
      { label: 'Descendre', disabled: index >= count - 1, onSelect: () => movePage(index, index + 1) },
      { separator: true, label: '' },
      { label: 'Supprimer la page', danger: true, disabled: count <= 1, onSelect: () => deletePage(index) },
    ];
    setMenu({ x, y, items });
  }, [insertPageAfter, duplicatePage, movePage, deletePage]);

  // Redessiner le calque principal quand les traits changent (undo/redo/gomme/clear)
  useEffect(() => {
    redrawMain();
  }, [page.strokes, redrawMain]);

  // -- Pointer events --
  const toUnit = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = liveRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const k = scaleRef.current * viewRef.current.zoom;
    return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k };
  }, []);


  const clearLive = useCallback(() => {
    const live = liveRef.current;
    const ctx = live?.getContext('2d');
    if (!live || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
  }, []);

  /** Interrompt le geste en cours sur le canvas (trait, sélection, forme) sans rien enregistrer. */
  const cancelCanvasInput = useCallback(() => {
    activePointer.current = null;
    currentStroke.current = null;
    eraserMode.current = false;
    eraseStartStrokes.current = null;
    eraseWorking.current = null;
    marqueeRef.current = null;
    shapeDraft.current = null;
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (canvasPressTimer.current) { window.clearTimeout(canvasPressTimer.current); canvasPressTimer.current = null; }
    clearLive();
  }, [clearLive]);

  /** Zoom autour d'un point écran (client). */
  const zoomAt = useCallback((factor: number, clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = viewRef.current;
    const z = Math.max(1, Math.min(MAX_ZOOM, v.zoom * factor));
    const px = clientX - rect.left, py = clientY - rect.top;
    let tx = px - ((px - v.tx) * z) / v.zoom;
    let ty = py - ((py - v.ty) * z) / v.zoom;
    if (z === 1) { tx = 0; ty = 0; }
    setView({ zoom: z, tx, ty });
  }, []);

  /** Cercle de gomme sur le calque temporaire (suit le stylet / la souris). */
  const drawEraserCursor = useCallback((x: number, y: number) => {
    const live = liveRef.current;
    const ctx = live?.getContext('2d');
    if (!live || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = scaleRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, ERASER_SIZES[eraserKeyRef.current] * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99,102,241,0.12)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4F46E5';
    ctx.stroke();
  }, []);

  const eraseAt = useCallback((x: number, y: number) => {
    const p = pagesRef.current[pageIndexRef.current];
    const working = eraseWorking.current;
    if (!p || !working) return;
    const r = ERASER_SIZES[eraserKeyRef.current];
    let changed = false;
    const next: Stroke[] = [];
    for (const s of working) {
      const pieces = eraseStrokeAt(s, x, y, r, uid);
      if (pieces === null) next.push(s);
      else { changed = true; next.push(...pieces); }
    }
    drawEraserCursor(x, y);
    if (!changed) return;
    eraseWorking.current = next;
    updatePage(p.id, (pg) => ({ ...pg, strokes: next }));
  }, [updatePage, drawEraserCursor]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== null) return; // un seul contact à la fois
    if (e.pointerType === 'pen') lastPenAt.current = Date.now();
    else if (e.pointerType === 'touch' && Date.now() - lastPenAt.current < PALM_REJECT_MS) return; // paume
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Outil texte : hors des zones existantes, un clic ferme la saisie en cours,
    // sinon il crée une nouvelle zone à cet endroit (comme un traitement de texte).
    if (toolRef.current === 'text') {
      e.preventDefault();
      if (editingIdRef.current || selectedIdsRef.current.size > 0) {
        setEditingId(null);
        setSelectedIds(new Set());
        return;
      }
      const { x, y } = toUnit(e);
      createTextBox(x, y);
      return;
    }

    // Outil forme : on étire la forme depuis le point d'appui (clic simple = taille par défaut)
    if (toolRef.current === 'shape') {
      e.preventDefault();
      activePointer.current = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      const { x, y } = toUnit(e);
      shapeDraft.current = { x0: x, y0: y, x1: x, y1: y, shift: e.shiftKey };
      return;
    }

    // Pointeur laser : trait rouge qui s'efface tout seul, jamais enregistré
    if (toolRef.current === 'laser') {
      e.preventDefault();
      activePointer.current = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      const { x, y } = toUnit(e);
      laserStrokes.current.push({ points: [{ x, y }], endedAt: null });
      if (laserRaf.current === null) laserRaf.current = requestAnimationFrame(laserTick);
      return;
    }

    // Outil sélection : un rectangle de sélection depuis le fond (Maj = ajouter à la sélection)
    if (toolRef.current === 'select') {
      e.preventDefault();
      activePointer.current = e.pointerId;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
      const { x, y } = toUnit(e);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      marqueeRef.current = { x0: x, y0: y, x1: x, y1: y, additive };
      setEditingId(null);
      if (!additive) { setSelectedIds(new Set()); setSelectedStrokeIds(new Set()); }
      // Appui long au doigt / stylet sur le fond : menu contextuel du vide
      if (e.pointerType !== 'mouse') {
        const { clientX, clientY } = e;
        canvasPressTimer.current = window.setTimeout(() => {
          const m = marqueeRef.current;
          if (!m || Math.abs(m.x1 - m.x0) > 6 || Math.abs(m.y1 - m.y0) > 6) return;
          marqueeRef.current = null;
          activePointer.current = null;
          clearLive();
          openCanvasMenu(clientX, clientY, { x, y });
        }, 500);
      }
      return;
    }

    e.preventDefault();
    activePointer.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique ou déjà capturé */ }

    // Gomme du stylet (bouton 5 / buttons & 32) ou outil gomme
    const isEraser = toolRef.current === 'eraser' || e.button === 5 || (e.buttons & 32) !== 0;
    eraserMode.current = isEraser;
    const { x, y } = toUnit(e);
    if (isEraser) {
      const p = pagesRef.current[pageIndexRef.current];
      eraseStartStrokes.current = p ? p.strokes : [];
      eraseWorking.current = p ? [...p.strokes] : [];
      eraseAt(x, y);
      return;
    }

    const t = toolRef.current;
    const stroke: Stroke = {
      id: uid(),
      tool: t === 'highlighter' ? 'highlighter' : 'pen',
      color: t === 'highlighter' ? HIGHLIGHT_COLOR : color,
      size: t === 'highlighter' ? HIGHLIGHT_SIZE : SIZES[sizeKey],
      points: [{ x, y, p: clampPressure(e.pressure) }],
    };
    currentStroke.current = stroke;
  }, [color, sizeKey, toUnit, eraseAt, createTextBox, clearLive, openCanvasMenu, laserTick]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current === null) {
      // Survol (souris ou stylet en l'air) : on montre le cercle de la gomme
      if (toolRef.current === 'eraser' && e.pointerType !== 'touch') {
        const { x, y } = toUnit(e);
        drawEraserCursor(x, y);
      }
      return;
    }
    if (e.pointerId !== activePointer.current) return;
    e.preventDefault();
    const draft = shapeDraft.current;
    if (draft) {
      const { x, y } = toUnit(e);
      draft.x1 = x;
      draft.y1 = y;
      draft.shift = e.shiftKey;
      const live = liveRef.current;
      const ctx = live?.getContext('2d');
      if (!live || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
      const preview = draftToShape(draft, shapeKindRef.current, shapeStyleRef.current);
      if (preview) renderShape(ctx, preview, scaleRef.current);
      return;
    }
    if (toolRef.current === 'laser') {
      const ls = laserStrokes.current[laserStrokes.current.length - 1];
      if (ls && ls.endedAt === null) ls.points.push(toUnit(e));
      return;
    }
    const marquee = marqueeRef.current;
    if (marquee) {
      const { x, y } = toUnit(e);
      marquee.x1 = x;
      marquee.y1 = y;
      if (canvasPressTimer.current && Math.hypot(x - marquee.x0, y - marquee.y0) > 6) {
        window.clearTimeout(canvasPressTimer.current);
        canvasPressTimer.current = null;
      }
      const live = liveRef.current;
      const ctx = live?.getContext('2d');
      if (!live || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const sc = scaleRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
      const rx = Math.min(marquee.x0, marquee.x1) * sc, ry = Math.min(marquee.y0, marquee.y1) * sc;
      const rw = Math.abs(marquee.x1 - marquee.x0) * sc, rh = Math.abs(marquee.y1 - marquee.y0) * sc;
      ctx.fillStyle = 'rgba(99,102,241,0.10)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      return;
    }
    const native = e.nativeEvent as PointerEvent;
    const samples: { clientX: number; clientY: number; pressure: number }[] =
      typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length > 0
        ? native.getCoalescedEvents()
        : [native];

    if (eraserMode.current) {
      for (const s of samples) {
        const { x, y } = toUnit(s);
        eraseAt(x, y);
      }
      return;
    }

    const stroke = currentStroke.current;
    const ctx = liveRef.current?.getContext('2d');
    if (!stroke || !ctx) return;
    const scale = scaleRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const s of samples) {
      const raw = toUnit(s);
      const { x, y } = instrumentsRef.current.length > 0 && stroke.tool === 'pen' ? snapToInstruments(raw.x, raw.y, instrumentsRef.current) : raw;
      const last = stroke.points[stroke.points.length - 1];
      if (Math.abs(last.x - x) < 0.6 && Math.abs(last.y - y) < 0.6) continue; // bruit
      stroke.points.push({ x, y, p: clampPressure(s.pressure) });
      if (stroke.tool === 'pen') {
        ctx.save();
        setupStrokeStyle(ctx, stroke);
        drawPenSegment(ctx, stroke, stroke.points.length - 1, scale);
        ctx.restore();
      }
    }
    if (stroke.tool === 'highlighter') {
      const c = liveRef.current!;
      ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
      renderStroke(ctx, stroke, scale);
    }
    // Formes intelligentes : stylet immobile en fin de tracé → le trait devient une forme
    if (stroke.tool === 'pen') {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        const st = currentStroke.current;
        if (!st || st.points.length < 8) return;
        const rec = recognizeShape(st.points);
        if (!rec) return;
        currentStroke.current = null; // le relâchement n'ajoutera pas d'encre
        clearLive();
        const obj = convertStroke(st, rec);
        if (obj) { setTool('select'); setSelectedIds(new Set([obj.id])); }
      }, SHAPE_HOLD_MS);
    }
  }, [toUnit, eraseAt, drawEraserCursor, clearLive, convertStroke]);

  const finishPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }

    const p = pagesRef.current[pageIndexRef.current];
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    const draft = shapeDraft.current;
    if (draft) {
      shapeDraft.current = null;
      clearLive();
      const shape = draftToShape(draft, shapeKindRef.current, shapeStyleRef.current)
        ?? { ...defaultShapeBox(shapeKindRef.current, draft.x0, draft.y0), kind: shapeKindRef.current, a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
      const obj = addShape(shape, shape.kind, { a: shape.a, b: shape.b });
      if (obj) { setTool('select'); setSelectedIds(new Set([obj.id])); }
      return;
    }
    if (toolRef.current === 'laser') {
      const ls = laserStrokes.current[laserStrokes.current.length - 1];
      if (ls) ls.endedAt = Date.now();
      return;
    }
    const marquee = marqueeRef.current;
    if (marquee) {
      marqueeRef.current = null;
      if (canvasPressTimer.current) { window.clearTimeout(canvasPressTimer.current); canvasPressTimer.current = null; }
      clearLive();
      const rect = {
        x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1),
        w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0),
      };
      if (rect.w < 3 && rect.h < 3) return; // simple clic sur le fond : déjà désélectionné
      const hit = (p?.objects ?? []).filter((o) => rectsIntersect(objectRect(o), rect)).map((o) => o.id);
      setSelectedIds((prev) => (marquee.additive ? new Set([...prev, ...hit]) : new Set(hit)));
      // L'encre aussi : un trait est pris s'il passe dans le rectangle
      const inkHit = (p?.strokes ?? []).filter((st) => st.points.some((pt) => rectContains(rect, pt.x, pt.y))).map((st) => st.id);
      setSelectedStrokeIds((prev) => (marquee.additive ? new Set([...prev, ...inkHit]) : new Set(inkHit)));
      return;
    }
    if (eraserMode.current) {
      eraserMode.current = false;
      const start = eraseStartStrokes.current ?? [];
      const end = eraseWorking.current ?? [];
      eraseStartStrokes.current = null;
      eraseWorking.current = null;
      if (p) {
        const endIds = new Set(end.map((s) => s.id));
        const startIds = new Set(start.map((s) => s.id));
        const removed = start.filter((s) => !endIds.has(s.id));
        const added = end.filter((s) => !startIds.has(s.id));
        if (removed.length > 0 || added.length > 0) pushOp(p.id, { type: 'replace', removed, added });
      }
      if (e.pointerType === 'touch') clearLive();
      else { const { x, y } = toUnit(e); drawEraserCursor(x, y); }
      return;
    }

    const stroke = currentStroke.current;
    currentStroke.current = null;
    const live = liveRef.current;
    const lctx = live?.getContext('2d');
    if (live && lctx) {
      const dpr = window.devicePixelRatio || 1;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, live.width / dpr, live.height / dpr);
    }
    if (!stroke || !p) return;
    // Mode « formes auto » : chaque trait est reconnu au relâchement
    if (autoShapesRef.current && stroke.tool === 'pen' && stroke.points.length >= 8) {
      const rec = recognizeShape(stroke.points);
      if (rec && convertStroke(stroke, rec)) return;
    }
    pushOp(p.id, { type: 'add', stroke });
    updatePage(p.id, (pg) => ({ ...pg, strokes: [...pg.strokes, stroke] }));
  }, [pushOp, updatePage, clearLive, drawEraserCursor, toUnit, convertStroke, addShape]);

  // Changement d'outil : on efface le cercle de gomme éventuel
  useEffect(() => {
    if (tool !== 'eraser') clearLive();
  }, [tool, clearLive]);

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Saisie en cours dans une zone de texte : le clavier lui appartient
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const hasSelection = selectedIdsRef.current.size > 0 || selectedStrokeIdsRef.current.size > 0;
      if (ctrl && e.key === 'Enter') { e.preventDefault(); addPage(); }
      else if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) applyRedo(); else applyUndo(); }
      else if (ctrl && k === 'y') { e.preventDefault(); applyRedo(); }
      else if (ctrl && k === 'a' && OBJECT_TOOLS.includes(toolRef.current)) { e.preventDefault(); selectAll(); }
      else if (ctrl && !e.shiftKey && k === 'k') { e.preventDefault(); setSearchOpen(true); }
      else if (ctrl && k === 'c' && hasSelection) { e.preventDefault(); copySelected(); }
      else if (ctrl && k === 'x' && hasSelection) { e.preventDefault(); cutSelected(); }
      else if (ctrl && k === 'd' && hasSelection) { e.preventDefault(); duplicateSelected(); }
      else if (ctrl && e.shiftKey && k === 'k' && hasSelection) { e.preventDefault(); toggleLockSelected(); }
      else if (ctrl && (e.key === ']' || e.key === '[') && hasSelection) {
        e.preventDefault();
        reorderSelected(e.key === ']' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward'));
      }
      else if (!ctrl && hasSelection && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); deleteSelected(); deleteSelectedStrokes(); }
      else if (!ctrl && hasSelection && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudgeSelected(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
      }
      else if (!ctrl && e.key === 'Escape') { setEditingId(null); setSelectedIds(new Set()); setSelectedStrokeIds(new Set()); setMenu(null); setRadial(null); setSpotlight(false); }
      else if (ctrl && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomAt(1.2, window.innerWidth / 2, window.innerHeight / 2); }
      else if (ctrl && e.key === '-') { e.preventDefault(); zoomAt(1 / 1.2, window.innerWidth / 2, window.innerHeight / 2); }
      else if (ctrl && e.key === '0') { e.preventDefault(); setView(IDENTITY_VIEW); }
      else if (!ctrl && !e.altKey) {
        if (k === 'p') setTool('pen');
        else if (k === 's') setTool('highlighter');
        else if (k === 'e') setTool('eraser');
        else if (k === 't') setTool('text');
        else if (k === 'v') setTool('select');
        else if (k === 'f') setTool('shape');
        else if (k === 'l') setTool('laser');
        else if (k === 'n') setNavOpen((v) => !v);
        else if (k === 'pageup') setPageIndex((i) => Math.max(0, i - 1));
        else if (k === 'pagedown') setPageIndex((i) => Math.min(pagesRef.current.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyUndo, applyRedo, addPage, selectAll, copySelected, cutSelected, pasteFromClipboard, duplicateSelected, toggleLockSelected, reorderSelected, deleteSelected, deleteSelectedStrokes, nudgeSelected, zoomAt]);

  useEffect(() => {
    if (!insertOpen && !settingsOpen) return;
    const onDown = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.wbi__panel')) { setInsertOpen(false); setSettingsOpen(false); } };
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', onDown, true); };
  }, [insertOpen, settingsOpen]);

  // -- Gestes TBI : deux doigts = pincer-zoomer / menu radial (immobiles) / tap = annuler ;
  //    trois doigts = tap rétablir, balayage = changer de page --
  const onStagePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !tbiRef.current.gestures) return;
    touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = touchPoints.current;
    if (pts.size === 2) {
      cancelCanvasInput();
      const [a, b] = Array.from(pts.values());
      const g: TouchGesture = {
        kind: 'pending', startAt: Date.now(), ids: Array.from(pts.keys()), startPoints: new Map(pts),
        startDist: Math.hypot(b.x - a.x, b.y - a.y), startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startView: viewRef.current, timer: null, moved: false,
      };
      g.timer = window.setTimeout(() => {
        if (gesture.current === g && g.kind === 'pending' && !g.moved) {
          g.kind = 'done';
          setRadial({ x: g.startMid.x, y: g.startMid.y });
        }
      }, RADIAL_HOLD_MS);
      gesture.current = g;
    } else if (pts.size === 3 && gesture.current) {
      const g = gesture.current;
      if (g.timer) { window.clearTimeout(g.timer); g.timer = null; }
      g.kind = 'three';
      g.startAt = Date.now();
      g.startPoints = new Map(pts);
      g.moved = false;
    }
  }, [cancelCanvasInput]);

  const onStagePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const pts = touchPoints.current;
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const start = g.startPoints.get(e.pointerId);
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) g.moved = true;
    if (g.kind === 'pending' && g.moved) {
      g.kind = 'pinch';
      if (g.timer) { window.clearTimeout(g.timer); g.timer = null; }
    }
    if (g.kind === 'pinch' && pts.size >= 2) {
      const [a, b] = g.ids.map((id) => pts.get(id)).filter((p): p is { x: number; y: number } => !!p);
      if (!a || !b) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const v0 = g.startView;
      const z = Math.max(1, Math.min(MAX_ZOOM, (v0.zoom * dist) / Math.max(1, g.startDist)));
      // Le point de la page sous le milieu des doigts au départ reste sous le milieu actuel
      const mx0 = g.startMid.x - rect.left, my0 = g.startMid.y - rect.top;
      const mx = mid.x - rect.left, my = mid.y - rect.top;
      let tx = mx - ((mx0 - v0.tx) * z) / v0.zoom;
      let ty = my - ((my0 - v0.ty) * z) / v0.zoom;
      if (z === 1) { tx = 0; ty = 0; }
      setView({ zoom: z, tx, ty });
    }
  }, []);

  const onStagePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const pts = touchPoints.current;
    if (!pts.has(e.pointerId)) return;
    const g = gesture.current;
    pts.delete(e.pointerId);
    if (!g) return;
    if (pts.size === 0) {
      gesture.current = null;
      if (g.timer) window.clearTimeout(g.timer);
      const quick = Date.now() - g.startAt < MULTI_TAP_MS && !g.moved;
      if (g.kind === 'pending' && quick) applyUndo();
      else if (g.kind === 'three') {
        if (quick) applyRedo();
        else {
          // Balayage horizontal à trois doigts : page suivante / précédente
          const dxs = Array.from(g.startPoints.entries()).map(([id, p0]) => (touchPoints.current.get(id)?.x ?? e.clientX) - p0.x);
          const dx = dxs.reduce((a, b) => a + b, 0) / Math.max(1, dxs.length);
          if (Math.abs(dx) > 80) setPageIndex((i) => Math.max(0, Math.min(pagesRef.current.length - 1, i + (dx < 0 ? 1 : -1))));
        }
      }
    }
  }, [applyUndo, applyRedo]);

  // Ctrl + molette : zoom à la souris ; Échap ferme projecteur et menu radial
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);


  const radialItems: RadialItem[] = [
    { id: 'pen', label: 'Stylo', icon: '✏️', active: tool === 'pen', onSelect: () => setTool('pen') },
    { id: 'hl', label: 'Surligneur', icon: '🖍️', active: tool === 'highlighter', onSelect: () => setTool('highlighter') },
    { id: 'eraser', label: 'Gomme', icon: '🧽', active: tool === 'eraser', onSelect: () => setTool('eraser') },
    { id: 'select', label: 'Sélection', icon: '⬚', active: tool === 'select', onSelect: () => setTool('select') },
    { id: 'next', label: 'Page +', icon: '⏭', disabled: pageIndex >= pages.length - 1, onSelect: () => setPageIndex((i) => Math.min(pages.length - 1, i + 1)) },
    { id: 'undo', label: 'Annuler', icon: '↶', disabled: historyLen === 0, onSelect: applyUndo },
    { id: 'redo', label: 'Rétablir', icon: '↷', disabled: redoLen === 0, onSelect: applyRedo },
    { id: 'prev', label: 'Page −', icon: '⏮', disabled: pageIndex === 0, onSelect: () => setPageIndex((i) => Math.max(0, i - 1)) },
  ];

  // Collage : une image du presse-papiers devient un objet image, du texte une zone de texte ;
  // sinon les objets copiés dans le tableau (presse-papiers interne).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      const dt = e.clipboardData;
      if (!dt) return;
      const imageFile = Array.from(dt.files).find(isImageFile)
        ?? Array.from(dt.items).find((it) => it.kind === 'file' && it.type.startsWith('image/'))?.getAsFile()
        ?? null;
      if (imageFile) {
        e.preventDefault();
        void importFiles([imageFile]);
        return;
      }
      if (clipboardHasObjects()) {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }
      const html = dt.getData('text/html');
      const text = dt.getData('text/plain');
      if (!html && !text.trim()) return;
      e.preventDefault();
      const p = pagesRef.current[pageIndexRef.current];
      if (!p) return;
      // Une adresse seule → vidéo ou lien ; du texte tabulé (tableur) → tableau
      if (looksLikeUrl(text)) { insertFromUrl(text); return; }
      const tsv = tableFromTsv(text);
      if (tsv && !html.includes('<img')) { insertTable(tsv.rows, tsv.cols, tsv.cells); return; }
      const escaped = text.split(/\r?\n/).map((l) => `<div>${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c) || '<br>'}</div>`).join('');
      const box: TextObject = {
        id: uid(), type: 'text', x: 80, y: 80, w: Math.round(UNIT * 0.6), size: textSize, font: textFont, color,
        html: html ? sanitizePastedHtml(html) : escaped,
      };
      handleObjectsChange([...(p.objects ?? []), box], p.objects ?? []);
      setSelectedIds(new Set([box.id]));
      if (!OBJECT_TOOLS.includes(toolRef.current)) setTool('select');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importFiles, pasteFromClipboard, handleObjectsChange, textSize, textFont, color, insertFromUrl, insertTable]);

  // Le tableau occupe tout l'ecran : on fige le defilement de la page dessous.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const pageCount = pages.length;
  const selectedTexts = pageObjects.filter((o): o is TextObject => o.type === 'text' && (o.id === editingId || selectedIds.has(o.id)));
  /** Zone de texte « active » pour la barre : celle en saisie, sinon la seule sélectionnée. */
  const selectedBox = (editingId ? selectedTexts.find((o) => o.id === editingId) : selectedTexts.length === 1 ? selectedTexts[0] : null) ?? null;
  const showTextToolbar = tool === 'text' || (tool === 'select' && selectedTexts.length > 0);
  const selectedShapes = pageObjects.filter((o): o is ShapeObject => o.type === 'shape' && selectedIds.has(o.id));
  const selectedLibrary = pageObjects.filter((o): o is LibraryObject => o.type === 'library' && selectedIds.has(o.id));
  const showShapeToolbar = !showTextToolbar && (tool === 'shape' || (tool === 'select' && (selectedShapes.length > 0 || selectedLibrary.length > 0)));
  const inkSelection = selectedStrokeIds.size > 0 ? strokesBounds(page.strokes.filter((st) => selectedStrokeIds.has(st.id))) : null;
  /** Applique un réglage de zone (police, taille, couleur) à toutes les zones de texte sélectionnées. */
  const patchSelectedTexts = (fn: (o: TextObject) => TextObject) => {
    if (selectedTexts.length === 0) return;
    const ids = new Set(selectedTexts.map((o) => o.id));
    handleObjectsChange(pageObjects.map((o) => (o.type === 'text' && ids.has(o.id) ? fn(o) : o)), pageObjects);
  };

  return (
    <div
      className={`wb ${dragOver ? 'is-dragover' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(e.dataTransfer.files, toUnit(e)); }}
    >
      <style>{CSS}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept={`application/pdf,image/*,${GCBOARD_EXTENSION}`}
        multiple
        hidden
        onChange={(e) => { if (e.target.files) void importFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertAudio(f, f.name.replace(/\.[^.]+$/, '')); e.target.value = ''; }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { if (e.target.files) void importFiles(e.target.files, dropPoint.current ?? undefined); dropPoint.current = null; e.target.value = ''; }}
      />
      {importing && (
        <div className="wb__import">
          <div className="wb__import-box">
            <div className="wb__import-title">Import en cours</div>
            <div className="wb__import-label">{importing.label}</div>
            <div className="wb__import-bar"><i style={{ width: `${importing.total ? Math.round((importing.done / importing.total) * 100) : 0}%` }} /></div>
          </div>
        </div>
      )}
      <div
        className={`wb__stage ${view.zoom > 1 ? 'is-zoomed' : ''}`}
        ref={containerRef}
        style={{ marginRight: navOpen ? 232 : 0 }}
        onPointerDownCapture={onStagePointerDown}
        onPointerMoveCapture={onStagePointerMove}
        onPointerUpCapture={onStagePointerUp}
        onPointerCancelCapture={onStagePointerUp}
      >
      <div className="wb__view" style={{ transform: view.zoom === 1 ? undefined : `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})` }}>
        <canvas ref={bgRef} className="wb__layer" />
        <canvas ref={mainRef} className="wb__layer" />
        <canvas
          ref={liveRef}
          className={`wb__layer wb__input wb__input--${tool}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onPointerLeave={() => { if (activePointer.current === null && toolRef.current === 'eraser') clearLive(); }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (OBJECT_TOOLS.includes(toolRef.current)) openCanvasMenu(e.clientX, e.clientY, toUnit(e));
          }}
        />
        <BoardObjectLayer
          ref={textApiRef}
          objects={pageObjects}
          stage={stageBox}
          scale={textScale}
          active={OBJECT_TOOLS.includes(tool)}
          selectedIds={selectedIds}
          editingId={editingId}
          onSelect={setSelectedIds}
          onEdit={setEditingId}
          onChange={handleObjectsChange}
          onFormatState={setFormat}
          onNewPage={addPage}
          onContextMenu={openObjectMenu}
          reveal={reveal}
          onRevealObject={revealObject}
          onRevealGap={revealGap}
          onTableCell={(id, r, c) => { tableCellRef.current = { id, r, c }; }}
          onEquationCommit={(id, latex, raster, ratio) => void onEquationCommit(id, latex, raster, ratio)}
          onWidgetConfig={onWidgetConfig}
          onToggleInteractive={onToggleInteractive}
        />
        {page.curtain && pageRevealedFraction(reveal, page.id) < 1 && (() => {
          const f = pageRevealedFraction(reveal, page.id);
          return (
            <div
              className="wb__curtain"
              style={{ left: stageBox.left, top: stageBox.top + stageBox.height * f, width: stageBox.width, height: stageBox.height * (1 - f) }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="wb__curtain-edge"
                title="Glisser pour découvrir petit à petit"
                onPointerDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  curtainDrag.current = { pointerId: e.pointerId };
                }}
                onPointerMove={(e) => {
                  if (!curtainDrag.current || e.pointerId !== curtainDrag.current.pointerId) return;
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect || stageBox.height === 0) return;
                  setPageReveal(page.id, (e.clientY - rect.top - stageBox.top) / stageBox.height);
                }}
                onPointerUp={(e) => { curtainDrag.current = null; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ } }}
              />
              <div className="wb__curtain-actions">
                <button type="button" onClick={() => setPageReveal(page.id, 1)}>Tout découvrir</button>
                {f > 0 && <button type="button" onClick={() => setPageReveal(page.id, 0)}>Recouvrir</button>}
              </div>
            </div>
          );
        })()}
        {inkSelection && tool === 'select' && (
          <div
            className="wb__inksel"
            style={{
              left: stageBox.left + inkSelection.x * textScale - 8,
              top: stageBox.top + inkSelection.y * textScale - 8,
              width: inkSelection.w * textScale + 16,
              height: inkSelection.h * textScale + 16,
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              e.preventDefault(); e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const mode = (e.target as HTMLElement).classList.contains('wb__inksel-scale') ? 'scale' : 'move';
              inkDrag.current = { mode, startX: e.clientX, startY: e.clientY, originals: selectedStrokes(), box: inkSelection, pointerId: e.pointerId };
            }}
            onPointerMove={(e) => {
              const d = inkDrag.current;
              const p = pagesRef.current[pageIndexRef.current];
              if (!d || e.pointerId !== d.pointerId || !p) return;
              const dx = (e.clientX - d.startX) / scaleRef.current;
              const dy = (e.clientY - d.startY) / scaleRef.current;
              const k = d.mode === 'scale' && d.box.w > 0 ? Math.max(0.1, (d.box.w + dx) / d.box.w) : 1;
              const moved = new Map(d.originals.map((st) => [st.id, d.mode === 'move'
                ? { ...st, points: st.points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) }
                : { ...st, size: st.size * k, points: st.points.map((pt) => ({ ...pt, x: d.box.x + (pt.x - d.box.x) * k, y: d.box.y + (pt.y - d.box.y) * k })) }]));
              updatePage(p.id, (pg) => ({ ...pg, strokes: pg.strokes.map((st) => moved.get(st.id) ?? st) }));
            }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openInkMenu(e.clientX, e.clientY); }}
            onPointerUp={(e) => {
              const d = inkDrag.current;
              if (!d || e.pointerId !== d.pointerId) return;
              inkDrag.current = null;
              try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
              const next = selectedStrokes();
              if (next.some((st, i) => st !== d.originals[i])) replaceSelectedStrokes(d.originals, next);
            }}
          >
            <span className="wb__inksel-label">{selectedStrokeIds.size} trait{selectedStrokeIds.size > 1 ? 's' : ''}</span>
            <button type="button" className="wb__inksel-text" title="Convertir l'écriture en texte" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={() => void convertInkToText()}>Aa</button>
            <div className="wb__inksel-scale" title="Agrandir / réduire" />
            <button type="button" className="wb__inksel-del" title="Supprimer l'encre (Suppr)" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={deleteSelectedStrokes}>✕</button>
          </div>
        )}
        {instruments.length > 0 && <BoardInstruments instruments={instruments} stage={stageBox} scale={textScale} onChange={setInstruments} />}
      </div>
        {view.zoom > 1 && (
          <div className="wb__zoom" onPointerDown={(e) => e.stopPropagation()}>
            <span>{Math.round(view.zoom * 100)} %</span>
            <button type="button" onClick={() => setView(IDENTITY_VIEW)} title="Revenir à 100 % (Ctrl+0)">Vue entière</button>
          </div>
        )}
      </div>
      {radial && <BoardRadialMenu x={radial.x} y={radial.y} items={radialItems} onClose={() => setRadial(null)} />}
      {spotlight && <BoardSpotlight onClose={() => setSpotlight(false)} />}
      {keyboardOpen && <BoardKeyboard onClose={() => setKeyboardOpen(false)} />}
      {pickOpen && classroom && (
        <BoardPickOverlay
          students={classroom.students}
          alreadyPicked={pickedIds}
          onPicked={onPicked}
          onStamp={sendStamp}
          onResetPool={() => setPickedIds(new Set())}
          onClose={() => setPickOpen(false)}
        />
      )}
      {cameraOffer && classroom && (
        <BoardCameraOverlay key={cameraOffer.slice(0, 40)} bus={classroom.bus} offer={cameraOffer} onCapture={(blob) => void onCameraCapture(blob)} onClose={() => setCameraOffer(null)} />
      )}
      {libraryOpen && (
        <BoardLibraryPanel
          onClose={() => setLibraryOpen(false)}
          onInsertItem={insertLibraryItem}
          onInsertFiles={(files) => importFiles(files)}
          onInsertText={(html) => { const obj: TextObject = { id: uid(), type: 'text', ...centered(520, 120), w: 520, size: 22, font: textFont, color, html }; addObject(obj); }}
          onInsertImageUrl={async (url) => { const img = await uploadBoardImage(await fetchImageBlob(url), userId, sessionId); insertImage(img); }}
          onInsertImageBlob={async (blob) => { const img = await uploadBoardImage(blob, userId, sessionId); insertImage(img); }}
        />
      )}
      {searchOpen && (
        <BoardSearchPanel
          onClose={() => setSearchOpen(false)}
          onInsertImage={async (blob) => { const img = await uploadBoardImage(blob, userId, sessionId); insertImage(img); }}
          onInsertVideo={(url) => insertFromUrl(url)}
          onInsertLink={(url, label) => {
            const obj: LinkObject = { id: uid(), type: 'link', ...centered(420, 44), w: Math.min(640, Math.max(220, label.length * 12 + 60)), url, label, size: 22 };
            addObject(obj);
          }}
          onInsertText={(html) => {
            const obj: TextObject = { id: uid(), type: 'text', ...centered(520, 120), w: 520, size: 22, font: textFont, color, html };
            addObject(obj);
          }}
        />
      )}

      {navOpen && (
        <BoardPageNavigator
          pages={pages}
          pageIndex={pageIndex}
          onSelect={setPageIndex}
          onReorder={movePage}
          onContextMenu={openPageMenu}
          onAddPage={addPage}
        />
      )}
      {menu && <BoardContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
      {exportOpen && <BoardExportDialog pages={pages} name="Tableau" currentIndex={pageIndex} onClose={() => setExportOpen(false)} />}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCoverImageChosen(f); e.target.value = ''; }}
      />

      {ticker && <div className="wb__ticker" key={ticker}>{ticker}</div>}

      <div className={`wb__bar wb__bar--${tbi.bar} wb__bar--hand-${tbi.hand}`} style={tbi.bar === 'bottom' ? { marginLeft: navOpen ? -116 : 0 } : { right: tbi.bar === 'right' && navOpen ? 242 : undefined }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="wb__group">
          <button className={`wb__btn ${tool === 'select' ? 'is-on' : ''}`} onClick={() => setTool('select')} title="Sélection (V)">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.5L16 20l-3 1-3-7.5L5 17z" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'pen' ? 'is-on' : ''}`} onClick={() => setTool('pen')} title="Stylo (P)">
            <svg viewBox="0 0 24 24"><path d="M3 21l3.5-.8L19 7.7a2 2 0 0 0 0-2.8l-.9-.9a2 2 0 0 0-2.8 0L2.8 16.5 2 20z" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'highlighter' ? 'is-on' : ''}`} onClick={() => setTool('highlighter')} title="Surligneur (S)">
            <svg viewBox="0 0 24 24"><path d="M4 20h16M6 16l9.5-9.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L9 19H6z" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'eraser' ? 'is-on' : ''}`} onClick={() => setTool('eraser')} title="Gomme (E)">
            <svg viewBox="0 0 24 24"><path d="M20 20H8M4.5 14.5l8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 18H8.8a2 2 0 0 1-1.4-.6L4.5 14.5z" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'text' ? 'is-on' : ''}`} onClick={() => setTool('text')} title="Texte au clavier (T)">
            <svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'shape' ? 'is-on' : ''}`} onClick={() => setTool('shape')} title="Formes (F)">
            <svg viewBox="0 0 24 24"><path d="M3 21h8l-4-8zM14 4h6v6h-6zM17 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
          </button>
          <button className={`wb__btn ${tool === 'laser' ? 'is-on' : ''}`} onClick={() => setTool('laser')} title="Pointeur laser (L) : trait qui s'efface seul">
            <svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /></svg>
          </button>
        </div>

        {showTextToolbar ? (
          <BoardTextToolbar
            api={textApiRef}
            format={format}
            box={selectedBox}
            editing={editingId !== null}
            fontId={selectedBox?.font ?? textFont}
            size={selectedBox?.size ?? textSize}
            color={color}
            colors={COLORS}
            highlights={TEXT_HIGHLIGHTS}
            onFontChange={(id) => {
              setTextFont(id);
              if (editingId) textApiRef.current?.applyFontFamily(id);
              else patchSelectedTexts((o) => ({ ...o, font: id }));
            }}
            onSizeChange={(size) => {
              setTextSize(size);
              if (editingId) textApiRef.current?.applyFontSize(size);
              else patchSelectedTexts((o) => ({ ...o, size }));
            }}
            onColor={(c) => {
              setColor(c);
              if (editingId) textApiRef.current?.applyColor(c);
              else patchSelectedTexts((o) => ({ ...o, color: c }));
            }}
            onDelete={deleteSelected}
            gapCount={selectedBox ? gapIdsIn(selectedBox.html).length : 0}
            onGap={() => textApiRef.current?.makeGap()}
            onRevealGaps={() => { if (selectedBox) revealAllGaps(selectedBox.id); }}
            onRemoveGaps={() => {
              if (editingId) textApiRef.current?.removeGaps();
              else patchSelectedTexts((o) => ({ ...o, html: stripGapsHtml(o.html) }));
            }}
          />
        ) : showShapeToolbar ? (
          <BoardShapeToolbar
            kind={shapeKind}
            style={selectedShapes[0] ? { stroke: selectedShapes[0].stroke, strokeWidth: selectedShapes[0].strokeWidth, fill: selectedShapes[0].fill, dashed: selectedShapes[0].dashed === true } : selectedLibrary[0] ? { stroke: selectedLibrary[0].stroke, strokeWidth: selectedLibrary[0].strokeWidth, fill: selectedLibrary[0].fill, dashed: false } : shapeStyle}
            selected={selectedShapes}
            onKind={(k) => {
              setShapeKind(k);
              if (selectedShapes.length > 0) patchSelectedShapes((o) => ({ ...o, kind: k, h: isLineKind(k) ? o.h : Math.max(o.h, MIN_SHAPE_H), points: undefined }));
            }}
            onStyle={(patch) => {
              setShapeStyle((st) => ({ ...st, ...patch }));
              patchSelectedShapes((o) => ({ ...o, ...patch }));
              if (selectedLibrary.length > 0) {
                const ids = new Set(selectedLibrary.map((o) => o.id));
                handleObjectsChange(pageObjects.map((o) => (o.type === 'library' && ids.has(o.id) ? { ...o, ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}), ...(patch.fill !== undefined ? { fill: patch.fill } : {}), ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}) } : o)), pageObjects);
              }
            }}
            onLineKind={(k) => patchSelectedShapes((o) => (isLineKind(o.kind) ? { ...o, kind: k } : o))}
            onDelete={deleteSelected}
          />
        ) : (
        <>
        <div className="wb__group">
          <BoardColorPicker
            value={color}
            muted={tool === 'highlighter'}
            onChange={(c) => { setColor(c); if (tool === 'eraser' || tool === 'highlighter') setTool('pen'); }}
            title="Couleur du stylo"
          />
          {tool === 'pen' && (
            <button className={`wb__btn ${autoShapes ? 'is-on' : ''}`} onClick={() => setAutoShapes((v) => !v)} title="Formes automatiques : chaque trait fermé ou droit devient une forme (sinon, garder le stylet immobile en fin de tracé)">
              <svg viewBox="0 0 24 24"><path d="M4 20c4-9 9-13 16-16M14 4h6v6M6 14a3 3 0 1 1 0 .1" /></svg>
            </button>
          )}
        </div>

        <div className="wb__group">
          {tool === 'eraser'
            ? (Object.keys(ERASER_SIZES) as SizeKey[]).map((k) => (
                <button key={k} className={`wb__btn wb__size wb__size--eraser ${eraserKey === k ? 'is-on' : ''}`} onClick={() => setEraserKey(k)} title={`Diamètre de gomme ${k}`}>
                  <i style={{ width: 8 + ERASER_SIZES[k] * 0.9, height: 8 + ERASER_SIZES[k] * 0.9 }} />
                </button>
              ))
            : (Object.keys(SIZES) as SizeKey[]).map((k) => (
                <button key={k} className={`wb__btn wb__size ${sizeKey === k ? 'is-on' : ''}`} onClick={() => setSizeKey(k)} title={`Épaisseur ${k}`}>
                  <i style={{ width: 6 + SIZES[k] * 2, height: 6 + SIZES[k] * 2 }} />
                </button>
              ))}
        </div>

        <div className="wb__group">
          <button className="wb__btn" onClick={applyUndo} disabled={historyLen === 0} title="Annuler (Ctrl+Z)">
            <svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
          </button>
          <button className="wb__btn" onClick={applyRedo} disabled={redoLen === 0} title="Rétablir (Ctrl+Y)">
            <svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>
          </button>
          <button className="wb__btn" onClick={clearPage} disabled={page.strokes.length === 0 && pageObjects.length === 0} title="Effacer la page">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
          </button>
        </div>

        <div className="wb__group">
          <button className={`wb__btn wb__bg ${page.background === 'blank' ? 'is-on' : ''}`} onClick={() => setBackground('blank')} title="Fond blanc">
            <span />
          </button>
          <button className={`wb__btn wb__bg wb__bg--grid ${page.background === 'grid' ? 'is-on' : ''}`} onClick={() => setBackground('grid')} title="Quadrillage">
            <span />
          </button>
          <button className={`wb__btn wb__bg wb__bg--lines ${page.background === 'lines' ? 'is-on' : ''}`} onClick={() => setBackground('lines')} title="Lignes">
            <span />
          </button>
        </div>
        </>
        )}

        <div className="wb__group">
          <button className="wb__btn" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} title="Page précédente">
            <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <span className="wb__pages">{pageIndex + 1} / {pageCount}</span>
          <button className="wb__btn" onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))} disabled={pageIndex >= pageCount - 1} title="Page suivante">
            <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <button className="wb__btn" onClick={addPage} title="Nouvelle page (Ctrl+Entrée)">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className={`wb__btn ${insertOpen ? 'is-on' : ''}`} onClick={() => setInsertOpen((v) => !v)} title="Insérer : tableau, vidéo, site, son, lien, post-it, équation, minuteur, dé, roue…">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14M4 4h16v16H4z" /></svg>
            </button>
            {insertOpen && (
              <div className="wbi__panel" onPointerDown={(e) => e.stopPropagation()}>
                {[
                  { label: 'Tableau 3 × 3', icon: '▦', run: () => insertTable(3, 3) },
                  { label: 'Vidéo (YouTube…)', icon: '▶', run: () => { const u = window.prompt('Adresse de la vidéo (YouTube, Vimeo, PeerTube…)'); if (u) insertFromUrl(u); } },
                  { label: 'Site web', icon: '🌐', run: () => { const u = window.prompt('Adresse du site'); if (u) insertWeb(u); } },
                  { label: 'Lien', icon: '🔗', run: () => { const u = window.prompt('Adresse du lien'); if (u) insertFromUrl(u); } },
                  { label: 'Son (fichier)', icon: '🔊', run: () => audioInputRef.current?.click() },
                  { label: recording ? 'Arrêter l\'enregistrement' : 'Enregistrer au micro', icon: recording ? '⏹' : '🎙', run: () => void toggleRecording() },
                  { label: 'Post-it', icon: '🗒', run: () => insertSticky() },
                  { label: 'Équation (LaTeX)', icon: '∑', run: insertEquation },
                  ...(['timer', 'dice', 'wheel', 'noise', 'calc'] as WidgetKind[]).map((k) => ({ label: WIDGET_LABELS[k], icon: { timer: '⏱', dice: '🎲', wheel: '🎡', noise: '🔔', calc: '🧮' }[k], run: () => insertWidget(k) })),
                ].map((it) => (
                  <button key={it.label} type="button" className="wbi__item" onClick={() => { it.run(); setInsertOpen(false); }}>
                    <span>{it.icon}</span>{it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="wb__btn" onClick={() => { dropPoint.current = null; imageInputRef.current?.click(); }} disabled={!!importing} title="Insérer une image (ou coller, ou glisser-déposer)">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01" /></svg>
          </button>
          <button className="wb__btn" onClick={() => fileInputRef.current?.click()} disabled={!!importing} title={`Ouvrir un tableau (${GCBOARD_EXTENSION}), un PDF ou une image`}>
            <svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
          </button>
          <button className="wb__btn" onClick={() => void saveGcboard()} disabled={!!importing} title={`Enregistrer le tableau (${GCBOARD_EXTENSION}, ré-ouvrable avec ses images)`}>
            <svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" /></svg>
          </button>
          <button className="wb__btn" onClick={recoverCurrentPage} title="Tout recouvrir sur cette page (rideaux, tickets, trous)">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 12h16M8 5v14" /></svg>
          </button>
          <button className="wb__btn" onClick={() => setExportOpen(true)} title="Exporter en PDF (choix des pages, version élève ou corrigée)">
            <svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>
          </button>
          {classroom && (
            <button className={`wb__btn ${pickOpen ? 'is-on' : ''}`} onClick={() => setPickOpen(true)} title="Tirage au sort d'un élève (sans remise, absents exclus)">
              <svg viewBox="0 0 24 24"><path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0M17 4l2 2M19 4l-2 2" /></svg>
            </button>
          )}
          <button className={`wb__btn ${libraryOpen ? 'is-on' : ''}`} onClick={() => setLibraryOpen(true)} title="Ressources : bibliothèque d'objets (verrerie, cellules, circuits…), annales, Notion, Drive">
            <svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
          </button>
          <button className={`wb__btn ${searchOpen ? 'is-on' : ''}`} onClick={() => setSearchOpen(true)} title="Rechercher (web, vidéos, images) — Ctrl+K">
            <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8" /></svg>
          </button>
          <button className={`wb__btn ${keyboardOpen ? 'is-on' : ''}`} onClick={() => setKeyboardOpen((v) => !v)} title="Clavier virtuel">
            <svg viewBox="0 0 24 24"><path d="M3 6h18v12H3zM6 9h2M10 9h2M14 9h2M18 9h0M6 12h2M10 12h2M14 12h2M18 12h0M7 15h10" /></svg>
          </button>
          <div style={{ position: 'relative' }}>
            <button className={`wb__btn ${settingsOpen ? 'is-on' : ''}`} onClick={() => setSettingsOpen((v) => !v)} title="Tableau interactif : gestes, position de la barre, instruments, projecteur">
              <svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" /></svg>
            </button>
            {settingsOpen && (
              <div className="wbi__panel wbi__panel--settings" onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className={`wbi__item ${tbi.gestures ? 'is-on' : ''}`} onClick={() => setTbi((t) => ({ ...t, gestures: !t.gestures }))}><span>✌️</span>Gestes à deux doigts {tbi.gestures ? 'activés' : 'désactivés'}</button>
                <button type="button" className="wbi__item" onClick={() => setRadial({ x: window.innerWidth / 2, y: window.innerHeight / 2 })}><span>◎</span>Menu radial</button>
                {(['bottom', 'left', 'right'] as BarSide[]).map((side) => (
                  <button key={side} type="button" className={`wbi__item ${tbi.bar === side ? 'is-on' : ''}`} onClick={() => setTbi((t) => ({ ...t, bar: side }))}><span>▭</span>Barre en {side === 'bottom' ? 'bas' : side === 'left' ? 'à gauche' : 'à droite'}</button>
                ))}
                {(['left', 'center', 'right'] as const).map((hand) => (
                  <button key={hand} type="button" className={`wbi__item ${tbi.hand === hand ? 'is-on' : ''}`} onClick={() => setTbi((t) => ({ ...t, hand }))}><span>🖐</span>{hand === 'left' ? 'Je suis à gauche' : hand === 'right' ? 'Je suis à droite' : 'Barre centrée'}</button>
                ))}
                <label className="wbi__item" style={{ cursor: 'default' }}>
                  <span>▦</span>
                  <select className="wb__select" value={page.background} onChange={(e) => setBackground(e.target.value as Background)} style={{ flex: 1 }}>
                    {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>Fond : {b.label}</option>)}
                  </select>
                </label>
                <button type="button" className="wbi__item" onClick={() => addInstrument('ruler')}><span>📏</span>Règle</button>
                <button type="button" className="wbi__item" onClick={() => addInstrument('setsquare')}><span>📐</span>Équerre</button>
                <button type="button" className="wbi__item" onClick={() => addInstrument('protractor')}><span>🧭</span>Rapporteur</button>
                <button type="button" className="wbi__item" onClick={() => setSpotlight(true)}><span>🔦</span>Projecteur</button>
                <button type="button" className="wbi__item" onClick={() => zoomAt(1.5, window.innerWidth / 2, window.innerHeight / 2)}><span>🔍</span>Zoom + (Ctrl+molette)</button>
              </div>
            )}
          </div>
          <button className={`wb__btn ${navOpen ? 'is-on' : ''}`} onClick={() => setNavOpen((v) => !v)} title="Navigateur de pages (N)">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM14 5v14M16 9h2M16 12h2M16 15h2" /></svg>
          </button>
        </div>

        <div className="wb__group">
          <button className="wb__btn wb__close" onClick={onClose} title="Retour au plan de classe">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v11H4zM8 20h8M12 16v4" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.wb { position: fixed; inset: 0; z-index: 100; background: #FFFFFF; display: flex; flex-direction: column; user-select: none; }
.wb__stage { position: relative; flex: 1; min-height: 0; overflow: hidden; background: #1F2937; touch-action: none; }
.wb__view { position: absolute; inset: 0; transform-origin: 0 0; }
.wb__zoom { position: absolute; left: 14px; top: 14px; z-index: 5; display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; border-radius: 10px; background: rgba(17,24,39,0.9); color: #F9FAFB; font: 600 13px/1 Inter, system-ui, sans-serif; }
.wb__zoom button { height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: #4F46E5; color: #FFFFFF; font: 600 12px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wb__bar--left, .wb__bar--right { left: 10px; right: auto; top: 10px; bottom: 10px; transform: none; flex-direction: column; max-width: none; max-height: calc(100vh - 20px); overflow-x: hidden; overflow-y: auto; }
.wb__bar--right { left: auto; right: 10px; }
.wb__bar--left .wb__group, .wb__bar--right .wb__group { flex-direction: column; padding: 6px 0; border-right: 0; border-bottom: 1px solid #374151; }
.wb__bar--left .wb__group:last-child, .wb__bar--right .wb__group:last-child { border-bottom: 0; }
.wb__bar--bottom.wb__bar--hand-left { left: 10px; transform: none; }
.wb__bar--bottom.wb__bar--hand-right { left: auto; right: 10px; transform: none; }
.wbi__panel--settings { grid-template-columns: 1fr; width: 280px; }
.wbi__item.is-on { background: #312E81; }
.wb__layer { position: absolute; left: 0; top: 0; display: block; }
.wb.is-dragover .wb__stage { outline: 4px dashed #6366F1; outline-offset: -4px; }
.wb__import { position: fixed; inset: 0; z-index: 15; background: rgba(17,24,39,0.55); display: flex; align-items: center; justify-content: center; }
.wb__import-box { background: #111827; color: #F9FAFB; border-radius: 16px; padding: 22px 28px; min-width: 320px; font-family: Inter, system-ui, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
.wb__import-title { font-weight: 700; font-size: 18px; margin-bottom: 6px; }
.wb__import-label { color: #9CA3AF; font-size: 14px; margin-bottom: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px; }
.wb__import-bar { height: 8px; border-radius: 999px; background: #374151; overflow: hidden; }
.wb__import-bar i { display: block; height: 100%; background: #6366F1; transition: width .2s; }
.wb__input { touch-action: none; }
.wb__input--pen, .wb__input--highlighter { cursor: crosshair; }
.wb__input--eraser { cursor: none; }
.wb__input--text { cursor: text; }
.wb__input--select { cursor: default; }
.wb__input--shape { cursor: crosshair; }
.wb__input--laser { cursor: crosshair; }
.wbi__panel { position: absolute; bottom: 60px; left: 0; z-index: 13; width: 300px; max-height: 70vh; overflow-y: auto; padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-radius: 14px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45); }
.wbi__item { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: #F3F4F6; font: 500 13px/1.2 Inter, system-ui, sans-serif; text-align: left; cursor: pointer; }
.wbi__item:hover { background: #1F2937; }
.wbi__item span { width: 22px; text-align: center; font-size: 16px; }
.wb__curtain { position: absolute; z-index: 4; background: #1F2937; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 18px, transparent 18px 36px); box-shadow: 0 -6px 18px rgba(0,0,0,0.35); }
.wb__curtain-edge { position: absolute; left: 0; right: 0; top: -14px; height: 28px; cursor: ns-resize; touch-action: none; }
.wb__curtain-edge::after { content: ''; position: absolute; left: 50%; top: 10px; width: 80px; height: 8px; margin-left: -40px; border-radius: 4px; background: #6366F1; }
.wb__curtain-actions { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; gap: 10px; }
.wb__curtain-actions button { height: 46px; padding: 0 22px; border: 0; border-radius: 12px; background: #4F46E5; color: #FFFFFF; font: 600 16px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wb__curtain-actions button + button { background: #374151; }
.wb__inksel { position: absolute; z-index: 2; border: 1.5px dashed #4F46E5; border-radius: 6px; cursor: move; touch-action: none; }
.wb__inksel-label { position: absolute; left: 0; top: -22px; padding: 2px 8px; border-radius: 6px; background: #4F46E5; color: #FFFFFF; font: 600 11px/1.3 Inter, system-ui, sans-serif; white-space: nowrap; }
.wb__inksel-scale { position: absolute; right: -8px; bottom: -8px; width: 16px; height: 16px; border-radius: 4px; background: #FFFFFF; border: 2px solid #4F46E5; cursor: nwse-resize; touch-action: none; }
.wb__inksel-text { position: absolute; left: 0; bottom: -34px; height: 28px; padding: 0 10px; border: 0; border-radius: 8px; background: #4F46E5; color: #FFFFFF; font: 700 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wb__inksel-del { position: absolute; right: -14px; top: -30px; width: 26px; height: 26px; border-radius: 50%; border: 0; padding: 0; background: #DC2626; color: #FFFFFF; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }

.wb__ticker {
  position: fixed; top: 14px; right: 16px; z-index: 12;
  background: #111827; color: #F9FAFB; font: 600 clamp(14px, 1.4vw, 20px)/1 Inter, system-ui, sans-serif;
  padding: 10px 16px; border-radius: 999px; box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  animation: wb-ticker 2.6s ease-out forwards;
}
@keyframes wb-ticker { 0% { opacity: 0; transform: translateY(-8px);} 10% { opacity: 1; transform: none;} 80% { opacity: 1;} 100% { opacity: 0;} }

.wb__bar {
  position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%); z-index: 12;
  display: flex; align-items: center; gap: 10px; padding: 6px 8px;
  background: #111827; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  max-width: calc(100vw - 20px); overflow-x: auto;
}
.wb__group { display: flex; align-items: center; gap: 4px; padding: 0 6px; border-right: 1px solid #374151; }
.wb__group:last-child { border-right: 0; }
.wb__btn {
  width: 52px; height: 52px; border-radius: 12px; border: 0; background: transparent; color: #D1D5DB;
  display: flex; align-items: center; justify-content: center; cursor: pointer; flex: none;
}
.wb__btn svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.wb__btn:hover { background: #1F2937; }
.wb__btn.is-on { background: #4F46E5; color: #FFFFFF; }
.wb__btn:disabled { opacity: 0.3; cursor: default; }
.wb__swatch { width: 34px; height: 34px; margin: 0 4px; border-radius: 50%; border: 3px solid #4B5563; cursor: pointer; flex: none; }
.wb__swatch.is-on { border-color: #FFFFFF; box-shadow: 0 0 0 2px #4F46E5; }
.wb__size i { display: block; border-radius: 50%; background: currentColor; }
.wb__size--eraser i { background: transparent; border: 2px solid currentColor; }
.wb__bg span { display: block; width: 26px; height: 26px; border-radius: 4px; background: #F9FAFB; }
.wb__bg--grid span { background-image: linear-gradient(#9CA3AF 1px, transparent 1px), linear-gradient(90deg, #9CA3AF 1px, transparent 1px); background-size: 6px 6px; }
.wb__bg--lines span { background-image: linear-gradient(#9CA3AF 1px, transparent 1px); background-size: 100% 7px; }
.wb__txt { width: 44px; font: 600 19px/1 Inter, system-ui, sans-serif; }
.wb__select {
  height: 40px; max-width: 150px; border-radius: 10px; border: 1px solid #374151; background: #1F2937; color: #F9FAFB;
  font: 500 14px/1 Inter, system-ui, sans-serif; padding: 0 8px; cursor: pointer;
}
.wb__select--size { max-width: 74px; }
.wb__select:disabled { opacity: 0.4; cursor: default; }
.wb__swatch--hl { border-radius: 8px; }
.wb__pages { color: #D1D5DB; font: 600 15px/1 Inter, system-ui, sans-serif; min-width: 52px; text-align: center; }
.wb__close { color: #A5B4FC; }
`;
