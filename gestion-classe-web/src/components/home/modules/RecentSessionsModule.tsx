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
          <p className="dash__card-sub">10 derniers jours · {recentSessions.length} séances</p>
        </div>
        <Link to="/sessions" className="dash__card-link">Tout l'historique →</Link>
      </div>

      {recentSessions.length === 0 ? (
        <div className="home-card__body" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 13 }}>Aucune séance récente</p>
        </div>
      ) : (
        <div className="home-card__body dash__sessions">
          <div className="dash__srow dash__srow--head">
            <span>Classe</span>
            <span>Bonus · malus · absences</span>
            <span style={{ textAlign: 'right' }}>Événements</span>
            <span />
          </div>
          {recentSessions.map((session) => {
            const color = getClassColor(session.class_name, classNames);
            return (
              <Link key={session.id} to={`/sessions/${session.id}`} className="dash__srow">
                <span className="dash__srow-class">
                  <ClassChip label={getClassLabel(session.class_name)} color={color} size={30} />
                  <span style={{ minWidth: 0 }}>
                    <span className="dash__srow-name">{session.class_name}</span>
                    <span className="dash__srow-date">{formatDate(session.started_at)}</span>
                  </span>
                </span>
                <span className="dash__srow-badges">
                  {session.pos_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--pos">+{session.pos_count}</span>
                  )}
                  {session.neg_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--neg">-{session.neg_count}</span>
                  )}
                  {session.abs_count > 0 && (
                    <span className="dash__evt-badge dash__evt-badge--abs">{session.abs_count}abs</span>
                  )}
                </span>
                <span className="dash__srow-count">{session.events_count}</span>
                <span className="dash__chevron">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
