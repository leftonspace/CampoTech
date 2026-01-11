/**
 * WhatsApp Cost Protection Architecture
 * ======================================
 *
 * Phase 2.5 Task 2.5.2: WhatsApp Cost Protection
 *
 * This module strictly separates "Free Redirect" from "Paid API" to ensure
 * zero-cost free tier. Free/Trial users get wa.me redirects (zero cost),
 * while paid users get full Cloud API access.
 *
 * CRITICAL: No "Free API Credits" concept exists. Free tier = Redirect only.
 */

import type { SubscriptionTier } from './subscription-matrix';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type WhatsAppFeatureKey = keyof typeof WHATSAPP_FEATURES;

export interface WhatsAppFeature {
    plans: SubscriptionTier[];
    description: string;
    costPerMessage: number; // Cost in USD (0 for free)
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FEATURE DEFINITIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * WhatsApp Feature Matrix
 *
 * FREE / TRIAL = wa.me redirect only (zero server cost)
 * PAID = Full Cloud API access (costs ~$0.05/message)
 */
export const WHATSAPP_FEATURES = {
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FREE / TRIAL - Always available, zero cost
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    redirect: {
        plans: ['FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'WhatsApp redirect link (wa.me) - Opens customer WhatsApp app',
        costPerMessage: 0,
    },

    clickTracking: {
        plans: ['FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Track redirect clicks for analytics',
        costPerMessage: 0,
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PAID ONLY - Requires INICIAL or higher
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    templates: {
        plans: ['INICIAL', 'PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Pre-approved message templates (job updates, reminders)',
        costPerMessage: 0.05,
    },

    mediaMessages: {
        plans: ['INICIAL', 'PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Send images, documents, and media',
        costPerMessage: 0.05,
    },

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PREMIUM ONLY - Requires PROFESIONAL or higher
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    interactiveButtons: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Interactive button messages (quick reply, CTA)',
        costPerMessage: 0.05,
    },

    lists: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Interactive list messages',
        costPerMessage: 0.05,
    },

    aiBot: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'AI-powered auto-responses (GPT integration)',
        costPerMessage: 0.08, // Higher due to AI processing
    },

    voiceTranscription: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Automatic voice message transcription (Whisper)',
        costPerMessage: 0.10, // Higher due to audio processing
    },

    conversationAnalytics: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Detailed conversation analytics and reporting',
        costPerMessage: 0,
    },

    readReceipts: {
        plans: ['PROFESIONAL', 'EMPRESA'] as SubscriptionTier[],
        description: 'Message read receipts and delivery confirmations',
        costPerMessage: 0,
    },
} as const;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HELPER FUNCTIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Check if a WhatsApp feature is available for a tier
 */
export function canUseWhatsAppFeature(
    tier: SubscriptionTier,
    feature: WhatsAppFeatureKey
): boolean {
    const featureDef = WHATSAPP_FEATURES[feature];
    if (!featureDef) return false;

    return featureDef.plans.includes(tier);
}

/**
 * âš ï¸ CRITICAL: Check if organization can use WhatsApp Cloud API
 *
 * Only PROFESIONAL and EMPRESA plans get full API access.
 * INICIAL gets limited API (templates only).
 * FREE gets redirect only (zero cost).
 */
export function canUseWhatsAppAPI(
    tier: SubscriptionTier,
    subscriptionStatus: string
): boolean {
    // Never allow API for non-active subscriptions
    if (!['active', 'trialing'].includes(subscriptionStatus)) {
        return false;
    }

    // Only paid plans (not FREE)
    return ['INICIAL', 'PROFESIONAL', 'EMPRESA'].includes(tier);
}

/**
 * Check if organization has full WhatsApp API access (interactive features)
 */
export function hasFullWhatsAppAPI(tier: SubscriptionTier): boolean {
    return ['PROFESIONAL', 'EMPRESA'].includes(tier);
}

/**
 * Get the WhatsApp integration type for a tier
 */
export function getWhatsAppIntegrationType(
    tier: SubscriptionTier
): 'NONE' | 'REDIRECT' | 'LIMITED_API' | 'FULL_API' {
    switch (tier) {
        case 'FREE':
            return 'REDIRECT';
        case 'INICIAL':
            return 'LIMITED_API';
        case 'PROFESIONAL':
        case 'EMPRESA':
            return 'FULL_API';
        default:
            return 'NONE';
    }
}

/**
 * Get all WhatsApp features available for a tier
 */
export function getAvailableWhatsAppFeatures(
    tier: SubscriptionTier
): WhatsAppFeatureKey[] {
    return (Object.keys(WHATSAPP_FEATURES) as WhatsAppFeatureKey[]).filter(
        (feature) => canUseWhatsAppFeature(tier, feature)
    );
}

/**
 * Estimate monthly cost for WhatsApp usage based on tier and volume
 *
 * @param tier - Subscription tier
 * @param estimatedMessages - Estimated monthly message count
 * @returns Estimated monthly cost in USD
 */
export function estimateWhatsAppCost(
    tier: SubscriptionTier,
    estimatedMessages: number
): number {
    // FREE tier has zero cost (redirect only)
    if (tier === 'FREE') {
        return 0;
    }

    // Average cost per message based on typical usage patterns
    const avgCostPerMessage = tier === 'INICIAL' ? 0.05 : 0.06;

    return Math.round(estimatedMessages * avgCostPerMessage * 100) / 100;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UPGRADE PROMPTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Get upgrade prompt message for a blocked WhatsApp feature
 */
export function getWhatsAppUpgradePrompt(
    feature: WhatsAppFeatureKey,
    _currentTier: SubscriptionTier
): { message: string; requiredTier: SubscriptionTier; upgradeUrl: string } {
    const featureDef = WHATSAPP_FEATURES[feature];
    const requiredTier = featureDef.plans[0]; // First (lowest) tier that has this feature

    const messages: Record<WhatsAppFeatureKey, string> = {
        redirect: 'Los enlaces de WhatsApp están disponibles para todos.',
        clickTracking: 'El seguimiento de clics está disponible para todos.',
        templates:
            'Actualizá a Inicial para enviar mensajes automáticos con plantillas aprobadas.',
        mediaMessages:
            'Actualizá a Inicial para enviar imágenes y documentos por WhatsApp.',
        interactiveButtons:
            'Actualizá a Profesional para enviar mensajes con botones interactivos.',
        lists: 'Actualizá a Profesional para enviar listas interactivas.',
        aiBot:
            'Actualizá a Profesional para respuestas automáticas con IA.',
        voiceTranscription:
            'Actualizá a Profesional para transcripción automática de audios.',
        conversationAnalytics:
            'Actualizá a Profesional para analytics de conversaciones.',
        readReceipts:
            'Actualizá a Profesional para ver confirmaciones de lectura.',
    };

    return {
        message: messages[feature],
        requiredTier,
        upgradeUrl: `/dashboard/settings/billing?upgrade=${requiredTier.toLowerCase()}&feature=whatsapp`,
    };
}
