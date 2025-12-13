/**
 * Tax Report Template
 * ===================
 *
 * Phase 10.3: Report Generation Engine
 * AFIP-compliant tax reporting template for Argentina.
 */

import { ReportTemplate } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TAX REPORT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const TAX_REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  afip_monthly: {
    id: 'afip_monthly',
    name: 'Resumen Impositivo Mensual (AFIP)',
    description: 'Resumen de facturación e impuestos para declaración mensual ante AFIP',
    category: 'tax',
    sections: [
      {
        id: 'tax_summary',
        title: 'Resumen de Impuestos',
        type: 'kpi_grid',
        kpis: ['total_facturado', 'iva_debito', 'percepciones_iva', 'iibb_retenido'],
      },
      {
        id: 'facturacion_por_tipo',
        title: 'Facturación por Tipo de Comprobante',
        type: 'table',
        dataSource: 'invoice_by_type',
      },
      {
        id: 'iva_breakdown',
        title: 'Desglose de IVA',
        type: 'chart',
        chartType: 'pie',
        dataSource: 'iva_breakdown',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'day',
    defaultFilters: {},
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  iva_trimestral: {
    id: 'iva_trimestral',
    name: 'Informe IVA Trimestral',
    description: 'Resumen trimestral de IVA Débito Fiscal para presentación ante AFIP',
    category: 'tax',
    sections: [
      {
        id: 'resumen_iva',
        title: 'Resumen de IVA',
        type: 'kpi_grid',
        kpis: ['iva_debito_total', 'iva_21_total', 'iva_105_total', 'iva_27_total'],
      },
      {
        id: 'iva_por_mes',
        title: 'IVA por Mes',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'iva_by_month',
      },
    ],
    defaultDateRange: 'quarter',
    defaultGranularity: 'month',
    defaultFilters: {},
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  iibb_mensual: {
    id: 'iibb_mensual',
    name: 'Informe Ingresos Brutos Mensual',
    description: 'Resumen de base imponible para Ingresos Brutos por jurisdicción',
    category: 'tax',
    sections: [
      {
        id: 'resumen_iibb',
        title: 'Resumen Ingresos Brutos',
        type: 'kpi_grid',
        kpis: ['base_imponible_iibb', 'iibb_devengado', 'retenciones_iibb', 'percepciones_iibb'],
      },
      {
        id: 'iibb_por_jurisdiccion',
        title: 'IIBB por Jurisdicción',
        type: 'table',
        dataSource: 'iibb_by_jurisdiction',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'day',
    defaultFilters: {},
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  retenciones_percepciones: {
    id: 'retenciones_percepciones',
    name: 'Informe de Retenciones y Percepciones',
    description: 'Detalle de retenciones sufridas y percepciones para cómputo de crédito fiscal',
    category: 'tax',
    sections: [
      {
        id: 'resumen_ret_perc',
        title: 'Resumen de Retenciones y Percepciones',
        type: 'kpi_grid',
        kpis: ['retenciones_ganancias', 'retenciones_iva', 'retenciones_iibb', 'percepciones_total'],
      },
      {
        id: 'retenciones_por_tipo',
        title: 'Retenciones por Tipo',
        type: 'chart',
        chartType: 'pie',
        dataSource: 'withholdings_by_type',
      },
    ],
    defaultDateRange: 'month',
    defaultGranularity: 'day',
    defaultFilters: {},
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },

  resumen_anual: {
    id: 'resumen_anual',
    name: 'Resumen Impositivo Anual',
    description: 'Resumen anual de todos los impuestos para cierre de ejercicio',
    category: 'tax',
    sections: [
      {
        id: 'resumen_general',
        title: 'Resumen General del Ejercicio',
        type: 'kpi_grid',
        kpis: ['facturacion_anual', 'iva_anual', 'iibb_anual', 'retenciones_anuales'],
      },
      {
        id: 'facturacion_mensual',
        title: 'Facturación Mensual',
        type: 'chart',
        chartType: 'bar',
        dataSource: 'monthly_invoicing',
      },
    ],
    defaultDateRange: 'year',
    defaultGranularity: 'month',
    defaultFilters: {},
    supportedFormats: ['pdf', 'excel'] as const,
    availableFormats: ['pdf', 'excel'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AFIP CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const AFIP_DOCUMENT_TYPES = {
  1: { code: '001', name: 'Factura A', shortName: 'FA' },
  6: { code: '006', name: 'Factura B', shortName: 'FB' },
  11: { code: '011', name: 'Factura C', shortName: 'FC' },
};

export const IVA_RATES = {
  EXENTO: { rate: 0, code: 2, name: 'Exento' },
  IVA_10_5: { rate: 10.5, code: 4, name: '10.5%' },
  IVA_21: { rate: 21, code: 5, name: '21%' },
  IVA_27: { rate: 27, code: 6, name: '27%' },
};

export const IIBB_JURISDICTIONS = {
  '901': { name: 'Ciudad Autónoma de Buenos Aires', shortName: 'CABA' },
  '902': { name: 'Buenos Aires', shortName: 'PBA' },
  '904': { name: 'Córdoba', shortName: 'CBA' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function getTaxReportTemplates(): ReportTemplate[] {
  return Object.values(TAX_REPORT_TEMPLATES);
}

export function getTaxReportTemplateById(templateId: string): ReportTemplate | null {
  return TAX_REPORT_TEMPLATES[templateId] || null;
}

export function formatCUIT(cuit: string): string {
  const cleaned = cuit.replace(/\D/g, '');
  if (cleaned.length !== 11) return cuit;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

export function validateCUIT(cuit: string): boolean {
  const cleaned = cuit.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;

  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * multipliers[i];
  }

  const remainder = sum % 11;
  const verifier = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;

  return parseInt(cleaned[10]) === verifier;
}

export function getFiscalPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}${month}`;
}

export function formatTaxAmount(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const TAX_KPI_DEFINITIONS = {
  total_facturado: { id: 'total_facturado', name: 'Total Facturado', unit: 'currency' },
  iva_debito: { id: 'iva_debito', name: 'IVA Débito Fiscal', unit: 'currency' },
};
