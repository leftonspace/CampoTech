/**
 * CampoTech Cost Aggregator (Phase 8A.1.2)
 * =========================================
 *
 * Tracks and aggregates costs from all paid external services.
 *
 * Services tracked:
 * - OpenAI (GPT-4, Whisper)
 * - Twilio (SMS)
 * - Supabase (database, storage)
 * - Vercel (compute, bandwidth)
 * - Google Maps (geocoding)
 *
 * Usage:
 * ```typescript
 * import { costs } from '@/lib/costs/aggregator';
 *
 * // Track a cost
 * await costs.track({
 *   service: 'openai',
 *   amount: 0.05,
 *   organizationId: 'org-123',
 *   metadata: { model: 'gpt-4-turbo', tokens: 1500 },
 * });
 *
 * // Get cost breakdown
 * const breakdown = await costs.getBreakdown('2025-01-15');
 * ```
 */

import { Redis } from '@upstash/redis';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CostService = 'openai' | 'twilio' | 'supabase' | 'vercel' | 'maps' | 'whatsapp' | 'sentry';

export interface CostEntry {
  service: CostService;
  amount: number;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

export interface CostBreakdown {
  date: string;
  total: number;
  byService: Record<CostService, number>;
  budget: number;
  percentUsed: number;
}

export interface DailyCostTrend {
  date: string;
  total: number;
  byService: Record<CostService, number>;
}

export interface TopConsumer {
  organizationId: string;
  total: number;
  byService: Record<CostService, number>;
}

export interface CostDashboardData {
  total: number;
  budget: number;
  byService: Record<CostService, number>;
  dailyTrend: DailyCostTrend[];
  topOrganizations: TopConsumer[];
  alerts: CostAlert[];
}

export interface CostAlert {
  id: string;
  service: string;
  type: 'warning' | 'critical';
  message: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service cost estimates (USD)
 */
export const SERVICE_COSTS = {
  openai: {
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
    'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
    'whisper-1': { perMinute: 0.006 },
  },
  twilio: {
    sms: 0.0079, // per segment
    smsInbound: 0.0075,
  },
  maps: {
    geocode: 0.005,
    directions: 0.005,
    places: 0.017,
  },
  whatsapp: {
    businessInitiated: 0.0058, // Argentina rate
    userInitiated: 0.0035,
  },
} as const;

/**
 * Monthly budget per service (USD)
 */
export const BUDGET_CONFIG = {
  openai: { daily: 50, monthly: 500 },
  twilio: { daily: 20, monthly: 200 },
  maps: { daily: 30, monthly: 300 },
  whatsapp: { daily: 15, monthly: 150 },
  supabase: { daily: 10, monthly: 100 },
  vercel: { daily: 5, monthly: 50 },
  sentry: { daily: 2, monthly: 20 },
  total: { daily: 200, monthly: 2000 },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
  }
  return redis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS KEYS
// ═══════════════════════════════════════════════════════════════════════════════

const KEYS = {
  // Daily totals
  dailyTotal: (date: string) => `costs:${date}:total`,
  dailyService: (date: string, service: string) => `costs:${date}:${service}`,

  // Organization costs
  orgDaily: (date: string, orgId: string) => `costs:${date}:org:${orgId}`,
  orgDailyService: (date: string, orgId: string, service: string) => `costs:${date}:org:${orgId}:${service}`,

  // Monthly aggregates
  monthlyTotal: (month: string) => `costs:month:${month}:total`,
  monthlyService: (month: string, service: string) => `costs:month:${month}:${service}`,

  // Alerts sent (for deduplication)
  alertSent: (alertKey: string) => `costs:alert:${alertKey}`,
};

const TTL_DAYS = 90; // Keep cost data for 90 days
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

// ═══════════════════════════════════════════════════════════════════════════════
// COST AGGREGATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class CostAggregator {
  /**
   * Track a cost entry
   */
  async track(entry: CostEntry): Promise<void> {
    const client = getRedis();
    if (!client) {
      console.warn('[Costs] Redis not configured, skipping cost tracking');
      return;
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);

    try {
      const pipeline = client.pipeline();

      // Daily totals
      pipeline.incrbyfloat(KEYS.dailyTotal(date), entry.amount);
      pipeline.expire(KEYS.dailyTotal(date), TTL_SECONDS);

      pipeline.incrbyfloat(KEYS.dailyService(date, entry.service), entry.amount);
      pipeline.expire(KEYS.dailyService(date, entry.service), TTL_SECONDS);

      // Monthly totals
      pipeline.incrbyfloat(KEYS.monthlyTotal(month), entry.amount);
      pipeline.expire(KEYS.monthlyTotal(month), TTL_SECONDS);

      pipeline.incrbyfloat(KEYS.monthlyService(month, entry.service), entry.amount);
      pipeline.expire(KEYS.monthlyService(month, entry.service), TTL_SECONDS);

      // Organization-specific if provided
      if (entry.organizationId) {
        pipeline.incrbyfloat(KEYS.orgDaily(date, entry.organizationId), entry.amount);
        pipeline.expire(KEYS.orgDaily(date, entry.organizationId), TTL_SECONDS);

        pipeline.incrbyfloat(
          KEYS.orgDailyService(date, entry.organizationId, entry.service),
          entry.amount
        );
        pipeline.expire(
          KEYS.orgDailyService(date, entry.organizationId, entry.service),
          TTL_SECONDS
        );
      }

      await pipeline.exec();

      // Check budget thresholds
      await this.checkThresholds(date, entry.service);
    } catch (error) {
      console.error('[Costs] Error tracking cost:', error);
    }
  }

