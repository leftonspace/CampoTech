/**
 * Public API Types
 * =================
 *
 * Type definitions for the public API (third-party integrations).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiKey {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for identification
  scopes: string[];
  rateLimit: number; // Requests per minute
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string; // Only returned once at creation
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  expiresAt?: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OAuthClient {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  clientId: string;
  clientSecretHash: string;
  redirectUris: string[];
  grantTypes: OAuthGrantType[];
  scopes: string[];
  logoUrl?: string;
  homepageUrl?: string;
  privacyPolicyUrl?: string;
  isConfidential: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OAuthGrantType =
  | 'authorization_code'
  | 'client_credentials'
  | 'refresh_token';

export interface OAuthToken {
  id: string;
  clientId: string;
  orgId: string;
  userId?: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface OAuthAuthorizationCode {
  code: string;
  clientId: string;
  userId: string;
  orgId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCOPES
// ═══════════════════════════════════════════════════════════════════════════════

export const API_SCOPES = {
  // Customer scopes
  'read:customers': 'Read customer information',
  'write:customers': 'Create and update customers',
  'delete:customers': 'Delete customers',

  // Job scopes
  'read:jobs': 'Read job information',
  'write:jobs': 'Create and update jobs',
  'delete:jobs': 'Delete/cancel jobs',

  // Invoice scopes
  'read:invoices': 'Read invoices',
  'write:invoices': 'Create and update invoices',
  'delete:invoices': 'Void invoices',

  // Payment scopes
  'read:payments': 'Read payment information',
  'write:payments': 'Record payments',

  // Technician scopes
  'read:technicians': 'Read technician information',
  'write:technicians': 'Manage technicians',

  // Service scopes
  'read:services': 'Read service types',
  'write:services': 'Manage service types',

  // Inventory scopes
  'read:inventory': 'Read inventory',
  'write:inventory': 'Manage inventory',

  // Webhook scopes
  'read:webhooks': 'Read webhook configurations',
  'write:webhooks': 'Manage webhooks',

  // Organization scopes
  'read:org': 'Read organization settings',
  'write:org': 'Update organization settings',
} as const;

export type ApiScope = keyof typeof API_SCOPES;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    has_more: boolean;
    next_cursor?: string;
    prev_cursor?: string;
    total_count?: number;
  };
}

export interface PaginationMeta {
  cursor: string;
  limit: number;
  has_more: boolean;
  next_cursor?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    pagination?: PaginationMeta;
    requestId?: string;
    timestamp?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  meta: {
    pagination: PaginationMeta;
    requestId: string;
    timestamp: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiRequestContext {
  requestId: string;
  orgId: string;
  authenticationType: 'api_key' | 'oauth';
  apiKeyId?: string;
  oauthClientId?: string;
  userId?: string;
  scopes: string[];
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  description?: string;
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookEventType =
  // Customer events
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  // Job events
  | 'job.created'
  | 'job.updated'
  | 'job.assigned'
  | 'job.started'
  | 'job.completed'
  | 'job.cancelled'
  // Invoice events
  | 'invoice.created'
  | 'invoice.issued'
  | 'invoice.paid'
  | 'invoice.voided'
  | 'invoice.overdue'
  // Payment events
  | 'payment.received'
  | 'payment.refunded'
  | 'payment.failed'
  // Technician events
  | 'technician.assigned'
  | 'technician.location_updated'
  // Inventory events
  | 'inventory.low_stock'
  | 'inventory.updated';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  orgId: string;
  data: Record<string, any>;
  createdAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: WebhookEventType;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
  attempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API USAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiUsageRecord {
  id: string;
  orgId: string;
  apiKeyId?: string;
  oauthClientId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  requestSize: number;
  responseSize: number;
  ipAddress: string;
  userAgent?: string;
  errorCode?: string;
  createdAt: Date;
}

export interface ApiUsageSummary {
  period: 'hour' | 'day' | 'week' | 'month';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorBreakdown: Array<{ code: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCE TYPES (API representations)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiJob {
  id: string;
  jobNumber: string;
  customerId: string;
  status: string;
  priority: string;
  serviceType: string;
  description?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  };
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  assignedTechnicianId?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId?: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPayment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference?: string;
  processedAt?: string;
  notes?: string;
  createdAt: string;
}
