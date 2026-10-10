import type { LucideIcon } from 'lucide-react';
import {
  Anchor, Apple, Atom, Award, BadgeCheck, Bell, Bike, Binoculars, Bird, Book, BookMarked, BookOpen, Brain, Brush, Bug,
  Cake, Calculator, Camera, Castle, Cat, Check, CircleCheck, ClipboardCheck, Clock, Cloud, CloudSun, Coffee, Coins,
  Compass, Cookie, Crown, Diamond, Dice5, Dna, Dog, Drum, Dumbbell, Earth, Eye, Feather, Fish, Flag, Flame,
  FlaskConical, Flower2, Footprints, Gamepad2, Gem, Ghost, Gift, Glasses, Globe, GraduationCap, Guitar, Hammer, Hand,
  Handshake, Headphones, Heart, HeartHandshake, Highlighter, Hourglass, Key, Languages, Laugh, Leaf, Library, Lightbulb,
  ListChecks, Lock, Magnet, Map as MapIcon, MapPin, Medal, Megaphone, MessageCircle, Mic, Microscope, Moon, MoonStar, Mountain,
  Music, NotebookPen, Orbit, Origami, Palette, PartyPopper, PawPrint, Pencil, PenTool, Piano, PiggyBank, Pizza, Plane,
  Puzzle, Rabbit, Rainbow, Recycle, Ribbon, Rocket, Ruler, Satellite, School, Scissors, Shield, ShieldCheck, Ship,
  Smile, Snail, Snowflake, Sparkle, Sparkles, Sprout, Squirrel, Stamp, Star, Sun, Sunrise, Swords, Target, Telescope,
  Tent, Theater, ThumbsUp, Ticket, Timer, Trees, Trophy, Turtle, Umbrella, UserCheck, Users, Volume2,
  Wrench, Zap,
} from 'lucide-react';
import { supabase } from './supabase';

/**
 * Icônes des catégories de tampons (récompenses).
 *
 * Une catégorie a toujours un emoji (`icon`, texte) : c'est ce qu'affichent les anciens clients, l'APK
 * mobile déjà installé notamment. Elle peut en plus porter une icône « riche » (`icon_ref`) :
 *   - `lucide:<Nom>`  une icône de la bibliothèque Lucide, même nom sur le web et sur mobile ;
 *   - `https://…`     une image importée par l'enseignant (bucket public `reward-icons`).
 * Les clients à jour affichent `icon_ref` si présent, sinon l'emoji (voir CategoryIcon).
 */

export const LUCIDE_PREFIX = 'lucide:';

export interface RewardIconDef {
  /** Nom Lucide (PascalCase), identique dans lucide-react et lucide-react-native. */
  name: string;
  Icon: LucideIcon;
  /** Mots-clés en français pour la recherche. */
  keywords: string[];
  group: 'Récompenses' | 'École' | 'Sciences' | 'Nature' | 'Animaux' | 'Arts & jeux' | 'Vie de classe' | 'Divers';
}

const def = (name: string, Icon: LucideIcon, group: RewardIconDef['group'], ...keywords: string[]): RewardIconDef =>
  ({ name, Icon, group, keywords });

