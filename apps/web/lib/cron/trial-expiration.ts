/**
 * Trial Expiration Cron Job
 * =========================
 *
 * Processes expired trials:
 * - Finds all trials that have expired but haven't been converted
 * - Updates their status to 'expired'
 * - Sets tier to FREE
 * - Logs subscription events
 * - Optionally sends notification emails
 *
 * Runs daily at 1:00 AM Buenos Aires time (4:00 AM UTC)
 * Schedule: 0 4 * * *
 */

import { prisma } from '@/lib/prisma';
import { TIMEZONE } from '@/lib/services/trial-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrialExpirationResult {
  success: boolean;
  processedCount: number;
  expiredCount: number;
  errorCount: number;
  errors: Array<{ organizationId: string; error: string }>;
  durationMs: number;
}

export interface TrialExpirationStatus {
  pendingExpirations: number;
  expiringIn24h: number;
  expiringIn7d: number;
  lastRunAt: Date | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPIRATION PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process all expired trials
 * Updates status to 'expired' and tier to 'FREE'
 */
export async function processExpiredTrials(): Promise<TrialExpirationResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ organizationId: string; error: string }> = [];
  let processedCount = 0;
  let expiredCount = 0;

  try {
    console.log('[TrialExpiration] Starting trial expiration processing...');

    // Find all trialing subscriptions that have expired
    const expiredTrials = await prisma.organizationSubscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          lt: now,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    console.log(`[TrialExpiration] Found ${expiredTrials.length} expired trials to process`);

    // Process each expired trial
    for (const subscription of expiredTrials) {
      processedCount++;

      try {
        // Update subscription status and organization tier
        await prisma.$transaction([
          // Update subscription to expired
          prisma.organizationSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'expired',
            },
          }),

          // Update organization tier to FREE
          prisma.organization.update({
            where: { id: subscription.organizationId },
            data: {
              subscriptionTier: 'FREE',
              subscriptionStatus: 'expired',
            },
          }),

          // Log the expiration event
          prisma.subscriptionEvent.create({
            data: {
              id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              subscriptionId: subscription.id,
              organizationId: subscription.organizationId,
              eventType: 'trial_expired',
              eventData: {
                previousTier: subscription.tier,
                trialEndsAt: subscription.trialEndsAt?.toISOString(),
                processedAt: now.toISOString(),
                timezone: TIMEZONE,
              },
              actorType: 'system',
            },
          }),
        ]);

        expiredCount++;

        console.log(`[TrialExpiration] Processed expiration for org ${subscription.organizationId}`);

        // TODO: Send trial expired notification email
        // await sendTrialExpiredEmail(subscription.organization);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[TrialExpiration] Error processing org ${subscription.organizationId}:`, error);
        errors.push({
          organizationId: subscription.organizationId,
          error: errorMessage,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    console.log(`[TrialExpiration] Completed. Processed: ${processedCount}, Expired: ${expiredCount}, Errors: ${errors.length}, Duration: ${durationMs}ms`);

    return {
      success: errors.length === 0,
      processedCount,
      expiredCount,
      errorCount: errors.length,
      errors,
      durationMs,
    };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[TrialExpiration] Fatal error:', error);

    return {
      success: false,
      processedCount,
      expiredCount,
      errorCount: 1,
      errors: [{
        organizationId: 'N/A',
        error: error instanceof Error ? error.message : 'Unknown fatal error',
      }],
      durationMs,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS AND MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current status of pending trial expirations
 */
export async function getTrialExpirationStatus(): Promise<TrialExpirationStatus> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Count pending expirations (already expired but not processed)
    const pendingExpirations = await prisma.organizationSubscription.count({
      where: {
        status: 'trialing',
        trialEndsAt: {
          lt: now,
        },
      },
    });

    // Count trials expiring in next 24 hours
    const expiringIn24h = await prisma.organizationSubscription.count({
      where: {
        status: 'trialing',
        trialEndsAt: {
          gte: now,
          lt: in24h,
        },
      },
    });

    // Count trials expiring in next 7 days
    const expiringIn7d = await prisma.organizationSubscription.count({
      where: {
        status: 'trialing',
        trialEndsAt: {
          gte: now,
          lt: in7d,
        },
      },
    });

    // Get last expiration event
    const lastEvent = await prisma.subscriptionEvent.findFirst({
      where: {
        eventType: 'trial_expired',
        actorType: 'system',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return {
      pendingExpirations,
      expiringIn24h,
      expiringIn7d,
      lastRunAt: lastEvent?.createdAt || null,
    };

  } catch (error) {
    console.error('[TrialExpiration] Status check error:', error);
    return {
      pendingExpirations: 0,
      expiringIn24h: 0,
      expiringIn7d: 0,
      lastRunAt: null,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPIRATION WARNING NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send warning notifications for trials expiring soon
 * Should be run daily to notify users of upcoming expirations
 */
export async function sendExpirationWarnings(): Promise<{
  sent3Day: number;
  sent7Day: number;
  errors: number;
}> {
  const now = new Date();

  // Calculate date thresholds
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in3DaysStart = new Date(in3Days);
  in3DaysStart.setHours(0, 0, 0, 0);
  const in3DaysEnd = new Date(in3Days);
  in3DaysEnd.setHours(23, 59, 59, 999);

  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7DaysStart = new Date(in7Days);
  in7DaysStart.setHours(0, 0, 0, 0);
  const in7DaysEnd = new Date(in7Days);
  in7DaysEnd.setHours(23, 59, 59, 999);

  let sent3Day = 0;
  let sent7Day = 0;
  let errorCount = 0;

  try {
    // Find trials expiring in exactly 3 days (within that day)
    const expiring3Day = await prisma.organizationSubscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          gte: in3DaysStart,
          lte: in3DaysEnd,
        },
      },
      include: {
        organization: {
          include: {
            users: {
              where: {
                role: 'OWNER',
              },
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Find trials expiring in exactly 7 days
    const expiring7Day = await prisma.organizationSubscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          gte: in7DaysStart,
          lte: in7DaysEnd,
        },
      },
      include: {
        organization: {
          include: {
            users: {
              where: {
                role: 'OWNER',
              },
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // TODO: Send actual notifications (email/WhatsApp)
    // For now, just log
    for (const sub of expiring3Day) {
      console.log(`[TrialExpiration] Would send 3-day warning to org ${sub.organizationId}`);
      sent3Day++;
    }

    for (const sub of expiring7Day) {
      console.log(`[TrialExpiration] Would send 7-day warning to org ${sub.organizationId}`);
      sent7Day++;
    }

  } catch (error) {
    console.error('[TrialExpiration] Error sending warnings:', error);
    errorCount++;
  }

  return {
    sent3Day,
    sent7Day,
    errors: errorCount,
  };
}
