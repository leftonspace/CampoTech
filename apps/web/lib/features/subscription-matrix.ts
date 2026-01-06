/**
 * CampoTech Subscription Feature Matrix
 * =====================================
 * 
 * Phase 2.5 Task 2.5.3: Plan Feature Matrix
 * 
 * Centralized definition of limits and features per subscription tier.
 * Used for UI gating and API enforcement.
 */

export type SubscriptionTier = 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA';

export interface PlanFeatures {
    name: string;
    maxTechnicians: number;
    maxVehicles: number;
    maxCustomers: number;
    whatsappType: 'NONE' | 'REDIRECT' | 'API';
    fiscalHealth: boolean;
    inventoryCascade: boolean;
    multiStopRoute: boolean;
    customBranding: boolean;
    aiStaffAssist: boolean;
    afipIntegration: boolean;
}

export const PLAN_MATRIX: Record<SubscriptionTier, PlanFeatures> = {
    FREE: {
        name: 'Gratis',
        maxTechnicians: 1,
        maxVehicles: 0,
        maxCustomers: 50,
        whatsappType: 'REDIRECT', // Even free tier gets basic redirect
        fiscalHealth: true,       // "Traffic Light" is always free (core value prop)
        inventoryCascade: false,
        multiStopRoute: false,
        customBranding: false,
        aiStaffAssist: false,
        afipIntegration: false,
    },
    INICIAL: {
        name: 'Inicial',
        maxTechnicians: 3,
        maxVehicles: 2,
        maxCustomers: 200,
        whatsappType: 'REDIRECT',
        fiscalHealth: true,
        inventoryCascade: true,
        multiStopRoute: true,
        customBranding: false,
        aiStaffAssist: false,
        afipIntegration: true,
    },
    PROFESIONAL: {
        name: 'Profesional',
        maxTechnicians: 10,
        maxVehicles: 10,
        maxCustomers: 1000,
        whatsappType: 'API',      // Full Cloud API integration
        fiscalHealth: true,
        inventoryCascade: true,
        multiStopRoute: true,
        customBranding: true,
        aiStaffAssist: true,
        afipIntegration: true,
    },
    EMPRESA: {
        name: 'Empresa',
        maxTechnicians: 999,
        maxVehicles: 999,
        maxCustomers: 99999,
        whatsappType: 'API',
        fiscalHealth: true,
        inventoryCascade: true,
        multiStopRoute: true,
        customBranding: true,
        aiStaffAssist: true,
        afipIntegration: true,
    },
};

/**
 * Helper to check if a feature is enabled for a tier
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof PlanFeatures): boolean {
    const plan = PLAN_MATRIX[tier];
    if (!plan) return false;

    const value = plan[feature];
    if (typeof value === 'boolean') return value;
    return false;
}

/**
 * Helper to get a limit for a tier
 */
export function getLimit<T extends keyof PlanFeatures>(tier: SubscriptionTier, feature: T): PlanFeatures[T] {
    return PLAN_MATRIX[tier][feature];
}
