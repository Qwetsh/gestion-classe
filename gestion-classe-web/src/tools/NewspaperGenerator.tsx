import { useState, useRef, useCallback, useEffect, useLayoutEffect, type CSSProperties } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Google Fonts loader ────────────────────────────────────

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=Roboto+Slab:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap';

let fontsLoaded = false;
function loadGoogleFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_URL;
  document.head.appendChild(link);
}

// ─── Types ──────────────────────────────────────────────────

type NewspaperStyle = 'lemonde' | 'figaro' | 'moderne' | 'scientifique';

interface TextBlock {
  type: 'text';
  id: string;
  content: string;
  subtitle?: string;
  wide?: boolean;
}

interface ImageBlock {
  type: 'image';
  id: string;
  src: string;
  caption: string;
  wide?: boolean; // span full width
  fit?: 'cover' | 'contain'; // cover = crop, contain = show all
}

interface QuoteBlock {
  type: 'quote';
  id: string;
  content: string;
  author: string;
  style: 'boxed' | 'pullquote'; // encadré ou citation mise en avant
  wide?: boolean;
}

type Block = TextBlock | ImageBlock | QuoteBlock;

interface NewspaperConfig {
  journalName: string;
  slogan: string;
  date: string;
  price: string;
  mainTitle: string;
  lead: string; // chapeau
  author: string;
  style: NewspaperStyle;
  pages: 1 | 2;
  background: { type: 'preset'; } | { type: 'color'; value: string } | { type: 'image'; src: string };
  blocks: Block[];
}

// ─── Style presets ──────────────────────────────────────────

const STYLE_PRESETS: Record<NewspaperStyle, {
  label: string;
  fonts: { title: string; body: string; accent: string };
  colors: { bg: string; text: string; accent: string; rule: string; headerBg: string; headerText: string };
  uppercase: boolean;
  serifTitle: boolean;
}> = {
  lemonde: {
    label: 'Le Monde',
    fonts: {
      title: '"Playfair Display", Georgia, serif',         // Didone italique haut contraste — fidèle au logo Le Monde
      body: '"Libre Baskerville", Georgia, serif',
      accent: '"Inter", "Arial Narrow", Arial, sans-serif',
    },
    colors: { bg: '#FEFCF6', text: '#1a1a1a', accent: '#1a1a1a', rule: '#1a1a1a', headerBg: '#FEFCF6', headerText: '#1a1a1a' },
    uppercase: false,
    serifTitle: true,
  },
  figaro: {
    label: 'Le Figaro',
    fonts: {
      title: '"Cormorant Garamond", Georgia, serif',       // Old-style élégante — fidèle au Figaro
      body: '"Libre Baskerville", Georgia, serif',
      accent: '"Cormorant Garamond", Georgia, serif',
    },
    colors: { bg: '#FDF8F0', text: '#222', accent: '#8B1A1A', rule: '#8B1A1A', headerBg: '#1B2A4A', headerText: '#F5E6C8' },
    uppercase: false,
    serifTitle: true,
  },
  moderne: {
    label: 'Moderne',
    fonts: {
      title: '"Bebas Neue", "Impact", sans-serif',         // Style Wired / GQ — titres impact
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
      accent: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
    colors: { bg: '#FFFFFF', text: '#111', accent: '#E63946', rule: '#E63946', headerBg: '#111', headerText: '#FFF' },
    uppercase: true,
    serifTitle: false,
  },
  scientifique: {
    label: 'Scientifique',
    fonts: {
      title: '"Roboto Slab", "Rockwell", serif',           // Style Nature / Science
      body: '"Roboto", "Segoe UI", sans-serif',
      accent: '"Roboto", "Segoe UI", sans-serif',
    },
    colors: { bg: '#F8FBFF', text: '#1a2a3a', accent: '#0066CC', rule: '#0066CC', headerBg: '#0066CC', headerText: '#FFF' },
    uppercase: false,
    serifTitle: true,
  },
};

// ─── Helpers ────────────────────────────────────────────────

let blockCounter = 0;
function newId() { return `block_${Date.now()}_${blockCounter++}`; }

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}

// ─── Templates ──────────────────────────────────────────────

interface NewspaperTemplate {
  label: string;
  description: string;
  config: Omit<NewspaperConfig, 'date'>;
}

