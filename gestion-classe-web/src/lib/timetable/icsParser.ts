/**
 * Lecture de l'export iCalendar de Pronote (« Mes informations » › Exporter l'emploi du temps).
 *
 * Particularités constatées sur un export réel (cf. PLAN_accueil_v2.md §3) :
 *  - aucune RRULE : chaque cours de l'année est un VEVENT à part (semaines A/B déjà résolues) ;
 *  - heures en UTC (`DTSTART:20260902T081500Z`), congés en journée entière (`DTSTART;VALUE=DATE:`) ;
 *  - statut dans CATEGORIES (« Cours - Cours annulé »…), congés dans « Jours fériés » ;
 *  - la classe et le demi-groupe sont lus dans DESCRIPTION (« Classe : 4D », « Groupe : [3°EP1] »,
 *    « Partie de classe : <3E> 3°EP1 »), plus fiable que SUMMARY ;
 *  - l'UID embarque l'horodatage de l'export : on le retire pour obtenir une clé stable.
 */

export type IcsEntryKind = 'lesson' | 'holiday';
export type IcsLessonStatus = 'normal' | 'canceled' | 'modified' | 'exceptional';

export interface IcsEntry {
  /** UID sans l'horodatage d'export, ex. « Cours-40048-1 » */
  externalId: string;
  kind: IcsEntryKind;
  startsAt: Date;
  /** exclusif pour les congés (lendemain du dernier jour) */
  endsAt: Date;
  /** clé de correspondance : le demi-groupe s'il y en a un, sinon la classe (« 4D », « 3°EP1 ») */
  label: string;
  /** classe de rattachement (« 3E » pour le groupe « 3°EP1 ») ; null pour un congé */
  classLabel: string | null;
  subject: string | null;
  room: string | null;
  status: IcsLessonStatus;
}

export interface IcsCalendar {
  entries: IcsEntry[];
  /** bornes annoncées par Pronote (X-CALSTART / X-CALEND), à défaut celles des événements */
  rangeStart: Date | null;
  rangeEnd: Date | null;
  /** nom du calendrier (X-WR-CALNAME), pour l'afficher à l'import */
  name: string | null;
}

interface RawProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** RFC 5545 §3.1 : une ligne qui commence par un espace ou une tabulation prolonge la précédente. */
export function unfoldLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      out.push(line);
    }
  }
  return out;
}

