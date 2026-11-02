import { useEffect, useState } from 'react';
import {
  fetchStudentGrades,
  fetchStudentDocUrl,
  type StudentAssessment,
  type StudentDocKind,
} from '../lib/studentGrades';
import { formatGrade, STATUS_LABEL, studentAverage, type GradeStatus } from '../lib/gradeStats';
import { StudentWorkSheet } from './StudentWorkSheet';
import { GradeDetailsView, type DetailsPalette } from './GradeDetailsView';
import { parseGradeDetails } from '../lib/gradeDetails';

/**
 * Onglet « Évals » de l'espace élève : ses notes, le sujet et le corrigé, et pour les activités
 * numériques sa copie corrigée (StudentWorkSheet, plein écran pensé pour le téléphone).
 *
 * L'élève ne voit que ses propres notes — aucune moyenne de classe, aucun classement sur
 * les évaluations. Les moyennes sont calculées ici avec `gradeStats`, le même module que
 * le carnet de l'enseignant : la règle « un absent ne compte pas » n'existe qu'à un seul
 * endroit, donc l'élève et le prof lisent forcément le même chiffre.
 */

const T = {
  card: '#2a2018',
  cardBorder: '#3a2e22',
  surface: '#1e1712',
  text: '#e8dcc8',
  textMuted: '#a09080',
  textDim: '#6a5c4e',
  pos: '#4ade80',
  neg: '#f87171',
  warn: '#fbbf24',
  indigo: '#a5b4fc',
  indigoSoft: '#1e1b4b',
} as const;

const DETAILS_PALETTE: DetailsPalette = {
  text: T.text,
  muted: T.textMuted,
  dim: T.textDim,
  border: T.cardBorder,
  surface: T.surface,
  pos: T.pos,
  warn: T.warn,
  neg: T.neg,
  accent: T.indigo,
};

function gradeColor(g: number): string {
  if (g >= 14) return T.pos;
  if (g >= 10) return T.warn;
  return T.neg;
}

/** Les moyennes de l'élève, calculées comme celles du carnet. */
function averageOf(rows: StudentAssessment[], period: number | null): number | null {
  return studentAverage(
    rows
      .filter((a) => period === null || a.period === period)
      .map((a) => ({
        entry: { studentId: 'me', grade: a.grade, status: a.status as GradeStatus },
        assessment: { coefficient: Number(a.coefficient) || 0, countsInAverage: a.counts_in_average },
      })),
  );
}

