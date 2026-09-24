import { describe, expect, it } from 'vitest';
import {
  parseIcs,
  parseIcsDate,
  stableExternalId,
  unescapeText,
  unfoldLines,
} from '../timetable/icsParser';
import {
  buildLinks,
  collectLabels,
  groupNumber,
  matchClass,
  matchGroup,
  normalizeLabel,
  suggestLink,
} from '../timetable/labelMatching';

// Extrait d'un export Pronote réel (nom du professeur remplacé), replis de ligne d'origine conservés.
const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID;LANGUAGE=fr:Copyright Index-Education - Index-Education - ProNote202',
  ' 6 2026',
  'METHOD:PUBLISH',
  'X-CALSTART:20260831T000000Z',
  'X-CALEND:20270702T000000Z',
  'X-WR-CALNAME;LANGUAGE=fr:Calendrier - PROF X - du 01 septembre 2026',
  '  au 02 juillet 2027',
  'BEGIN:VEVENT',
  'CATEGORIES:Cours',
  'DTSTAMP:20260924T175501Z',
  'UID:Cours-40048-1-20260924T195501Z-Index-Education',
  'DTSTART:20260902T081500Z',
  'DTEND:20260902T091500Z',
  'SUMMARY;LANGUAGE=fr:SCIENCES VIE & TERRE - 4D',
  'LOCATION;LANGUAGE=fr:salle 310 Sciences',
  'DESCRIPTION;LANGUAGE=fr:Matière : SCIENCES VIE &amp\\; TERRE\\nProfesseur : P',
  ' ROF X.\\nClasse : 4D\\nSalle : salle 310 Sciences\\n',
  'COLOR:#E1FBE7',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'CATEGORIES:Cours - Cours annulé',
  'UID:Cours-40279-1-20260924T195501Z-Index-Education',
  'DTSTART:20260903T134000Z',
  'DTEND:20260903T144000Z',
  'SUMMARY;LANGUAGE=fr:Cours annulé : SCIENCES VIE & TERRE - [3°EP1] - <3E> 3°',
  ' EP1',
  'LOCATION;LANGUAGE=fr:salle 310 Sciences',
  'DESCRIPTION;LANGUAGE=fr:Cours annulé\\nMatière : SCIENCES VIE &amp\\; TERRE\\n',
  ' Professeur : PROF X.\\nGroupe : [3°EP1]\\nPartie de classe : &lt\\;3E&gt\\;',
  '  3°EP1\\nSalle : salle 310 Sciences\\n',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'CATEGORIES:Cours',
  'UID:Cours-40174-1-20260924T195501Z-Index-Education',
  'DTSTART:20260904T091500Z',
  'DTEND:20260904T101000Z',
  'SUMMARY;LANGUAGE=fr:VIE DE CLASSE - [5D - VIE DE CLASSE] - <5D> OUI',
  'LOCATION;LANGUAGE=fr:salle 310 Sciences',
  'DESCRIPTION;LANGUAGE=fr:Matière : VIE DE CLASSE\\nProfesseur : PROF X.\\nG',
  ' roupe : [5D - VIE DE CLASSE]\\nPartie de classe : &lt\\;5D&gt\\; OUI\\nSalle :',
  '  salle 310 Sciences\\n',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'CATEGORIES:Cours - Accompagnement modifié',
  'UID:Cours-41431-4-20260924T195501Z-Index-Education',
  'DTSTART:20260925T134000Z',
  'DTEND:20260925T144000Z',
  'SUMMARY;LANGUAGE=fr:DEVOIRS FAITS - 6D',
  'LOCATION;LANGUAGE=fr:salle 401\\, salle 403',
  'DESCRIPTION;LANGUAGE=fr:Matière : DEVOIRS FAITS\\nProfesseur : PROF X.\\nClasse : 6D\\n',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'CATEGORIES:Cours - Cours modifié',
  'UID:Cours-41343-4-20260924T195501Z-Index-Education',
  'DTSTART:20260922T134000Z',
  'DTEND:20260922T141000Z',
  'SUMMARY;LANGUAGE=fr:Rencontre Equipe de Direction - 4C',
  'LOCATION;LANGUAGE=fr:Salle de réunion',
  'DESCRIPTION;LANGUAGE=fr:Matière : Rencontre Equipe de Direction\\nClasse : 4C\\n',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'CATEGORIES:Jours fériés',
  'UID:Ferie-32-20260924T195501Z-Index-Education',
  'DTSTART;VALUE=DATE:20261018',
  'DTEND;VALUE=DATE:20261102',
  'SUMMARY;LANGUAGE=fr:Vacances',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('unfoldLines — lignes repliées (RFC 5545)', () => {
  it('recolle une ligne coupée au milieu d’un mot', () => {
    expect(unfoldLines('A:Pro\r\n fesseur\r\nB:x')).toEqual(['A:Professeur', 'B:x']);
  });

  it('ne retire que le premier espace du repli', () => {
    expect(unfoldLines('A:Salle :\n  salle 310')).toEqual(['A:Salle : salle 310']);
  });
});

