/**
 * Rating Validation Unit Tests
 * ============================
 * Tests for customer rating validation logic
 */

// Using Jest globals
import {
  validateToken,
  validateRating,
  validateComment,
  validateRatingInput,
  sanitizeComment,
  isRatingSubmitted,
  isTokenExpired,
  calculateAverageRating,
  RATING_CONSTRAINTS,
} from '@/lib/validation/rating';

describe('Rating Validation', () => {
  describe('validateToken', () => {
    it('should reject missing token', () => {
      expect(validateToken(undefined).valid).toBe(false);
      expect(validateToken(null).valid).toBe(false);
    });

    it('should reject non-string token', () => {
      expect(validateToken(123).valid).toBe(false);
      expect(validateToken({}).valid).toBe(false);
      expect(validateToken([]).valid).toBe(false);
    });

    it('should reject empty string token', () => {
      expect(validateToken('').valid).toBe(false);
      expect(validateToken('   ').valid).toBe(false);
    });

    it('should accept valid token', () => {
      expect(validateToken('abc123').valid).toBe(true);
      expect(validateToken('a1b2c3d4-e5f6-7890').valid).toBe(true);
    });
  });

  describe('validateRating', () => {
    it('should reject missing rating', () => {
      expect(validateRating(undefined).valid).toBe(false);
      expect(validateRating(null).valid).toBe(false);
    });

    it('should reject non-number rating', () => {
      expect(validateRating('5').valid).toBe(false);
      expect(validateRating('good').valid).toBe(false);
      expect(validateRating({}).valid).toBe(false);
    });

    it('should reject NaN', () => {
      expect(validateRating(NaN).valid).toBe(false);
    });

    it('should reject rating below 1', () => {
      expect(validateRating(0).valid).toBe(false);
      expect(validateRating(-1).valid).toBe(false);
    });

    it('should reject rating above 5', () => {
      expect(validateRating(6).valid).toBe(false);
      expect(validateRating(10).valid).toBe(false);
    });

    it('should reject non-integer ratings', () => {
      expect(validateRating(3.5).valid).toBe(false);
      expect(validateRating(4.9).valid).toBe(false);
    });

    it('should accept valid ratings (1-5)', () => {
      expect(validateRating(1).valid).toBe(true);
      expect(validateRating(2).valid).toBe(true);
      expect(validateRating(3).valid).toBe(true);
      expect(validateRating(4).valid).toBe(true);
      expect(validateRating(5).valid).toBe(true);
    });
  });

  describe('validateComment', () => {
    it('should accept missing comment (optional)', () => {
      expect(validateComment(undefined).valid).toBe(true);
      expect(validateComment(null).valid).toBe(true);
    });

    it('should accept empty comment', () => {
      expect(validateComment('').valid).toBe(true);
      expect(validateComment('   ').valid).toBe(true);
    });

    it('should reject non-string comment', () => {
      expect(validateComment(123).valid).toBe(false);
      expect(validateComment({}).valid).toBe(false);
    });

    it('should reject comment exceeding max length', () => {
      const longComment = 'a'.repeat(RATING_CONSTRAINTS.MAX_COMMENT_LENGTH + 1);
      expect(validateComment(longComment).valid).toBe(false);
    });

    it('should accept valid comments', () => {
      expect(validateComment('Great service!').valid).toBe(true);
      expect(validateComment('Excelente trabajo, muy profesional.').valid).toBe(true);
    });

    it('should accept comment at max length', () => {
      const maxComment = 'a'.repeat(RATING_CONSTRAINTS.MAX_COMMENT_LENGTH);
      expect(validateComment(maxComment).valid).toBe(true);
    });
  });

  describe('sanitizeComment', () => {
    it('should return null for empty or invalid input', () => {
      expect(sanitizeComment(null)).toBeNull();
      expect(sanitizeComment(undefined)).toBeNull();
      expect(sanitizeComment(123)).toBeNull();
      expect(sanitizeComment('')).toBeNull();
      expect(sanitizeComment('   ')).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(sanitizeComment('  hello  ')).toBe('hello');
    });

    it('should truncate long comments', () => {
      const longComment = 'a'.repeat(RATING_CONSTRAINTS.MAX_COMMENT_LENGTH + 100);
      const result = sanitizeComment(longComment);
      expect(result).toHaveLength(RATING_CONSTRAINTS.MAX_COMMENT_LENGTH);
    });

    it('should preserve valid comments', () => {
      expect(sanitizeComment('Good service')).toBe('Good service');
    });
  });

  describe('validateRatingInput', () => {
    it('should validate complete valid input', () => {
      const result = validateRatingInput({
        token: 'abc123',
        rating: 5,
        comment: 'Great!',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate input without optional comment', () => {
      const result = validateRatingInput({
        token: 'abc123',
        rating: 4,
      });
      expect(result.valid).toBe(true);
    });

    it('should collect all validation errors', () => {
      const result = validateRatingInput({
        token: '', // invalid
        rating: 10, // invalid
        comment: 123, // invalid
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should fail with missing required fields', () => {
      const result = validateRatingInput({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // token and rating
    });
  });

  describe('isRatingSubmitted', () => {
    it('should return false for null or undefined', () => {
      expect(isRatingSubmitted(null)).toBe(false);
      expect(isRatingSubmitted(undefined)).toBe(false);
    });

    it('should return true for valid ratings', () => {
      expect(isRatingSubmitted(1)).toBe(true);
      expect(isRatingSubmitted(5)).toBe(true);
      expect(isRatingSubmitted(3)).toBe(true);
    });

    it('should return true for zero (edge case)', () => {
      expect(isRatingSubmitted(0)).toBe(true);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false when no expiry', () => {
      expect(isTokenExpired(null)).toBe(false);
      expect(isTokenExpired(undefined)).toBe(false);
    });

    it('should return true for past date', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    it('should handle ISO string dates', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      expect(isTokenExpired(pastDate)).toBe(true);

      const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      expect(isTokenExpired(futureDate)).toBe(false);
    });
  });

  describe('calculateAverageRating', () => {
    it('should return null for empty array', () => {
      expect(calculateAverageRating([])).toBeNull();
    });

    it('should calculate correct average', () => {
      expect(calculateAverageRating([5])).toBe(5);
      expect(calculateAverageRating([4, 4, 4])).toBe(4);
      expect(calculateAverageRating([5, 5, 4, 4])).toBe(4.5);
      expect(calculateAverageRating([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should round to 1 decimal place', () => {
      expect(calculateAverageRating([4, 4, 5])).toBe(4.3); // 4.333... -> 4.3
    });

    it('should filter out invalid ratings', () => {
      expect(calculateAverageRating([0, 5, 6, 10])).toBe(5); // Only 5 is valid
    });

    it('should return null if all ratings are invalid', () => {
      expect(calculateAverageRating([0, 6, -1])).toBeNull();
    });
  });
});

describe('Rating Constraints', () => {
  it('should have correct constraint values', () => {
    expect(RATING_CONSTRAINTS.MIN_RATING).toBe(1);
    expect(RATING_CONSTRAINTS.MAX_RATING).toBe(5);
    expect(RATING_CONSTRAINTS.MAX_COMMENT_LENGTH).toBe(500);
  });
});
