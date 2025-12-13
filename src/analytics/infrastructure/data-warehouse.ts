/**
 * Data Warehouse Service
 * ======================
 *
 * Phase 10: Advanced Analytics & Reporting
 * Star schema implementation for analytics data warehouse.
 */

import { db } from '../../lib/db';
import { log } from '../../lib/logging/logger';
import {
  JobFact,
  InvoiceFact,
  PaymentFact,
  CustomerDimension,
  TechnicianDimension,
  ServiceDimension,
  DateRange,
} from '../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// FACT TABLE QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get job facts for analytics
 */
export async function getJobFacts(
  organizationId: string,
  dateRange: DateRange
): Promise<JobFact[]> {
  const jobs = await db.job.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: true,
      technician: true,
      invoice: true,
    },
  });

  return jobs.map((job) => ({
    id: `job_${job.id}`,
    organizationId: job.organizationId,
    jobId: job.id,
    customerId: job.customerId,
    technicianId: job.technicianId,
    serviceType: job.serviceType || 'other',
    locationId: job.locationId,
    createdAt: job.createdAt,
    scheduledAt: job.scheduledDate,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    status: job.status,
    durationMinutes: job.actualDuration || calculateDuration(job.startedAt, job.completedAt),
    travelTimeMinutes: null, // Could be calculated from tracking data
    estimatedAmount: job.invoice?.subtotal?.toNumber() || 0,
    actualAmount: job.invoice?.total?.toNumber() || 0,
    isFirstTimeCustomer: false, // Will be enriched
    isRepeatJob: false, // Will be enriched
    satisfactionScore: null, // Will be added with feedback feature
  }));
}

/**
 * Get invoice facts for analytics
 */
export async function getInvoiceFacts(
  organizationId: string,
  dateRange: DateRange
): Promise<InvoiceFact[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      payments: true,
    },
  });

  return invoices.map((invoice) => {
    const paidAt = invoice.payments.length > 0
      ? invoice.payments[0].createdAt
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
      subtotal: invoice.subtotal?.toNumber() || 0,
      taxAmount: invoice.taxAmount?.toNumber() || 0,
      total: invoice.total?.toNumber() || 0,
      status: invoice.status,
      daysToPayment: paidAt
        ? Math.ceil((paidAt.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      paymentMethod: invoice.payments.length > 0 ? invoice.payments[0].method : null,
    };
  });
}

/**
 * Get payment facts for analytics
 */
