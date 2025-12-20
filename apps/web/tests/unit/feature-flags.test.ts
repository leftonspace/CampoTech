/**
 * Feature Flags Unit Tests
 * ========================
 * Tests for tier-based feature access control
 */

import { describe, it, expect } from 'vitest';
import {
  hasFeatureAccess,
  getFeaturesForTier,
  getMinimumTierForFeature,
  getFeature,
  getFeatureForRoute,
  getUnlockableFeatures,
  isModuleLocked,
  getModuleMinimumTier,
  isModuleTierGated,
  createFeatureNotAvailableError,
  FEATURES,
  TIER_FEATURES,
  type FeatureId,
} from '@/lib/config/feature-flags';
import { SubscriptionTier } from '@/lib/config/tier-limits';

describe('Feature Flags', () => {
  describe('hasFeatureAccess', () => {
    describe('FREE Tier', () => {
      it('should have access to basic features', () => {
        expect(hasFeatureAccess('FREE', 'basic_jobs')).toBe(true);
        expect(hasFeatureAccess('FREE', 'basic_customers')).toBe(true);
        expect(hasFeatureAccess('FREE', 'basic_invoicing')).toBe(true);
        expect(hasFeatureAccess('FREE', 'whatsapp_receive')).toBe(true);
      });

      it('should NOT have access to BASICO features', () => {
        expect(hasFeatureAccess('FREE', 'afip_integration')).toBe(false);
        expect(hasFeatureAccess('FREE', 'mercado_pago')).toBe(false);
        expect(hasFeatureAccess('FREE', 'whatsapp_send')).toBe(false);
      });

      it('should NOT have access to PROFESIONAL features', () => {
        expect(hasFeatureAccess('FREE', 'whatsapp_ai')).toBe(false);
        expect(hasFeatureAccess('FREE', 'live_tracking')).toBe(false);
        expect(hasFeatureAccess('FREE', 'voice_transcription')).toBe(false);
      });

      it('should NOT have access to EMPRESARIAL features', () => {
        expect(hasFeatureAccess('FREE', 'multi_location')).toBe(false);
        expect(hasFeatureAccess('FREE', 'advanced_analytics')).toBe(false);
        expect(hasFeatureAccess('FREE', 'public_api')).toBe(false);
      });
    });

    describe('BASICO Tier', () => {
      it('should have access to FREE features', () => {
        expect(hasFeatureAccess('BASICO', 'basic_jobs')).toBe(true);
        expect(hasFeatureAccess('BASICO', 'whatsapp_receive')).toBe(true);
      });

      it('should have access to BASICO features', () => {
        expect(hasFeatureAccess('BASICO', 'afip_integration')).toBe(true);
        expect(hasFeatureAccess('BASICO', 'mercado_pago')).toBe(true);
        expect(hasFeatureAccess('BASICO', 'calendar_view')).toBe(true);
        expect(hasFeatureAccess('BASICO', 'whatsapp_send')).toBe(true);
        expect(hasFeatureAccess('BASICO', 'multi_user')).toBe(true);
      });

      it('should NOT have access to PROFESIONAL features', () => {
        expect(hasFeatureAccess('BASICO', 'whatsapp_ai')).toBe(false);
        expect(hasFeatureAccess('BASICO', 'fleet_management')).toBe(false);
      });
    });

    describe('PROFESIONAL Tier', () => {
      it('should have access to all lower tier features', () => {
        expect(hasFeatureAccess('PROFESIONAL', 'basic_jobs')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'afip_integration')).toBe(true);
      });

      it('should have access to PROFESIONAL features', () => {
        expect(hasFeatureAccess('PROFESIONAL', 'whatsapp_ai')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'voice_transcription')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'live_tracking')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'nearest_technician')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'fleet_management')).toBe(true);
        expect(hasFeatureAccess('PROFESIONAL', 'inventory_management')).toBe(true);
      });

      it('should NOT have access to EMPRESARIAL features', () => {
        expect(hasFeatureAccess('PROFESIONAL', 'multi_location')).toBe(false);
        expect(hasFeatureAccess('PROFESIONAL', 'advanced_analytics')).toBe(false);
        expect(hasFeatureAccess('PROFESIONAL', 'customer_portal')).toBe(false);
      });
    });

    describe('EMPRESARIAL Tier', () => {
      it('should have access to all features except white_label', () => {
        expect(hasFeatureAccess('EMPRESARIAL', 'basic_jobs')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'afip_integration')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'whatsapp_ai')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'multi_location')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'advanced_analytics')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'customer_portal')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'public_api')).toBe(true);
        expect(hasFeatureAccess('EMPRESARIAL', 'webhooks')).toBe(true);
      });

      it('should NOT have access to white_label (requires custom contract)', () => {
        expect(hasFeatureAccess('EMPRESARIAL', 'white_label')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should return false for non-existent feature', () => {
        expect(hasFeatureAccess('EMPRESARIAL', 'non_existent_feature' as FeatureId)).toBe(false);
      });
    });
  });

  describe('getFeaturesForTier', () => {
    it('should return correct number of features for FREE tier', () => {
      const features = getFeaturesForTier('FREE');
      expect(features.length).toBe(4);
    });

    it('should return correct number of features for BASICO tier', () => {
      const features = getFeaturesForTier('BASICO');
      expect(features.length).toBe(9);
    });

    it('should return correct number of features for PROFESIONAL tier', () => {
      const features = getFeaturesForTier('PROFESIONAL');
      expect(features.length).toBe(15);
    });

    it('should return correct number of features for EMPRESARIAL tier', () => {
      const features = getFeaturesForTier('EMPRESARIAL');
      expect(features.length).toBe(20);
    });

    it('should return valid FeatureConfig objects', () => {
      const features = getFeaturesForTier('BASICO');
      for (const feature of features) {
        expect(feature).toHaveProperty('id');
        expect(feature).toHaveProperty('name');
        expect(feature).toHaveProperty('description');
        expect(feature).toHaveProperty('category');
        expect(feature).toHaveProperty('minTier');
      }
    });
  });

  describe('getMinimumTierForFeature', () => {
    it('should return FREE for basic features', () => {
      expect(getMinimumTierForFeature('basic_jobs')).toBe('FREE');
      expect(getMinimumTierForFeature('basic_customers')).toBe('FREE');
    });

    it('should return BASICO for BASICO features', () => {
      expect(getMinimumTierForFeature('afip_integration')).toBe('BASICO');
      expect(getMinimumTierForFeature('mercado_pago')).toBe('BASICO');
    });

    it('should return PROFESIONAL for PROFESIONAL features', () => {
      expect(getMinimumTierForFeature('whatsapp_ai')).toBe('PROFESIONAL');
      expect(getMinimumTierForFeature('live_tracking')).toBe('PROFESIONAL');
    });

    it('should return EMPRESARIAL for EMPRESARIAL features', () => {
      expect(getMinimumTierForFeature('multi_location')).toBe('EMPRESARIAL');
      expect(getMinimumTierForFeature('public_api')).toBe('EMPRESARIAL');
    });

    it('should return null for non-existent feature', () => {
      expect(getMinimumTierForFeature('non_existent' as FeatureId)).toBeNull();
    });
  });

  describe('getFeature', () => {
    it('should return feature config for valid feature', () => {
      const feature = getFeature('afip_integration');
      expect(feature).not.toBeNull();
      expect(feature?.id).toBe('afip_integration');
      expect(feature?.name).toBe('Integración AFIP');
      expect(feature?.minTier).toBe('BASICO');
    });

    it('should return null for non-existent feature', () => {
      expect(getFeature('non_existent' as FeatureId)).toBeNull();
    });
  });

  describe('getFeatureForRoute', () => {
    it('should return afip_integration for AFIP routes', () => {
      expect(getFeatureForRoute('/api/afip/status')).toBe('afip_integration');
      expect(getFeatureForRoute('/api/afip/invoice/create')).toBe('afip_integration');
    });

    it('should return mercado_pago for payment routes', () => {
      expect(getFeatureForRoute('/api/mercado-pago/preference')).toBe('mercado_pago');
    });

    it('should return live_tracking for tracking routes', () => {
      expect(getFeatureForRoute('/api/tracking/start')).toBe('live_tracking');
      expect(getFeatureForRoute('/api/tracking/update')).toBe('live_tracking');
    });

    it('should return fleet_management for fleet routes', () => {
      expect(getFeatureForRoute('/api/fleet/vehicles')).toBe('fleet_management');
      expect(getFeatureForRoute('/api/vehicles/123')).toBe('fleet_management');
    });

    it('should return public_api for v1 API routes', () => {
      expect(getFeatureForRoute('/api/v1/jobs')).toBe('public_api');
      expect(getFeatureForRoute('/api/v1/customers/123')).toBe('public_api');
    });

    it('should return null for unprotected routes', () => {
      expect(getFeatureForRoute('/api/jobs')).toBeNull();
      expect(getFeatureForRoute('/api/auth/login')).toBeNull();
    });
  });

  describe('getUnlockableFeatures', () => {
    it('should return BASICO features when upgrading from FREE', () => {
      const unlockable = getUnlockableFeatures('FREE', 'BASICO');
      const featureIds = unlockable.map(f => f.id);

      expect(featureIds).toContain('afip_integration');
      expect(featureIds).toContain('mercado_pago');
      expect(featureIds).toContain('calendar_view');
      expect(featureIds).toContain('whatsapp_send');
      expect(featureIds).toContain('multi_user');

      // Should NOT contain FREE features
      expect(featureIds).not.toContain('basic_jobs');
    });

    it('should return PROFESIONAL features when upgrading from BASICO', () => {
      const unlockable = getUnlockableFeatures('BASICO', 'PROFESIONAL');
      const featureIds = unlockable.map(f => f.id);

      expect(featureIds).toContain('whatsapp_ai');
      expect(featureIds).toContain('live_tracking');
      expect(featureIds).toContain('fleet_management');

      // Should NOT contain BASICO features
      expect(featureIds).not.toContain('afip_integration');
    });

    it('should return empty array when upgrading to same tier', () => {
      const unlockable = getUnlockableFeatures('BASICO', 'BASICO');
      expect(unlockable).toHaveLength(0);
    });
  });
});

