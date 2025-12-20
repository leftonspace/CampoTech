/**
 * CampoTech Funnel Tracker
 * ========================
 *
 * Tracks user journey through key conversion funnels:
 * - Signup → Trial → Verify → Paid subscription
 * - Document renewal flow
 * - Subscription change flows
 *
 * Provides analytics for:
 * - Drop-off point identification
 * - Conversion rates
 * - Time to conversion
 * - Funnel performance metrics
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type FunnelEvent =
  // Signup & Trial Funnel
  | 'signup_started'
  | 'signup_completed'
  | 'trial_started'
  | 'trial_activated'
  | 'trial_expiring_soon'
  | 'trial_expired'
  | 'trial_converted'

  // Onboarding Funnel
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_dropped'

  // Verification Funnel
  | 'verification_started'
  | 'cuit_submitted'
  | 'cuit_verified'
  | 'dni_submitted'
  | 'dni_verified'
  | 'selfie_submitted'
  | 'selfie_verified'
  | 'phone_verified'
  | 'verification_completed'

  // Document Renewal Funnel
  | 'document_expiring_notified'
  | 'document_renewal_started'
  | 'document_renewal_submitted'
  | 'document_renewal_approved'
  | 'document_renewal_rejected'
  | 'document_expired'

  // Subscription Funnel
  | 'plan_viewed'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_abandoned'
  | 'payment_succeeded'
  | 'payment_failed'

  // Subscription Changes
  | 'upgrade_initiated'
  | 'upgrade_completed'
  | 'downgrade_scheduled'
  | 'subscription_cancelled'
  | 'subscription_reactivated'

  // Job Funnel
  | 'first_job_created'
  | 'first_job_assigned'
  | 'first_job_completed';

export interface FunnelEventInput {
  event: FunnelEvent;
  organizationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface FunnelMetrics {
  funnel: string;
  totalStarted: number;
  completed: number;
  conversionRate: number;
  avgTimeToConversion: number | null;
  dropOffPoints: Array<{
    step: string;
    count: number;
    percentage: number;
  }>;
}

export interface OrganizationFunnelStatus {
  signup: { completed: boolean; completedAt: Date | null };
  trial: { started: boolean; expired: boolean; converted: boolean };
  verification: { started: boolean; completed: boolean; completedAt: Date | null };
  subscription: { hasActive: boolean; tier: string | null; paidAt: Date | null };
  firstJob: { created: boolean; completed: boolean };
  overallConversion: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Main conversion funnel steps */
const MAIN_FUNNEL_STEPS: FunnelEvent[] = [
  'signup_completed',
  'trial_started',
  'verification_started',
  'cuit_verified',
  'verification_completed',
  'plan_viewed',
  'checkout_started',
  'payment_succeeded',
];

/** Verification funnel steps */
const VERIFICATION_FUNNEL_STEPS: FunnelEvent[] = [
  'verification_started',
  'cuit_submitted',
  'cuit_verified',
  'dni_submitted',
  'dni_verified',
  'selfie_submitted',
  'selfie_verified',
  'phone_verified',
  'verification_completed',
];

