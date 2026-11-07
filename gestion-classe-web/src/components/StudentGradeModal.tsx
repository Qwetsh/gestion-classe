import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAssessmentCopies } from '../hooks/useAssessmentCopies';
import { AiRunPanel, Badge } from './AiRunPanel';
import { AddCopyDialog } from './AddCopyDialog';
import { CopyTranscriptView } from './CopyTranscriptView';
import { GradeDetailsView } from './GradeDetailsView';
import { KindIcon } from './KindIcon';
import { downloadCorrectionsPdf, exportableSheets } from './ExportCorrectionsDialog';
import { hasCopies, publicationState, PUBLICATION_LABEL } from '../lib/assessmentGroups';
import { COST_HINT, NO_KIT_MESSAGE, correctionMode, isApiGrade, isRunActive } from '../lib/aiCorrection';
import { alignTranscript } from '../lib/copyTranscript';
import { parseGradeDetails } from '../lib/gradeDetails';
import { describeGradeValue, formatVersionDate, gradeSource, SOURCE_LABEL } from '../lib/gradeHistory';
import { isGroupGradeAdjusted, parseGroupDetails } from '../lib/groupDetails';
import { fetchActivityForAssessment, fetchStudentWork, WORK_STATUS_LABEL, type ActivityRow, type WorkRow } from '../lib/productionsQueries';
import { parseGradeCell, STATUS_LABEL, toTwenty, type GradeStatus } from '../lib/gradeStats';
import {
  ASSESSMENT_KIND_LABEL,
  fetchGradeRevisions,
  saveGrade,
  type AssessmentRow,
  type GradeRevisionRow,
  type GradeRow,
} from '../lib/evaluationQueries';

/**
 * Modale élève × évaluation (hub Évaluations, phase 2 — PLAN_hub_evaluations.md). Tout ce qu'on
 * sait d'une note, par sections qui n'apparaissent que si la donnée existe : en-tête et note
 * modifiable, copie scannée (pages, zoom), transcription, correction (détail, radar, points à
 * arbitrer), historique des versions. ← → : élève précédent / suivant sans fermer ; ↑ ↓ : pages.
 * Données et gestes partagés avec la visionneuse de la fiche (hooks/useAssessmentCopies.ts).
 */

const STATUS_KEY: Partial<Record<GradeStatus, string>> = { absent: 'a', dispense: 'd', non_rendu: 'n', non_rendu_zero: 'z' };

/** Ce qu'on retape pour une note : la note brute, ou la lettre du statut (comme dans le carnet). */
function editableText(g: GradeRow | null): string {
  if (!g) return '';
  if (g.status !== 'noted') return STATUS_KEY[g.status as GradeStatus] ?? '';
  return g.grade_raw != null ? String(g.grade_raw).replace('.', ',') : '';
}