describe('Module Feature Gating', () => {
  describe('isModuleTierGated', () => {
    it('should return true for tier-gated modules', () => {
      expect(isModuleTierGated('map')).toBe(true);
      expect(isModuleTierGated('calendar')).toBe(true);
      expect(isModuleTierGated('fleet')).toBe(true);
      expect(isModuleTierGated('analytics')).toBe(true);
    });

    it('should return false for always-available modules', () => {
      expect(isModuleTierGated('dashboard')).toBe(false);
      expect(isModuleTierGated('jobs')).toBe(false);
      expect(isModuleTierGated('customers')).toBe(false);
      expect(isModuleTierGated('invoices')).toBe(false);
    });
  });

  describe('isModuleLocked', () => {
    it('should lock PROFESIONAL modules for FREE tier', () => {
      expect(isModuleLocked('map', 'FREE')).toBe(true);
      expect(isModuleLocked('fleet', 'FREE')).toBe(true);
    });

    it('should lock PROFESIONAL modules for BASICO tier', () => {
      expect(isModuleLocked('map', 'BASICO')).toBe(true);
      expect(isModuleLocked('fleet', 'BASICO')).toBe(true);
    });

    it('should unlock PROFESIONAL modules for PROFESIONAL tier', () => {
      expect(isModuleLocked('map', 'PROFESIONAL')).toBe(false);
      expect(isModuleLocked('fleet', 'PROFESIONAL')).toBe(false);
    });

    it('should lock calendar for FREE tier but unlock for BASICO', () => {
      expect(isModuleLocked('calendar', 'FREE')).toBe(true);
      expect(isModuleLocked('calendar', 'BASICO')).toBe(false);
    });

    it('should not lock non-gated modules for any tier', () => {
      expect(isModuleLocked('jobs', 'FREE')).toBe(false);
      expect(isModuleLocked('customers', 'FREE')).toBe(false);
    });
  });

  describe('getModuleMinimumTier', () => {
    it('should return correct tier for gated modules', () => {
      expect(getModuleMinimumTier('map')).toBe('PROFESIONAL');
      expect(getModuleMinimumTier('calendar')).toBe('BASICO');
      expect(getModuleMinimumTier('fleet')).toBe('PROFESIONAL');
      expect(getModuleMinimumTier('analytics')).toBe('EMPRESARIAL');
    });

    it('should return null for non-gated modules', () => {
      expect(getModuleMinimumTier('jobs')).toBeNull();
      expect(getModuleMinimumTier('customers')).toBeNull();
    });
  });
});