// ═══════════════════════════════════════════════════════════════════════════════
// FUNNEL TRACKER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class FunnelTrackerService {
  /**
   * Track a funnel event
   */
  async trackEvent(input: FunnelEventInput): Promise<void> {
    const { event, organizationId, userId, metadata, timestamp } = input;

    try {
      // Store in database
      await prisma.subscriptionEvent.create({
        data: {
          organizationId: organizationId || 'anonymous',
          subscriptionId: 'funnel_tracking',
          eventType: `funnel.${event}`,
          eventData: {
            event,
            userId,
            metadata,
            tracked_at: (timestamp || new Date()).toISOString(),
            user_agent: metadata?.userAgent,
            ip_address: metadata?.ipAddress,
          } as Prisma.InputJsonValue,
          actorType: 'system',
          createdAt: timestamp || new Date(),
        },
      });

      console.log(
        `[FunnelTracker] Event tracked: ${event}` +
          (organizationId ? ` for org ${organizationId}` : '')
      );

      // Update organization funnel status if applicable
      if (organizationId) {
        await this.updateFunnelStatus(organizationId, event, metadata);
      }
    } catch (error) {
      console.error('[FunnelTracker] Error tracking event:', error);
      // Don't throw - tracking failures shouldn't break the app
    }
  }

  /**
   * Track multiple events at once
   */
  async trackEvents(events: FunnelEventInput[]): Promise<void> {
    await Promise.all(events.map((e) => this.trackEvent(e)));
  }

  /**
   * Get funnel status for an organization
   */
  async getOrganizationFunnelStatus(
    organizationId: string
  ): Promise<OrganizationFunnelStatus> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        createdAt: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        verificationStatus: true,
        verificationCompletedAt: true,
        onboardingCompletedAt: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get first payment
    const firstPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        organizationId,
        status: 'completed',
      },
      orderBy: { paidAt: 'asc' },
      select: { paidAt: true },
    });

    // Check if has jobs
    const jobCount = await prisma.job.count({
      where: { organizationId },
    });

    const completedJobCount = await prisma.job.count({
      where: {
        organizationId,
        status: 'completed',
      },
    });

    const isTrial = org.subscriptionStatus === 'trialing';
    const isTrialExpired = org.subscriptionStatus === 'expired';
    const hasActiveSubscription = org.subscriptionStatus === 'active';

    return {
      signup: {
        completed: true,
        completedAt: org.createdAt,
      },
      trial: {
        started: isTrial || hasActiveSubscription || isTrialExpired,
        expired: isTrialExpired,
        converted: hasActiveSubscription && firstPayment !== null,
      },
      verification: {
        started: org.verificationStatus !== 'pending' || org.onboardingCompletedAt !== null,
        completed: org.verificationStatus === 'verified',
        completedAt: org.verificationCompletedAt,
      },
      subscription: {
        hasActive: hasActiveSubscription,
        tier: hasActiveSubscription ? org.subscriptionTier : null,
        paidAt: firstPayment?.paidAt || null,
      },
      firstJob: {
        created: jobCount > 0,
        completed: completedJobCount > 0,
      },
      overallConversion: hasActiveSubscription && org.verificationStatus === 'verified',
    };
  }

  /**
   * Get funnel metrics for a specific funnel
   */
  async getFunnelMetrics(
    funnel: 'main' | 'verification' | 'subscription',
    dateRange?: { start: Date; end: Date }
  ): Promise<FunnelMetrics> {
    const steps = funnel === 'main' ? MAIN_FUNNEL_STEPS :
                  funnel === 'verification' ? VERIFICATION_FUNNEL_STEPS :
                  MAIN_FUNNEL_STEPS; // TODO: Add subscription funnel

    const dateFilter = dateRange
      ? { gte: dateRange.start, lte: dateRange.end }
      : undefined;

    // Get counts for each step
    const stepCounts: Record<string, number> = {};

    for (const step of steps) {
      const count = await prisma.subscriptionEvent.count({
        where: {
          eventType: `funnel.${step}`,
          createdAt: dateFilter,
        },
      });
      stepCounts[step] = count;
    }

    // Calculate drop-off points
    const dropOffPoints: FunnelMetrics['dropOffPoints'] = [];
    const firstStep = steps[0];
    const totalStarted = stepCounts[firstStep] || 0;

    for (let i = 0; i < steps.length - 1; i++) {
      const currentStep = steps[i];
      const nextStep = steps[i + 1];
      const currentCount = stepCounts[currentStep] || 0;
      const nextCount = stepCounts[nextStep] || 0;
      const dropOff = currentCount - nextCount;

      if (dropOff > 0) {
        dropOffPoints.push({
          step: currentStep,
          count: dropOff,
          percentage: totalStarted > 0 ? (dropOff / totalStarted) * 100 : 0,
        });
      }
    }

    // Calculate conversion rate
    const lastStep = steps[steps.length - 1];
    const completed = stepCounts[lastStep] || 0;
    const conversionRate = totalStarted > 0 ? (completed / totalStarted) * 100 : 0;

    // Calculate average time to conversion
    let avgTimeToConversion: number | null = null;

    if (completed > 0) {
      // Get orgs that completed the funnel
      const completedOrgs = await prisma.subscriptionEvent.findMany({
        where: {
          eventType: `funnel.${lastStep}`,
          createdAt: dateFilter,
        },
        select: { organizationId: true, createdAt: true },
      });

      let totalTime = 0;
      let validOrgs = 0;

      for (const event of completedOrgs) {
        // Find the first step for this org
        const startEvent = await prisma.subscriptionEvent.findFirst({
          where: {
            organizationId: event.organizationId,
            eventType: `funnel.${firstStep}`,
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });

        if (startEvent) {
          const timeDiffMs = event.createdAt.getTime() - startEvent.createdAt.getTime();
          totalTime += timeDiffMs;
          validOrgs++;
        }
      }

      if (validOrgs > 0) {
        avgTimeToConversion = totalTime / validOrgs / (1000 * 60 * 60 * 24); // Convert to days
      }
    }

    return {
      funnel,
      totalStarted,
      completed,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgTimeToConversion: avgTimeToConversion ? Math.round(avgTimeToConversion * 10) / 10 : null,
      dropOffPoints: dropOffPoints.sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Get conversion funnel summary for dashboard
   */
  async getConversionSummary(
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSignups: number;
    trialStarts: number;
    verificationsComplete: number;
    paidConversions: number;
    conversionRate: number;
    verificationRate: number;
    trialToPayRate: number;
  }> {
    const dateFilter = dateRange
      ? { gte: dateRange.start, lte: dateRange.end }
      : undefined;

    const [
      totalSignups,
      trialStarts,
      verificationsComplete,
      paidConversions,
    ] = await Promise.all([
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.signup_completed', createdAt: dateFilter },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.trial_started', createdAt: dateFilter },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.verification_completed', createdAt: dateFilter },
      }),
      prisma.subscriptionEvent.count({
        where: { eventType: 'funnel.payment_succeeded', createdAt: dateFilter },
      }),
    ]);

    return {
      totalSignups,
      trialStarts,
      verificationsComplete,
      paidConversions,
      conversionRate: totalSignups > 0
        ? Math.round((paidConversions / totalSignups) * 100 * 100) / 100
        : 0,
      verificationRate: totalSignups > 0
        ? Math.round((verificationsComplete / totalSignups) * 100 * 100) / 100
        : 0,
      trialToPayRate: trialStarts > 0
        ? Math.round((paidConversions / trialStarts) * 100 * 100) / 100
        : 0,
    };
  }

  /**
   * Get drop-off analysis for a specific step
   */
  async getDropOffAnalysis(
    fromStep: FunnelEvent,
    toStep: FunnelEvent,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    startedCount: number;
    completedCount: number;
    droppedCount: number;
    dropOffRate: number;
    droppedOrgs: Array<{
      organizationId: string;
      stuckAt: string;
      daysSinceStart: number;
    }>;
  }> {
    const dateFilter = dateRange
      ? { gte: dateRange.start, lte: dateRange.end }
      : undefined;

    // Get orgs that started
    const startedEvents = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: `funnel.${fromStep}`,
        createdAt: dateFilter,
      },
      select: { organizationId: true, createdAt: true },
    });

    const startedOrgs = new Set(startedEvents.map((e) => e.organizationId));

    // Get orgs that completed
    const completedEvents = await prisma.subscriptionEvent.findMany({
      where: {
        eventType: `funnel.${toStep}`,
        organizationId: { in: Array.from(startedOrgs) },
      },
      select: { organizationId: true },
    });

    const completedOrgs = new Set(completedEvents.map((e) => e.organizationId));

    // Find dropped orgs
    const droppedOrgs: Array<{
      organizationId: string;
      stuckAt: string;
      daysSinceStart: number;
    }> = [];

    for (const event of startedEvents) {
      if (!completedOrgs.has(event.organizationId)) {
        const daysSinceStart = Math.floor(
          (Date.now() - event.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        droppedOrgs.push({
          organizationId: event.organizationId,
          stuckAt: fromStep,
          daysSinceStart,
        });
      }
    }

    const startedCount = startedOrgs.size;
    const completedCount = completedOrgs.size;
    const droppedCount = startedCount - completedCount;

    return {
      startedCount,
      completedCount,
      droppedCount,
      dropOffRate: startedCount > 0
        ? Math.round((droppedCount / startedCount) * 100 * 100) / 100
        : 0,
      droppedOrgs: droppedOrgs.slice(0, 100), // Limit to 100
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Update organization's funnel status based on event
   */
  private async updateFunnelStatus(
    organizationId: string,
    event: FunnelEvent,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    // Map events to organization fields
    const updates: Prisma.OrganizationUpdateInput = {};

    switch (event) {
      case 'verification_completed':
        updates.verificationCompletedAt = new Date();
        break;

      case 'onboarding_completed':
        updates.onboardingCompletedAt = new Date();
        break;

      case 'payment_succeeded':
        updates.subscriptionStatus = 'active';
        break;

      // Other events don't need org updates
      default:
        return;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await prisma.organization.update({
          where: { id: organizationId },
          data: updates,
        });
      } catch (error) {
        console.error('[FunnelTracker] Error updating org status:', error);
      }
    }
  }
}

// Export singleton
export const funnelTracker = new FunnelTrackerService();
