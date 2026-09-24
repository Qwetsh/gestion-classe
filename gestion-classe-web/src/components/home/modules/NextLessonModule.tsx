import { Link } from 'react-router-dom';
import { ClassChip } from '../../design-system';
import { useHomeData } from '../HomeDataContext';
import { formatTime, getClassColor, getClassLabel } from '../homeHelpers';

export function NextLessonModule() {
  const { nextLesson, classNames } = useHomeData();
  if (!nextLesson) return null;

  return (
    <div className="dash__card dash__next-card">
      <div className="dash__next-header">
        <span className="dash__eyebrow dash__eyebrow--indigo">Prochaine séance</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {nextLesson.startDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <ClassChip
            label={getClassLabel(nextLesson.groupNames[0] || 'C')}
            color={getClassColor(nextLesson.groupNames[0] || '', classNames)}
            size={32}
          />
          <span style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em' }}>
          {formatTime(nextLesson.startDate)}
        </span>
      </div>
      {nextLesson.classrooms.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Salle {nextLesson.classrooms[0]}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link to="/sessions" className="dash__next-btn dash__next-btn--primary">Ouvrir la séance</Link>
        <Link to="/classes" className="dash__next-btn">Plan de classe</Link>
      </div>
    </div>
  );
}
