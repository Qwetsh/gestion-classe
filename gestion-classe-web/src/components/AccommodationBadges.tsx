import { accommodationTags, accommodationTitle, type StudentAccommodations } from '../lib/accommodations';

interface Props {
  student: StudentAccommodations | null | undefined;
  /** Taille des pastilles : `xs` pour les sièges du plan de classe, `sm` pour les listes. */
  size?: 'xs' | 'sm';
  /** Couleur de fond / de texte (par défaut : indigo Direction B). */
  bg?: string;
  fg?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Pastilles « PAP » / « PPRE » / « PAI » d'un élève. Ne rend rien si aucun dispositif.
 * Aucun détail n'est affiché (seulement le type de dispositif).
 */
export function AccommodationBadges({ student, size = 'sm', bg = '#EEF0FF', fg = '#4F46E5', style, className }: Props) {
  const tags = accommodationTags(student);
  if (tags.length === 0) return null;
  const xs = size === 'xs';
  return (
    <span
      className={className}
      title={accommodationTitle(student)}
      style={{ display: 'inline-flex', gap: xs ? 2 : 3, alignItems: 'center', ...style }}
    >
      {tags.map(tag => (
        <span
          key={tag}
          style={{
            fontSize: xs ? 7 : 9,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '0.02em',
            color: fg,
            background: bg,
            borderRadius: 4,
            padding: xs ? '1px 3px' : '2px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
