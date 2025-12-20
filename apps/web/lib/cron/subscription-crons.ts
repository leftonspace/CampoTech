/**
 * CampoTech Subscription Cron Jobs
 * =================================
 *
 * Handles all subscription-related scheduled tasks:
 * - checkTrialExpiring: Send reminder emails for trials expiring in 7, 3, 1 days
 * - checkTrialExpired: Process expired trials and send notification emails
 * - sendPaymentReminders: Remind users 3 days before subscription renewal
 *
 * Schedule (Buenos Aires time = UTC-3):
 * - Trial reminders: Daily at 9:00 AM (12:00 UTC)
 * - Trial expiration: Daily at 6:00 AM (09:00 UTC)
 * - Payment reminders: Daily at 9:00 AM (12:00 UTC)
 */

import { prisma } from '@/lib/prisma';
import {
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendPaymentReminderEmail,
  OrganizationEmailData,
} from '@/lib/email/subscription-emails';
import {
  notifyTrialExpiring,
  notifyTrialExpired,
} from '@/lib/notifications/subscription-notifications';
import { TIMEZONE } from '@/lib/services/trial-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CronJobResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  durationMs: number;
}

export interface SubscriptionCronStatus {
  trialReminders: {
    expiring7Days: number;
    expiring3Days: number;
    expiring1Day: number;
  };
  expiredTrials: number;
  upcomingRenewals: number;
  lastRunAt: {
    trialReminders: Date | null;
    trialExpiration: Date | null;
    paymentReminders: Date | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDayBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get organization email data from database record
 */
async function getOrganizationEmailData(organizationId: string): Promise<OrganizationEmailData | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!org || !org.owner?.email) {
    return null;
  }

  return {
    organizationId: org.id,
    organizationName: org.name,
    ownerName: org.owner.name || 'Usuario',
    ownerEmail: org.owner.email,
  };
}

/**
 * Log subscription cron event
 */
