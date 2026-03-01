/**
 * Event type configuration - shared across components
 */
export const EVENT_CONFIG: Record<string, {
  label: string;
  color: string;
  softColor: string;
  icon: string
}> = {
  participation: {
    label: 'Implication',
    color: 'var(--color-participation)',
    softColor: 'var(--color-participation-soft)',
    icon: '+'
  },
  bavardage: {
    label: 'Bavardage',
    color: 'var(--color-bavardage)',
    softColor: 'var(--color-bavardage-soft)',
    icon: '-'
  },
  absence: {
    label: 'Absence',
    color: 'var(--color-absence)',
    softColor: 'var(--color-absence-soft)',
    icon: 'A'
  },
  remarque: {
    label: 'Remarque',
    color: 'var(--color-remarque)',
    softColor: 'var(--color-remarque-soft)',
    icon: '!'
  },
  sortie: {
    label: 'Sortie',
    color: 'var(--color-sortie)',
    softColor: 'var(--color-sortie-soft)',
    icon: 'S'
  },
};

/**
 * Class gradient colors for visual differentiation
 */
export const CLASS_GRADIENTS = [
  'linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)',
  'linear-gradient(135deg, #81C784 0%, #66BB6A 100%)',
  'linear-gradient(135deg, #9575CD 0%, #7E57C2 100%)',
  'linear-gradient(135deg, #FFB74D 0%, #FFA726 100%)',
  'linear-gradient(135deg, #E57373 0%, #EF5350 100%)',
  'linear-gradient(135deg, #4DB6AC 0%, #26A69A 100%)',
];

/**
 * Get a consistent gradient color for a class name
 */
export function getClassGradient(className: string): string {
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLASS_GRADIENTS[Math.abs(hash) % CLASS_GRADIENTS.length];
}

/**
 * Get initials from a class name (max 2 chars)
 */
export function getClassInitials(className: string): string {
  return className
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Room grid configuration limits
 */
export const ROOM_GRID = {
  MIN_ROWS: 1,
  MAX_ROWS: 10,
  MIN_COLS: 1,
  MAX_COLS: 12,
  DEFAULT_ROWS: 5,
  DEFAULT_COLS: 6,
} as const;

/**
 * Grade calculation configuration
 */
export const GRADE_CONFIG = {
  DEFAULT_TARGET_PARTICIPATIONS: 15,
  DEFAULT_SESSIONS_EXPECTED: 60,
  MIN_GRADE: 0,
  MAX_GRADE: 20,
} as const;

/**
 * Oral evaluation grade labels
 */
export const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Tres bien',
};

/**
 * Get current school year (format: "2024-2025")
 */
export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // School year starts in September (month 8)
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate pseudo format (alphanumeric + spaces, 2-50 chars)
 */
export function isValidPseudo(pseudo: string): boolean {
  if (!pseudo || pseudo.length < 2 || pseudo.length > 50) return false;
  // Allow letters (including accented), numbers, spaces, hyphens
  return /^[\p{L}\p{N}\s\-']+$/u.test(pseudo);
}
