/**
 * Consolidated Billing
 * ====================
 *
 * Generates consolidated invoices and billing reports across multiple locations.
 * Supports:
 * - Multi-location invoice summaries
 * - Consolidated billing for customers with services at multiple locations
 * - Cross-location billing reports
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PuntoVentaManager, InvoiceType } from './punto-venta-manager';
import { CondicionIva } from '../location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConsolidatedInvoiceItem {
  jobId: string;
  jobNumber: string;
  serviceDate: Date;
  serviceType: string;
  description: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxAmount: number;
}

export interface ConsolidatedInvoiceInput {
  customerId: string;
  items: ConsolidatedInvoiceItem[];
  dueDate?: Date;
  notes?: string;
  preferredLocationId?: string; // Location to issue from
}

export interface ConsolidatedInvoiceSummary {
  customerId: string;
  customerName: string;
  issuingLocationId: string;
  issuingLocationName: string;
  puntoDeVenta: number;
  invoiceType: InvoiceType;
  itemCount: number;
  locationBreakdown: {
    locationId: string;
    locationCode: string;
    locationName: string;
    itemCount: number;
    subtotal: number;
  }[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface LocationBillingSummary {
  locationId: string;
  locationCode: string;
  locationName: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  invoiceCount: number;
  invoicesByType: {
    facturaA: number;
    facturaB: number;
    facturaC: number;
  };
  subtotal: number;
  taxAmount: number;
  total: number;
  topCustomers: {
    customerId: string;
    customerName: string;
    total: number;
    invoiceCount: number;
  }[];
}

export interface OrganizationBillingReport {
  organizationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalRevenue: number;
  totalTax: number;
  totalInvoices: number;
  locationBreakdown: LocationBillingSummary[];
  comparison: {
    previousPeriodTotal: number;
    changePercent: number;
  } | null;
}

export interface PendingBillingItem {
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  serviceDate: Date;
  serviceType: string;
  locationId: string | null;
  locationName: string | null;
  estimatedTotal: number;
  status: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsolidatedBillingError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ConsolidatedBillingError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSOLIDATED BILLING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsolidatedBillingService {
  private prisma: PrismaClient;
  private puntoVentaManager: PuntoVentaManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.puntoVentaManager = new PuntoVentaManager(prisma);
  }

  /**
   * Preview a consolidated invoice before creation
   */
  async previewConsolidatedInvoice(
    organizationId: string,
    input: ConsolidatedInvoiceInput
  ): Promise<ConsolidatedInvoiceSummary> {
    // Get customer
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: input.customerId,
        organizationId,
      },
    });

    if (!customer) {
      throw new ConsolidatedBillingError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    // Determine issuing location
    const issuingLocationId = await this.determineIssuingLocation(
      organizationId,
      input
    );

    const locationConfig = await this.puntoVentaManager.getPuntoVentaConfig(
      organizationId,
      issuingLocationId
    );

    if (!locationConfig) {
      throw new ConsolidatedBillingError(
        'NO_AFIP_CONFIG',
        'No AFIP configuration for issuing location',
        404
      );
    }

    // Get customer's tax condition (default to consumidor final)
    const customerCondicionIva = 'CONSUMIDOR_FINAL'; // Would come from customer record

    const invoiceType = this.puntoVentaManager.determineInvoiceType(
      locationConfig.condicionIva,
      customerCondicionIva
    );

    // Calculate totals per location
    const locationBreakdown = this.calculateLocationBreakdown(input.items);

    // Calculate totals
    type ItemType = typeof input.items[number];
    const subtotal = input.items.reduce((sum: number, item: ItemType) => sum + item.total, 0);
    const taxAmount = input.items.reduce((sum: number, item: ItemType) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    return {
      customerId: customer.id,
      customerName: customer.name,
      issuingLocationId,
      issuingLocationName: locationConfig.locationName,
      puntoDeVenta: locationConfig.puntoDeVenta,
      invoiceType,
      itemCount: input.items.length,
      locationBreakdown,
      subtotal,
      taxAmount,
      total,
    };
  }

  /**
   * Determine the best location to issue the consolidated invoice from
   */
  private async determineIssuingLocation(
    organizationId: string,
    input: ConsolidatedInvoiceInput
  ): Promise<string> {
    // 1. Use preferred location if specified
    if (input.preferredLocationId) {
      const config = await this.puntoVentaManager.getPuntoVentaConfig(
        organizationId,
        input.preferredLocationId
      );
      if (config?.isActive) {
        return input.preferredLocationId;
      }
    }

    // 2. Use location with most items
    const locationCounts = new Map<string, number>();
    for (const item of input.items) {
      const count = locationCounts.get(item.locationId) || 0;
      locationCounts.set(item.locationId, count + 1);
    }

    const sortedLocations = (Array.from(locationCounts.entries()) as [string, number][])
      .sort((a, b) => b[1] - a[1]);

    for (const [locationId] of sortedLocations) {
      const config = await this.puntoVentaManager.getPuntoVentaConfig(
        organizationId,
        locationId
      );
      if (config?.isActive) {
        return locationId;
      }
    }

    // 3. Fall back to headquarters
    const headquarters = await this.prisma.location.findFirst({
      where: {
        organizationId,
        isHeadquarters: true,
        isActive: true,
        afipConfig: {
          isActive: true,
        },
      },
    });

    if (headquarters) {
      return headquarters.id;
    }

    // 4. Any active location
    const anyLocation = await this.prisma.location.findFirst({
      where: {
        organizationId,
        isActive: true,
        afipConfig: {
          isActive: true,
        },
      },
    });

    if (!anyLocation) {
      throw new ConsolidatedBillingError(
        'NO_ISSUING_LOCATION',
        'No location available to issue invoice'
      );
    }

    return anyLocation.id;
  }

  /**
   * Calculate breakdown by location
   */
  private calculateLocationBreakdown(
    items: ConsolidatedInvoiceItem[]
  ): ConsolidatedInvoiceSummary['locationBreakdown'] {
    const breakdown = new Map<string, {
      locationCode: string;
      locationName: string;
      itemCount: number;
      subtotal: number;
    }>();

    for (const item of items) {
      const existing = breakdown.get(item.locationId) || {
        locationCode: item.locationCode,
        locationName: item.locationName,
        itemCount: 0,
        subtotal: 0,
      };

      existing.itemCount += 1;
      existing.subtotal += item.total;

      breakdown.set(item.locationId, existing);
    }

    type BreakdownData = { locationCode: string; locationName: string; itemCount: number; subtotal: number };
    return (Array.from(breakdown.entries()) as [string, BreakdownData][]).map(([locationId, data]) => ({
      locationId,
      ...data,
    }));
  }

  /**
   * Get billing summary for a specific location
   */
  async getLocationBillingSummary(
    organizationId: string,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LocationBillingSummary> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new ConsolidatedBillingError('LOCATION_NOT_FOUND', 'Location not found', 404);
    }

    // Get invoices for this location in the period
    const invoices = await this.prisma.invoice.findMany({
      where: {
        locationId,
        organizationId,
        issuedAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['DRAFT', 'CANCELLED'],
        },
      },
      include: {
        customer: true,
      },
    });

    // Calculate totals
    const invoicesByType = {
      facturaA: 0,
      facturaB: 0,
      facturaC: 0,
    };

    let subtotal = 0;
    let taxAmount = 0;
    let total = 0;

    const customerTotals = new Map<string, { name: string; total: number; count: number }>();

    for (const invoice of invoices) {
      // Count by type
      switch (invoice.type) {
        case 'FACTURA_A':
          invoicesByType.facturaA++;
          break;
        case 'FACTURA_B':
          invoicesByType.facturaB++;
          break;
        case 'FACTURA_C':
          invoicesByType.facturaC++;
          break;
      }

      // Sum amounts
      subtotal += Number(invoice.subtotal);
      taxAmount += Number(invoice.taxAmount);
      total += Number(invoice.total);

      // Track customer totals
      const customerData = customerTotals.get(invoice.customerId) || {
        name: invoice.customer.name,
        total: 0,
        count: 0,
      };
      customerData.total += Number(invoice.total);
      customerData.count += 1;
      customerTotals.set(invoice.customerId, customerData);
    }

    // Get top customers
    type CustomerData = { name: string; total: number; count: number };
    const topCustomers = (Array.from(customerTotals.entries()) as [string, CustomerData][])
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        total: data.total,
        invoiceCount: data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      locationId,
      locationCode: location.code,
      locationName: location.name,
      period: { startDate, endDate },
      invoiceCount: invoices.length,
      invoicesByType,
      subtotal,
      taxAmount,
      total,
      topCustomers,
    };
  }

  /**
   * Get organization-wide billing report
   */
  async getOrganizationBillingReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    includePreviousPeriod: boolean = true
  ): Promise<OrganizationBillingReport> {
    // Get all locations
    const locations = await this.prisma.location.findMany({
      where: {
        organizationId,
        isActive: true,
      },
    });

    // Get summaries for each location
    const locationBreakdown: LocationBillingSummary[] = [];

    for (const location of locations) {
      try {
        const summary = await this.getLocationBillingSummary(
          organizationId,
          location.id,
          startDate,
          endDate
        );
        locationBreakdown.push(summary);
      } catch {
        // Location may not have any invoices
      }
    }

    // Calculate totals
    type BreakdownType = typeof locationBreakdown[number];
    const totalRevenue = locationBreakdown.reduce((sum: number, loc: BreakdownType) => sum + loc.subtotal, 0);
    const totalTax = locationBreakdown.reduce((sum: number, loc: BreakdownType) => sum + loc.taxAmount, 0);
    const totalInvoices = locationBreakdown.reduce((sum: number, loc: BreakdownType) => sum + loc.invoiceCount, 0);

    // Calculate comparison with previous period
    let comparison: OrganizationBillingReport['comparison'] = null;

    if (includePreviousPeriod) {
      const periodDuration = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodDuration);
      const previousEndDate = new Date(startDate.getTime() - 1);

      const previousInvoices = await this.prisma.invoice.aggregate({
        where: {
          organizationId,
          issuedAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
          status: {
            notIn: ['DRAFT', 'CANCELLED'],
          },
        },
        _sum: {
          subtotal: true,
        },
      });

      const previousPeriodTotal = Number(previousInvoices._sum.subtotal) || 0;
      const changePercent = previousPeriodTotal > 0
        ? ((totalRevenue - previousPeriodTotal) / previousPeriodTotal) * 100
        : 0;

      comparison = {
        previousPeriodTotal,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    }

    return {
      organizationId,
      period: { startDate, endDate },
      totalRevenue,
      totalTax,
      totalInvoices,
      locationBreakdown,
      comparison,
    };
  }

  /**
   * Get pending billing items (completed jobs without invoices)
   */
  async getPendingBillingItems(
    organizationId: string,
    locationId?: string
  ): Promise<PendingBillingItem[]> {
    const where: Prisma.JobWhereInput = {
      organizationId,
      status: 'COMPLETED',
      invoice: null,
      ...(locationId && { locationId }),
    };

    const jobs = await this.prisma.job.findMany({
      where,
      include: {
        customer: true,
        location: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: 100,
    });

    return jobs.map((job: typeof jobs[number]) => ({
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerId: job.customerId,
      customerName: job.customer.name,
      serviceDate: job.completedAt || job.scheduledDate || job.createdAt,
      serviceType: job.serviceType,
      locationId: job.locationId,
      locationName: job.location?.name || null,
      estimatedTotal: this.estimateJobTotal(job),
      status: job.status,
    }));
  }

  /**
   * Estimate job total for pending billing
   */
  private estimateJobTotal(job: any): number {
    // Basic estimation - would be enhanced with actual pricing logic
    const materialsTotal = job.materialsUsed
      ? (job.materialsUsed as any[]).reduce(
          (sum: number, m: any) => sum + (m.quantity || 1) * (m.unitPrice || 0),
          0
        )
      : 0;

    // Add base labor cost estimate
    const laborHours = (job.actualDuration || job.estimatedDuration || 60) / 60;
    const laborRate = 1500; // Base rate per hour in ARS
    const laborTotal = laborHours * laborRate;

    return materialsTotal + laborTotal;
  }

  /**
   * Get customer's billing history across all locations
   */
  async getCustomerBillingHistory(
    organizationId: string,
    customerId: string,
    limit: number = 20
  ): Promise<{
    customer: { id: string; name: string };
    invoices: {
      id: string;
      invoiceNumber: string;
      type: string;
      issuedAt: Date | null;
      locationName: string | null;
      subtotal: number;
      total: number;
      status: string;
    }[];
    totals: {
      invoiceCount: number;
      totalBilled: number;
      byLocation: { locationId: string; locationName: string; total: number }[];
    };
  }> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
    });

    if (!customer) {
      throw new ConsolidatedBillingError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        organizationId,
      },
      include: {
        location: true,
      },
      orderBy: {
        issuedAt: 'desc',
      },
      take: limit,
    });

    // Calculate totals by location
    const locationTotals = new Map<string, { name: string; total: number }>();

    type InvoiceType = typeof invoices[number];
    for (const invoice of invoices as InvoiceType[]) {
      if (invoice.locationId && invoice.location) {
        const existing = locationTotals.get(invoice.locationId) || {
          name: invoice.location.name,
          total: 0,
        };
        existing.total += Number(invoice.total);
        locationTotals.set(invoice.locationId, existing);
      }
    }

    return {
      customer: {
        id: customer.id,
        name: customer.name,
      },
      invoices: invoices.map((inv: InvoiceType) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        issuedAt: inv.issuedAt,
        locationName: inv.location?.name || null,
        subtotal: Number(inv.subtotal),
        total: Number(inv.total),
        status: inv.status,
      })),
      totals: {
        invoiceCount: invoices.length,
        totalBilled: invoices.reduce((sum: number, inv: InvoiceType) => sum + Number(inv.total), 0),
        byLocation: (Array.from(locationTotals.entries()) as [string, { name: string; total: number }][]).map(([locationId, data]) => ({
          locationId,
          locationName: data.name,
          total: data.total,
        })),
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let consolidatedBillingService: ConsolidatedBillingService | null = null;

export function getConsolidatedBillingService(
  prisma?: PrismaClient
): ConsolidatedBillingService {
  if (!consolidatedBillingService && prisma) {
    consolidatedBillingService = new ConsolidatedBillingService(prisma);
  }
  if (!consolidatedBillingService) {
    throw new Error('ConsolidatedBillingService not initialized');
  }
  return consolidatedBillingService;
}