async function logCronEvent(
  eventType: string,
  result: CronJobResult,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.subscriptionEvent.create({
      data: {
        id: `cron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId: 'system',
        subscriptionId: 'system',
        eventType: `cron_${eventType}`,
        eventData: {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          durationMs: result.durationMs,
          ...details,
        },
        actorType: 'system',
      },
    });
  } catch (error) {
    console.error('[SubscriptionCron] Error logging cron event:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK TRIAL EXPIRING (7, 3, 1 days)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send trial expiring reminder emails
 * Runs daily at 9:00 AM Buenos Aires time
 */
export async function checkTrialExpiring(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[SubscriptionCron] Starting trial expiring check...');

  try {
    // Process for each reminder day (7, 3, 1)
    const reminderDays = [7, 3, 1];

    for (const days of reminderDays) {
      const targetDate = addDays(now, days);
      const { start, end } = getDayBoundaries(targetDate);

      // Find trials expiring on this day
      const expiringTrials = await prisma.organizationSubscription.findMany({
        where: {
          status: 'trialing',
          trialEndsAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          organizationId: true,
          trialEndsAt: true,
        },
      });

      console.log(`[SubscriptionCron] Found ${expiringTrials.length} trials expiring in ${days} days`);

      for (const subscription of expiringTrials) {
        processed++;

        try {
          // Check if we already sent a reminder for this day
          const existingReminder = await prisma.subscriptionEvent.findFirst({
            where: {
              organizationId: subscription.organizationId,
              eventType: `trial_reminder_${days}d`,
              createdAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          });

          if (existingReminder) {
            console.log(
              `[SubscriptionCron] Skipping ${days}-day reminder for org ${subscription.organizationId} - already sent`
            );
            continue;
          }

          // Get organization email data
          const emailData = await getOrganizationEmailData(subscription.organizationId);
          if (!emailData) {
            errors.push({
              id: subscription.organizationId,
              error: 'Could not get organization email data',
            });
            continue;
          }

          // Send the reminder email
          const emailResult = await sendTrialExpiringEmail(emailData, days);

          if (emailResult.success) {
            succeeded++;

            // Send in-app notification
            const org = await prisma.organization.findUnique({
              where: { id: subscription.organizationId },
              select: { ownerId: true },
            });
            if (org?.ownerId) {
              await notifyTrialExpiring(subscription.organizationId, org.ownerId, days);
            }

            // Log the reminder sent event
            await prisma.subscriptionEvent.create({
              data: {
                id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                subscriptionId: subscription.id,
                organizationId: subscription.organizationId,
                eventType: `trial_reminder_${days}d`,
                eventData: {
                  daysRemaining: days,
                  trialEndsAt: subscription.trialEndsAt?.toISOString(),
                  emailSentTo: emailData.ownerEmail,
                },
                actorType: 'system',
              },
            });

            console.log(
              `[SubscriptionCron] Sent ${days}-day trial reminder to ${emailData.ownerEmail} (org: ${subscription.organizationId})`
            );
          } else {
            errors.push({
              id: subscription.organizationId,
              error: emailResult.error || 'Email sending failed',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SubscriptionCron] Error processing trial reminder for ${subscription.organizationId}:`, error);
          errors.push({
            id: subscription.organizationId,
            error: errorMessage,
          });
        }
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[SubscriptionCron] Trial expiring check complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('trial_expiring', result, { reminderDays });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[SubscriptionCron] Fatal error in checkTrialExpiring:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK TRIAL EXPIRED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process expired trials and send notification emails
 * Runs daily at 6:00 AM Buenos Aires time
 */
export async function checkTrialExpired(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[SubscriptionCron] Starting trial expiration check...');

  try {
    // Find all trialing subscriptions that have expired
    const expiredTrials = await prisma.organizationSubscription.findMany({
      where: {
        status: 'trialing',
        trialEndsAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        organizationId: true,
        tier: true,
        trialEndsAt: true,
      },
    });

    console.log(`[SubscriptionCron] Found ${expiredTrials.length} expired trials to process`);

    for (const subscription of expiredTrials) {
      processed++;

      try {
        // Get organization email data before updating
        const emailData = await getOrganizationEmailData(subscription.organizationId);

        // Update subscription status and organization tier in a transaction
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

        // Send trial expired email
        if (emailData) {
          const emailResult = await sendTrialExpiredEmail(emailData);

          if (emailResult.success) {
            console.log(
              `[SubscriptionCron] Sent trial expired email to ${emailData.ownerEmail} (org: ${subscription.organizationId})`
            );
          } else {
            console.warn(
              `[SubscriptionCron] Failed to send trial expired email for org ${subscription.organizationId}: ${emailResult.error}`
            );
          }

          // Send in-app notification
          const org = await prisma.organization.findUnique({
            where: { id: subscription.organizationId },
            select: { ownerId: true },
          });
          if (org?.ownerId) {
            await notifyTrialExpired(subscription.organizationId, org.ownerId);
          }
        }

        succeeded++;
        console.log(`[SubscriptionCron] Processed expiration for org ${subscription.organizationId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SubscriptionCron] Error processing expiration for ${subscription.organizationId}:`, error);
        errors.push({
          id: subscription.organizationId,
          error: errorMessage,
        });
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[SubscriptionCron] Trial expiration check complete. Processed: ${processed}, Expired: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('trial_expired', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[SubscriptionCron] Fatal error in checkTrialExpired:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND PAYMENT REMINDERS (3 days before renewal)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send payment reminder emails 3 days before subscription renewal
 * Runs daily at 9:00 AM Buenos Aires time
 */
export async function sendPaymentReminders(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[SubscriptionCron] Starting payment reminders check...');

  try {
    // Find subscriptions renewing in 3 days
    const targetDate = addDays(now, 3);
    const { start, end } = getDayBoundaries(targetDate);

    const upcomingRenewals = await prisma.organizationSubscription.findMany({
      where: {
        status: 'active',
        cancelAtPeriodEnd: false, // Not cancelling
        currentPeriodEnd: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        organizationId: true,
        tier: true,
        billingCycle: true,
        currentPeriodEnd: true,
      },
    });

    console.log(`[SubscriptionCron] Found ${upcomingRenewals.length} subscriptions renewing in 3 days`);

    for (const subscription of upcomingRenewals) {
      processed++;

      try {
        // Check if we already sent a reminder for this renewal period
        const existingReminder = await prisma.subscriptionEvent.findFirst({
          where: {
            organizationId: subscription.organizationId,
            eventType: 'payment_reminder_3d',
            createdAt: {
              gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });

        if (existingReminder) {
          console.log(
            `[SubscriptionCron] Skipping payment reminder for org ${subscription.organizationId} - already sent`
          );
          continue;
        }

        // Get organization email data
        const emailData = await getOrganizationEmailData(subscription.organizationId);
        if (!emailData) {
          errors.push({
            id: subscription.organizationId,
            error: 'Could not get organization email data',
          });
          continue;
        }

        // Send payment reminder email
        const emailResult = await sendPaymentReminderEmail(
          emailData,
          subscription.tier,
          subscription.billingCycle,
          subscription.currentPeriodEnd!
        );

        if (emailResult.success) {
          succeeded++;

          // Log the reminder sent event
          await prisma.subscriptionEvent.create({
            data: {
              id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              subscriptionId: subscription.id,
              organizationId: subscription.organizationId,
              eventType: 'payment_reminder_3d',
              eventData: {
                renewalDate: subscription.currentPeriodEnd?.toISOString(),
                tier: subscription.tier,
                billingCycle: subscription.billingCycle,
                emailSentTo: emailData.ownerEmail,
              },
              actorType: 'system',
            },
          });

          console.log(
            `[SubscriptionCron] Sent payment reminder to ${emailData.ownerEmail} (org: ${subscription.organizationId})`
          );
        } else {
          errors.push({
            id: subscription.organizationId,
            error: emailResult.error || 'Email sending failed',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SubscriptionCron] Error sending payment reminder for ${subscription.organizationId}:`, error);
        errors.push({
          id: subscription.organizationId,
          error: errorMessage,
        });
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[SubscriptionCron] Payment reminders complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('payment_reminders', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[SubscriptionCron] Fatal error in sendPaymentReminders:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS AND MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current status of subscription cron jobs
 */
export async function getSubscriptionCronStatus(): Promise<SubscriptionCronStatus> {
  const now = new Date();

  try {
    // Count trials expiring in 7, 3, 1 days
    const countExpiring = async (days: number): Promise<number> => {
      const targetDate = addDays(now, days);
      const { start, end } = getDayBoundaries(targetDate);
      return prisma.organizationSubscription.count({
        where: {
          status: 'trialing',
          trialEndsAt: { gte: start, lte: end },
        },
      });
    };

    const [expiring7Days, expiring3Days, expiring1Day] = await Promise.all([
      countExpiring(7),
      countExpiring(3),
      countExpiring(1),
    ]);

    // Count expired trials not yet processed
    const expiredTrials = await prisma.organizationSubscription.count({
      where: {
        status: 'trialing',
        trialEndsAt: { lt: now },
      },
    });

    // Count upcoming renewals in 3 days
    const targetDate = addDays(now, 3);
    const { start, end } = getDayBoundaries(targetDate);
    const upcomingRenewals = await prisma.organizationSubscription.count({
      where: {
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: { gte: start, lte: end },
      },
    });

    // Get last run times
    const getLastRunTime = async (eventType: string): Promise<Date | null> => {
      const event = await prisma.subscriptionEvent.findFirst({
        where: {
          eventType: `cron_${eventType}`,
          organizationId: 'system',
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      return event?.createdAt || null;
    };

    const [lastTrialReminders, lastTrialExpiration, lastPaymentReminders] = await Promise.all([
      getLastRunTime('trial_expiring'),
      getLastRunTime('trial_expired'),
      getLastRunTime('payment_reminders'),
    ]);

    return {
      trialReminders: {
        expiring7Days,
        expiring3Days,
        expiring1Day,
      },
      expiredTrials,
      upcomingRenewals,
      lastRunAt: {
        trialReminders: lastTrialReminders,
        trialExpiration: lastTrialExpiration,
        paymentReminders: lastPaymentReminders,
      },
    };
  } catch (error) {
    console.error('[SubscriptionCron] Error getting status:', error);
    return {
      trialReminders: { expiring7Days: 0, expiring3Days: 0, expiring1Day: 0 },
      expiredTrials: 0,
      upcomingRenewals: 0,
      lastRunAt: {
        trialReminders: null,
        trialExpiration: null,
        paymentReminders: null,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN ALL SUBSCRIPTION CRONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all subscription cron jobs
 * Convenience function for running all jobs in sequence
 */
export async function runAllSubscriptionCrons(): Promise<{
  trialExpiring: CronJobResult;
  trialExpired: CronJobResult;
  paymentReminders: CronJobResult;
}> {
  console.log('[SubscriptionCron] Running all subscription cron jobs...');

  const [trialExpiring, trialExpired, paymentReminders] = await Promise.all([
    checkTrialExpiring(),
    checkTrialExpired(),
    sendPaymentReminders(),
  ]);

  return {
    trialExpiring,
    trialExpired,
    paymentReminders,
  };
}
