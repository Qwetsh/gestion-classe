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
import { correctionsDocxBlob } from '../lib/correctionsDocx';
import { buildCopiesMarkdown, studentLabels } from '../lib/copiesMarkdown';
import { downloadText } from '../lib/productionsExport';

export interface ExportableRow {
  student: { id: string; pseudo: string };
  grade: {
    grade: number | null;
    is_validated: boolean;
    details?: unknown;
    grade_raw?: number | null;
    status?: string | null;
  } | null;
  /** Transcription de la copie (migration 056), pour l'export Markdown. */
  transcript?: unknown;
}

type ExportFormat = 'pdf' | 'word' | 'md';

const FORMATS: [ExportFormat, string, string][] = [
  ['pdf', 'PDF à imprimer', 'Récapitulatif et une fiche par élève, comme le Word du Correcteur.'],
  ['word', 'Word modifiable', 'Le même contenu en .docx, pour retoucher un commentaire avant d’imprimer.'],
  ['md', 'Markdown pour Claude', 'Sans aucun nom : « Élève 01, 02… ». Pour un bilan de classe ou des remédiations.'],
];

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [withTranscripts, setWithTranscripts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => studentLabels(rows.map((r) => r.student)), [rows]);
  const hasTranscripts = rows.some((r) => !!r.transcript);
  const chosen = sheets.filter((s) => picked.has(s.studentId));
  const draftsLeftOut = sheets.filter((s) => !s.validated && !picked.has(s.studentId)).length;
  const exportNow = async () => {
    const className = assessment.classes?.name ?? '';
    setBusy(true);
    setError(null);
    try {
      if (format === 'pdf') {
        downloadCorrectionsPdf(assessment, chosen, summary);
      } else if (format === 'word') {
        const blob = await correctionsDocxBlob({
          assessmentName: assessment.name,
          evaluationTitle: evaluationTitle(chosen.map((s) => s.raw)),
          className,
          sheets: chosen,
          summary,
        });
        downloadBlob(correctionsPdfName(className, assessment.name).replace(/\.pdf$/, '.docx'), blob);
      } else {
        const { markdown } = buildCopiesMarkdown({
          assessmentName: assessment.name,
          className,
          bareme: Number(assessment.bareme_total ?? 20),
          roster: rows.map((r) => r.student),
          grades: Object.fromEntries(rows.filter((r) => r.grade).map((r) => [r.student.id, {
            grade: r.grade!.grade,
            grade_raw: r.grade!.grade_raw ?? null,
            status: r.grade!.status ?? 'noted',
            is_validated: r.grade!.is_validated,
            details: r.grade!.details,
          }])),
          transcripts: Object.fromEntries(rows.map((r) => [r.student.id, r.transcript])),
          only: new Set(chosen.map((s) => s.studentId)),
          withTranscripts: withTranscripts && hasTranscripts,
        });
        downloadText(correctionsPdfName(className, assessment.name).replace(/\.pdf$/, '_anonyme.md'), markdown);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal isOpen onClose={onClose} title={`Exporter les corrections · ${assessment.classes?.name ?? ''}`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Format">
          {FORMATS.map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={format === id}
              onClick={() => setFormat(id)}
              style={{ ...btn, ...(format === id ? { background: 'var(--indigo)', color: '#fff', border: '1px solid var(--indigo)' } : {}) }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {FORMATS.find(([id]) => id === format)![2]}
          {format !== 'md' && ' Ni la transcription ni les points à arbitrer.'}
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
        {format !== 'md' && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
            Récapitulatif de la classe en première page (notes et réussite par question)
          </label>
        )}
        {format === 'md' && (
          <>
            {hasTranscripts && (
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={withTranscripts} onChange={(e) => setWithTranscripts(e.target.checked)} />
                Inclure la transcription des copies
              </label>
            )}
            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Correspondance des numéros (reste dans l’app)</summary>
              <div style={{ columns: 2, marginTop: 6, color: 'var(--text-muted)' }}>
                {rows.map((r) => <div key={r.student.id}><strong>{labels.get(r.student.id)}</strong> · {r.student.pseudo}</div>)}
              </div>
            </details>
            <div style={{ fontSize: 12, color: 'var(--warn)' }}>
              Prénoms et pseudos sont remplacés partout. Relis quand même le fichier avant de le coller : un nom écrit autrement sur une copie peut rester.
            </div>
          </>
        )}
        {error && <div style={{ fontSize: 13, color: 'var(--neg)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btn}>Annuler</button>
          <button
            onClick={() => { void exportNow(); }}
            disabled={chosen.length === 0 || busy}
            style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: chosen.length === 0 || busy ? 0.55 : 1 }}
          >
            {busy ? 'Préparation…' : `Télécharger ${format === 'pdf' ? 'le PDF' : format === 'word' ? 'le Word' : 'le Markdown'} (${chosen.length} élève${chosen.length > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  padding: '5px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
