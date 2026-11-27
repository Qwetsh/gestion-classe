import { describe, expect, it } from 'vitest';
import { APRES_FIN_MS, MAX_LIVE_SESSION_MS, choisirSeance, ciblesPoints, construireBandeau, elevesAvecFiche, listeDeClasse, nomPatient, patientsEnCours, regrouperFiches } from '../liveClass';
import type { LiveWork } from '../liveQueries';

const t = (hhmm: string, jour = '2026-11-13') => Date.parse(`${jour}T${hhmm}:00+01:00`);
const iso = (hhmm: string, jour = '2026-11-13') => new Date(t(hhmm, jour)).toISOString();
const seance = (id: string, debut: string, fin: string | null, jour = '2026-11-13') => ({
  id,
  started_at: iso(debut, jour),
  ended_at: fin ? iso(fin, jour) : null,
});

describe('choisirSeance : la classe du cours en cours', () => {
  // séances réelles du 13/11 : 3E fermée en retard (quand 3A a démarré), 3C jamais terminée
  const journee = [
    seance('4A', '09:12', '10:06'),
    seance('3E', '10:21', '13:48'),
    seance('3A', '13:48', '14:37'),
    seance('3B', '14:37', '15:31'),
    seance('3C', '15:54', null),
  ];

  it('prend la dernière séance démarrée, même si la précédente est restée ouverte', () => {
    expect(choisirSeance(journee, t('14:50'))?.id).toBe('3B');
    expect(choisirSeance(journee, t('14:00'))?.id).toBe('3A');
  });

  it("ne garde pas une séance fermée en retard une fois la suivante démarrée", () => {
    expect(choisirSeance(journee, t('13:50'))?.id).toBe('3A');
  });

  it("ignore les séances démarrées après l'instant regardé", () => {
    expect(choisirSeance(journee, t('10:30'))?.id).toBe('3E');
  });

  it('oublie une séance jamais terminée au bout de 2 h 15', () => {
    expect(choisirSeance(journee, t('17:30'))?.id).toBe('3C');
    expect(choisirSeance(journee, t('18:10'))).toBeNull();
    expect(choisirSeance(journee, t('08:30', '2026-11-16'))).toBeNull();
    expect(MAX_LIVE_SESSION_MS).toBe(135 * 60_000);
  });

  it("garde une double heure jusqu'au bout", () => {
    expect(choisirSeance([seance('3D', '14:50', null, '2026-11-10')], t('16:55', '2026-11-10'))?.id).toBe('3D');
  });

  it("garde une séance terminée un quart d'heure après la fin, pas plus", () => {
    const fin = [seance('3B', '14:37', '15:31')];
    expect(choisirSeance(fin, t('15:40'))?.id).toBe('3B');
    expect(choisirSeance(fin, t('15:31') + APRES_FIN_MS + 60_000)).toBeNull();
  });

  it('sans séance : null', () => {
    expect(choisirSeance([], t('10:00'))).toBeNull();
  });
});

