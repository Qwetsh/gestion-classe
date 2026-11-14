/**
 * Vérification d'un cours écrit hors de l'éditeur (lot Q3) : Claude rédige un brouillon JSON
 * (`course-drafts/*.json`), `npm run course:check` le contrôle contre le schéma réel de l'éditeur
 * et prépare la requête qui le crée dans `boards`.
 *
 * Aussi utilisé à l'ouverture d'un cours : un document que l'éditeur ne sait pas lire s'ouvrirait
 * vide (TipTap) et l'enregistrement automatique écraserait le cours en base.
 */
import type { JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { COURSE_DOC_VERSION, type CourseDoc } from '../../lib/course/courseDoc';
import { BOARD_LEVELS } from '../../lib/boardsQueries';
import { FONT_FAMILIES, pageGeometry } from '../../lib/course/coursePage';
import { COURSE_THEMES, DOC_FONT_SIZES_PT } from './courseThemes';
import { countWords } from '../../lib/course/courseVersions';

/** Ce qui empêche l'éditeur de lire le document (null : lisible). */
export function docProblem(schema: Schema, content: JSONContent): string | null {
  try {
    schema.nodeFromJSON(content).check();
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Brouillon de cours : ce que Claude écrit dans `course-drafts/<nom>.json`. */
export interface CourseDraft {
  title: string;
  /** 6e, 5e, 4e, 3e, Autre, ou null. */
  level?: string | null;
  chapter?: string | null;
  doc: CourseDoc;
}

export interface DraftReport {
  /** Bloquant : le cours ne doit pas être créé. */
  errors: string[];
  /** À relire : le cours s'ouvrira, mais pas tout à fait comme prévu. */
  warnings: string[];
  /** Nombre de mots (repère : une fiche à cartouche tient sur une page jusqu'à 400 mots environ en marges étroites, 300 en normales). */
  words?: number;
}

const SETTINGS_KEYS = ['numbering', 'hyphens', 'captionLabel', 'header', 'footer', 'firstPageBlank', 'theme', 'font', 'fontSize', 'margins'];
const NUMBERINGS = ['none', 'roman', 'alpha', 'decimal'];
const CAPTIONS = ['document', 'figure', 'doc', 'none'];
const CALLOUT_KINDS = ['definition', 'retenir', 'consigne', 'exemple', 'libre'];
const CALLOUT_FRAMES = ['bar', 'box', 'plain'];
const ZONE_STYLES = ['seyes', 'carreaux', 'lignes', 'pointilles', 'blanc'];
const COLOR = /^#[0-9a-f]{6}$/i;
const PT = /^\d+(\.\d+)?pt$/;

/** Contrôle complet d'un brouillon : schéma, réglages, attributs, tableaux, couleurs. */
export function checkCourseDraft(schema: Schema, draft: CourseDraft, iconNames?: ReadonlySet<string>): DraftReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- Fiche du cours ----
  if (typeof draft.title !== 'string' || !draft.title.trim()) errors.push('title : titre du cours manquant');
  else if (draft.title.length > 120) warnings.push('title : titre très long (plus de 120 caractères)');
  if (draft.level != null && !(BOARD_LEVELS as readonly string[]).includes(draft.level)) errors.push(`level : « ${draft.level} » inconnu (attendu : ${BOARD_LEVELS.join(', ')} ou null)`);
  const doc = draft.doc;
  if (!doc || typeof doc !== 'object') { errors.push('doc : document manquant'); return { errors, warnings }; }
  if (doc.version !== COURSE_DOC_VERSION) errors.push(`doc.version : ${String(doc.version)} au lieu de ${COURSE_DOC_VERSION}`);
  if ('rev' in doc) errors.push('doc.rev : à ne pas écrire (posé par l’éditeur à chaque enregistrement)');
  if (doc.content?.type !== 'doc') { errors.push('doc.content.type : « doc » attendu'); return { errors, warnings }; }

  // ---- Réglages ----
  const st = (doc.settings ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(st)) if (!SETTINGS_KEYS.includes(k)) warnings.push(`settings.${k} : réglage inconnu (ignoré)`);
  if (st.numbering != null && !NUMBERINGS.includes(String(st.numbering))) errors.push(`settings.numbering : « ${String(st.numbering)} » inconnu`);
  if (st.captionLabel != null && !CAPTIONS.includes(String(st.captionLabel))) errors.push(`settings.captionLabel : « ${String(st.captionLabel)} » inconnu`);
  if (st.theme != null && !COURSE_THEMES.some((t) => t.id === st.theme)) errors.push(`settings.theme : « ${String(st.theme)} » inconnu (${COURSE_THEMES.map((t) => t.id).join(', ')})`);
  if (st.font != null && !FONT_FAMILIES.some((f) => f.value === st.font)) errors.push(`settings.font : « ${String(st.font)} » n’est pas une police du menu`);
  if (st.margins != null && st.margins !== 'normales' && st.margins !== 'etroites') errors.push(`settings.margins : « ${String(st.margins)} » (attendu : normales ou etroites)`);
  const colW = pageGeometry(st.margins as string | undefined).colW;
  if (st.fontSize != null && !DOC_FONT_SIZES_PT.includes(Number(st.fontSize))) errors.push(`settings.fontSize : ${String(st.fontSize)} (attendu : ${DOC_FONT_SIZES_PT.join(', ')})`);

  // ---- Schéma de l'éditeur ----
  const problem = docProblem(schema, doc.content);
  if (problem) { errors.push(`schéma : ${problem}`); return { errors, warnings }; }

  // ---- Parcours : attributs, marques, tableaux ----
  const fonts = new Set(FONT_FAMILIES.map((f) => f.value).filter(Boolean));
  const walk = (node: JSONContent, path: string) => {
    const type = schema.nodes[node.type ?? ''];
    if (type && node.attrs) {
      const known = type.spec.attrs ?? {};
      for (const k of Object.keys(node.attrs)) if (!(k in known)) warnings.push(`${path} : attribut « ${k} » inconnu sur ${node.type} (ignoré)`);
    }
    const a = (node.attrs ?? {}) as Record<string, unknown>;
    switch (node.type) {
      case 'image':
        if (!a.path) errors.push(`${path} : image sans fichier (path) — une image doit être envoyée depuis l’éditeur`);
        break;
      case 'courseIcon':
        if (iconNames && !iconNames.has(String(a.name))) errors.push(`${path} : icône « ${String(a.name)} » inconnue (voir le jeu d’icônes)`);
        break;
      case 'encart':
        warnings.push(`${path} : encart tableau vide (à dessiner dans l’éditeur)`);
        break;
      case 'callout':
        if (!CALLOUT_KINDS.includes(String(a.kind ?? 'definition'))) errors.push(`${path} : encadré de type « ${String(a.kind)} » inconnu`);
        if (a.frame != null && !CALLOUT_FRAMES.includes(String(a.frame))) errors.push(`${path} : bordure « ${String(a.frame)} » inconnue`);
        if (a.titleStyle != null && !['label', 'bold'].includes(String(a.titleStyle))) errors.push(`${path} : allure de titre « ${String(a.titleStyle)} » inconnue`);
        if (a.color != null && !COLOR.test(String(a.color))) errors.push(`${path} : couleur d’encadré « ${String(a.color)} » (attendu #rrggbb)`);
        break;
      case 'writingZone':
        if (!ZONE_STYLES.includes(String(a.style ?? 'seyes'))) errors.push(`${path} : zone d’écriture « ${String(a.style)} » inconnue`);
        break;
      case 'tableCell':
      case 'tableHeader':
        if (a.backgroundColor != null && !COLOR.test(String(a.backgroundColor))) errors.push(`${path} : fond de cellule « ${String(a.backgroundColor)} » (attendu #rrggbb)`);
        break;
      case 'text':
        if (node.text?.includes('\n')) warnings.push(`${path} : retour à la ligne dans un texte (utiliser un nouveau paragraphe ou hardBreak)`);
        for (const m of node.marks ?? []) {
          if (m.type !== 'textStyle' && m.type !== 'highlight') continue;
          const ma = (m.attrs ?? {}) as Record<string, unknown>;
          if (ma.color != null && !COLOR.test(String(ma.color))) errors.push(`${path} : couleur « ${String(ma.color)} » (attendu #rrggbb)`);
          if (ma.fontSize != null && !PT.test(String(ma.fontSize))) errors.push(`${path} : taille « ${String(ma.fontSize)} » (attendu par exemple « 10pt »)`);
          if (ma.fontFamily != null && !fonts.has(String(ma.fontFamily))) warnings.push(`${path} : police « ${String(ma.fontFamily)} » absente du menu`);
        }
        break;
      default:
    }
    node.content?.forEach((child, i) => walk(child, `${path}/${child.type}[${i}]`));
  };
  walk(doc.content, 'doc');

  // Tableaux : géométrie (fusions qui se chevauchent, lignes trop courtes) et largeur
  const pmDoc = schema.nodeFromJSON(doc.content);
  let tableIndex = 0;
  pmDoc.descendants((node) => {
    if (node.type.name !== 'table') return true;
    tableIndex += 1;
    const map = TableMap.get(node);
    if (map.problems?.length) errors.push(`tableau n° ${tableIndex} : cases mal agencées (${map.problems.map((p) => p.type).join(', ')}) — vérifier colspan et rowspan`);
    // Largeur : somme des colwidth de la première ligne complète
    let width = 0;
    let complete = true;
    node.firstChild?.forEach((cell) => {
      const cw = cell.attrs.colwidth as number[] | null;
      const span = Number(cell.attrs.colspan) || 1;
      if (!cw || cw.length !== span) complete = false;
      else width += cw.reduce((x, y) => x + y, 0);
    });
    if (complete && width > colW + 2) warnings.push(`tableau n° ${tableIndex} : ${Math.round(width)} px de large, plus que la colonne (${Math.round(colW)} px)`);
    else if (complete && width < colW - 30 && width > colW * 0.9) warnings.push(`tableau n° ${tableIndex} : ${Math.round(width)} px de large pour une colonne de ${Math.round(colW)} px (largeurs calculées pour d’autres marges ?)`);
    return false;
  });

  return { errors, warnings, words: countWords(doc.content) };
}

/** Une chaîne SQL sûre (dollar-quoting avec une étiquette absente du texte). */
function dollar(text: string, base: string): string {
  let tag = base;
  let n = 0;
  while (text.includes(`$${tag}$`)) tag = `${base}${++n}`;
  return `$${tag}$${text}$${tag}$`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Requête qui crée le cours (un nouveau tableau avec son document) et renvoie son identifiant. */
export function draftInsertSQL(draft: CourseDraft, userId: string): string {
  if (!UUID.test(userId)) throw new Error(`identifiant d’utilisateur invalide : ${userId}`);
  const doc: CourseDoc = { version: draft.doc.version, content: draft.doc.content, ...(draft.doc.settings ? { settings: draft.doc.settings } : {}) };
  const lit = (v: string | null | undefined, tag: string) => (v == null || !v.trim() ? 'null' : dollar(v.trim(), tag));
  return [
    'insert into public.boards (user_id, title, level, chapter, doc)',
    `values ('${userId}', ${lit(draft.title, 'gc_title')}, ${lit(draft.level ?? null, 'gc_level')}, ${lit(draft.chapter ?? null, 'gc_chapter')}, ${dollar(JSON.stringify(doc), 'gc_doc')}::jsonb)`,
    'returning id, title;',
  ].join('\n');
}
