import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomeData } from '../HomeDataContext';
import { makeupsForLesson } from '../../../lib/timetable/makeupReminders';
import type { PlacedLesson } from '../../../lib/timetable/weekView';
import { useUIFeedback } from '../../../contexts/UIFeedbackContext';

/**
 * Section « À faire rattraper » du détail d'un cours (migration 066) : les évals écrites dont
 * des élèves étaient absents, rappelées sur le prochain cours de la classe. La liste suit les
 * rattrapages toute seule (copie scannée ou note saisie) ; « Ne plus rappeler » clôt une éval.
 */
export function MakeupReminderSection({ lesson, now }: { lesson: PlacedLesson; now: Date }) {
  const { placeMakeupsAt, dismissMakeup } = useHomeData();
  const { toast, confirm } = useUIFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const reminders = useMemo(() => makeupsForLesson(placeMakeupsAt(now), lesson), [placeMakeupsAt, now, lesson]);
  if (reminders.length === 0) return null;

  const current = lesson.start <= now && lesson.end > now;

  const stop = async (assessmentId: string, name: string) => {
    const ok = await confirm({
      title: 'Ne plus rappeler ce rattrapage ?',
      message: `Le rappel de « ${name} » disparaîtra de toutes les séances. Les absences restent notées dans le carnet.`,
      confirmLabel: 'Ne plus rappeler',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(assessmentId);
    try {
      await dismissMakeup(assessmentId);
    } catch (err) {
      console.error(err);
      toast('Impossible de couper le rappel.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`wtt-pop__section wtt-pop__section--makeup ${current ? 'wtt-pop__section--note-live' : ''}`}>
      <div className="wtt-pop__label">À faire rattraper</div>
      {reminders.map(r => (
        <div key={r.assessmentId} className="wtt-pop__makeup">
          <div className="wtt-pop__note">
            Faire reprendre l'éval{' '}
            <Link to={`/evaluations/${r.assessmentId}`} className="wtt-pop__makeup-eval">{r.assessmentName}</Link>
            {' '}({r.assessmentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}) à :{' '}
            <strong>{r.students.map(s => s.pseudo).join(', ')}</strong>
          </div>
          <button
            type="button"
            className="wtt__link"
            style={{ alignSelf: 'flex-start' }}
            disabled={busy === r.assessmentId}
            onClick={() => stop(r.assessmentId, r.assessmentName)}
            title="Ne plus afficher ce rappel, sur aucune séance"
          >
            Ne plus rappeler
          </button>
        </div>
      ))}
    </div>
  );
}
