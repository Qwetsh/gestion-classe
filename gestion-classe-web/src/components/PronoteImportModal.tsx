import { useMemo, useState } from 'react';
import {
  createAssessment,
  saveGrade,
  type AssessmentRow,
  type CarnetStudent,
  type GradeRow,
} from '../lib/evaluationQueries';
import { toTwenty } from '../lib/gradeStats';
import {
  decodeCsvBytes,
  isoDateFromPronote,
  matchStudents,
  parsePronoteCsv,
  type PronoteExport,
} from '../lib/pronoteImport';

/**
 * Import d'un export de notes Pronote (CSV) dans le carnet de la classe affichée.
 *
 * Rien n'est écrit avant le clic sur « Importer » : on montre d'abord ce que le fichier
 * contient, quels élèves sont reconnus, et ce qui serait écrasé. Les élèves du fichier sans
 * correspondance sont listés, jamais ignorés en silence.
 */

interface EvalConfig {
  include: boolean;
  /** `'new'` : créer l'évaluation ; sinon identifiant d'une évaluation existante à compléter. */
  target: string;
  name: string;
  date: string; // AAAA-MM-JJ ou ''
  coefficient: string;
}

const showNum = (n: number) => String(n).replace('.', ',');

export function PronoteImportModal({
  userId, classId, className, period, schoolYear, students, assessments, grades, onClose, onDone,
}: {
  userId: string;
  classId: string;
  className: string;
  period: number;
  schoolYear: string;
  students: CarnetStudent[];
  assessments: AssessmentRow[];
  grades: Map<string, GradeRow>;
  onClose: () => void;
  /** Appelée après un import réussi, pour recharger le carnet. */
  onDone: () => Promise<void>;
}) {
  const [data, setData] = useState<PronoteExport | null>(null);
  const [fileName, setFileName] = useState('');
  const [configs, setConfigs] = useState<EvalConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const matches = useMemo(() => (data ? matchStudents(data.students, students) : []), [data, students]);
  const unmatched = matches.filter((m) => m.studentId === null);
  const unknownCells = data ? data.students.flatMap((s) => s.unknown.map((u) => `${s.fullName} : « ${u.text} »`)) : [];

  const loadFile = async (file: File) => {
    setError(null);
    try {
      const parsed = parsePronoteCsv(decodeCsvBytes(await file.arrayBuffer()));
      setData(parsed);
      setFileName(file.name);
      setConfigs(
        parsed.evals.map((ev) => {
          const iso = isoDateFromPronote(ev.rawDate, schoolYear);
          // Même date et même barème qu'une évaluation du carnet : c'est presque sûrement elle.
          const same = assessments.find(
            (a) => iso !== null && a.date === iso && Number(a.bareme_total ?? 20) === ev.bareme,
          );
          return {
            include: true,
            target: same?.id ?? 'new',
            name: ev.label || (ev.rawDate ? `Évaluation du ${ev.rawDate}` : 'Évaluation Pronote'),
            date: iso ?? '',
            coefficient: showNum(ev.coefficient),
          };
        }),
      );
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Fichier illisible');
    }
  };

  const patch = (i: number, p: Partial<EvalConfig>) =>
    setConfigs((prev) => prev.map((c, j) => (j === i ? { ...c, ...p } : c)));

  /** Notes déjà présentes et différentes de celles du fichier, pour une évaluation existante. */
  const overwriteCount = (i: number): number => {
    if (!data) return 0;
    const cfg = configs[i];
    if (!cfg || cfg.target === 'new') return 0;
    let n = 0;
    for (const m of matches) {
      const g = m.row.grades[i];
      if (!g || !m.studentId) continue;
      const old = grades.get(`${cfg.target}|${m.studentId}`);
      // Une ligne sans note (aménagement coché avant correction) n'est pas un écrasement.
      const hadValue = old && (old.status !== 'noted' || old.grade_raw !== null);
      if (hadValue && (old.status !== g.status || Number(old.grade_raw) !== g.raw)) n++;
    }
    return n;
  };

  const included = configs.filter((c) => c.include).length;
  const nameMissing = configs.some((c) => c.include && c.target === 'new' && c.name.trim() === '');
  const coefBad = configs.some((c) => c.include && c.target === 'new' && !(Number(c.coefficient.replace(',', '.')) >= 0));

  const run = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < data.evals.length; i++) {
        const cfg = configs[i];
        if (!cfg.include) continue;
        const ev = data.evals[i];
        setProgress(`Évaluation ${i + 1}/${data.evals.length}…`);
        const assessmentId =
          cfg.target === 'new'
            ? (await createAssessment({
                userId,
                classId,
                name: cfg.name.trim(),
                baremeTotal: ev.bareme,
                coefficient: Number(cfg.coefficient.replace(',', '.')) || 1,
                date: cfg.date || null,
                period,
                schoolYear,
              })).id
            : cfg.target;

        const jobs = matches.flatMap((m) => {
          const g = m.row.grades[i];
          return g && m.studentId ? [{ studentId: m.studentId, g }] : [];
        });
        // Par paquets : une trentaine de requêtes d'un coup, c'est inutile et fragile.
        for (let k = 0; k < jobs.length; k += 8) {
          await Promise.all(
            jobs.slice(k, k + 8).map(({ studentId, g }) =>
              saveGrade({
                userId,
                assessmentId,
                studentId,
                raw: g.raw,
                grade: g.status === 'noted' ? toTwenty(g.raw, ev.bareme) : null,
                status: g.status,
              }),
            ),
          );
        }
      }
      await onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import impossible');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div onClick={() => !busy && onClose()} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          Importer depuis Pronote
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 14px', lineHeight: 1.5 }}>
          Choisis l’export CSV des notes d’une classe. Les notes sont rangées dans <strong>{className}</strong>,
          trimestre {period}.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); }}
          disabled={busy}
        />

        {error && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--neg)' }}>{error}</div>}

        {data && (
          <>
            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text)' }}>
              <strong>{fileName}</strong> — {data.students.length} élèves, {data.evals.length} évaluation{data.evals.length > 1 ? 's' : ''}.
              {' '}<span style={{ color: unmatched.length ? 'var(--warn)' : 'var(--text-dim)' }}>
                {matches.length - unmatched.length} reconnus
                {unmatched.length > 0 && `, ${unmatched.length} sans correspondance`}.
              </span>
            </div>

            {data.evals.map((ev, i) => {
              const cfg = configs[i];
              if (!cfg) return null;
              const compatible = assessments.filter((a) => Number(a.bareme_total ?? 20) === ev.bareme);
              const over = overwriteCount(i);
              const filled = matches.filter((m) => m.row.grades[i]).length;
              return (
                <div key={ev.col} style={{ marginTop: 14, padding: 12, border: '1px solid var(--border)', borderRadius: 10, opacity: cfg.include ? 1 : 0.55 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={cfg.include} disabled={busy} onChange={(e) => patch(i, { include: e.target.checked })} />
                    Évaluation {i + 1} · /{showNum(ev.bareme)} · {filled} note{filled > 1 ? 's' : ''}
                    {ev.rawDate && ` · ${ev.rawDate}`}
                  </label>

                  {cfg.include && (
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <select value={cfg.target} disabled={busy} onChange={(e) => patch(i, { target: e.target.value })} style={field}>
                        <option value="new">Créer une nouvelle évaluation</option>
                        {compatible.map((a) => (
                          <option key={a.id} value={a.id}>Compléter « {a.name} »{a.date ? ` (${a.date})` : ''}</option>
                        ))}
                      </select>

                      {cfg.target === 'new' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 70px', gap: 8 }}>
                          <input value={cfg.name} disabled={busy} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Nom de l’évaluation" style={field} />
                          <input type="date" value={cfg.date} disabled={busy} onChange={(e) => patch(i, { date: e.target.value })} style={field} />
                          <input value={cfg.coefficient} disabled={busy} onChange={(e) => patch(i, { coefficient: e.target.value })} title="Coefficient" style={field} />
                        </div>
                      )}

                      {over > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--warn)' }}>
                          ⚠ {over} note{over > 1 ? 's' : ''} déjà saisie{over > 1 ? 's' : ''} dans le carnet sera{over > 1 ? 'ont' : ''} remplacée{over > 1 ? 's' : ''}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {unmatched.length > 0 && (
              <details style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--warn)' }}>
                  {unmatched.length} élève{unmatched.length > 1 ? 's' : ''} du fichier non importé{unmatched.length > 1 ? 's' : ''}
                </summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {unmatched.map((m) => (
                    <li key={m.row.fullName}>
                      {m.row.fullName}{m.ambiguous ? ' (plusieurs élèves portent ce pseudo)' : ' (absent de la classe)'}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {unknownCells.length > 0 && (
              <details style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--warn)' }}>
                  {unknownCells.length} valeur{unknownCells.length > 1 ? 's' : ''} non reconnue{unknownCells.length > 1 ? 's' : ''} (ignorée{unknownCells.length > 1 ? 's' : ''})
                </summary>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {unknownCells.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </details>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 20 }}>
          {progress && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 'auto' }}>{progress}</span>}
          <button onClick={onClose} disabled={busy} style={btnGhost}>Annuler</button>
          <button
            onClick={() => { void run(); }}
            disabled={busy || !data || included === 0 || nameMissing || coefBad}
            style={{ ...btnPrimary, opacity: busy || !data || included === 0 || nameMissing || coefBad ? 0.5 : 1 }}
          >
            {busy ? 'Import…' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100,
};
const card: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 14, padding: 24, width: 560, maxWidth: '94vw',
  maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-2)',
};
const field: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, minWidth: 0,
};
const btnGhost: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-3)',
  color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: '1px solid transparent', background: 'var(--indigo)',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
