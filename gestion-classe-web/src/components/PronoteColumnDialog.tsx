import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { buildPronoteColumn, pronoteColumnText, type PronoteColumnRow } from '../lib/pronoteColumn';
import { fetchAssessmentGrades, fetchExpectedStudents, type AssessmentRow } from '../lib/evaluationQueries';

/**
 * « Copier pour Pronote » (hub Évaluations, phase 4) : la colonne des notes d'une classe,
 * dans l'ordre de la liste Pronote, prête à coller dans la saisie du devoir.
 *
 * Toute la classe, même pour une éval de demi-groupe : Pronote liste toute la classe, et une
 * ligne vide garde l'alignement. Les élèves témoins n'y sont pas. Rien ne sort de l'app :
 * le texte va dans le presse-papiers du prof, qui le colle lui-même.
 */
export function PronoteColumnDialog({ assessment, onClose }: { assessment: AssessmentRow; onClose: () => void }) {
  const [rows, setRows] = useState<PronoteColumnRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bareme = Number(assessment.bareme_total ?? 20);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchExpectedStudents([{ ...assessment, group_id: null }]), fetchAssessmentGrades(assessment.id)])
      .then(([roster, grades]) => {
        if (alive) setRows(buildPronoteColumn(roster[assessment.id] ?? [], grades, bareme));
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Notes introuvables'); });
    return () => { alive = false; };
  }, [assessment, bareme]);

  const drafts = useMemo(() => rows?.filter((r) => r.draft).length ?? 0, [rows]);
  const toCheck = useMemo(() => rows?.filter((r) => r.orderToCheck).length ?? 0, [rows]);

  const copy = async () => {
    if (!rows) return;
    try {
      await navigator.clipboard.writeText(pronoteColumnText(rows));
      setCopied(true);
    } catch {
      setError('Le navigateur a refusé la copie : sélectionne la colonne à la main.');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Copier pour Pronote · ${assessment.classes?.name ?? ''}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
          Notes sur {String(bareme).replace('.', ',')}, une par ligne, dans l’ordre alphabétique des noms.
          Dans Pronote, ouvre la saisie du devoir, clique la case du premier élève et colle (Ctrl+V).
          Vérifie ensuite la première et la dernière ligne.
        </div>
        {error && <div style={{ color: 'var(--neg)', fontSize: 12.5 }}>{error}</div>}
        {!rows && !error && <div style={{ color: 'var(--text-dim)' }}>Chargement…</div>}
        {rows && (
          <>
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.studentId} style={{ borderTop: i ? '1px solid var(--border)' : undefined, background: r.orderToCheck ? 'var(--warn-soft)' : undefined }}>
                      <td style={{ padding: '4px 8px', color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{i + 1}</td>
                      <td style={{ padding: '4px 8px', fontWeight: 600 }}>{r.pseudo}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {r.cell || <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>vide</span>}
                        {r.draft && <span style={{ color: 'var(--warn)', fontWeight: 600, fontSize: 11 }}> · brouillon</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {toCheck > 0 && (
              <div style={{ fontSize: 12, color: 'var(--warn)' }}>
                Lignes surlignées : l’app ne connaît que les deux premières lettres du nom. Vérifie leur ordre dans Pronote.
              </div>
            )}
            {drafts > 0 && (
              <div style={{ fontSize: 12, color: 'var(--warn)' }}>
                {drafts} note{drafts > 1 ? 's' : ''} encore en brouillon {drafts > 1 ? 'sont incluses' : 'est incluse'} : valide-les d’abord si besoin.
              </div>
            )}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btn}>Fermer</button>
          <button
            onClick={() => { void copy(); }}
            disabled={!rows || rows.length === 0}
            style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' }}
          >
            {copied ? 'Copié ✓' : `Copier la colonne (${rows?.length ?? 0} lignes)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const btn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