describe('construireBandeau : pas connectés, absents, sortis', () => {
  const classe = [
    { id: 'z', pseudo: 'Zoé' },
    { id: 'a', pseudo: 'Adam' },
    { id: 'e', pseudo: 'Émile' },
    { id: 'l', pseudo: 'Lina' },
    { id: 'n', pseudo: 'Noé' },
  ];
  const ev = (student_id: string, type: string, hhmm: string, subtype: string | null = null) => ({ student_id, type, subtype, timestamp: iso(hhmm) });

  it("liste par ordre alphabétique ceux qui n'ont pas de fiche", () => {
    const b = construireBandeau(classe, ['z', 'l'], []);
    expect(b.pasConnectes.map((e) => e.pseudo)).toEqual(['Adam', 'Émile', 'Noé']);
    expect(b.absents).toEqual([]);
    expect(b.sortis).toEqual([]);
  });

  it('chaque élève d\'un binôme a sa fiche : personne ne manque', () => {
    expect(construireBandeau(classe, ['z', 'a', 'e', 'l', 'n', 'a'], []).pasConnectes).toEqual([]);
  });

  it('un absent noté ne figure pas parmi les pas connectés', () => {
    const b = construireBandeau(classe, ['z', 'l'], [ev('n', 'absence', '14:31')]);
    expect(b.pasConnectes.map((e) => e.id)).toEqual(['a', 'e']);
    expect(b.absents.map((e) => e.id)).toEqual(['n']);
  });

  it('un élève sorti sans retour est signalé, avec le motif', () => {
    const b = construireBandeau(classe, ['z', 'a', 'e', 'l', 'n'], [
      ev('a', 'sortie', '14:40', 'infirmerie'),
      ev('l', 'sortie', '14:41', 'toilettes'),
      ev('l', 'retour', '14:48'),
      ev('z', 'sortie', '14:50', 'autre'),
    ]);
    expect(b.sortis.map((s) => [s.eleve.id, s.motif, s.depuis])).toEqual([
      ['a', 'infirmerie', t('14:40')],
      ['z', 'sorti', t('14:50')],
    ]);
  });

  it("lit les sorties dans l'ordre des heures, pas dans l'ordre reçu", () => {
    const b = construireBandeau(classe, [], [ev('a', 'retour', '14:50'), ev('a', 'sortie', '14:40', 'convocation')]);
    expect(b.sortis).toEqual([]);
    const c = construireBandeau(classe, [], [ev('a', 'sortie', '14:55', 'convocation'), ev('a', 'retour', '14:50')]);
    expect(c.sortis.map((s) => s.motif)).toEqual(['convocation']);
  });

  it('nomme les quatre motifs de sortie du téléphone', () => {
    const motifs = ['infirmerie', 'toilettes', 'convocation', 'exclusion'].map((m, i) =>
      construireBandeau(classe, [], [ev('a', 'sortie', `14:4${i}`, m)]).sortis[0].motif);
    expect(motifs).toEqual(['infirmerie', 'toilettes', 'convocation', 'exclusion']);
  });

  it("ignore les événements d'élèves hors de la liste (autre demi-groupe)", () => {
    const b = construireBandeau(classe.slice(0, 2), [], [ev('n', 'absence', '14:31')]);
    expect(b.absents).toEqual([]);
    expect(b.pasConnectes.map((e) => e.id)).toEqual(['a', 'z']);
  });
});

describe('nomPatient', () => {
  it("garde le nom du patient d'un titre de l'hôpital", () => {
    expect(nomPatient('Hôpital virtuel — Eve Amalle')).toBe('Eve Amalle');
    expect(nomPatient('TP microscope')).toBe('TP microscope');
    expect(nomPatient(null)).toBe('Activité');
  });
});

describe('listeDeClasse', () => {
  const eleves = [
    { id: 'a', pseudo: 'Adam', is_deleted: false, is_witness: false },
    { id: 'b', pseudo: 'Bilal', is_deleted: true, is_witness: false },
    { id: 'c', pseudo: 'Témoin', is_deleted: false, is_witness: true },
    { id: 'd', pseudo: 'Dina', is_deleted: null, is_witness: null },
  ];

  it('écarte les élèves supprimés et les témoins', () => {
    expect(listeDeClasse(eleves, null, null)).toEqual([{ id: 'a', pseudo: 'Adam' }, { id: 'd', pseudo: 'Dina' }]);
  });

  it('se limite aux membres du demi-groupe de la séance', () => {
    expect(listeDeClasse(eleves, 'g1', ['d', 'b']).map((e) => e.id)).toEqual(['d']);
    expect(listeDeClasse(eleves, 'g1', []).map((e) => e.id)).toEqual([]);
  });
});

