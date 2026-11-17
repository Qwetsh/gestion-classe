/**
 * En direct : ce que la page montre d'un groupe, hors de l'affichage (fonctions pures, testées dans
 * __tests__/liveCarnet.test.ts). La bande de cases (une par question du carnet), la légende du carnet,
 * les étapes « Où ils en sont », ce qu'il faut aller voir, les libellés des lieux et des examens, et qui a lu
 * les messages du service.
 *
 * Les questions viennent de `activities.definition.questions` ; les questions répondues, de `_direct.faites`
 * (écrit par l'hôpital depuis le 17/11 : absent des fiches plus anciennes, la page s'en passe).
 */
import type { Groupe } from './liveClass';
import type { LiveMessage, LiveSummary } from './liveQueries';

/** Une question du carnet, telle que la page l'affiche. */
export interface QuestionCarnet {
  id: string;
  /** Étiquette de la case : H, 1, 2…, C. */
  num: string;
  titre: string;
  /** Question bonus ou facultative : case pointillée, hors du compte « x / y questions ». */
  bonus: boolean;
}

const BONUS = /\((bonus|facultative)\)\s*$/i;

/** Les questions du carnet d'une activité, sans l'ordonnance ni la démarche (identifiants qui commencent par `_`). */
export function questionsDuCarnet(definition: unknown): QuestionCarnet[] {
  if (!Array.isArray(definition)) return [];
  return definition.flatMap((q) => {
    if (!q || typeof q !== 'object') return [];
    const { id, num, titre } = q as { id?: unknown; num?: unknown; titre?: unknown };
    if (typeof id !== 'string' || !id || id.startsWith('_')) return [];
    const t = typeof titre === 'string' ? titre : '';
    return [{ id, num: num == null ? '' : String(num), titre: t, bonus: BONUS.test(t) }];
  });
}

/** Le titre sans la mention « (bonus) » ou « (facultative) », que la case dit déjà. */
export const titreSansMention = (titre: string) => titre.replace(BONUS, '').trim();

export interface Case extends QuestionCarnet {
  faite: boolean;
}

/** Une case par question, cochée si elle est répondue ; null sans `faites` (version du jeu plus ancienne). */
export function bandeDeCases(questions: QuestionCarnet[], faites: string[] | null | undefined): Case[] | null {
  if (!faites || questions.length === 0) return null;
  const f = new Set(faites);
  return questions.map((q) => ({ ...q, faite: f.has(q.id) }));
}

const HORS_COMPTE = new Set(['hypothese', 'conclusion']);

/**
 * Le compte « x / y questions » : les questions numérotées, sans l'hypothèse, la conclusion ni les bonus.
 * Sans `faites`, celui du jeu (`reponses / sur`).
 */
