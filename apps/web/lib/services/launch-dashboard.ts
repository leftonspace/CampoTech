/**
 * CampoTech Launch Monitoring Dashboard
 * ======================================
 *
 * Real-time metrics for launch monitoring:
 * - Subscription conversion rate
 * - Verification completion rate
 * - Failed payment rate
 * - Block rate
 * - Error rate
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LaunchMetrics {
  timestamp: Date;
  subscriptions: SubscriptionMetrics;
  verification: VerificationMetrics;
  payments: PaymentMetrics;
  blocks: BlockMetrics;
  errors: ErrorMetrics;
  funnel: FunnelMetrics;
}

export interface SubscriptionMetrics {
  total: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  conversionRate: number;
  churnRate: number;
  trialConversionRate: number;
}

export interface VerificationMetrics {
  total: number;
  verified: number;
  pending: number;
  inReview: number;
  rejected: number;
  completionRate: number;
  avgCompletionTime: number | null; // In hours
  pendingAFIP: number;
}

export interface PaymentMetrics {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  refunded: number;
  failureRate: number;
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  avgPaymentAmount: number;
}

export interface BlockMetrics {
  totalBlocked: number;
  softBlocked: number;
  hardBlocked: number;
  blockRate: number;
  unblockedToday: number;
  avgBlockDuration: number | null; // In days
}

export interface ErrorMetrics {
  total24h: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  topErrors: Array<{ error: string; count: number }>;
  errorRate: number;
}

export interface FunnelMetrics {
  signups: number;
  trialsStarted: number;
  verificationStarted: number;
  verificationCompleted: number;
  paymentAttempted: number;
  paymentCompleted: number;
  activeSubscriptions: number;
  dropOffRates: Record<string, number>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  services: {
    database: ServiceStatus;
    mercadopago: ServiceStatus;
    afip: ServiceStatus;
    email: ServiceStatus;
    storage: ServiceStatus;
  };
  lastChecked: Date;
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency: number | null;
  lastError: string | null;
  lastErrorAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAUNCH DASHBOARD SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class LaunchDashboardService {
  /**
   * Get all launch metrics
   */
  async getMetrics(): Promise<LaunchMetrics> {
    const [subscriptions, verification, payments, blocks, errors, funnel] =
      await Promise.all([
        this.getSubscriptionMetrics(),
        this.getVerificationMetrics(),
        this.getPaymentMetrics(),
        this.getBlockMetrics(),
        this.getErrorMetrics(),
        this.getFunnelMetrics(),
      ]);

    return {
      timestamp: new Date(),
      subscriptions,
      verification,
      payments,
      blocks,
      errors,
      funnel,
    };
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(): Promise<SubscriptionMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      byTier,
      byStatus,
      newToday,
      newThisWeek,
      newThisMonth,
      trials,
      converted,
      cancelled,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.groupBy({
        by: ['subscriptionTier'],
        _count: true,
      }),
      prisma.organization.groupBy({
        by: ['subscriptionStatus'],
        _count: true,
      }),
      prisma.organization.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.organization.count({
        where: { createdAt: { gte: weekAgo } },
      }),
      prisma.organization.count({
        where: { createdAt: { gte: monthAgo } },
      }),
      prisma.organization.count({
        where: { subscriptionStatus: 'trialing' },
      }),
      prisma.organization.count({
        where: {
          subscriptionStatus: 'active',
          trialEndsAt: { not: null },
        },
      }),
      prisma.organization.count({
        where: {
          subscriptionStatus: 'cancelled',
          createdAt: { gte: monthAgo },
        },
      }),
    ]);

    const tierCounts = Object.fromEntries(
      byTier.map((t) => [t.subscriptionTier, t._count])
    );

    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.subscriptionStatus, s._count])
    );

    const activeTotal = total - (statusCounts['cancelled'] || 0);
    const conversionRate = activeTotal > 0 ? ((converted + (statusCounts['active'] || 0)) / total) * 100 : 0;
    const churnRate = total > 0 ? (cancelled / total) * 100 : 0;
    const trialConversionRate = trials > 0 ? (converted / (trials + converted)) * 100 : 0;

    return {
      total,
      byTier: tierCounts,
      byStatus: statusCounts,
      newToday,
      newThisWeek,
      newThisMonth,
      conversionRate: Math.round(conversionRate * 100) / 100,
      churnRate: Math.round(churnRate * 100) / 100,
      trialConversionRate: Math.round(trialConversionRate * 100) / 100,
    };
  }

  /**
   * Get verification metrics
   */
  async getVerificationMetrics(): Promise<VerificationMetrics> {
    const [verified, pending, inReview, rejected, pendingAFIP] = await Promise.all([
      prisma.organization.count({
        where: { verificationStatus: 'verified' },
      }),
      prisma.organization.count({
        where: { verificationStatus: 'pending' },
      }),
      prisma.organization.count({
        where: { verificationStatus: 'in_review' },
      }),
      prisma.organization.count({
        where: { verificationStatus: 'rejected' },
      }),
      prisma.subscriptionEvent.count({
        where: {
          eventType: 'afip.manual_verification_queued',
          eventData: {
            path: ['status'],
            equals: 'pending',
          },
        },
      }),
    ]);

    const total = verified + pending + inReview + rejected;
    const completionRate = total > 0 ? (verified / total) * 100 : 0;

    // Calculate average completion time
    const completedOrgs = await prisma.organization.findMany({
      where: {
        verificationStatus: 'verified',
        verificationCompletedAt: { not: null },
      },
      select: {
        createdAt: true,
        verificationCompletedAt: true,
      },
      take: 100,
    });

    let avgCompletionTime: number | null = null;
    if (completedOrgs.length > 0) {
      const totalHours = completedOrgs.reduce((sum, org) => {
        if (org.verificationCompletedAt) {
          const diff = org.verificationCompletedAt.getTime() - org.createdAt.getTime();
          return sum + diff / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgCompletionTime = Math.round((totalHours / completedOrgs.length) * 10) / 10;
    }

    return {
      total,
      verified,
      pending,
      inReview,
      rejected,
      completionRate: Math.round(completionRate * 100) / 100,
      avgCompletionTime,
      pendingAFIP,
    };
  }

  /**
   * Get payment metrics
   */
  async getPaymentMetrics(): Promise<PaymentMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      byStatus,
      revenueToday,
      revenueThisMonth,
    ] = await Promise.all([
      prisma.subscriptionPayment.count(),
      prisma.subscriptionPayment.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.aggregate({
        where: {
          status: 'completed',
          paidAt: { gte: today },
        },
        _sum: { amount: true },
      }),
      prisma.subscriptionPayment.aggregate({
        where: {
          status: 'completed',
          paidAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);

    const statusMap: Record<string, { count: number; sum: number }> = {};
    byStatus.forEach((s) => {
      statusMap[s.status] = {
        count: s._count,
        sum: s._sum.amount || 0,
      };
    });

    const completed = statusMap['completed']?.count || 0;
    const failed = statusMap['failed']?.count || 0;
    const pending = statusMap['pending']?.count || 0;
    const refunded = statusMap['refunded']?.count || 0;
    const totalRevenue = statusMap['completed']?.sum || 0;

    const failureRate = (completed + failed) > 0
      ? (failed / (completed + failed)) * 100
      : 0;

    const avgPaymentAmount = completed > 0 ? totalRevenue / completed : 0;

    return {
      total,
      completed,
      failed,
      pending,
      refunded,
      failureRate: Math.round(failureRate * 100) / 100,
      totalRevenue,
      revenueToday: revenueToday._sum.amount || 0,
      revenueThisMonth: revenueThisMonth._sum.amount || 0,
      avgPaymentAmount: Math.round(avgPaymentAmount),
    };
  }

  /**
   * Get block metrics
   */
  async getBlockMetrics(): Promise<BlockMetrics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, softBlocked, hardBlocked, unblockedToday] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({
        where: { blockType: 'soft_block' },
      }),
      prisma.organization.count({
        where: { blockType: 'hard_block' },
      }),
      prisma.subscriptionEvent.count({
        where: {
          eventType: 'block_removed',
          createdAt: { gte: today },
        },
      }),
    ]);

    const totalBlocked = softBlocked + hardBlocked;
    const blockRate = total > 0 ? (totalBlocked / total) * 100 : 0;

    return {
      totalBlocked,
      softBlocked,
      hardBlocked,
      blockRate: Math.round(blockRate * 100) / 100,
      unblockedToday,
      avgBlockDuration: null, // Would require more complex calculation
    };
  }

  /**
   * Get error metrics
   */
  async getErrorMetrics(): Promise<ErrorMetrics> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const errors = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: { startsWith: 'error.' },
        createdAt: { gte: dayAgo },
      },
      select: {
        eventType: true,
        eventData: true,
      },
    });

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byCategory: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    errors.forEach((error) => {
      const data = error.eventData as Record<string, unknown>;
      const severity = (data.severity as string) || 'medium';
      const category = (data.category as string) || 'unknown';
      const errorMessage = (data.message as string) || error.eventType;

      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      byCategory[category] = (byCategory[category] || 0) + 1;
      errorCounts[errorMessage] = (errorCounts[errorMessage] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate error rate (errors per 1000 operations)
    const totalOperations = await prisma.subscriptionEvent.count({
      where: { createdAt: { gte: dayAgo } },
    });
    const errorRate = totalOperations > 0
      ? (errors.length / totalOperations) * 1000
      : 0;

    return {
      total24h: errors.length,
      bySeverity,
      byCategory,
      topErrors,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Get funnel metrics
   */
  async getFunnelMetrics(): Promise<FunnelMetrics> {
    const [
      signups,
      trialsStarted,
      verificationStarted,
      verificationCompleted,
      paymentAttempted,
      paymentCompleted,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.trial_started' },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.verification_started' },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.verification_completed' },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.checkout_started' },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.payment_succeeded' },
      }),
      prisma.organization.count({
        where: { subscriptionStatus: 'active' },
      }),
    ]);

    const dropOffRates: Record<string, number> = {};

    if (signups > 0) {
      dropOffRates['signup_to_trial'] = Math.round(((signups - trialsStarted) / signups) * 100);
    }
    if (trialsStarted > 0) {
      dropOffRates['trial_to_verification'] = Math.round(((trialsStarted - verificationStarted) / trialsStarted) * 100);
    }
    if (verificationStarted > 0) {
      dropOffRates['verification_start_to_complete'] = Math.round(((verificationStarted - verificationCompleted) / verificationStarted) * 100);
    }
    if (verificationCompleted > 0) {
      dropOffRates['verification_to_payment'] = Math.round(((verificationCompleted - paymentAttempted) / verificationCompleted) * 100);
    }
    if (paymentAttempted > 0) {
      dropOffRates['payment_attempt_to_success'] = Math.round(((paymentAttempted - paymentCompleted) / paymentAttempted) * 100);
    }

    return {
      signups,
      trialsStarted,
      verificationStarted,
      verificationCompleted,
      paymentAttempted,
      paymentCompleted,
      activeSubscriptions,
      dropOffRates,
    };
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const services = {
      database: await this.checkDatabaseHealth(),
      mercadopago: await this.checkMercadoPagoHealth(),
      afip: await this.checkAFIPHealth(),
      email: await this.checkEmailHealth(),
      storage: await this.checkStorageHealth(),
    };

    const allUp = Object.values(services).every((s) => s.status === 'up');
    const anyDown = Object.values(services).some((s) => s.status === 'down');

    return {
      status: anyDown ? 'critical' : allUp ? 'healthy' : 'degraded',
      services,
      lastChecked: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Health Check Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private async checkDatabaseHealth(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
        lastError: null,
        lastErrorAt: null,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: null,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastErrorAt: new Date(),
      };
    }
  }

  private async checkMercadoPagoHealth(): Promise<ServiceStatus> {
    // Check last successful MP webhook
    const lastSuccess = await prisma.subscriptionEvent.findFirst({
      where: {
        eventType: { startsWith: 'webhook.' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return {
      status: lastSuccess && lastSuccess.createdAt > hourAgo ? 'up' : 'degraded',
      latency: null,
      lastError: null,
      lastErrorAt: null,
    };
  }

  private async checkAFIPHealth(): Promise<ServiceStatus> {
    // Check for recent AFIP errors
    const recentErrors = await prisma.subscriptionEvent.count({
      where: {
        eventType: 'afip.error',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    return {
      status: recentErrors > 5 ? 'degraded' : 'up',
      latency: null,
      lastError: null,
      lastErrorAt: null,
    };
  }

  private async checkEmailHealth(): Promise<ServiceStatus> {
    // Check for recent email errors
    const recentErrors = await prisma.subscriptionEvent.count({
      where: {
        eventType: 'email.failed',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    return {
      status: recentErrors > 3 ? 'degraded' : 'up',
      latency: null,
      lastError: null,
      lastErrorAt: null,
    };
  }

  private async checkStorageHealth(): Promise<ServiceStatus> {
    // Storage health would be checked via Supabase status
    return {
      status: 'up',
      latency: null,
      lastError: null,
      lastErrorAt: null,
    };
  }
}

// Export singleton
export const launchDashboard = new LaunchDashboardService();
