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

// ────────────────────────────────────────────────────────────────────────────────
// VERIFICATION TYPES
// ────────────────────────────────────────────────────────────────────────────────

export type VerificationCategory = 'identity' | 'business' | 'professional' | 'insurance' | 'background' | 'financial';
export type VerificationAppliesTo = 'organization' | 'owner' | 'employee';
export type VerificationSubmissionStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
export type VerifiedByType = 'auto' | 'admin';

export interface VerificationQueueItem {
  id: string;
  organizationId: string;
  organizationName: string;
  userId: string | null;
  userName: string | null;
  requirementId: string;
  requirementCode: string;
  requirementName: string;
  category: VerificationCategory;
  appliesTo: VerificationAppliesTo;
  tier: number;
  status: VerificationSubmissionStatus;
  submittedValue: string | null;
  documentUrl: string | null;
  documentType: string | null;
  documentFilename: string | null;
  submittedAt: string;
  priority: 'new_business' | 'renewal' | 'badge_request' | 'normal';
  isFirstSubmission: boolean;
}

export interface VerificationSubmissionDetail extends VerificationQueueItem {
  verifiedAt: string | null;
  verifiedBy: VerifiedByType | null;
  verifiedByUserId: string | null;
  rejectionReason: string | null;
  rejectionCode: string | null;
  expiresAt: string | null;
  autoVerifyResponse: Record<string, unknown> | null;
  autoVerifyCheckedAt: string | null;
  notes: string | null;
  adminNotes: string | null;
  updatedAt: string;
  previousSubmissions: VerificationSubmissionHistory[];
}