  /**
   * Get cost breakdown for a specific date
   */
  async getBreakdown(date?: string): Promise<CostBreakdown> {
    const client = getRedis();
    const targetDate = date || new Date().toISOString().slice(0, 10);

    if (!client) {
      return this.emptyBreakdown(targetDate);
    }

    const services: CostService[] = ['openai', 'twilio', 'supabase', 'vercel', 'maps', 'whatsapp', 'sentry'];

    try {
      const pipeline = client.pipeline();
      pipeline.get(KEYS.dailyTotal(targetDate));
      for (const service of services) {
        pipeline.get(KEYS.dailyService(targetDate, service));
      }

      const results = await pipeline.exec();

      const total = parseFloat(String(results[0] || '0'));
      const byService: Record<CostService, number> = {} as Record<CostService, number>;

      services.forEach((service, index) => {
        byService[service] = parseFloat(String(results[index + 1] || '0'));
      });

      const budget = BUDGET_CONFIG.total.daily;
      const percentUsed = budget > 0 ? (total / budget) * 100 : 0;

      return {
        date: targetDate,
        total,
        byService,
        budget,
        percentUsed,
      };
    } catch (error) {
      console.error('[Costs] Error getting breakdown:', error);
      return this.emptyBreakdown(targetDate);
    }
  }

  /**
   * Get monthly cost breakdown
   */
  async getMonthlyBreakdown(month?: string): Promise<CostBreakdown> {
    const client = getRedis();
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    if (!client) {
      return this.emptyBreakdown(targetMonth);
    }

    const services: CostService[] = ['openai', 'twilio', 'supabase', 'vercel', 'maps', 'whatsapp', 'sentry'];

    try {
      const pipeline = client.pipeline();
      pipeline.get(KEYS.monthlyTotal(targetMonth));
      for (const service of services) {
        pipeline.get(KEYS.monthlyService(targetMonth, service));
      }

      const results = await pipeline.exec();

      const total = parseFloat(String(results[0] || '0'));
      const byService: Record<CostService, number> = {} as Record<CostService, number>;

      services.forEach((service, index) => {
        byService[service] = parseFloat(String(results[index + 1] || '0'));
      });

      const budget = BUDGET_CONFIG.total.monthly;
      const percentUsed = budget > 0 ? (total / budget) * 100 : 0;

      return {
        date: targetMonth,
        total,
        byService,
        budget,
        percentUsed,
      };
    } catch (error) {
      console.error('[Costs] Error getting monthly breakdown:', error);
      return this.emptyBreakdown(targetMonth);
    }
  }

  /**
   * Get daily cost trend for the last N days
   */
  async getDailyTrend(days: number = 30): Promise<DailyCostTrend[]> {
    const client = getRedis();
    if (!client) {
      return [];
    }

    const services: CostService[] = ['openai', 'twilio', 'supabase', 'vercel', 'maps', 'whatsapp', 'sentry'];
    const trends: DailyCostTrend[] = [];

    try {
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);

        const pipeline = client.pipeline();
        pipeline.get(KEYS.dailyTotal(dateStr));
        for (const service of services) {
          pipeline.get(KEYS.dailyService(dateStr, service));
        }

        const results = await pipeline.exec();

        const total = parseFloat(String(results[0] || '0'));
        const byService: Record<CostService, number> = {} as Record<CostService, number>;

        services.forEach((service, index) => {
          byService[service] = parseFloat(String(results[index + 1] || '0'));
        });

        trends.push({ date: dateStr, total, byService });
      }