export async function getPaymentFacts(
  organizationId: string,
  dateRange: DateRange
): Promise<PaymentFact[]> {
  const payments = await db.payment.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      invoice: true,
    },
  });

  return payments.map((payment) => {
    const amount = payment.amount?.toNumber() || 0;
    return {
      id: `pay_${payment.id}`,
      organizationId: payment.organizationId,
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      customerId: payment.invoice?.customerId || '',
      receivedAt: payment.paidAt || payment.createdAt,
      amount,
      method: payment.method || 'other',
      processingFee: 0, // Not tracked in current schema
      netAmount: amount,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIMENSION TABLE QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get customer dimension data
 */
export async function getCustomerDimension(
  organizationId: string
): Promise<CustomerDimension[]> {
  const customers = await db.customer.findMany({
    where: { organizationId },
    include: {
      jobs: {
        select: {
          id: true,
          completedAt: true,
          invoice: {
            select: {
              total: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  return customers.map((customer) => {
    const totalJobs = customer.jobs.length;
    const totalRevenue = customer.jobs.reduce(
      (sum, job) => sum + (job.invoice?.total?.toNumber() || 0),
      0
    );
    const lastJobAt = customer.jobs
      .filter((j) => j.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0]
      ?.completedAt || null;

    // Determine segment
    let segment: CustomerDimension['segment'] = 'new';
    if (totalJobs === 0) {
      segment = 'new';
    } else if (!lastJobAt || lastJobAt < ninetyDaysAgo) {
      segment = 'churned';
    } else if (lastJobAt < thirtyDaysAgo) {
      segment = 'at_risk';
    } else if (totalJobs >= 5) {
      segment = 'loyal';
    } else {
      segment = 'active';
    }

    // Extract city from address JSON field
    const address = customer.address as { city?: string; province?: string } | null;

    return {
      customerId: customer.id,
      organizationId: customer.organizationId,
      name: customer.name,
      taxCondition: 'consumidor_final', // Not stored on customer in current schema
      city: address?.city || null,
      province: address?.province || null,
      customerSince: customer.createdAt,
      totalJobs,
      totalRevenue,
      averageJobValue: totalJobs > 0 ? totalRevenue / totalJobs : 0,
      lastJobAt,
      segment,
    };
  });
}

/**
 * Get technician dimension data
 */
export async function getTechnicianDimension(
  organizationId: string
): Promise<TechnicianDimension[]> {
  const technicians = await db.user.findMany({
    where: {
      organizationId,
      role: { in: ['TECHNICIAN', 'ADMIN', 'OWNER'] },
    },
    include: {
      assignedJobs: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });

  return technicians.map((tech) => {
    const totalJobs = tech.assignedJobs.length;
    const completedJobs = tech.assignedJobs.filter((j) => j.status === 'COMPLETED').length;

    // Calculate efficiency (jobs per working day in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentJobs = tech.assignedJobs.filter(
      (j) => j.completedAt && j.completedAt >= thirtyDaysAgo
    );
    const efficiency = recentJobs.length / 22; // Assuming 22 working days per month

    return {
      technicianId: tech.id,
      organizationId: tech.organizationId,
      name: tech.name,
      role: tech.role,
      specialty: tech.specialty,
      skillLevel: tech.skillLevel,
      hiredAt: tech.createdAt,
      totalJobs,
      completedJobs,
      averageRating: null, // Will be added with feedback feature
      efficiency,
    };
  });
}

/**
 * Get service dimension data
 */
export async function getServiceDimension(
  organizationId: string
): Promise<ServiceDimension[]> {
  const jobs = await db.job.findMany({
    where: { organizationId },
    select: {
      serviceType: true,
      startedAt: true,
      completedAt: true,
      actualDuration: true,
      invoice: {
        select: {
          total: true,
        },
      },
    },
  });

  // Group by service type
  const serviceMap = new Map<string, {
    count: number;
    totalRevenue: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const job of jobs) {
    const serviceType = job.serviceType || 'other';
    const current = serviceMap.get(serviceType) || {
      count: 0,
      totalRevenue: 0,
      totalDuration: 0,
      durationCount: 0,
    };

    current.count++;
    current.totalRevenue += job.invoice?.total?.toNumber() || 0;

    const duration = job.actualDuration || calculateDuration(job.startedAt, job.completedAt);
    if (duration) {
      current.totalDuration += duration;
      current.durationCount++;
    }

    serviceMap.set(serviceType, current);
  }

  // Convert to array and sort by popularity
  const services = Array.from(serviceMap.entries())
    .map(([serviceType, data]) => ({
      serviceType,
      organizationId,
      displayName: formatServiceType(serviceType),
      category: getServiceCategory(serviceType),
      averagePrice: data.count > 0 ? data.totalRevenue / data.count : 0,
      averageDuration: data.durationCount > 0 ? data.totalDuration / data.durationCount : 0,
      popularityRank: 0,
    }))
    .sort((a, b) => b.averagePrice - a.averagePrice);

  // Assign popularity ranks
  services.forEach((s, i) => {
    s.popularityRank = i + 1;
  });

  return services;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get aggregated revenue by period
 */
export async function getAggregatedRevenue(
  organizationId: string,
  dateRange: DateRange,
  granularity: 'day' | 'week' | 'month'
): Promise<{ period: string; revenue: number; count: number }[]> {
  const invoices = await getInvoiceFacts(organizationId, dateRange);

  const aggregated = new Map<string, { revenue: number; count: number }>();

  for (const invoice of invoices) {
    const period = formatPeriod(invoice.createdAt, granularity);
    const current = aggregated.get(period) || { revenue: 0, count: 0 };
    current.revenue += invoice.total;
    current.count++;
    aggregated.set(period, current);
  }

  return Array.from(aggregated.entries())
    .map(([period, data]) => ({ period, ...data }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get aggregated jobs by period
 */
export async function getAggregatedJobs(
  organizationId: string,
  dateRange: DateRange,
  granularity: 'day' | 'week' | 'month'
): Promise<{ period: string; completed: number; total: number }[]> {
  const jobs = await getJobFacts(organizationId, dateRange);

  const aggregated = new Map<string, { completed: number; total: number }>();

  for (const job of jobs) {
    const period = formatPeriod(job.createdAt, granularity);
    const current = aggregated.get(period) || { completed: 0, total: 0 };
    current.total++;
    if (job.status === 'completado') {
      current.completed++;
    }
    aggregated.set(period, current);
  }

  return Array.from(aggregated.entries())
    .map(([period, data]) => ({ period, ...data }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateDuration(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

function formatPeriod(date: Date, granularity: 'day' | 'week' | 'month'): string {
  switch (granularity) {
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().slice(0, 10);
    case 'month':
      return date.toISOString().slice(0, 7);
  }
}

function formatServiceType(type: string): string {
  const names: Record<string, string> = {
    installation: 'Instalación',
    repair: 'Reparación',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    emergency: 'Emergencia',
    other: 'Otro',
  };
  return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getServiceCategory(type: string): string {
  const categories: Record<string, string> = {
    installation: 'Instalaciones',
    repair: 'Reparaciones',
    maintenance: 'Mantenimiento',
    inspection: 'Inspecciones',
    emergency: 'Urgencias',
  };
  return categories[type] || 'General';
}

function mapInvoiceType(type: string): 'A' | 'B' | 'C' | 'E' {
  switch (type) {
    case 'FACTURA_A': return 'A';
    case 'FACTURA_B': return 'B';
    case 'FACTURA_C': return 'C';
    case 'FACTURA_E': return 'E';
    default: return 'C';
  }
}
