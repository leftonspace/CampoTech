// Admin Dashboard Types

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'viewer';
}

export interface Business {
  id: string;
  name: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';
  mrr: number;
  status: 'active' | 'suspended' | 'cancelled' | 'trial';
  createdAt: string;
  lastActiveAt: string;
  userCount: number;
  jobCount: number;
  notes?: string;
}

export interface DashboardMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  mrr: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
  churnRate: number;
  activeUsersToday: number;
  systemHealth: {
    api: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    whatsapp: 'healthy' | 'degraded' | 'down';
    payments: 'healthy' | 'degraded' | 'down';
  };
}

export interface RevenueData {
  date: string;
  revenue: number;
  subscriptions: number;
}

export interface RevenueByTier {
  tier: string;
  revenue: number;
  count: number;
  percentage: number;
}

export interface FailedPayment {
  id: string;
  businessId: string;
  businessName: string;
  amount: number;
  failedAt: string;
  reason: string;
  retryCount: number;
}

export interface AIConversation {
  id: string;
  businessId: string;
  businessName: string;
  customerPhone: string; // Anonymized
  messageCount: number;
  confidenceScore: number;
  status: 'completed' | 'escalated' | 'failed';
  createdAt: string;
  summary?: string;
}

export interface VoiceTranscription {
  id: string;
  businessId: string;
  technicianName: string;
  duration: number;
  transcription: string;
  createdAt: string;
}

export interface TechnicianLocation {
  id: string;
  technicianId: string;
  technicianName: string;
  businessId: string;
  businessName: string;
  latitude: number;
  longitude: number;
  status: 'en_route' | 'arrived' | 'in_progress' | 'completed';
  currentJobId?: string;
  lastUpdated: string;
}

export interface Job {
  id: string;
  businessId: string;
  businessName: string;
  customerId: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
  scheduledAt: string;
  technicianId?: string;
  technicianName?: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION TYPES
// ────────────────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA';
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface SubscriptionListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  cuit: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  priceUsd: number | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  userCount: number;
  jobCount: number;
}

export interface SubscriptionDetail extends SubscriptionListItem {
  currentPeriodStart: string;
  mpSubscriptionId: string | null;
  mpPayerId: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
  updatedAt: string;
}

export interface SubscriptionPaymentItem {
  id: string;
  subscriptionId: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: 'initial' | 'recurring' | 'upgrade' | 'downgrade' | 'reactivation';
  paymentMethod: string | null;
  billingCycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  mpPaymentId: string | null;
  failureReason: string | null;
  failureCode: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface SubscriptionEventItem {
  id: string;
  subscriptionId: string | null;
  organizationId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  actorType: string | null;
  actorId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminSubscriptionNote {
  id: string;
  subscriptionId: string;
  adminId: string;
  adminName: string;
  content: string;
  createdAt: string;
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  revenueThisMonth: number;
  trialToPayConversion: number;
  churnRate: number;
  revenueByMonth: { month: string; revenue: number }[];
  revenueByTier: { tier: string; revenue: number; count: number; percentage: number }[];
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus | 'all';
  tier?: SubscriptionTier | 'all';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
