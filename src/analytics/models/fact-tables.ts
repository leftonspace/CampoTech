/**
 * Fact Tables Service
 * ===================
 *
 * Phase 10.1: Analytics Data Infrastructure
 * Fact table management for analytics star schema.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import { getRedisConnection } from '../../lib/redis/client';
import {
  JobFact,
  InvoiceFact,
  PaymentFact,
  DateRange,
} from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FactQueryOptions {
  organizationId: string;
  dateRange: DateRange;
  filters?: {
    customerId?: string;
    technicianId?: string;
    serviceType?: string;
    status?: string;
  };
  limit?: number;
  offset?: number;
}

export interface FactSyncResult {
  factType: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  durationMs: number;
  errors?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const FACT_CACHE_PREFIX = 'analytics:fact:';
const FACT_CACHE_TTL = 300; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// JOB FACTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get job facts for analytics
 */
export async function getJobFacts(options: FactQueryOptions): Promise<JobFact[]> {
  const { organizationId, dateRange, filters, limit, offset } = options;

  // Build where clause
  const where: Record<string, unknown> = {
    organizationId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
  };

  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.technicianId) where.technicianId = filters.technicianId;
  if (filters?.serviceType) where.serviceType = filters.serviceType;
  if (filters?.status) where.status = filters.status;

  const jobs = await db.job.findMany({
    where,
    include: {
      customer: true,
      technician: true,
      invoice: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  // Get first job dates for customer analysis
  const customerFirstJobs = await getCustomerFirstJobDates(organizationId);

  return jobs.map((job) => {
    const firstJobDate = customerFirstJobs.get(job.customerId);
    const isFirstTimeCustomer = firstJobDate
      ? job.createdAt.getTime() === firstJobDate.getTime()
      : false;

    return {
      id: `job_${job.id}`,
      organizationId: job.organizationId,
      jobId: job.id,
      customerId: job.customerId,
      technicianId: job.technicianId,
      serviceType: job.serviceType,
      locationId: null,
      createdAt: job.createdAt,
      scheduledAt: job.scheduledDate,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      status: job.status,
      durationMinutes: job.actualDuration,
      travelTimeMinutes: null,
      estimatedAmount: job.invoice?.subtotal.toNumber() || 0,
      actualAmount: job.invoice?.total.toNumber() || 0,
      isFirstTimeCustomer,
      isRepeatJob: !isFirstTimeCustomer && firstJobDate !== undefined,
      satisfactionScore: null,
    };
  });
}

/**
 * Get job facts count
 */
export async function getJobFactsCount(options: Omit<FactQueryOptions, 'limit' | 'offset'>): Promise<number> {
  const { organizationId, dateRange, filters } = options;

  const where: Record<string, unknown> = {
    organizationId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
  };

  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.technicianId) where.technicianId = filters.technicianId;
  if (filters?.serviceType) where.serviceType = filters.serviceType;
  if (filters?.status) where.status = filters.status;

  return db.job.count({ where });
}

/**
 * Get job facts aggregated by period
 */
export async function getJobFactsByPeriod(
  organizationId: string,
  dateRange: DateRange,
  period: 'day' | 'week' | 'month'
): Promise<Map<string, JobFact[]>> {
  const facts = await getJobFacts({ organizationId, dateRange });

  const grouped = new Map<string, JobFact[]>();

  for (const fact of facts) {
    const key = formatPeriodKey(fact.createdAt, period);
    const group = grouped.get(key) || [];
    group.push(fact);
    grouped.set(key, group);
  }

  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE FACTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get invoice facts for analytics
 */
export async function getInvoiceFacts(options: FactQueryOptions): Promise<InvoiceFact[]> {
  const { organizationId, dateRange, filters, limit, offset } = options;

  const where: Record<string, unknown> = {
    organizationId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
  };

  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.status) where.status = filters.status;

  const invoices = await db.invoice.findMany({
    where,
    include: {
      payments: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return invoices.map((invoice) => {
    const firstPayment = invoice.payments[0];
    const paidAt = firstPayment?.paidAt || null;
    const daysToPayment = paidAt
      ? Math.ceil((paidAt.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: `inv_${invoice.id}`,
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      invoiceType: mapInvoiceType(invoice.type),
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate || new Date(),
      paidAt,
      subtotal: invoice.subtotal.toNumber(),
      taxAmount: invoice.taxAmount.toNumber(),
      total: invoice.total.toNumber(),
      status: invoice.status,
      daysToPayment,
      paymentMethod: firstPayment?.method || null,
    };
  });
}

/**
 * Get invoice facts count
 */
export async function getInvoiceFactsCount(options: Omit<FactQueryOptions, 'limit' | 'offset'>): Promise<number> {
  const { organizationId, dateRange, filters } = options;

  const where: Record<string, unknown> = {
    organizationId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
  };

  if (filters?.customerId) where.customerId = filters.customerId;
  if (filters?.status) where.status = filters.status;

  return db.invoice.count({ where });
}

/**
 * Get invoice facts aggregated by period
 */
export async function getInvoiceFactsByPeriod(
  organizationId: string,
  dateRange: DateRange,
  period: 'day' | 'week' | 'month'
): Promise<Map<string, InvoiceFact[]>> {
  const facts = await getInvoiceFacts({ organizationId, dateRange });

  const grouped = new Map<string, InvoiceFact[]>();

  for (const fact of facts) {
    const key = formatPeriodKey(fact.createdAt, period);
    const group = grouped.get(key) || [];
    group.push(fact);
    grouped.set(key, group);
  }

  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT FACTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get payment facts for analytics
 */
export async function getPaymentFacts(options: FactQueryOptions): Promise<PaymentFact[]> {
  const { organizationId, dateRange, filters, limit, offset } = options;

  const where: Record<string, unknown> = {
    organizationId,
    createdAt: {
      gte: dateRange.start,
      lte: dateRange.end,
    },
    status: 'COMPLETED',
  };

  const payments = await db.payment.findMany({
    where,
    include: {
      invoice: {
        select: {
          customerId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return payments.map((payment) => ({
    id: `pay_${payment.id}`,
    organizationId: payment.organizationId,
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    customerId: payment.invoice?.customerId || '',
    receivedAt: payment.paidAt || payment.createdAt,
    amount: payment.amount.toNumber(),
    method: payment.method,
    processingFee: 0, // Would need to calculate based on payment method
    netAmount: payment.amount.toNumber(),
  }));
}

/**
 * Get payment facts count
 */
export async function getPaymentFactsCount(options: Omit<FactQueryOptions, 'limit' | 'offset'>): Promise<number> {
  const { organizationId, dateRange } = options;

  return db.payment.count({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
      status: 'COMPLETED',
    },
  });
}

/**
 * Get payment facts aggregated by period
 */
export async function getPaymentFactsByPeriod(
  organizationId: string,
  dateRange: DateRange,
  period: 'day' | 'week' | 'month'
): Promise<Map<string, PaymentFact[]>> {
  const facts = await getPaymentFacts({ organizationId, dateRange });

  const grouped = new Map<string, PaymentFact[]>();

  for (const fact of facts) {
    const key = formatPeriodKey(fact.receivedAt, period);
    const group = grouped.get(key) || [];
    group.push(fact);
    grouped.set(key, group);
  }

  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATED QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get revenue summary from invoice facts
 */
export async function getRevenueSummary(
  organizationId: string,
  dateRange: DateRange
): Promise<{
  totalRevenue: number;
  collectedRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  invoiceCount: number;
  avgInvoiceValue: number;
}> {
  const facts = await getInvoiceFacts({ organizationId, dateRange });

  const totalRevenue = facts.reduce((sum, f) => sum + f.total, 0);
  const collectedRevenue = facts
    .filter((f) => f.status === 'PAID')
    .reduce((sum, f) => sum + f.total, 0);
  const pendingRevenue = facts
    .filter((f) => f.status === 'PENDING' || f.status === 'SENT')
    .reduce((sum, f) => sum + f.total, 0);
  const overdueRevenue = facts
    .filter((f) => f.status === 'OVERDUE')
    .reduce((sum, f) => sum + f.total, 0);

  return {
    totalRevenue,
    collectedRevenue,
    pendingRevenue,
    overdueRevenue,
    invoiceCount: facts.length,
    avgInvoiceValue: facts.length > 0 ? totalRevenue / facts.length : 0,
  };
}

/**
 * Get operations summary from job facts
 */
export async function getOperationsSummary(
  organizationId: string,
  dateRange: DateRange
): Promise<{
  totalJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  pendingJobs: number;
  completionRate: number;
  avgDuration: number;
  uniqueCustomers: number;
  activeTechnicians: number;
}> {
  const facts = await getJobFacts({ organizationId, dateRange });

  const totalJobs = facts.length;
  const completedJobs = facts.filter((f) => f.status === 'COMPLETED').length;
  const cancelledJobs = facts.filter((f) => f.status === 'CANCELLED').length;
  const pendingJobs = facts.filter((f) => f.status === 'PENDING' || f.status === 'ASSIGNED').length;

  const durations = facts
    .filter((f) => f.durationMinutes !== null)
    .map((f) => f.durationMinutes as number);
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const uniqueCustomers = new Set(facts.map((f) => f.customerId)).size;
  const activeTechnicians = new Set(facts.filter((f) => f.technicianId).map((f) => f.technicianId)).size;

  return {
    totalJobs,
    completedJobs,
    cancelledJobs,
    pendingJobs,
    completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
    avgDuration,
    uniqueCustomers,
    activeTechnicians,
  };
}

/**
 * Get collection summary from payment facts
 */
export async function getCollectionSummary(
  organizationId: string,
  dateRange: DateRange
): Promise<{
  totalCollected: number;
  paymentCount: number;
  avgPaymentAmount: number;
  byMethod: Record<string, { count: number; amount: number }>;
}> {
  const facts = await getPaymentFacts({ organizationId, dateRange });

  const totalCollected = facts.reduce((sum, f) => sum + f.amount, 0);
  const paymentCount = facts.length;
  const avgPaymentAmount = paymentCount > 0 ? totalCollected / paymentCount : 0;

  const byMethod: Record<string, { count: number; amount: number }> = {};
  for (const fact of facts) {
    if (!byMethod[fact.method]) {
      byMethod[fact.method] = { count: 0, amount: 0 };
    }
    byMethod[fact.method].count++;
    byMethod[fact.method].amount += fact.amount;
  }

  return {
    totalCollected,
    paymentCount,
    avgPaymentAmount,
    byMethod,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync all facts for an organization
 */
export async function syncAllFacts(
  organizationId: string,
  dateRange: DateRange
): Promise<FactSyncResult[]> {
  const results: FactSyncResult[] = [];

  // Sync job facts
  const jobStart = Date.now();
  try {
    const jobFacts = await getJobFacts({ organizationId, dateRange });
    await cacheFacts('job', organizationId, jobFacts);
    results.push({
      factType: 'job',
      recordsProcessed: jobFacts.length,
      recordsCreated: jobFacts.length,
      recordsUpdated: 0,
      durationMs: Date.now() - jobStart,
    });
  } catch (error) {
    results.push({
      factType: 'job',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      durationMs: Date.now() - jobStart,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  // Sync invoice facts
  const invoiceStart = Date.now();
  try {
    const invoiceFacts = await getInvoiceFacts({ organizationId, dateRange });
    await cacheFacts('invoice', organizationId, invoiceFacts);
    results.push({
      factType: 'invoice',
      recordsProcessed: invoiceFacts.length,
      recordsCreated: invoiceFacts.length,
      recordsUpdated: 0,
      durationMs: Date.now() - invoiceStart,
    });
  } catch (error) {
    results.push({
      factType: 'invoice',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      durationMs: Date.now() - invoiceStart,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  // Sync payment facts
  const paymentStart = Date.now();
  try {
    const paymentFacts = await getPaymentFacts({ organizationId, dateRange });
    await cacheFacts('payment', organizationId, paymentFacts);
    results.push({
      factType: 'payment',
      recordsProcessed: paymentFacts.length,
      recordsCreated: paymentFacts.length,
      recordsUpdated: 0,
      durationMs: Date.now() - paymentStart,
    });
  } catch (error) {
    results.push({
      factType: 'payment',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      durationMs: Date.now() - paymentStart,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function cacheFacts<T>(
  factType: string,
  organizationId: string,
  facts: T[]
): Promise<void> {
  try {
    const redis = await getRedisConnection();
    const key = `${FACT_CACHE_PREFIX}${factType}:${organizationId}:count`;
    await redis.setex(key, FACT_CACHE_TTL, facts.length.toString());
  } catch (error) {
    log.warn('Failed to cache facts', {
      factType,
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getCustomerFirstJobDates(
  organizationId: string
): Promise<Map<string, Date>> {
  const firstJobs = await db.job.groupBy({
    by: ['customerId'],
    where: { organizationId },
    _min: { createdAt: true },
  });

  const map = new Map<string, Date>();
  for (const fj of firstJobs) {
    if (fj._min.createdAt) {
      map.set(fj.customerId, fj._min.createdAt);
    }
  }

  return map;
}

function mapInvoiceType(type: string): 'A' | 'B' | 'C' | 'E' {
  switch (type) {
    case 'FACTURA_A': return 'A';
    case 'FACTURA_B': return 'B';
    case 'FACTURA_C': return 'C';
    default: return 'C';
  }
}

function formatPeriodKey(date: Date, period: 'day' | 'week' | 'month'): string {
  switch (period) {
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.toISOString().slice(0, 10)}_W`;
    case 'month':
      return date.toISOString().slice(0, 7);
  }
}
