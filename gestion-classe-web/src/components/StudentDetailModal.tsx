import { useMemo } from 'react';
import { CategoryIcon } from './rewards/CategoryIcon';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { classTone } from '../lib/classColors';
import { ACCOMMODATION_DEFS, type AccommodationKey } from '../lib/accommodations';
import { formatGrade, STATUS_LABEL } from '../lib/gradeStats';
import { getCardTier, type StudentStampDetail } from '../lib/rewardsQueries';
import type { StudentGradeReport } from '../lib/evaluationQueries';
import type { ConnectionStat } from '../lib/connectionQueries';
import { buildPhotoUrl } from '../lib/security';
import { engagementInfo, weeklyBuckets } from '../lib/engagement';
import type { StudentGrade, GroupSessionGrade } from '../pages/Students';
import '../styles/fiche-eleve.css';

/**
 * Fiche d'un élève (Suivi élèves) — fenêtre centrée en deux colonnes.
 *
 * À gauche la synthèse (implication du trimestre, séances, espace élève, oral, tampons),
 * à droite ce qui s'allonge avec l'année (notes du carnet, remarques, implications
 * manuelles, événements). Règle de densité : un bloc vide tient sur une ligne ou
 * disparaît, et aucun « 0 » n'est affiché pour lui-même.
 */

const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Très bien',
};

const EVENT_LABELS: Record<string, string> = {
  participation: 'Implication',
  bavardage: 'Malus',
  absence: 'Absence',
  remarque: 'Remarque',
  sortie: 'Sortie',
};

const EVENT_SUBTYPE_LABELS: Record<string, string> = {
  infirmerie: 'Infirmerie',
  toilettes: 'Toilettes',
  convocation: 'Convocation',
  exclusion: 'Exclusion',
};

const EVENT_DOT: Record<string, string> = {
  participation: 'var(--pos)',
  bavardage: 'var(--warn)',
  absence: 'var(--muted-2)',
  remarque: 'var(--indigo)',
  sortie: 'var(--text)',
};

function eventLabel(type: string, subtype: string | null): string {
  const label = EVENT_LABELS[type] || type;
  return subtype && EVENT_SUBTYPE_LABELS[subtype] ? `${label} (${EVENT_SUBTYPE_LABELS[subtype]})` : label;
}

interface SessionBar {
  key: string;
  date: string;
  participation: number;
  malus: number;
  absent: boolean;
}

/** Une colonne par séance où l'élève a un événement : implications, malus, absence. */
function sessionBars(events: StudentGrade['events'], max = 12): SessionBar[] {
  const bySession = new Map<string, SessionBar>();
  for (const e of events) {
    if (!e.session_id) continue;
    let bar = bySession.get(e.session_id);
    if (!bar) {
      bar = { key: e.session_id, date: e.session_date || e.timestamp, participation: 0, malus: 0, absent: false };
      bySession.set(e.session_id, bar);
    }
    if (e.type === 'participation') bar.participation++;
    else if (e.type === 'bavardage') bar.malus++;
    else if (e.type === 'absence') bar.absent = true;
  }
  return [...bySession.values()]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-max);
}

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const slashDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** Couleur d'une note sur 20 (mêmes seuils que le carnet : 70 % et 50 %). */
const gradeTone = (grade: number) =>
  grade >= 14 ? 'var(--pos)' : grade >= 10 ? 'var(--warn)' : 'var(--neg)';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Position de l'élève (point) par rapport à la moyenne de classe (trait), sur une échelle 0-20. */
function GapTrack({ grade, mean }: { grade: number | null; mean: number | null }) {
  if (mean === null) return null;
  const at = (v: number) => `${Math.max(0, Math.min(100, (v / 20) * 100))}%`;
  return (
    <span className="rf-fiche__track" aria-hidden="true">
      <span className="rf-fiche__track-tick" style={{ left: at(mean) }} />
      {grade !== null && (
        <span className="rf-fiche__track-dot" style={{ left: at(grade), background: gradeTone(grade) }} />
      )}
    </span>
  );
}