export function StudentGradeModal({ assessment, studentId, onClose, onError }: {
  assessment: AssessmentRow;
  studentId: string;
  /** `changed` : une note, une validation ou une copie a bougé, le carnet doit se recharger. */
  onClose: (changed: boolean) => void;
  onError: (message: string) => void;
}) {
  const { user } = useAuth();
  const changedRef = useRef(false);
  const markChanged = useCallback(() => { changedRef.current = true; }, []);
  const close = useCallback(() => onClose(changedRef.current), [onClose]);

  const { rows, urls, loading, hasKit, aiRuns, startingId, knownVersions, anyScanned, load, validate, correct, replaceGrade } =
    useAssessmentCopies(assessment, { onError, onChanged: markChanged });

  const [currentId, setCurrentId] = useState(studentId);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [leftTab, setLeftTab] = useState<'copie' | 'transcription'>('copie');
  /** Note en cours de frappe ; null = on affiche la note enregistrée. */
  const [noteText, setNoteText] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const index = rows.findIndex((r) => r.student.id === currentId);
  const row = index >= 0 ? rows[index] : null;
  const grade = row?.grade ?? null;
  const bareme = Number(assessment.bareme_total ?? 20) || 20;
  const withCopies = hasCopies(assessment);

  const move = useCallback((delta: 1 | -1) => {
    if (rows.length === 0) return;
    const i = index < 0 ? 0 : (index + delta + rows.length) % rows.length;
    setCurrentId(rows[i].student.id);
    setPageIndex(0);
    setZoom(false);
    setLeftTab('copie');
    setNoteText(null);
    setNoteError(null);
    setOpenVersion(null);
  }, [rows, index]);

  // ---- Historique (migration 061) : rechargé quand la note change ----
  const [history, setHistory] = useState<{ key: string; list: GradeRevisionRow[] | null } | null>(null);
  const historyKey = grade ? `${grade.id}|${grade.updated_at ?? ''}` : '';
  useEffect(() => {
    if (!grade?.id) return;
    let alive = true;
    fetchGradeRevisions(grade.id)
      .then((list) => { if (alive) setHistory({ key: historyKey, list }); })
      .catch(() => { if (alive) setHistory({ key: historyKey, list: null }); });
    return () => { alive = false; };
  }, [grade?.id, historyKey]);
  const revisions = history && history.key === historyKey ? history.list : undefined;

  // ---- Production numérique (phase 6) : l'activité liée à l'éval, puis la fiche de l'élève ----
  const [linkedActivity, setLinkedActivity] = useState<ActivityRow | null>(null);
  useEffect(() => {
    let alive = true;
    fetchActivityForAssessment(assessment.id).then((a) => { if (alive) setLinkedActivity(a); }).catch(() => {});
    return () => { alive = false; };
  }, [assessment.id]);
  const [production, setProduction] = useState<{ key: string; work: WorkRow | null } | null>(null);
  const productionKey = linkedActivity ? `${linkedActivity.id}|${currentId}` : '';
  useEffect(() => {
    if (!linkedActivity) return;
    let alive = true;
    fetchStudentWork(linkedActivity.id, currentId)
      .then((work) => { if (alive) setProduction({ key: `${linkedActivity.id}|${currentId}`, work }); })
      .catch(() => { if (alive) setProduction({ key: `${linkedActivity.id}|${currentId}`, work: null }); });
    return () => { alive = false; };
  }, [linkedActivity, currentId]);
  const work = production && production.key === productionKey ? production.work : undefined;

  // ---- Clavier : ← → élèves, ↑ ↓ pages, Échap ferme (sauf fenêtre ouverte par-dessus) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (adding) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowDown' && row) setPageIndex((p) => Math.min(p + 1, Math.max(0, row.pages.length - 1)));
      else if (e.key === 'ArrowUp') setPageIndex((p) => Math.max(p - 1, 0));
      else if (e.key === 'Escape') close();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, move, row, close]);

  const details = useMemo(() => parseGradeDetails(grade?.details), [grade?.details]);
  /** TP de groupe (migration 063) : critères du groupe et note du groupe. */
  const groupInfo = useMemo(() => parseGroupDetails(grade?.details), [grade?.details]);
  const groupAdjusted = isGroupGradeAdjusted(grade, groupInfo);
  const transcriptBlocks = useMemo(
    () => (row?.transcript ? alignTranscript(row.transcript, details?.questions ?? []) : null),
    [row?.transcript, details],
  );

  const saveNote = async (text: string | null = noteText) => {
    if (!user || !row || text === null) return;
    const parsed = parseGradeCell(text, bareme);
    if (!parsed) { setNoteError(`Note entre 0 et ${String(bareme).replace('.', ',')}, ou a (absent), d (dispensé), n (non rendu), z (non rendu, 0).`); return; }
    setSavingNote(true);
    setNoteError(null);
    try {
      const saved = await saveGrade({
        userId: user.id,
        assessmentId: assessment.id,
        studentId: row.student.id,
        raw: parsed.raw,
        grade: parsed.status === 'noted' ? toTwenty(parsed.raw, bareme) : null,
        status: parsed.status,
      });
      replaceGrade(saved);
      markChanged();
      setNoteText(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSavingNote(false);
    }
  };

  const page = row?.pages[pageIndex] ?? null;
  const hasPages = !!row && row.pages.length > 0;
  const showLeft = withCopies && (hasPages || !!transcriptBlocks);
  const mode = row ? correctionMode({ pages: row.pages.length, grade }) : null;
  const busy = !!row && (startingId === row.student.id || isRunActive(aiRuns[row.student.id]));
  const isDraft = !!grade && grade.grade != null && !grade.is_validated;
  const twenty = grade && grade.status === 'noted' ? (grade.grade ?? toTwenty(grade.grade_raw, bareme)) : null;

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 10px', overflowY: 'auto' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={row ? `${row.student.pseudo} — ${assessment.name}` : assessment.name}
        onClick={(e) => e.stopPropagation()}
        className="gc-sgm"
        style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow-2)', width: 'min(1320px, 100%)', padding: 16, boxSizing: 'border-box' }}
      >
        {/* ---- En-tête : élève, éval, navigation ---- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => move(-1)} style={btn} aria-label="Élève précédent (←)" title="Élève précédent (←)">←</button>
            <button onClick={() => move(1)} style={btn} aria-label="Élève suivant (→)" title="Élève suivant (→)">→</button>
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {row?.student.pseudo ?? '…'}
              {rows.length > 0 && index >= 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>{index + 1}/{rows.length}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <KindIcon kind={assessment.kind} />
              <span>{assessment.name} · {ASSESSMENT_KIND_LABEL[assessment.kind]} · {assessment.classes?.name ?? ''} · /{String(bareme).replace('.', ',')}</span>
              <Badge tone={publicationState(assessment) === 'all' ? 'ok' : publicationState(assessment) === 'notes' ? 'warn' : 'neutral'}>{PUBLICATION_LABEL[publicationState(assessment)]}</Badge>
            </div>
          </div>
          <Link to={`/evaluations/${assessment.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--indigo)' }}>Fiche de l’éval ↗</Link>
          <button onClick={close} style={btn}>Fermer</button>
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
        ) : !row ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Cet élève n’est pas dans la liste de l’éval.</div>
        ) : (
          <>
            {/* ---- Note, statut, actions ---- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, background: 'var(--surface-3)', marginBottom: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Note
                <input
                  value={noteText ?? editableText(grade)}
                  onChange={(e) => { setNoteText(e.target.value); setNoteError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveNote(); } }}
                  inputMode="decimal"
                  aria-label={`Note de ${row.student.pseudo} sur ${bareme}`}
                  title="Note sur le barème, ou a (absent), d (dispensé), n (non rendu), z (non rendu, 0). Entrée pour enregistrer : une note modifiée ici est validée."
                  style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: `1px solid ${noteError ? 'var(--neg)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 700, textAlign: 'center', fontFamily: 'inherit' }}
                />
                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>/{String(bareme).replace('.', ',')}</span>
              </label>
              {noteText !== null && noteText !== editableText(grade) && (
                <button onClick={() => { void saveNote(); }} disabled={savingNote} style={btnPrimary}>{savingNote ? 'Enregistrement…' : 'Enregistrer'}</button>
              )}
              {twenty != null && bareme !== 20 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>= {String(Math.round(twenty * 100) / 100).replace('.', ',')}/20</span>}
              {grade && grade.status !== 'noted' && <Badge tone="neg">{STATUS_LABEL[grade.status as GradeStatus]}</Badge>}
              {grade && grade.grade != null && (isDraft
                ? <Badge tone="warn">Brouillon : invisible pour l’élève</Badge>
                : <Badge tone="ok">Validée</Badge>)}
              {grade?.subject_version && <Badge>sujet {grade.subject_version}</Badge>}
              {grade?.is_adapted && <Badge tone="info">Adaptée</Badge>}
              <span style={{ flex: 1 }} />
              {isDraft && (
                <button onClick={() => { void validate(grade!); }} style={btnPrimary}>Valider la correction</button>
              )}
              {withCopies && mode && (
                <button
                  onClick={() => { void correct(row); }}
                  disabled={!hasKit || busy}
                  title={hasKit ? `Correction par Claude Opus 5.5, en brouillon (${COST_HINT})` : NO_KIT_MESSAGE}
                  style={{ ...btn, opacity: !hasKit || busy ? 0.55 : 1, cursor: !hasKit || busy ? 'default' : 'pointer' }}
                >
                  {busy ? 'Correction en cours…' : mode === 'corriger' ? 'Corriger avec Claude' : 'Recorriger avec Claude'}
                </button>
              )}
              {withCopies && (
                <button onClick={() => setAdding(true)} style={btn} title="Importer des photos ou un PDF, la webcam, ou un QR code pour le téléphone">
                  {hasPages ? 'Remplacer ou ajouter des pages' : 'Ajouter une copie'}
                </button>
              )}
              {details && (
                <button
                  onClick={() => {
                    const sheet = exportableSheets([row]);
                    if (sheet.length) downloadCorrectionsPdf(assessment, sheet, false, row.student.pseudo);
                  }}
                  style={btn}
                  title="Fiche de correction de cet élève, à imprimer"
                >
                  Imprimer (PDF)
                </button>
              )}
            </div>
            {noteError && <div style={{ fontSize: 12, color: 'var(--neg)', margin: '-4px 0 10px' }}>{noteError}</div>}
            {withCopies && !hasKit && mode === 'corriger' && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                {NO_KIT_MESSAGE} : « Corriger avec Claude » s’active quand le kit de l’éval est envoyé (push_grades.py --kit).
              </div>
            )}
            <AiRunPanel run={aiRuns[row.student.id]} apiGrade={isApiGrade(grade?.details)} />

            <div className={`gc-sgm__body${showLeft ? '' : ' is-single'}`}>
              {/* ---- Copie / transcription ---- */}
              {showLeft && (
                <div style={{ minWidth: 0 }}>
                  {hasPages && transcriptBlocks && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {(['copie', 'transcription'] as const).map((t) => (
                        <button key={t} onClick={() => setLeftTab(t)} style={{ ...chip, background: leftTab === t ? 'var(--text)' : 'var(--surface-3)', color: leftTab === t ? 'var(--surface)' : 'var(--text-muted)' }}>
                          {t === 'copie' ? `Copie (${row.pages.length} p.)` : 'Transcription'}
                        </button>
                      ))}
                    </div>
                  )}
                  {hasPages && leftTab === 'copie' ? (
                    <>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        {row.pages.map((p, i) => (
                          <button
                            key={p.id}
                            onClick={() => { setPageIndex(i); setZoom(false); }}
                            style={{ padding: 0, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'var(--surface-3)', border: `2px solid ${i === pageIndex ? 'var(--indigo)' : 'var(--border)'}` }}
                            aria-label={`Page ${p.page_order}`}
                          >
                            {urls[p.storage_path]
                              ? <img src={urls[p.storage_path]} alt="" style={{ width: 44, height: 60, objectFit: 'cover', display: 'block' }} />
                              : <div style={{ width: 44, height: 60, display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>p{p.page_order}</div>}
                          </button>
                        ))}
                        {page && urls[page.storage_path] && (
                          <a href={urls[page.storage_path]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--indigo)', alignSelf: 'center', marginLeft: 6 }}>Ouvrir la page ↗</a>
                        )}
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-3)', maxHeight: '70vh', overflow: 'auto', textAlign: 'center' }}>
                        {page && urls[page.storage_path] ? (
                          <img
                            src={urls[page.storage_path]}
                            alt={`${row.student.pseudo}, page ${page.page_order}`}
                            onClick={() => setZoom((z) => !z)}
                            style={{ display: 'block', margin: '0 auto', cursor: zoom ? 'zoom-out' : 'zoom-in', width: zoom ? '180%' : 'auto', maxWidth: zoom ? 'none' : '100%', maxHeight: zoom ? 'none' : '68vh' }}
                          />
                        ) : (
                          <div style={{ padding: 60, color: 'var(--text-dim)', fontSize: 13 }}>Chargement de la page…</div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Clic sur la page : zoom · ↑ ↓ pages · ← → élèves</div>
                    </>
                  ) : transcriptBlocks ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Copie transcrite
                        <span style={{ fontWeight: 500 }}>{hasPages ? '' : assessment.copies_purged_at ? ' · scans supprimés' : ' · pas de scan'}, visible par toi seul</span>
                      </div>
                      <div style={{ maxHeight: '72vh', overflowY: 'auto' }}><CopyTranscriptView blocks={transcriptBlocks} /></div>
                    </>
                  ) : null}
                </div>
              )}

              {/* ---- Correction et historique ---- */}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Des copies ont été scannées pour cette éval, pas celle-ci. Une éval saisie à la main n'en parle pas. */}
                {withCopies && !showLeft && anyScanned && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
                    {row.state === 'absent' ? 'Élève absent : pas de copie.' : 'Pas de copie scannée pour cet élève.'}
                    <div style={{ marginTop: 10 }}><button onClick={() => setAdding(true)} style={btn}>Ajouter une copie</button></div>
                  </div>
                )}
                {linkedActivity && (
                  <section style={panel} aria-label="Production numérique">
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Production · {linkedActivity.title}
                    </div>
                    {work === undefined ? (
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Chargement…</div>
                    ) : work === null ? (
                      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Rien reçu de cet élève.</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                        <Badge tone={work.status === 'validated' ? 'ok' : work.status === 'corrected' ? 'warn' : 'info'}>{WORK_STATUS_LABEL[work.status]}</Badge>
                        {work.total_points != null && <span style={{ fontWeight: 700 }}>{String(work.total_points).replace('.', ',')}/{linkedActivity.bareme_total}</span>}
                        <span style={{ color: 'var(--text-muted)' }}>envoi n°{work.version}{work.group_pseudos.length > 1 ? ` · avec ${work.group_pseudos.filter((p) => p !== row.student.pseudo).join(', ')}` : ''}</span>
                        <Link to={`/evaluations/${assessment.id}?eleve=${currentId}`} onClick={close} style={{ color: 'var(--indigo)', fontWeight: 600, textDecoration: 'none' }}>
                          {work.correction ? 'Revoir sa production ↗' : 'Corriger sa production ↗'}
                        </Link>
                      </div>
                    )}
                  </section>
                )}
                {groupInfo && (
                  <section style={panel} aria-label="Critères du groupe">
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                      {groupInfo.nom || 'Groupe'}
                      {groupInfo.membres.length > 0 && <span style={{ fontWeight: 500 }}> · {groupInfo.membres.join(', ')}</span>}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>
                          <th style={{ padding: '4px 6px', fontWeight: 600 }}>Critère</th>
                          <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupInfo.criteres.map((c, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px' }}>{c.label}</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: c.max > 0 && c.points / c.max >= 0.75 ? 'var(--pos)' : c.max > 0 && c.points / c.max >= 0.5 ? 'var(--warn)' : 'var(--neg)' }}>
                              {String(c.points).replace('.', ',')}/{String(c.max).replace('.', ',')}
                            </td>
                          </tr>
                        ))}
                        {groupInfo.malus > 0 && (
                          <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--neg)' }}>
                            <td style={{ padding: '6px' }}>Malus de conduite</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>−{String(groupInfo.malus).replace('.', ',')}</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px', fontWeight: 700 }}>Note du groupe</td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>{String(groupInfo.total).replace('.', ',')}/{String(groupInfo.bareme).replace('.', ',')}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}>
                      {groupAdjusted ? (
                        <>
                          <Badge tone="warn">Note ajustée pour {row.student.pseudo}</Badge>
                          <span style={{ color: 'var(--text-muted)' }}>elle ne suit plus le groupe</span>
                          <button onClick={() => { void saveNote(String(groupInfo.total)); }} disabled={savingNote} style={btn}>
                            Remettre la note du groupe ({String(groupInfo.total).replace('.', ',')})
                          </button>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {row.student.pseudo} a la note de son groupe. La changer ci-dessus l’ajuste pour lui seul ; les points se modifient dans la fiche de l’éval.
                        </span>
                      )}
                    </div>
                  </section>
                )}
                {(details || grade?.comment) && (
                  <section style={panel}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Correction{details?.version ? ` · sujet ${details.version}` : ''} · {SOURCE_LABEL[gradeSource(grade?.details, grade)]}
                      {isDraft && <span style={{ color: 'var(--warn)', fontWeight: 600 }}> · brouillon</span>}
                    </div>
                    {details ? <GradeDetailsView details={details} /> : <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{grade?.comment}</p>}
                    {details && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
                        Une retouche du détail se fait dans le Correcteur (JSON), puis push_grades.py ; la note seule se change ici.
                      </div>
                    )}
                  </section>
                )}
                {grade && revisions !== null && (
                  <section style={panel} aria-label="Historique des corrections">
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Historique {revisions === undefined ? '…' : `(${revisions.length + 1} version${revisions.length ? 's' : ''})`}
                    </div>
                    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <li style={versionRow}>
                        <strong style={{ minWidth: 92 }}>{formatVersionDate(grade.updated_at) || 'Actuelle'}</strong>
                        <span style={{ flex: 1 }}>{SOURCE_LABEL[gradeSource(grade.details, grade)]} · {describeGradeValue(grade, bareme)}</span>
                        <Badge tone="info">actuelle</Badge>
                      </li>
                      {(revisions ?? []).map((v) => {
                        const vDetails = parseGradeDetails(v.details);
                        const open = openVersion === v.id;
                        return (
                          <li key={v.id} style={{ ...versionRow, flexWrap: 'wrap' }}>
                            <span style={{ minWidth: 92, color: 'var(--text-muted)' }}>{formatVersionDate(v.version_at ?? v.replaced_at)}</span>
                            <span style={{ flex: 1 }}>
                              {SOURCE_LABEL[v.source]} · {describeGradeValue(v, bareme)}
                              {!v.was_validated && v.grade != null && <span style={{ color: 'var(--warn)' }}> · brouillon</span>}
                            </span>
                            {(vDetails || v.comment) && (
                              <button onClick={() => setOpenVersion(open ? null : v.id)} style={{ ...btn, padding: '2px 8px', fontSize: 12 }} aria-expanded={open}>
                                {open ? 'Masquer' : 'Voir'}
                              </button>
                            )}
                            {open && (
                              <div style={{ flexBasis: '100%', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                {vDetails ? <GradeDetailsView details={vDetails} /> : <p style={{ margin: 0, fontSize: 13 }}>{v.comment}</p>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    {revisions && revisions.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                        Chaque correction remplacée (recorrection, renvoi du Correcteur, note retapée) sera gardée ici.
                      </div>
                    )}
                  </section>
                )}
                {!showLeft && !(withCopies && anyScanned) && !details && !groupInfo && !linkedActivity && !grade?.comment && (revisions == null || revisions.length === 0) && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                    {grade ? 'Pas de copie ni de correction détaillée pour cette note.' : 'Pas encore de note : tape-la ci-dessus.'}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {adding && row && (
          <AddCopyDialog
            assessment={assessment}
            student={{ id: row.student.id, pseudo: row.student.pseudo }}
            existingPages={row.pages.length}
            graded={grade?.grade != null}
            subjectVersion={grade?.subject_version ?? null}
            isAdapted={!!grade?.is_adapted}
            knownVersions={knownVersions}
            onError={onError}
            onClose={(changed) => {
              setAdding(false);
              if (changed) { void load(); markChanged(); }
            }}
          />
        )}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  border: 'none', borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
};
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--indigo-ink)', color: '#fff', borderColor: 'var(--indigo-ink)' };
const panel: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface)' };
const versionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)',
  padding: '6px 8px', borderRadius: 8, background: 'var(--surface-3)',
};
