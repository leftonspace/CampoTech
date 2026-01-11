/**
 * OpenAI Fallback Handler
 * =======================
 *
 * Handles fallback scenarios when AI is unavailable or budget is exceeded.
 * Escalates to human operators and manages escalation tickets.
 *
 * Features:
 * - Budget-aware request gating
 * - Service availability monitoring
 * - Automatic human escalation
 * - Escalation ticket management
 * - Circuit breaker integration
 */

import { prisma } from '@/lib/prisma';
import { getOpenAIUsageTracker } from './usage-tracker';
import {
  FallbackReason,
  FallbackDecision,
  EscalationTicket,
  OpenAIServiceStatus,
  OpenAISystemStatus,
  BudgetStatus
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface FallbackConfig {
  /** Enable automatic escalation */
  autoEscalate: boolean;
  /** Default escalation message (Spanish) */
  defaultEscalationMessage: string;
  /** Max pending escalations per org before blocking new ones */
  maxPendingEscalations: number;
  /** Ticket expiry time in hours */
  ticketExpiryHours: number;
  /** Circuit breaker: failures before opening */
  failureThreshold: number;
  /** Circuit breaker: open duration in ms */
  circuitOpenDuration: number;
}

const DEFAULT_CONFIG: FallbackConfig = {
  autoEscalate: true,
  defaultEscalationMessage:
    'Disculpá, nuestro asistente virtual no está disponible en este momento. ' +
    'Un operador humano te atenderá en breve.',
  maxPendingEscalations: 50,
  ticketExpiryHours: 24,
  failureThreshold: 5,
  circuitOpenDuration: 300000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class OpenAIFallbackHandler {
  private config: FallbackConfig;
  private serviceMonitor: ServiceMonitor;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.serviceMonitor = new ServiceMonitor(this.config);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRE-REQUEST CHECKS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if an AI request should proceed or fallback
   */
  async shouldFallback(organizationId: string): Promise<FallbackDecision> {
    // Check budget first
    const budgetCheck = await this.checkBudget(organizationId);
    if (budgetCheck.shouldFallback) {
      return budgetCheck;
    }

    // Check service availability
    const serviceCheck = this.checkServiceAvailability();
    if (serviceCheck.shouldFallback) {
      return serviceCheck;
    }

    // All checks passed
    return {
      shouldFallback: false,
      message: 'AI request can proceed'
    };
  }

  /**
   * Check budget constraints
   */
  private async checkBudget(organizationId: string): Promise<FallbackDecision> {
    const tracker = getOpenAIUsageTracker();
    const { allowed, reason: _reason, budgetStatus } = await tracker.canProceed(organizationId);

    if (!allowed) {
      return {
        shouldFallback: true,
        reason: 'budget_exceeded',
        message: this.getBudgetExceededMessage(budgetStatus),
        suggestedAction: 'Wait until budget resets or increase limits'
      };
    }

    // Warn if approaching limit
    if (budgetStatus.isApproachingLimit) {
      console.warn(`[OpenAI Fallback] Approaching budget limit for org ${organizationId}:`, {
        dailyUsage: `${budgetStatus.dailyUsagePercent.toFixed(1)}%`,
        monthlyUsage: `${budgetStatus.monthlyUsagePercent.toFixed(1)}%`
      });
    }

    return {
      shouldFallback: false,
      message: 'Budget check passed'
    };
  }

  /**
   * Check service availability via circuit breaker
   */
  private checkServiceAvailability(): FallbackDecision {
    const status = this.serviceMonitor.getStatus();

    if (status.circuitState === 'open') {
      return {
        shouldFallback: true,
        reason: 'service_unavailable',
        message: 'OpenAI service is temporarily unavailable',
        suggestedAction: 'Service will be retried automatically',
        retryAfter: this.config.circuitOpenDuration
      };
    }

    if (!status.available && status.successRate < 0.5) {
      return {
        shouldFallback: true,
        reason: 'service_unavailable',
        message: 'OpenAI service is experiencing issues',
        suggestedAction: 'Monitor service health'
      };
    }

    return {
      shouldFallback: false,
      message: 'Service check passed'
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCALATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an escalation ticket for human handling
   */
  async createEscalation(params: {
    organizationId: string;
    source: EscalationTicket['source'];
    reason: FallbackReason;
    customerPhone?: string;
    customerName?: string;
    originalMessage?: string;
    context?: Record<string, unknown>;
  }): Promise<EscalationTicket> {
    const ticket: EscalationTicket = {
      id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId: params.organizationId,
      source: params.source,
      reason: params.reason,
      priority: this.determinePriority(params.reason),
      status: 'pending',
      customerPhone: params.customerPhone,
      customerName: params.customerName,
      originalMessage: params.originalMessage,
      context: params.context,
      createdAt: new Date()
    };

    // Store in database
    try {
      await prisma.aIEscalationTicket.create({
        data: {
          id: ticket.id,
          organizationId: ticket.organizationId,
          source: ticket.source,
          reason: ticket.reason,
          priority: ticket.priority,
          status: ticket.status,
          customerPhone: ticket.customerPhone,
          customerName: ticket.customerName,
          originalMessage: ticket.originalMessage,
          context: ticket.context as object,
          createdAt: ticket.createdAt
        }
      });
    } catch (error) {
      console.error('[OpenAI Fallback] Failed to create escalation ticket:', error);
      // Continue anyway - ticket is in memory
    }

    console.info('[OpenAI Fallback] Escalation created:', {
      ticketId: ticket.id,
      reason: ticket.reason,
      priority: ticket.priority,
      source: ticket.source
    });

    return ticket;
  }

  /**
   * Assign escalation to a user
   */
  async assignEscalation(ticketId: string, userId: string): Promise<boolean> {
    try {
      await prisma.aIEscalationTicket.update({
        where: { id: ticketId },
        data: {
          status: 'assigned',
          assignedTo: userId
        }
      });
      return true;
    } catch {
      console.error('[OpenAI Fallback] Failed to assign escalation:', ticketId);
      return false;
    }
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(ticketId: string, resolution: string): Promise<boolean> {
    try {
      await prisma.aIEscalationTicket.update({
        where: { id: ticketId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolution
        }
      });
      return true;
    } catch {
      console.error('[OpenAI Fallback] Failed to resolve escalation:', ticketId);
      return false;
    }
  }

  /**
   * Get pending escalations for an organization
   */
  async getPendingEscalations(organizationId: string): Promise<EscalationTicket[]> {
    try {
      const tickets = await prisma.aIEscalationTicket.findMany({
        where: {
          organizationId,
          status: { in: ['pending', 'assigned'] }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
      });

      return tickets.map((t: {
        id: string;
        organizationId: string;
        source: string;
        reason: string;
        priority: string;
        status: string;
        customerPhone: string | null;
        customerName: string | null;
        originalMessage: string | null;
        context: unknown;
        assignedTo: string | null;
        createdAt: Date;
        resolvedAt: Date | null;
        resolution: string | null;
      }) => ({
        id: t.id,
        organizationId: t.organizationId,
        source: t.source as EscalationTicket['source'],
        reason: t.reason as FallbackReason,
        priority: t.priority as EscalationTicket['priority'],
        status: t.status as EscalationTicket['status'],
        customerPhone: t.customerPhone || undefined,
        customerName: t.customerName || undefined,
        originalMessage: t.originalMessage || undefined,
        context: t.context as Record<string, unknown>,
        assignedTo: t.assignedTo || undefined,
        createdAt: t.createdAt,
        resolvedAt: t.resolvedAt || undefined,
        resolution: t.resolution || undefined
      }));
    } catch {
      return [];
    }
  }

  /**
   * Count pending escalations
   */
  async countPendingEscalations(organizationId?: string): Promise<number> {
    try {
      return await prisma.aIEscalationTicket.count({
        where: {
          ...(organizationId && { organizationId }),
          status: { in: ['pending', 'assigned'] }
        }
      });
    } catch {
      return 0;
    }
  }

  /**
   * Expire old escalations
   */
  async expireOldEscalations(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.ticketExpiryHours * 60 * 60 * 1000);

    try {
      const result = await prisma.aIEscalationTicket.updateMany({
        where: {
          status: 'pending',
          createdAt: { lt: cutoff }
        },
        data: {
          status: 'expired'
        }
      });
      return result.count;
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVICE MONITORING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Record a successful OpenAI request
   */
  recordSuccess(latency: number): void {
    this.serviceMonitor.recordSuccess(latency);
  }

  /**
   * Record a failed OpenAI request
   */
  recordFailure(error?: Error): void {
    this.serviceMonitor.recordFailure(error);
  }

  /**
   * Get service status
   */
  getServiceStatus(): OpenAIServiceStatus {
    return this.serviceMonitor.getStatus();
  }

  /**
   * Get full system status
   */
  async getSystemStatus(organizationId?: string): Promise<OpenAISystemStatus> {
    const tracker = getOpenAIUsageTracker();
    const budgetStatus = await tracker.getBudgetStatus(organizationId);
    const serviceStatus = this.serviceMonitor.getStatus();
    const pendingEscalations = await this.countPendingEscalations(organizationId);

    return {
      service: serviceStatus,
      budget: budgetStatus,
      pendingEscalations,
      updatedAt: new Date()
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Determine escalation priority based on reason
   */
  private determinePriority(_reason: FallbackReason): EscalationTicket['priority'] {
    switch (_reason) {
      case 'manual_escalation':
        return 'urgent';
      case 'error':
        return 'high';
      case 'low_confidence':
        return 'normal';
      case 'budget_exceeded':
      case 'service_unavailable':
      case 'rate_limited':
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Get human-readable budget exceeded message
   */
  private getBudgetExceededMessage(status: BudgetStatus): string {
    if (status.isDailyExceeded) {
      return (
        `Presupuesto diario de AI excedido ($${status.dailySpend.toFixed(2)}/$${status.dailyLimit}). ` +
        'El servicio se reanudará mañana.'
      );
    }
    if (status.isMonthlyExceeded) {
      return (
        `Presupuesto mensual de AI excedido ($${status.monthlySpend.toFixed(2)}/$${status.monthlyLimit}). ` +
        'Contactá al administrador para aumentar el límite.'
      );
    }
    return 'Presupuesto de AI excedido.';
  }

  /**
   * Get default escalation message for customers
   */
  getEscalationMessage(_reason: FallbackReason): string {
    switch (_reason) {
      case 'budget_exceeded':
        return (
          'En este momento nuestro asistente virtual está temporalmente no disponible. ' +
          'Un operador humano te atenderá en breve. Disculpá las molestias.'
        );
      case 'service_unavailable':
        return (
          'Estamos experimentando dificultades técnicas con nuestro asistente. ' +
          'Un operador te responderá a la brevedad.'
        );
      case 'low_confidence':
        return (
          'Para asegurarme de entenderte bien, voy a transferirte con un operador ' +
          'que podrá ayudarte mejor.'
        );
      case 'manual_escalation':
        return 'Te transfiero con un operador humano como solicitaste.';
      default:
        return this.config.defaultEscalationMessage;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE MONITOR (Circuit Breaker)
// ═══════════════════════════════════════════════════════════════════════════════

class ServiceMonitor {
  private config: FallbackConfig;
  private failures: number = 0;
  private successes: number = 0;
  private lastSuccess: Date | null = null;
  private lastError: Date | null = null;
  private lastErrorMessage?: string;
  private latencies: number[] = [];
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitOpenedAt: Date | null = null;

  constructor(config: FallbackConfig) {
    this.config = config;
  }

  recordSuccess(latency: number): void {
    this.successes++;
    this.lastSuccess = new Date();
    this.latencies.push(latency);

    // Keep only last 100 latencies
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }

    // Reset circuit if was half-open
    if (this.circuitState === 'half-open') {
      this.circuitState = 'closed';
      this.failures = 0;
      console.info('[OpenAI Service] Circuit breaker closed');
    }
  }

  recordFailure(error?: Error): void {
    this.failures++;
    this.lastError = new Date();
    this.lastErrorMessage = error?.message;

    // Check if should open circuit
    if (this.circuitState === 'closed') {
      if (this.failures >= this.config.failureThreshold) {
        this.circuitState = 'open';
        this.circuitOpenedAt = new Date();
        console.error('[OpenAI Service] Circuit breaker opened due to failures');
      }
    } else if (this.circuitState === 'half-open') {
      // Failed in half-open, go back to open
      this.circuitState = 'open';
      this.circuitOpenedAt = new Date();
      console.warn('[OpenAI Service] Circuit breaker reopened');
    }
  }

  getStatus(): OpenAIServiceStatus {
    this.updateCircuitState();

    const recentLatencies = this.latencies.slice(-50);
    const avgLatency =
      recentLatencies.length > 0
        ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
        : 0;

    const totalRequests = this.successes + this.failures;
    const successRate = totalRequests > 0 ? this.successes / totalRequests : 1;

    return {
      available: this.circuitState !== 'open',
      lastSuccess: this.lastSuccess,
      lastError: this.lastError,
      lastErrorMessage: this.lastErrorMessage,
      successRate,
      avgLatency: Math.round(avgLatency),
      circuitState: this.circuitState
    };
  }

  private updateCircuitState(): void {
    if (this.circuitState === 'open' && this.circuitOpenedAt) {
      const elapsed = Date.now() - this.circuitOpenedAt.getTime();
      if (elapsed >= this.config.circuitOpenDuration) {
        this.circuitState = 'half-open';
        console.info('[OpenAI Service] Circuit breaker transitioning to half-open');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let fallbackHandler: OpenAIFallbackHandler | null = null;

export function getOpenAIFallbackHandler(): OpenAIFallbackHandler {
  if (!fallbackHandler) {
    fallbackHandler = new OpenAIFallbackHandler();
  }
  return fallbackHandler;
}

export function resetOpenAIFallbackHandler(): void {
  fallbackHandler = null;
}
