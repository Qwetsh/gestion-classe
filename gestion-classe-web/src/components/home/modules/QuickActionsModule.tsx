import { Link } from 'react-router-dom';
import { useHomeData } from '../HomeDataContext';
import { QuickIcon } from '../homeHelpers';

export function QuickActionsModule() {
  const { classes, openBoard } = useHomeData();

  return (
    <div className="dash__quick-block">
      <div className="dash__eyebrow">Raccourcis</div>
      <div className="dash__quick">
        <Link to="/group-sessions" className="dash__quick-card">
          <span className="dash__quick-ic dash__quick-ic--indigo"><QuickIcon name="group" /></span>
          <span className="dash__quick-text">
            <span className="dash__quick-title">Groupes</span>
            <span className="dash__quick-sub">Sessions de groupe</span>
          </span>
        </Link>

        <button type="button" onClick={openBoard} className="dash__quick-card dash__quick-card--dark">
          <span className="dash__quick-ic dash__quick-ic--light"><QuickIcon name="pen" /></span>
          <span className="dash__quick-text">
            <span className="dash__quick-title">Tableau blanc</span>
            <span className="dash__quick-sub">Ardoise libre, sans séance</span>
          </span>
        </button>

        <Link to="/tools" className="dash__quick-card">
          <span className="dash__quick-ic dash__quick-ic--pink"><QuickIcon name="wrench" /></span>
          <span className="dash__quick-text">
            <span className="dash__quick-title">Outils</span>
            <span className="dash__quick-sub">Boîte à outils</span>
          </span>
        </Link>

        <Link to="/students" className="dash__quick-card">
          <span className="dash__quick-ic dash__quick-ic--green"><QuickIcon name="students" /></span>
          <span className="dash__quick-text">
            <span className="dash__quick-title">Suivi élèves</span>
            <span className="dash__quick-sub">Notes d'implication</span>
          </span>
        </Link>

        <Link to="/classes" className="dash__quick-card">
          <span className="dash__quick-ic dash__quick-ic--blue"><QuickIcon name="grid" /></span>
          <span className="dash__quick-text">
            <span className="dash__quick-title">Plans de classe</span>
            <span className="dash__quick-sub">{classes.length} classe{classes.length > 1 ? 's' : ''}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
