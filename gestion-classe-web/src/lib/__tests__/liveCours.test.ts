import { describe, expect, it } from 'vitest';
import { MARGE_DEBUT_COURS_MS, debutDuCours, fichesAffichees } from '../liveClass';
import type { LiveWork } from '../liveQueries';

// heure locale, comme la page (les horaires du collège sont en heure locale du poste)
const local = (hhmm: string, jour: [number, number, number] = [2026, 10, 17]) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(jour[0], jour[1], jour[2], h, m).getTime();
};

describe('debutDuCours : le créneau horaire en cours', () => {
  it('en plein créneau : la sonnerie de début de cette heure', () => {
    expect(debutDuCours(local('14:50'))).toBe(local('14:35'));
    expect(debutDuCours(local('08:40'))).toBe(local('08:13'));
    expect(debutDuCours(local('11:40'))).toBe(local('11:15'));
  });

  it("pile à la sonnerie : l'heure qui commence, pas celle qui finit", () => {
    expect(debutDuCours(local('14:35'))).toBe(local('14:35'));
    expect(debutDuCours(local('09:10'))).toBe(local('09:10'));
    expect(debutDuCours(local('13:37'))).toBe(local('13:37'));
  });

  it('pendant la récréation ou la pause de midi : la dernière heure commencée', () => {
    expect(debutDuCours(local('10:10'))).toBe(local('09:10'));
    expect(debutDuCours(local('15:35'))).toBe(local('14:35'));
    expect(debutDuCours(local('12:45'))).toBe(local('11:15'));
  });

  it("le soir : la dernière heure du jour ; avant la première heure : rien (2 dernières heures)", () => {
    expect(debutDuCours(local('18:30'))).toBe(local('15:40'));
    expect(debutDuCours(local('23:59'))).toBe(local('15:40'));
    expect(debutDuCours(local('07:55'))).toBeNull();
    expect(debutDuCours(local('00:05'))).toBeNull();
  });

  it("reste dans le jour de `maintenant`", () => {
    expect(debutDuCours(local('08:20', [2026, 10, 18]))).toBe(local('08:13', [2026, 10, 18]));
  });
});

describe('fichesAffichees : la période et les membres du demi-groupe', () => {
  let n = 0;
  const fiche = (student_id: string, group_key: string | null, hhmm: string, o: Partial<LiveWork> = {}) =>
    ({ id: `w${++n}`, activity_id: 'yves', student_id, group_key, updated_at: new Date(local(hhmm)).toISOString(), direct: null, ...o }) as LiveWork;

  // 3A du 17/11 : une séance classe entière ; le groupe 1 a joué de 13 h 46 à 14 h 35, le groupe 2 depuis 14 h 39
  const works = [
    fiche('a1', 'g1', '14:34'),
    fiche('a2', 'g1', '14:35'),
    fiche('b1', 'g2', '14:48'),
    fiche('b2', 'g2', '14:41'), // fiche moins récente d'un groupe actif : gardée avec son groupe
    fiche('b3', null, '14:52'),
  ];
  const ids = (w: LiveWork[]) => w.map((x) => x.student_id).sort();

  it("« Ce cours » : seulement les groupes actifs depuis la sonnerie + 2 min", () => {
    const depuis = debutDuCours(local('14:50'))! + MARGE_DEBUT_COURS_MS;
    expect(ids(fichesAffichees(works, { depuis }))).toEqual(['b1', 'b2', 'b3']);
  });

  it("le dernier signe de vie compte aussi le résumé en direct (_direct.t)", () => {
    const tardif = fiche('c1', 'g3', '14:20', { direct: { t: local('14:40') } as LiveWork['direct'] });
    expect(ids(fichesAffichees([tardif], { depuis: local('14:37') }))).toEqual(['c1']);
  });

  it('séance de demi-groupe : un groupe reste affiché dès qu’un de ses élèves est membre', () => {
    const membres = new Set(['b1', 'b3']);
    expect(ids(fichesAffichees(works, { membres }))).toEqual(['b1', 'b2', 'b3']);
    expect(ids(fichesAffichees(works, { membres: new Set(['a2']) }))).toEqual(['a1', 'a2']);
    expect(fichesAffichees(works, { membres: new Set(['z']) })).toEqual([]);
  });

  it('les deux filtres ensemble, et aucun filtre : tout', () => {
    expect(ids(fichesAffichees(works, { depuis: local('14:37'), membres: new Set(['a1', 'b3']) }))).toEqual(['b3']);
    expect(fichesAffichees(works, { depuis: null, membres: null })).toBe(works);
  });

  it('le même group_key sur deux patients : deux groupes distincts', () => {
    const eve = fiche('a1', 'g1', '14:45', { activity_id: 'eve' });
    expect(ids(fichesAffichees([...works, eve], { depuis: local('14:37') }))).toEqual(['a1', 'b1', 'b2', 'b3']);
  });
});
