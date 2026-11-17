import { describe, expect, it } from 'vitest';
import {
  bandeDeCases,
  compteCarnet,
  etapesDuGroupe,
  lectures,
  legendeCarnet,
  libelleExamen,
  libelleLieu,
  messagesDuGroupe,
  minutesRestantes,
  questionsDuCarnet,
  raisonAVoir,
  texteLectures,
  titreSansMention,
} from '../liveCarnet';
import type { LiveMessage, LiveSummary } from '../liveQueries';

// extrait de definition.questions d'Yves Apabien (titres raccourcis)
const DEFINITION = [
  { id: 'hypothese', num: 'H', titre: 'Première hypothèse' },
  { id: 'quatre-signes', num: '1', titre: 'Les 4 symptômes' },
  { id: 'phenomene', num: '2', titre: 'Le phénomène observé' },
  { id: 'etre-vivant', num: '9', titre: "L'être vivant observé est… (facultative)" },
  { id: 'video', num: '11', titre: 'Décris ce que fait la grosse cellule. (bonus)' },
  { id: 'conclusion', num: 'C', titre: "Alors docteur, c'est grave ?" },
  { id: '_ordonnance', num: 'O', titre: 'Examens prescrits et pourquoi' },
  { id: '_demarche', num: 'D', titre: 'Démarche (pour le professeur)' },
];
const Q = questionsDuCarnet(DEFINITION);
const d = (o: Partial<LiveSummary>): LiveSummary => ({ v: 1, t: 0, ...o });
const hh = (t: number) => `${t}h`;

describe('questions du carnet et bande de cases', () => {
  it("garde les questions de l'élève, sans l'ordonnance ni la démarche", () => {
    expect(Q.map((q) => q.num)).toEqual(['H', '1', '2', '9', '11', 'C']);
  });

  it('repère les questions bonus ou facultatives au titre', () => {
    expect(Q.filter((q) => q.bonus).map((q) => q.id)).toEqual(['etre-vivant', 'video']);
    expect(titreSansMention(Q[4].titre)).toBe('Décris ce que fait la grosse cellule.');
  });

  it('ignore une définition illisible', () => {
    expect(questionsDuCarnet(null)).toEqual([]);
    expect(questionsDuCarnet([null, { num: '1' }, { id: 'x', num: 2 }])).toEqual([{ id: 'x', num: '2', titre: '', bonus: false }]);
  });

  it('coche les cases des questions répondues', () => {
    const b = bandeDeCases(Q, ['hypothese', 'phenomene', 'video']);
    expect(b?.map((c) => `${c.num}${c.faite ? '+' : ''}`)).toEqual(['H+', '1', '2+', '9', '11+', 'C']);
  });

  it("pas de bande sans `faites` (version du jeu plus ancienne)", () => {
    expect(bandeDeCases(Q, undefined)).toBeNull();
    expect(bandeDeCases([], ['hypothese'])).toBeNull();
  });
});

describe('compte et légende du carnet', () => {
  it('compte les questions numérotées, sans hypothèse, conclusion ni bonus', () => {
    expect(compteCarnet(Q, d({ faites: ['hypothese', 'quatre-signes', 'video', 'conclusion'] }))).toEqual({ faites: 1, sur: 2 });
  });

  it('sans `faites`, reprend le compte du jeu', () => {
    expect(compteCarnet(Q, d({ reponses: 3, sur: 8 }))).toEqual({ faites: 3, sur: 8 });
  });

  it('écrit la légende selon l’avancement', () => {
    expect(legendeCarnet(Q, d({ faites: [], ficheLue: 5, questionsPatient: 1 }))).toBe('vient de commencer · fiche patient lue · 1 question au patient');
    expect(legendeCarnet(Q, d({ faites: ['hypothese'], hypothese: true }))).toBe('0 / 2 questions · hypothèse écrite');
    expect(legendeCarnet(Q, d({ faites: ['quatre-signes'], hypothese: true, examens: ['cou', 'sang'] }))).toBe('1 / 2 questions · 2 examens faits');
    expect(legendeCarnet(Q, d({ faites: ['quatre-signes', 'phenomene', 'conclusion'], conclusion: true, examens: ['cou'] }))).toBe('2 / 2 questions · conclusion écrite');
  });
});

