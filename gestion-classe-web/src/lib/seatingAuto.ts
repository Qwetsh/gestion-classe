/**
 * Génération automatique d'un plan de classe sous contraintes (pur, sans I/O).
 *
 * Orientation de la grille : dans toutes les vues (éditeur web, écran projeté, séance
 * mobile) le TABLEAU est en bas de la grille. « Devant » = les rangées d'indice élevé
 * (proches du tableau), « au fond » = les rangées d'indice 0..k.
 *
 * Positions : même format que class_room_plans.positions, "row-col" -> student_id.
 *
 * Méthode : placement initial glouton (élèves verrouillés, puis les autres), puis recuit
 * simulé sur des échanges (élève <-> élève ou élève <-> place vide). Chaque contrainte
 * est une pénalité ; le solveur minimise la somme et renvoie la liste des contraintes
 * non satisfaites pour que l'enseignant puisse arbitrer à la main.
 */

// ============================================
// Types
// ============================================

/** Contraintes individuelles (student_id) ou de couple (student_id + other_student_id). */
export type SeatingConstraintKind =
  | 'front'        // devant, près du tableau
  | 'back'         // au fond
  | 'not_back'     // pas au fond
  | 'edge'         // au bord (colonne extrême : mur, fenêtre)
  | 'center'       // au centre de la rangée
  | 'alone'        // seul à sa table (aucun voisin latéral)
  | 'fixed'        // garde sa place actuelle
  | 'next_to'      // à côté de B (voisins latéraux)
  | 'not_next_to'  // pas à côté de B (ni latéral, ni devant/derrière, ni diagonale)
  | 'far_from';    // éloigné de B (distance >= minDistance, 3 par défaut)

export const PAIR_KINDS: ReadonlySet<SeatingConstraintKind> = new Set(['next_to', 'not_next_to', 'far_from']);

export interface SeatingConstraint {
  id: string;
  student_id: string;
  kind: SeatingConstraintKind;
  other_student_id?: string | null;
  /** Paramètres optionnels : { minDistance } pour far_from */
  params?: { minDistance?: number } | null;
}

/** Règles globales, appliquées à toute la classe (préférences, poids faible). */
export interface SeatingRules {
  /** Élèves PAP/PAI/PPRE devant */
  accommodationsFront: boolean;
  /** Alterner filles / garçons entre voisins latéraux */
  alternateGender: boolean;
  /** Ne pas mettre deux élèves fragiles (note de comportement < 10) côte à côte */
  mixLevels: boolean;
  /** Éloigner les élèves qui cumulent des malus les uns des autres */
  separateTalkers: boolean;
  /** Éviter de retrouver les mêmes voisins latéraux que le plan actuel */
  newNeighbors: boolean;
  /** Remplir depuis l'avant (compact) plutôt que répartir sur toute la salle */
  fillFromFront: boolean;
  /** Garder les élèves déjà placés à leur place (sinon tout est recalculé) */
  keepPlaced: boolean;
}

export const DEFAULT_RULES: SeatingRules = {
  accommodationsFront: true,
  alternateGender: false,
  mixLevels: false,
  separateTalkers: true,
  newNeighbors: false,
  fillFromFront: true,
  keepPlaced: false,
};

export interface SeatingStudentInfo {
  id: string;
  pseudo: string;
  gender?: 'M' | 'F' | string | null;
  has_pap?: boolean;
  has_ppre?: boolean;
  has_pai?: boolean;
  /** Note de comportement /20 (undefined si inconnue) */
  grade?: number;
  /** Nombre de malus du trimestre */
  malus?: number;
}

export interface SeatingRoomInfo {
  grid_rows: number;
  grid_cols: number;
  /** Cases désactivées, format "r,c" (allées, cases vides) */
  disabled_cells?: string[] | null;
}

export type Positions = Record<string, string>;

export interface SeatingViolation {
  /** id de la contrainte (ou clé de règle globale "rule:<nom>") */
  constraintId: string;
  message: string;
  penalty: number;
}

export interface SeatingResult {
  positions: Positions;
  violations: SeatingViolation[];
  score: number;
  /** Élèves qui n'ont pas trouvé de place (plus d'élèves que de sièges) */
  unplaced: string[];
}

