import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { levelFromClassName } from '../lib/boardsQueries';
import { relinkTargets, type RelinkTarget } from '../lib/columnHeader';
import { shortDate } from '../lib/carnetView';
import {
  detachFromSeries,
  effectiveDocPath,
  linkAssessmentToTarget,
  type AssessmentRow,
} from '../lib/evaluationQueries';

/**
 * « Relier à une autre classe » (en-têtes du carnet) : la même éval passée par plusieurs
 * classes forme une série, pour comparer les notes et partager sujet et corrigé. Les notes ne
 * bougent pas ; une éval déjà en série peut en sortir (« Détacher »).
 */
export function RelinkDialog({
  assessment,
  all,
  userId,
  preselect,
  onDismissSuggestion,
  onClose,
  onChanged,
}: {
  assessment: AssessmentRow;
  /** Toutes les évals de l'année (toutes classes) : les cibles possibles. */
  all: AssessmentRow[];
  userId: string;
  /** Cible à cocher d'office (suggestion « même nom »). */
  preselect?: string | null;
  /** Suggestion « même nom » : « Ce n'est pas la même éval » la fait taire. */
  onDismissSuggestion?: () => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const targets = useMemo(() => relinkTargets(assessment, all), [assessment, all]);
  // Déjà en série : rien de coché d'office, un clic distrait ne doit pas la changer de série.
  const [picked, setPicked] = useState<string | null>(preselect ?? (assessment.series_id ? null : targets[0]?.key ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cls = assessment.classes?.name ?? 'cette classe';
  const target = targets.find((t) => t.key === picked) ?? null;
  const currentSeries = assessment.series_id
    ? all.filter((a) => a.series_id === assessment.series_id && a.id !== assessment.id).map((a) => a.classes?.name ?? '?').sort()
    : [];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opération impossible');
      setBusy(false);
    }
  };

  const link = (t: RelinkTarget) => run(() => linkAssessmentToTarget({
    userId,
    assessmentId: assessment.id,
    target: t,
    level: levelFromClassName(assessment.classes?.name ?? ''),
    schoolYear: assessment.school_year,
  }));

  const detach = () => {
    if (!window.confirm(`Sortir ${cls} de la série ? Ses notes, son sujet et son corrigé restent ; la comparaison avec ${currentSeries.join(', ')} s'arrête.`)) return;
    void run(() => detachFromSeries(assessment.id));
  };

  const bareme = Number(assessment.bareme_total ?? 20);
  const coef = Number(assessment.coefficient);
  const ownSubject = !!assessment.subject_path || !!assessment.correction_path;
  const targetHasDocs = target
    ? all.some((a) => target.assessmentIds.includes(a.id) && (effectiveDocPath(a, 'subject') || effectiveDocPath(a, 'correction')))
    : false;

  return (
    <Modal isOpen onClose={onClose} title={`Relier ${cls} à une autre classe`} size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          La même éval passée par plusieurs classes : les notes se comparent, le sujet et le corrigé se partagent.
        </div>

        {currentSeries.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-3)' }}>
            <span style={{ flex: 1 }}>Déjà reliée à <strong>{currentSeries.join(', ')}</strong>.</span>
            <button onClick={detach} disabled={busy} style={btn}>Détacher {cls}</button>
          </div>
        )}

        {targets.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', padding: '10px 0' }}>
            Aucune éval du même type et du même niveau dans tes autres classes cette année.
          </div>
        ) : (
          <div role="radiogroup" aria-label="Éval à rejoindre" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {targets.map((t) => {
              const on = t.key === picked;
              return (
                <label key={t.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: on ? '2px solid var(--indigo)' : '1px solid var(--border)', background: on ? 'var(--indigo-soft)' : 'var(--surface)' }}>
                  <input type="radio" name="relink" checked={on} onChange={() => setPicked(t.key)} style={{ marginTop: 3 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{t.name}</strong>
                      {t.sameName && <span style={{ padding: '1px 8px', borderRadius: 999, background: 'var(--indigo)', color: '#fff', fontSize: 11, fontWeight: 700 }}>même nom</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {t.seriesId ? `Série ${t.classNames.join(' · ')}` : `${t.classNames[0]} seule`}
                      {` · /${String(t.bareme).replace('.', ',')} · coef ${String(t.coefficient).replace('.', ',')}`}
                      {t.date ? ` · ${shortDate(t.date)}` : ''}
                      {t.period !== assessment.period && t.period ? ` · T${t.period}` : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {target && (
          <div style={{ borderRadius: 10, background: 'var(--surface-3)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700 }}>Ce qui se passe</div>
            <div>✓ Les notes de {cls} restent telles quelles ; seule la comparaison entre classes change.</div>
            {target.bareme === bareme && target.coefficient === coef
              ? <div>✓ Même barème et même coefficient : rien à convertir.</div>
              : <div style={{ color: 'var(--warn)' }}>! {target.bareme !== bareme ? `Barème différent (/${bareme} ici, /${target.bareme} là-bas)` : ''}{target.bareme !== bareme && target.coefficient !== coef ? ' et ' : ''}{target.coefficient !== coef ? `coefficient différent (${coef} ici, ${target.coefficient} là-bas)` : ''} : chaque classe garde le sien, la comparaison se fait sur 20. « Modifier » dans la fiche pour aligner.</div>}
            {ownSubject
              ? <div>• {cls} garde son propre sujet et son propre corrigé.</div>
              : targetHasDocs
                ? <div>• {cls} reçoit le sujet et le corrigé de la série.</div>
                : null}
            {!target.seriesId && <div>• Une série est créée pour {target.classNames[0]} et {cls}.</div>}
            <div style={{ color: 'var(--text-muted)' }}>↺ Réversible : « Relier à une autre classe… » puis « Détacher ».</div>
          </div>
        )}

        {error && <div style={{ color: 'var(--neg)', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {onDismissSuggestion && (
            <button onClick={onDismissSuggestion} style={{ ...btn, marginRight: 'auto', background: 'transparent' }}>
              Ce n’est pas la même éval
            </button>
          )}
          <button onClick={onClose} style={btn}>Annuler</button>
          <button
            onClick={() => { if (target) void link(target); }}
            disabled={!target || busy}
            style={{ ...btn, background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)', opacity: !target || busy ? 0.55 : 1 }}
          >
            {busy ? 'Enregistrement…' : `Relier ${cls}`}
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
