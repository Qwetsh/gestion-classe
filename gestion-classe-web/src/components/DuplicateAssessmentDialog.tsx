import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { levelFromClassName } from '../lib/boardsQueries';
import {
  ASSESSMENT_KIND_LABEL,
  createAssessment,
  createAssessmentSeries,
  downloadAssessmentDoc,
  effectiveDocPath,
  fetchClasses,
  uploadAssessmentDoc,
  uploadSeriesDoc,
  type AssessmentDocKind,
  type AssessmentRow,
  type ClassRow,
} from '../lib/evaluationQueries';

/**
 * Dupliquer une éval (hub Évaluations, phase 4) : mêmes réglages (type, barème, coefficient,
 * moyenne, titre court, séquence), sujet et corrigé recopiés si on le veut, pour une ou
 * plusieurs classes, au trimestre en cours. Ni notes, ni copies, ni publication.
 * Plusieurs classes → une série, comme à la création : sujet et corrigé communs.
 */
export function DuplicateAssessmentDialog({
  source,
  userId,
  onClose,
  onCreated,
}: {
  source: AssessmentRow;
  userId: string;
  onClose: () => void;
  /** Id de l'éval créée (celle de la classe d'origine si elle est cochée), pour ouvrir sa fiche. */
  onCreated: (assessmentId: string) => void;
}) {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set([source.class_id]));
  const [name, setName] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const subjectPath = effectiveDocPath(source, 'subject');
  const correctionPath = effectiveDocPath(source, 'correction');
  const [withDocs, setWithDocs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses(userId).then(setClasses).catch((e) => setError(e instanceof Error ? e.message : 'Classes introuvables'));
  }, [userId]);

  // Tant que le prof n'a pas touché au nom : « (copie) » seulement si la classe d'origine est cochée.
  const shownName = name ?? (picked.has(source.class_id) ? `${source.name} (copie)` : source.name);
  const hasDocs = !!(subjectPath || correctionPath);

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async () => {
    const classIds = (classes ?? []).filter((c) => picked.has(c.id)).map((c) => c.id);
    if (classIds.length === 0 || !shownName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const common = {
        userId,
        name: shownName.trim(),
        subject: source.subject,
        date: date || null,
        baremeTotal: Number(source.bareme_total ?? 20),
        coefficient: Number(source.coefficient),
        kind: source.kind,
        countsInAverage: source.counts_in_average,
        shortName: source.short_name ?? null,
        sequence: source.sequence ?? null,
      };
      const docs: [AssessmentDocKind, string | null][] = [['subject', subjectPath], ['correction', correctionPath]];
      let firstId: string;
      if (classIds.length > 1) {
        const firstClass = (classes ?? []).find((c) => c.id === classIds[0]);
        const { series, assessments } = await createAssessmentSeries({
          ...common,
          classIds,
          level: levelFromClassName(firstClass?.name ?? ''),
        });
        firstId = assessments.find((a) => a.class_id === source.class_id)?.id ?? assessments[0].id;
        if (withDocs) {
          for (const [kind, path] of docs) {
            if (path) await uploadSeriesDoc(userId, series.id, kind, await downloadAssessmentDoc(path, kind), null);
          }
        }
      } else {
        const created = await createAssessment({ ...common, classId: classIds[0] });
        firstId = created.id;
        if (withDocs) {
          for (const [kind, path] of docs) {
            if (path) await uploadAssessmentDoc(userId, created.id, kind, await downloadAssessmentDoc(path, kind), null);
          }
        }
      }
      onCreated(firstId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplication impossible');
      setBusy(false);
    }
  };

  const count = picked.size;
  return (
    <Modal isOpen onClose={onClose} title={`Dupliquer « ${source.name} »`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          {ASSESSMENT_KIND_LABEL[source.kind]} · /{Number(source.bareme_total ?? 20)} · coef {Number(source.coefficient)}
          {source.sequence ? ` · ${source.sequence}` : ''}{!source.counts_in_average ? ' · hors moyenne' : ''}.
          La copie arrive au trimestre en cours, sans notes, sans copies, non publiée.
        </div>
        <label style={field}>
          <span style={label}>Nom</span>
          <input value={shownName} onChange={(e) => setName(e.target.value)} style={input} />
        </label>
        <div style={field}>
          <span style={label}>Pour {count > 1 ? `${count} classes (une série : sujet et corrigé communs)` : 'la classe'}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(classes ?? []).map((c) => (
              <label key={c.id} style={chip(picked.has(c.id))}>
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                {c.name}
              </label>
            ))}
            {!classes && <span style={{ color: 'var(--text-dim)' }}>Chargement…</span>}
          </div>
        </div>
        <label style={field}>
          <span style={label}>Date (facultative)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, width: 180 }} />
        </label>
        {hasDocs && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={withDocs} onChange={(e) => setWithDocs(e.target.checked)} />
            Recopier {subjectPath && correctionPath ? 'le sujet et le corrigé' : subjectPath ? 'le sujet' : 'le corrigé'}
          </label>
        )}
        {error && <div style={{ color: 'var(--neg)', fontSize: 12.5 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btn}>Annuler</button>
          <button
            onClick={() => { void submit(); }}
            disabled={busy || count === 0 || !shownName.trim()}
            style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: busy || count === 0 ? 0.6 : 1 }}
          >
            {busy ? 'Duplication…' : count > 1 ? `Créer pour ${count} classes` : 'Dupliquer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' };
const input: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
};
const chip = (on: boolean): React.CSSProperties => ({
  position: 'relative', padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--indigo)' : 'var(--border)'}`,
  background: on ? 'var(--indigo)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--text)',
});
const btn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
