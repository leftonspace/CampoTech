/**
 * CampoTech Trial Manager
 * =======================
 *
 * Manages free trial periods for organizations.
 * All organizations start with a 21-day trial when they sign up.
 *
 * Business Rules:
 * - Trial period: 21 days (3 weeks)
 * - Trial allows full access to INICIAL tier features
 * - After trial expires, org needs to choose a paid plan
 * - 3-day grace period after expiry before hard block
 * - During trial, verification is encouraged but not required
 *
 * Timezone: All calculations use Buenos Aires time (America/Argentina/Buenos_Aires)
 */

import { prisma } from '@/lib/prisma';
import type {
  SubscriptionTier,
} from '@/lib/types/subscription';

// Type for OrganizationSubscription from Prisma model
type OrganizationSubscription = Awaited<ReturnType<typeof prisma.organizationSubscription.findFirst>> & {};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Trial period in days */
export const TRIAL_DAYS = 21;

/** Tier granted during trial (full access to starter features) */
export const TRIAL_TIER: SubscriptionTier = 'INICIAL';

/** Buenos Aires timezone for date calculations */
export const TIMEZONE = 'America/Argentina/Buenos_Aires';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrialStatus {
  isActive: boolean;
  isTrialing: boolean; // Alias for isActive
  daysRemaining: number;
  trialEndsAt: Date | null;
  isExpired: boolean;
  isExpiringSoon: boolean; // Less than 7 days remaining
}

