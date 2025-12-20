/**
 * CampoTech Usage Tracker Service
 * ================================
 *
 * Tracks resource usage per organization for tier limit enforcement.
 * Uses PostgreSQL for persistent storage with monthly reset.
 *
 * Tables required:
 * - organization_usage: Monthly counters (jobs, invoices, whatsapp, storage)
 * - organization_usage_daily: Daily API call tracking (auto-cleanup after 7 days)
 */

import { prisma } from '@/lib/prisma';
import {
  SubscriptionTier,
  LimitType,
  getTierLimits,
  isLimitExceeded,
  isApproachingLimit,
  getUsagePercentage,
  getLimitErrorMessage,
  getUpgradeOptions,
  formatLimitValue,
} from '@/lib/config/tier-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// SQL INJECTION PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

// Allowed column names for usage tracking (whitelist for SQL injection prevention)
const ALLOWED_USAGE_COLUMNS = new Set([
  'jobs_count',
  'invoices_count',
  'whatsapp_messages',
  'storage_bytes',
]);

/**
 * Validate column name against allowed columns
 * @throws Error if column name is not in whitelist
 */
function validateUsageColumn(column: string): void {
  if (!ALLOWED_USAGE_COLUMNS.has(column)) {
    throw new Error(`Invalid usage column: ${column}. Not in allowed columns list.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationUsage {
  orgId: string;
  period: string; // YYYY-MM format
  jobsCount: number;
  invoicesCount: number;
  whatsappMessages: number;
  apiCalls: number;
  storageBytes: number;
  updatedAt: Date;
}

export interface UsageCheckResult {
  allowed: boolean;
  currentValue: number;
  limitValue: number;
  limitType: LimitType;
  tier: SubscriptionTier;
  message?: string;
  isApproaching?: boolean;
  upgradeOptions?: Array<{ tier: SubscriptionTier; tierName: string; limit: string; price: string }>;
}

export interface LimitExceededError {
  error: 'limit_exceeded';
  limit_type: LimitType;
  current_value: number;
  limit_value: number;
  tier: SubscriptionTier;
  message: string;
  upgrade_options: Array<{ tier: string; limit: string; price: string }>;
  upgrade_url: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current billing period in YYYY-MM format
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKING CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class UsageTracker {
  /**
   * Get or create monthly usage record for an organization
   */
  async getOrCreateMonthlyUsage(orgId: string): Promise<OrganizationUsage> {
    const period = getCurrentPeriod();

    try {
      // Try to get existing record
      const existing = await prisma.$queryRaw<OrganizationUsage[]>`
        SELECT
          org_id as "orgId",
          period,
          jobs_count as "jobsCount",
          invoices_count as "invoicesCount",
          whatsapp_messages as "whatsappMessages",
          api_calls as "apiCalls",
          storage_bytes as "storageBytes",
          updated_at as "updatedAt"
        FROM organization_usage
        WHERE org_id = ${orgId}::uuid AND period = ${period}
        LIMIT 1
      `;

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new record for this month
      await prisma.$executeRaw`
        INSERT INTO organization_usage (org_id, period, jobs_count, invoices_count, whatsapp_messages, api_calls, storage_bytes)
        VALUES (${orgId}::uuid, ${period}, 0, 0, 0, 0, 0)
        ON CONFLICT (org_id, period) DO NOTHING
      `;

      return {
        orgId,
        period,
        jobsCount: 0,
        invoicesCount: 0,
        whatsappMessages: 0,
        apiCalls: 0,
        storageBytes: 0,
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error getting monthly usage:', error);
      // Return zeros on error - fail open for now
      return {
        orgId,
        period,
        jobsCount: 0,
        invoicesCount: 0,
        whatsappMessages: 0,
        apiCalls: 0,
        storageBytes: 0,
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Increment a monthly counter
   * Uses whitelisted column names to prevent SQL injection
   */
  async incrementMonthlyCounter(
    orgId: string,
    counterType: 'jobs' | 'invoices' | 'whatsapp' | 'storage',
    amount: number = 1
  ): Promise<void> {
    const period = getCurrentPeriod();

    const columnMap = {
      jobs: 'jobs_count',
      invoices: 'invoices_count',
      whatsapp: 'whatsapp_messages',
      storage: 'storage_bytes',
    } as const;

    const column = columnMap[counterType];

    // Validate column name against whitelist
    validateUsageColumn(column);

    try {
      // Column name is safe after validation
      await prisma.$executeRawUnsafe(`
        INSERT INTO organization_usage (org_id, period, ${column})
        VALUES ($1::uuid, $2, $3)
        ON CONFLICT (org_id, period)
        DO UPDATE SET ${column} = organization_usage.${column} + $3, updated_at = NOW()
      `, orgId, period, amount);
    } catch (error) {
      console.error(`Error incrementing ${counterType} counter:`, error);
    }
  }

  /**
   * Decrement a monthly counter (for deletions/returns)
   * Uses whitelisted column names to prevent SQL injection
   */
  async decrementMonthlyCounter(
    orgId: string,
    counterType: 'jobs' | 'invoices' | 'whatsapp' | 'storage',
    amount: number = 1
  ): Promise<void> {
    const period = getCurrentPeriod();

    const columnMap = {
      jobs: 'jobs_count',
      invoices: 'invoices_count',
      whatsapp: 'whatsapp_messages',
      storage: 'storage_bytes',
    } as const;

    const column = columnMap[counterType];

    // Validate column name against whitelist
    validateUsageColumn(column);

    try {
      // Column name is safe after validation
      await prisma.$executeRawUnsafe(`
        UPDATE organization_usage
        SET ${column} = GREATEST(0, ${column} - $3), updated_at = NOW()
        WHERE org_id = $1::uuid AND period = $2
      `, orgId, period, amount);
    } catch (error) {
      console.error(`Error decrementing ${counterType} counter:`, error);
    }
  }

  /**
   * Get daily API calls count (for rate limiting)
   */
  async getDailyApiCalls(orgId: string): Promise<number> {
    const today = getTodayDate();

    try {
      const result = await prisma.$queryRaw<Array<{ api_calls: number }>>`
        SELECT api_calls
        FROM organization_usage_daily
        WHERE org_id = ${orgId}::uuid AND date = ${today}::date
        LIMIT 1
      `;

      return result[0]?.api_calls ?? 0;
    } catch (error) {
      console.error('Error getting daily API calls:', error);
      return 0;
    }
  }

  /**
   * Increment daily API calls
   */
  async incrementDailyApiCalls(orgId: string, amount: number = 1): Promise<void> {
    const today = getTodayDate();

    try {
      await prisma.$executeRaw`
        INSERT INTO organization_usage_daily (org_id, date, api_calls)
        VALUES (${orgId}::uuid, ${today}::date, ${amount})
        ON CONFLICT (org_id, date)
        DO UPDATE SET api_calls = organization_usage_daily.api_calls + ${amount}
      `;
    } catch (error) {
      console.error('Error incrementing daily API calls:', error);
    }
  }

  /**
   * Get total user count for an organization
   */
  async getUserCount(orgId: string): Promise<number> {
    try {
      const result = await prisma.user.count({
        where: { organizationId: orgId, isActive: true },
      });
      return result;
    } catch (error) {
      console.error('Error getting user count:', error);
      return 0;
    }
  }

  /**
   * Get total customer count for an organization
   */
  async getCustomerCount(orgId: string): Promise<number> {
    try {
      const result = await prisma.customer.count({
        where: { organizationId: orgId },
      });
      return result;
    } catch (error) {
      console.error('Error getting customer count:', error);
      return 0;
    }
  }

  /**
   * Get total vehicle count for an organization
   */
  async getVehicleCount(orgId: string): Promise<number> {
    try {
      const result = await prisma.vehicle.count({
        where: { organizationId: orgId, status: { not: 'RETIRED' } },
      });
      return result;
    } catch (error) {
      console.error('Error getting vehicle count:', error);
      return 0;
    }
  }

  /**
   * Get total product count for an organization
   */
  async getProductCount(orgId: string): Promise<number> {
    try {
      const result = await prisma.product.count({
        where: { organizationId: orgId, isActive: true },
      });
      return result;
    } catch (error) {
      console.error('Error getting product count:', error);
      return 0;
    }
  }

  /**
   * Get photo count for a specific job
   */
  async getJobPhotoCount(jobId: string): Promise<number> {
    try {
      const result = await prisma.jobPhoto.count({
        where: { jobId },
      });
      return result;
    } catch (error) {
      console.error('Error getting job photo count:', error);
      return 0;
    }
  }

  /**
   * Get total document uploads count for an organization
   */
  async getDocumentUploadCount(orgId: string): Promise<number> {
    try {
      // Count vehicle documents + any other document types
      const vehicleDocCount = await prisma.vehicleDocument.count({
        where: { vehicle: { organizationId: orgId } },
      });
      return vehicleDocCount;
    } catch (error) {
      console.error('Error getting document upload count:', error);
      return 0;
    }
  }

  /**
   * Get organization's subscription tier
   */
  async getOrganizationTier(orgId: string): Promise<SubscriptionTier> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      });

      const settings = org?.settings as Record<string, unknown> | null;
      const tier = settings?.subscriptionTier as SubscriptionTier | undefined;

      return tier || 'FREE';
    } catch (error) {
      console.error('Error getting organization tier:', error);
      return 'FREE';
    }
  }

  /**
   * Check if an action is allowed based on tier limits
   */
  async checkLimit(
    orgId: string,
    limitType: LimitType,
    additionalAmount: number = 1
  ): Promise<UsageCheckResult> {
    const tier = await this.getOrganizationTier(orgId);
    const limits = getTierLimits(tier);

    let currentValue: number;
    let limitValue: number;

    // Get current value based on limit type
    switch (limitType) {
      case 'users':
        currentValue = await this.getUserCount(orgId);
        limitValue = limits.maxUsers;
        break;

      case 'jobs_monthly': {
        const usage = await this.getOrCreateMonthlyUsage(orgId);
        currentValue = usage.jobsCount;
        limitValue = limits.maxJobsPerMonth;
        break;
      }

      case 'customers':
        currentValue = await this.getCustomerCount(orgId);
        limitValue = limits.maxCustomers;
        break;

      case 'invoices_monthly': {
        const usage = await this.getOrCreateMonthlyUsage(orgId);
        currentValue = usage.invoicesCount;
        limitValue = limits.maxInvoicesPerMonth;
        break;
      }

      case 'vehicles':
        currentValue = await this.getVehicleCount(orgId);
        limitValue = limits.maxVehicles;
        break;

      case 'products':
        currentValue = await this.getProductCount(orgId);
        limitValue = limits.maxProducts;
        break;

      case 'storage': {
        const usage = await this.getOrCreateMonthlyUsage(orgId);
        currentValue = usage.storageBytes;
        limitValue = limits.maxStorageBytes;
        break;
      }

      case 'document_uploads':
        currentValue = await this.getDocumentUploadCount(orgId);
        limitValue = limits.maxDocumentUploads;
        break;

      case 'whatsapp_monthly': {
        const usage = await this.getOrCreateMonthlyUsage(orgId);
        currentValue = usage.whatsappMessages;
        limitValue = limits.maxWhatsAppMessagesPerMonth;
        break;
      }

      case 'api_daily':
        currentValue = await this.getDailyApiCalls(orgId);
        limitValue = limits.maxApiCallsPerDay;
        break;

      default:
        currentValue = 0;
        limitValue = Number.MAX_SAFE_INTEGER;
    }

    const exceeded = isLimitExceeded(tier, limitType, currentValue, additionalAmount);
    const approaching = isApproachingLimit(currentValue, limitValue);

    if (exceeded) {
      return {
        allowed: false,
        currentValue,
        limitValue,
        limitType,
        tier,
        message: getLimitErrorMessage(tier, limitType, currentValue, limitValue),
        upgradeOptions: getUpgradeOptions(tier, limitType),
      };
    }

    return {
      allowed: true,
      currentValue,
      limitValue,
      limitType,
      tier,
      isApproaching: approaching,
    };
  }

  /**
   * Check if a job photo upload is allowed
   */
  async checkJobPhotoLimit(
    orgId: string,
    jobId: string,
    additionalPhotos: number = 1
  ): Promise<UsageCheckResult> {
    const tier = await this.getOrganizationTier(orgId);
    const limits = getTierLimits(tier);
    const currentValue = await this.getJobPhotoCount(jobId);
    const limitValue = limits.maxPhotosPerJob;

    const exceeded = isLimitExceeded(tier, 'photos_per_job', currentValue, additionalPhotos);

    if (exceeded) {
      return {
        allowed: false,
        currentValue,
        limitValue,
        limitType: 'photos_per_job',
        tier,
        message: getLimitErrorMessage(tier, 'photos_per_job', currentValue, limitValue),
        upgradeOptions: getUpgradeOptions(tier, 'photos_per_job'),
      };
    }

    return {
      allowed: true,
      currentValue,
      limitValue,
      limitType: 'photos_per_job',
      tier,
    };
  }

  /**
   * Get complete usage summary for an organization
   */
  async getUsageSummary(orgId: string): Promise<{
    tier: SubscriptionTier;
    period: string;
    usage: Record<LimitType, { current: number; limit: number; percentage: number; formatted: { current: string; limit: string } }>;
  }> {
    const tier = await this.getOrganizationTier(orgId);
    const limits = getTierLimits(tier);
    const monthlyUsage = await this.getOrCreateMonthlyUsage(orgId);

    const userCount = await this.getUserCount(orgId);
    const customerCount = await this.getCustomerCount(orgId);
    const vehicleCount = await this.getVehicleCount(orgId);
    const productCount = await this.getProductCount(orgId);
    const documentCount = await this.getDocumentUploadCount(orgId);
    const dailyApiCalls = await this.getDailyApiCalls(orgId);

    const createUsageEntry = (current: number, limit: number, limitType: LimitType) => ({
      current,
      limit,
      percentage: getUsagePercentage(current, limit),
      formatted: {
        current: formatLimitValue(limitType, current),
        limit: formatLimitValue(limitType, limit),
      },
    });

    return {
      tier,
      period: monthlyUsage.period,
      usage: {
        users: createUsageEntry(userCount, limits.maxUsers, 'users'),
        jobs_monthly: createUsageEntry(monthlyUsage.jobsCount, limits.maxJobsPerMonth, 'jobs_monthly'),
        customers: createUsageEntry(customerCount, limits.maxCustomers, 'customers'),
        invoices_monthly: createUsageEntry(monthlyUsage.invoicesCount, limits.maxInvoicesPerMonth, 'invoices_monthly'),
        vehicles: createUsageEntry(vehicleCount, limits.maxVehicles, 'vehicles'),
        products: createUsageEntry(productCount, limits.maxProducts, 'products'),
        storage: createUsageEntry(monthlyUsage.storageBytes, limits.maxStorageBytes, 'storage'),
        photos_per_job: createUsageEntry(0, limits.maxPhotosPerJob, 'photos_per_job'), // Per-job, not global
        document_uploads: createUsageEntry(documentCount, limits.maxDocumentUploads, 'document_uploads'),
        whatsapp_monthly: createUsageEntry(monthlyUsage.whatsappMessages, limits.maxWhatsAppMessagesPerMonth, 'whatsapp_monthly'),
        api_daily: createUsageEntry(dailyApiCalls, limits.maxApiCallsPerDay, 'api_daily'),
      },
    };
  }

  /**
   * Create limit exceeded error response
   */
  createLimitExceededResponse(result: UsageCheckResult): LimitExceededError {
    return {
      error: 'limit_exceeded',
      limit_type: result.limitType,
      current_value: result.currentValue,
      limit_value: result.limitValue,
      tier: result.tier,
      message: result.message || '',
      upgrade_options: (result.upgradeOptions || []).map(opt => ({
        tier: opt.tier,
        limit: opt.limit,
        price: opt.price,
      })),
      upgrade_url: '/settings/billing/upgrade',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let usageTrackerInstance: UsageTracker | null = null;

export function getUsageTracker(): UsageTracker {
  if (!usageTrackerInstance) {
    usageTrackerInstance = new UsageTracker();
  }
  return usageTrackerInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const usageTracker = getUsageTracker();
