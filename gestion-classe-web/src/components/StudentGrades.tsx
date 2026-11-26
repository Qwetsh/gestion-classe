import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileCheck, FileText, PenLine } from 'lucide-react';
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
 * Onglet « Notes › Évaluations » de l'espace élève : ses notes, le sujet et le corrigé, et pour les
 * activités numériques sa copie corrigée (StudentWorkSheet, plein écran pensé pour le téléphone).
 *
 * L'élève ne voit que ses propres notes — aucune moyenne de classe, aucun classement sur
 * les évaluations. Les moyennes sont calculées ici avec `gradeStats`, le même module que
 * le carnet de l'enseignant : la règle « un absent ne compte pas » n'existe qu'à un seul
 * endroit, donc l'élève et le prof lisent forcément le même chiffre.
 *
 * Direction A : les couleurs viennent de `styles/eleve.css` (racine `.el`). Une note n'est pas
 * coloriée selon sa valeur.
 */

const DETAILS_PALETTE: DetailsPalette = {
  text: 'var(--el-text)',
  muted: 'var(--el-muted)',
  dim: 'var(--el-dim)',
  border: 'var(--el-line)',
  surface: '#E9E9EC',
  pos: 'var(--el-pos)',
  warn: 'var(--el-warn)',
  neg: 'var(--el-neg)',
  accent: 'var(--el-indigo)',
};

const shortDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Les moyennes de l'élève, calculées comme celles du carnet. */
function averageOf(rows: StudentAssessment[], period: number | null): number | null {
  return studentAverage(
    rows
      .filter((a) => period === null || a.period === period)
      .map((a) => ({
        entry: { studentId: 'me', grade: a.grade, status: a.status as GradeStatus },
        assessment: { coefficient: Number(a.coefficient) || 0, countsInAverage: a.counts_in_average, onlyIfRaises: !!a.only_if_raises_average },
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

  if (error && rows === null) return <p className="el-error">{error}</p>;
  if (rows === null) return <p className="el-note">Chargement…</p>;
  if (rows.length === 0) {
    return (
      <div className="el-card el-empty">
        <p>Aucune évaluation pour l’instant.</p>
        <p>Tes notes apparaîtront ici dès que ton professeur les aura publiées.</p>
      </div>
    );
  }

  const year = averageOf(rows, null);
  // Les plus récentes d'abord : c'est la dernière note que l'élève vient chercher
  const sorted = [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return (
    <>
      {/* Moyennes */}
      <div className="el-card el-card--pad" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="el-label">Moyenne de l’année</span>
          <span className="el-big">{formatGrade(year)}<span className="el-unit" style={{ fontSize: 15 }}> /20</span></span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[1, 2, 3].map((p) => (
            <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span className="el-label">T{p}</span>
              <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatGrade(averageOf(rows, p))}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="el-error">{error}</p>}

      {/* Évaluations */}
      {sorted.map((a) => {
        const hasGrade = a.status === 'noted' && a.grade !== null;
        const bareme = Number(a.bareme_total ?? 20);
        const details = hasGrade ? parseGradeDetails(a.details) : null;
        const detailsOpen = openDetails === a.id;
        const coef = Number(a.coefficient);
        const meta = [
          a.date ? shortDate(a.date) : null,
          `T${a.period ?? '?'}`,
          coef !== 1 ? `coef. ${String(coef).replace('.', ',')}` : null,
        ].filter(Boolean).join(' · ');
        return (
          <div key={a.id} className="el-card el-card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="el-row__title" style={{ fontSize: 16, lineHeight: '22px' }}>{a.name}</span>
                <span className="el-row__meta">{meta}</span>
                {!a.counts_in_average && <span className="el-chip el-chip--plain" style={{ alignSelf: 'flex-start' }}>Ne compte pas dans la moyenne</span>}
                {a.counts_in_average && a.only_if_raises_average && (
                  <span className="el-chip el-chip--pos" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>Compte seulement si elle monte ta moyenne</span>
                )}
              </div>
              {hasGrade ? (
                <div className="el-grade">
                  {formatGrade(a.grade!)}<span className="el-unit"> /20</span>
                  {a.grade_raw !== null && bareme !== 20 && (
                    <div className="el-unit">{formatGrade(Number(a.grade_raw))} / {String(bareme).replace('.', ',')}</div>
                  )}
                </div>
              ) : (
                <span className="el-chip el-chip--plain">{a.status === 'noted' ? 'En attente' : STATUS_LABEL[a.status as GradeStatus]}</span>
              )}
            </div>

            {a.comment && !detailsOpen && (
              <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: 'var(--el-muted)' }}>{a.comment}</p>
            )}

            {a.corrections_withheld && <p className="el-note">La correction sera publiée plus tard.</p>}

            {(details || a.has_subject || a.has_correction || a.has_work) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.has_work && (
                  <button type="button" className="el-btn el-btn--soft" onClick={() => setSheet(a)}>
                    <PenLine size={18} aria-hidden /> Ma copie corrigée
                  </button>
                )}
                {details && (
                  <button type="button" className="el-btn el-btn--soft" onClick={() => setOpenDetails(detailsOpen ? null : a.id)} aria-expanded={detailsOpen}>
                    {detailsOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                    {detailsOpen ? 'Masquer le détail' : 'Le détail de ma correction'}
                  </button>
                )}
                {a.has_subject && (
                  <button type="button" className="el-btn" onClick={() => { void openDoc(a, 'subject'); }} disabled={opening === `${a.id}|subject`}>
                    <FileText size={18} aria-hidden /> {opening === `${a.id}|subject` ? 'Ouverture…' : 'Le sujet'}
                  </button>
                )}
                {a.has_correction && (
                  <button type="button" className="el-btn" onClick={() => { void openDoc(a, 'correction'); }} disabled={opening === `${a.id}|correction`}>
                    <FileCheck size={18} aria-hidden /> {opening === `${a.id}|correction` ? 'Ouverture…' : 'Le corrigé'}
                  </button>
                )}
              </div>
            )}

            {details && detailsOpen && (
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--el-line)' }}>
                <GradeDetailsView details={details} palette={DETAILS_PALETTE} compact />
              </div>
            )}
          </div>
        );
      })}

      {sheet && (
        <StudentWorkSheet code={code} assessmentId={sheet.id} assessmentName={sheet.name} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
