/**
 * Fraud Detection Service Tests
 * =============================
 *
 * Phase 15: Consumer Marketplace
 * Tests for the fraud detection service.
 */

import { Pool } from 'pg';
import { FraudDetectionService, ReviewInput, FraudSignal } from '../reviews/fraud-detection.service';

// Mock the pg Pool
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    Pool: jest.fn(() => ({
      query: jest.fn(),
      connect: jest.fn(() => mockClient),
    })),
  };
});

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new FraudDetectionService(mockPool);
    jest.clearAllMocks();
  });

  describe('Text similarity detection', () => {
    it('should detect very similar text', () => {
      const normalizeText = (service as any).normalizeText.bind(service);
      const calculateSimilarity = (service as any).calculateSimilarity.bind(service);

      const text1 = 'Excelente servicio, muy profesional y puntual';
      const text2 = 'Excelente servicio, muy profesional y puntual';

      const similarity = calculateSimilarity(
        normalizeText(text1),
        normalizeText(text2)
      );

      expect(similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('should detect similar text with minor differences', () => {
      const normalizeText = (service as any).normalizeText.bind(service);
      const calculateSimilarity = (service as any).calculateSimilarity.bind(service);

      const text1 = 'Excelente servicio muy profesional y puntual recomendado';
      const text2 = 'Excelente servicio muy profesional puntual lo recomiendo';

      const similarity = calculateSimilarity(
        normalizeText(text1),
        normalizeText(text2)
      );

      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should detect different texts as dissimilar', () => {
      const normalizeText = (service as any).normalizeText.bind(service);
      const calculateSimilarity = (service as any).calculateSimilarity.bind(service);

      const text1 = 'Excelente servicio muy profesional';
      const text2 = 'Pesimo trabajo llego tarde y no termino';

      const similarity = calculateSimilarity(
        normalizeText(text1),
        normalizeText(text2)
      );

      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe('Spam content detection', () => {
    it('should detect URLs as spam', () => {
      const checkSpamContent = (service as any).checkSpamContent.bind(service);

      const result = checkSpamContent('Visita http://example.com para mas info');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('spam_content');
      expect(result?.score).toBeGreaterThanOrEqual(30);
    });

    it('should detect promotional content', () => {
      const checkSpamContent = (service as any).checkSpamContent.bind(service);

      const result = checkSpamContent('Aprovecha esta promo gratis solo hoy descuento 50%');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('spam_content');
    });

    it('should detect excessive repetition', () => {
      const checkSpamContent = (service as any).checkSpamContent.bind(service);

      const result = checkSpamContent('Buenoooooo muy bueno !!!!!!');

      expect(result).not.toBeNull();
    });

    it('should not flag normal reviews', () => {
      const checkSpamContent = (service as any).checkSpamContent.bind(service);

      const result = checkSpamContent(
        'Muy buen servicio, el tecnico llego a tiempo y soluciono el problema rapido. Lo recomiendo.'
      );

      expect(result).toBeNull();
    });
  });

  describe('Behavioral pattern detection', () => {
    it('should flag new account with extreme rating', () => {
      const checkBehavioralPattern = (service as any).checkBehavioralPattern.bind(service);

      const review: ReviewInput = {
        id: 'test-id',
        consumerId: 'consumer-id',
        businessProfileId: 'business-id',
        overallRating: 5, // Extreme rating
      };

      const consumerStats = {
        totalReviews: 1,
        averageRating: 0,
        accountAgeDays: 2, // New account
        recentReviewCount24h: 1,
        recentReviewCount1h: 0,
        uniqueBusinessesReviewed: 1,
      };

      const result = checkBehavioralPattern(review, consumerStats);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('new_account_extreme');
    });

    it('should flag unverified transactions', () => {
      const checkBehavioralPattern = (service as any).checkBehavioralPattern.bind(service);

      const review: ReviewInput = {
        id: 'test-id',
        consumerId: 'consumer-id',
        businessProfileId: 'business-id',
        overallRating: 4,
        // No jobId
      };

      const consumerStats = {
        totalReviews: 10,
        averageRating: 4,
        accountAgeDays: 100,
        recentReviewCount24h: 1,
        recentReviewCount1h: 0,
        uniqueBusinessesReviewed: 5,
      };

      const result = checkBehavioralPattern(review, consumerStats);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('unverified_transaction');
    });

    it('should not flag verified transactions from established accounts', () => {
      const checkBehavioralPattern = (service as any).checkBehavioralPattern.bind(service);

      const review: ReviewInput = {
        id: 'test-id',
        consumerId: 'consumer-id',
        businessProfileId: 'business-id',
        overallRating: 4,
        jobId: 'verified-job-id', // Has verified job
      };

      const consumerStats = {
        totalReviews: 10,
        averageRating: 4,
        accountAgeDays: 100, // Established account
        recentReviewCount24h: 1,
        recentReviewCount1h: 0,
        uniqueBusinessesReviewed: 5,
      };

      const result = checkBehavioralPattern(review, consumerStats);

      expect(result).toBeNull();
    });
  });

  describe('Analysis calculation', () => {
    it('should recommend auto_reject for high fraud score', () => {
      const calculateAnalysis = (service as any).calculateAnalysis.bind(service);

      const signals: FraudSignal[] = [
        { type: 'velocity_consumer', severity: 'high', score: 60, description: 'Test' },
        { type: 'text_similarity', severity: 'high', score: 70, description: 'Test' },
      ];

      const result = calculateAnalysis('review-id', signals);

      expect(result.recommendation).toBe('auto_reject');
      expect(result.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('should recommend manual_review for moderate fraud score', () => {
      const calculateAnalysis = (service as any).calculateAnalysis.bind(service);

      const signals: FraudSignal[] = [
        { type: 'new_account_extreme', severity: 'medium', score: 25, description: 'Test' },
        { type: 'unverified_transaction', severity: 'low', score: 15, description: 'Test' },
      ];

      const result = calculateAnalysis('review-id', signals);

      expect(['manual_review', 'auto_approve']).toContain(result.recommendation);
    });

    it('should recommend auto_approve for low fraud score', () => {
      const calculateAnalysis = (service as any).calculateAnalysis.bind(service);

      const signals: FraudSignal[] = [
        { type: 'unverified_transaction', severity: 'low', score: 10, description: 'Test' },
      ];

      const result = calculateAnalysis('review-id', signals);

      expect(result.overallScore).toBeLessThan(20);
    });

    it('should reject immediately on critical signal', () => {
      const calculateAnalysis = (service as any).calculateAnalysis.bind(service);

      const signals: FraudSignal[] = [
        { type: 'device_fingerprint', severity: 'critical', score: 80, description: 'Multiple accounts' },
      ];

      const result = calculateAnalysis('review-id', signals);

      expect(result.recommendation).toBe('auto_reject');
    });
  });

  describe('Text normalization', () => {
    it('should normalize accents', () => {
      const normalizeText = (service as any).normalizeText.bind(service);

      expect(normalizeText('Excelente servicio')).toBe('excelente servicio');
      expect(normalizeText('rápido y profesional')).toBe('rapido y profesional');
    });

    it('should remove special characters', () => {
      const normalizeText = (service as any).normalizeText.bind(service);

      expect(normalizeText('Muy bueno!!!')).toBe('muy bueno');
      expect(normalizeText('Test @#$% text')).toBe('test text');
    });

    it('should normalize whitespace', () => {
      const normalizeText = (service as any).normalizeText.bind(service);

      expect(normalizeText('  Multiple   spaces  ')).toBe('multiple spaces');
    });
  });

  describe('Trigram extraction', () => {
    it('should extract correct trigrams', () => {
      const getTrigrams = (service as any).getTrigrams.bind(service);

      const trigrams = getTrigrams('one two three four five');

      expect(trigrams.has('one two three')).toBe(true);
      expect(trigrams.has('two three four')).toBe(true);
      expect(trigrams.has('three four five')).toBe(true);
      expect(trigrams.size).toBe(3);
    });

    it('should return empty set for short text', () => {
      const getTrigrams = (service as any).getTrigrams.bind(service);

      const trigrams = getTrigrams('one two');

      expect(trigrams.size).toBe(0);
    });
  });
});
