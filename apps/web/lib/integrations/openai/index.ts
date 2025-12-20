/**
 * OpenAI Integration Module
 * =========================
 *
 * Central export file for OpenAI integration with cost controls.
 *
 * Usage:
 *   import { getOpenAIUsageTracker, getOpenAIFallbackHandler } from '@/lib/integrations/openai';
 *
 * Components:
 * - UsageTracker: Tracks costs with daily/monthly budgets
 * - FallbackHandler: Handles escalation when AI unavailable
 */

// Usage tracker
export {
  OpenAIUsageTracker,
  getOpenAIUsageTracker,
  resetOpenAIUsageTracker,
} from './usage-tracker';

// Fallback handler
export {
  OpenAIFallbackHandler,
  getOpenAIFallbackHandler,
  resetOpenAIFallbackHandler,
} from './fallback-handler';

// Types
export type {
  UsageRecord,
  UsageSummary,
  UsageOperation,
  BudgetConfig,
  BudgetStatus,
  FallbackReason,
  FallbackDecision,
  EscalationTicket,
  OpenAIServiceStatus,
  OpenAISystemStatus,
} from './types';

export { MODEL_PRICING, DEFAULT_BUDGET_CONFIG } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { getOpenAIUsageTracker } from './usage-tracker';
import { getOpenAIFallbackHandler } from './fallback-handler';

/**
 * Check if an AI request should proceed
 * Combines budget and service availability checks
 */
export async function canMakeAIRequest(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  escalationMessage?: string;
}> {
  const fallbackHandler = getOpenAIFallbackHandler();
  const decision = await fallbackHandler.shouldFallback(organizationId);

  if (decision.shouldFallback) {
    return {
      allowed: false,
      reason: decision.reason,
      escalationMessage: decision.reason
        ? fallbackHandler.getEscalationMessage(decision.reason)
        : undefined,
    };
  }

  return { allowed: true };
}

/**
 * Record successful OpenAI chat completion with usage tracking
 */
export async function recordChatCompletion(
  organizationId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latency: number
): Promise<void> {
  const tracker = getOpenAIUsageTracker();
  const fallbackHandler = getOpenAIFallbackHandler();

  await tracker.recordChatCompletion(organizationId, model, inputTokens, outputTokens);
  fallbackHandler.recordSuccess(latency);
}

/**
 * Record failed OpenAI request
 */
export function recordAIFailure(error?: Error): void {
  const fallbackHandler = getOpenAIFallbackHandler();
  fallbackHandler.recordFailure(error);
}

/**
 * Record Whisper transcription with usage tracking
 */
export async function recordTranscription(
  organizationId: string,
  audioDurationSeconds: number,
  latency: number
): Promise<void> {
  const tracker = getOpenAIUsageTracker();
  const fallbackHandler = getOpenAIFallbackHandler();

  await tracker.recordTranscription(organizationId, audioDurationSeconds);
  fallbackHandler.recordSuccess(latency);
}

/**
 * Create escalation ticket for human handling
 */
export async function escalateToHuman(params: {
  organizationId: string;
  source: 'whatsapp' | 'voice' | 'api';
  reason: 'budget_exceeded' | 'service_unavailable' | 'low_confidence' | 'manual_escalation';
  customerPhone?: string;
  customerName?: string;
  originalMessage?: string;
  context?: Record<string, unknown>;
}): Promise<{
  ticketId: string;
  escalationMessage: string;
}> {
  const fallbackHandler = getOpenAIFallbackHandler();

  const ticket = await fallbackHandler.createEscalation(params);

  return {
    ticketId: ticket.id,
    escalationMessage: fallbackHandler.getEscalationMessage(params.reason),
  };
}

/**
 * Get current AI system status
 */
export async function getAISystemStatus(organizationId?: string) {
  const fallbackHandler = getOpenAIFallbackHandler();
  return fallbackHandler.getSystemStatus(organizationId);
}