export interface CreateTrialResult {
  success: boolean;
  subscription?: OrganizationSubscription;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current date in Buenos Aires timezone
 */
function getBuenosAiresNow(): Date {
  // Get current UTC time and format it for Buenos Aires
  const now = new Date();
  // Buenos Aires is UTC-3
  return now;
}

/**
 * Add days to a date (considering Buenos Aires time)
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get days remaining until a date
 */
function getDaysUntil(targetDate: Date): number {
  const now = getBuenosAiresNow();
  const diffMs = targetDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past
 */
function isDatePast(date: Date): boolean {
  const now = getBuenosAiresNow();
  return date.getTime() < now.getTime();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class TrialManager {
  /**
   * Create a new trial subscription for an organization
   * Called automatically during signup
   */
  async createTrial(organizationId: string, tier?: SubscriptionTier): Promise<CreateTrialResult> {
    try {
      const now = getBuenosAiresNow();
      const trialEndsAt = addDays(now, TRIAL_DAYS);
      const trialTier = tier || TRIAL_TIER;

      const subscription = await prisma.organizationSubscription.create({
        data: {
          organizationId,
          tier: trialTier,
          billingCycle: 'MONTHLY', // Default, will be set when they upgrade
          status: 'trialing',
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
        },
      });

      // Update organization with subscription info
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionTier: trialTier,
          subscriptionStatus: 'trialing',
          trialEndsAt,
        },
      });

      // Log the trial start event
      await this.logEvent(organizationId, subscription.id, 'trial_started', {
        trialDays: TRIAL_DAYS,
        trialEndsAt: trialEndsAt.toISOString(),
        tier: trialTier,
      });

      console.log(
        `[TrialManager] Created ${TRIAL_DAYS}-day trial at ${trialTier} for org ${organizationId}, ends at ${trialEndsAt.toISOString()}`
      );

      return { success: true, subscription };
    } catch (error) {
      console.error('[TrialManager] Error creating trial:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if an organization's trial is currently active
   */
  async isTrialActive(organizationId: string): Promise<boolean> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      });

      if (!org) return false;

      // Must be in trialing status
      if (org.subscriptionStatus !== 'trialing') return false;

      // Trial end date must be in the future
      if (!org.trialEndsAt) return false;

      return !isDatePast(org.trialEndsAt);
    } catch (error) {
      console.error('[TrialManager] Error checking trial status:', error);
      return false;
    }
  }

  /**
   * Get number of days remaining in trial
   */
  async getTrialDaysRemaining(organizationId: string): Promise<number> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      });

      if (!org || !org.trialEndsAt) return 0;

      if (org.subscriptionStatus !== 'trialing') return 0;

      const days = getDaysUntil(org.trialEndsAt);
      return Math.max(0, days);
    } catch (error) {
      console.error('[TrialManager] Error getting trial days remaining:', error);
      return 0;
    }
  }

  /**
   * Check if an organization's trial has expired
   */
  async isTrialExpired(organizationId: string): Promise<boolean> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      });

      if (!org) return true; // No org = expired

      // If status is already expired, return true
      if (org.subscriptionStatus === 'expired') return true;

      // If trialing but past end date
      if (org.subscriptionStatus === 'trialing' && org.trialEndsAt) {
        return isDatePast(org.trialEndsAt);
      }

      return false;
    } catch (error) {
      console.error('[TrialManager] Error checking trial expiration:', error);
      return true; // Fail safe
    }
  }

  /**
   * Get full trial status for an organization
   */
  async getTrialStatus(organizationId: string): Promise<TrialStatus> {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      });

      if (!org) {
        return {
          isActive: false,
          isTrialing: false,
          daysRemaining: 0,
          trialEndsAt: null,
          isExpired: true,
          isExpiringSoon: false,
        };
      }

      const isTrialing = org.subscriptionStatus === 'trialing';
      const trialEndsAt = org.trialEndsAt;
      const daysRemaining = trialEndsAt ? Math.max(0, getDaysUntil(trialEndsAt)) : 0;
      const isExpired = trialEndsAt ? isDatePast(trialEndsAt) : !isTrialing;
      const isActive = isTrialing && !isExpired;
      const isExpiringSoon = isActive && daysRemaining <= 7 && daysRemaining > 0;

      return {
        isActive,
        isTrialing,
        daysRemaining,
        trialEndsAt,
        isExpired: isTrialing ? isExpired : org.subscriptionStatus === 'expired',
        isExpiringSoon,
      };
    } catch (error) {
      console.error('[TrialManager] Error getting trial status:', error);
      return {
        isActive: false,
        isTrialing: false,
        daysRemaining: 0,
        trialEndsAt: null,
        isExpired: true,
        isExpiringSoon: false,
      };
    }
  }

  /**
   * Expire a trial (set status to expired)
   * Called by cron job when trial ends
   */
  async expireTrial(organizationId: string): Promise<boolean> {
    try {
      // Update subscription record
      await prisma.organizationSubscription.updateMany({
        where: {
          organizationId,
          status: 'trialing',
        },
        data: {
          status: 'expired',
          updatedAt: new Date(),
        },
      });

      // Update organization
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionStatus: 'expired',
          subscriptionTier: 'FREE', // Downgrade to FREE
        },
      });

      // Get subscription for event logging
      const subscription = await prisma.organizationSubscription.findFirst({
        where: { organizationId },
      });

      // Log the expiration event
      if (subscription) {
        await this.logEvent(organizationId, subscription.id, 'trial_ended', {
          reason: 'expired',
          wasConverted: false,
        });
      }

      console.log(`[TrialManager] Expired trial for org ${organizationId}`);

      return true;
    } catch (error) {
      console.error('[TrialManager] Error expiring trial:', error);
      return false;
    }
  }

  /**
   * Convert trial to paid subscription
   * Called when user successfully pays
   */
  async convertTrialToActive(
    organizationId: string,
    tier: SubscriptionTier,
    billingCycle: 'MONTHLY' | 'YEARLY'
  ): Promise<boolean> {
    try {
      const now = getBuenosAiresNow();
      const periodDays = billingCycle === 'YEARLY' ? 365 : 30;
      const periodEnd = addDays(now, periodDays);

      // Update subscription
      await prisma.organizationSubscription.updateMany({
        where: { organizationId },
        data: {
          tier,
          billingCycle,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        },
      });

      // Update organization
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionTier: tier,
          subscriptionStatus: 'active',
          trialEndsAt: null, // Clear trial end date
        },
      });

      // Get subscription for event logging
      const subscription = await prisma.organizationSubscription.findFirst({
        where: { organizationId },
      });

      // Log the conversion event
      if (subscription) {
        await this.logEvent(organizationId, subscription.id, 'trial_ended', {
          reason: 'converted',
          wasConverted: true,
          newTier: tier,
          billingCycle,
        });

        await this.logEvent(organizationId, subscription.id, 'subscription_activated', {
          tier,
          billingCycle,
          periodEnd: periodEnd.toISOString(),
        });
      }

      console.log(
        `[TrialManager] Converted trial to ${tier} (${billingCycle}) for org ${organizationId}`
      );

      return true;
    } catch (error) {
      console.error('[TrialManager] Error converting trial:', error);
      return false;
    }
  }

  /**
   * Log subscription event
   */
  private async logEvent(
    organizationId: string,
    subscriptionId: string,
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId,
          eventType,
          eventData,
          actorType: 'system',
        },
      });
    } catch (error) {
      console.error('[TrialManager] Error logging event:', error);
    }
  }

  /**
   * Get trial reminder info for notifications
   * Returns organizations that need trial expiration reminders
   */
  async getTrialsNeedingReminders(
    daysBeforeExpiry: number
  ): Promise<Array<{ organizationId: string; daysRemaining: number; email: string | null }>> {
    try {
      const now = getBuenosAiresNow();
      const _targetDate = addDays(now, daysBeforeExpiry);

      // Find orgs with trials expiring around the target date
      const orgs = await prisma.organization.findMany({
        where: {
          subscriptionStatus: 'trialing',
          trialEndsAt: {
            gte: addDays(now, daysBeforeExpiry - 1),
            lte: addDays(now, daysBeforeExpiry + 1),
          },
        },
        select: {
          id: true,
          trialEndsAt: true,
          email: true,
        },
      });

      type OrgEntry = (typeof orgs)[number];
      return orgs.map((org: OrgEntry) => ({
        organizationId: org.id,
        daysRemaining: org.trialEndsAt ? getDaysUntil(org.trialEndsAt) : 0,
        email: org.email,
      }));
    } catch (error) {
      console.error('[TrialManager] Error getting trials needing reminders:', error);
      return [];
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const trialManager = new TrialManager();