const NEWSPAPER_TEMPLATES: NewspaperTemplate[] = [
  {
    label: 'Journal scolaire',
    description: 'Gazette de classe avec articles élèves',
    config: {
      journalName: 'La Gazette du Collège',
      slogan: 'Par les élèves, pour les élèves',
      price: 'Gratuit',
      mainTitle: 'Les projets de la rentrée',
      lead: 'Cette année, le collège se mobilise autour de nouveaux projets ambitieux. Retour sur les temps forts qui attendent nos élèves.',
      author: 'La rédaction',
      style: 'lemonde',
      pages: 1,
      blocks: [
        { type: 'text', id: 'tpl_t1', content: 'Les élèves de 6e ont inauguré la semaine du développement durable avec la création d\'un jardin pédagogique dans la cour du collège. Encadrés par leurs professeurs de SVT, ils ont planté des aromates, des légumes de saison et installé un composteur. « C\'est génial de voir pousser ce qu\'on a planté », s\'enthousiasme Léa, élève de 6eB.', subtitle: 'Le jardin pédagogique prend racine' },
        { type: 'quote', id: 'tpl_q1', content: 'Apprendre en faisant, c\'est la meilleure façon de comprendre le monde qui nous entoure.', author: 'M. Martin, professeur de SVT', style: 'pullquote' as const, wide: true },
        { type: 'text', id: 'tpl_t2', content: 'Le club lecture a sélectionné ses coups de cœur du trimestre. Parmi eux, trois romans jeunesse et une bande dessinée qui aborde avec humour la vie au collège. Les fiches de lecture sont disponibles au CDI.', subtitle: 'Les coups de cœur du club lecture' },
        { type: 'text', id: 'tpl_t3', content: 'L\'équipe de handball du collège s\'est qualifiée pour les championnats départementaux après une victoire éclatante face au collège Victor Hugo. Bravo à tous les joueurs et à leur entraîneur !', subtitle: 'Handball : qualification historique !' },
      ],
    },
  },
  {
    label: 'Revue scientifique',
    description: 'Style magazine scientifique pour exposés',
    config: {
      journalName: 'Science Actu',
      slogan: 'Comprendre le monde par la science',
      price: '2,50 €',
      mainTitle: 'Les mystères des fonds marins',
      lead: 'À plus de 10 000 mètres de profondeur, la fosse des Mariannes abrite des formes de vie que les scientifiques commencent à peine à découvrir.',
      author: '',
      style: 'scientifique',
      pages: 1,
      blocks: [
        { type: 'text', id: 'tpl_s1', content: 'Les abysses représentent l\'un des derniers territoires inexplorés de notre planète. Les conditions extrêmes qui y règnent — pression colossale, obscurité totale, températures glaciales — en font un environnement hostile à la vie telle que nous la connaissons. Pourtant, des organismes y prospèrent.', subtitle: 'Un monde d\'obscurité' },
        { type: 'quote', id: 'tpl_sq1', content: 'Nous connaissons mieux la surface de Mars que les fonds de nos propres océans.', author: 'Dr. Sylvia Earle, océanographe', style: 'boxed' as const },
        { type: 'text', id: 'tpl_s2', content: 'Les sources hydrothermales, véritables oasis des profondeurs, crachent une eau à plus de 350°C chargée en minéraux. Autour de ces cheminées se développent des écosystèmes uniques, basés non pas sur la photosynthèse mais sur la chimiosynthèse.', subtitle: 'Les cheminées de vie' },
        { type: 'text', id: 'tpl_s3', content: 'En 2025, la mission Deep Ocean Explorer a permis de cartographier une zone inédite de la fosse des Mariannes. Les premiers résultats révèlent la présence de bactéries capables de résister à des pressions mille fois supérieures à celle de la surface.', subtitle: 'Dernières découvertes' },
      ],
    },
  },
  {
    label: 'Gazette historique',
    description: 'Journal d\'époque pour cours d\'histoire',
    config: {
      journalName: 'Le Moniteur Universel',
      slogan: 'Journal officiel de la République',
      price: '5 centimes',
      mainTitle: 'La prise de la Bastille',
      lead: 'Paris, le 14 juillet 1789. Une foule immense s\'est emparée de la forteresse royale de la Bastille, symbole de l\'arbitraire monarchique. Les événements de cette journée marquent un tournant décisif.',
      author: 'Un correspondant',
      style: 'figaro',
      pages: 1,
      blocks: [
        { type: 'text', id: 'tpl_h1', content: 'Dès les premières heures de la matinée, une foule considérable s\'est rassemblée aux abords de la forteresse. Les esprits, échauffés par les récents événements et la disette qui frappe la capitale, réclamaient la libération des prisonniers et la remise des armes entreposées dans la place forte.', subtitle: 'Le peuple en marche' },
        { type: 'quote', id: 'tpl_hq1', content: 'La Bastille est prise ! Le peuple est victorieux ! Vive la Nation !', author: 'Cris entendus dans les rues de Paris', style: 'pullquote' as const, wide: true },
        { type: 'text', id: 'tpl_h2', content: 'Le gouverneur de Launay, après avoir tenté de résister, a finalement ordonné l\'ouverture des portes. Sept prisonniers ont été libérés. La garnison, composée d\'une centaine de soldats, s\'est rendue sans conditions.', subtitle: 'La reddition' },
        { type: 'text', id: 'tpl_h3', content: 'Sa Majesté le Roi, informée des événements par le duc de La Rochefoucauld, aurait prononcé ces mots restés célèbres : « C\'est une révolte ? — Non, Sire, c\'est une révolution. »', subtitle: 'La réaction du Roi' },
      ],
    },
  },
  {
    label: 'Magazine moderne',
    description: 'Style contemporain pour projets créatifs',
    config: {
      journalName: 'ZOOM',
      slogan: 'L\'info qui bouge',
      price: '3,90 €',
      mainTitle: 'L\'intelligence artificielle change nos vies',
      lead: 'De la médecine à l\'éducation, l\'IA bouleverse nos habitudes. Tour d\'horizon des innovations qui transforment notre quotidien.',
      author: 'Sophie Laurent',
      style: 'moderne',
      pages: 1,
      blocks: [
        { type: 'text', id: 'tpl_m1', content: 'Les assistants vocaux, les recommandations de streaming, la reconnaissance faciale de nos téléphones : l\'intelligence artificielle est déjà partout dans notre vie quotidienne. Mais ce n\'est que le début d\'une révolution technologique sans précédent.', subtitle: 'Une révolution silencieuse' },
        { type: 'quote', id: 'tpl_mq1', content: 'L\'IA ne remplacera pas les enseignants, mais les enseignants qui utilisent l\'IA remplaceront ceux qui ne l\'utilisent pas.', author: 'Rapport UNESCO 2025', style: 'boxed' as const, wide: true },
        { type: 'text', id: 'tpl_m2', content: 'Dans les hôpitaux, des algorithmes analysent les radiographies avec une précision supérieure à celle des médecins. Dans les écoles, des programmes adaptatifs personnalisent les exercices en fonction du niveau de chaque élève.', subtitle: 'Santé et éducation en première ligne' },
        { type: 'text', id: 'tpl_m3', content: 'Malgré les promesses, des questions éthiques se posent. Quid de la protection des données personnelles ? De la responsabilité en cas d\'erreur d\'un algorithme ? Le débat ne fait que commencer.', subtitle: 'Les défis à relever' },
      ],
    },
  },
];

