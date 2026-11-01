import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { parseGradeDetails } from '../lib/gradeDetails';
import {
  buildCorrectionsPdf,
  correctionsPdfName,
  evaluationTitle,
  type CorrectionSheet,
} from '../lib/correctionsPdf';
import type { AssessmentRow } from '../lib/evaluationQueries';

export interface ExportableRow {
  student: { id: string; pseudo: string };
  grade: { grade: number | null; is_validated: boolean; details?: unknown } | null;
}

/** Fiches exportables (élèves avec un détail de correction), dans l'ordre de la liste. */
export function exportableSheets(rows: ExportableRow[]): (CorrectionSheet & { studentId: string; raw: unknown })[] {
  return rows.flatMap((r) => {
    const details = parseGradeDetails(r.grade?.details);
    if (!r.grade || !details) return [];
    return [{
      studentId: r.student.id,
      pseudo: r.student.pseudo,
      grade: r.grade.grade,
      validated: r.grade.is_validated,
      details,
      raw: r.grade.details,
    }];
  });
}

/** Télécharge le PDF des fiches choisies. */
export function downloadCorrectionsPdf(
  assessment: AssessmentRow,
  sheets: (CorrectionSheet & { raw: unknown })[],
  summary: boolean,
  single?: string,
): void {
  const className = assessment.classes?.name ?? '';
  const doc = buildCorrectionsPdf({
    assessmentName: assessment.name,
    evaluationTitle: evaluationTitle(sheets.map((s) => s.raw)),
    className,
    sheets,
    summary,
  });
  doc.save(correctionsPdfName(className, assessment.name, single));
}

/**
 * « Exporter les corrections » : fiches de la classe à imprimer (même fiche que le Word du
 * Correcteur). Par défaut les notes validées seulement ; les brouillons se cochent un à un.
 */
export function ExportCorrectionsDialog({
  assessment,
  rows,
  onClose,
}: {
  assessment: AssessmentRow;
  rows: ExportableRow[];
  onClose: () => void;
}) {
  const sheets = useMemo(() => exportableSheets(rows), [rows]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(sheets.filter((s) => s.validated).map((s) => s.studentId)));
  const [summary, setSummary] = useState(true);
  const chosen = sheets.filter((s) => picked.has(s.studentId));
  const draftsLeftOut = sheets.filter((s) => !s.validated && !picked.has(s.studentId)).length;
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal isOpen onClose={onClose} title="Exporter les corrections (PDF)" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          Une fiche par élève (questions, compétences, forces, faiblesses, commentaire), comme le Word du Correcteur.
          Ni la transcription ni les points à arbitrer.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPicked(new Set(sheets.map((s) => s.studentId)))} style={btn}>Tout cocher</button>
          <button onClick={() => setPicked(new Set(sheets.filter((s) => s.validated).map((s) => s.studentId)))} style={btn}>Validées seulement</button>
          <button onClick={() => setPicked(new Set())} style={btn}>Rien</button>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {sheets.length === 0 && <div style={{ padding: 10, color: 'var(--text-dim)' }}>Aucune correction détaillée pour cette classe.</div>}
          {sheets.map((s) => (
            <label key={s.studentId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.has(s.studentId)} onChange={() => toggle(s.studentId)} />
              <span style={{ flex: 1, fontWeight: 600 }}>{s.pseudo}</span>
              <span style={{ color: s.validated ? 'var(--pos)' : 'var(--warn)', fontWeight: 700, fontSize: 12 }}>
                {s.grade ?? '—'}/20{s.validated ? '' : ' · brouillon'}
              </span>
            </label>
          ))}
        </div>
        {draftsLeftOut > 0 && (
          <div style={{ fontSize: 12, color: 'var(--warn)' }}>
            {draftsLeftOut} brouillon{draftsLeftOut > 1 ? 's' : ''} non validé{draftsLeftOut > 1 ? 's' : ''} hors de l’export : coche-les pour les inclure.
          </div>
        )}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
          <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
          Récapitulatif de la classe en première page (notes et réussite par question)
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btn}>Annuler</button>
          <button
            onClick={() => {
              downloadCorrectionsPdf(assessment, chosen, summary);
              onClose();
            }}
            disabled={chosen.length === 0}
            style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: chosen.length === 0 ? 0.55 : 1 }}
          >
            Télécharger le PDF ({chosen.length} fiche{chosen.length > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  padding: '5px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
