/**
 * Security utilities for sanitizing user input
 */

/**
 * Validates and sanitizes a photo path to prevent XSS and path traversal attacks
 *
 * Safe paths:
 * - user-id/event-id/photo.jpg
 * - 123e4567-e89b-12d3-a456-426614174000/image.png
 *
 * Unsafe paths (will return null):
 * - ../../../etc/passwd (path traversal)
 * - javascript:alert(1) (XSS)
 * - https://evil.com/malware.jpg (external URLs)
 * - <script>alert(1)</script>.jpg (HTML injection)
 */
export function sanitizePhotoPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = path.trim();

  // Reject empty strings
  if (trimmed.length === 0) {
    return null;
  }

  // Reject paths that are too long (prevent DoS)
  if (trimmed.length > 500) {
    console.warn('[Security] Photo path too long, rejecting');
    return null;
  }

  // Reject directory traversal attempts
  if (trimmed.includes('..')) {
    console.warn('[Security] Directory traversal attempt detected:', trimmed);
    return null;
  }

  // Reject absolute URLs (http://, https://, javascript:, data:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    console.warn('[Security] Protocol in path detected:', trimmed);
    return null;
  }

  // Reject paths starting with / (absolute paths)
  if (trimmed.startsWith('/')) {
    console.warn('[Security] Absolute path detected:', trimmed);
    return null;
  }

  // Reject HTML/script injection attempts
  if (/<[^>]*>/i.test(trimmed)) {
    console.warn('[Security] HTML injection attempt detected:', trimmed);
    return null;
  }

  // Only allow safe characters: alphanumeric, hyphens, underscores, periods, forward slashes
  // UUID format: 8-4-4-4-12 hex chars with hyphens
  const safePattern = /^[a-zA-Z0-9._/-]+$/;
  if (!safePattern.test(trimmed)) {
    console.warn('[Security] Unsafe characters in photo path:', trimmed);
    return null;
  }

  return trimmed;
}

/**
 * Builds a safe photo URL from a photo path
 * Returns null if the path is invalid
 */
export function buildPhotoUrl(photoPath: string | null | undefined, supabaseUrl: string): string | null {
  const safePath = sanitizePhotoPath(photoPath);
  if (!safePath) {
    return null;
  }

  // Double-encode the path to prevent injection in URL
  const encodedPath = encodeURIComponent(safePath);

  return `${supabaseUrl}/storage/v1/object/public/student-photos/${encodedPath}`;
}

// ============================================
// Input Validation Utilities
// ============================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validation limits for various input fields
 */
export const INPUT_LIMITS = {
  CLASS_NAME_MIN: 1,
  CLASS_NAME_MAX: 100,
  ROOM_NAME_MIN: 1,
  ROOM_NAME_MAX: 100,
  STUDENT_PSEUDO_MIN: 2,
  STUDENT_PSEUDO_MAX: 50,
  SESSION_TOPIC_MAX: 200,
  NOTE_MAX: 1000,
  GRID_ROWS_MIN: 1,
  GRID_ROWS_MAX: 10,
  GRID_COLS_MIN: 1,
  GRID_COLS_MAX: 12,
} as const;

/**
 * Validates a class name
 */
export function validateClassName(name: string | null | undefined): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Le nom de la classe est requis' };
  }

  const trimmed = name.trim();

  if (trimmed.length < INPUT_LIMITS.CLASS_NAME_MIN) {
    return { isValid: false, error: 'Le nom de la classe est requis' };
  }

  if (trimmed.length > INPUT_LIMITS.CLASS_NAME_MAX) {
    return { isValid: false, error: `Le nom ne peut pas depasser ${INPUT_LIMITS.CLASS_NAME_MAX} caracteres` };
  }

  // Check for potentially dangerous characters (very permissive, just block obvious issues)
  if (/<script|javascript:|data:/i.test(trimmed)) {
    return { isValid: false, error: 'Caracteres non autorises dans le nom' };
  }

  return { isValid: true };
}

/**
 * Validates a room name
 */
export function validateRoomName(name: string | null | undefined): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Le nom de la salle est requis' };
  }

  const trimmed = name.trim();

  if (trimmed.length < INPUT_LIMITS.ROOM_NAME_MIN) {
    return { isValid: false, error: 'Le nom de la salle est requis' };
  }

  if (trimmed.length > INPUT_LIMITS.ROOM_NAME_MAX) {
    return { isValid: false, error: `Le nom ne peut pas depasser ${INPUT_LIMITS.ROOM_NAME_MAX} caracteres` };
  }

  if (/<script|javascript:|data:/i.test(trimmed)) {
    return { isValid: false, error: 'Caracteres non autorises dans le nom' };
  }

  return { isValid: true };
}

/**
 * Validates grid dimensions
 */
export function validateGridDimensions(rows: number, cols: number): ValidationResult {
  if (!Number.isInteger(rows) || rows < INPUT_LIMITS.GRID_ROWS_MIN || rows > INPUT_LIMITS.GRID_ROWS_MAX) {
    return { isValid: false, error: `Le nombre de rangees doit etre entre ${INPUT_LIMITS.GRID_ROWS_MIN} et ${INPUT_LIMITS.GRID_ROWS_MAX}` };
  }

  if (!Number.isInteger(cols) || cols < INPUT_LIMITS.GRID_COLS_MIN || cols > INPUT_LIMITS.GRID_COLS_MAX) {
    return { isValid: false, error: `Le nombre de colonnes doit etre entre ${INPUT_LIMITS.GRID_COLS_MIN} et ${INPUT_LIMITS.GRID_COLS_MAX}` };
  }

  return { isValid: true };
}

/**
 * Validates a session topic
 */
export function validateSessionTopic(topic: string | null | undefined): ValidationResult {
  // Topic is optional
  if (!topic || typeof topic !== 'string') {
    return { isValid: true };
  }

  const trimmed = topic.trim();

  if (trimmed.length > INPUT_LIMITS.SESSION_TOPIC_MAX) {
    return { isValid: false, error: `Le theme ne peut pas depasser ${INPUT_LIMITS.SESSION_TOPIC_MAX} caracteres` };
  }

  return { isValid: true };
}

/**
 * Validates a note/remark text
 */
export function validateNote(note: string | null | undefined): ValidationResult {
  // Note is optional
  if (!note || typeof note !== 'string') {
    return { isValid: true };
  }

  const trimmed = note.trim();

  if (trimmed.length > INPUT_LIMITS.NOTE_MAX) {
    return { isValid: false, error: `La remarque ne peut pas depasser ${INPUT_LIMITS.NOTE_MAX} caracteres` };
  }

  return { isValid: true };
}
