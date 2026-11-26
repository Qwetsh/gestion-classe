import { classGroupColor } from '../../lib/classGroupColors';
import type { ClassGroupInfo } from '../../lib/classGroupQueries';

interface PlanScopeBarProps {
  groups: ClassGroupInfo[];
  /** Effectif de chaque groupe (identifiant → nombre d'élèves). */
  sizes: Record<string, number>;
  classSize: number;
  /** Groupe dont on édite le plan ; `null` = classe entière. */
  value: string | null;
  onChange: (groupId: string | null) => void;
  /** Le groupe choisi a-t-il au moins un élève placé dans cette salle ? */
  groupPlanIsEmpty: boolean;
  onCopyFromClass: () => void;
}

/**
 * Choix du plan édité dans la page Classes : celui de la classe entière, ou celui d'un groupe de
 * classe. Sans plan propre, une séance en demi-groupe montre le plan de la classe entière, où les
 * places de l'autre groupe restent vides.
 */
export function PlanScopeBar({ groups, sizes, classSize, value, onChange, groupPlanIsEmpty, onCopyFromClass }: PlanScopeBarProps) {
  const chip = (selected: boolean, color: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${selected ? color : 'var(--border)'}`,
    background: selected ? color : 'var(--surface)',
    color: selected ? '#fff' : 'var(--text)',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Plan de</span>
      <button type="button" onClick={() => onChange(null)} style={chip(value === null, 'var(--indigo)')}>
        Classe entière <span style={{ opacity: 0.75, fontWeight: 400 }}>{classSize}</span>
      </button>
      {groups.map((group, index) => {
        const color = classGroupColor(group.color, index).main;
        const selected = value === group.id;
        return (
          <button key={group.id} type="button" onClick={() => onChange(group.id)} style={chip(selected, color)}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: selected ? '#fff' : color }} />
            {group.name} <span style={{ opacity: 0.75, fontWeight: 400 }}>{sizes[group.id] ?? 0}</span>
          </button>
        );
      })}
      {value !== null && groupPlanIsEmpty && (
        <>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Pas encore de plan pour ce groupe : en séance, celui de la classe entière s’affiche.
          </span>
          <button type="button" onClick={onCopyFromClass} className="btn btn--ghost" style={{ fontSize: 12 }}>
            Partir du plan de la classe entière
          </button>
        </>
      )}
    </div>
  );
}
