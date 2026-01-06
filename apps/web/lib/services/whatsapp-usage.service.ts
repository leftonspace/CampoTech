/**
 * WhatsApp Usage Metering Service
 * ================================
 *
 * Tracks and enforces usage limits for WhatsApp messaging.
 *
 * Features:
 * - Track messages sent/received per organization
 * - Track conversations opened (24-hour windows)
 * - Track AI responses generated
 * - Monthly reset logic
 * - Usage alerts (80%, 100% of limit)
 * - Tier-based limits enforcement
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UsageStats {
  /** Current billing period start */
  periodStart: Date;
  /** Current billing period end */
  periodEnd: Date;
  /** Messages sent this period */
  messagesSent: number;
  /** Messages received this period */
  messagesReceived: number;
  /** Total messages (sent + received) */
  totalMessages: number;
  /** Conversations opened this period */
  conversationsOpened: number;
  /** AI responses generated this period */
  aiResponses: number;
  /** Monthly limit for messages */
  monthlyLimit: number;
  /** Messages remaining */
  remaining: number;
  /** Percentage of limit used */
  percentUsed: number;
  /** Whether limit is reached */
  limitReached: boolean;
  /** Alert level: null, 'warning' (80%), 'critical' (100%) */
  alertLevel: 'warning' | 'critical' | null;
}

export interface UsageHistory {
  date: Date;
  messagesSent: number;
  messagesReceived: number;
  conversationsOpened: number;
  aiResponses: number;
}

