import { ChevronRight, FlaskConical, Gift, LogOut } from 'lucide-react';
import { formatGrade } from '../../lib/gradeStats';
import type { StudentAssessment } from '../../lib/studentGrades';
import type { StudentThemeId } from '../../lib/studentThemes';
import type { StudentTpItem } from '../../lib/studentTp';
import { StudentThemePicker } from './StudentThemePicker';
import { ordinal, type DashboardData } from '../../lib/studentDashboard';

interface Props {
  data: DashboardData;
  /** TP en cours de l'élève, s'il y en a un. */
  activeTp: StudentTpItem | null;
  onOpenTp: () => void;
  /** Dernière évaluation notée (onglet Notes ouvert à la classe), sinon null. */
  lastGrade: StudentAssessment | null;
  /** Tampons de la carte en cours ; null si la classe n'a pas les tampons. */
  stampCount: number | null;
  /** La carte est pleine et un bonus attend d'être choisi. */
  bonusToPick: boolean;
  onOpenMarks: () => void;
  onOpenImplication: () => void;
  onOpenStamps: () => void;
  onLogout: () => void;
  /** Thème de l'espace et son changement. */
  theme: StudentThemeId;
  onTheme: (id: StudentThemeId) => void;
}

const hourOf = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

const listOf = (names: string[]): string => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`);

/**
 * Accueil de l'espace élève : d'abord ce qui est à faire (TP en cours, bonus à choisir), puis la
 * dernière note, puis le trimestre en trois chiffres. Une section sans contenu ne s'affiche pas.
 */
export function StudentHome({
  data, activeTp, onOpenTp, lastGrade, stampCount, bonusToPick, onOpenMarks, onOpenImplication, onOpenStamps, onLogout, theme, onTheme,
}: Props) {
  const firstName = data.pseudo.split(' ')[0] || data.pseudo;
  const tpLine = activeTp
    ? activeTp.deposit_open && activeTp.deposit_closes_at
      ? `Dépôt des photos ouvert jusqu’à ${hourOf(activeTp.deposit_closes_at)}`
      : activeTp.mates.length > 0 ? `Avec ${listOf(activeTp.mates)}` : null
    : null;

  return (
    <>
      <div className="el-head">
        <div className="el-head__titles">
          <span className="el-kicker">{data.class_name} · Trimestre {data.trimester}</span>
          <h1 className="el-h1">Bonjour {firstName}</h1>
        </div>
        <button type="button" className="el-btn" onClick={onLogout} style={{ padding: '0 12px', fontSize: 14, color: 'var(--el-muted)' }}>
          <LogOut size={18} aria-hidden /> Quitter
        </button>
      </div>

      {(activeTp || bonusToPick) && (
        <section className="el-section">
          <h2 className="el-h2">À faire</h2>
          {activeTp && (
            <div className="el-card el-card--stack">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className="el-icon-box"><FlaskConical size={22} strokeWidth={1.8} aria-hidden /></span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--el-indigo-ink)' }}>TP en cours · groupe {activeTp.group_name}</span>
                  <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{activeTp.name}</span>
                  {tpLine && <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--el-muted)' }}>{tpLine}</span>}
                </div>
              </div>
              <button type="button" className="el-btn el-btn--primary el-btn--block" onClick={onOpenTp}>
                {activeTp.deposit_open ? 'Déposer une photo' : 'Ouvrir le TP'}
              </button>
            </div>
          )}
          {bonusToPick && (
            <button type="button" className="el-tile" onClick={onOpenStamps}>
              <span className="el-icon-box"><Gift size={22} strokeWidth={1.8} aria-hidden /></span>
              <span className="el-row__body">
                <span className="el-row__title">Ta carte à tampons est pleine</span>
                <span className="el-row__meta">Choisis ton bonus</span>
              </span>
              <ChevronRight size={20} className="el-row__chev" aria-hidden />
            </button>
          )}
        </section>
      )}

      {lastGrade && lastGrade.grade !== null && (
        <section className="el-section">
          <h2 className="el-h2">Dernière note</h2>
          <button type="button" className="el-tile" onClick={onOpenMarks} style={{ padding: '14px 16px' }}>
            <span className="el-row__body">
              <span className="el-row__title">{lastGrade.name}</span>
              {lastGrade.date && (
                <span className="el-row__meta">
                  Évaluation du {new Date(lastGrade.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
              )}
            </span>
            <span className="el-grade">{formatGrade(lastGrade.grade)}<span className="el-unit"> /20</span></span>
          </button>
        </section>
      )}

      <section className="el-section">
        <h2 className="el-h2">Ce trimestre</h2>
        <div className={stampCount === null ? undefined : 'el-grid2'}>
          <button type="button" className="el-card el-stat" onClick={onOpenImplication} style={{ padding: '14px 16px', width: '100%' }}>
            <span className="el-label">Implication</span>
            <span className="el-mid">{formatGrade(data.grade)}<span className="el-unit"> /20</span></span>
          </button>
          {stampCount !== null && (
            <button type="button" className="el-card el-stat" onClick={onOpenStamps} style={{ padding: '14px 16px' }}>
              <span className="el-label">Carte à tampons</span>
              <span className="el-mid">{stampCount}<span className="el-unit"> sur 10</span></span>
            </button>
          )}
        </div>
        <button type="button" className="el-tile" onClick={onOpenImplication}>
          <span className="el-row__body"><span style={{ fontSize: 14, color: 'var(--el-muted)' }}>Classement de la classe</span></span>
          <span className="el-row__end">{ordinal(data.class_rank)} sur {data.class_total}</span>
          <ChevronRight size={18} className="el-row__chev" aria-hidden />
        </button>
      </section>

      <StudentThemePicker value={theme} onChange={onTheme} />
    </>
  );
}