      return trends.reverse();
    } catch (error) {
      console.error('[Costs] Error getting daily trend:', error);
      return [];
    }
  }

  /**
   * Get top cost consumers (organizations)
   */
  async getTopConsumers(date?: string, limit: number = 10): Promise<TopConsumer[]> {
    // This would require scanning all org keys which is expensive
    // In production, maintain a sorted set of top consumers
    // For now, return empty - would be populated by a scheduled job
    return [];
  }

  /**
   * Get full dashboard data
   */
  async getDashboardData(): Promise<CostDashboardData> {
    const [currentMonth, dailyTrend] = await Promise.all([
      this.getMonthlyBreakdown(),
      this.getDailyTrend(30),
    ]);

    return {
      total: currentMonth.total,
      budget: currentMonth.budget,
      byService: currentMonth.byService,
      dailyTrend,
      topOrganizations: [],
      alerts: [],
    };
  }

  /**
   * Check if a budget threshold has been exceeded
   */
  private async checkThresholds(date: string, service: CostService): Promise<void> {
    const client = getRedis();
    if (!client) return;

    const config = BUDGET_CONFIG[service];
    if (!config) return;

    try {
      const current = parseFloat(
        String(await client.get(KEYS.dailyService(date, service)) || '0')
      );

      const percentUsed = (current / config.daily) * 100;

      // Alert at 50%, 80%, and 100%
      const thresholds = [50, 80, 100];

      for (const threshold of thresholds) {
        if (percentUsed >= threshold) {
          const alertKey = `${service}:${date}:${threshold}`;
          const alreadySent = await client.get(KEYS.alertSent(alertKey));

          if (!alreadySent) {
            console.warn(
              `[Costs] ${service} daily spend at ${percentUsed.toFixed(0)}% ` +
              `($${current.toFixed(2)} / $${config.daily})`
            );

            // Mark alert as sent
            await client.set(KEYS.alertSent(alertKey), 'sent', { ex: 86400 });
          }
        }
      }
    } catch (error) {
      console.error('[Costs] Error checking thresholds:', error);
    }
  }

  /**
   * Create empty breakdown structure
   */
  private emptyBreakdown(date: string): CostBreakdown {
    return {
      date,
      total: 0,
      byService: {
        openai: 0,
        twilio: 0,
        supabase: 0,
        vercel: 0,
        maps: 0,
        whatsapp: 0,
        sentry: 0,
      },
      budget: BUDGET_CONFIG.total.daily,
      percentUsed: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate OpenAI cost from token usage
 */
export function calculateOpenAICost(
  model: keyof typeof SERVICE_COSTS.openai,
  inputTokens?: number,
  outputTokens?: number,
  audioMinutes?: number
): number {
  if (model === 'whisper-1' && audioMinutes) {
    return audioMinutes * SERVICE_COSTS.openai['whisper-1'].perMinute;
  }

  const modelCosts = SERVICE_COSTS.openai[model];
  if ('input' in modelCosts && inputTokens && outputTokens) {
    return (inputTokens * modelCosts.input) + (outputTokens * modelCosts.output);
  }

  return 0;
}

/**
 * Calculate Twilio SMS cost
 */
export function calculateTwilioCost(messageLength: number, isInbound: boolean = false): number {
  const segments = Math.ceil(messageLength / 160);
  const costPerSegment = isInbound
    ? SERVICE_COSTS.twilio.smsInbound
    : SERVICE_COSTS.twilio.sms;
  return segments * costPerSegment;
}

/**
 * Calculate Google Maps API cost
 */
export function calculateMapsCost(operation: keyof typeof SERVICE_COSTS.maps): number {
  return SERVICE_COSTS.maps[operation];
}

/**
 * Calculate WhatsApp message cost
 */
export function calculateWhatsAppCost(isBusinessInitiated: boolean): number {
  return isBusinessInitiated
    ? SERVICE_COSTS.whatsapp.businessInitiated
    : SERVICE_COSTS.whatsapp.userInitiated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

export const costs = new CostAggregator();

export default costs;
