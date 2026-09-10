/**
 * Bibliothèque d'objets pour enseignants : dessins vectoriels (verrerie, SVT, physique,
 * maths, repères génériques) posés sur la page comme objets recolorables et redimensionnables.
 *
 * Chaque item est décrit dans une boîte 100 × 100 par une liste de chemins SVG ; `stroke`
 * = contour à la couleur de l'objet, `fill` = plein à la couleur de remplissage (ou du contour
 * si l'objet n'a pas de remplissage). Une seule géométrie sert au DOM et au canvas.
 *
 * Les modules regroupent les catégories par matière ; l'enseignant active ceux qu'il utilise.
 */
import type { BoardObjectBase } from './boardObjects';

export interface LibraryPath {
  d: string;
  /** 'stroke' (défaut) : contour ; 'fill' : plein ; 'both'. */
  mode?: 'stroke' | 'fill' | 'both';
  /** Épaisseur relative (1 = normale). */
  width?: number;
  /** Ligne pointillée (rayons lumineux, liaisons…). */
  dashed?: boolean;
}

export interface LibraryItem {
  id: string;
  label: string;
  category: string;
  /** Proportions naturelles largeur / hauteur. */
  ratio: number;
  paths: LibraryPath[];
  /** Mots-clés pour la recherche. */
  keywords?: string[];
}

export interface LibraryCategory { id: string; label: string; module: string }

export interface BoardModule {
  id: string;
  label: string;
  icon: string;
  categories: LibraryCategory[];
}

export interface LibraryObject extends BoardObjectBase {
  type: 'library';
  item: string;
  h: number;
  stroke: string;
  fill: string | null;
  strokeWidth: number;
}

export const LIBRARY_MODULES: BoardModule[] = [
  { id: 'generic', label: 'Général', icon: '🏷', categories: [{ id: 'marks', label: 'Repères et étiquettes', module: 'generic' }] },
  { id: 'svt', label: 'SVT', icon: '🧬', categories: [
    { id: 'lab', label: 'Verrerie et matériel', module: 'svt' },
    { id: 'cell', label: 'Cellules et biologie', module: 'svt' },
    { id: 'body', label: 'Corps humain', module: 'svt' },
    { id: 'earth', label: 'Terre et environnement', module: 'svt' },
  ] },
  { id: 'physique', label: 'Physique-chimie', icon: '⚡', categories: [
    { id: 'circuit', label: 'Circuits électriques', module: 'physique' },
    { id: 'optics', label: 'Optique', module: 'physique' },
  ] },
  { id: 'maths', label: 'Maths', icon: '📐', categories: [{ id: 'geometry', label: 'Repères et figures', module: 'maths' }] },
];

const S = (d: string, width?: number): LibraryPath => ({ d, mode: 'stroke', width });
const F = (d: string): LibraryPath => ({ d, mode: 'fill' });
const D = (d: string): LibraryPath => ({ d, mode: 'stroke', dashed: true });