describe('Feature Not Available Error', () => {
  describe('createFeatureNotAvailableError', () => {
    it('should create error with correct structure', () => {
      const error = createFeatureNotAvailableError('afip_integration', 'FREE');

      expect(error.error).toBe('feature_not_available');
      expect(error.feature).toBe('afip_integration');
      expect(error.feature_name).toBe('Integración AFIP');
      expect(error.current_tier).toBe('FREE');
      expect(error.required_tier).toBe('BASICO');
      expect(error.message).toContain('no está disponible');
      expect(error.upgrade_url).toContain('/settings/billing/upgrade');
      expect(error.upgrade_url).toContain('feature=afip_integration');
    });

    it('should handle non-existent feature gracefully', () => {
      const error = createFeatureNotAvailableError('non_existent' as FeatureId, 'FREE');

      expect(error.error).toBe('feature_not_available');
      expect(error.feature).toBe('non_existent');
    });
  });
});

describe('Feature Configuration Integrity', () => {
  it('all features in TIER_FEATURES should exist in FEATURES', () => {
    for (const tier of Object.keys(TIER_FEATURES) as SubscriptionTier[]) {
      for (const featureId of TIER_FEATURES[tier]) {
        expect(FEATURES[featureId]).toBeDefined();
      }
    }
  });

  it('all features should have required properties', () => {
    for (const [id, feature] of Object.entries(FEATURES)) {
      expect(feature.id).toBe(id);
      expect(feature.name).toBeTruthy();
      expect(feature.description).toBeTruthy();
      expect(['core', 'integrations', 'communication', 'operations', 'analytics', 'enterprise']).toContain(feature.category);
      expect(['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL']).toContain(feature.minTier);
    }
  });

  it('tier features should be cumulative', () => {
    const tiers: SubscriptionTier[] = ['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL'];

    for (let i = 1; i < tiers.length; i++) {
      const lowerTierFeatures = new Set(TIER_FEATURES[tiers[i - 1]]);
      const currentTierFeatures = new Set(TIER_FEATURES[tiers[i]]);

      // All features from lower tier should be in current tier
      for (const feature of lowerTierFeatures) {
        expect(currentTierFeatures.has(feature)).toBe(true);
      }
    }
  });
});