export function compteCarnet(questions: QuestionCarnet[], d: LiveSummary | null | undefined): { faites: number; sur: number } {
  if (d?.faites && questions.length) {
    const f = new Set(d.faites);
    const comptees = questions.filter((q) => !HORS_COMPTE.has(q.id) && !q.bonus);
    return { faites: comptees.filter((q) => f.has(q.id)).length, sur: comptees.length };
  }
  return { faites: d?.reponses ?? 0, sur: d?.sur ?? 0 };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** La ligne sous la bande : « 3 / 10 questions · 6 examens faits », « vient de commencer · fiche patient lue »… */
export function legendeCarnet(questions: QuestionCarnet[], d: LiveSummary | null | undefined): string {
  if (!d) return '';
  const { faites, sur } = compteCarnet(questions, d);
  const examens = d.examens?.length ?? 0;
  const auPatient = d.questionsPatient ?? 0;
  if (faites === 0 && !d.hypothese && !d.conclusion) {
    const debut = ['vient de commencer'];
    if (d.ficheLue) debut.push('fiche patient lue');
    if (auPatient) debut.push(`${pluriel(auPatient, 'question')} au patient`);
    else if (examens) debut.push(`${pluriel(examens, 'examen')} ${examens > 1 ? 'faits' : 'fait'}`);
    return debut.join(' · ');
  }
  const parts: string[] = [];
  if (sur) parts.push(`${faites} / ${sur} questions`);
  if (d.conclusion) parts.push('conclusion écrite');
  else if (d.hypothese && faites === 0) parts.push('hypothèse écrite');
  if (examens && !d.conclusion) parts.push(`${pluriel(examens, 'examen')} ${examens > 1 ? 'faits' : 'fait'}`);
  return parts.join(' · ');
}

export const LIEUX: Record<string, string> = {
  attente: "Salle d'attente",
  trajet: 'En chemin',
  retour: 'En chemin',
  'vers-irm': 'En chemin',
  'retour-irm': 'En chemin',
  cabinet: 'Cabinet',
  laboratoire: 'Laboratoire',
  pharmacie: 'Pharmacie',
  irm: 'Imagerie',
  scanner: 'Imagerie',
  experiences: 'Animalerie',
  serre: 'Serre',
  cellules: 'Culture cellulaire',
  effort: 'Tests physiques',
  sortie: 'Patient reparti',
};
export const libelleLieu = (lieu: string | null | undefined) => (lieu ? LIEUX[lieu] ?? lieu : '—');

export const MODES: Record<string, string> = { direct: 'Accompagné', guide: 'Guidé', autonome: 'Autonome' };
export const libelleMode = (mode: string | null | undefined) => (mode ? MODES[mode] ?? mode : '');

const EXAMENS: Record<string, string> = {
  cou: 'Cou',
  gorge: 'Gorge',
  oeil: 'Œil',
  oreille: 'Oreille',
  temperature: 'Température',
  main: 'Main',
  sang: 'Prise de sang',
  frottis: 'Frottis de gorge',
  anticorps: "Recherche d'anticorps",
  'lame-pus': 'Lame de pus',
  'video-phagocytose': 'Vidéo de phagocytose',
};
/** Les examens qu'on fait au cabinet, sur le patient ; les autres passent par le laboratoire ou l'imagerie. */
const AU_CABINET = new Set(['cou', 'gorge', 'oeil', 'oreille', 'temperature', 'main']);

/** Libellé d'un examen ; repli sur l'identifiant (`irm-…` et `scanner-…` : IRM, scanner). */
export function libelleExamen(id: string): string {
  if (EXAMENS[id]) return EXAMENS[id];
  if (id.startsWith('irm')) return 'IRM';
  if (id.startsWith('scanner')) return 'Scanner';
  return id;
}
export const examenAuCabinet = (id: string) => AU_CABINET.has(id);

export type EtatEtape = 'fait' | 'ici' | 'a-venir';
export interface Etape {
  titre: string;
  detail: string;
  etat: EtatEtape;
}

const liste = (ids: string[]) => ids.map((x, i) => (i === 0 ? libelleExamen(x) : libelleExamen(x).toLowerCase())).join(', ');

/**
 * « Où ils en sont » : fiche lue, interrogatoire, examens au cabinet, le lieu actuel (« ici maintenant »),
 * le carnet, l'envoi. `heure` met en forme une heure (ms) pour l'affichage.
 */
export function etapesDuGroupe(d: LiveSummary, questions: QuestionCarnet[], heure: (t: number) => string): Etape[] {
  const examens = d.examens ?? [];
  const cabinet = examens.filter(examenAuCabinet);
  const ailleurs = examens.filter((x) => !examenAuCabinet(x));
  const auPatient = d.questionsPatient ?? 0;
  // fiche d'une version sans `ficheLue` : lue dès qu'il s'est passé quelque chose
  const lue = d.ficheLue != null || (d.ficheLue === undefined && (auPatient > 0 || examens.length > 0 || (!!d.lieu && d.lieu !== 'attente')));
  const { faites, sur } = compteCarnet(questions, d);
  const etapes: Etape[] = [
    { titre: 'Fiche patient lue', etat: lue ? 'fait' : 'a-venir', detail: d.ficheLue ? heure(d.ficheLue) : lue ? '' : 'pas encore' },
    { titre: 'Interrogatoire', etat: auPatient ? 'fait' : 'a-venir', detail: auPatient ? `${pluriel(auPatient, 'question')} au patient` : 'pas encore commencé' },
    { titre: 'Examens au cabinet', etat: cabinet.length ? 'fait' : 'a-venir', detail: cabinet.length ? liste(cabinet) : "aucun pour l'instant" },
  ];
  if (d.lieu && !d.envoye) {
    const detail = d.dernierRefus
      ? `le labo refuse : « ${d.dernierRefus} »`
      : ailleurs.length
        ? `${liste(ailleurs)} : ${ailleurs.length > 1 ? 'faits' : 'fait'}`
        : libelleMode(d.mode);
    etapes.push({ titre: `${libelleLieu(d.lieu)} · ici maintenant`, etat: 'ici', detail });
  }
  etapes.push({
    titre: 'Carnet',
    etat: sur > 0 && faites >= sur && d.conclusion ? 'fait' : 'a-venir',
    detail: `${pluriel(faites, 'réponse')} sur ${sur}, conclusion ${d.conclusion ? 'écrite' : 'pas écrite'}`,
  });
  etapes.push({ titre: 'Envoi du carnet', etat: d.envoye ? 'fait' : 'a-venir', detail: d.envoye ? 'envoyé' : 'pas encore envoyé' });
  return etapes;
}

/** Pourquoi aller voir ce groupe (voir `aBesoin`), ou null. */
export function raisonAVoir(d: LiveSummary | null | undefined): string | null {
  if (!d) return null;
  const n = d.morelIncomprises ?? 0;
  if (n >= 2) {
    const derniere = [...(d.morel ?? [])].reverse().find((m) => !m.compris);
    return `Morel ne les comprend pas : ${n} questions de suite.${derniere ? ` Dernière : « ${derniere.q} »` : ''}`;
  }
  if (d.dernierRefus) return `Labo : « ${d.dernierRefus} »`;
  return null;
}

type GroupeVise = Pick<Groupe, 'activityId' | 'classId' | 'eleves'> & { w: { direct: LiveSummary | null } };

/** Ce message vise-t-il ce groupe ? (mêmes règles que student_live_messages, migration 069) */
export function messageVise(m: Pick<LiveMessage, 'activity_id' | 'class_id' | 'student_ids'>, g: GroupeVise): boolean {
  if (m.activity_id && m.activity_id !== g.activityId) return false;
  if (m.student_ids) return m.student_ids.some((id) => g.eleves.includes(id));
  return !m.class_id || m.class_id === g.classId;
}

/**
 * Qui a lu ce message parmi les groupes affichés : `lus / sur`. `suivi` est faux si aucun de ces groupes ne joue
 * une version qui remonte les lectures (`messagesLus`) : on n'affiche alors rien.
 */
export function lectures(m: Pick<LiveMessage, 'id' | 'activity_id' | 'class_id' | 'student_ids'>, groupes: GroupeVise[]) {
  const vises = groupes.filter((g) => messageVise(m, g));
  return {
    lus: vises.filter((g) => g.w.direct?.messagesLus?.includes(m.id)).length,
    sur: vises.length,
    suivi: vises.some((g) => Array.isArray(g.w.direct?.messagesLus)),
  };
}

/** Le texte de lecture d'un message : « lu », « pas encore lu », « 5 / 7 lus », ou rien. */
export function texteLectures(l: { lus: number; sur: number; suivi: boolean }): string {
  if (!l.suivi || l.sur === 0) return '';
  if (l.sur === 1) return l.lus ? 'lu' : 'pas encore lu';
  return `${l.lus} / ${l.sur} lus`;
}

/** Les messages du service qui visent ce groupe, sans doublon, les plus récents d'abord. */
export function messagesDuGroupe<M extends LiveMessage>(messages: M[], g: GroupeVise): M[] {
  const vus = new Map<string, M>();
  for (const m of messages) if (messageVise(m, g)) vus.set(m.id, m);
  return [...vus.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** Minutes restantes d'un cours de 55 min commencé à `debut` (négatif : dépassé). */
export const DUREE_COURS_MS = 55 * 60_000;
export const minutesRestantes = (debut: number, maintenant: number) => Math.round((debut + DUREE_COURS_MS - maintenant) / 60_000);
