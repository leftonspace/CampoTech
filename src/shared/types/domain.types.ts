/**
 * Domain Types
 * ============
 *
 * Core domain type definitions used across all modules.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS (match database enums from migrations)
// ═══════════════════════════════════════════════════════════════════════════════

export type JobStatus =
  | 'pending'
  | 'scheduled'
  | 'en_camino'
  | 'working'
  | 'completed'
  | 'cancelled';

export type InvoiceStatus =
  | 'draft'
  | 'pending_cae'
  | 'cae_failed'
  | 'issued'
  | 'sent'
  | 'paid'
  | 'voided';

export type InvoiceType = 'A' | 'B' | 'C' | 'E';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partial_refund';

export type PaymentMethod =
  | 'mercadopago'
  | 'cash'
  | 'transfer'
  | 'check'
  | 'card_present';

export type IVACondition =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'exento'
  | 'consumidor_final';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'dispatcher'
  | 'technician'
  | 'accountant';

export type WhatsAppMessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type MessageDirection = 'inbound' | 'outbound';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'payment'
  | 'invoice'
  | 'login'
  | 'export';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgScopedEntity extends BaseEntity {
  orgId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface Organization extends BaseEntity {
  name: string;
  cuit: string;
  ivaCondition: IVACondition;
  legalName?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  logo?: string;
  settings: OrganizationSettings;
  afipConfigured: boolean;
  mercadopagoConfigured: boolean;
  whatsappConfigured: boolean;
  isActive: boolean;
}

export interface OrganizationSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  defaultPuntoVenta: number;
  autoInvoice: boolean;
  sendInvoiceByWhatsapp: boolean;
  requireSignature: boolean;
  requirePhotos: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════════════════════════════════════

export interface User extends OrgScopedEntity {
  phone: string;
  fullName: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  settings?: UserSettings;
}

export interface UserSettings {
  notifications: boolean;
  language: string;
  simpleMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

export interface Customer extends OrgScopedEntity {
  fullName: string;
  phone: string;
  email?: string;
  cuit?: string;
  ivaCondition: IVACondition;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB
// ═══════════════════════════════════════════════════════════════════════════════

export interface Job extends OrgScopedEntity {
  customerId: string;
  assignedTo?: string;
  scheduledAt?: Date;
  status: JobStatus;
  description: string;
  address: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  photos: string[];
  signature?: string;
  completionNotes?: string;
  lineItems: JobLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface JobLineItem {
  id: string;
  priceBookItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

export interface Invoice extends OrgScopedEntity {
  jobId?: string;
  customerId: string;
  invoiceNumber?: number;
  invoiceType: InvoiceType;
  puntoVenta: number;
  status: InvoiceStatus;
  issuedAt?: Date;
  dueDate?: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  cae?: string;
  caeExpiry?: Date;
  afipResponse?: Record<string, any>;
  qrCode?: string;
  pdfUrl?: string;
  sentAt?: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
}

export interface InvoiceLineItem {
  id: string;
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface Payment extends OrgScopedEntity {
  invoiceId: string;
  externalId?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  receivedAt?: Date;
  processedAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
  refundReason?: string;
  disputedAt?: Date;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE BOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface PriceBookItem extends OrgScopedEntity {
  name: string;
  description?: string;
  category: string;
  productCode: string;
  unitPrice: number;
  taxRate: number;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditLog {
  id: string;
  orgId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  previousHash: string;
  hash: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhatsAppMessage extends OrgScopedEntity {
  customerId?: string;
  waMessageId: string;
  direction: MessageDirection;
  phone: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  templateName?: string;
  status: WhatsAppMessageStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION & QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DateRange {
  /** Start date (alias: from) */
  start?: Date;
  /** End date (alias: to) */
  end?: Date;
  /** @deprecated Use start instead */
  from?: Date;
  /** @deprecated Use end instead */
  to?: Date;
}