export interface GenerateOptions {
  students: SeatingStudentInfo[];
  room: SeatingRoomInfo;
  constraints: SeatingConstraint[];
  rules?: Partial<SeatingRules>;
  /** Plan actuel : sert aux contraintes « fixed », à « keepPlaced » et à « newNeighbors » */
  currentPositions?: Positions;
  rng?: () => number;
  /** Nombre d'itérations de recuit (par défaut proportionnel à la taille) */
  iterations?: number;
}

// ============================================
// Grille et voisinage
// ============================================

export interface Seat { row: number; col: number; key: string }

export const seatKey = (row: number, col: number) => `${row}-${col}`;

export function parseSeatKey(key: string): { row: number; col: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(key);
  if (!m) return null;
  return { row: Number(m[1]), col: Number(m[2]) };
}

/** Sièges utilisables, dans l'ordre « depuis le tableau » (dernière rangée d'abord, centre d'abord). */
export function listSeats(room: SeatingRoomInfo): Seat[] {
  const disabled = new Set(room.disabled_cells || []);
  const seats: Seat[] = [];
  for (let r = 0; r < room.grid_rows; r++) {
    for (let c = 0; c < room.grid_cols; c++) {
      if (disabled.has(`${r},${c}`)) continue;
      seats.push({ row: r, col: c, key: seatKey(r, c) });
    }
  }
  const mid = (room.grid_cols - 1) / 2;
  return seats.sort((a, b) => (b.row - a.row) || (Math.abs(a.col - mid) - Math.abs(b.col - mid)) || (a.col - b.col));
}

/** Profondeur de la bande « devant » / « au fond » : un tiers des rangées, au moins 1. */
export function bandDepth(rows: number): number {
  return Math.max(1, Math.ceil(rows / 3));
}

/** Distance à la bande avant (0 si dedans). Rangée d'indice élevé = devant. */
export function distanceToFront(row: number, rows: number): number {
  const firstFrontRow = rows - bandDepth(rows);
  return Math.max(0, firstFrontRow - row);
}

/** Distance à la bande arrière (0 si dedans). */
export function distanceToBack(row: number, rows: number): number {
  const lastBackRow = bandDepth(rows) - 1;
  return Math.max(0, row - lastBackRow);
}

export function isBack(row: number, rows: number): boolean {
  return distanceToBack(row, rows) === 0;
}

/** Distance de Tchebychev entre deux sièges. */
export function seatDistance(a: Seat, b: Seat): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

/**
 * Voisins latéraux : même rangée, colonne adjacente, case active. Une allée (case
 * désactivée) coupe le voisinage : deux élèves séparés par une allée ne sont pas voisins.
 */
export function areLateralNeighbors(a: Seat, b: Seat): boolean {
  return a.row === b.row && Math.abs(a.col - b.col) === 1;
}

// ============================================
// Scoring
// ============================================

const W = {
  pair: 8,        // next_to / not_next_to / far_from
  single: 5,      // front / back / edge / center / alone / not_back
  rule: 1.5,      // règles globales
  fill: 0.15,     // remplissage depuis l'avant (très faible : départage seulement)
};

