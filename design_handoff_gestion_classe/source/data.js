// Mock data for Gestion de Classe prototype
// Realistic French middle-school context

const CLASSES = [
  { id: 'g1', label: '3ème groupe 1', short: '3G1', color: '#6366F1', students: 18, avg: 9.8, absRate: 0.12, nextSession: 'Mar 21 avr. 10:00' },
  { id: 'g2', label: '3ème groupe 2', short: '3G2', color: '#10B981', students: 17, avg: 10.8, absRate: 0.08 },
  { id: 'g3', label: '3ème groupe 3', short: '3G3', color: '#F59E0B', students: 17, avg: 11.4, absRate: 0.06 },
  { id: 'g4', label: '3ème groupe 4', short: '3G4', color: '#EC4899', students: 19, avg: 15.3, absRate: 0.04 },
  { id: 'g5', label: '3ème groupe 5', short: '3G5', color: '#8B5CF6', students: 21, avg: 10.0, absRate: 0.09 },
  { id: 'g6', label: '3ème groupe 6', short: '3G6', color: '#06B6D4', students: 18, avg: 10.7, absRate: 0.07 },
  { id: 'g7', label: '3ème groupe 7', short: '3G7', color: '#EF4444', students: 20, avg: 10.0, absRate: 0.11 },
  { id: 'e4', label: '4ème E',        short: '4E',  color: '#3B82F6', students: 24, avg: 11.5, absRate: 0.05 },
  { id: 'f4', label: '4ème F',        short: '4F',  color: '#14B8A6', students: 24, avg: 11.5, absRate: 0.06 },
  { id: 'd5', label: '5ème D',        short: '5D',  color: '#84CC16', students: 22, avg: 12.1, absRate: 0.03 },
  { id: 'a5', label: '5ème A',        short: '5A',  color: '#F43F5E', students: 23, avg: 10.9, absRate: 0.07 },
];

// Events history used to derive "trend". Last 8 sessions per student, signed score.
// +1 = participation positive, -1 = malus, -2 = gros souci, +2 = oral noté bien, 0 = absent, null = pas vu
function genHistory(seed, base) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out = [];
  for (let i = 0; i < 10; i++) {
    const r = rand();
    let v;
    if (r < 0.15) v = null;
    else if (r < 0.22) v = 0; // absent
    else if (r < 0.30) v = -2;
    else if (r < 0.45) v = -1;
    else if (r < 0.70) v = 1;
    else v = 2;
    // bias by base mark
    if (base > 12 && v < 0 && rand() > 0.3) v = 1;
    if (base < 6 && v > 0 && rand() > 0.4) v = -1;
    out.push(v);
  }
  return out;
}

