/**
 * Subscription Types
 * ==================
 *
 * Core type definitions for subscription and billing functionality.
 * These types are used throughout the application and should match the Prisma schema.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type SubscriptionTier = 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA';

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'paused';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type SubscriptionPaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type ComplianceBlockType = 'soft_block' | 'hard_block' | 'none';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  pendingTierChange?: SubscriptionTier | null;
  pendingTierChangeDate?: Date | null;
  mercadoPagoSubscriptionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPayment {
  id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: SubscriptionPaymentStatus;
  billingCycle: BillingCycle;
  tier: SubscriptionTier;
  mercadoPagoPaymentId?: string | null;
  mercadoPagoPreferenceId?: string | null;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  refundAmount?: number | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceBlock {
  id: string;
  organizationId: string;
  blockType: ComplianceBlockType;
  reason: string;
  reasonCode: string;
  blockedAt: Date;
  blockedBy?: string | null;
  unblockedAt?: Date | null;
  unblockedBy?: string | null;
  unblockReason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
  name: string;
  tier: SubscriptionTier;
  monthlyPrice: number;
  yearlyPrice: number;
  maxJobs: number;
  features: string[];
}

export interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  canExtend: boolean;
}

export interface CreateTrialResult {
  success: boolean;
  organizationId: string;
  trialEndsAt: Date;
  tier: SubscriptionTier;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  preferenceId?: string;
  initPoint?: string;
  error?: string;
}
