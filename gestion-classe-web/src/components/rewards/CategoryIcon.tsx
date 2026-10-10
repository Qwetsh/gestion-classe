import type { CSSProperties } from 'react';
import { parseIconRef } from '../../lib/rewardIcons';

/**
 * Icône d'une catégorie de tampon, quelle que soit sa forme : icône Lucide (`lucide:Nom`), image importée
 * (URL) ou emoji de repli. Sert partout où une catégorie s'affiche : paramétrage, cartes, espace élève.
 *
 * `size` est la taille du glyphe en pixels ; `color` ne s'applique qu'aux icônes Lucide (trait).
 */
export function CategoryIcon({
  icon, iconRef, size = 20, color, strokeWidth = 2.2, className, style, title,
}: {
  /** Emoji de repli (toujours renseigné en base). */
  icon: string | null | undefined;
  /** Icône riche optionnelle. */
  iconRef?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const parsed = parseIconRef(iconRef);
  if (parsed?.kind === 'lucide' && parsed.def) {
    const Icon = parsed.def.Icon;
    return <Icon size={size} color={color ?? 'currentColor'} strokeWidth={strokeWidth} className={className} style={{ flexShrink: 0, ...style }} aria-label={title} />;
  }
  if (parsed?.kind === 'image') {
    return (
      <img
        src={parsed.url}
        alt={title ?? ''}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'inline-block', ...style }}
        loading="lazy"
        draggable={false}
      />
    );
  }
  return (
    <span className={className} title={title} aria-hidden={!title} style={{ fontSize: size * 0.9, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0, ...style }}>
      {icon || '⭐'}
    </span>
  );
}
