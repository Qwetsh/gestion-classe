import { useEffect, useState } from 'react';
import { correctionChangedSince, type KitSummary } from '../lib/assessmentLibrary';
import { dropLibraryKits, fetchBoardUpdatedAt, type AssessmentRow } from '../lib/evaluationQueries';

const fr = (n: number) => String(n).replace('.', ',');

/**
 * Barème du bouton « Corriger avec Claude » quand l'éval est reliée à une activité de Mes cours
 * (migration 095) : avant la première copie, ce qui va se passer ; ensuite, le barème préparé
 * (lignes, total, d'où il vient), à vérifier, et « Refaire le barème » si la correction a changé.
 * Rien n'est affiché quand le Correcteur a envoyé son kit : c'est lui qui sert.
 */
export function LibraryKitPanel({
  assessment,
  kits,
  onChanged,
  onError,
}: {
  assessment: AssessmentRow;
  kits: KitSummary[];
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const correctionId = assessment.library_correction_board_id ?? null;
  const fromCorrecteur = kits.some((k) => k.source === 'correcteur');
  const libraryKits = kits.filter((k) => k.source === 'bibliotheque' && k.correctionId === correctionId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correctionUpdatedAt, setCorrectionUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!correctionId || libraryKits.length === 0) return;
    let cancelled = false;
    fetchBoardUpdatedAt(correctionId).then((d) => { if (!cancelled) setCorrectionUpdatedAt(d); }, () => {});
    return () => { cancelled = true; };
  }, [correctionId, libraryKits.length]);

  if (!correctionId || fromCorrecteur) return null;

  if (libraryKits.length === 0) {
    return (
      <div style={box}>
        Activité reliée : au premier « Corriger avec Claude », le barème est repris des copies déjà corrigées
        de la classe, ou lu dans la correction de l’activité s’il n’y en a pas encore.
      </div>
    );
  }

  const changed = libraryKits.some((k) => correctionChangedSince(k, correctionUpdatedAt));
  const redo = async () => {
    const ok = window.confirm(
      'Refaire le barème depuis la correction de l’activité ?\n\n'
        + 'Le barème actuel est retiré ; le prochain « Corriger avec Claude » en prépare un nouveau. '
        + 'Les notes déjà mises ne bougent pas.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await dropLibraryKits([assessment.id]);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Barème non retiré');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={box}>
      {libraryKits.map((k) => (
        <div key={k.versionKey} style={{ marginBottom: 4 }}>
          <strong style={{ color: 'var(--text)' }}>
            Barème{k.versionKey ? ` (${k.versionKey})` : ''} : {k.lines.length} ligne{k.lines.length > 1 ? 's' : ''}, sur {fr(k.total)}
          </strong>
          {' — '}
          {k.baremeFrom === 'claude' ? 'lu dans la correction de l’activité par Claude, à vérifier.' : 'repris des copies déjà corrigées.'}
          {open && (
            <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {k.lines.map((l, i) => <li key={i}>{l.label} : {fr(l.bareme)}</li>)}
            </ol>
          )}
        </div>
      ))}
      {changed && (
        <div style={{ color: 'var(--warn)', marginTop: 4 }}>
          La correction de l’activité a été modifiée depuis : refais le barème pour en tenir compte.
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={link}>{open ? 'Masquer les lignes' : 'Voir les lignes'}</button>
        <button type="button" onClick={() => { void redo(); }} disabled={busy} style={link}>Refaire le barème</button>
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 10, padding: 10, marginBottom: 8,
  background: 'var(--surface-3)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45,
};
const link: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  color: 'var(--indigo-ink)', fontFamily: 'inherit',
};
