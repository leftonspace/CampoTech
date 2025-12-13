/**
 * Tax Summary Calculator
 * ======================
 *
 * Phase 10.2: Business Intelligence KPIs
 * AFIP (Argentina) tax reporting and IVA summary.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { DateRange } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Argentine IVA (VAT) rates
 */
export const IVA_RATES = {
  GENERAL: 21, // Tasa general
  REDUCIDA: 10.5, // Tasa reducida
  DIFERENCIAL: 27, // Tasa diferencial (servicios públicos)
  EXENTO: 0, // Exento
  NO_GRAVADO: 0, // No gravado
} as const;

export type IVARate = keyof typeof IVA_RATES;

/**
 * Invoice types for AFIP
 */
export type AFIPInvoiceType = 'A' | 'B' | 'C' | 'E' | 'M';

export interface TaxSummary {
  period: string;
  totalInvoiced: number;
  netAmount: number;
  totalIVA: number;
  ivaByRate: IVAByRate[];
  invoicesByType: InvoicesByType[];
  ivaDebitoFiscal: number; // IVA to pay
  ivaCreditoFiscal: number; // IVA credit (estimated from expenses)
  ivaBalance: number; // Net IVA position
  retenciones: number;
  percepciones: number;
}

export interface IVAByRate {
  rate: number;
  rateName: string;
  baseAmount: number;
  taxAmount: number;
  invoiceCount: number;
}

