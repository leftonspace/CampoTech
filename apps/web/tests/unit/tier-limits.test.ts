/**
 * Tier Limits Unit Tests
 * ======================
 * Tests for subscription tier limits configuration
 */

// Using Jest globals
import {
  TIER_LIMITS,
  TIER_CONFIGS,
  getTierLimits,
  getTierConfig,
  getLimit,
  isLimitExceeded,
  formatLimitValue,
  getTierOrder,
  isTierHigher,
  getMinimumTierForLimit,
  isApproachingLimit,
  getUsagePercentage,
  type SubscriptionTier,
} from '@/lib/config/tier-limits';

describe('Tier Limits Configuration', () => {
  describe('Pricing', () => {
    it('should have correct pricing for FREE tier', () => {
      expect(TIER_LIMITS.FREE.priceUsd).toBe(0);
      expect(TIER_LIMITS.FREE.priceDisplay).toBe('Gratis');
    });

    it('should have correct pricing for INICIAL tier ($25)', () => {
      expect(TIER_LIMITS.INICIAL.priceUsd).toBe(25);
      expect(TIER_LIMITS.INICIAL.priceDisplay).toBe('$25/mes');
    });

    it('should have correct pricing for PROFESIONAL tier ($55)', () => {
      expect(TIER_LIMITS.PROFESIONAL.priceUsd).toBe(55);
      expect(TIER_LIMITS.PROFESIONAL.priceDisplay).toBe('$55/mes');
    });

    it('should have correct pricing for EMPRESA tier ($120)', () => {
      expect(TIER_LIMITS.EMPRESA.priceUsd).toBe(120);
      expect(TIER_LIMITS.EMPRESA.priceDisplay).toBe('$120/mes');
    });
  });

  describe('User Limits', () => {
    it('FREE tier should have 1 user max', () => {
      expect(TIER_LIMITS.FREE.maxUsers).toBe(1);
    });

    it('INICIAL tier should have 1 user max', () => {
      expect(TIER_LIMITS.INICIAL.maxUsers).toBe(1);
    });

    it('PROFESIONAL tier should have 5 users max', () => {
      expect(TIER_LIMITS.PROFESIONAL.maxUsers).toBe(5);
    });

    it('EMPRESA tier should have unlimited users', () => {
      expect(TIER_LIMITS.EMPRESA.maxUsers).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Jobs Per Month Limits', () => {
    it('FREE tier should have 30 jobs per month', () => {
      expect(TIER_LIMITS.FREE.maxJobsPerMonth).toBe(30);
    });

    it('INICIAL tier should have 50 jobs per month', () => {
      expect(TIER_LIMITS.INICIAL.maxJobsPerMonth).toBe(50);
    });

    it('PROFESIONAL tier should have 200 jobs per month', () => {
      expect(TIER_LIMITS.PROFESIONAL.maxJobsPerMonth).toBe(200);
    });

    it('EMPRESA tier should have unlimited jobs', () => {
      expect(TIER_LIMITS.EMPRESA.maxJobsPerMonth).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('WhatsApp AI Limits', () => {
    it('FREE tier should have 0 WhatsApp AI messages', () => {
      expect(TIER_LIMITS.FREE.maxWhatsAppMessagesPerMonth).toBe(0);
    });

    it('INICIAL tier should have 0 WhatsApp AI messages (manual only)', () => {
      expect(TIER_LIMITS.INICIAL.maxWhatsAppMessagesPerMonth).toBe(0);
    });

    it('PROFESIONAL tier should have 100 WhatsApp AI messages', () => {
      expect(TIER_LIMITS.PROFESIONAL.maxWhatsAppMessagesPerMonth).toBe(100);
    });

    it('EMPRESA tier should have unlimited WhatsApp AI', () => {
      expect(TIER_LIMITS.EMPRESA.maxWhatsAppMessagesPerMonth).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});

describe('Tier Configurations', () => {
  it('should have 4 tiers configured', () => {
    expect(TIER_CONFIGS).toHaveLength(4);
  });

  it('FREE tier should be the default', () => {
    const freeTier = TIER_CONFIGS.find(t => t.id === 'FREE');
    expect(freeTier?.isDefault).toBe(true);
  });

  it('INICIAL should be named "Inicial"', () => {
    const INICIALTier = TIER_CONFIGS.find(t => t.id === 'INICIAL');
    expect(INICIALTier?.name).toBe('Inicial');
  });
});

describe('Helper Functions', () => {
  describe('getTierLimits', () => {
    it('should return correct limits for each tier', () => {
      expect(getTierLimits('FREE').maxUsers).toBe(1);
      expect(getTierLimits('INICIAL').priceUsd).toBe(25);
      expect(getTierLimits('PROFESIONAL').maxJobsPerMonth).toBe(200);
      expect(getTierLimits('EMPRESA').maxUsers).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should default to FREE tier for invalid input', () => {
      // @ts-expect-error Testing invalid input
      const limits = getTierLimits('INVALID');
      expect(limits.maxUsers).toBe(1);
    });
  });

  describe('getTierConfig', () => {
    it('should return config with name and description', () => {
      const config = getTierConfig('PROFESIONAL');
      expect(config?.name).toBe('Profesional');
      expect(config?.description).toBe('Para pequeñas empresas (2-5 empleados)');
    });
  });

  describe('getLimit', () => {
    it('should return correct limit values', () => {
      expect(getLimit('FREE', 'users')).toBe(1);
      expect(getLimit('INICIAL', 'jobs_monthly')).toBe(50);
      expect(getLimit('PROFESIONAL', 'whatsapp_monthly')).toBe(100);
    });
  });

  describe('isLimitExceeded', () => {
    it('should return true when limit is exceeded', () => {
      expect(isLimitExceeded('FREE', 'users', 1, 1)).toBe(true); // 1 + 1 > 1
      expect(isLimitExceeded('FREE', 'jobs_monthly', 30, 1)).toBe(true); // 30 + 1 > 30
    });

    it('should return false when limit is not exceeded', () => {
      expect(isLimitExceeded('FREE', 'users', 0, 1)).toBe(false); // 0 + 1 <= 1
      expect(isLimitExceeded('PROFESIONAL', 'jobs_monthly', 100, 1)).toBe(false);
    });

    it('should never exceed for unlimited tiers', () => {
      expect(isLimitExceeded('EMPRESA', 'users', 1000, 1000)).toBe(false);
      expect(isLimitExceeded('EMPRESA', 'jobs_monthly', 999999, 1)).toBe(false);
    });
  });

  describe('formatLimitValue', () => {
    it('should format unlimited as "Ilimitado"', () => {
      expect(formatLimitValue('users', Number.MAX_SAFE_INTEGER)).toBe('Ilimitado');
    });

    it('should format zero as "No disponible"', () => {
      expect(formatLimitValue('whatsapp_monthly', 0)).toBe('No disponible');
    });

    it('should format storage in MB/GB', () => {
      expect(formatLimitValue('storage', 50 * 1024 * 1024)).toBe('50MB');
      expect(formatLimitValue('storage', 5 * 1024 * 1024 * 1024)).toBe('5GB');
    });

    it('should format numbers with locale', () => {
      const formatted = formatLimitValue('jobs_monthly', 1000);
      expect(formatted).toMatch(/1[.,]000/); // Allows for locale differences
    });
  });

  describe('getTierOrder', () => {
    it('should return correct order values', () => {
      expect(getTierOrder('FREE')).toBe(0);
      expect(getTierOrder('INICIAL')).toBe(1);
      expect(getTierOrder('PROFESIONAL')).toBe(2);
      expect(getTierOrder('EMPRESA')).toBe(3);
    });
  });

  describe('isTierHigher', () => {
    it('should correctly compare tiers', () => {
      expect(isTierHigher('INICIAL', 'FREE')).toBe(true);
      expect(isTierHigher('EMPRESA', 'PROFESIONAL')).toBe(true);
      expect(isTierHigher('FREE', 'INICIAL')).toBe(false);
      expect(isTierHigher('INICIAL', 'INICIAL')).toBe(false);
    });
  });

  describe('getMinimumTierForLimit', () => {
    it('should return minimum tier for user count', () => {
      expect(getMinimumTierForLimit('users', 1)).toBe('FREE');
      expect(getMinimumTierForLimit('users', 3)).toBe('PROFESIONAL');
      expect(getMinimumTierForLimit('users', 100)).toBe('EMPRESA');
    });

    it('should return minimum tier for jobs per month', () => {
      expect(getMinimumTierForLimit('jobs_monthly', 30)).toBe('FREE');
      expect(getMinimumTierForLimit('jobs_monthly', 50)).toBe('INICIAL');
      expect(getMinimumTierForLimit('jobs_monthly', 150)).toBe('PROFESIONAL');
      expect(getMinimumTierForLimit('jobs_monthly', 500)).toBe('EMPRESA');
    });
  });
});

describe('Usage Monitoring', () => {
  describe('isApproachingLimit', () => {
    it('should return true when usage >= 80%', () => {
      expect(isApproachingLimit(80, 100)).toBe(true);
      expect(isApproachingLimit(90, 100)).toBe(true);
    });

    it('should return false when usage < 80%', () => {
      expect(isApproachingLimit(79, 100)).toBe(false);
      expect(isApproachingLimit(50, 100)).toBe(false);
    });

    it('should return false for unlimited', () => {
      expect(isApproachingLimit(999999, Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('should return false for zero limit', () => {
      expect(isApproachingLimit(0, 0)).toBe(false);
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate correct percentage', () => {
      expect(getUsagePercentage(50, 100)).toBe(50);
      expect(getUsagePercentage(25, 100)).toBe(25);
      expect(getUsagePercentage(100, 100)).toBe(100);
    });

    it('should cap at 100%', () => {
      expect(getUsagePercentage(150, 100)).toBe(100);
    });

    it('should return 0 for unlimited', () => {
      expect(getUsagePercentage(999, Number.MAX_SAFE_INTEGER)).toBe(0);
    });

    it('should return 100 for zero limit', () => {
      expect(getUsagePercentage(0, 0)).toBe(100);
    });
  });
});

