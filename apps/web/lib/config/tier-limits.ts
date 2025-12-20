/**
 * CampoTech Subscription Tier Limits Configuration
 * =================================================
 *
 * Defines resource limits and pricing for each subscription tier.
 * Designed for Argentine SMB market (1-50 employees typical).
 *
 * Pricing in ARS (Argentine Pesos):
 * - FREE: $0/month - Trial/limited functionality
 * - INICIAL: $25,000/month - For independent workers
 * - PROFESIONAL: $55,000/month - For small businesses (2-5 employees)
 * - EMPRESA: $120,000/month - For medium businesses (6+ employees)
 */

export type SubscriptionTier = 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA';

export interface TierLimits {
  // Core Resources
  maxUsers: number;
  maxJobsPerMonth: number;
  maxCustomers: number;
  maxInvoicesPerMonth: number;

  // Fleet & Inventory
  maxVehicles: number;
  maxProducts: number;

  // Storage (bytes)
  maxStorageBytes: number;
  maxPhotosPerJob: number;
  maxDocumentUploads: number;

  // Communications
  maxWhatsAppMessagesPerMonth: number;

  // API
  maxApiCallsPerDay: number;

  // Pricing Info (for upgrade prompts)
  priceUsd: number;
  priceDisplay: string;
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  limits: TierLimits;
  isDefault?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LIMIT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    maxUsers: 1,
    maxJobsPerMonth: 30,
    maxCustomers: 50,
    maxInvoicesPerMonth: 15,
    maxVehicles: 0,
    maxProducts: 0,
    maxStorageBytes: 50 * BYTES_PER_MB, // 50MB
    maxPhotosPerJob: 3,
    maxDocumentUploads: 10,
    maxWhatsAppMessagesPerMonth: 0,
    maxApiCallsPerDay: 0,
    priceUsd: 0,
    priceDisplay: 'Gratis',
  },

  INICIAL: {
    maxUsers: 1,
    maxJobsPerMonth: 50,
    maxCustomers: 100,
    maxInvoicesPerMonth: 50,
    maxVehicles: 1,
    maxProducts: 50,
    maxStorageBytes: 100 * BYTES_PER_MB, // 100MB
    maxPhotosPerJob: 5,
    maxDocumentUploads: 25,
    maxWhatsAppMessagesPerMonth: 0, // Manual WhatsApp only (no AI)
    maxApiCallsPerDay: 0,
    priceUsd: 25,
    priceDisplay: '$25/mes',
  },

  PROFESIONAL: {
    maxUsers: 5,
    maxJobsPerMonth: 200,
    maxCustomers: 500,
    maxInvoicesPerMonth: 200,
    maxVehicles: 5,
    maxProducts: 200,
    maxStorageBytes: 500 * BYTES_PER_MB, // 500MB
    maxPhotosPerJob: 10,
    maxDocumentUploads: 100,
    maxWhatsAppMessagesPerMonth: 100, // WhatsApp AI conversations/month
    maxApiCallsPerDay: 0,
    priceUsd: 55,
    priceDisplay: '$55/mes',
  },

  EMPRESA: {
    maxUsers: UNLIMITED,
    maxJobsPerMonth: UNLIMITED,
    maxCustomers: UNLIMITED,
    maxInvoicesPerMonth: UNLIMITED,
    maxVehicles: UNLIMITED,
    maxProducts: UNLIMITED,
    maxStorageBytes: 5 * BYTES_PER_GB, // 5GB
    maxPhotosPerJob: 50,
    maxDocumentUploads: UNLIMITED,
    maxWhatsAppMessagesPerMonth: UNLIMITED, // Unlimited WhatsApp AI
    maxApiCallsPerDay: 10000,
    priceUsd: 120,
    priceDisplay: '$120/mes',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIER CONFIGURATIONS (with descriptions)
// ═══════════════════════════════════════════════════════════════════════════════

export const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'FREE',
    name: 'Gratis',
    description: 'Para probar la plataforma',
    limits: TIER_LIMITS.FREE,
    isDefault: true,
  },
  {
    id: 'INICIAL',
    name: 'Inicial',
    description: 'Para trabajadores independientes',
    limits: TIER_LIMITS.INICIAL,
  },
  {
    id: 'PROFESIONAL',
    name: 'Profesional',
    description: 'Para pequeñas empresas (2-5 empleados)',
    limits: TIER_LIMITS.PROFESIONAL,
  },
  {
    id: 'EMPRESA',
    name: 'Empresa',
    description: 'Para empresas medianas (6+ empleados)',
    limits: TIER_LIMITS.EMPRESA,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LIMIT TYPES & ERROR MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export type LimitType =
  | 'users'
  | 'jobs_monthly'
  | 'customers'
  | 'invoices_monthly'
  | 'vehicles'
  | 'products'
  | 'storage'
  | 'photos_per_job'
  | 'document_uploads'
  | 'whatsapp_monthly'
  | 'api_daily';

export const LIMIT_MESSAGES: Record<LimitType, { es: string; labelEs: string }> = {
  users: {
    es: 'Has alcanzado el límite de {limit} usuarios en el plan {tier}.',
    labelEs: 'Usuarios',
  },
  jobs_monthly: {
    es: 'Has alcanzado el límite de {limit} trabajos mensuales en el plan {tier}.',
    labelEs: 'Trabajos/mes',
  },
  customers: {
    es: 'Has alcanzado el límite de {limit} clientes en el plan {tier}.',
    labelEs: 'Clientes',
  },
  invoices_monthly: {
    es: 'Has alcanzado el límite de {limit} facturas mensuales en el plan {tier}.',
    labelEs: 'Facturas/mes',
  },
  vehicles: {
    es: 'Has alcanzado el límite de {limit} vehículos en el plan {tier}.',
    labelEs: 'Vehículos',
  },
  products: {
    es: 'Has alcanzado el límite de {limit} productos en el plan {tier}.',
    labelEs: 'Productos',
  },
  storage: {
    es: 'Has alcanzado el límite de almacenamiento de {limit} en el plan {tier}.',
    labelEs: 'Almacenamiento',
  },
  photos_per_job: {
    es: 'Has alcanzado el límite de {limit} fotos por trabajo en el plan {tier}.',
    labelEs: 'Fotos por trabajo',
  },
  document_uploads: {
    es: 'Has alcanzado el límite de {limit} documentos en el plan {tier}.',
    labelEs: 'Documentos',
  },
  whatsapp_monthly: {
    es: 'Has alcanzado el límite de {limit} mensajes de WhatsApp mensuales en el plan {tier}.',
    labelEs: 'WhatsApp/mes',
  },
  api_daily: {
    es: 'Has alcanzado el límite de {limit} llamadas API diarias en el plan {tier}.',
    labelEs: 'Llamadas API/día',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get tier limits for a specific tier
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
}

/**
 * Get tier configuration with metadata
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig | undefined {
  return TIER_CONFIGS.find(t => t.id === tier);
}

/**
 * Get limit value for a specific limit type and tier
 */
export function getLimit(tier: SubscriptionTier, limitType: LimitType): number {
  const limits = getTierLimits(tier);

  const limitMap: Record<LimitType, number> = {
    users: limits.maxUsers,
    jobs_monthly: limits.maxJobsPerMonth,
    customers: limits.maxCustomers,
    invoices_monthly: limits.maxInvoicesPerMonth,
    vehicles: limits.maxVehicles,
    products: limits.maxProducts,
    storage: limits.maxStorageBytes,
    photos_per_job: limits.maxPhotosPerJob,
    document_uploads: limits.maxDocumentUploads,
    whatsapp_monthly: limits.maxWhatsAppMessagesPerMonth,
    api_daily: limits.maxApiCallsPerDay,
  };

  return limitMap[limitType];
}

/**
 * Check if a value exceeds the limit for a tier
 */
export function isLimitExceeded(
  tier: SubscriptionTier,
  limitType: LimitType,
  currentValue: number,
  additionalAmount: number = 1
): boolean {
  const limit = getLimit(tier, limitType);
  if (limit === UNLIMITED) return false;
  return (currentValue + additionalAmount) > limit;
}

/**
 * Format limit value for display (handle unlimited, bytes, etc.)
 */
export function formatLimitValue(limitType: LimitType, value: number): string {
  if (value === UNLIMITED) return 'Ilimitado';
  if (value === 0) return 'No disponible';

  if (limitType === 'storage') {
    if (value >= BYTES_PER_GB) {
      return `${Math.round(value / BYTES_PER_GB)}GB`;
    }
    return `${Math.round(value / BYTES_PER_MB)}MB`;
  }

  return value.toLocaleString('es-AR');
}

/**
 * Get error message for a limit type
 */
export function getLimitErrorMessage(
  tier: SubscriptionTier,
  limitType: LimitType,
  currentValue: number,
  limitValue: number
): string {
  const tierConfig = getTierConfig(tier);
  const tierName = tierConfig?.name || tier;
  const formattedLimit = formatLimitValue(limitType, limitValue);

  return LIMIT_MESSAGES[limitType].es
    .replace('{limit}', formattedLimit)
    .replace('{tier}', tierName);
}

/**
 * Get upgrade options for a tier
 */
export function getUpgradeOptions(
  currentTier: SubscriptionTier,
  limitType: LimitType
): Array<{ tier: SubscriptionTier; tierName: string; limit: string; price: string }> {
  const tierOrder: SubscriptionTier[] = ['FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA'];
  const currentIndex = tierOrder.indexOf(currentTier);

  return tierOrder
    .slice(currentIndex + 1)
    .map(tier => {
      const config = getTierConfig(tier)!;
      const limitValue = getLimit(tier, limitType);
      return {
        tier,
        tierName: config.name,
        limit: formatLimitValue(limitType, limitValue),
        price: config.limits.priceDisplay,
      };
    });
}

/**
 * Get tier order (for comparison)
 */
export function getTierOrder(tier: SubscriptionTier): number {
  const order: Record<SubscriptionTier, number> = {
    FREE: 0,
    INICIAL: 1,
    PROFESIONAL: 2,
    EMPRESA: 3,
  };
  return order[tier] ?? 0;
}

/**
 * Check if tier A is higher than tier B
 */
export function isTierHigher(tierA: SubscriptionTier, tierB: SubscriptionTier): boolean {
  return getTierOrder(tierA) > getTierOrder(tierB);
}

/**
 * Get the minimum tier required for a specific limit value
 */
export function getMinimumTierForLimit(limitType: LimitType, requiredValue: number): SubscriptionTier {
  const tierOrder: SubscriptionTier[] = ['FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA'];

  for (const tier of tierOrder) {
    const limitValue = getLimit(tier, limitType);
    if (limitValue === UNLIMITED || limitValue >= requiredValue) {
      return tier;
    }
  }

  return 'EMPRESA'; // Default to highest tier
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE OPTIMIZATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

export const STORAGE_RULES = {
  // Photo compression settings
  photos: {
    maxWidth: 800,
    quality: 0.7, // 70% JPEG quality
    format: 'jpeg' as const,
    maxFileSizeBytes: 2 * BYTES_PER_MB, // 2MB max after compression
  },

  // Document settings
  documents: {
    maxFileSizeBytes: 5 * BYTES_PER_MB, // 5MB per file
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
  },

  // Voice messages
  voiceMessages: {
    maxDurationSeconds: 120, // 2 minutes
    deleteAfterTranscription: true, // Keep only text
    compressedFormat: 'opus' as const,
  },

  // Signatures
  signatures: {
    maxWidth: 400,
    format: 'png' as const,
    quality: 0.8,
  },

  // Cleanup settings
  cleanup: {
    orphanedFilesRetentionDays: 30,
    cleanupFrequency: 'weekly' as const,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WARNING THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════════

export const WARNING_THRESHOLD = 0.8; // 80% usage triggers warning

/**
 * Check if usage is approaching limit (>80%)
 */
export function isApproachingLimit(currentValue: number, limitValue: number): boolean {
  if (limitValue === UNLIMITED || limitValue === 0) return false;
  return (currentValue / limitValue) >= WARNING_THRESHOLD;
}

/**
 * Calculate usage percentage
 */
export function getUsagePercentage(currentValue: number, limitValue: number): number {
  if (limitValue === UNLIMITED) return 0;
  if (limitValue === 0) return 100;
  return Math.min(100, Math.round((currentValue / limitValue) * 100));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default TIER_LIMITS;