describe('regrouperFiches : une carte par groupe et par patient', () => {
  const EVE = { title: 'Hôpital virtuel — Eve Amalle', key: 'hopital-eve-amalle' };
  const YVES = { title: 'Hôpital virtuel — Yves Apabien', key: 'hopital-yve-apabien' };
  let n = 0;
  const fiche = (o: Partial<LiveWork> & { student_id: string; activity_id: string }): LiveWork => ({
    id: `w${++n}`,
    class_id: '3C',
    group_key: null,
    group_pseudos: null,
    status: 'draft',
    updated_at: iso('14:40', '2026-11-12'),
    classes: { name: '3C' },
    activities: o.activity_id === 'eve' ? EVE : YVES,
    students: { pseudo: o.student_id },
    direct: null,
    ...o,
  });
  const works = [
    // binôme sur Eve : une fiche par élève, même group_key
    fiche({ student_id: 'a', activity_id: 'eve', group_key: 'k1', group_pseudos: ['A', 'B'], updated_at: iso('14:41', '2026-11-12') }),
    fiche({ student_id: 'b', activity_id: 'eve', group_key: 'k1', group_pseudos: ['A', 'B'], updated_at: iso('14:45', '2026-11-12') }),
    // le même binôme a aussi une fiche sur Yves (même group_key, autre patient)
    fiche({ student_id: 'a', activity_id: 'yves', group_key: 'k1', group_pseudos: ['A', 'B'], updated_at: iso('14:20', '2026-11-12') }),
    // un trio sur Yves, qui a besoin du prof (Morel ne le comprend pas) : en tête malgré l'heure
    fiche({ student_id: 'c', activity_id: 'yves', group_key: 'k2', updated_at: iso('14:30', '2026-11-12') }),
    fiche({ student_id: 'd', activity_id: 'yves', group_key: 'k2', updated_at: iso('14:31', '2026-11-12'), direct: { v: 1, t: t('14:31', '2026-11-12'), morelIncomprises: 2 } }),
    fiche({ student_id: 'e', activity_id: 'yves', group_key: 'k2', updated_at: iso('14:29', '2026-11-12') }),
    // une autre classe
    fiche({ student_id: 'x', activity_id: 'eve', class_id: '3B', classes: { name: '3B' } }),
  ];

  it('met tous les patients de la classe sur la même grille, le patient sur chaque carte', () => {
    const g = regrouperFiches(works, { classeId: '3C' });
    expect(g.map((x) => [x.patient, [...x.eleves].sort()])).toEqual([
      ['Yves Apabien', ['c', 'd', 'e']],
      ['Eve Amalle', ['a', 'b']],
      ['Yves Apabien', ['a']],
    ]);
  });

  it('garde la fiche la plus récente du groupe et les noms du binôme', () => {
    const eve = regrouperFiches(works, { classeId: '3C', patient: 'eve' });
    expect(eve).toHaveLength(1);
    expect(eve[0].w.student_id).toBe('b');
    expect(eve[0].noms).toEqual(['A', 'B']);
    expect(eve[0].maj).toBe(t('14:45', '2026-11-12'));
  });

  it('sans classe choisie, prend toutes les classes', () => {
    expect(regrouperFiches(works)).toHaveLength(4);
  });

  it('liste les patients et les élèves qui ont une fiche', () => {
    expect(patientsEnCours(works).map((p) => [p.id, p.nom, p.key])).toEqual([
      ['eve', 'Eve Amalle', 'hopital-eve-amalle'],
      ['yves', 'Yves Apabien', 'hopital-yve-apabien'],
    ]);
    expect([...elevesAvecFiche(works)].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'x']);
  });
});

describe('ciblesPoints : des points à toute la classe, une fois par élève', () => {
  it('vise les élèves de chaque patient par leur id', () => {
    expect(ciblesPoints([
      { activityId: 'eve', eleves: ['a', 'b'], maj: 2 },
      { activityId: 'yves', eleves: ['c', 'd', 'e'], maj: 1 },
      { activityId: 'eve', eleves: ['f'], maj: 3 },
    ])).toEqual([
      { activityId: 'eve', eleves: ['a', 'b', 'f'] },
      { activityId: 'yves', eleves: ['c', 'd', 'e'] },
    ]);
  });

  it("ne vise un élève qui a joué deux patients que sur le plus récent", () => {
    expect(ciblesPoints([
      { activityId: 'yves', eleves: ['a', 'b'], maj: 1 },
      { activityId: 'eve', eleves: ['a', 'b'], maj: 5 },
      { activityId: 'yves', eleves: ['c'], maj: 2 },
    ])).toEqual([
      { activityId: 'eve', eleves: ['a', 'b'] },
      { activityId: 'yves', eleves: ['c'] },
    ]);
  });

  it('sans groupe affiché : aucun envoi', () => {
    expect(ciblesPoints([])).toEqual([]);
  });
});
