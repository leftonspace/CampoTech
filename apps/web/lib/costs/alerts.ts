/**
 * CampoTech Budget Alerts (Phase 8A.2.1)
 * ======================================
 *
 * Automated budget monitoring and alerting system.
 *
 * Features:
 * - Configurable thresholds per service
 * - Alert deduplication (only send each threshold once per day)
 * - Multiple alert channels (Slack, Discord, etc.)
 * - Daily cost summary reports
 *
 * Usage:
 * ```typescript
 * import { checkBudgetAlerts, sendDailyCostReport } from '@/lib/costs/alerts';
 *
 * // Check budgets (run hourly via cron)
 * await checkBudgetAlerts();
 *
 * // Send daily summary (run at end of day)
 * await sendDailyCostReport();
 * ```
 */

import { Redis } from '@upstash/redis';
import { costs, BUDGET_CONFIG, CostService } from './aggregator';
import { alertManager, AlertSeverity } from '../monitoring/alerts';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BudgetConfig {
  service: string;
  daily: number;
  monthly: number;
  alertThresholds: number[]; // Percentages: [0.5, 0.8, 1.0]
}

interface BudgetAlert {
  service: string;
  period: 'daily' | 'monthly';
  percent: number;
  threshold: number;
  current: number;
  budget: number;
}