/** Bibliothèque proposée dans le sélecteur : volontairement courte et lisible, rangée par thème. */
export const REWARD_ICON_LIBRARY: readonly RewardIconDef[] = [
  // Récompenses
  def('Star', Star, 'Récompenses', 'étoile', 'favori'),
  def('Sparkles', Sparkles, 'Récompenses', 'étincelles', 'brillant', 'magie'),
  def('Sparkle', Sparkle, 'Récompenses', 'étincelle'),
  def('Trophy', Trophy, 'Récompenses', 'trophée', 'coupe', 'victoire'),
  def('Medal', Medal, 'Récompenses', 'médaille'),
  def('Award', Award, 'Récompenses', 'prix', 'distinction', 'récompense'),
  def('Crown', Crown, 'Récompenses', 'couronne', 'roi', 'reine'),
  def('Gem', Gem, 'Récompenses', 'gemme', 'bijou', 'pierre précieuse'),
  def('Diamond', Diamond, 'Récompenses', 'diamant'),
  def('Ribbon', Ribbon, 'Récompenses', 'ruban', 'nœud'),
  def('BadgeCheck', BadgeCheck, 'Récompenses', 'badge', 'validé', 'certifié'),
  def('Gift', Gift, 'Récompenses', 'cadeau', 'bonus'),
  def('PartyPopper', PartyPopper, 'Récompenses', 'fête', 'confettis', 'bravo'),
  def('ThumbsUp', ThumbsUp, 'Récompenses', 'pouce', 'bravo', 'bien'),
  def('Heart', Heart, 'Récompenses', 'cœur', 'amour', 'gentillesse'),
  def('Flame', Flame, 'Récompenses', 'flamme', 'feu', 'série'),
  def('Zap', Zap, 'Récompenses', 'éclair', 'énergie', 'rapide'),
  def('Rocket', Rocket, 'Récompenses', 'fusée', 'décollage', 'progrès'),
  def('Target', Target, 'Récompenses', 'cible', 'objectif'),
  def('Flag', Flag, 'Récompenses', 'drapeau', 'étape'),
  def('Coins', Coins, 'Récompenses', 'pièces', 'monnaie', 'points'),
  def('PiggyBank', PiggyBank, 'Récompenses', 'tirelire', 'économies'),
  def('Ticket', Ticket, 'Récompenses', 'ticket', 'billet'),
  def('Stamp', Stamp, 'Récompenses', 'tampon', 'cachet'),
  def('Check', Check, 'Récompenses', 'coche', 'fait'),
  def('CircleCheck', CircleCheck, 'Récompenses', 'validé', 'réussi'),
  // École
  def('GraduationCap', GraduationCap, 'École', 'diplôme', 'chapeau', 'réussite'),
  def('BookOpen', BookOpen, 'École', 'livre ouvert', 'lecture', 'leçon'),
  def('Book', Book, 'École', 'livre', 'cahier'),
  def('BookMarked', BookMarked, 'École', 'marque-page', 'livre'),
  def('Library', Library, 'École', 'bibliothèque'),
  def('NotebookPen', NotebookPen, 'École', 'cahier', 'devoirs', 'écrit'),
  def('Pencil', Pencil, 'École', 'crayon', 'écriture'),
  def('PenTool', PenTool, 'École', 'plume', 'stylo', 'dessin'),
  def('Highlighter', Highlighter, 'École', 'surligneur', 'fluo'),
  def('Ruler', Ruler, 'École', 'règle', 'mesure', 'géométrie'),
  def('Calculator', Calculator, 'École', 'calculatrice', 'maths', 'calcul'),
  def('Languages', Languages, 'École', 'langues', 'traduction', 'anglais'),
  def('ClipboardCheck', ClipboardCheck, 'École', 'liste', 'travail fait', 'contrôle'),
  def('ListChecks', ListChecks, 'École', 'liste', 'tâches', 'organisé'),
  def('School', School, 'École', 'école', 'collège', 'bâtiment'),
  def('Brain', Brain, 'École', 'cerveau', 'réflexion', 'intelligence'),
  def('Lightbulb', Lightbulb, 'École', 'ampoule', 'idée', 'eurêka'),
  def('Clock', Clock, 'École', 'horloge', 'ponctuel', 'heure'),
  def('Timer', Timer, 'École', 'chrono', 'rapidité'),
  def('Hourglass', Hourglass, 'École', 'sablier', 'patience', 'temps'),
  // Sciences
  def('FlaskConical', FlaskConical, 'Sciences', 'fiole', 'chimie', 'expérience', 'svt'),
  def('Microscope', Microscope, 'Sciences', 'microscope', 'observation', 'svt'),
  def('Atom', Atom, 'Sciences', 'atome', 'physique'),
  def('Dna', Dna, 'Sciences', 'adn', 'génétique', 'svt'),
  def('Telescope', Telescope, 'Sciences', 'télescope', 'astronomie'),
  def('Magnet', Magnet, 'Sciences', 'aimant', 'physique'),
  def('Orbit', Orbit, 'Sciences', 'orbite', 'planète', 'espace'),
  def('Satellite', Satellite, 'Sciences', 'satellite', 'espace'),
  def('Globe', Globe, 'Sciences', 'globe', 'monde', 'géographie'),
  def('Earth', Earth, 'Sciences', 'terre', 'planète'),
  def('Compass', Compass, 'Sciences', 'boussole', 'orientation'),
  def('Map', MapIcon, 'Sciences', 'carte', 'géographie'),
  def('MapPin', MapPin, 'Sciences', 'repère', 'lieu'),
  def('Binoculars', Binoculars, 'Sciences', 'jumelles', 'observation'),
  def('Eye', Eye, 'Sciences', 'œil', 'regard', 'attention'),
  def('Glasses', Glasses, 'Sciences', 'lunettes', 'lecture'),
  // Nature
  def('Leaf', Leaf, 'Nature', 'feuille', 'plante', 'écologie'),
  def('Sprout', Sprout, 'Nature', 'pousse', 'germe', 'progrès'),
  def('Trees', Trees, 'Nature', 'arbres', 'forêt'),
  def('Flower2', Flower2, 'Nature', 'fleur'),
  def('Sun', Sun, 'Nature', 'soleil', 'lumière'),
  def('Sunrise', Sunrise, 'Nature', 'lever de soleil', 'matin'),
  def('Moon', Moon, 'Nature', 'lune', 'nuit'),
  def('MoonStar', MoonStar, 'Nature', 'lune', 'étoile', 'nuit'),
  def('Cloud', Cloud, 'Nature', 'nuage'),
  def('CloudSun', CloudSun, 'Nature', 'éclaircie', 'météo'),
  def('Rainbow', Rainbow, 'Nature', 'arc-en-ciel'),
  def('Snowflake', Snowflake, 'Nature', 'flocon', 'neige', 'hiver'),
  def('Umbrella', Umbrella, 'Nature', 'parapluie', 'pluie'),
  def('Mountain', Mountain, 'Nature', 'montagne', 'sommet', 'défi'),
  def('Recycle', Recycle, 'Nature', 'recyclage', 'écologie'),
  def('Feather', Feather, 'Nature', 'plume', 'léger'),
  // Animaux
  def('Cat', Cat, 'Animaux', 'chat'),
  def('Dog', Dog, 'Animaux', 'chien'),
  def('Rabbit', Rabbit, 'Animaux', 'lapin', 'rapide'),
  def('Turtle', Turtle, 'Animaux', 'tortue', 'persévérance'),
  def('Bird', Bird, 'Animaux', 'oiseau'),
  def('Fish', Fish, 'Animaux', 'poisson'),
  def('Bug', Bug, 'Animaux', 'insecte', 'coccinelle'),
  def('Snail', Snail, 'Animaux', 'escargot', 'patience'),
  def('Squirrel', Squirrel, 'Animaux', 'écureuil'),
  def('PawPrint', PawPrint, 'Animaux', 'patte', 'empreinte'),
  // Arts & jeux
  def('Palette', Palette, 'Arts & jeux', 'palette', 'peinture', 'couleurs', 'arts'),
  def('Brush', Brush, 'Arts & jeux', 'pinceau', 'peinture'),
  def('Camera', Camera, 'Arts & jeux', 'appareil photo', 'image'),
  def('Music', Music, 'Arts & jeux', 'musique', 'note'),
  def('Guitar', Guitar, 'Arts & jeux', 'guitare'),
  def('Piano', Piano, 'Arts & jeux', 'piano'),
  def('Drum', Drum, 'Arts & jeux', 'tambour', 'batterie'),
  def('Theater', Theater, 'Arts & jeux', 'théâtre', 'masques', 'oral'),
  def('Puzzle', Puzzle, 'Arts & jeux', 'puzzle', 'logique', 'énigme'),
  def('Gamepad2', Gamepad2, 'Arts & jeux', 'manette', 'jeu vidéo'),
  def('Dice5', Dice5, 'Arts & jeux', 'dé', 'hasard', 'jeu'),
  def('Origami', Origami, 'Arts & jeux', 'origami', 'papier'),
  def('Ghost', Ghost, 'Arts & jeux', 'fantôme', 'halloween'),
  def('Castle', Castle, 'Arts & jeux', 'château', 'maison', 'académie'),
  def('Swords', Swords, 'Arts & jeux', 'épées', 'duel', 'défi'),
  // Vie de classe
  def('Hand', Hand, 'Vie de classe', 'main levée', 'participation'),
  def('Handshake', Handshake, 'Vie de classe', 'poignée de main', 'entraide', 'respect'),
  def('HeartHandshake', HeartHandshake, 'Vie de classe', 'solidarité', 'entraide'),
  def('Users', Users, 'Vie de classe', 'groupe', 'équipe', 'coopération'),
  def('UserCheck', UserCheck, 'Vie de classe', 'élève', 'validé', 'présent'),
  def('MessageCircle', MessageCircle, 'Vie de classe', 'parole', 'oral', 'message'),
  def('Megaphone', Megaphone, 'Vie de classe', 'porte-voix', 'annonce', 'oral'),
  def('Mic', Mic, 'Vie de classe', 'micro', 'oral', 'exposé'),
  def('Volume2', Volume2, 'Vie de classe', 'son', 'volume', 'calme'),
  def('Headphones', Headphones, 'Vie de classe', 'casque', 'écoute'),
  def('Smile', Smile, 'Vie de classe', 'sourire', 'bonne humeur'),
  def('Laugh', Laugh, 'Vie de classe', 'rire', 'humour'),
  def('Shield', Shield, 'Vie de classe', 'bouclier', 'protection', 'règles'),
  def('ShieldCheck', ShieldCheck, 'Vie de classe', 'sécurité', 'règles respectées'),
  def('Bell', Bell, 'Vie de classe', 'cloche', 'sonnerie', 'ponctualité'),
  def('Key', Key, 'Vie de classe', 'clé', 'responsabilité'),
  def('Lock', Lock, 'Vie de classe', 'cadenas', 'confiance'),
  // Divers
  def('Apple', Apple, 'Divers', 'pomme', 'fruit', 'santé'),
  def('Cake', Cake, 'Divers', 'gâteau', 'anniversaire'),
  def('Cookie', Cookie, 'Divers', 'biscuit', 'gourmandise'),
  def('Pizza', Pizza, 'Divers', 'pizza'),
  def('Coffee', Coffee, 'Divers', 'café', 'tasse', 'pause'),
  def('Bike', Bike, 'Divers', 'vélo', 'sport'),
  def('Dumbbell', Dumbbell, 'Divers', 'haltère', 'sport', 'effort'),
  def('Footprints', Footprints, 'Divers', 'pas', 'chemin', 'progression'),
  def('Plane', Plane, 'Divers', 'avion', 'voyage'),
  def('Ship', Ship, 'Divers', 'bateau', 'navire'),
  def('Anchor', Anchor, 'Divers', 'ancre', 'stable'),
  def('Tent', Tent, 'Divers', 'tente', 'camping', 'sortie'),
  def('Hammer', Hammer, 'Divers', 'marteau', 'bricolage', 'technologie'),
  def('Wrench', Wrench, 'Divers', 'clé à molette', 'outil', 'réparer'),
  def('Scissors', Scissors, 'Divers', 'ciseaux', 'découpage'),
];