describe('Où ils en sont', () => {
  it('suit la consultation pas à pas, avec le lieu actuel', () => {
    const e = etapesDuGroupe(
      d({ ficheLue: 14, questionsPatient: 5, examens: ['gorge', 'cou', 'frottis'], lieu: 'laboratoire', faites: ['hypothese', 'quatre-signes'], hypothese: true }),
      Q,
      hh,
    );
    expect(e.map((x) => [x.titre, x.etat, x.detail])).toEqual([
      ['Fiche patient lue', 'fait', '14h'],
      ['Interrogatoire', 'fait', '5 questions au patient'],
      ['Examens au cabinet', 'fait', 'Gorge, cou'],
      ['Laboratoire · ici maintenant', 'ici', 'Frottis de gorge : fait'],
      ['Carnet', 'a-venir', '1 réponse sur 2, conclusion pas écrite'],
      ['Envoi du carnet', 'a-venir', 'pas encore envoyé'],
    ]);
  });

  it('montre le refus du labo à la place des examens', () => {
    const e = etapesDuGroupe(d({ lieu: 'laboratoire', dernierRefus: "Prescris d'abord l'examen", ficheLue: null }), Q, hh);
    expect(e[0]).toMatchObject({ etat: 'a-venir', detail: 'pas encore' });
    expect(e[3].detail).toBe("le labo refuse : « Prescris d'abord l'examen »");
  });

  it('un carnet envoyé : plus de lieu actuel, tout est fait', () => {
    const e = etapesDuGroupe(d({ lieu: 'sortie', envoye: true, conclusion: true, faites: ['quatre-signes', 'phenomene'], questionsPatient: 2, examens: ['cou'] }), Q, hh);
    expect(e.map((x) => x.etat)).toEqual(['fait', 'fait', 'fait', 'fait', 'fait']);
  });

  it("une fiche sans `ficheLue` : lue dès qu'il s'est passé quelque chose", () => {
    expect(etapesDuGroupe(d({ lieu: 'cabinet' }), Q, hh)[0].etat).toBe('fait');
    expect(etapesDuGroupe(d({ lieu: 'attente' }), Q, hh)[0].etat).toBe('a-venir');
  });
});

describe('à aller voir', () => {
  it('cite la dernière question que Morel ne comprend pas', () => {
    expect(raisonAVoir(d({ morelIncomprises: 3, morel: [{ t: 1, q: 'on fait koi', compris: null, niveau: 0 }, { t: 2, q: 'ok', compris: 'aide', niveau: 1 }] })))
      .toBe('Morel ne les comprend pas : 3 questions de suite. Dernière : « on fait koi »');
    expect(raisonAVoir(d({ dernierRefus: 'Prescris' }))).toBe('Labo : « Prescris »');
    expect(raisonAVoir(d({ morelIncomprises: 1 }))).toBeNull();
    expect(raisonAVoir(null)).toBeNull();
  });
});

describe('messages du service et lectures', () => {
  const g = (eleves: string[], lus?: string[], activityId = 'eve', classId = '3C') => ({ activityId, classId, eleves, w: { direct: d({ messagesLus: lus }) } });
  const msg = (o: Partial<LiveMessage>): LiveMessage => ({
    id: 'm1', activity_id: 'eve', class_id: null, student_ids: null, texte: '', style: 'info', signe: '', points: null, created_at: '2026-11-12T13:40:00Z', ...o,
  });

  it('compte les groupes qui ont lu un message à la classe', () => {
    const groupes = [g(['a', 'b'], ['m1']), g(['c'], []), g(['d'], ['m1']), g(['e'], ['m1'], 'yves')];
    const l = lectures(msg({ class_id: '3C' }), groupes);
    expect(l).toEqual({ lus: 2, sur: 3, suivi: true });
    expect(texteLectures(l)).toBe('2 / 3 lus');
  });

  it('un message à un groupe : « lu » ou « pas encore lu »', () => {
    expect(texteLectures(lectures(msg({ student_ids: ['b'] }), [g(['a', 'b'], ['m1']), g(['c'], [])]))).toBe('lu');
    expect(texteLectures(lectures(msg({ student_ids: ['c'] }), [g(['a', 'b'], ['m1']), g(['c'], [])]))).toBe('pas encore lu');
  });

  it("rien quand aucune fiche ne remonte les lectures (version plus ancienne)", () => {
    expect(texteLectures(lectures(msg({}), [g(['a'])]))).toBe('');
  });

  it("garde les messages d'un groupe, les plus récents d'abord", () => {
    const m = messagesDuGroupe(
      [
        msg({ id: '1', student_ids: ['a'], created_at: '2026-11-12T13:40:00Z' }),
        msg({ id: '2', student_ids: ['z'] }),
        msg({ id: '3', class_id: '3C', created_at: '2026-11-12T13:50:00Z' }),
        msg({ id: '4', class_id: '3B' }),
        msg({ id: '1', student_ids: ['a'], created_at: '2026-11-12T13:40:00Z' }),
        msg({ id: '5', activity_id: 'yves' }),
      ],
      g(['a', 'b']),
    );
    expect(m.map((x) => x.id)).toEqual(['3', '1']);
  });
});

describe('libellés et horloge', () => {
  it('nomme les lieux et les examens, avec repli', () => {
    expect(libelleLieu('laboratoire')).toBe('Laboratoire');
    expect(libelleLieu('vers-irm')).toBe('En chemin');
    expect(libelleLieu('inconnu')).toBe('inconnu');
    expect(libelleExamen('oeil')).toBe('Œil');
    expect(libelleExamen('irm-essai-yve')).toBe('IRM');
    expect(libelleExamen('radio-pied')).toBe('radio-pied');
  });

  it('compte les minutes restantes sur un cours de 55 min', () => {
    const debut = Date.parse('2026-11-12T14:30:00+01:00');
    expect(minutesRestantes(debut, Date.parse('2026-11-12T15:02:00+01:00'))).toBe(23);
    expect(minutesRestantes(debut, Date.parse('2026-11-12T15:35:00+01:00'))).toBe(-10);
  });
});
