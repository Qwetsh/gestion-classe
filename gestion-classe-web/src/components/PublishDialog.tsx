import { useState } from 'react';
import { Modal } from './Modal';
import type { AssessmentRow } from '../lib/evaluationQueries';

/**
 * Publier une éval pour une classe (hub Évaluations, phase 4) : les notes avec leurs
 * corrections, ou les notes seules — le détail, le commentaire, le corrigé et la copie
 * corrigée attendent alors un second geste, « Publier les corrections » (migration 064).
 */
export function PublishDialog({
  assessment,
  drafts,
  onClose,
  onConfirm,
}: {
  assessment: AssessmentRow;
  /** Notes encore en brouillon : elles restent cachées même après publication (053). */
  drafts: number;
  onClose: () => void;
  onConfirm: (withCorrections: boolean) => Promise<void>;
}) {
  const [withCorrections, setWithCorrections] = useState(true);
  const [busy, setBusy] = useState(false);
  const cls = assessment.classes?.name ?? 'cette classe';

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(withCorrections);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Publier « ${assessment.name} » pour ${cls}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <label style={option(withCorrections)}>
          <input type="radio" name="publish" checked={withCorrections} onChange={() => setWithCorrections(true)} />
          <span>
            <strong>Les notes et les corrections</strong>
            <span style={hint}>L’élève voit sa note, son détail, le commentaire, le sujet, le corrigé et sa copie corrigée.</span>
          </span>
        </label>
        <label style={option(!withCorrections)}>
          <input type="radio" name="publish" checked={!withCorrections} onChange={() => setWithCorrections(false)} />
          <span>
            <strong>Les notes seulement</strong>
            <span style={hint}>L’élève voit sa note et le sujet. Les corrections attendent : tu les publies plus tard depuis cette ligne.</span>
          </span>
        </label>
        {drafts > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--warn)' }}>
            {drafts} note{drafts > 1 ? 's sont' : ' est'} encore en brouillon : {drafts > 1 ? 'ces élèves ne verront pas leur note' : 'cet élève ne verra pas sa note'} tant qu’elle n’est pas validée.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={btn}>Annuler</button>
          <button onClick={() => { void submit(); }} disabled={busy} style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}>
            {busy ? 'Publication…' : withCorrections ? 'Publier tout' : 'Publier les notes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const option = (on: boolean): React.CSSProperties => ({
  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
  border: `1px solid ${on ? 'var(--indigo)' : 'var(--border)'}`, background: on ? 'var(--indigo-soft)' : 'var(--surface)',
});
const hint: React.CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: 12, marginTop: 2, lineHeight: 1.45 };
const btn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