const BY_NAME: ReadonlyMap<string, RewardIconDef> = new Map(REWARD_ICON_LIBRARY.map((d) => [d.name, d]));

/** Groupes dans l'ordre d'affichage du sélecteur. */
export const REWARD_ICON_GROUPS: readonly RewardIconDef['group'][] = [
  'Récompenses', 'École', 'Sciences', 'Nature', 'Animaux', 'Arts & jeux', 'Vie de classe', 'Divers',
];

/** Emojis proposés en raccourci (l'enseignant peut aussi en saisir n'importe lequel). */
export const REWARD_EMOJI_CHOICES: readonly string[] = [
  '⭐', '🌟', '✨', '🏆', '🥇', '🎖️', '👑', '💎', '🎁', '🎉', '👍', '👏', '💪', '🔥', '⚡', '🚀', '🎯', '✅',
  '📚', '📖', '✏️', '📝', '🧠', '💡', '🔬', '🧪', '🧬', '🌍', '🌱', '🌸', '🌈', '☀️', '🦋', '🐢', '🐝', '🦉',
  '🎨', '🎭', '🎵', '🎲', '🧩', '🤝', '🙋', '💬', '🤫', '🕐', '🧹', '🍎', '🍀', '🏅', '🎓', '🧭', '🗺️', '🔑',
];