interface CostSummary {
  date: string;
  total: number;
  byService: Record<string, number>;
  overBudget: string[];
  nearBudget: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Budget configurations with alert thresholds
 */
const BUDGETS: BudgetConfig[] = [
  { service: 'openai', daily: 50, monthly: 500, alertThresholds: [0.5, 0.8, 1.0] },
  { service: 'twilio', daily: 20, monthly: 200, alertThresholds: [0.8, 1.0] },
  { service: 'supabase', daily: 10, monthly: 100, alertThresholds: [0.9, 1.0] },
  { service: 'vercel', daily: 5, monthly: 50, alertThresholds: [0.9, 1.0] },
  { service: 'maps', daily: 30, monthly: 300, alertThresholds: [0.8, 1.0] },
  { service: 'whatsapp', daily: 15, monthly: 150, alertThresholds: [0.8, 1.0] },
  { service: 'sentry', daily: 2, monthly: 20, alertThresholds: [1.0] },
  { service: 'total', daily: 200, monthly: 2000, alertThresholds: [0.5, 0.8, 0.9, 1.0] },
];

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
// ALERT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check all budget thresholds and send alerts
 * Run this hourly via cron
 */
export async function checkBudgetAlerts(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [dailyBreakdown, monthlyBreakdown] = await Promise.all([
    costs.getBreakdown(today),
    costs.getMonthlyBreakdown(currentMonth),
  ]);

  for (const budget of BUDGETS) {
    // Check daily budget
    const dailyCost = budget.service === 'total'
      ? dailyBreakdown.total
      : (dailyBreakdown.byService[budget.service as CostService] || 0);

    const dailyPercent = dailyCost / budget.daily;

    for (const threshold of budget.alertThresholds) {
      if (dailyPercent >= threshold) {
        await sendBudgetAlert({
          service: budget.service,
          period: 'daily',
          percent: dailyPercent * 100,
          threshold: threshold * 100,
          current: dailyCost,
          budget: budget.daily,
        });
      }
    }

    // Check monthly budget
    const monthlyCost = budget.service === 'total'
      ? monthlyBreakdown.total
      : (monthlyBreakdown.byService[budget.service as CostService] || 0);

    const monthlyPercent = monthlyCost / budget.monthly;

    for (const threshold of budget.alertThresholds) {
      if (monthlyPercent >= threshold) {
        await sendBudgetAlert({
          service: budget.service,
          period: 'monthly',
          percent: monthlyPercent * 100,
          threshold: threshold * 100,
          current: monthlyCost,
          budget: budget.monthly,
        });
      }
    }
  }
}

/**
 * Send a budget alert with deduplication
 */
async function sendBudgetAlert(alert: BudgetAlert): Promise<void> {
  const client = getRedis();

  // Create unique alert key for deduplication
  const date = new Date().toISOString().slice(0, 10);
  const alertKey = `budget:alert:${alert.service}:${alert.period}:${alert.threshold}:${date}`;

  // Check if already sent
  if (client) {
    const alreadySent = await client.get(alertKey);
    if (alreadySent) {
      return;
    }
  }

  // Determine severity
  const severity = alert.percent >= 100
    ? AlertSeverity.ERROR
    : alert.percent >= 80
      ? AlertSeverity.WARNING
      : AlertSeverity.INFO;

  // Format alert message
  const emoji = alert.percent >= 100 ? '🚨' : alert.percent >= 80 ? '⚠️' : '💰';
  const title = `${emoji} ${alert.service.toUpperCase()} ${alert.period} budget at ${alert.percent.toFixed(0)}%`;
  const message = `Current spend: $${alert.current.toFixed(2)} / $${alert.budget} (${alert.period})`;

  // Send alert
  await alertManager.send({
    severity,
    title,
    message,
    context: {
      service: alert.service,
      period: alert.period,
      currentSpend: alert.current,
      budget: alert.budget,
      percentUsed: alert.percent,
    },
    source: 'cost-monitor',
  });

  // Mark as sent (expires at end of day for daily, end of month for monthly)
  if (client) {
    const ttl = alert.period === 'daily' ? 86400 : 86400 * 31;
    await client.set(alertKey, 'sent', { ex: ttl });
  }

  console.log(`[Costs] Alert sent: ${title}`);
}

/**
 * Send daily cost summary report
 * Run this at end of day (e.g., 11:59 PM)
 */
export async function sendDailyCostReport(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const breakdown = await costs.getBreakdown(today);

  const overBudget: string[] = [];
  const nearBudget: string[] = [];

  // Check each service against budget
  for (const budget of BUDGETS) {
    const cost = budget.service === 'total'
      ? breakdown.total
      : (breakdown.byService[budget.service as CostService] || 0);

    const percent = (cost / budget.daily) * 100;

    if (percent >= 100) {
      overBudget.push(`${budget.service}: $${cost.toFixed(2)} (${percent.toFixed(0)}%)`);
    } else if (percent >= 80) {
      nearBudget.push(`${budget.service}: $${cost.toFixed(2)} (${percent.toFixed(0)}%)`);
    }
  }

  // Build summary message
  let message = `Daily Cost Summary for ${today}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Total: $${breakdown.total.toFixed(2)} / $${BUDGET_CONFIG.total.daily}\n\n`;
  message += `By Service:\n`;

  const services: CostService[] = ['openai', 'twilio', 'maps', 'whatsapp', 'supabase', 'vercel', 'sentry'];
  for (const service of services) {
    const cost = breakdown.byService[service] || 0;
    if (cost > 0) {
      message += `  • ${service}: $${cost.toFixed(2)}\n`;
    }
  }

  if (overBudget.length > 0) {
    message += `\n🚨 Over Budget:\n`;
    overBudget.forEach(item => {
      message += `  • ${item}\n`;
    });
  }

  if (nearBudget.length > 0) {
    message += `\n⚠️ Near Budget:\n`;
    nearBudget.forEach(item => {
      message += `  • ${item}\n`;
    });
  }

  // Determine overall severity
  const severity = overBudget.length > 0
    ? AlertSeverity.ERROR
    : nearBudget.length > 0
      ? AlertSeverity.WARNING
      : AlertSeverity.INFO;

  await alertManager.send({
    severity,
    title: `📊 Daily Cost Report: $${breakdown.total.toFixed(2)}`,
    message,
    context: {
      date: today,
      total: breakdown.total,
      overBudgetServices: overBudget.length,
      nearBudgetServices: nearBudget.length,
    },
    source: 'cost-report',
  });

  console.log(`[Costs] Daily report sent for ${today}`);
}

/**
 * Get cost summary for API response
 */
export async function getCostSummary(): Promise<CostSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const breakdown = await costs.getBreakdown(today);

  const overBudget: string[] = [];
  const nearBudget: string[] = [];

  for (const budget of BUDGETS) {
    if (budget.service === 'total') continue;

    const cost = breakdown.byService[budget.service as CostService] || 0;
    const percent = (cost / budget.daily) * 100;

    if (percent >= 100) {
      overBudget.push(budget.service);
    } else if (percent >= 80) {
      nearBudget.push(budget.service);
    }
  }

  return {
    date: today,
    total: breakdown.total,
    byService: breakdown.byService,
    overBudget,
    nearBudget,
  };
}

const costAlerts = {
  checkBudgetAlerts,
  sendDailyCostReport,
  getCostSummary,
};

export default costAlerts;
