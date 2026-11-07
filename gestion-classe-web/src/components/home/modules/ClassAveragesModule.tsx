import { ClassChip } from '../../design-system';
import { useSettings } from '../../../contexts/SettingsContext';
import { useHomeData } from '../HomeDataContext';
import { getClassColor, getClassLabel } from '../homeHelpers';

export function ClassAveragesModule() {
  const { classAverages, classNames } = useHomeData();
  const { settings } = useSettings();

  return (
    <div className="dash__card home-card">
      <div className="dash__card-head">
        <h2 className="dash__card-title">Moyenne par classe</h2>
        {/* Le trimestre en repère discret à droite, plus de sous-titre ni de compteur de classes */}
        <span className="rf-card-meta">T{settings.schoolYear.trimestre}</span>
      </div>
      <div className="home-card__body dash__class-avgs">
        {classAverages.slice().sort((a, b) => b.average - a.average).map((ca) => {
          const color = getClassColor(ca.class_name, classNames);
          const pct = (ca.average / 20) * 100;
          // Direction C : barre indigo pour toutes les classes (la teinte de niveau reste sur la puce), rouge sous 8/20
          return (
            <div key={ca.class_id} className="dash__class-avg-row">
              <ClassChip label={getClassLabel(ca.class_name)} color={color} size={24} />
              <div className="dash__class-avg-bar">
                <div className="dash__class-avg-fill" style={{ width: `${pct}%`, background: pct < 40 ? 'var(--neg)' : 'var(--indigo)' }} />
              </div>
              <span className="dash__class-avg-val">{ca.average.toFixed(1).replace('.', ',')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
