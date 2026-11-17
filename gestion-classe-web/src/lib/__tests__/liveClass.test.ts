import { describe, expect, it } from 'vitest';
import { APRES_FIN_MS, MAX_LIVE_SESSION_MS, choisirSeance, construireBandeau, nomPatient } from '../liveClass';

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
    expect(b.sortis.map((s) => [s.eleve.id, s.motif])).toEqual([
      ['a', 'infirmerie'],
      ['z', 'sorti'],
    ]);
  });

  it("lit les sorties dans l'ordre des heures, pas dans l'ordre reçu", () => {
    const b = construireBandeau(classe, [], [ev('a', 'retour', '14:50'), ev('a', 'sortie', '14:40', 'vie_scolaire')]);
    expect(b.sortis).toEqual([]);
    const c = construireBandeau(classe, [], [ev('a', 'sortie', '14:55', 'vie_scolaire'), ev('a', 'retour', '14:50')]);
    expect(c.sortis.map((s) => s.motif)).toEqual(['vie scolaire']);
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
