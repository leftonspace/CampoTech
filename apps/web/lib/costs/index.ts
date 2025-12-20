/**
 * CampoTech Cost Tracking System (Phase 8A)
 * ==========================================
 *
 * Centralized exports for cost tracking functionality.
 *
 * Usage:
 * ```typescript
 * import {
 *   costs,
 *   trackOpenAICost,
 *   trackTwilioCost,
 *   trackMapsCost,
 *   checkBudgetAlerts,
 * } from '@/lib/costs';
 *
 * // Track OpenAI usage
 * await trackOpenAICost('gpt-4-turbo', 500, 200, 'org-123');
 *
 * // Track SMS
 * await trackTwilioCost('Hello world', false, 'org-123');
 *
 * // Check budgets (cron job)
 * await checkBudgetAlerts();
 * ```
 */

// Core aggregator
export {
  costs,
  CostAggregator,
  SERVICE_COSTS,
  BUDGET_CONFIG,
  calculateOpenAICost,
  calculateTwilioCost,
  calculateMapsCost,
  calculateWhatsAppCost,
  type CostService,
  type CostEntry,
  type CostBreakdown,
  type DailyCostTrend,
  type TopConsumer,
  type CostDashboardData,
} from './aggregator';

// Budget alerts
export {
  checkBudgetAlerts,
  sendDailyCostReport,
  getCostSummary,
} from './alerts';

// Integration helpers
export {
  trackOpenAICost,
  trackTwilioCost,
  trackMapsCost,
  trackWhatsAppCost,
  trackSupabaseCost,
} from './tracking';