export interface Ctx {
  room: SeatingRoomInfo;
  seatByKey: Map<string, Seat>;
  studentById: Map<string, SeatingStudentInfo>;
  constraints: SeatingConstraint[];
  rules: SeatingRules;
  previousLateralPairs: Set<string>;
  talkerIds: Set<string>;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function lateralPairs(assign: Map<string, string>, seatByKey: Map<string, Seat>): Array<[string, string, Seat, Seat]> {
  // assign : studentId -> seatKey
  const bySeat = new Map<string, string>();
  assign.forEach((k, sid) => bySeat.set(k, sid));
  const out: Array<[string, string, Seat, Seat]> = [];
  bySeat.forEach((sid, key) => {
    const seat = seatByKey.get(key);
    if (!seat) return;
    const rightKey = seatKey(seat.row, seat.col + 1);
    const rightSid = bySeat.get(rightKey);
    const right = seatByKey.get(rightKey);
    if (rightSid && right) out.push([sid, rightSid, seat, right]);
  });
  return out;
}

function describeStudent(ctx: Ctx, id: string): string {
  return ctx.studentById.get(id)?.pseudo ?? '?';
}

export function constraintLabel(kind: SeatingConstraintKind): string {
  switch (kind) {
    case 'front': return 'devant';
    case 'back': return 'au fond';
    case 'not_back': return 'pas au fond';
    case 'edge': return 'au bord';
    case 'center': return 'au centre';
    case 'alone': return 'seul à sa table';
    case 'fixed': return 'place fixe';
    case 'next_to': return 'à côté de';
    case 'not_next_to': return 'pas à côté de';
    case 'far_from': return 'éloigné de';
  }
}

/** Évalue une affectation ; renvoie le score (somme des pénalités) et les violations détaillées. */
export function evaluate(ctx: Ctx, assign: Map<string, string>, detailed: boolean): { score: number; violations: SeatingViolation[] } {
  const { room, seatByKey, constraints, rules } = ctx;
  const rows = room.grid_rows;
  const cols = room.grid_cols;
  const mid = (cols - 1) / 2;
  let score = 0;
  const violations: SeatingViolation[] = [];
  const add = (id: string, penalty: number, message: () => string) => {
    if (penalty <= 0) return;
    score += penalty;
    if (detailed) violations.push({ constraintId: id, penalty, message: message() });
  };
  const seatOf = (sid: string): Seat | undefined => {
    const k = assign.get(sid);
    return k ? seatByKey.get(k) : undefined;
  };
  // index inverse (siège -> élève) pour le comptage de voisins
  const bySeat = new Map<string, string>();
  assign.forEach((k, sid) => bySeat.set(k, sid));
  const lateralCount = (seat: Seat): number => {
    let n = 0;
    if (bySeat.has(seatKey(seat.row, seat.col - 1))) n++;
    if (bySeat.has(seatKey(seat.row, seat.col + 1))) n++;
    return n;
  };

  // --- Contraintes explicites
  for (const c of constraints) {
    const a = seatOf(c.student_id);
    if (!a) continue; // élève non placé (ou absent de la classe) : ignoré
    const name = () => describeStudent(ctx, c.student_id);
    switch (c.kind) {
      case 'front':
        add(c.id, distanceToFront(a.row, rows) * W.single, () => `${name()} devrait être devant`);
        break;
      case 'back':
        add(c.id, distanceToBack(a.row, rows) * W.single, () => `${name()} devrait être au fond`);
        break;
      case 'not_back':
        add(c.id, isBack(a.row, rows) ? W.single : 0, () => `${name()} ne devrait pas être au fond`);
        break;
      case 'edge':
        add(c.id, Math.min(a.col, cols - 1 - a.col) * W.single, () => `${name()} devrait être au bord`);
        break;
      case 'center':
        add(c.id, Math.floor(Math.abs(a.col - mid)) * W.single, () => `${name()} devrait être au centre`);
        break;
      case 'alone':
        add(c.id, lateralCount(a) * W.single, () => `${name()} devrait être seul à sa table`);
        break;
      case 'fixed':
        // géré par le verrouillage ; rien à pénaliser
        break;
      case 'next_to':
      case 'not_next_to':
      case 'far_from': {
        if (!c.other_student_id) break;
        const b = seatOf(c.other_student_id);
        if (!b) break;
        const other = () => describeStudent(ctx, c.other_student_id as string);
        const d = seatDistance(a, b);
        if (c.kind === 'next_to') {
          add(c.id, areLateralNeighbors(a, b) ? 0 : d * W.pair, () => `${name()} devrait être à côté de ${other()}`);
        } else if (c.kind === 'not_next_to') {
          add(c.id, d <= 1 ? W.pair : 0, () => `${name()} ne devrait pas être à côté de ${other()}`);
        } else {
          const min = Math.max(2, c.params?.minDistance ?? 3);
          add(c.id, d < min ? (min - d) * W.pair : 0, () => `${name()} devrait être éloigné de ${other()}`);
        }
        break;
      }
    }
  }

  // --- Règles globales
  if (rules.accommodationsFront) {
    assign.forEach((k, sid) => {
      const s = ctx.studentById.get(sid);
      if (!s || !(s.has_pap || s.has_pai || s.has_ppre)) return;
      const seat = seatByKey.get(k);
      if (!seat) return;
      add('rule:accommodationsFront', distanceToFront(seat.row, rows) * W.rule, () => `${s.pseudo} (PAP/PPRE/PAI) n'est pas devant`);
    });
  }

  const pairs = (rules.alternateGender || rules.mixLevels || rules.newNeighbors)
    ? lateralPairs(assign, seatByKey)
    : [];

  if (rules.alternateGender) {
    for (const [sa, sb] of pairs) {
      const ga = ctx.studentById.get(sa)?.gender;
      const gb = ctx.studentById.get(sb)?.gender;
      if (ga && gb && ga === gb) {
        add('rule:alternateGender', W.rule, () => `${describeStudent(ctx, sa)} et ${describeStudent(ctx, sb)} : même genre côte à côte`);
      }
    }
  }

  if (rules.mixLevels) {
    for (const [sa, sb] of pairs) {
      const ga = ctx.studentById.get(sa)?.grade;
      const gb = ctx.studentById.get(sb)?.grade;
      if (ga !== undefined && gb !== undefined && ga < 10 && gb < 10) {
        add('rule:mixLevels', W.rule * 2, () => `${describeStudent(ctx, sa)} et ${describeStudent(ctx, sb)} : deux élèves fragiles côte à côte`);
      }
    }
  }

  if (rules.newNeighbors) {
    for (const [sa, sb] of pairs) {
      if (ctx.previousLateralPairs.has(pairKey(sa, sb))) {
        add('rule:newNeighbors', W.rule, () => `${describeStudent(ctx, sa)} et ${describeStudent(ctx, sb)} : déjà voisins sur le plan actuel`);
      }
    }
  }

  if (rules.separateTalkers && ctx.talkerIds.size >= 2) {
    const talkers = [...ctx.talkerIds].map((id) => [id, seatOf(id)] as const).filter((x) => x[1]);
    for (let i = 0; i < talkers.length; i++) {
      for (let j = i + 1; j < talkers.length; j++) {
        const d = seatDistance(talkers[i][1] as Seat, talkers[j][1] as Seat);
        if (d <= 1) {
          add('rule:separateTalkers', W.rule * 2, () => `${describeStudent(ctx, talkers[i][0])} et ${describeStudent(ctx, talkers[j][0])} : deux bavards voisins`);
        }
      }
    }
  }

  // --- Remplissage depuis l'avant (départage : n'apparaît pas comme violation)
  if (rules.fillFromFront) {
    assign.forEach((k) => {
      const seat = seatByKey.get(k);
      if (seat) score += (rows - 1 - seat.row) * W.fill;
    });
  }

  return { score, violations };
}

// ============================================
// Solveur
// ============================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG déterministe à partir d'une graine (pour « regénérer » de façon reproductible). */
export function seededRng(seed: number): () => number {
  return mulberry32(seed);
}

/** Élèves « bavards » : malus strictement supérieur à la médiane et >= 2. */
export function detectTalkers(students: SeatingStudentInfo[]): Set<string> {
  const withMalus = students.filter((s) => typeof s.malus === 'number');
  if (withMalus.length < 2) return new Set();
  const sorted = withMalus.map((s) => s.malus as number).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.max(2, median + 1);
  return new Set(withMalus.filter((s) => (s.malus as number) >= threshold).map((s) => s.id));
}

export function generateSeating(opts: GenerateOptions): SeatingResult {
  const rng = opts.rng ?? Math.random;
  const rules: SeatingRules = { ...DEFAULT_RULES, ...(opts.rules || {}) };
  const seats = listSeats(opts.room);
  const seatByKey = new Map(seats.map((s) => [s.key, s]));
  const studentById = new Map(opts.students.map((s) => [s.id, s]));
  const current = opts.currentPositions || {};

  // Contraintes valides seulement (élèves de la classe)
  const constraints = opts.constraints.filter((c) => {
    if (!studentById.has(c.student_id)) return false;
    if (PAIR_KINDS.has(c.kind)) return !!c.other_student_id && studentById.has(c.other_student_id) && c.other_student_id !== c.student_id;
    return true;
  });

  // Voisins latéraux du plan actuel (pour newNeighbors)
  const previousLateralPairs = new Set<string>();
  {
    const prevAssign = new Map<string, string>();
    Object.entries(current).forEach(([k, sid]) => { if (seatByKey.has(k) && studentById.has(sid)) prevAssign.set(sid, k); });
    for (const [a, b] of lateralPairs(prevAssign, seatByKey)) previousLateralPairs.add(pairKey(a, b));
  }

  const ctx: Ctx = {
    room: opts.room,
    seatByKey,
    studentById,
    constraints,
    rules,
    previousLateralPairs,
    talkerIds: rules.separateTalkers ? detectTalkers(opts.students) : new Set(),
  };

  // --- Verrouillage : fixed, et tous les placés si keepPlaced
  const locked = new Map<string, string>(); // studentId -> seatKey
  const lockedSeats = new Set<string>();
  const lockStudent = (sid: string) => {
    const entry = Object.entries(current).find(([k, v]) => v === sid && seatByKey.has(k));
    if (!entry || lockedSeats.has(entry[0])) return;
    locked.set(sid, entry[0]);
    lockedSeats.add(entry[0]);
  };
  for (const c of constraints) if (c.kind === 'fixed') lockStudent(c.student_id);
  if (rules.keepPlaced) for (const sid of Object.values(current)) if (studentById.has(sid)) lockStudent(sid);

  const free = opts.students.filter((s) => !locked.has(s.id));
  const freeSeats = seats.filter((s) => !lockedSeats.has(s.key));

  // --- Placement initial : glouton dans l'ordre depuis l'avant, avec les élèves
  // sous contrainte individuelle en premier (devant / au fond ont un siège évident).
  const priority = (s: SeatingStudentInfo): number => {
    let p = 0;
    for (const c of constraints) if (c.student_id === s.id || c.other_student_id === s.id) p += PAIR_KINDS.has(c.kind) ? 1 : 2;
    if (rules.accommodationsFront && (s.has_pap || s.has_pai || s.has_ppre)) p += 1;
    return p;
  };
  const shuffled = [...free];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.sort((a, b) => priority(b) - priority(a));

  const assign = new Map<string, string>(locked);
  const unplaced: string[] = [];
  const available = rules.fillFromFront ? [...freeSeats] : shuffleCopy(freeSeats, rng);
  for (const s of shuffled) {
    const seat = available.shift();
    if (!seat) { unplaced.push(s.id); continue; }
    assign.set(s.id, seat.key);
  }

  // --- Recuit simulé sur échanges
  const movable = shuffled.filter((s) => assign.has(s.id)).map((s) => s.id);
  const swapPool = freeSeats.map((s) => s.key);
  let currentScore = evaluate(ctx, assign, false).score;
  let best = new Map(assign);
  let bestScore = currentScore;

  const iterations = opts.iterations ?? Math.min(20000, Math.max(2000, movable.length * swapPool.length * 4));
  const t0 = Math.max(1, W.pair);
  for (let it = 0; it < iterations && movable.length > 0; it++) {
    const temp = t0 * (1 - it / iterations) + 0.01;
    const sid = movable[Math.floor(rng() * movable.length)];
    const from = assign.get(sid) as string;
    const to = swapPool[Math.floor(rng() * swapPool.length)];
    if (to === from) continue;
    // occupant de la case cible (échange) ou case vide (déplacement)
    let occupant: string | undefined;
    for (const [osid, k] of assign) { if (k === to) { occupant = osid; break; } }
    if (occupant && locked.has(occupant)) continue;
    assign.set(sid, to);
    if (occupant) assign.set(occupant, from);
    const next = evaluate(ctx, assign, false).score;
    const delta = next - currentScore;
    if (delta <= 0 || rng() < Math.exp(-delta / temp)) {
      currentScore = next;
      if (next < bestScore) { bestScore = next; best = new Map(assign); }
    } else {
      assign.set(sid, from);
      if (occupant) assign.set(occupant, to);
    }
    if (bestScore === 0 && it > 200) break;
  }

  const positions: Positions = {};
  best.forEach((k, sid) => { positions[k] = sid; });
  const { violations } = evaluate(ctx, best, true);
  return { positions, violations: dedupeViolations(violations), score: bestScore, unplaced };
}

function shuffleCopy<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dedupeViolations(v: SeatingViolation[]): SeatingViolation[] {
  const seen = new Set<string>();
  return v.filter((x) => {
    const k = `${x.constraintId}::${x.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => b.penalty - a.penalty);
}