interface EquationCell {
  value: string;
  label: string;
  color?: string;
  title?: string;
}

interface Props {
  sg: StudentGrade;
  classes: { id: string; name: string }[];
  trimester: number;
  onClose: () => void;
  /** Élève précédent / suivant dans la liste affichée ; `null` en bout de liste. */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onChangeClass: (classId: string) => void;
  onToggleGender: () => void;
  onToggleWitness: () => void;
  onToggleAccommodation: (key: AccommodationKey) => void;
  connection: ConnectionStat | undefined;
  connectionTimestamps: string[];
  groupGrades: GroupSessionGrade[];
  groupGradesLoading: boolean;
  gradeReport: StudentGradeReport | null;
  gradeReportLoading: boolean;
  stampDetail: StudentStampDetail | null;
  stampDetailLoading: boolean;
  onAddManual: () => void;
  onDeleteManual: (id: string) => void;
}

export function StudentDetailModal({
  sg, classes, trimester, onClose, onPrev, onNext,
  onChangeClass, onToggleGender, onToggleWitness, onToggleAccommodation,
  connection, connectionTimestamps,
  groupGrades, groupGradesLoading, gradeReport, gradeReportLoading,
  stampDetail, stampDetailLoading, onAddManual, onDeleteManual,
}: Props) {
  const { student } = sg;
  const tone = classTone(student.class_name);

  // ---- En-tête : ce qui se règle rarement passe dans le menu « Profil » ----
  const profileItems: MoreMenuItem[] = [
    {
      group: 'Genre',
      label: student.gender === 'F' ? 'Fille · passer à garçon' : 'Garçon · passer à fille',
      onClick: onToggleGender,
    },
    {
      group: 'Espace élève',
      label: student.is_witness ? 'Retirer le statut de témoin' : 'Désigner comme élève témoin',
      title: "Élève témoin : voit tous les onglets, exclu des classements et des métriques de connexion. Son code sert de code admin pour prévisualiser l'espace élève.",
      onClick: onToggleWitness,
    },
    ...ACCOMMODATION_DEFS.map((def) => ({
      group: 'Dispositifs',
      label: student[def.key] ? `Retirer le ${def.label}` : `Indiquer un ${def.label}`,
      title: `${def.title} (aucun détail n'est enregistré)`,
      onClick: () => onToggleAccommodation(def.key),
    })),
  ];

  // ---- Implication : la note du trimestre et ce qui la compose ----
  const malusCounts = sg.malusPenalty && sg.malus > 0;
  const implicationTitle = `${sg.participations} en séance + ${sg.manualParticipations} manuelle${sg.manualParticipations > 1 ? 's' : ''}`;
  const equation: EquationCell[] = [];
  if (sg.baseGrade !== null) {
    equation.push({ value: String(sg.baseGrade), label: 'Base', title: 'Mode note de base' });
    if (sg.totalParticipations > 0) {
      equation.push({ value: `+${sg.totalParticipations}`, label: 'Implications', color: 'var(--pos)', title: implicationTitle });
    }
    if (malusCounts) equation.push({ value: `−${sg.malus}`, label: 'Malus', color: 'var(--warn)' });
  } else {
    equation.push({
      value: String(sg.totalParticipations),
      label: 'Implications',
      color: sg.totalParticipations > 0 ? 'var(--pos)' : undefined,
      title: implicationTitle,
    });
    if (malusCounts) equation.push({ value: `−${sg.malus}`, label: 'Malus', color: 'var(--warn)' });
    const perAbsence = sg.totalSessionsExpected > 0 ? sg.targetParticipations / sg.totalSessionsExpected : 0;
    equation.push({
      value: `/ ${formatGrade(sg.adjustedTarget)}`,
      label: 'Objectif',
      title: sg.absences > 0
        ? `Objectif de base ${sg.targetParticipations} − (${sg.absences} abs × ${perAbsence.toFixed(2)})`
        : `Objectif de base ${sg.targetParticipations}`,
    });
  }
  const sideCells: EquationCell[] = [];
  if (sg.absences > 0) sideCells.push({ value: String(sg.absences), label: sg.absences > 1 ? 'Absences' : 'Absence', color: 'var(--neg)' });
  if (sg.malus > 0 && !sg.malusPenalty) {
    sideCells.push({ value: String(sg.malus), label: 'Malus', color: 'var(--warn)', title: 'Sans effet sur la note dans cette classe' });
  }

  // ---- Séances ----
  const bars = useMemo(() => sessionBars(sg.events), [sg.events]);
  const hasBars = bars.some((b) => b.participation > 0 || b.malus > 0 || b.absent);
  const maxParticipation = Math.max(1, ...bars.map((b) => b.participation));

  // ---- Espace élève ----
  const engagement = engagementInfo(connection?.last ?? null);
  const connectionCount = connection?.count ?? 0;
  const buckets = weeklyBuckets(connectionTimestamps);
  const maxBucket = Math.max(1, ...buckets);

  // ---- Notes : le carnet, plus les séances de groupe qui n'y sont pas ----
  const lines = gradeReport?.lines ?? [];
  const groupBySession = new Map(groupGrades.map((g) => [g.session_id, g]));
  const linkedSessions = new Set(lines.map((l) => l.assessment.group_session_id).filter((id): id is string => !!id));
  const orphanGroups = groupGrades.filter((g) => !linkedSessions.has(g.session_id));
  const notesLoading = gradeReportLoading || groupGradesLoading;
  const notesCount = lines.length + orphanGroups.length;
  const severalPeriods = new Set(lines.map((l) => l.assessment.period)).size > 1;
  const periodAverages = [1, 2, 3]
    .map((p) => ({ p, v: gradeReport?.averageByPeriod[p] ?? null }))
    .filter((x): x is { p: number; v: number } => x.v !== null);

  const remarks = sg.events.filter((e) => e.type === 'remarque');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const archivedByYear = Object.entries(
    sg.archivedGrades.reduce((acc, ag) => {
      (acc[ag.school_year] ||= []).push(ag);
      return acc;
    }, {} as Record<string, StudentGrade['archivedGrades']>),
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const tier = stampDetail ? getCardTier(stampDetail.card_number) : null;

  return (
    <div className="rf-fiche" role="dialog" aria-modal="true" aria-label={`Fiche de ${student.pseudo}`}>
      <header className="rf-fiche__head">
        <div className="rf-fiche__id">
          <h3 className="rf-fiche__name">{student.pseudo}</h3>
          <select
            value={student.class_id || ''}
            onChange={(e) => onChangeClass(e.target.value)}
            className="rf-fiche__class"
            style={{ background: tone.soft, color: tone.ink }}
            title="Changer de classe"
            aria-label="Classe de l'élève"
          >
            {!student.class_id && <option value="">Sans classe</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {student.student_code && (
            <span className="rf-fiche__code" title="Code de connexion à l'espace élève">{student.student_code}</span>
          )}
          {ACCOMMODATION_DEFS.filter((def) => student[def.key]).map((def) => (
            <span key={def.key} className="rf-fiche__tag" title={def.title}>{def.label}</span>
          ))}
          {student.is_witness && (
            <span className="rf-fiche__tag rf-fiche__tag--warn" title="Élève témoin : exclu des classements et des métriques de connexion">
              Témoin
            </span>
          )}
        </div>
        <MoreMenu items={profileItems} label="Profil" title="Genre, élève témoin, dispositifs" />
        <div className="rf-fiche__nav">
          <button type="button" className="rf-fiche__iconbtn" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="Élève précédent" title="Élève précédent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="rf-fiche__iconbtn" onClick={onNext ?? undefined} disabled={!onNext} aria-label="Élève suivant" title="Élève suivant">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <button type="button" className="rf-fiche__iconbtn rf-fiche__iconbtn--ghost" onClick={onClose} aria-label="Fermer" title="Fermer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div className="rf-fiche__body">
        {/* ============ Colonne de synthèse ============ */}
        <aside className="rf-fiche__aside">
          <section className="rf-fiche__block">
            <div>
              <div className="rf-fiche__label">Implication · Trimestre {trimester}</div>
              <div className="rf-fiche__grade">
                <span className="rf-fiche__grade-value">{formatGrade(sg.grade)}</span>
                <span className="rf-fiche__grade-max">/20</span>
                {sg.grade === 20 && <span className="rf-fiche__grade-note">plafonnée à 20</span>}
                {sg.grade === 0 && <span className="rf-fiche__grade-note">minimum</span>}
              </div>
              {sg.bonus > 0 && (
                <div className="rf-fiche__bonus">+{formatGrade(sg.bonus)} points bonus à redistribuer</div>
              )}
            </div>
            <div className="rf-fiche__equation">
              {equation.map((cell) => (
                <div key={cell.label} className="rf-fiche__cell" title={cell.title}>
                  <span className="rf-fiche__cell-value" style={cell.color ? { color: cell.color } : undefined}>{cell.value}</span>
                  <span className="rf-fiche__cell-label">{cell.label}</span>
                </div>
              ))}
              {sideCells.length > 0 && <span className="rf-fiche__equation-sep" aria-hidden="true" />}
              {sideCells.map((cell) => (
                <div key={`side-${cell.label}`} className="rf-fiche__cell" title={cell.title}>
                  <span className="rf-fiche__cell-value" style={cell.color ? { color: cell.color } : undefined}>{cell.value}</span>
                  <span className="rf-fiche__cell-label">{cell.label}</span>
                </div>
              ))}
            </div>
          </section>

          {hasBars && (
            <section className="rf-fiche__block">
              <div className="rf-fiche__blockhead">
                <h4 className="rf-fiche__title">Par séance</h4>
                <div className="rf-fiche__legend">
                  <span><i style={{ background: 'var(--pos)' }} />implication</span>
                  <span><i style={{ background: 'var(--warn)' }} />malus</span>
                  <span><i className="rf-fiche__hatch" />absence</span>
                </div>
              </div>
              <div className="rf-fiche__bars">
                {bars.map((b) => {
                  const parts: string[] = [];
                  if (b.absent) parts.push('absent');
                  if (b.participation > 0) parts.push(plural(b.participation, 'implication'));
                  if (b.malus > 0) parts.push(`${b.malus} malus`);
                  return (
                    <div key={b.key} className="rf-fiche__bar" title={`${dayMonth(b.date)} : ${parts.join(', ') || 'rien à signaler'}`}>
                      <div className="rf-fiche__bar-area">
                        {b.absent ? (
                          <span className="rf-fiche__bar-fill rf-fiche__hatch" style={{ height: '100%' }} />
                        ) : b.participation > 0 ? (
                          <span
                            className="rf-fiche__bar-fill"
                            style={{ height: `${Math.max(14, Math.round((b.participation / maxParticipation) * 100))}%`, background: 'var(--pos)' }}
                          />
                        ) : null}
                      </div>
                      <span className="rf-fiche__bar-malus" style={b.malus > 0 ? { background: 'var(--warn)' } : undefined} />
                      <span className="rf-fiche__bar-date">{slashDate(b.date)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rf-fiche__block">
            <div className="rf-fiche__blockhead">
              <h4 className="rf-fiche__title">Espace élève</h4>
              {student.is_witness ? (
                <span className="rf-fiche__meta">connexions non comptées (témoin)</span>
              ) : connectionCount === 0 ? (
                <span className="rf-fiche__meta">jamais connecté</span>
              ) : (
                <span className="rf-fiche__meta">
                  <i className="rf-fiche__dot" style={{ background: engagement.color }} />
                  {plural(connectionCount, 'connexion')} · {engagement.label.toLowerCase()}
                </span>
              )}
            </div>
            {!student.is_witness && connectionCount > 0 && (
              <div className="rf-fiche__weeks" title="Connexions par semaine, 10 dernières semaines">
                {buckets.map((b, i) => (
                  <span
                    key={i}
                    title={plural(b, 'connexion')}
                    style={{
                      height: b > 0 ? `${Math.max(18, (b / maxBucket) * 100)}%` : 2,
                      background: b > 0 ? 'var(--indigo)' : 'var(--border-strong)',
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rf-fiche__block">
            <div className="rf-fiche__blockhead">
              <h4 className="rf-fiche__title">Oral</h4>
              {sg.oralEvaluation ? (
                <span className="rf-fiche__meta" title={`Évalué le ${fullDate(sg.oralEvaluation.evaluated_at)}`}>
                  <strong>{sg.oralEvaluation.grade}/5</strong>
                  {ORAL_GRADE_LABELS[sg.oralEvaluation.grade] ? ` · ${ORAL_GRADE_LABELS[sg.oralEvaluation.grade]}` : ''}
                  {' · '}{dayMonth(sg.oralEvaluation.evaluated_at)}
                </span>
              ) : (
                <span className="rf-fiche__meta">pas encore évalué ce trimestre</span>
              )}
            </div>
          </section>

          <section className="rf-fiche__block">
            <div className="rf-fiche__blockhead">
              <h4 className="rf-fiche__title">Carte à tampons</h4>
              {stampDetailLoading ? (
                <span className="rf-fiche__meta">chargement…</span>
              ) : !stampDetail || !tier ? (
                <span className="rf-fiche__meta">pas de carte active</span>
              ) : (
                <span className="rf-fiche__meta">
                  n°{stampDetail.card_number} · {tier.name} · <strong>{stampDetail.stamp_count}/10</strong>
                </span>
              )}
            </div>
            {stampDetail && (
              <>
                <div className="rf-fiche__stamps">
                  {Array.from({ length: 10 }, (_, i) => {
                    const stamp = stampDetail.stamps.find((s) => s.slot_number === i + 1);
                    return stamp ? (
                      <span
                        key={i}
                        className="rf-fiche__stamp"
                        style={{ background: stamp.category_color }}
                        title={`${stamp.category_label} — ${new Date(stamp.awarded_at).toLocaleDateString('fr-FR')}`}
                      >
                        <CategoryIcon icon={stamp.category_icon} iconRef={stamp.category_icon_ref} size={14} color="#fff" title={stamp.category_label} />
                      </span>
                    ) : (
                      <span key={i} className="rf-fiche__stamp rf-fiche__stamp--empty" />
                    );
                  })}
                </div>
                {stampDetail.completed_cards.length > 0 && (
                  <div className="rf-fiche__rows">
                    {stampDetail.completed_cards.map((c) => (
                      <div key={c.card_number} className="rf-fiche__row">
                        <span className="rf-fiche__row-main">Carte n°{c.card_number} · {getCardTier(c.card_number).name}</span>
                        <span className="rf-fiche__row-meta">
                          {c.bonus_label ? `${c.bonus_label} · ${c.bonus_used ? 'utilisé' : 'à utiliser'}` : 'sans bonus'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </aside>

        {/* ============ Colonne de détail ============ */}
        <div className="rf-fiche__main">
          <section>
            <div className="rf-fiche__sectionhead">
              <h4 className="rf-fiche__title">
                Notes{notesCount > 0 && <span className="rf-fiche__count">{notesCount}</span>}
              </h4>
              {periodAverages.length === 1 && (
                <div className="rf-fiche__avg">
                  <span>Moyenne T{periodAverages[0].p}</span>
                  <strong style={{ color: periodAverages[0].v < 10 ? 'var(--neg)' : undefined }}>{formatGrade(periodAverages[0].v)}</strong>
                  <span>/20</span>
                </div>
              )}
              {periodAverages.length > 1 && (
                <div className="rf-fiche__avg">
                  {periodAverages.map(({ p, v }) => (
                    <span key={p}>T{p} <b>{formatGrade(v)}</b></span>
                  ))}
                  <span>Année</span>
                  <strong style={{ color: (gradeReport?.yearAverage ?? 20) < 10 ? 'var(--neg)' : undefined }}>
                    {formatGrade(gradeReport?.yearAverage ?? null)}
                  </strong>
                  <span>/20</span>
                </div>
              )}
            </div>

            {notesLoading ? (
              <p className="rf-fiche__empty">Chargement…</p>
            ) : notesCount === 0 ? (
              <p className="rf-fiche__empty">Aucune évaluation cette année.</p>
            ) : (
              <div className="rf-fiche__notes">
                <div className="rf-fiche__note rf-fiche__note--head">
                  <span>Évaluation</span>
                  <span>Date</span>
                  <span className="is-opt is-num">Coef</span>
                  <span className="is-opt is-num">Moy. classe</span>
                  <span className="is-opt">Écart à la classe</span>
                  <span className="is-num">Note</span>
                </div>
                {lines.map((line) => {
                  const { assessment: a, grade, classMean, gap, className, fromOtherClass } = line;
                  const status = grade?.status ?? 'noted';
                  const value = status === 'noted' && grade?.grade != null ? grade.grade : null;
                  const bareme = Number(a.bareme_total ?? 20);
                  const group = a.group_session_id ? groupBySession.get(a.group_session_id) : undefined;
                  const sub: string[] = [];
                  if (severalPeriods && a.period) sub.push(`T${a.period}`);
                  if (group) sub.push(/^groupe/i.test(group.group_name) ? group.group_name : `Groupe ${group.group_name}`);
                  if (grade?.grade_raw != null && bareme !== 20) sub.push(`${formatGrade(Number(grade.grade_raw))}/${bareme}`);
                  if (!a.counts_in_average) sub.push('hors moyenne');
                  else if (a.only_if_raises_average) sub.push('si elle monte la moyenne');
                  return (
                    <div key={a.id} className="rf-fiche__note">
                      <span className="rf-fiche__note-name">
                        <span>
                          {a.name}
                          {fromOtherClass && (
                            <span className="rf-fiche__tag rf-fiche__tag--warn rf-fiche__tag--inline" title="Évaluation passée dans une autre classe : l’élève a changé de classe depuis.">
                              {className}
                            </span>
                          )}
                        </span>
                        {sub.length > 0 && <small>{sub.join(' · ')}</small>}
                        {grade?.comment && <small className="rf-fiche__note-comment">{grade.comment}</small>}
                      </span>
                      <span className="rf-fiche__note-date" title={a.date ? fullDate(a.date) : undefined}>{a.date ? dayMonth(a.date) : ''}</span>
                      <span className="is-opt is-num">{Number(a.coefficient)}</span>
                      <span className="is-opt is-num">{classMean !== null ? formatGrade(classMean) : ''}</span>
                      <span className="is-opt rf-fiche__note-gap">
                        <GapTrack grade={value} mean={classMean} />
                        {gap !== null && (
                          <span style={{ color: gap >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                            {gap >= 0 ? '+' : '−'}{formatGrade(Math.abs(gap))}
                          </span>
                        )}
                      </span>
                      {value !== null ? (
                        <span className="is-num rf-fiche__note-value" style={{ color: gradeTone(value) }}>{formatGrade(value)}</span>
                      ) : (
                        <span className="is-num rf-fiche__note-status">{status === 'noted' ? 'non corrigée' : STATUS_LABEL[status]}</span>
                      )}
                    </div>
                  );
                })}
                {orphanGroups.map((g) => {
                  const ratio = g.max_points > 0 ? g.score / g.max_points : 0;
                  return (
                    <div key={`groupe-${g.session_id}`} className="rf-fiche__note">
                      <span className="rf-fiche__note-name">
                        <span>{g.session_name}</span>
                        <small>
                          {/^groupe/i.test(g.group_name) ? g.group_name : `Groupe ${g.group_name}`} · séance de groupe hors carnet
                        </small>
                      </span>
                      <span className="rf-fiche__note-date" title={fullDate(g.created_at)}>{dayMonth(g.created_at)}</span>
                      <span className="is-opt" />
                      <span className="is-opt" />
                      <span className="is-opt" />
                      <span className="is-num rf-fiche__note-value" style={{ color: gradeTone(ratio * 20) }}>
                        {formatGrade(g.score)}<small>/{g.max_points}</small>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="rf-fiche__split">
            <div className="rf-fiche__stack">
              {remarks.length > 0 && (
                <section>
                  <div className="rf-fiche__sectionhead">
                    <h4 className="rf-fiche__title">Remarques<span className="rf-fiche__count">{remarks.length}</span></h4>
                  </div>
                  <div className="rf-fiche__rows">
                    {remarks.map((remark) => {
                      const photoUrl = remark.photo_path ? buildPhotoUrl(remark.photo_path, supabaseUrl) : null;
                      return (
                        <div key={remark.id} className="rf-fiche__row rf-fiche__row--top">
                          <span className="rf-fiche__row-date" title={fullDate(remark.timestamp)}>{dayMonth(remark.timestamp)}</span>
                          <span className="rf-fiche__row-main">
                            {remark.note}
                            {photoUrl && (
                              <img
                                src={photoUrl}
                                alt="Photo jointe à la remarque"
                                className="rf-fiche__photo"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <div className="rf-fiche__sectionhead">
                  <h4 className="rf-fiche__title">
                    Implications manuelles
                    {sg.manualParticipationsList.length > 0 && <span className="rf-fiche__count">{sg.manualParticipations}</span>}
                  </h4>
                  <button type="button" className="rf-fiche__link" onClick={onAddManual}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    Ajouter
                  </button>
                </div>
                {sg.manualParticipationsList.length > 0 && (
                  <div className="rf-fiche__rows">
                    {sg.manualParticipationsList.map((mp) => (
                      <div key={mp.id} className="rf-fiche__row">
                        <span className="rf-fiche__row-date" title={fullDate(mp.created_at)}>{dayMonth(mp.created_at)}</span>
                        <span className="rf-fiche__row-main">{mp.reason || 'Implication manuelle'}</span>
                        <strong style={{ color: 'var(--pos)' }}>+{mp.count}</strong>
                        <button
                          type="button"
                          className="rf-fiche__iconbtn rf-fiche__iconbtn--ghost rf-fiche__iconbtn--sm"
                          onClick={() => onDeleteManual(mp.id)}
                          aria-label="Supprimer cette implication"
                          title="Supprimer"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {archivedByYear.length > 0 && (
                <section>
                  <div className="rf-fiche__sectionhead">
                    <h4 className="rf-fiche__title">Années précédentes</h4>
                  </div>
                  <div className="rf-fiche__rows">
                    {archivedByYear.map(([year, grades]) => {
                      const sorted = [...grades].sort((a, b) => a.trimester - b.trimester);
                      const archivedClass = sorted.find((g) => g.class_name)?.class_name;
                      const avg = sorted.reduce((s, g) => s + g.grade, 0) / sorted.length;
                      return (
                        <div key={year} className="rf-fiche__row">
                          <span className="rf-fiche__row-main">
                            {year}{archivedClass ? ` · ${archivedClass}` : ''}
                            <small>
                              {sorted.map((ag) => `T${ag.trimester} ${formatGrade(ag.grade)}${ag.bonus > 0 ? ` (+${formatGrade(ag.bonus)})` : ''}`).join(' · ')}
                            </small>
                          </span>
                          <span className="rf-fiche__row-meta">moy. <strong>{formatGrade(avg)}</strong></span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {sg.events.length > 0 && (
              <section className="rf-fiche__col">
                <div className="rf-fiche__sectionhead">
                  <h4 className="rf-fiche__title">Événements<span className="rf-fiche__count">{sg.events.length}</span></h4>
                </div>
                <div className="rf-fiche__rows rf-fiche__rows--scroll">
                  {sg.events.map((event) => (
                    <div key={event.id} className="rf-fiche__row">
                      <span className="rf-fiche__row-date rf-fiche__row-date--wide">{dayTime(event.timestamp)}</span>
                      <i className="rf-fiche__dot" style={{ background: EVENT_DOT[event.type] ?? 'var(--muted-2)' }} />
                      <span className="rf-fiche__row-main rf-fiche__row-main--line">
                        {eventLabel(event.type, event.subtype)}
                        {event.note && <span className="rf-fiche__row-note" title={event.note}>{event.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
