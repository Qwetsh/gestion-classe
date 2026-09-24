import { Link } from 'react-router-dom';
import { useSettings } from '../../../contexts/SettingsContext';
import { useHomeData } from '../HomeDataContext';

export function KpiImplicationModule() {
  const { avgImplication } = useHomeData();
  const { settings } = useSettings();
  return (
    <div className="dash__kpi">
      <div className="dash__kpi-label">Moyenne d'implication</div>
      <div className="dash__kpi-value">
        {avgImplication.toFixed(1).replace('.', ',')}<span className="dash__kpi-unit">/20</span>
      </div>
      <div className="dash__kpi-hint">T{settings.schoolYear.trimestre} en cours</div>
    </div>
  );
}

export function KpiAlertsModule() {
  const { alertCount } = useHomeData();
  return (
    <div className="dash__kpi dash__kpi--warn">
      <div className="dash__kpi-label">
        Élèves à suivre
        {alertCount > 0 && <Link to="/students" className="dash__kpi-link">Voir</Link>}
      </div>
      <div className="dash__kpi-value" style={{ color: alertCount > 0 ? 'var(--accent-ink)' : 'var(--pos)' }}>
        {alertCount}
      </div>
      <div className="dash__kpi-hint">
        {alertCount > 0 ? 'Décrochage ou absences répétées' : 'Rien à signaler'}
      </div>
    </div>
  );
}

export function KpiSessionsModule() {
  const { weekSessionsCount, weekSessionsDone, weekSessionsUpcoming } = useHomeData();
  const pct = weekSessionsCount === 0 ? 0 : Math.round((weekSessionsDone / weekSessionsCount) * 100);
  return (
    <div className="dash__kpi">
      <div className="dash__kpi-label">Séances de la semaine</div>
      <div className="dash__kpi-value">
        {weekSessionsCount}<span className="dash__kpi-unit">stable</span>
      </div>
      <div className="dash__kpi-progress">
        <div className="dash__kpi-bar">
          <div className="dash__kpi-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="dash__kpi-hint">{weekSessionsDone} faites · {weekSessionsUpcoming} à venir</span>
      </div>
    </div>
  );
}
