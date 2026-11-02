import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyViewer } from './CopyViewer';
import type { AssessmentRow } from '../lib/evaluationQueries';

/**
 * Détail d'une cellule du carnet (bouton « i ») : la visionneuse des copies de l'éval, ouverte
 * sur l'élève de la cellule, par-dessus la grille. ↑ ↓ passent d'un élève à l'autre sans fermer.
 * Phase 1 du hub (PLAN_hub_evaluations.md) ; la phase 2 la remplace par la modale élève × éval.
 */
export function CellDetailDialog({ assessment, studentId, onClose, onError }: {
  assessment: AssessmentRow;
  studentId: string;
  /** `changed` : une note, une validation ou une copie a bougé, le carnet doit se recharger. */
  onClose: (changed: boolean) => void;
  onError: (message: string) => void;
}) {
  const [changed, setChanged] = useState(false);
  const changedRef = useRef(false);
  const markChanged = useCallback(() => { changedRef.current = true; setChanged(true); }, []);
  const close = () => onClose(changedRef.current || changed);

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détail : ${assessment.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow-2)', width: 'min(1320px, 100%)', padding: 16, boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{assessment.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {assessment.classes?.name ?? ''} · ↑ ↓ : élève précédent ou suivant
            </div>
          </div>
          <Link to={`/evaluations/${assessment.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--indigo)' }}>
            Fiche de l’éval ↗
          </Link>
          <button
            onClick={close}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit' }}
          >
            Fermer
          </button>
        </div>
        <CopyViewer assessment={assessment} initialStudentId={studentId} onError={onError} onChanged={markChanged} />
      </div>
    </div>
  );
}
