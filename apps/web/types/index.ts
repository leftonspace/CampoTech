/**
 * Web Portal Types
 * =================
 *
 * Type definitions for the CampoTech web portal
 */

// ═══════════════════════════════════════════════════════════════════════════════
// USER & AUTH
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'accountant';
export type SubscriptionTier = 'FREE' | 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';

export interface UserOrganization {
  id: string;
  name: string;
  subscriptionTier: SubscriptionTier;
}

export interface User {
  id: string;
  orgId: string;
  email?: string;
  phone: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  organization?: UserOrganization;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface Organization {
  id: string;
  cuit: string;
  name: string;
  tradeName?: string;
  address?: string;
  phone?: string;
  email?: string;
  afipConfigured: boolean;
  mpConfigured: boolean;
  whatsappConfigured: boolean;
  settings: OrganizationSettings;
  createdAt: string;
}

export interface OrganizationSettings {
  defaultInvoiceType: 'A' | 'B' | 'C';
  autoInvoice: boolean;
  defaultPaymentTerms: number;
  timezone: string;
  currency: 'ARS';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════════

export type IVACondition =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'consumidor_final'
  | 'exento';

export interface Customer {
  id: string;
  orgId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB
// ═══════════════════════════════════════════════════════════════════════════════

export type JobStatus =
  | 'pending'
  | 'scheduled'
  | 'en_camino'
  | 'working'
  | 'completed'
  | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface JobAssignment {
  id: string;
  jobId: string;
  technicianId: string;
  technician: Pick<User, 'id' | 'name'>;
  assignedAt: string;
  notes?: string;
}

export interface Job {
  id: string;
  orgId: string;
  customerId: string;
  customer?: Customer;
  assignedToId?: string;
  assignedTo?: User;
  // Multiple technician assignments
  assignments?: JobAssignment[];
  status: JobStatus;
  priority: JobPriority;
  title: string;
  description?: string;
  address: string;
  scheduledDate?: string;
  scheduledTimeStart?: string;
  scheduledTimeEnd?: string;
  completedAt?: string;
  completionNotes?: string;
  photos?: string[];
  signatureUrl?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════════════════════════

export type InvoiceType = 'A' | 'B' | 'C';

export type InvoiceStatus =
  | 'draft'
  | 'pending_cae'
  | 'issued'
  | 'sent'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'cancelled'
  | 'rejected';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  customerId: string;
  customer?: Customer;
  jobId?: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  number?: number;
  puntoVenta?: number;
  cae?: string;
  caeExpiry?: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalIva: number;
  total: number;
  notes?: string;
  pdfUrl?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'credit_card'
  | 'debit_card'
  | 'mercadopago';

export interface Payment {
  id: string;
  orgId: string;
  invoiceId: string;
  invoice?: Invoice;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  mpPaymentId?: string;
  installments: number;
  paidAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardStats {
  todayJobs: number;
  pendingJobs: number;
  completedToday: number;
  pendingInvoices: number;
  unpaidAmount: number;
  monthlyRevenue: number;
}

export interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  afip: 'healthy' | 'degraded' | 'down';
  mercadopago: 'healthy' | 'degraded' | 'down';
  whatsapp: 'healthy' | 'degraded' | 'down';
  queues: 'healthy' | 'degraded' | 'down';
}

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