export interface InvoicesByType {
  type: AFIPInvoiceType;
  typeName: string;
  count: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface LibroIVAEntry {
  date: Date;
  invoiceNumber: string;
  invoiceType: AFIPInvoiceType;
  customerName: string;
  customerCUIT: string | null;
  customerTaxCondition: string;
  netAmount: number;
  ivaRate: number;
  ivaAmount: number;
  totalAmount: number;
  paymentStatus: string;
}

export interface MonthlyTaxSummary {
  month: string;
  totalSales: number;
  totalIVA: number;
  ivaBalance: number;
  invoiceCount: number;
  changePercent: number;
}

export interface TaxConditionBreakdown {
  condition: string;
  displayName: string;
  customerCount: number;
  invoiceCount: number;
  totalAmount: number;
  percentOfTotal: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAX CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate comprehensive tax summary for a period
 */
export async function calculateTaxSummary(
  organizationId: string,
  dateRange: DateRange
): Promise<TaxSummary> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: true,
    },
  });

  let totalInvoiced = 0;
  let netAmount = 0;
  let totalIVA = 0;

  // Group by IVA rate
  const ivaByRateMap = new Map<number, {
    baseAmount: number;
    taxAmount: number;
    count: number;
  }>();

  // Group by invoice type
  const invoicesByTypeMap = new Map<AFIPInvoiceType, {
    count: number;
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
  }>();

  for (const invoice of invoices) {
    const total = invoice.total?.toNumber() || 0;
    const tax = invoice.taxAmount?.toNumber() || 0;
    const net = invoice.subtotal?.toNumber() || total - tax;

    totalInvoiced += total;
    netAmount += net;
    totalIVA += tax;

    // Determine IVA rate (default to general 21%)
    const ivaRate = net > 0 && tax > 0 ? Math.round((tax / net) * 100) : 21;

    // Update IVA by rate
    const currentRate = ivaByRateMap.get(ivaRate) || {
      baseAmount: 0,
      taxAmount: 0,
      count: 0,
    };
    currentRate.baseAmount += net;
    currentRate.taxAmount += tax;
    currentRate.count++;
    ivaByRateMap.set(ivaRate, currentRate);

    // Update by invoice type
    const invoiceType = (invoice.type as AFIPInvoiceType) || 'B';
    const currentType = invoicesByTypeMap.get(invoiceType) || {
      count: 0,
      netAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    };
    currentType.count++;
    currentType.netAmount += net;
    currentType.taxAmount += tax;
    currentType.totalAmount += total;
    invoicesByTypeMap.set(invoiceType, currentType);
  }

  // Format IVA by rate
  const rateNames: Record<number, string> = {
    21: 'Tasa General (21%)',
    10.5: 'Tasa Reducida (10.5%)',
    27: 'Tasa Diferencial (27%)',
    0: 'Exento / No Gravado',
  };

  const ivaByRate: IVAByRate[] = Array.from(ivaByRateMap.entries())
    .map(([rate, data]) => ({
      rate,
      rateName: rateNames[rate] || `Tasa ${rate}%`,
      baseAmount: data.baseAmount,
      taxAmount: data.taxAmount,
      invoiceCount: data.count,
    }))
    .sort((a, b) => b.taxAmount - a.taxAmount);

  // Format invoices by type
  const typeNames: Record<AFIPInvoiceType, string> = {
    A: 'Factura A (Resp. Inscripto)',
    B: 'Factura B (Consumidor Final)',
    C: 'Factura C (Monotributo)',
    E: 'Factura E (Exportación)',
    M: 'Factura M (Controlador Fiscal)',
  };

  const invoicesByType: InvoicesByType[] = Array.from(invoicesByTypeMap.entries())
    .map(([type, data]) => ({
      type,
      typeName: typeNames[type] || type,
      ...data,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Calculate IVA position
  // IVA Débito Fiscal = IVA charged to customers
  const ivaDebitoFiscal = totalIVA;

  // IVA Crédito Fiscal = IVA on purchases (estimated as % of costs)
  // Without actual expense tracking, estimate based on industry average
  const estimatedCosts = netAmount * 0.45; // 45% cost ratio
  const ivaCreditoFiscal = estimatedCosts * 0.21; // Assume 21% IVA on all costs

  const ivaBalance = ivaDebitoFiscal - ivaCreditoFiscal;

  // Format period
  const period = `${dateRange.start.toISOString().slice(0, 7)} a ${dateRange.end.toISOString().slice(0, 7)}`;

  return {
    period,
    totalInvoiced,
    netAmount,
    totalIVA,
    ivaByRate,
    invoicesByType,
    ivaDebitoFiscal,
    ivaCreditoFiscal,
    ivaBalance,
    retenciones: 0, // Would need actual retention tracking
    percepciones: 0, // Would need actual perception tracking
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRO IVA DIGITAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Libro IVA Digital entries for AFIP
 */
export async function generateLibroIVA(
  organizationId: string,
  dateRange: DateRange
): Promise<LibroIVAEntry[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        select: {
          name: true,
          taxId: true,
          taxCondition: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return invoices.map((invoice) => {
    const total = invoice.total?.toNumber() || 0;
    const tax = invoice.taxAmount?.toNumber() || 0;
    const net = invoice.subtotal?.toNumber() || total - tax;
    const ivaRate = net > 0 && tax > 0 ? Math.round((tax / net) * 100) : 21;

    return {
      date: invoice.createdAt,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      invoiceType: (invoice.type as AFIPInvoiceType) || 'B',
      customerName: invoice.customer?.name || 'N/A',
      customerCUIT: invoice.customer?.taxId || null,
      customerTaxCondition: 'consumidor_final',
      netAmount: net,
      ivaRate,
      ivaAmount: tax,
      totalAmount: total,
      paymentStatus: invoice.status,
    };
  });
}

/**
 * Export Libro IVA data in AFIP format
 */
export function formatLibroIVAForExport(entries: LibroIVAEntry[]): string[][] {
  const header = [
    'Fecha',
    'Tipo Comprobante',
    'Número',
    'CUIT Cliente',
    'Denominación',
    'Cond. Frente al IVA',
    'Neto Gravado',
    'Alícuota IVA',
    'IVA',
    'Total',
  ];

  const rows = entries.map((entry) => [
    entry.date.toISOString().slice(0, 10),
    entry.invoiceType,
    entry.invoiceNumber,
    entry.customerCUIT || '-',
    entry.customerName,
    formatTaxCondition(entry.customerTaxCondition),
    entry.netAmount.toFixed(2),
    `${entry.ivaRate}%`,
    entry.ivaAmount.toFixed(2),
    entry.totalAmount.toFixed(2),
  ]);

  return [header, ...rows];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTHLY TAX TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get monthly tax summary trend
 */
export async function getMonthlyTaxTrend(
  organizationId: string,
  months: number = 12
): Promise<MonthlyTaxSummary[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      total: true,
      taxAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by month
  const monthlyData = new Map<string, {
    totalSales: number;
    totalIVA: number;
    count: number;
  }>();

  for (const invoice of invoices) {
    const month = invoice.createdAt.toISOString().slice(0, 7);
    const current = monthlyData.get(month) || {
      totalSales: 0,
      totalIVA: 0,
      count: 0,
    };

    current.totalSales += invoice.total?.toNumber() || 0;
    current.totalIVA += invoice.taxAmount?.toNumber() || 0;
    current.count++;
    monthlyData.set(month, current);
  }

  // Estimate IVA balance (IVA collected - estimated IVA on costs)
  const sortedMonths = Array.from(monthlyData.keys()).sort();
  const results: MonthlyTaxSummary[] = [];
  let previousIVA = 0;

  for (const month of sortedMonths) {
    const data = monthlyData.get(month)!;
    const estimatedCosts = (data.totalSales - data.totalIVA) * 0.45;
    const ivaCreditoFiscal = estimatedCosts * 0.21;
    const ivaBalance = data.totalIVA - ivaCreditoFiscal;

    const changePercent = previousIVA > 0
      ? ((data.totalIVA - previousIVA) / previousIVA) * 100
      : 0;

    results.push({
      month,
      totalSales: data.totalSales,
      totalIVA: data.totalIVA,
      ivaBalance,
      invoiceCount: data.count,
      changePercent,
    });

    previousIVA = data.totalIVA;
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAX CONDITION BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get breakdown by customer tax condition
 */
export async function getTaxConditionBreakdown(
  organizationId: string,
  dateRange: DateRange
): Promise<TaxConditionBreakdown[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          taxCondition: true,
        },
      },
    },
  });

  const conditionData = new Map<string, {
    customers: Set<string>;
    invoiceCount: number;
    totalAmount: number;
  }>();

  for (const invoice of invoices) {
    const condition = 'consumidor_final';
    const current = conditionData.get(condition) || {
      customers: new Set(),
      invoiceCount: 0,
      totalAmount: 0,
    };

    if (invoice.customer?.id) {
      current.customers.add(invoice.customer.id);
    }
    current.invoiceCount++;
    current.totalAmount += invoice.total?.toNumber() || 0;
    conditionData.set(condition, current);
  }

  const totalAmount = Array.from(conditionData.values()).reduce(
    (sum, d) => sum + d.totalAmount,
    0
  );

  const conditionNames: Record<string, string> = {
    responsable_inscripto: 'Responsable Inscripto',
    monotributo: 'Monotributista',
    exento: 'IVA Exento',
    consumidor_final: 'Consumidor Final',
    no_responsable: 'No Responsable',
  };

  const results: TaxConditionBreakdown[] = Array.from(conditionData.entries()).map(
    ([condition, data]) => ({
      condition,
      displayName: conditionNames[condition] || condition,
      customerCount: data.customers.size,
      invoiceCount: data.invoiceCount,
      totalAmount: data.totalAmount,
      percentOfTotal: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
    })
  );

  return results.sort((a, b) => b.totalAmount - a.totalAmount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate CITI Ventas format data for AFIP
 */
export async function generateCITIVentas(
  organizationId: string,
  dateRange: DateRange
): Promise<{
  comprobantes: any[];
  alicuotas: any[];
}> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      customer: {
        select: {
          taxId: true,
          taxCondition: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // CITI Ventas - Comprobantes
  const comprobantes = invoices.map((invoice) => {
    const total = invoice.total?.toNumber() || 0;
    const tax = invoice.taxAmount?.toNumber() || 0;
    const net = invoice.subtotal?.toNumber() || total - tax;

    return {
      fecha: invoice.createdAt.toISOString().slice(0, 10).replace(/-/g, ''),
      tipoComprobante: mapInvoiceTypeToAFIP(invoice.type as AFIPInvoiceType),
      puntoVenta: '00001',
      numeroComprobante: invoice.invoiceNumber || invoice.id,
      codigoDocumento: invoice.customer?.taxId ? '80' : '99', // 80 = CUIT, 99 = Sin ID
      numeroDocumento: invoice.customer?.taxId || '0',
      denominacion: invoice.customer?.name || 'CONSUMIDOR FINAL',
      importeTotal: total.toFixed(2),
      importeNoGravado: '0.00',
      importeExento: '0.00',
      importeIVA: tax.toFixed(2),
      importeNeto: net.toFixed(2),
    };
  });

  // CITI Ventas - Alícuotas
  const alicuotas = invoices.map((invoice) => {
    const total = invoice.total?.toNumber() || 0;
    const tax = invoice.taxAmount?.toNumber() || 0;
    const net = invoice.subtotal?.toNumber() || total - tax;

    return {
      tipoComprobante: mapInvoiceTypeToAFIP(invoice.type as AFIPInvoiceType),
      puntoVenta: '00001',
      numeroComprobante: invoice.invoiceNumber || invoice.id,
      codigoAlicuota: '5', // 5 = 21%
      baseImponible: net.toFixed(2),
      importeIVA: tax.toFixed(2),
    };
  });

  return { comprobantes, alicuotas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate tax KPIs for dashboard
 */
export async function generateTaxKPIs(
  organizationId: string,
  dateRange: DateRange
): Promise<Array<{
  id: string;
  name: string;
  value: number;
  unit: 'currency' | 'percentage' | 'number';
  trend: 'up' | 'down' | 'stable';
  description?: string;
}>> {
  const summary = await calculateTaxSummary(organizationId, dateRange);
  const monthlyTrend = await getMonthlyTaxTrend(organizationId, 3);

  const lastMonth = monthlyTrend[monthlyTrend.length - 1];
  const trend: 'up' | 'down' | 'stable' =
    lastMonth?.changePercent > 5
      ? 'up'
      : lastMonth?.changePercent < -5
      ? 'down'
      : 'stable';

  return [
    {
      id: 'total_iva',
      name: 'IVA Débito Fiscal',
      value: summary.ivaDebitoFiscal,
      unit: 'currency',
      trend,
      description: 'IVA cobrado a clientes',
    },
    {
      id: 'iva_credito',
      name: 'IVA Crédito Fiscal',
      value: summary.ivaCreditoFiscal,
      unit: 'currency',
      trend: 'stable',
      description: 'IVA estimado en compras',
    },
    {
      id: 'iva_balance',
      name: 'Saldo IVA',
      value: summary.ivaBalance,
      unit: 'currency',
      trend: summary.ivaBalance > 0 ? 'down' : 'up',
      description: 'IVA neto a pagar/favor',
    },
    {
      id: 'net_invoiced',
      name: 'Facturación Neta',
      value: summary.netAmount,
      unit: 'currency',
      trend,
      description: 'Total facturado sin IVA',
    },
    {
      id: 'effective_tax_rate',
      name: 'Tasa Efectiva IVA',
      value: summary.netAmount > 0 ? (summary.totalIVA / summary.netAmount) * 100 : 0,
      unit: 'percentage',
      trend: 'stable',
      description: 'Porcentaje de IVA sobre ventas',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatTaxCondition(condition: string): string {
  const conditions: Record<string, string> = {
    responsable_inscripto: 'RI',
    monotributo: 'M',
    exento: 'EX',
    consumidor_final: 'CF',
    no_responsable: 'NR',
  };
  return conditions[condition] || condition;
}

function mapInvoiceTypeToAFIP(type: AFIPInvoiceType): string {
  const mapping: Record<AFIPInvoiceType, string> = {
    A: '001',
    B: '006',
    C: '011',
    E: '019',
    M: '051',
  };
  return mapping[type] || '006';
}
