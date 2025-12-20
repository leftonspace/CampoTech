/**
 * OpenAI Integration Types
 * ========================
 *
 * Type definitions for OpenAI cost controls and usage tracking.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * OpenAI model pricing (USD per 1K tokens)
 * Updated: December 2024
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // GPT-4o models
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },

  // GPT-4 Turbo
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },

  // GPT-4
  'gpt-4': { input: 0.03, output: 0.06 },

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },

  // Whisper
  'whisper-1': { input: 0.006, output: 0 }, // Per minute of audio

  // Embeddings
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE TRACKING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UsageRecord {
  id: string;
  organizationId: string;
  model: string;
  operation: UsageOperation;
  inputTokens: number;
  outputTokens: number;
  audioDurationSeconds?: number;
  cost: number; // USD
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type UsageOperation =
  | 'chat_completion'
  | 'transcription'
  | 'embedding'
  | 'extraction'
  | 'voice_processing'
  | 'whatsapp_ai';

export interface UsageSummary {
  period: 'daily' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalAudioMinutes: number;
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
  byOperation: Record<UsageOperation, {
    requests: number;
    cost: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BudgetConfig {
  /** Daily budget in USD */
  dailyLimit: number;
  /** Monthly budget in USD */
  monthlyLimit: number;
  /** Warning threshold (0-1, e.g., 0.8 = 80%) */
  warningThreshold: number;
  /** Hard limit - stop all AI when exceeded */
  hardLimit: boolean;
  /** Per-organization limits (optional) */
  orgLimits?: Record<string, {
    daily: number;
    monthly: number;
  }>;
}

export interface BudgetStatus {
  /** Current daily spend */
  dailySpend: number;
  /** Current monthly spend */
  monthlySpend: number;
  /** Daily limit */
  dailyLimit: number;
  /** Monthly limit */
  monthlyLimit: number;
  /** Daily usage percentage (0-100) */
  dailyUsagePercent: number;
  /** Monthly usage percentage (0-100) */
  monthlyUsagePercent: number;
  /** Is daily limit exceeded */
  isDailyExceeded: boolean;
  /** Is monthly limit exceeded */
  isMonthlyExceeded: boolean;
  /** Is approaching limit (warning threshold) */
  isApproachingLimit: boolean;
  /** Can make AI requests */
  canProceed: boolean;
  /** Reason if cannot proceed */
  blockedReason?: string;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  dailyLimit: 50, // $50/day
  monthlyLimit: 500, // $500/month
  warningThreshold: 0.8, // Warn at 80%
  hardLimit: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FallbackReason =
  | 'budget_exceeded'
  | 'service_unavailable'
  | 'rate_limited'
  | 'error'
  | 'low_confidence'
  | 'manual_escalation';

export interface FallbackDecision {
  shouldFallback: boolean;
  reason?: FallbackReason;
  message: string;
  /** Suggested action for human operator */
  suggestedAction?: string;
  /** Estimated wait time if rate limited (ms) */
  retryAfter?: number;
}

export interface EscalationTicket {
  id: string;
  organizationId: string;
  source: 'whatsapp' | 'voice' | 'api';
  reason: FallbackReason;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'resolved' | 'expired';
  customerPhone?: string;
  customerName?: string;
  originalMessage?: string;
  context?: Record<string, unknown>;
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OpenAIServiceStatus {
  /** Is service available */
  available: boolean;
  /** Last successful request */
  lastSuccess: Date | null;
  /** Last error */
  lastError: Date | null;
  /** Last error message */
  lastErrorMessage?: string;
  /** Success rate (last hour) */
  successRate: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** Circuit breaker state */
  circuitState: 'closed' | 'open' | 'half-open';
}

export interface OpenAISystemStatus {
  service: OpenAIServiceStatus;
  budget: BudgetStatus;
  /** Pending escalation tickets */
  pendingEscalations: number;
  /** Last updated */
  updatedAt: Date;
}