// ─── Smart layout engine ────────────────────────────────────

interface LayoutItem {
  block: Block;
  col: number;    // 0-based start column
  span: number;   // columns spanned (1, 2, or 3)
}

function computeLayout(blocks: Block[], totalCols: number): LayoutItem[][] {
  if (blocks.length === 0) return [];

  const rows: LayoutItem[][] = [];
  let currentRow: LayoutItem[] = [];
  let usedCols = 0;

  for (const block of blocks) {
    let span = 1;

    const isWide = (block.type === 'image' && (block as ImageBlock).wide) ||
                   (block.type === 'text' && (block as TextBlock).wide);

    if (isWide) {
      // Wide block: full width, own row
      if (currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
        usedCols = 0;
      }
      rows.push([{ block, col: 0, span: totalCols }]);
      continue;
    }

    if (block.type === 'image') {
      // Contain images take 1 col (they're smaller), cover images take 2
      span = (block as ImageBlock).fit === 'contain' ? 1 : Math.min(2, totalCols);
    }

    if (usedCols + span > totalCols) {
      rows.push(currentRow);
      currentRow = [];
      usedCols = 0;
    }

    currentRow.push({ block, col: usedCols, span });
    usedCols += span;

    if (usedCols >= totalCols) {
      rows.push(currentRow);
      currentRow = [];
      usedCols = 0;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Post-process: fill unused columns in each row
  for (const row of rows) {
    const usedInRow = row.reduce((sum, item) => sum + item.span, 0);
    const remaining = totalCols - usedInRow;
    if (remaining > 0 && row.length > 0) {
      // Give extra columns to text blocks first, then distribute evenly
      const textItems = row.filter(item => item.block.type === 'text');
      const targets = textItems.length > 0 ? textItems : row;
      let toDistribute = remaining;
      for (const item of targets) {
        if (toDistribute <= 0) break;
        const give = Math.ceil(toDistribute / targets.length);
        item.span += give;
        toDistribute -= give;
      }
      // Recalculate col positions
      let col = 0;
      for (const item of row) {
        item.col = col;
        col += item.span;
      }
    }
  }

  return rows;
}

// ─── Component ──────────────────────────────────────────────

export default function NewspaperGenerator() {
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<NewspaperConfig>({
    journalName: 'Le Courrier des Classes',
    slogan: 'Toute l\'actualité qui compte',
    date: new Date().toISOString().split('T')[0],
    price: '1,50 €',
    mainTitle: 'Un titre accrocheur ici',
    lead: '',
    author: '',
    style: 'lemonde',
    pages: 1,
    background: { type: 'preset' },
    blocks: [],
  });

  const [isExporting, setIsExporting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [savedList, setSavedList] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Load Google Fonts on mount + refresh saved list
  useEffect(() => {
    loadGoogleFonts();
    refreshSavedList();
  }, []);

  const STORAGE_PREFIX = 'newspaper_saved_';

  const refreshSavedList = useCallback(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k.slice(STORAGE_PREFIX.length));
    }
    keys.sort();
    setSavedList(keys);
  }, []);

  const saveNewspaper = useCallback((name: string) => {
    if (!name.trim()) return;
    localStorage.setItem(STORAGE_PREFIX + name.trim(), JSON.stringify(config));
    refreshSavedList();
    setShowSaveDialog(false);
    setSaveName('');
  }, [config, refreshSavedList]);

  const loadNewspaper = useCallback((name: string) => {
    const raw = localStorage.getItem(STORAGE_PREFIX + name);
    if (!raw) return;
    try {
      const loaded = JSON.parse(raw) as NewspaperConfig;
      setConfig(loaded);
      setShowLoadDialog(false);
    } catch { /* ignore */ }
  }, []);

  const deleteSaved = useCallback((name: string) => {
    localStorage.removeItem(STORAGE_PREFIX + name);
    refreshSavedList();
  }, [refreshSavedList]);

  const applyTemplate = useCallback((tpl: NewspaperTemplate) => {
    setConfig({ ...tpl.config, date: new Date().toISOString().split('T')[0] });
    setShowTemplates(false);
  }, []);

  // Auto-scale preview to fit available space
  useEffect(() => {
    const updateScale = () => {
      if (!previewPaneRef.current) return;
      const paneWidth = previewPaneRef.current.clientWidth - 32; // padding
      const paneHeight = previewPaneRef.current.clientHeight - 32;
      const pageWidth = config.pages === 2 ? 595 * 2 + 24 : 595; // 2 pages + gap
      const pageHeight = 842;
      const scaleX = paneWidth / pageWidth;
      const scaleY = paneHeight / pageHeight;
      setPreviewScale(Math.min(scaleX, scaleY, 1.3)); // cap at 1.3x
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [config.pages]);

  const PAGE_HEIGHT = 842;

  // Check if content overflows A4 page
  useEffect(() => {
    const check = () => {
      if (!previewRef.current) return;
      const pages = previewRef.current.children;
      if (pages.length === 0) return;
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        if (page.scrollHeight > PAGE_HEIGHT + 10) {
          setOverflow(true);
          return;
        }
      }
      setOverflow(false);
    };
    // Small delay to let DOM render
    const t = setTimeout(check, 100);
    return () => clearTimeout(t);
  }, [config]);

  const preset = STYLE_PRESETS[config.style];

  // ─── Config helpers ──────────

  const update = useCallback((patch: Partial<NewspaperConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  }, []);

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setConfig(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? { ...b, ...patch } as Block : b),
    }));
  }, []);

  const scrollToBlock = useCallback((id: string) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, []);

  const addTextBlock = useCallback(() => {
    const block: TextBlock = { type: 'text', id: newId(), content: '', subtitle: '' };
    setConfig(prev => ({ ...prev, blocks: [...prev.blocks, block] }));
    scrollToBlock(block.id);
  }, [scrollToBlock]);

  const addQuoteBlock = useCallback(() => {
    const block: QuoteBlock = { type: 'quote', id: newId(), content: '', author: '', style: 'pullquote' };
    setConfig(prev => ({ ...prev, blocks: [...prev.blocks, block] }));
    scrollToBlock(block.id);
  }, [scrollToBlock]);

  const addImageBlock = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ background: { type: 'image', src: reader.result as string } });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [update]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = newId();
      const block: ImageBlock = { type: 'image', id, src: reader.result as string, caption: '', wide: false };
      setConfig(prev => ({ ...prev, blocks: [...prev.blocks, block] }));
      scrollToBlock(id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [scrollToBlock]);

  const removeBlock = useCallback((id: string) => {
    setConfig(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== id) }));
  }, []);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setConfig(prev => {
      const idx = prev.blocks.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.blocks.length) return prev;
      const newBlocks = [...prev.blocks];
      [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
      return { ...prev, blocks: newBlocks };
    });
  }, []);

  // ─── Drag & drop ──────────

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setConfig(prev => {
      const blocks = [...prev.blocks];
      const fromIdx = blocks.findIndex(b => b.id === draggedId);
      const toIdx = blocks.findIndex(b => b.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = blocks.splice(fromIdx, 1);
      blocks.splice(toIdx, 0, moved);
      return { ...prev, blocks };
    });
    setDraggedId(null);
  };

  // ─── Export ──────────

  const exportAs = useCallback(async (format: 'png' | 'pdf') => {
    if (!previewRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: config.background.type === 'color' ? config.background.value : preset.colors.bg,
      });

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${config.journalName.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
        pdf.save(`${config.journalName.replace(/\s+/g, '_')}.pdf`);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  }, [config.journalName, preset.colors.bg]);

  // ─── Render: Editor ──────────

  const renderEditor = () => (
    <div style={editorStyles.container}>
      {/* Templates + Save/Load */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          style={{ ...editorStyles.addBtn, flex: 1, border: '2px solid #8B5CF6', color: '#8B5CF6', backgroundColor: '#F5F3FF' }}
          onClick={() => setShowTemplates(!showTemplates)}
        >
          Modèles
        </button>
        <button
          style={{ ...editorStyles.addBtn, flex: 1, border: '2px solid #10B981', color: '#10B981', backgroundColor: '#F0FDF4' }}
          onClick={() => { setSaveName(config.journalName); setShowSaveDialog(true); }}
        >
          Sauvegarder
        </button>
        <button
          style={{ ...editorStyles.addBtn, flex: 1, border: '2px solid #F59E0B', color: '#92400E', backgroundColor: '#FFFBEB' }}
          onClick={() => { refreshSavedList(); setShowLoadDialog(true); }}
        >
          Charger
        </button>
      </div>

      {/* Template picker */}
      {showTemplates && (
        <div style={{ border: '1px solid #DDD6FE', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FAFAFE' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6D28D9', marginBottom: 8 }}>Choisir un modèle :</div>
          {NEWSPAPER_TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              onClick={() => applyTemplate(tpl)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: '#FFF', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{tpl.label}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{tpl.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div style={{ border: '1px solid #A7F3D0', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#F0FDF4' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>Nom de la sauvegarde :</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ ...editorStyles.input, flex: 1 }}
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveNewspaper(saveName)}
              autoFocus
            />
            <button
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: '#10B981', color: '#FFF', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
              onClick={() => saveNewspaper(saveName)}
            >
              OK
            </button>
            <button
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', fontSize: 12, cursor: 'pointer' }}
              onClick={() => setShowSaveDialog(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Load dialog */}
      {showLoadDialog && (
        <div style={{ border: '1px solid #FDE68A', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#FFFBEB' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>Journaux sauvegardés :</div>
          {savedList.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>Aucune sauvegarde</div>
          ) : (
            savedList.map(name => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <button
                  onClick={() => loadNewspaper(name)}
                  style={{ flex: 1, textAlign: 'left', padding: '6px 10px', borderRadius: 6, border: '1px solid #E5E7EB', backgroundColor: '#FFF', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  {name}
                </button>
                <button
                  onClick={() => deleteSaved(name)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: 'none', backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 11, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <button
            style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#FFF', fontSize: 12, cursor: 'pointer' }}
            onClick={() => setShowLoadDialog(false)}
          >
            Fermer
          </button>
        </div>
      )}

      <h3 style={editorStyles.sectionTitle}>Style du journal</h3>
      <div style={editorStyles.styleGrid}>
        {(Object.entries(STYLE_PRESETS) as [NewspaperStyle, typeof preset][]).map(([key, p]) => (
          <button
            key={key}
            onClick={() => update({ style: key })}
            style={{
              ...editorStyles.styleButton,
              borderColor: config.style === key ? p.colors.accent : '#ddd',
              backgroundColor: config.style === key ? p.colors.headerBg : '#fff',
              color: config.style === key ? p.colors.headerText : '#333',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <h3 style={editorStyles.sectionTitle}>Informations</h3>
      <div style={editorStyles.fieldGrid}>
        <label style={editorStyles.label}>
          Nom du journal
          <input style={editorStyles.input} value={config.journalName} onChange={e => update({ journalName: e.target.value })} />
        </label>
        <label style={editorStyles.label}>
          Slogan
          <input style={editorStyles.input} value={config.slogan} onChange={e => update({ slogan: e.target.value })} />
        </label>
        <label style={editorStyles.label}>
          Date
          <input style={editorStyles.input} type="date" value={config.date} onChange={e => update({ date: e.target.value })} />
        </label>
        <label style={editorStyles.label}>
          Prix
          <input style={editorStyles.input} value={config.price} onChange={e => update({ price: e.target.value })} />
        </label>
      </div>

      <label style={{ ...editorStyles.label, marginTop: 12 }}>
        Titre principal
        <input
          style={{ ...editorStyles.input, fontWeight: 700, fontSize: 16 }}
          value={config.mainTitle}
          onChange={e => update({ mainTitle: e.target.value })}
        />
      </label>

      <label style={editorStyles.label}>
        Chapeau (introduction)
        <textarea
          style={{ ...editorStyles.textarea, fontWeight: 600, fontSize: 12 }}
          value={config.lead}
          onChange={e => update({ lead: e.target.value })}
          placeholder="Texte d'accroche en gras sous le titre principal..."
          rows={2}
        />
      </label>

      <label style={editorStyles.label}>
        Auteur
        <input style={editorStyles.input} value={config.author} onChange={e => update({ author: e.target.value })} placeholder="Ex: Jean Dupont" />
      </label>

      <div style={editorStyles.pagesToggle}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Pages :</span>
        <button
          style={{ ...editorStyles.toggleBtn, ...(config.pages === 1 ? editorStyles.toggleBtnActive : {}) }}
          onClick={() => update({ pages: 1 })}
        >1 page</button>
        <button
          style={{ ...editorStyles.toggleBtn, ...(config.pages === 2 ? editorStyles.toggleBtnActive : {}) }}
          onClick={() => update({ pages: 2 })}
        >2 pages</button>
      </div>

      <h3 style={editorStyles.sectionTitle}>Fond de page</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          style={{ ...editorStyles.toggleBtn, ...(config.background.type === 'preset' ? editorStyles.toggleBtnActive : {}) }}
          onClick={() => update({ background: { type: 'preset' } })}
        >Style par défaut</button>
        <button
          style={{ ...editorStyles.toggleBtn, ...(config.background.type === 'color' ? editorStyles.toggleBtnActive : {}) }}
          onClick={() => update({ background: { type: 'color', value: preset.colors.bg } })}
        >Couleur unie</button>
        <button
          style={{ ...editorStyles.toggleBtn, ...(config.background.type === 'image' ? editorStyles.toggleBtnActive : {}) }}
          onClick={() => bgFileInputRef.current?.click()}
        >Texture / Image</button>
        <input ref={bgFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
      </div>
      {config.background.type === 'color' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input
            type="color"
            value={config.background.value}
            onChange={e => update({ background: { type: 'color', value: e.target.value } })}
            style={{ width: 36, height: 28, border: '1px solid #D1D5DB', borderRadius: 4, cursor: 'pointer', padding: 0 }}
          />
          <input
            style={{ ...editorStyles.input, flex: 1 }}
            value={config.background.value}
            onChange={e => update({ background: { type: 'color', value: e.target.value } })}
            placeholder="#FFFFFF"
          />
        </div>
      )}
      {config.background.type === 'image' && (
        <div style={{ marginTop: 6 }}>
          {'src' in config.background && config.background.src && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={config.background.src} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #D1D5DB' }} />
              <button
                style={{ ...editorStyles.toggleBtn, fontSize: 11 }}
                onClick={() => bgFileInputRef.current?.click()}
              >Changer</button>
            </div>
          )}
        </div>
      )}

      <h3 style={editorStyles.sectionTitle}>Contenu</h3>

      <div style={editorStyles.blockList}>
        {config.blocks.map((block, idx) => (
          <div
            key={block.id}
            data-block-id={block.id}
            draggable
            onDragStart={() => handleDragStart(block.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(block.id)}
            style={{
              ...editorStyles.blockItem,
              opacity: draggedId === block.id ? 0.5 : 1,
              borderLeft: `3px solid ${block.type === 'text' ? '#3B82F6' : block.type === 'quote' ? '#8B5CF6' : '#10B981'}`,
            }}
          >
            <div style={editorStyles.blockHeader}>
              <span style={editorStyles.blockDragHandle}>⠿</span>
              <span style={editorStyles.blockType}>{block.type === 'text' ? 'Paragraphe' : block.type === 'quote' ? 'Citation' : 'Photo'}</span>
              <div style={editorStyles.blockActions}>
                <button style={editorStyles.blockActionBtn} onClick={() => moveBlock(block.id, -1)} disabled={idx === 0}>▲</button>
                <button style={editorStyles.blockActionBtn} onClick={() => moveBlock(block.id, 1)} disabled={idx === config.blocks.length - 1}>▼</button>
                <button style={{ ...editorStyles.blockActionBtn, color: '#EF4444' }} onClick={() => removeBlock(block.id)}>✕</button>
              </div>
            </div>

            {block.type === 'text' ? (
              <>
                <input
                  style={{ ...editorStyles.input, fontWeight: 600, marginBottom: 4 }}
                  placeholder="Sous-titre (optionnel)"
                  value={(block as TextBlock).subtitle || ''}
                  onChange={e => updateBlock(block.id, { subtitle: e.target.value })}
                />
                <textarea
                  style={editorStyles.textarea}
                  placeholder="Contenu du paragraphe..."
                  value={(block as TextBlock).content}
                  onChange={e => updateBlock(block.id, { content: e.target.value })}
                  rows={3}
                />
                <label style={editorStyles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={(block as TextBlock).wide || false}
                    onChange={e => updateBlock(block.id, { wide: e.target.checked })}
                  />
                  Pleine largeur
                </label>
              </>
            ) : block.type === 'quote' ? (
              <>
                <textarea
                  style={{ ...editorStyles.textarea, fontStyle: 'italic' }}
                  placeholder="Texte de la citation..."
                  value={(block as QuoteBlock).content}
                  onChange={e => updateBlock(block.id, { content: e.target.value })}
                  rows={2}
                />
                <input
                  style={{ ...editorStyles.input, marginTop: 4 }}
                  placeholder="Auteur de la citation"
                  value={(block as QuoteBlock).author}
                  onChange={e => updateBlock(block.id, { author: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <label style={editorStyles.checkboxLabel}>
                    <input
                      type="radio"
                      name={`quote-style-${block.id}`}
                      checked={(block as QuoteBlock).style === 'pullquote'}
                      onChange={() => updateBlock(block.id, { style: 'pullquote' })}
                    />
                    Citation
                  </label>
                  <label style={editorStyles.checkboxLabel}>
                    <input
                      type="radio"
                      name={`quote-style-${block.id}`}
                      checked={(block as QuoteBlock).style === 'boxed'}
                      onChange={() => updateBlock(block.id, { style: 'boxed' })}
                    />
                    Encadré
                  </label>
                  <label style={editorStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={(block as QuoteBlock).wide || false}
                      onChange={e => updateBlock(block.id, { wide: e.target.checked })}
                    />
                    Pleine largeur
                  </label>
                </div>
              </>
            ) : (
              <>
                {(block as ImageBlock).src && (
                  <img src={(block as ImageBlock).src} alt="" style={editorStyles.blockPreviewImg} />
                )}
                <input
                  style={editorStyles.input}
                  placeholder="Légende de la photo"
                  value={(block as ImageBlock).caption}
                  onChange={e => updateBlock(block.id, { caption: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <label style={editorStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={(block as ImageBlock).wide || false}
                      onChange={e => updateBlock(block.id, { wide: e.target.checked })}
                    />
                    Pleine largeur
                  </label>
                  <label style={editorStyles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={(block as ImageBlock).fit === 'contain'}
                      onChange={e => updateBlock(block.id, { fit: e.target.checked ? 'contain' : 'cover' })}
                    />
                    Ajuster (sans crop)
                  </label>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={editorStyles.addButtons}>
        <button style={editorStyles.addBtn} onClick={addTextBlock}>+ Paragraphe</button>
        <button style={editorStyles.addBtn} onClick={addQuoteBlock}>+ Citation</button>
        <button style={editorStyles.addBtn} onClick={addImageBlock}>+ Photo</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
      </div>

      <h3 style={editorStyles.sectionTitle}>Exporter</h3>
      <div style={editorStyles.exportButtons}>
        <button
          style={{ ...editorStyles.exportBtn, backgroundColor: '#3B82F6' }}
          onClick={() => exportAs('png')}
          disabled={isExporting}
        >
          {isExporting ? 'Export...' : 'Télécharger PNG'}
        </button>
        <button
          style={{ ...editorStyles.exportBtn, backgroundColor: '#EF4444' }}
          onClick={() => exportAs('pdf')}
          disabled={isExporting}
        >
          {isExporting ? 'Export...' : 'Télécharger PDF'}
        </button>
      </div>
    </div>
  );

  // ─── Render: Preview page ──────────

  const totalCols = 3;
  const layoutRows = computeLayout(config.blocks, totalCols);

  // DOM-based page split: measure actual rendered heights
  const page1ContentRef = useRef<HTMLDivElement>(null);
  const [splitIndex, setSplitIndex] = useState(layoutRows.length);

  // Measure after render and calculate split point
  useLayoutEffect(() => {
    if (config.pages !== 2 || !page1ContentRef.current) {
      setSplitIndex(layoutRows.length);
      return;
    }

    const container = page1ContentRef.current;
    const FOOTER_RESERVE = 40;
    const maxHeight = PAGE_HEIGHT - FOOTER_RESERVE;
    let newSplit = layoutRows.length;

    // Only measure content rows (elements with data-row-idx), skip header/footer
    const rowElements = container.querySelectorAll('[data-row-idx]');
    for (let i = 0; i < rowElements.length; i++) {
      const el = rowElements[i] as HTMLElement;
      const bottom = el.offsetTop + el.offsetHeight;
      if (bottom > maxHeight) {
        newSplit = parseInt(el.getAttribute('data-row-idx')!);
        break;
      }
    }

    setSplitIndex(newSplit);
  }, [config, layoutRows.length]);

  const page1Rows = config.pages === 2 ? layoutRows.slice(0, splitIndex) : layoutRows;
  const page2Rows = config.pages === 2 ? layoutRows.slice(splitIndex) : [];

  const renderPageContent = (rows: LayoutItem[][], showHeader: boolean, pageNum: number, contentRef?: React.RefObject<HTMLDivElement | null>) => {
    const bgColor = config.background.type === 'color' ? config.background.value : preset.colors.bg;
    const bgImage = config.background.type === 'image' && 'src' in config.background ? config.background.src : undefined;

    const pageStyle: CSSProperties = {
      width: 595,
      minHeight: 842,
      backgroundColor: bgColor,
      ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      color: preset.colors.text,
      fontFamily: preset.fonts.body,
      padding: '0 28px 28px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      pageBreakAfter: config.pages === 2 && pageNum === 1 ? 'always' : undefined,
    };

    return (
      <div style={pageStyle} ref={contentRef}>
        {/* Header */}
        {showHeader && (
          <>
            {/* Top rule */}
            <div style={{ height: 3, backgroundColor: preset.colors.rule, margin: '0 -28px', marginTop: 0 }} />

            {/* Date + price bar */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', fontSize: 9, fontFamily: preset.fonts.accent,
              color: preset.colors.text, borderBottom: `0.5px solid ${preset.colors.rule}`,
              letterSpacing: '0.03em',
            }}>
              <span>{formatDate(config.date)}</span>
              <span>{config.price}</span>
            </div>

            {/* Journal name */}
            <div style={{
              textAlign: 'center', padding: '12px 0 4px',
              fontFamily: preset.fonts.title,
              fontSize: config.style === 'moderne' ? 42 : 44,
              fontWeight: config.style === 'lemonde' ? 700 : (preset.serifTitle ? 500 : 800),
              fontStyle: preset.serifTitle ? 'italic' : 'normal',
              letterSpacing: preset.uppercase ? '0.08em' : (config.style === 'lemonde' ? '0.02em' : '0.01em'),
              textTransform: preset.uppercase ? 'uppercase' : 'none',
              color: preset.colors.accent,
              lineHeight: 1.1,
              ...(config.style === 'figaro' ? {
                backgroundColor: preset.colors.headerBg,
                color: preset.colors.headerText,
                margin: '8px -28px 0',
                padding: '14px 28px 10px',
              } : {}),
            }}>
              {config.journalName}
            </div>

            {/* Slogan */}
            {config.slogan && (
              <div style={{
                textAlign: 'center', fontSize: 9, fontStyle: 'italic',
                color: preset.colors.text, opacity: 0.6, marginBottom: 2,
                fontFamily: preset.fonts.accent,
                ...(config.style === 'figaro' ? {
                  backgroundColor: preset.colors.headerBg,
                  color: preset.colors.headerText,
                  margin: '0 -28px', padding: '0 28px 8px', opacity: 0.8,
                } : {}),
              }}>
                {config.slogan}
              </div>
            )}

            {/* Rule under header */}
            <div style={{ height: 2, backgroundColor: preset.colors.rule, margin: '6px -28px 0' }} />
            <div style={{ height: 0.5, backgroundColor: preset.colors.rule, margin: '2px -28px 12px' }} />

            {/* Main title */}
            <h1 style={{
              fontFamily: preset.fonts.title,
              fontSize: rows.length > 3 ? 26 : 32,
              fontWeight: preset.serifTitle ? 400 : 800,
              textAlign: 'center',
              lineHeight: 1.15,
              margin: '0 0 4px',
              textTransform: preset.uppercase ? 'uppercase' : 'none',
              color: preset.colors.text,
              letterSpacing: preset.uppercase ? '0.02em' : '-0.01em',
            }}>
              {config.mainTitle}
            </h1>

            {/* Author */}
            {config.author && (
              <div style={{
                textAlign: 'center', fontSize: 10, fontStyle: 'italic',
                color: preset.colors.text, opacity: 0.5, marginBottom: 4,
                fontFamily: preset.fonts.accent,
              }}>
                Par {config.author}
              </div>
            )}

            {/* Lead / chapeau */}
            {config.lead && (
              <p style={{
                fontSize: 11.5, lineHeight: 1.5, margin: '0 0 6px',
                fontWeight: 700, fontFamily: preset.fonts.body,
                color: preset.colors.text, textAlign: 'justify',
              }}>
                {config.lead}
              </p>
            )}

            {/* Thin rule */}
            <div style={{ height: 0.5, backgroundColor: preset.colors.rule, margin: '6px -28px 14px', opacity: 0.4 }} />
          </>
        )}

        {/* Content grid */}
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} data-row-idx={rowIdx} style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
            gap: '0 16px',
            marginBottom: 12,
            alignItems: 'start',
          }}>
            {row.map(item => {
              if (item.block.type === 'text') {
                const tb = item.block as TextBlock;
                return (
                  <div key={item.block.id} style={{
                    gridColumn: `${item.col + 1} / span ${item.span}`,
                    borderLeft: item.col > 0 ? `0.5px solid ${preset.colors.rule}` : 'none',
                    paddingLeft: item.col > 0 ? 14 : 0,
                  }}>
                    {tb.subtitle && (
                      <div style={{
                        fontFamily: preset.fonts.title,
                        fontSize: 14, fontWeight: 700, lineHeight: 1.2,
                        marginBottom: 4, color: preset.colors.accent,
                      }}>
                        {tb.subtitle}
                      </div>
                    )}
                    <p style={{
                      fontSize: 10, lineHeight: 1.55, margin: 0,
                      textAlign: 'justify', hyphens: 'auto',
                      fontFamily: preset.fonts.body,
                    }}>
                      {tb.content}
                    </p>
                  </div>
                );
              } else if (item.block.type === 'quote') {
                const qb = item.block as QuoteBlock;
                const isPullquote = qb.style === 'pullquote';
                return (
                  <div key={item.block.id} style={{
                    gridColumn: `${item.col + 1} / span ${item.span}`,
                    padding: isPullquote ? '10px 16px' : '12px 16px',
                    margin: '4px 0',
                    ...(isPullquote ? {
                      borderTop: `2px solid ${preset.colors.accent}`,
                      borderBottom: `2px solid ${preset.colors.accent}`,
                    } : {
                      border: `1px solid ${preset.colors.rule}`,
                      backgroundColor: preset.colors.bg === '#FFFFFF' ? '#F9FAFB' : 'rgba(0,0,0,0.03)',
                      borderRadius: 2,
                    }),
                  }}>
                    {isPullquote && (
                      <div style={{ fontSize: 28, lineHeight: 1, color: preset.colors.accent, fontFamily: 'Georgia, serif', marginBottom: -4 }}>"</div>
                    )}
                    <p style={{
                      fontSize: isPullquote ? 13 : 10.5,
                      lineHeight: 1.5,
                      margin: 0,
                      fontStyle: 'italic',
                      fontFamily: preset.fonts.title,
                      fontWeight: isPullquote ? 400 : 400,
                      color: preset.colors.text,
                      textAlign: 'center',
                    }}>
                      {qb.content}
                    </p>
                    {qb.author && (
                      <div style={{
                        fontSize: 9, marginTop: 6, textAlign: 'right',
                        fontFamily: preset.fonts.accent, color: preset.colors.accent,
                        fontWeight: 600, fontStyle: 'normal',
                      }}>
                        — {qb.author}
                      </div>
                    )}
                  </div>
                );
              } else {
                const ib = item.block as ImageBlock;
                return (
                  <div key={item.block.id} style={{
                    gridColumn: `${item.col + 1} / span ${item.span}`,
                    borderLeft: item.col > 0 ? `0.5px solid ${preset.colors.rule}` : 'none',
                    paddingLeft: item.col > 0 ? 14 : 0,
                  }}>
                    <img src={ib.src} alt={ib.caption} style={{
                      width: '100%', display: 'block',
                      objectFit: ib.fit || 'cover',
                      ...(ib.fit === 'contain'
                        ? { height: 'auto', maxHeight: ib.wide ? 320 : 240, backgroundColor: preset.colors.bg }
                        : { height: ib.wide ? 280 : 200 }),
                    }} />
                    {ib.caption && (
                      <div style={{
                        fontSize: 8, fontStyle: 'italic', marginTop: 3,
                        color: preset.colors.text, opacity: 0.6,
                        fontFamily: preset.fonts.accent,
                      }}>
                        {ib.caption}
                      </div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        ))}

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: 12, left: 28, right: 28,
          borderTop: `0.5px solid ${preset.colors.rule}`,
          paddingTop: 4, fontSize: 8, opacity: 0.4,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: preset.fonts.accent,
        }}>
          <span>{config.journalName}</span>
          <span>Page {pageNum}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={rootStyles.container}>
      {/* Left: Editor */}
      <div style={rootStyles.editorPane}>
        {renderEditor()}
      </div>

      {/* Right: Preview */}
      <div ref={previewPaneRef} style={rootStyles.previewPane}>
        {overflow && (
          <div style={rootStyles.overflowWarning}>
            Le contenu dépasse le format A4. Le rendu exporté risque d'être coupé ou déformé. Réduisez le texte ou passez en 2 pages.
          </div>
        )}
        {/* Hidden measurement render: all rows on page 1 to measure actual heights */}
        {config.pages === 2 && (
          <div style={{ position: 'absolute', left: -9999, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
            {renderPageContent(layoutRows, true, 1, page1ContentRef)}
          </div>
        )}

        <div ref={previewRef} style={{
          ...(config.pages === 2 ? rootStyles.previewTwoPages : rootStyles.previewOnePage),
          transform: `scale(${previewScale})`,
          transformOrigin: 'top center',
        }}>
          {renderPageContent(page1Rows, true, 1)}
          {config.pages === 2 && page2Rows.length > 0 &&
            renderPageContent(page2Rows, false, 2)
          }
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const rootStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex', gap: 24, height: 'calc(100vh - 200px)', minHeight: 600,
  },
  editorPane: {
    width: 380, minWidth: 340, flexShrink: 0,
    overflowY: 'auto', padding: '0 4px 20px 0',
  },
  previewPane: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    backgroundColor: '#E5E7EB', borderRadius: 8,
    overflow: 'auto', padding: 16, position: 'relative',
  },
  previewOnePage: {
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  },
  previewTwoPages: {
    display: 'flex', gap: 24, flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  overflowWarning: {
    position: 'absolute' as const, top: 12, left: '50%', transform: 'translateX(-50%)',
    zIndex: 10, backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B',
    borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600,
    maxWidth: 420, textAlign: 'center' as const, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
};

const editorStyles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 700, margin: '16px 0 6px', color: '#374151', borderBottom: '1px solid #E5E7EB', paddingBottom: 4 },
  styleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  styleButton: {
    padding: '8px 12px', borderRadius: 6, border: '2px solid #ddd',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
  },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  label: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600, color: '#4B5563' },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    resize: 'vertical', fontFamily: 'inherit',
  },
  pagesToggle: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  toggleBtn: {
    padding: '5px 14px', borderRadius: 6, border: '1px solid #D1D5DB',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: '#FFF',
  },
  toggleBtnActive: { backgroundColor: '#3B82F6', color: '#FFF', borderColor: '#3B82F6' },
  addButtons: { display: 'flex', gap: 8 },
  addBtn: {
    flex: 1, padding: '8px 0', borderRadius: 6, border: '2px dashed #D1D5DB',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6B7280',
    backgroundColor: '#F9FAFB', transition: 'all 0.15s',
  },
  blockList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  blockItem: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB',
    backgroundColor: '#FAFAFA', cursor: 'grab',
  },
  blockHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  blockDragHandle: { cursor: 'grab', color: '#9CA3AF', fontSize: 16, userSelect: 'none' },
  blockType: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 },
  blockActions: { display: 'flex', gap: 2 },
  blockActionBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
    color: '#9CA3AF', padding: '2px 4px', borderRadius: 4,
  },
  blockPreviewImg: { width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 6 },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginTop: 4 },
  exportButtons: { display: 'flex', gap: 8 },
  exportBtn: {
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#FFF',
    transition: 'opacity 0.15s',
  },
};