export function StudentGrades({ code }: { code: string }) {
  const [rows, setRows] = useState<StudentAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sheet, setSheet] = useState<StudentAssessment | null>(null);
  /** Évaluation dont le détail de correction est déplié. */
  const [openDetails, setOpenDetails] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStudentGrades(code)
      .then((r) => { if (alive) setRows(r.assessments); })
      .catch(() => { if (alive) setError('Impossible de charger tes notes.'); });
    return () => { alive = false; };
  }, [code]);

  const openDoc = async (assessment: StudentAssessment, kind: StudentDocKind) => {
    const key = `${assessment.id}|${kind}`;
    setOpening(key);
    setError(null);
    // Ouvert tout de suite : un navigateur mobile bloque une fenêtre ouverte
    // après un aller-retour réseau, car elle n'est plus liée au clic.
    const tab = window.open('', '_blank');
    try {
      const url = await fetchStudentDocUrl(code, assessment.id, kind);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch {
      tab?.close();
      setError('Ce document n’est pas disponible.');
    } finally {
      setOpening(null);
    }
  };

  if (error && rows === null) {
    return <p style={{ color: T.neg, textAlign: 'center', padding: '24px 0' }}>{error}</p>;
  }
  if (rows === null) {
    return <p style={{ color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>Chargement…</p>;
  }
  if (rows.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <p style={{ color: T.text, marginBottom: 6 }}>Aucune évaluation pour l’instant.</p>
        <p style={{ color: T.textDim, fontSize: 13, margin: 0 }}>
          Tes notes apparaîtront ici dès que ton professeur les aura publiées.
        </p>
      </div>
    );
  }

  const year = averageOf(rows, null);

  return (
    <div>
      {/* Moyennes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[1, 2, 3].map((p) => (
          <div key={p} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ color: T.textDim, fontSize: 11 }}>T{p}</div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 18 }}>{formatGrade(averageOf(rows, p))}</div>
          </div>
        ))}
        <div style={{ background: T.indigoSoft, border: `1px solid ${T.indigo}55`, borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
          <div style={{ color: T.indigo, fontSize: 11 }}>Année</div>
          <div style={{ color: T.indigo, fontWeight: 800, fontSize: 18 }}>{formatGrade(year)}</div>
        </div>
      </div>

      {error && (
        <p style={{ color: T.neg, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</p>
      )}

      {/* Évaluations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((a) => {
          const hasGrade = a.status === 'noted' && a.grade !== null;
          const bareme = Number(a.bareme_total ?? 20);
          const details = hasGrade ? parseGradeDetails(a.details) : null;
          const detailsOpen = openDetails === a.id;
          return (
            <div key={a.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: T.text, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ color: T.textDim, fontSize: 12, marginTop: 2 }}>
                    T{a.period ?? '?'} · coef {Number(a.coefficient)}
                    {a.date ? ` · ${new Date(a.date).toLocaleDateString('fr-FR')}` : ''}
                    {!a.counts_in_average && ' · ne compte pas dans la moyenne'}
                  </div>
                </div>
                {hasGrade ? (
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ color: gradeColor(a.grade!), fontWeight: 800, fontSize: 22 }}>
                      {formatGrade(a.grade!)}
                    </span>
                    <span style={{ color: T.textDim, fontSize: 13 }}>/20</span>
                    {a.grade_raw !== null && bareme !== 20 && (
                      <div style={{ color: T.textDim, fontSize: 11 }}>
                        {formatGrade(Number(a.grade_raw))}/{bareme}
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: T.textMuted, fontSize: 13, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                    {a.status === 'noted' ? 'en attente' : STATUS_LABEL[a.status as GradeStatus]}
                  </span>
                )}
              </div>

              {a.comment && !detailsOpen && (
                <p style={{ color: T.textMuted, fontSize: 13, margin: '10px 0 0' }}>{a.comment}</p>
              )}

              {details && (
                <>
                  <button
                    onClick={() => setOpenDetails(detailsOpen ? null : a.id)}
                    style={{ ...docBtn, marginTop: 12, borderColor: T.indigo + '77', color: T.indigo }}
                  >
                    {detailsOpen ? '▾ Masquer le détail' : '▸ Le détail de ma correction'}
                  </button>
                  {detailsOpen && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}` }}>
                      <GradeDetailsView details={details} palette={DETAILS_PALETTE} />
                    </div>
                  )}
                </>
              )}

              {a.corrections_withheld && (
                <p style={{ color: T.textDim, fontSize: 12.5, margin: '10px 0 0', fontStyle: 'italic' }}>
                  La correction sera publiée plus tard.
                </p>
              )}

              {(a.has_subject || a.has_correction || a.has_work) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {a.has_work && (
                    <button onClick={() => setSheet(a)} style={{ ...docBtn, borderColor: T.indigo + '77', color: T.indigo }}>
                      📝 Ma copie corrigée
                    </button>
                  )}
                  {a.has_subject && (
                    <button onClick={() => { void openDoc(a, 'subject'); }} disabled={opening === `${a.id}|subject`} style={docBtn}>
                      {opening === `${a.id}|subject` ? '…' : '📄 Le sujet'}
                    </button>
                  )}
                  {a.has_correction && (
                    <button onClick={() => { void openDoc(a, 'correction'); }} disabled={opening === `${a.id}|correction`} style={docBtn}>
                      {opening === `${a.id}|correction` ? '…' : '✅ La correction'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sheet && (
        <StudentWorkSheet code={code} assessmentId={sheet.id} assessmentName={sheet.name} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

const docBtn: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.cardBorder}`,
  color: T.text,
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
