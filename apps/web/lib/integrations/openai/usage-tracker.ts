/**
 * OpenAI Usage Tracker
 * ====================
 *
 * Tracks OpenAI API usage and costs with daily/monthly budgets.
 * Provides real-time budget monitoring and usage analytics.
 *
 * Features:
 * - Per-model cost calculation
 * - Daily and monthly budget tracking
 * - Per-organization usage limits
 * - Usage analytics and reporting
 */

import { prisma } from '@/lib/prisma';
import {
  UsageRecord,
  UsageSummary,
  UsageOperation,
  BudgetConfig,
  BudgetStatus,
  MODEL_PRICING,
  DEFAULT_BUDGET_CONFIG,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

export class OpenAIUsageTracker {
  private config: BudgetConfig;
  private cache: UsageCache;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
    this.cache = new UsageCache();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECORDING USAGE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record usage from a chat completion
   */
  async recordChatCompletion(
    organizationId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    operation: UsageOperation = 'chat_completion',
    metadata?: Record<string, unknown>
  ): Promise<UsageRecord> {
    const cost = this.calculateTokenCost(model, inputTokens, outputTokens);

    return this.recordUsage({
      organizationId,
      model,
      operation,
      inputTokens,
      outputTokens,
      cost,
      metadata,
    });
  }

  /**
   * Record usage from audio transcription (Whisper)
   */
  async recordTranscription(
    organizationId: string,
    audioDurationSeconds: number,
    metadata?: Record<string, unknown>
  ): Promise<UsageRecord> {
    const audioDurationMinutes = audioDurationSeconds / 60;
    const cost = this.calculateAudioCost(audioDurationMinutes);

    return this.recordUsage({
      organizationId,
      model: 'whisper-1',
      operation: 'transcription',
      inputTokens: 0,
      outputTokens: 0,
      audioDurationSeconds,
      cost,
      metadata,
    });
  }

  /**
   * Record usage for embedding generation
   */
  async recordEmbedding(
    organizationId: string,
    model: string,
    tokens: number,
    metadata?: Record<string, unknown>
  ): Promise<UsageRecord> {
    const cost = this.calculateTokenCost(model, tokens, 0);

    return this.recordUsage({
      organizationId,
      model,
      operation: 'embedding',
      inputTokens: tokens,
      outputTokens: 0,
      cost,
      metadata,
    });
  }

  /**
   * Generic usage recording
   */
  private async recordUsage(data: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<UsageRecord> {
    const record: UsageRecord = {
      ...data,
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Store in database
    try {
      await prisma.openAIUsage.create({
        data: {
          id: record.id,
          organizationId: record.organizationId,
          model: record.model,
          operation: record.operation,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          audioDurationSeconds: record.audioDurationSeconds,
          cost: record.cost,
          metadata: record.metadata as object,
          timestamp: record.timestamp,
        },
      });
    } catch (error) {
      // If table doesn't exist, use in-memory tracking
      console.warn('[OpenAI Usage] Database write failed, using cache:', error);
    }

    // Update cache
    this.cache.addUsage(record);

    return record;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COST CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculate cost for token usage
   */
  calculateTokenCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      console.warn(`[OpenAI Usage] Unknown model: ${model}, using gpt-4o-mini pricing`);
      const fallback = MODEL_PRICING['gpt-4o-mini'];
      return (inputTokens / 1000) * fallback.input + (outputTokens / 1000) * fallback.output;
    }

    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  /**
   * Calculate cost for audio transcription
   */
  calculateAudioCost(durationMinutes: number): number {
    const pricing = MODEL_PRICING['whisper-1'];
    return durationMinutes * pricing.input;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BUDGET CHECKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get current budget status
   */
  async getBudgetStatus(organizationId?: string): Promise<BudgetStatus> {
    const dailySpend = await this.getDailySpend(organizationId);
    const monthlySpend = await this.getMonthlySpend(organizationId);

    // Get limits (org-specific if available)
    const limits = organizationId && this.config.orgLimits?.[organizationId]
      ? this.config.orgLimits[organizationId]
      : { daily: this.config.dailyLimit, monthly: this.config.monthlyLimit };

    const dailyUsagePercent = (dailySpend / limits.daily) * 100;
    const monthlyUsagePercent = (monthlySpend / limits.monthly) * 100;

    const isDailyExceeded = dailySpend >= limits.daily;
    const isMonthlyExceeded = monthlySpend >= limits.monthly;
    const isApproachingLimit =
      dailyUsagePercent >= this.config.warningThreshold * 100 ||
      monthlyUsagePercent >= this.config.warningThreshold * 100;

    let canProceed = true;
    let blockedReason: string | undefined;

    if (this.config.hardLimit) {
      if (isDailyExceeded) {
        canProceed = false;
        blockedReason = `Daily budget exceeded ($${dailySpend.toFixed(2)}/$${limits.daily})`;
      } else if (isMonthlyExceeded) {
        canProceed = false;
        blockedReason = `Monthly budget exceeded ($${monthlySpend.toFixed(2)}/$${limits.monthly})`;
      }
    }

    return {
      dailySpend,
      monthlySpend,
      dailyLimit: limits.daily,
      monthlyLimit: limits.monthly,
      dailyUsagePercent: Math.min(100, dailyUsagePercent),
      monthlyUsagePercent: Math.min(100, monthlyUsagePercent),
      isDailyExceeded,
      isMonthlyExceeded,
      isApproachingLimit,
      canProceed,
      blockedReason,
    };
  }

  /**
   * Check if a request should be allowed based on budget
   */
  async canProceed(organizationId?: string): Promise<{
    allowed: boolean;
    reason?: string;
    budgetStatus: BudgetStatus;
  }> {
    const status = await this.getBudgetStatus(organizationId);

    return {
      allowed: status.canProceed,
      reason: status.blockedReason,
      budgetStatus: status,
    };
  }

  /**
   * Estimate cost for a planned request
   */
  estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): number {
    return this.calculateTokenCost(model, estimatedInputTokens, estimatedOutputTokens);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USAGE QUERIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's total spend
   */
  async getDailySpend(organizationId?: string): Promise<number> {
    // Check cache first
    const cached = this.cache.getDailySpend(organizationId);
    if (cached !== null) {
      return cached;
    }

    // Query database
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const result = await prisma.openAIUsage.aggregate({
        where: {
          ...(organizationId && { organizationId }),
          timestamp: { gte: today },
        },
        _sum: { cost: true },
      });

      return result._sum.cost || 0;
    } catch {
      // Fall back to cache if database unavailable
      return this.cache.getDailySpend(organizationId) || 0;
    }
  }

  /**
   * Get this month's total spend
   */
  async getMonthlySpend(organizationId?: string): Promise<number> {
    // Check cache first
    const cached = this.cache.getMonthlySpend(organizationId);
    if (cached !== null) {
      return cached;
    }

    // Query database
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    try {
      const result = await prisma.openAIUsage.aggregate({
        where: {
          ...(organizationId && { organizationId }),
          timestamp: { gte: monthStart },
        },
        _sum: { cost: true },
      });

      return result._sum.cost || 0;
    } catch {
      return this.cache.getMonthlySpend(organizationId) || 0;
    }
  }

  /**
   * Get usage summary for a period
   */
  async getUsageSummary(
    period: 'daily' | 'monthly',
    organizationId?: string
  ): Promise<UsageSummary> {
    const now = new Date();
    let startDate: Date;

    if (period === 'daily') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    try {
      const records = await prisma.openAIUsage.findMany({
        where: {
          ...(organizationId && { organizationId }),
          timestamp: { gte: startDate },
        },
      });

      return this.aggregateRecords(records as UsageRecord[], period, startDate, now);
    } catch {
      // Use cache if database unavailable
      return this.aggregateRecords(
        this.cache.getRecords(organizationId),
        period,
        startDate,
        now
      );
    }
  }

  /**
   * Aggregate usage records into summary
   */
  private aggregateRecords(
    records: UsageRecord[],
    period: 'daily' | 'monthly',
    startDate: Date,
    endDate: Date
  ): UsageSummary {
    const byModel: UsageSummary['byModel'] = {};
    const byOperation: UsageSummary['byOperation'] = {} as UsageSummary['byOperation'];

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalAudioMinutes = 0;

    for (const record of records) {
      totalCost += record.cost;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalAudioMinutes += (record.audioDurationSeconds || 0) / 60;

      // By model
      if (!byModel[record.model]) {
        byModel[record.model] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      }
      byModel[record.model].requests++;
      byModel[record.model].inputTokens += record.inputTokens;
      byModel[record.model].outputTokens += record.outputTokens;
      byModel[record.model].cost += record.cost;

      // By operation
      if (!byOperation[record.operation]) {
        byOperation[record.operation] = { requests: 0, cost: 0 };
      }
      byOperation[record.operation].requests++;
      byOperation[record.operation].cost += record.cost;
    }

    return {
      period,
      startDate,
      endDate,
      totalCost,
      totalRequests: records.length,
      totalInputTokens,
      totalOutputTokens,
      totalAudioMinutes,
      byModel,
      byOperation,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update budget configuration
   */
  updateConfig(config: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set organization-specific limits
   */
  setOrgLimits(orgId: string, daily: number, monthly: number): void {
    if (!this.config.orgLimits) {
      this.config.orgLimits = {};
    }
    this.config.orgLimits[orgId] = { daily, monthly };
  }

  /**
   * Get current configuration
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE
// ═══════════════════════════════════════════════════════════════════════════════

class UsageCache {
  private records: UsageRecord[] = [];
  private dailyTotals: Map<string, number> = new Map();
  private monthlyTotals: Map<string, number> = new Map();
  private lastCleanup: Date = new Date();

  addUsage(record: UsageRecord): void {
    this.records.push(record);
    this.updateTotals(record);
    this.cleanup();
  }

  private updateTotals(record: UsageRecord): void {
    const orgKey = record.organizationId || 'global';
    const globalKey = 'global';

    // Update daily
    const dailyOrg = this.dailyTotals.get(orgKey) || 0;
    const dailyGlobal = this.dailyTotals.get(globalKey) || 0;
    this.dailyTotals.set(orgKey, dailyOrg + record.cost);
    if (orgKey !== globalKey) {
      this.dailyTotals.set(globalKey, dailyGlobal + record.cost);
    }

    // Update monthly
    const monthlyOrg = this.monthlyTotals.get(orgKey) || 0;
    const monthlyGlobal = this.monthlyTotals.get(globalKey) || 0;
    this.monthlyTotals.set(orgKey, monthlyOrg + record.cost);
    if (orgKey !== globalKey) {
      this.monthlyTotals.set(globalKey, monthlyGlobal + record.cost);
    }
  }

  getDailySpend(organizationId?: string): number | null {
    const key = organizationId || 'global';
    return this.dailyTotals.get(key) ?? null;
  }

  getMonthlySpend(organizationId?: string): number | null {
    const key = organizationId || 'global';
    return this.monthlyTotals.get(key) ?? null;
  }

  getRecords(organizationId?: string): UsageRecord[] {
    if (organizationId) {
      return this.records.filter((r) => r.organizationId === organizationId);
    }
    return [...this.records];
  }

  private cleanup(): void {
    const now = new Date();
    const hoursSinceCleanup =
      (now.getTime() - this.lastCleanup.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCleanup < 1) return;

    // Reset daily totals if day changed
    const today = now.toDateString();
    const lastDay = this.lastCleanup.toDateString();
    if (today !== lastDay) {
      this.dailyTotals.clear();
    }

    // Reset monthly totals if month changed
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
    const lastMonth = `${this.lastCleanup.getFullYear()}-${this.lastCleanup.getMonth()}`;
    if (thisMonth !== lastMonth) {
      this.monthlyTotals.clear();
    }

    // Keep only last 24 hours of records
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.records = this.records.filter((r) => r.timestamp > cutoff);

    this.lastCleanup = now;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let usageTracker: OpenAIUsageTracker | null = null;

export function getOpenAIUsageTracker(): OpenAIUsageTracker {
  if (!usageTracker) {
    usageTracker = new OpenAIUsageTracker();
  }
  return usageTracker;
}

export function resetOpenAIUsageTracker(): void {
  usageTracker = null;
}