export type ParsedIconRef =
  | { kind: 'lucide'; name: string; def: RewardIconDef | null }
  | { kind: 'image'; url: string };

/** Lit une référence d'icône ; `null` si vide ou illisible (on retombe alors sur l'emoji). */
export function parseIconRef(ref: string | null | undefined): ParsedIconRef | null {
  const t = (ref ?? '').trim();
  if (!t) return null;
  if (t.startsWith(LUCIDE_PREFIX)) {
    const name = t.slice(LUCIDE_PREFIX.length).trim();
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return null;
    return { kind: 'lucide', name, def: BY_NAME.get(name) ?? null };
  }
  if (/^https:\/\/\S+$/i.test(t)) return { kind: 'image', url: t };
  return null;
}

export const lucideRef = (name: string): string => `${LUCIDE_PREFIX}${name}`;

/** Icônes dont le nom ou un mot-clé contient la recherche (sans accents ni casse). */
export function searchRewardIcons(query: string): RewardIconDef[] {
  const q = fold(query);
  if (!q) return [...REWARD_ICON_LIBRARY];
  return REWARD_ICON_LIBRARY.filter((d) => fold(d.name).includes(q) || d.keywords.some((k) => fold(k).includes(q)));
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* ---------- import d'une image ---------- */

export const REWARD_ICON_BUCKET = 'reward-icons';
export const REWARD_ICON_MAX_BYTES = 512 * 1024;
const ALLOWED: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif',
};

/** Vérifie le type et la taille avant l'envoi ; renvoie un message d'erreur lisible ou `null`. */
export function validateIconFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED[file.type]) return 'Format accepté : PNG, JPEG, WebP, SVG ou GIF.';
  if (file.size > REWARD_ICON_MAX_BYTES) return `Image trop lourde (${Math.round(file.size / 1024)} Ko) : 512 Ko maximum.`;
  return null;
}

/**
 * Envoie l'image dans le bucket public `reward-icons`, dans le dossier de l'enseignant, et renvoie son URL.
 * Le bucket est public en lecture : l'URL est stable et affichable par l'espace élève et le mobile.
 */
export async function uploadRewardIcon(userId: string, file: File): Promise<string> {
  const problem = validateIconFile(file);
  if (problem) throw new Error(problem);
  const ext = ALLOWED[file.type];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(REWARD_ICON_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error(`Envoi impossible : ${error.message}`);
  const { data } = supabase.storage.from(REWARD_ICON_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
