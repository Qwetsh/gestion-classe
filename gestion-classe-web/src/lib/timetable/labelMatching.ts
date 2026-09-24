/**
 * Correspondance « libellé Pronote » → classe / groupe de l'application.
 *
 * Pronote nomme les cours « 4D » (classe entière) ou « 3°EP1 » avec la classe « 3E » (demi-groupe).
 * On propose une correspondance automatique ; l'enseignant la corrige une fois, elle est mémorisée
 * (table timetable_label_links) et resservira à chaque réimport, comme pour Pronote en direct.
 */

export interface MatchClass { id: string; name: string; }
export interface MatchGroup { id: string; class_id: string; name: string; }

export interface TimetableLabel {
  label: string;
  classLabel: string | null;
  subjects: string[];
  lessonCount: number;
}

export interface LabelLink {
  label: string;
  classId: string | null;
  groupId: string | null;
  /** « pas une de mes classes » : le cours reste affiché, sans lien vers une classe */
  ignored: boolean;
}

/** Minuscules, sans accents ni ponctuation : « 3°EP1 » → « 3ep1 », « 4 D » → « 4d ». */
export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Retrouve la classe : nom identique, sinon unique classe dont le nom commence par le libellé. */
export function matchClass(classLabel: string, classes: MatchClass[]): MatchClass | null {
  const target = normalizeLabel(classLabel);
  if (!target) return null;

  const exact = classes.filter(c => normalizeLabel(c.name) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  // « 4D » ↔ « 4D Sciences » : le libellé doit être suivi d'une coupure (espace, tiret…)
  const prefixed = classes.filter(c => {
    const raw = c.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const re = new RegExp(`^${target.split('').join('[^a-z0-9]*')}(?![a-z0-9])`);
    return re.test(raw);
  });
  return prefixed.length === 1 ? prefixed[0] : null;
}

/**
 * Numéro du demi-groupe dans un libellé Pronote : « 3°EP1 » → « 1 », « 3°AP2 » → « 2 ».
 * Rien pour « 5D - VIE DE CLASSE » (groupe qui couvre toute la classe).
 */
export function groupNumber(label: string, classLabel: string | null): string | null {
  if (classLabel && normalizeLabel(label) === normalizeLabel(classLabel)) return null;
  const m = /(\d+)\s*$/.exec(label.trim());
  return m ? m[1] : null;
}

/** Groupe de la classe dont le nom se termine par ce numéro (« Groupe 1 », « G1 », « 1 »). */
export function matchGroup(number: string, classId: string, groups: MatchGroup[]): MatchGroup | null {
  const candidates = groups.filter(g => g.class_id === classId && new RegExp(`(^|\\D)${number}$`).test(g.name.trim()));
  return candidates.length === 1 ? candidates[0] : null;
}

export function suggestLink(label: TimetableLabel, classes: MatchClass[], groups: MatchGroup[]): LabelLink {
  const cls = label.classLabel ? matchClass(label.classLabel, classes) : null;
  if (!cls) return { label: label.label, classId: null, groupId: null, ignored: true };

  const num = groupNumber(label.label, label.classLabel);
  const grp = num ? matchGroup(num, cls.id, groups) : null;
  return { label: label.label, classId: cls.id, groupId: grp?.id ?? null, ignored: false };
}

/**
 * Correspondances pour tous les libellés d'un import : celles déjà mémorisées sont gardées telles
 * quelles (l'enseignant a pu les corriger), les nouvelles sont proposées automatiquement.
 */
export function buildLinks(
  labels: TimetableLabel[],
  saved: LabelLink[],
  classes: MatchClass[],
  groups: MatchGroup[],
): LabelLink[] {
  const byLabel = new Map(saved.map(l => [l.label, l]));
  const classIds = new Set(classes.map(c => c.id));
  const groupIds = new Set(groups.map(g => g.id));

  return labels.map(l => {
    const known = byLabel.get(l.label);
    // une classe supprimée depuis : on repropose plutôt que de pointer dans le vide
    if (known && (known.ignored || (known.classId && classIds.has(known.classId)))) {
      return { ...known, groupId: known.groupId && groupIds.has(known.groupId) ? known.groupId : null };
    }
    return suggestLink(l, classes, groups);
  });
}

/** Regroupe les cours par libellé, dans l'ordre des classes (3A, 3°AP1, 3°AP2, 3B…). */
export function collectLabels(
  lessons: { label: string; classLabel: string | null; subject: string | null }[],
): TimetableLabel[] {
  const map = new Map<string, TimetableLabel>();
  for (const l of lessons) {
    let item = map.get(l.label);
    if (!item) {
      item = { label: l.label, classLabel: l.classLabel, subjects: [], lessonCount: 0 };
      map.set(l.label, item);
    }
    item.lessonCount++;
    if (l.subject && !item.subjects.includes(l.subject)) item.subjects.push(l.subject);
  }
  return [...map.values()].sort((a, b) => {
    const ka = `${a.classLabel ?? a.label}\u0000${a.label === a.classLabel ? '' : a.label}`;
    const kb = `${b.classLabel ?? b.label}\u0000${b.label === b.classLabel ? '' : b.label}`;
    return ka.localeCompare(kb, 'fr', { numeric: true });
  });
}

export interface ResolvedLabel {
  classId: string | null;
  className: string | null;
  groupId: string | null;
  groupName: string | null;
}

/**
 * Classe et groupe d'un cours à l'affichage : la correspondance mémorisée fait foi ;
 * sans elle (libellé jamais vu, typiquement Pronote en direct), on tente la proposition automatique.
 */
export function resolveLabel(
  label: string,
  classLabel: string | null,
  links: Map<string, LabelLink>,
  classes: MatchClass[],
  groups: MatchGroup[],
): ResolvedLabel {
  const link = links.get(label)
    ?? suggestLink({ label, classLabel: classLabel ?? label, subjects: [], lessonCount: 0 }, classes, groups);
  const cls = !link.ignored && link.classId ? classes.find(c => c.id === link.classId) ?? null : null;
  const grp = cls && link.groupId ? groups.find(g => g.id === link.groupId) ?? null : null;
  return {
    classId: cls?.id ?? null,
    className: cls?.name ?? null,
    groupId: grp?.id ?? null,
    groupName: grp?.name ?? null,
  };
}
