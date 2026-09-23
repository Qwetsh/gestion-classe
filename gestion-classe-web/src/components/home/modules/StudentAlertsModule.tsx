import { Link } from 'react-router-dom';
import { useHomeData } from '../HomeDataContext';
import { getClassLabel, getInitials } from '../homeHelpers';

export function StudentAlertsModule() {
  const { studentAlerts } = useHomeData();

  return (
    <div className="dash__card home-card">
      <div className="dash__card-head">
        <div>
          <h2 className="dash__card-title">À regarder avant demain</h2>
          <p className="dash__card-sub">Élèves qui décrochent ou multiplient les absences</p>
        </div>
        <Link to="/students" className="dash__card-link">Voir tous →</Link>
      </div>

      <div className="home-card__body dash__alerts">
        {studentAlerts.map((alert) => (
          <Link key={alert.id} to="/students" className="dash__alert-row">
            <span className="dash__avatar">{getInitials(alert.pseudo)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dash__alert-name">{alert.pseudo}</div>
              <div className="dash__alert-reason">
                [{getClassLabel(alert.class_name)}] · {alert.reason}
              </div>
            </div>
            <div className="dash__alert-grade">
              {alert.grade.toFixed(1).replace('.', ',')}<span className="dash__alert-grade-unit">/20</span>
            </div>
            <span className="dash__chevron">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