/** Sépare « NOM;PARAM=x:valeur » ; le premier « : » hors guillemets clôt les paramètres. */
function parseProperty(line: string): RawProperty | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;

  const [name, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Échappements iCalendar (\n, \, \; \\) puis entités HTML que Pronote glisse dans DESCRIPTION. */
export function unescapeText(value: string): string {
  return value
    .replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** « 20260902T081500Z » (UTC), « 20260902T101500 » (heure locale) ou « 20261018 » (date). */
export function parseIcsDate(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return new Date(+y, +mo - 1, +d);
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

/** Retire l'horodatage d'export : « Cours-40048-1-20260924T195501Z-Index-Education » → « Cours-40048-1 ». */
export function stableExternalId(uid: string): string {
  const m = /^(.*?)-\d{8}T\d{6}Z?(?:-.*)?$/.exec(uid);
  return m ? m[1] : uid;
}

function statusFromCategory(category: string): IcsLessonStatus {
  const c = category.toLowerCase();
  if (c.includes('annulé') || c.includes('annule')) return 'canceled';
  if (c.includes('exceptionnel')) return 'exceptional';
  if (c.includes('cours modifié') || c.includes('cours modifie')) return 'modified';
  // « Cours », « Cours maintenu », « Accompagnement modifié », « Réservation de matériel »
  return 'normal';
}

/** Lignes « Clé : valeur » de DESCRIPTION. */
function parseDescription(description: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of description.split('\n')) {
    const sep = line.indexOf(' : ');
    if (sep > 0) fields[line.slice(0, sep).trim()] = line.slice(sep + 3).trim();
  }
  return fields;
}

/**
 * Classe et demi-groupe d'un cours.
 *  - « Classe : 4D »                                      → { label: '4D', classLabel: '4D' }
 *  - « Groupe : [3°EP1] », « Partie de classe : <3E> 3°EP1 » → { label: '3°EP1', classLabel: '3E' }
 *  - « Groupe : [5D - VIE DE CLASSE] », « Partie… : <5D> OUI » → { label: '5D - VIE DE CLASSE', classLabel: '5D' }
 */
export function readClassAndGroup(
  fields: Record<string, string>,
  summary: string,
): { label: string; classLabel: string } | null {
  const group = fields['Groupe']?.replace(/^\[|\]$/g, '').trim();
  const part = fields['Partie de classe'];
  const partClass = part ? /<([^>]+)>/.exec(part)?.[1]?.trim() : undefined;
  const cls = fields['Classe']?.trim();

  if (group) return { label: group, classLabel: partClass || cls || group };
  if (cls) return { label: cls, classLabel: cls };

  // Repli sur SUMMARY : « MATIÈRE - 4D » (après un éventuel « Cours annulé : »)
  const tail = summary.replace(/^[^:]*annulé\s*:\s*/i, '').split(' - ').pop()?.trim();
  return tail ? { label: tail, classLabel: tail } : null;
}

/** Transforme le texte d'un .ics Pronote en cours et congés. Ignore ce qu'il ne comprend pas. */
export function parseIcs(text: string): IcsCalendar {
  const lines = unfoldLines(text);
  const entries: IcsEntry[] = [];
  let calStart: Date | null = null;
  let calEnd: Date | null = null;
  let name: string | null = null;

  let current: RawProperty[] | null = null;

  for (const line of lines) {
    const prop = parseProperty(line);
    if (!prop) continue;

    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === 'VEVENT') { current = []; continue; }
    if (prop.name === 'END' && prop.value.toUpperCase() === 'VEVENT') {
      if (current) {
        const entry = buildEntry(current);
        if (entry) entries.push(entry);
      }
      current = null;
      continue;
    }

    if (current) { current.push(prop); continue; }

    if (prop.name === 'X-CALSTART') calStart = parseIcsDate(prop.value);
    else if (prop.name === 'X-CALEND') calEnd = parseIcsDate(prop.value);
    else if (prop.name === 'X-WR-CALNAME') name = unescapeText(prop.value).trim();
  }

  entries.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return {
    entries,
    rangeStart: calStart ?? entries[0]?.startsAt ?? null,
    rangeEnd: calEnd ?? entries[entries.length - 1]?.endsAt ?? null,
    name,
  };
}

function buildEntry(props: RawProperty[]): IcsEntry | null {
  const get = (n: string) => props.find(p => p.name === n);
  const uid = get('UID')?.value;
  const start = get('DTSTART');
  const end = get('DTEND');
  if (!uid || !start) return null;

  const startsAt = parseIcsDate(start.value);
  if (!startsAt) return null;
  const allDay = start.params['VALUE'] === 'DATE' || /^\d{8}$/.test(start.value);
  const endsAt = (end && parseIcsDate(end.value))
    ?? (allDay ? new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate() + 1) : startsAt);

  const category = unescapeText(get('CATEGORIES')?.value ?? '');
  const summary = unescapeText(get('SUMMARY')?.value ?? '').trim();
  const externalId = stableExternalId(uid);

  if (allDay || /jours? f[ée]ri[ée]s?/i.test(category)) {
    return {
      externalId, kind: 'holiday', startsAt, endsAt,
      label: summary || 'Congé', classLabel: null, subject: null, room: null, status: 'normal',
    };
  }

  const fields = parseDescription(unescapeText(get('DESCRIPTION')?.value ?? ''));
  const who = readClassAndGroup(fields, summary);
  if (!who) return null;

  const location = get('LOCATION');
  const room = fields['Salle'] || (location ? unescapeText(location.value).trim() : '') || null;

  return {
    externalId,
    kind: 'lesson',
    startsAt,
    endsAt,
    label: who.label,
    classLabel: who.classLabel,
    subject: fields['Matière'] || null,
    room,
    status: statusFromCategory(category),
  };
}
