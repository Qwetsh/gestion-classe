import { Link } from 'react-router-dom';
import { ClassChip } from '../../design-system';
import { useHomeData } from '../HomeDataContext';
import { formatDate, getClassColor, getClassLabel } from '../homeHelpers';

export function RecentSessionsModule() {
  const { recentSessions, classNames } = useHomeData();

  return (
    <div className="dash__card home-card">
      <div className="dash__card-head">
        <div>
          <h2 className="dash__card-title">Séances récentes</h2>
        </div>
        <Link to="/sessions" className="dash__card-link">Tout l'historique →</Link>
      </div>

      {recentSessions.length === 0 ? (
        <div className="home-card__body" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 13 }}>Aucune séance récente</p>
        </div>
      ) : (
        // Direction C : date · classe · séance · bilan, une ligne de 40 px, la classe n'est plus écrite deux fois
        <div className="home-card__body dash__sessions">
          <div className="dash__srow dash__srow--head rf-srow">
            <span>Date</span>
            <span>Classe</span>
            <span>Séance</span>
            <span className="rf-srow__right">Bilan</span>
          </div>
          {recentSessions.map((session) => {
            const color = getClassColor(session.class_name, classNames);
            return (
              <Link key={session.id} to={`/sessions/${session.id}`} className="dash__srow rf-srow">
                <span className="dash__srow-date">{formatDate(session.started_at)}</span>
                <span><ClassChip label={getClassLabel(session.class_name)} color={color} size={26} /></span>
                <span className="rf-srow__topic">{session.topic || session.class_name}</span>
                <span className="dash__srow-badges rf-srow__right">
                  {session.pos_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--pos">+{session.pos_count}</span>
                  )}
                  {session.neg_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--neg">−{session.neg_count}</span>
                  )}
                  {session.abs_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--abs">{session.abs_count} abs</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
