import { ChevronRight } from 'lucide-react';
import { formatGrade } from '../../lib/gradeStats';
import { ordinal, type DashboardData } from '../../lib/studentDashboard';

const plural = (n: number, word: string): string => (n > 1 ? `${word}s` : word);

/** Les dix premières notes, sans nom : l'élève n'y reconnaît que sa propre ligne. */
function TopTen({ rank, top10, grade }: { rank: number; top10: { rank: number; grade: number }[]; grade: number }) {
  const inTop = rank <= 10;
  return (
    <div className="el-fold__body el-rank">
      {top10.map((entry, i) => {
        const me = entry.rank === rank && Math.abs(entry.grade - grade) < 0.05;
        return (
          <div key={i} className={me ? 'el-rank__line el-rank__line--me' : 'el-rank__line'}>
            <span>{ordinal(entry.rank)}{me ? ' · toi' : ''}</span>
            <span>{formatGrade(entry.grade)}</span>
          </div>
        );
      })}
      {!inTop && (
        <>
          <span className="el-rank__gap" aria-hidden>…</span>
          <div className="el-rank__line el-rank__line--me">
            <span>{ordinal(rank)} · toi</span>
            <span>{formatGrade(grade)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La note d'implication de l'élève (participation en classe) et ses classements. Les classements
 * tiennent en une ligne chacun ; le détail s'ouvre à la demande.
 */
export function StudentImplication({ data }: { data: DashboardData }) {
  const reached = data.target > 0 ? Math.min(100, Math.round((data.participations / data.target) * 100)) : 0;
  return (
    <>
      <div className="el-card el-card--stack">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="el-label">Ma note d’implication</span>
          <span className="el-big">{formatGrade(data.grade)}<span className="el-unit" style={{ fontSize: 15 }}> /20</span></span>
        </div>
        {data.target > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="el-bar" role="img" aria-label={`${data.participations} implications sur ${data.target}`}>
              <span style={{ width: `${reached}%` }} />
            </div>
            <span className="el-label">{data.participations} {plural(data.participations, 'implication')} sur les {data.target} visées</span>
          </div>
        )}
      </div>

      <div className="el-grid3">
        <div className="el-card el-stat">
          <span className="el-mid" style={{ color: 'var(--el-pos)' }}>{data.participations}</span>
          <span className="el-label">{plural(data.participations, 'Implication')}</span>
        </div>
        <div className="el-card el-stat">
          <span className="el-mid" style={{ color: 'var(--el-warn)' }}>{data.malus}</span>
          <span className="el-label">Malus</span>
        </div>
        <div className="el-card el-stat">
          <span className="el-mid" style={{ color: 'var(--el-muted)' }}>{data.absences}</span>
          <span className="el-label">{plural(data.absences, 'Absence')}</span>
        </div>
      </div>

      <section className="el-section">
        <h2 className="el-h2">Classements</h2>
        <div className="el-card">
          <details className="el-fold">
            <summary className="el-row">
              <span className="el-row__body">
                <span className="el-row__title">Dans ma classe</span>
                <span className="el-row__meta">Voir les dix premières notes</span>
              </span>
              <span className="el-row__end" style={{ fontSize: 17 }}>{ordinal(data.class_rank)}<span className="el-unit">sur {data.class_total}</span></span>
              <ChevronRight size={20} className="el-row__chev" aria-hidden />
            </summary>
            <TopTen rank={data.class_rank} top10={data.top10_class} grade={data.grade} />
          </details>
          <details className="el-fold">
            <summary className="el-row">
              <span className="el-row__body">
                <span className="el-row__title">Toutes classes confondues</span>
                <span className="el-row__meta">Voir les dix premières notes</span>
              </span>
              <span className="el-row__end" style={{ fontSize: 17 }}>{ordinal(data.overall_rank)}<span className="el-unit">sur {data.overall_total}</span></span>
              <ChevronRight size={20} className="el-row__chev" aria-hidden />
            </summary>
            <TopTen rank={data.overall_rank} top10={data.top10_overall} grade={data.grade} />
          </details>
          {data.all_classes_ranking.length > 1 && (
            <details className="el-fold">
              <summary className="el-row">
                <span className="el-row__body">
                  <span className="el-row__title">Ma classe parmi les autres</span>
                  <span className="el-row__meta">Moyenne de la {data.class_name} : {formatGrade(data.my_class_avg)}</span>
                </span>
                <span className="el-row__end" style={{ fontSize: 17 }}>{ordinal(data.my_class_rank_among_classes)}<span className="el-unit">sur {data.total_classes}</span></span>
                <ChevronRight size={20} className="el-row__chev" aria-hidden />
              </summary>
              <div className="el-fold__body el-rank">
                {data.all_classes_ranking.map((entry, i) => {
                  const mine = entry.class_name === data.class_name;
                  return (
                    <div key={i} className={mine ? 'el-rank__line el-rank__line--me' : 'el-rank__line'}>
                      <span>{ordinal(entry.rank)} · {entry.class_name}</span>
                      <span>{formatGrade(entry.avg_grade)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </section>
    </>
  );
}