export interface TierLimits {
  monthlyMessages: number;
  aiEnabled: boolean;
  conversationHistory: boolean;
  multipleResponders: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER LIMITS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_LIMITS: Record<string, TierLimits> = {
  FREE: {
    monthlyMessages: 0,
    aiEnabled: false,
    conversationHistory: false,
    multipleResponders: false,
  },
  INICIAL: {
    monthlyMessages: 0, // wa.me links only, no BSP messaging
    aiEnabled: false,
    conversationHistory: false,
    multipleResponders: false,
  },
  PROFESIONAL: {
    monthlyMessages: 1000,
    aiEnabled: true,
    conversationHistory: true,
    multipleResponders: false,
  },
  EMPRESA: {
    monthlyMessages: 10000, // Significant limit for enterprise
    aiEnabled: true,
    conversationHistory: true,
    multipleResponders: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class WhatsAppUsageService {
  /**
   * Get tier limits for a subscription tier
   */
  static getTierLimits(tier: string): TierLimits {
    return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
  }

  /**
   * Get the current billing period dates
   */
  static getBillingPeriod(lastReset?: Date | null): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;

    if (lastReset) {
      // Use the last reset date as period start
      start = new Date(lastReset);
      // If more than a month has passed, calculate current month
      const monthsSince = (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      if (monthsSince >= 1) {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    } else {
      // Default to first day of current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // End of month
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Get usage statistics for an organization
   */
  static async getUsageStats(organizationId: string): Promise<UsageStats> {
    // Get organization with subscription and WhatsApp account
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscription: {
          select: { tier: true },
        },
        whatsappBusinessAccount: {
          select: {
            monthlyMessageCount: true,
            lastBillingReset: true,
          },
        },
      },
    });

    const tier = org?.subscription?.tier || 'FREE';
    const limits = this.getTierLimits(tier);
    const lastReset = org?.whatsappBusinessAccount?.lastBillingReset;
    const { start, end } = this.getBillingPeriod(lastReset);

    // Get message counts for current period
    const [sentCount, receivedCount, conversationCount, aiResponseCount] = await Promise.all([
      prisma.whatsAppMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'INBOUND',
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.whatsAppConversation.count({
        where: {
          organizationId,
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.whatsAppMessage.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          isAiGenerated: true,
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    const totalMessages = sentCount + receivedCount;
    const monthlyLimit = limits.monthlyMessages;
    const isUnlimited = monthlyLimit === -1;
    const remaining = isUnlimited ? Infinity : Math.max(0, monthlyLimit - totalMessages);
    const percentUsed = isUnlimited ? 0 : monthlyLimit > 0 ? (totalMessages / monthlyLimit) * 100 : 0;
    const limitReached = !isUnlimited && totalMessages >= monthlyLimit;

    let alertLevel: 'warning' | 'critical' | null = null;
    if (!isUnlimited && monthlyLimit > 0) {
      if (percentUsed >= 100) {
        alertLevel = 'critical';
      } else if (percentUsed >= 80) {
        alertLevel = 'warning';
      }
    }

    return {
      periodStart: start,
      periodEnd: end,
      messagesSent: sentCount,
      messagesReceived: receivedCount,
      totalMessages,
      conversationsOpened: conversationCount,
      aiResponses: aiResponseCount,
      monthlyLimit: isUnlimited ? -1 : monthlyLimit,
      remaining: isUnlimited ? -1 : remaining,
      percentUsed: Math.min(100, percentUsed),
      limitReached,
      alertLevel,
    };
  }

  /**
   * Get usage history for the past N days
   */
  static async getUsageHistory(
    organizationId: string,
    days: number = 30
  ): Promise<UsageHistory[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily message counts
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        conversation: { organizationId },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        direction: true,
        isAiGenerated: true,
        createdAt: true,
      },
    });

    // Get daily conversation counts
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const dailyStats: Record<string, UsageHistory> = {};

    // Initialize all days
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStats[dateKey] = {
        date: new Date(dateKey),
        messagesSent: 0,
        messagesReceived: 0,
        conversationsOpened: 0,
        aiResponses: 0,
      };
    }

    // Aggregate messages
    for (const msg of messages) {
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      if (dailyStats[dateKey]) {
        if (msg.direction === 'OUTBOUND') {
          dailyStats[dateKey].messagesSent++;
          if (msg.isAiGenerated) {
            dailyStats[dateKey].aiResponses++;
          }
        } else {
          dailyStats[dateKey].messagesReceived++;
        }
      }
    }

    // Aggregate conversations
    for (const conv of conversations) {
      const dateKey = conv.createdAt.toISOString().split('T')[0];
      if (dailyStats[dateKey]) {
        dailyStats[dateKey].conversationsOpened++;
      }
    }

    return Object.values(dailyStats).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Check if organization can send a message
   */
  static async canSendMessage(organizationId: string): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    const stats = await this.getUsageStats(organizationId);

    if (stats.monthlyLimit === 0) {
      return {
        allowed: false,
        reason: 'Tu plan no incluye mensajería de WhatsApp API',
        upgradeRequired: true,
      };
    }

    if (stats.limitReached) {
      return {
        allowed: false,
        reason: `Alcanzaste el límite de ${stats.monthlyLimit} mensajes mensuales`,
        upgradeRequired: true,
      };
    }

    return { allowed: true };
  }

  /**
   * Increment message count for an organization
   */
  static async incrementMessageCount(
    organizationId: string,
    count: number = 1
  ): Promise<void> {
    await prisma.whatsAppBusinessAccount.update({
      where: { organizationId },
      data: {
        monthlyMessageCount: { increment: count },
      },
    });
  }

  /**
   * Reset monthly message count (called by cron job)
   */
  static async resetMonthlyCount(organizationId: string): Promise<void> {
    await prisma.whatsAppBusinessAccount.update({
      where: { organizationId },
      data: {
        monthlyMessageCount: 0,
        lastBillingReset: new Date(),
      },
    });
  }

  /**
   * Reset all organizations' monthly counts (called by cron job on 1st of month)
   */
  static async resetAllMonthlyCountsIfNeeded(): Promise<number> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Find accounts that haven't been reset this month
    const accountsToReset = await prisma.whatsAppBusinessAccount.findMany({
      where: {
        OR: [
          { lastBillingReset: null },
          { lastBillingReset: { lt: firstOfMonth } },
        ],
        provisioningStatus: { in: ['ACTIVE', 'VERIFIED'] },
      },
      select: { organizationId: true },
    });

    if (accountsToReset.length > 0) {
      await prisma.whatsAppBusinessAccount.updateMany({
        where: {
          organizationId: { in: accountsToReset.map((a: { organizationId: string }) => a.organizationId) },
        },
        data: {
          monthlyMessageCount: 0,
          lastBillingReset: now,
        },
      });
    }

    return accountsToReset.length;
  }

  /**
   * Get organizations nearing their limit (for alerts)
   */
  static async getOrganizationsNearLimit(
    threshold: number = 80
  ): Promise<Array<{ organizationId: string; percentUsed: number; tier: string }>> {
    // Get all active WhatsApp accounts with their usage
    const accounts = await prisma.whatsAppBusinessAccount.findMany({
      where: {
        provisioningStatus: { in: ['ACTIVE', 'VERIFIED'] },
      },
      select: {
        organizationId: true,
        monthlyMessageCount: true,
        organization: {
          select: {
            subscription: {
              select: { tier: true },
            },
          },
        },
      },
    });

    const nearLimit: Array<{ organizationId: string; percentUsed: number; tier: string }> = [];

    for (const account of accounts) {
      const tier = account.organization.subscription?.tier || 'FREE';
      const limits = this.getTierLimits(tier);

      if (limits.monthlyMessages > 0 && limits.monthlyMessages !== -1) {
        const percentUsed = (account.monthlyMessageCount / limits.monthlyMessages) * 100;
        if (percentUsed >= threshold) {
          nearLimit.push({
            organizationId: account.organizationId,
            percentUsed,
            tier,
          });
        }
      }
    }

    return nearLimit;
  }

  /**
   * Check if AI responses are enabled for an organization
   */
  static async isAiEnabled(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscription: {
          select: { tier: true },
        },
      },
    });

    const tier = org?.subscription?.tier || 'FREE';
    const limits = this.getTierLimits(tier);
    return limits.aiEnabled;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format usage stats for display
 */
export function formatUsageStats(stats: UsageStats): {
  limitDisplay: string;
  remainingDisplay: string;
  percentDisplay: string;
} {
  const isUnlimited = stats.monthlyLimit === -1;

  return {
    limitDisplay: isUnlimited ? 'Ilimitado' : `${stats.monthlyLimit.toLocaleString('es-AR')} mensajes`,
    remainingDisplay: isUnlimited
      ? 'Ilimitado'
      : stats.remaining === 0
        ? 'Sin mensajes disponibles'
        : `${stats.remaining.toLocaleString('es-AR')} disponibles`,
    percentDisplay: isUnlimited ? '0%' : `${Math.round(stats.percentUsed)}%`,
  };
}

/**
 * Get upgrade suggestion based on current tier
 */
export function getUpgradeSuggestion(currentTier: string): {
  nextTier: string | null;
  benefit: string;
} {
  switch (currentTier) {
    case 'FREE':
    case 'INICIAL':
      return {
        nextTier: 'PROFESIONAL',
        benefit: 'Obtené un número de WhatsApp exclusivo con respuestas automáticas de IA',
      };
    case 'PROFESIONAL':
      return {
        nextTier: 'EMPRESA',
        benefit: 'Aumentá tu límite a 10,000 mensajes mensuales y agregá múltiples respondedores',
      };
    case 'EMPRESA':
      return {
        nextTier: null,
        benefit: 'Ya tenés el plan más completo',
      };
    default:
      return {
        nextTier: null,
        benefit: 'Ya tenés el plan más completo',
      };
  }
}