describe('petites fonctions de lecture', () => {
  it('déséchappe iCalendar et les entités HTML de Pronote', () => {
    expect(unescapeText('SCIENCES VIE &amp\\; TERRE\\nsalle 401\\, 403')).toBe('SCIENCES VIE & TERRE\nsalle 401, 403');
    expect(unescapeText('&lt\\;3E&gt\\; 3°EP1')).toBe('<3E> 3°EP1');
  });

  it('lit les dates UTC et les journées entières', () => {
    expect(parseIcsDate('20260902T081500Z')?.toISOString()).toBe('2026-09-02T08:15:00.000Z');
    const d = parseIcsDate('20261018')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 18, 0]);
    expect(parseIcsDate('n’importe quoi')).toBeNull();
  });

  it('retire l’horodatage d’export de l’UID', () => {
    expect(stableExternalId('Cours-40048-1-20260924T195501Z-Index-Education')).toBe('Cours-40048-1');
    expect(stableExternalId('Ferie-32-20260924T195501Z-Index-Education')).toBe('Ferie-32');
    expect(stableExternalId('autre-uid')).toBe('autre-uid');
  });
});

describe('parseIcs — export Pronote', () => {
  const cal = parseIcs(SAMPLE);
  const byId = (id: string) => cal.entries.find(e => e.externalId === id)!;

  it('lit l’en-tête du calendrier', () => {
    expect(cal.name).toBe('Calendrier - PROF X - du 01 septembre 2026 au 02 juillet 2027');
    expect(cal.rangeStart?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(cal.rangeEnd?.toISOString()).toBe('2027-07-02T00:00:00.000Z');
  });

  it('trie les événements par date', () => {
    expect(cal.entries).toHaveLength(6);
    const times = cal.entries.map(e => e.startsAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('lit un cours de classe entière', () => {
    expect(byId('Cours-40048-1')).toMatchObject({
      kind: 'lesson', label: '4D', classLabel: '4D',
      subject: 'SCIENCES VIE & TERRE', room: 'salle 310 Sciences', status: 'normal',
    });
    expect(byId('Cours-40048-1').startsAt.toISOString()).toBe('2026-09-02T08:15:00.000Z');
    expect(byId('Cours-40048-1').endsAt.toISOString()).toBe('2026-09-02T09:15:00.000Z');
  });

  it('lit un demi-groupe annulé', () => {
    expect(byId('Cours-40279-1')).toMatchObject({ label: '3°EP1', classLabel: '3E', status: 'canceled' });
  });

  it('lit un groupe qui couvre toute la classe', () => {
    expect(byId('Cours-40174-1')).toMatchObject({ label: '5D - VIE DE CLASSE', classLabel: '5D', subject: 'VIE DE CLASSE' });
  });

  it('prend la salle de LOCATION à défaut de DESCRIPTION', () => {
    expect(byId('Cours-41431-4')).toMatchObject({ label: '6D', room: 'salle 401, salle 403', status: 'normal' });
  });

  it('distingue cours modifié', () => {
    expect(byId('Cours-41343-4')).toMatchObject({ label: '4C', status: 'modified', subject: 'Rencontre Equipe de Direction' });
  });

  it('lit les vacances comme un congé en journée entière (fin exclusive)', () => {
    const v = byId('Ferie-32');
    expect(v).toMatchObject({ kind: 'holiday', label: 'Vacances', classLabel: null });
    expect([v.startsAt.getMonth(), v.startsAt.getDate()]).toEqual([9, 18]);
    expect([v.endsAt.getMonth(), v.endsAt.getDate()]).toEqual([10, 2]);
  });

  it('ne plante pas sur un fichier vide ou étranger', () => {
    expect(parseIcs('').entries).toEqual([]);
    expect(parseIcs('bonjour').entries).toEqual([]);
  });
});

describe('correspondance libellé → classe / groupe', () => {
  const classes = [
    { id: 'c3a', name: '3A' }, { id: 'c3e', name: '3E' }, { id: 'c4d', name: '4D' },
    { id: 'c5d', name: '5D' }, { id: 'c5e1', name: '5e1' }, { id: 'c6x', name: '6B Sciences' },
  ];
  const groups = [
    { id: 'g3a1', class_id: 'c3a', name: 'Groupe 1' }, { id: 'g3a2', class_id: 'c3a', name: 'Groupe 2' },
    { id: 'g3e1', class_id: 'c3e', name: 'G1' }, { id: 'g3e2', class_id: 'c3e', name: 'G2' },
  ];
  const label = (l: string, c: string | null) => ({ label: l, classLabel: c, subjects: [], lessonCount: 1 });

  it('normalise les libellés', () => {
    expect(normalizeLabel('3°EP1')).toBe('3ep1');
    expect(normalizeLabel(' 6ème B ')).toBe('6emeb');
  });

  it('retrouve une classe par nom exact ou préfixe', () => {
    expect(matchClass('4D', classes)?.id).toBe('c4d');
    expect(matchClass('4d', classes)?.id).toBe('c4d');
    expect(matchClass('6B', classes)?.id).toBe('c6x');
    expect(matchClass('5E', classes)).toBeNull(); // « 5e1 » n'est pas la 5E
    expect(matchClass('6D', classes)).toBeNull();
  });

  it('extrait le numéro du demi-groupe', () => {
    expect(groupNumber('3°EP1', '3E')).toBe('1');
    expect(groupNumber('3°AP2', '3A')).toBe('2');
    expect(groupNumber('5D - VIE DE CLASSE', '5D')).toBeNull();
    expect(groupNumber('4D', '4D')).toBeNull();
  });

  it('retrouve le groupe par son numéro', () => {
    expect(matchGroup('2', 'c3a', groups)?.id).toBe('g3a2');
    expect(matchGroup('1', 'c3e', groups)?.id).toBe('g3e1');
    expect(matchGroup('1', 'c4d', groups)).toBeNull();
  });

  it('propose classe + groupe, classe seule, ou « ignorer »', () => {
    expect(suggestLink(label('3°AP1', '3A'), classes, groups)).toEqual({ label: '3°AP1', classId: 'c3a', groupId: 'g3a1', ignored: false });
    expect(suggestLink(label('3°BP1', '3B'), classes, groups).ignored).toBe(true);
    expect(suggestLink(label('5D - VIE DE CLASSE', '5D'), classes, groups)).toEqual({ label: '5D - VIE DE CLASSE', classId: 'c5d', groupId: null, ignored: false });
    expect(suggestLink(label('6D', '6D'), classes, groups)).toEqual({ label: '6D', classId: null, groupId: null, ignored: true });
  });

  it('garde les correspondances déjà mémorisées et repropose celles devenues invalides', () => {
    const saved = [
      { label: '4D', classId: 'c5d', groupId: null, ignored: false },      // corrigée à la main : gardée
      { label: '6D', classId: null, groupId: null, ignored: true },         // ignorée : gardée
      { label: '3°AP1', classId: 'disparue', groupId: null, ignored: false }, // classe supprimée : reproposée
    ];
    const links = buildLinks([label('4D', '4D'), label('6D', '6D'), label('3°AP1', '3A')], saved, classes, groups);
    expect(links).toEqual([
      { label: '4D', classId: 'c5d', groupId: null, ignored: false },
      { label: '6D', classId: null, groupId: null, ignored: true },
      { label: '3°AP1', classId: 'c3a', groupId: 'g3a1', ignored: false },
    ]);
  });

  it('regroupe et ordonne les libellés d’un import', () => {
    const labels = collectLabels([
      { label: '4D', classLabel: '4D', subject: 'SVT' },
      { label: '3°AP2', classLabel: '3A', subject: 'SVT' },
      { label: '3A', classLabel: '3A', subject: 'SVT' },
      { label: '3°AP1', classLabel: '3A', subject: 'SVT' },
      { label: '4D', classLabel: '4D', subject: 'PC' },
    ]);
    expect(labels.map(l => l.label)).toEqual(['3A', '3°AP1', '3°AP2', '4D']);
    expect(labels[3]).toMatchObject({ lessonCount: 2, subjects: ['SVT', 'PC'] });
  });
});