const STUDENTS_3G1 = [
  { id: 'lia', name: 'Lilia AB.',     mark: 10.0, events: 0,  pos: 0,  neg: 0,  abs: 1, oral: 0, history: genHistory(11, 10) },
  { id: 'adi', name: 'Adi AS.',       mark: 10.0, events: 24, pos: 6,  neg: 5,  abs: 1, oral: 1, history: genHistory(12, 10) },
  { id: 'tai', name: 'Taim BE.',      mark: 0.0,  events: 23, pos: 1,  neg: 13, abs: 2, oral: 1, history: genHistory(13, 2) },
  { id: 'meh', name: 'Mehdi BO.',     mark: 8.0,  events: 24, pos: 4,  neg: 2,  abs: 1, oral: 4, history: genHistory(14, 8) },
  { id: 'eth', name: 'Ethan BR.',     mark: 15.0, events: 25, pos: 12, neg: 1,  abs: 0, oral: 3, history: genHistory(15, 15) },
  { id: 'adn', name: 'Adnane DO.',    mark: 5.0,  events: 24, pos: 2,  neg: 6,  abs: 0, oral: 1, history: genHistory(16, 5) },
  { id: 'let', name: 'Leticia GH.',   mark: 9.0,  events: 24, pos: 5,  neg: 2,  abs: 1, oral: 0, history: genHistory(17, 9) },
  { id: 'azr', name: 'Azra GU.',      mark: 11.0, events: 24, pos: 7,  neg: 1,  abs: 1, oral: 0, history: genHistory(18, 11) },
  { id: 'lin', name: 'Lina GU.',      mark: 12.0, events: 25, pos: 8,  neg: 1,  abs: 0, oral: 0, history: genHistory(19, 12) },
  { id: 'ale', name: 'Alexia HO.',    mark: 8.0,  events: 24, pos: 4,  neg: 2,  abs: 1, oral: 0, history: genHistory(20, 8) },
  { id: 'djy', name: 'Djyna KE.',     mark: 9.0,  events: 24, pos: 5,  neg: 2,  abs: 0, oral: 1, history: genHistory(21, 9) },
  { id: 'erd', name: 'Erdis KR.',     mark: 9.0,  events: 24, pos: 5,  neg: 2,  abs: 1, oral: 0, history: genHistory(22, 9) },
  { id: 'nel', name: 'Nelya LA.',     mark: 13.0, events: 24, pos: 9,  neg: 1,  abs: 0, oral: 2, history: genHistory(23, 13) },
  { id: 'ila', name: 'Ilana MA.',     mark: 11.0, events: 24, pos: 7,  neg: 1,  abs: 0, oral: 1, history: genHistory(24, 11) },
  { id: 'sam', name: 'Samy OU.',      mark: 6.0,  events: 24, pos: 3,  neg: 5,  abs: 1, oral: 0, history: genHistory(25, 6) },
  { id: 'noa', name: 'Noah PE.',      mark: 14.0, events: 25, pos: 10, neg: 1,  abs: 0, oral: 2, history: genHistory(26, 14) },
  { id: 'yas', name: 'Yasmine RO.',   mark: 11.0, events: 24, pos: 6,  neg: 1,  abs: 1, oral: 1, history: genHistory(27, 11) },
  { id: 'tho', name: 'Thomas ZA.',    mark: 7.0,  events: 24, pos: 4,  neg: 4,  abs: 2, oral: 0, history: genHistory(28, 7) },
  { id: 'hat', name: 'Hatim ME.',     mark: 9.0,  events: 24, pos: 5,  neg: 2,  abs: 1, oral: 2, history: genHistory(29, 9) },
  { id: 'efe', name: 'Efe SO.',       mark: 11.0, events: 24, pos: 7,  neg: 1,  abs: 0, oral: 1, history: genHistory(30, 11) },
  { id: 'kyl', name: 'Kylian TI.',    mark: 10.0, events: 24, pos: 6,  neg: 2,  abs: 1, oral: 0, history: genHistory(31, 10) },
];

const RECENT_SESSIONS = [
  { classId: 'e4', date: '10 avr. 2026', time: '10:54', events: 8,  topic: 'DM corrigé + oral sur Molière' },
  { classId: 'd5', date: '10 avr. 2026', time: '09:17', events: 6,  topic: 'Lecture cursive, séance 3' },
  { classId: 'g4', date: '10 avr. 2026', time: '08:33', events: 5,  topic: 'Argumentation — débat' },
  { classId: 'a5', date: '9 avr. 2026', time: '15:43', events: 16, topic: 'Contrôle de grammaire' },
  { classId: 'g5', date: '9 avr. 2026', time: '14:36', events: 9,  topic: 'Séquence poésie, entrée' },
];

const UPCOMING = [
  { classId: 'g1', date: 'Mardi 21 avr.', time: '10:00', topic: 'Oral blanc — 1ʳᵉ salve', room: 'B204', students: 18 },
  { classId: 'g3', date: 'Mardi 21 avr.', time: '14:00', topic: 'Lecture analytique — Rimbaud', room: 'B204', students: 17 },
  { classId: 'e4', date: 'Mercredi 22 avr.', time: '09:00', topic: 'Dictée + correction', room: 'C105', students: 24 },
];

// Students flagged for attention across all classes
const ATTENTION = [
  { id: 'tai', name: 'Taim BE.',   classLabel: '3ème groupe 1', classColor: '#6366F1', mark: 0.0, delta: -4.5, reason: '13 malus sur 23 séances · 2 abs récentes' },
  { id: 'adn', name: 'Adnane DO.', classLabel: '3ème groupe 1', classColor: '#6366F1', mark: 5.0, delta: -2.1, reason: 'En recul depuis 3 séances' },
  { id: 'sam', name: 'Samy OU.',   classLabel: '3ème groupe 1', classColor: '#6366F1', mark: 6.0, delta: -1.3, reason: '5 malus, 0 participation depuis le 4 avr.' },
  { id: 'tho', name: 'Thomas ZA.', classLabel: '3ème groupe 1', classColor: '#6366F1', mark: 7.0, delta: -0.8, reason: '2 absences consécutives' },
  { id: 'kyl', name: 'Kylian PA.', classLabel: '4ème E',       classColor: '#3B82F6', mark: 4.5, delta: -3.0, reason: 'Décrochage — 4 malus, 3 abs sur 5 séances' },
];

window.GC_DATA = { CLASSES, STUDENTS_3G1, RECENT_SESSIONS, UPCOMING, ATTENTION };