export interface VerificationSubmissionHistory {
  id: string;
  status: VerificationSubmissionStatus;
  submittedValue: string | null;
  documentUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface VerificationDashboardStats {
  pendingReview: number;
  inReview: number;
  approvedToday: number;
  rejectedToday: number;
  expiringIn7Days: number;
  totalPending: number;
}

export interface VerificationFilters {
  status?: VerificationSubmissionStatus | 'all';
  category?: VerificationCategory | 'all';
  priority?: 'new_business' | 'renewal' | 'badge_request' | 'all';
  appliesTo?: VerificationAppliesTo | 'all';
  search?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
}

export interface OrganizationComplianceItem {
  organizationId: string;
  organizationName: string;
  cuit: string | null;
  ownerName: string;
  ownerEmail: string;
  verificationStatus: 'not_started' | 'pending' | 'verified' | 'suspended';
  tier2Progress: { completed: number; total: number };
  tier3Progress: { completed: number; total: number };
  badgesEarned: number;
  isBlocked: boolean;
  blockReason: string | null;
  createdAt: string;
}

export interface OrganizationComplianceDetail extends OrganizationComplianceItem {
  requirements: OrganizationRequirementStatus[];
  employees: EmployeeVerificationStatus[];
}

export interface OrganizationRequirementStatus {
  requirementId: string;
  code: string;
  name: string;
  category: VerificationCategory;
  tier: number;
  isRequired: boolean;
  status: VerificationSubmissionStatus | 'not_submitted';
  submittedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  documentUrl: string | null;
}

export interface EmployeeVerificationStatus {
  userId: string;
  name: string;
  email: string;
  role: string;
  verificationStatus: 'not_started' | 'pending' | 'verified' | 'blocked';
  completedRequirements: number;
  totalRequirements: number;
  canBeAssignedJobs: boolean;
}

export const REJECTION_REASONS = [
  { code: 'illegible', label: 'Documento ilegible' },
  { code: 'expired', label: 'Documento vencido' },
  { code: 'mismatch', label: 'Datos no coinciden' },
  { code: 'incorrect', label: 'Documento incorrecto' },
  { code: 'invalid_photo', label: 'Foto no válida' },
  { code: 'other', label: 'Otro' },
] as const;

// ────────────────────────────────────────────────────────────────────────────────
// ADMIN ALERTS TYPES
// ────────────────────────────────────────────────────────────────────────────────

export type AdminAlertType =
  | 'new_subscription_payment'
  | 'failed_payment'
  | 'new_verification_submission'
  | 'document_expired'
  | 'organization_blocked'
  | 'subscription_cancelled'
  | 'verification_approved'
  | 'verification_rejected';

export interface AdminAlert {
  id: string;
  type: AdminAlertType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  entityType: 'organization' | 'subscription' | 'verification' | 'payment';
  entityId: string;
  organizationId: string | null;
  organizationName: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AdminAlertPreferences {
  adminId: string;
  emailEnabled: boolean;
  emailDigestFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
  inAppEnabled: boolean;
  alertTypes: {
    [key in AdminAlertType]: {
      email: boolean;
      inApp: boolean;
    };
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// UNIFIED DASHBOARD TYPES
// ────────────────────────────────────────────────────────────────────────────────

export interface UnifiedDashboardStats {
  subscriptions: {
    totalActive: number;
    byTier: { tier: string; count: number; percentage: number }[];
    mrr: number;
    mrrTrend: { month: string; mrr: number }[];
    trialConversion: number;
    churnRate: number;
  };
  verifications: {
    pendingReview: number;
    inReview: number;
    approvedToday: number;
    rejectedToday: number;
    expiringThisWeek: number;
  };
  pendingActions: {
    failedPayments: number;
    failedPaymentsAmount: number;
    pendingVerifications: number;
    expiringDocuments: number;
    blockedOrganizations: number;
  };
  recentActivity: AdminActivityItem[];
}

export interface AdminActivityItem {
  id: string;
  type: 'subscription' | 'verification' | 'payment' | 'organization';
  action: string;
  description: string;
  organizationId: string | null;
  organizationName: string | null;
  actorType: 'system' | 'admin' | 'user';
  actorName: string | null;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// ADMIN SEARCH TYPES
// ────────────────────────────────────────────────────────────────────────────────

export interface AdminSearchResult {
  organizations: AdminSearchOrganization[];
  users: AdminSearchUser[];
  payments: AdminSearchPayment[];
  verifications: AdminSearchVerification[];
}

export interface AdminSearchOrganization {
  id: string;
  name: string;
  cuit: string | null;
  ownerName: string;
  ownerEmail: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: 'not_started' | 'pending' | 'verified' | 'suspended';
  isBlocked: boolean;
}

export interface AdminSearchUser {
  id: string;
  name: string;
  email: string;
  cuil: string | null;
  organizationId: string;
  organizationName: string;
  role: string;
  verificationStatus: 'not_started' | 'pending' | 'verified' | 'blocked';
}

export interface AdminSearchPayment {
  id: string;
  mpPaymentId: string | null;
  organizationId: string;
  organizationName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface AdminSearchVerification {
  id: string;
  organizationId: string;
  organizationName: string;
  requirementName: string;
  status: VerificationSubmissionStatus;
  submittedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// DASHBOARD WIDGET TYPES
// ────────────────────────────────────────────────────────────────────────────────

export type DashboardWidgetType =
  | 'revenue_summary'
  | 'subscription_funnel'
  | 'verification_queue'
  | 'recent_activity'
  | 'pending_actions'
  | 'tier_distribution'
  | 'mrr_trend'
  | 'system_health';

export interface DashboardWidgetConfig {
  id: string;
  type: DashboardWidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
}

export interface AdminDashboardLayout {
  adminId: string;
  widgets: DashboardWidgetConfig[];
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// COMBINED ORGANIZATION DETAIL
// ────────────────────────────────────────────────────────────────────────────────

export interface CombinedOrganizationDetail {
  id: string;
  name: string;
  cuit: string | null;
  phone: string | null;
  address: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cuil: string | null;
  };
  subscription: {
    id: string | null;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    billingCycle: BillingCycle | null;
    priceUsd: number | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    gracePeriodEndsAt: string | null;
  };
  verification: {
    status: 'not_started' | 'pending' | 'verified' | 'suspended';
    tier2Progress: { completed: number; total: number };
    tier3Progress: { completed: number; total: number };
    badgesEarned: number;
    requirements: OrganizationRequirementStatus[];
  };
  block: {
    isBlocked: boolean;
    reason: string | null;
    blockedAt: string | null;
    blockedBy: string | null;
  };
  stats: {
    employeeCount: number;
    verifiedEmployeeCount: number;
    totalPayments: number;
    totalPaid: number;
    lastPaymentAt: string | null;
    jobCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CombinedActivityItem {
  id: string;
  source: 'subscription' | 'verification' | 'payment' | 'block';
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  actorType: 'system' | 'admin' | 'user';
  actorName: string | null;
  createdAt: string;
}