export const LIBRARY_ITEMS: LibraryItem[] = [
  // ---- Verrerie et matériel ----
  { id: 'beaker', label: 'Bécher', category: 'lab', ratio: 0.85, keywords: ['verre', 'chimie'], paths: [
    S('M18 12 H82 M22 12 V88 Q22 94 28 94 H72 Q78 94 78 88 V12'), S('M30 72 H70 M30 58 H70 M30 44 H70', 0.6), F('M22 60 H78 V88 Q78 94 72 94 H28 Q22 94 22 88 Z'),
  ] },
  { id: 'erlenmeyer', label: 'Erlenmeyer', category: 'lab', ratio: 0.8, keywords: ['fiole', 'chimie'], paths: [
    S('M38 8 H62 M40 8 V34 L14 86 Q12 94 20 94 H80 Q88 94 86 86 L60 34 V8'), F('M24 66 H76 L86 86 Q88 94 80 94 H20 Q12 94 14 86 Z'),
  ] },
  { id: 'testtube', label: 'Tube à essai', category: 'lab', ratio: 0.32, keywords: ['tube'], paths: [
    S('M32 6 H68 M38 6 V80 Q38 94 50 94 Q62 94 62 80 V6'), F('M38 50 H62 V80 Q62 94 50 94 Q38 94 38 80 Z'),
  ] },
  { id: 'cylinder', label: 'Éprouvette graduée', category: 'lab', ratio: 0.35, keywords: ['volume', 'mesure'], paths: [
    S('M34 8 H66 M38 8 V90 H62 V8 M26 92 H74'), S('M42 20 H50 M42 30 H54 M42 40 H50 M42 50 H54 M42 60 H50 M42 70 H54 M42 80 H50', 0.6),
  ] },
  { id: 'petri', label: 'Boîte de Petri', category: 'lab', ratio: 1.6, keywords: ['culture', 'bactéries'], paths: [
    S('M6 42 A44 14 0 0 0 94 42 A44 14 0 0 0 6 42 M6 42 V62 A44 14 0 0 0 94 62 V42'), F('M22 50 a6 4 0 1 0 12 0 a6 4 0 1 0 -12 0 M56 54 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0 M40 60 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0'),
  ] },
  { id: 'microscope', label: 'Microscope', category: 'lab', ratio: 0.7, keywords: ['observation', 'lame'], paths: [
    S('M40 6 L58 6 L54 40 L44 40 Z M49 40 V56 M30 60 H70 M22 96 H78 V90 H22 Z M50 56 L36 90 M50 56 L64 90 M60 24 L76 30'), S('M44 66 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'),
  ] },
  { id: 'thermometer', label: 'Thermomètre', category: 'lab', ratio: 0.3, keywords: ['température'], paths: [
    S('M42 8 A8 8 0 0 1 58 8 V70 A14 14 0 1 1 42 70 Z'), F('M46 40 H54 V72 A10 10 0 1 1 46 72 Z'), S('M58 20 H66 M58 32 H64 M58 44 H66 M58 56 H64', 0.6),
  ] },
  { id: 'funnel', label: 'Entonnoir', category: 'lab', ratio: 0.8, keywords: ['filtration'], paths: [S('M10 10 H90 L58 52 V94 H42 V52 Z')] },
  { id: 'pipette', label: 'Pipette', category: 'lab', ratio: 0.25, keywords: ['goutte'], paths: [S('M42 4 A8 8 0 0 1 58 4 V16 L54 22 V86 L50 96 L46 86 V22 L42 16 Z'), F('M47 70 H53 V86 L50 94 L47 86 Z')] },
  { id: 'burner', label: 'Chauffe-ballon / bec', category: 'lab', ratio: 0.8, keywords: ['chauffage', 'flamme'], paths: [
    S('M30 94 H70 M40 94 V50 H60 V94 M35 50 H65'), F('M50 44 Q34 30 44 14 Q46 26 50 24 Q52 12 60 8 Q52 24 56 30 Q60 24 62 18 Q70 34 50 44 Z'),
  ] },
  { id: 'balance', label: 'Balance', category: 'lab', ratio: 1.2, keywords: ['masse', 'peser'], paths: [
    S('M50 14 V60 M20 22 H80 M50 14 a4 4 0 1 0 0.1 0 M20 22 L8 50 H32 Z M80 22 L68 50 H92 Z M30 60 H70 M22 94 H78 V84 Q78 78 72 78 H28 Q22 78 22 84 Z'),
  ] },
  { id: 'magnifier', label: 'Loupe', category: 'lab', ratio: 1, keywords: ['observer'], paths: [S('M20 40 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M61 57 L90 86', 1.4)] },

  // ---- Cellules et biologie ----
  { id: 'cell-animal', label: 'Cellule animale', category: 'cell', ratio: 1.15, keywords: ['membrane', 'noyau', 'cytoplasme'], paths: [
    S('M50 10 Q90 8 92 48 Q94 88 52 92 Q10 94 8 52 Q6 12 50 10 Z', 1.2), F('M42 40 a14 12 0 1 0 28 0 a14 12 0 1 0 -28 0'), S('M20 60 q8 -6 16 0 M62 70 q8 -6 16 0 M24 30 q6 -4 12 0', 0.7),
  ] },
  { id: 'cell-plant', label: 'Cellule végétale', category: 'cell', ratio: 1.3, keywords: ['paroi', 'chloroplaste', 'vacuole'], paths: [
    S('M12 12 H88 V88 H12 Z', 1.4), S('M18 18 H82 V82 H18 Z', 0.7), S('M30 30 H70 V72 H30 Z', 0.7), F('M20 24 a6 3 0 1 0 12 0 a6 3 0 1 0 -12 0 M20 76 a6 3 0 1 0 12 0 a6 3 0 1 0 -12 0 M70 24 a6 3 0 1 0 12 0 a6 3 0 1 0 -12 0'), F('M64 60 a8 7 0 1 0 16 0 a8 7 0 1 0 -16 0'),
  ] },
  { id: 'neuron', label: 'Neurone', category: 'cell', ratio: 2, keywords: ['nerf', 'axone', 'synapse'], paths: [
    S('M20 50 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M40 50 H84 M84 50 L92 42 M84 50 L92 58 M84 50 L94 50 M20 50 L8 40 M20 50 L8 60 M24 42 L14 30 M24 58 L14 70', 1.1), F('M26 50 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'),
  ] },
  { id: 'bacteria', label: 'Bactérie', category: 'cell', ratio: 1.8, keywords: ['microbe', 'bacille'], paths: [
    S('M20 36 H70 A14 14 0 0 1 70 64 H20 A14 14 0 0 1 20 36 Z', 1.2), S('M84 40 q10 -8 8 -18 M84 60 q10 8 8 18 M12 42 q-8 -6 -6 -14', 0.8), S('M30 44 q6 6 12 0 q6 -6 12 0 M30 56 q6 6 12 0 q6 -6 12 0', 0.6),
  ] },
  { id: 'virus', label: 'Virus', category: 'cell', ratio: 1, keywords: ['microbe'], paths: [
    S('M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 1.2), S('M50 30 V16 M50 70 V84 M30 50 H16 M70 50 H84 M36 36 L26 26 M64 36 L74 26 M36 64 L26 74 M64 64 L74 74'), F('M46 12 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M46 84 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 46 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M80 46 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'),
  ] },
  { id: 'dna', label: 'ADN', category: 'cell', ratio: 0.5, keywords: ['génétique', 'hélice'], paths: [
    S('M30 4 Q70 24 30 44 Q70 64 30 84 Q50 94 70 100 M70 4 Q30 24 70 44 Q30 64 70 84 Q50 94 30 100', 1.2), S('M38 14 H62 M40 30 H60 M38 54 H62 M40 70 H60', 0.7),
  ] },
  { id: 'chromosome', label: 'Chromosome', category: 'cell', ratio: 0.6, keywords: ['génétique', 'chromatide'], paths: [
    S('M36 6 Q44 30 50 50 Q56 70 64 94 M64 6 Q56 30 50 50 Q44 70 36 94', 2.4), F('M44 46 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'),
  ] },
  { id: 'flower', label: 'Fleur', category: 'cell', ratio: 0.7, keywords: ['pétale', 'pistil', 'étamine', 'reproduction'], paths: [
    S('M50 40 V96 M50 70 Q30 66 26 80 Q40 84 50 70 M50 60 Q70 56 74 70 Q60 74 50 60'), S('M50 40 Q34 30 32 12 Q46 14 50 40 M50 40 Q66 30 68 12 Q54 14 50 40 M50 40 Q30 44 22 30 Q38 24 50 40 M50 40 Q70 44 78 30 Q62 24 50 40'), F('M46 40 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0'),
  ] },
  { id: 'seed', label: 'Graine en germination', category: 'cell', ratio: 0.8, keywords: ['germination', 'plante'], paths: [
    S('M30 60 Q30 40 50 40 Q70 40 70 60 Q70 76 50 78 Q30 76 30 60 Z', 1.2), S('M50 40 Q52 22 64 12 M56 26 Q62 24 66 28 M50 78 Q50 88 44 96 M50 84 Q44 84 40 90', 1),
  ] },
  { id: 'foodchain', label: 'Chaîne alimentaire', category: 'earth', ratio: 3, keywords: ['prédateur', 'proie', 'flèche'], paths: [
    S('M6 50 H30 M30 50 L24 44 M30 50 L24 56 M40 50 H64 M64 50 L58 44 M64 50 L58 56 M74 50 H96 M96 50 L90 44 M96 50 L90 56', 1.2),
  ] },
  { id: 'watercycle', label: 'Cycle de l\'eau', category: 'earth', ratio: 1.4, keywords: ['évaporation', 'nuage', 'pluie'], paths: [
    S('M6 80 Q30 70 50 80 Q70 90 94 80 M60 30 a10 10 0 0 1 20 0 a8 8 0 0 1 4 14 H56 a8 8 0 0 1 4 -14 Z'), D('M20 76 Q22 50 40 40 M40 40 L34 42 M40 40 L38 46'), S('M66 52 L62 62 M74 52 L70 62 M82 52 L78 62', 0.8), F('M12 28 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0'),
  ] },
  { id: 'volcano', label: 'Volcan', category: 'earth', ratio: 1.3, keywords: ['éruption', 'lave', 'magma'], paths: [
    S('M6 92 L40 22 H60 L94 92 Z', 1.2), F('M40 22 H60 L58 30 Q50 34 42 30 Z'), S('M50 30 V80 Q50 90 40 92 M50 60 Q60 64 62 76', 0.9), S('M44 14 q6 -10 12 0 q4 8 -6 6', 0.8),
  ] },
  { id: 'leaf', label: 'Feuille', category: 'earth', ratio: 0.7, keywords: ['photosynthèse', 'plante'], paths: [
    S('M50 6 Q90 30 60 80 Q52 90 50 96 Q48 90 40 80 Q10 30 50 6 Z', 1.2), S('M50 20 V90 M50 40 Q62 36 70 30 M50 40 Q38 36 30 30 M50 58 Q62 54 68 50 M50 58 Q38 54 32 50', 0.7),
  ] },

  // ---- Corps humain ----
  { id: 'heart', label: 'Cœur', category: 'body', ratio: 0.9, keywords: ['circulation', 'sang', 'organe'], paths: [
    S('M50 30 Q42 14 30 18 Q14 24 18 44 Q22 62 50 90 Q78 62 82 44 Q86 24 70 18 Q58 14 50 30 Z', 1.2), S('M40 6 V20 M60 6 V20 M50 26 V14', 1.4), S('M48 36 Q46 60 56 74', 0.7),
  ] },
  { id: 'lungs', label: 'Poumons', category: 'body', ratio: 1, keywords: ['respiration', 'bronche'], paths: [
    S('M50 8 V40 M50 40 Q38 40 30 48 Q10 68 20 88 Q40 96 46 76 V48 Q46 40 50 40 M50 40 Q62 40 70 48 Q90 68 80 88 Q60 96 54 76 V48 Q54 40 50 40', 1.1), S('M46 56 Q36 56 30 64 M54 56 Q64 56 70 64', 0.7),
  ] },
  { id: 'brain', label: 'Cerveau', category: 'body', ratio: 1.2, keywords: ['nerveux', 'tête'], paths: [
    S('M20 50 Q14 30 32 24 Q40 10 56 18 Q76 12 82 32 Q94 44 84 60 Q86 76 66 78 Q52 88 40 76 Q18 78 20 50 Z', 1.2), S('M50 22 V76 M30 40 Q40 48 34 58 M66 34 Q60 44 70 52 M42 30 Q52 34 46 44', 0.7),
  ] },
  { id: 'stomach', label: 'Système digestif', category: 'body', ratio: 0.6, keywords: ['estomac', 'intestin'], paths: [
    S('M50 4 V30 Q50 46 66 48 Q82 50 78 66 Q74 80 56 78 Q42 76 40 86 Q38 96 50 96 M40 86 Q26 86 26 74 Q26 60 40 60 Q54 60 54 70', 1.1),
  ] },
  { id: 'bone', label: 'Os', category: 'body', ratio: 0.4, keywords: ['squelette'], paths: [S('M40 8 a8 8 0 0 1 10 6 a8 8 0 0 1 10 -6 a8 8 0 0 1 4 14 V78 a8 8 0 0 1 -4 14 a8 8 0 0 1 -10 -6 a8 8 0 0 1 -10 6 a8 8 0 0 1 -4 -14 V22 a8 8 0 0 1 4 -14 Z', 1.2)] },
  { id: 'eye', label: 'Œil', category: 'body', ratio: 1.8, keywords: ['vision', 'pupille'], paths: [S('M6 50 Q50 10 94 50 Q50 90 6 50 Z', 1.2), S('M34 50 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0'), F('M44 50 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0')] },

  // ---- Circuits électriques (normes collège) ----
  { id: 'battery', label: 'Pile', category: 'circuit', ratio: 2, keywords: ['générateur'], paths: [S('M6 50 H40 M60 50 H94 M40 26 V74 M60 36 V64', 1.4), S('M30 30 H36 M33 27 V33', 0.8)] },
  { id: 'lamp', label: 'Lampe', category: 'circuit', ratio: 2, keywords: ['ampoule'], paths: [S('M6 50 H30 M70 50 H94 M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M36 36 L64 64 M64 36 L36 64', 1.2)] },
  { id: 'switch', label: 'Interrupteur', category: 'circuit', ratio: 2, keywords: ['ouvert', 'fermé'], paths: [S('M6 50 H34 M66 50 H94 M34 50 L62 32', 1.4), F('M30 50 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M62 50 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0')] },
  { id: 'resistor', label: 'Résistance', category: 'circuit', ratio: 2, keywords: ['dipôle'], paths: [S('M6 50 H28 M72 50 H94 M28 38 H72 V62 H28 Z', 1.4)] },
  { id: 'motor', label: 'Moteur', category: 'circuit', ratio: 2, paths: [S('M6 50 H30 M70 50 H94 M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 1.2), S('M40 60 V40 L50 52 L60 40 V60', 1.2)] },
  { id: 'led', label: 'DEL', category: 'circuit', ratio: 2, keywords: ['diode'], paths: [S('M6 50 H36 M64 50 H94 M36 34 L64 50 L36 66 Z M64 34 V66', 1.3), S('M52 30 L60 20 M58 20 H62 V24 M60 30 L68 20 M66 20 H70 V24', 0.9)] },
  { id: 'ammeter', label: 'Ampèremètre', category: 'circuit', ratio: 2, keywords: ['intensité'], paths: [S('M6 50 H30 M70 50 H94 M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 1.2), S('M40 62 L50 36 L60 62 M44 54 H56', 1.4)] },
  { id: 'voltmeter', label: 'Voltmètre', category: 'circuit', ratio: 2, keywords: ['tension'], paths: [S('M6 50 H30 M70 50 H94 M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 1.2), S('M40 36 L50 62 L60 36', 1.4)] },
  { id: 'wire-node', label: 'Nœud', category: 'circuit', ratio: 1, paths: [S('M6 50 H94 M50 6 V94', 1.2), F('M42 50 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0')] },

  // ---- Optique ----
  { id: 'lens', label: 'Lentille convergente', category: 'optics', ratio: 0.5, keywords: ['loupe', 'focale'], paths: [S('M50 4 V96 M50 4 L42 12 M50 4 L58 12 M50 96 L42 88 M50 96 L58 88', 1.4), D('M6 50 H94')] },
  { id: 'lens-div', label: 'Lentille divergente', category: 'optics', ratio: 0.5, paths: [S('M50 4 V96 M50 4 L42 -4 M50 4 L58 -4 M50 96 L42 104 M50 96 L58 104', 1.4), D('M6 50 H94')] },
  { id: 'mirror', label: 'Miroir plan', category: 'optics', ratio: 0.4, paths: [S('M50 6 V94', 1.6), S('M50 14 L60 6 M50 26 L60 18 M50 38 L60 30 M50 50 L60 42 M50 62 L60 54 M50 74 L60 66 M50 86 L60 78', 0.8)] },
  { id: 'ray', label: 'Rayon lumineux', category: 'optics', ratio: 3, keywords: ['lumière', 'flèche'], paths: [S('M4 50 H92 M92 50 L82 42 M92 50 L82 58 M48 50 L40 44 M48 50 L40 56', 1.3)] },
  { id: 'prism', label: 'Prisme', category: 'optics', ratio: 1.2, keywords: ['spectre', 'dispersion'], paths: [S('M50 10 L90 86 H10 Z', 1.3), S('M6 44 L34 56', 1.1), S('M60 60 L96 52 M60 62 L96 62 M60 64 L96 72', 0.8)] },

  // ---- Repères et figures (maths) ----
  { id: 'axes', label: 'Repère orthonormé', category: 'geometry', ratio: 1, keywords: ['graphique', 'abscisse', 'ordonnée'], paths: [S('M10 90 H94 M94 90 L86 84 M94 90 L86 96 M10 90 V6 M10 6 L4 14 M10 6 L16 14', 1.3), S('M26 88 V92 M42 88 V92 M58 88 V92 M74 88 V92 M8 74 H12 M8 58 H12 M8 42 H12 M8 26 H12', 0.8)] },
  { id: 'number-line', label: 'Droite graduée', category: 'geometry', ratio: 4, paths: [S('M4 50 H96 M96 50 L88 44 M96 50 L88 56', 1.3), S('M14 44 V56 M30 44 V56 M46 44 V56 M62 44 V56 M78 44 V56', 1)] },
  { id: 'trig-circle', label: 'Cercle trigonométrique', category: 'geometry', ratio: 1, paths: [S('M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 1.2), S('M4 50 H96 M50 4 V96', 0.8), S('M50 50 L82 26 M82 26 V50', 1.1), D('M82 26 H50')] },
  { id: 'right-angle', label: 'Angle droit', category: 'geometry', ratio: 1, paths: [S('M10 10 V90 H90', 1.4), S('M10 74 H26 V90', 1)] },
  { id: 'cube', label: 'Cube (perspective)', category: 'geometry', ratio: 1, keywords: ['solide', 'volume'], paths: [S('M20 30 H70 V80 H20 Z M20 30 L36 14 H86 V64 L70 80 M70 30 L86 14', 1.2), D('M20 80 L36 64 H86 M36 64 V14')] },
  { id: 'cylinder-3d', label: 'Cylindre', category: 'geometry', ratio: 0.7, keywords: ['solide', 'volume'], paths: [S('M20 20 a30 10 0 1 0 60 0 a30 10 0 1 0 -60 0 M20 20 V80 a30 10 0 0 0 60 0 V20', 1.2)] },

  // ---- Repères et étiquettes ----
  { id: 'label', label: 'Étiquette', category: 'marks', ratio: 2.2, paths: [S('M8 30 H80 L94 50 L80 70 H8 Z', 1.3), F('M18 44 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0')] },
  { id: 'check', label: 'Coche', category: 'marks', ratio: 1, keywords: ['vrai', 'juste', 'validé'], paths: [S('M14 52 L40 78 L88 22', 2.2)] },
  { id: 'cross', label: 'Croix', category: 'marks', ratio: 1, keywords: ['faux', 'erreur'], paths: [S('M20 20 L80 80 M80 20 L20 80', 2.2)] },
  { id: 'circle-1', label: 'Numéro ①', category: 'marks', ratio: 1, keywords: ['étape', 'ordre'], paths: [S('M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 1.6), S('M40 34 L52 26 V74 M40 74 H64', 1.8)] },
  { id: 'circle-2', label: 'Numéro ②', category: 'marks', ratio: 1, paths: [S('M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 1.6), S('M38 36 Q50 20 62 34 Q66 44 38 72 H64', 1.8)] },
  { id: 'circle-3', label: 'Numéro ③', category: 'marks', ratio: 1, paths: [S('M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 1.6), S('M38 30 H62 L48 48 Q66 48 62 64 Q56 76 38 68', 1.8)] },
  { id: 'star-mark', label: 'Étoile', category: 'marks', ratio: 1, keywords: ['important', 'bravo'], paths: [F('M50 8 L61 38 L94 38 L67 57 L77 88 L50 70 L23 88 L33 57 L6 38 L39 38 Z')] },
  { id: 'question', label: 'Point d\'interrogation', category: 'marks', ratio: 1, paths: [S('M34 34 Q34 14 52 14 Q70 14 68 32 Q66 44 52 50 V62', 2.2), F('M46 74 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0')] },
  { id: 'warning', label: 'Attention', category: 'marks', ratio: 1.1, keywords: ['danger', 'sécurité'], paths: [S('M50 8 L94 88 H6 Z', 2), S('M50 36 V62', 2.4), F('M45 72 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0')] },
  { id: 'curved-arrow', label: 'Flèche courbe', category: 'marks', ratio: 1.2, paths: [S('M10 80 Q10 20 70 20 M70 20 L58 10 M70 20 L58 30', 1.8)] },
  { id: 'smiley', label: 'Smiley', category: 'marks', ratio: 1, keywords: ['content', 'humeur'], paths: [S('M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 1.4), F('M32 38 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M58 38 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0'), S('M30 60 Q50 78 70 60', 1.6)] },
];

const ITEM_BY_ID = new Map(LIBRARY_ITEMS.map((i) => [i.id, i]));
export const libraryItem = (id: string) => ITEM_BY_ID.get(id) ?? null;

export const MODULES_KEY = 'classroom-board-modules';

export function loadEnabledModules(): string[] {
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    if (!raw) return ['generic', 'svt'];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((m): m is string => typeof m === 'string') : ['generic', 'svt'];
  } catch { return ['generic', 'svt']; }
}

export function saveEnabledModules(ids: string[]) {
  try { localStorage.setItem(MODULES_KEY, JSON.stringify(ids)); } catch { /* stockage indisponible */ }
}

/** Items visibles pour les modules activés, filtrés par recherche. */
export function libraryCatalog(enabledModules: string[], query = ''): { category: LibraryCategory; items: LibraryItem[] }[] {
  const q = query.trim().toLowerCase();
  const cats = LIBRARY_MODULES.filter((m) => enabledModules.includes(m.id)).flatMap((m) => m.categories);
  return cats
    .map((category) => ({
      category,
      items: LIBRARY_ITEMS.filter((it) => it.category === category.id && (!q || it.label.toLowerCase().includes(q) || (it.keywords ?? []).some((k) => k.includes(q)))),
    }))
    .filter((c) => c.items.length > 0);
}

/** Épaisseur de trait de base, en unités de la boîte 100 × 100. */
export const LIBRARY_STROKE = 3;

export function renderLibraryObject(ctx: CanvasRenderingContext2D, o: LibraryObject, scale: number) {
  const item = libraryItem(o.item);
  if (!item) return;
  ctx.save();
  ctx.translate(o.x * scale, o.y * scale);
  ctx.scale((o.w * scale) / 100, (o.h * scale) / 100);
  if (o.rotation) { ctx.translate(50, 50); ctx.rotate((o.rotation * Math.PI) / 180); ctx.translate(-50, -50); }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of item.paths) {
    const path = new Path2D(p.d);
    const mode = p.mode ?? 'stroke';
    if (mode !== 'stroke') {
      ctx.fillStyle = o.fill ?? o.stroke;
      ctx.fill(path);
    }
    if (mode !== 'fill') {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = LIBRARY_STROKE * (p.width ?? 1) * (o.strokeWidth / LIBRARY_STROKE);
      if (p.dashed) ctx.setLineDash([4, 3]);
      ctx.stroke(path);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
