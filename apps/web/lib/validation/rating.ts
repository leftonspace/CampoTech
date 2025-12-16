/**
 * Rating Validation Utilities
 * ===========================
 * Validation functions for customer ratings
 */

export interface RatingInput {
  token?: string;
  rating?: number;
  comment?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const RATING_CONSTRAINTS = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_COMMENT_LENGTH: 500,
} as const;

/**
 * Validate rating token
 */
export function validateToken(token: unknown): { valid: boolean; error?: string } {
  if (!token) {
    return { valid: false, error: 'Token requerido' };
  }

  if (typeof token !== 'string') {
    return { valid: false, error: 'Token debe ser texto' };
  }

  if (token.trim().length === 0) {
    return { valid: false, error: 'Token no puede estar vacío' };
  }

  return { valid: true };
}

/**
 * Validate rating value (1-5)
 */
export function validateRating(rating: unknown): { valid: boolean; error?: string } {
  if (rating === undefined || rating === null) {
    return { valid: false, error: 'Calificación requerida' };
  }

  if (typeof rating !== 'number') {
    return { valid: false, error: 'Calificación debe ser un número' };
  }

  if (isNaN(rating)) {
    return { valid: false, error: 'Calificación no válida' };
  }

  if (rating < RATING_CONSTRAINTS.MIN_RATING || rating > RATING_CONSTRAINTS.MAX_RATING) {
    return {
      valid: false,
      error: `Calificación debe ser entre ${RATING_CONSTRAINTS.MIN_RATING} y ${RATING_CONSTRAINTS.MAX_RATING}`
    };
  }

  if (!Number.isInteger(rating)) {
    return { valid: false, error: 'Calificación debe ser un número entero' };
  }

  return { valid: true };
}

/**
 * Validate comment (optional)
 */
export function validateComment(comment: unknown): { valid: boolean; error?: string } {
  // Comment is optional
  if (comment === undefined || comment === null) {
    return { valid: true };
  }

  if (typeof comment !== 'string') {
    return { valid: false, error: 'Comentario debe ser texto' };
  }

  // Empty comments are allowed
  if (comment.trim().length === 0) {
    return { valid: true };
  }

  if (comment.length > RATING_CONSTRAINTS.MAX_COMMENT_LENGTH) {
    return {
      valid: false,
      error: `Comentario no puede superar ${RATING_CONSTRAINTS.MAX_COMMENT_LENGTH} caracteres`
    };
  }

  return { valid: true };
}

/**
 * Sanitize comment (trim and truncate)
 */
export function sanitizeComment(comment: unknown): string | null {
  if (!comment || typeof comment !== 'string') {
    return null;
  }

  const trimmed = comment.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, RATING_CONSTRAINTS.MAX_COMMENT_LENGTH);
}

/**
 * Validate full rating input
 */
export function validateRatingInput(input: RatingInput): ValidationResult {
  const errors: string[] = [];

  const tokenResult = validateToken(input.token);
  if (!tokenResult.valid && tokenResult.error) {
    errors.push(tokenResult.error);
  }

  const ratingResult = validateRating(input.rating);
  if (!ratingResult.valid && ratingResult.error) {
    errors.push(ratingResult.error);
  }

  const commentResult = validateComment(input.comment);
  if (!commentResult.valid && commentResult.error) {
    errors.push(commentResult.error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a rating has been submitted (not null)
 */
export function isRatingSubmitted(rating: number | null | undefined): boolean {
  return rating !== null && rating !== undefined;
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) {
    return false; // No expiry = never expires
  }

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return new Date() > expiryDate;
}

/**
 * Calculate average rating from an array of ratings
 */
export function calculateAverageRating(ratings: number[]): number | null {
  if (ratings.length === 0) {
    return null;
  }

  const validRatings = ratings.filter(r => r >= RATING_CONSTRAINTS.MIN_RATING && r <= RATING_CONSTRAINTS.MAX_RATING);

  if (validRatings.length === 0) {
    return null;
  }

  const sum = validRatings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / validRatings.length) * 10) / 10; // Round to 1 decimal place
}
