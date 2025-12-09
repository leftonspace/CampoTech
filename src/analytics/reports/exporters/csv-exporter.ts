/**
 * CSV Report Exporter
 * ===================
 *
 * Phase 10.3: Report Generation Engine
 * Generates CSV exports for data analysis.
 */

import { ReportData, ReportSection, ChartData, TableData } from '../report-generator';
import { KPIValue } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CSVExportOptions {
  delimiter?: ',' | ';' | '\t';
  quoteStrings?: boolean;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'local';
  numberLocale?: 'en' | 'es';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate CSV from report data
 */
export async function generateCSV(
  reportData: ReportData,
  options: CSVExportOptions = {}
): Promise<Buffer> {
  const {
    delimiter = ',',
    quoteStrings = true,
    includeHeaders = true,
    dateFormat = 'local',
    numberLocale = 'es',
  } = options;

  const formatter = new CSVFormatter(delimiter, quoteStrings, dateFormat, numberLocale);
  const lines: string[] = [];

  // Report header
  lines.push(`# ${reportData.templateName}`);
  lines.push(`# Período: ${formatter.formatDate(reportData.dateRange.start)} - ${formatter.formatDate(reportData.dateRange.end)}`);
  lines.push(`# Generado: ${formatter.formatDateTime(reportData.generatedAt)}`);
  lines.push('');

  // Process each section
  for (const section of reportData.sections) {
    lines.push(`# ${section.title}`);

    const sectionCSV = formatSectionCSV(section, formatter, includeHeaders);
    lines.push(...sectionCSV);
    lines.push('');
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}

/**
 * Generate CSV for a single table section
 */
export async function generateTableCSV(
  tableData: TableData,
  options: CSVExportOptions = {}
): Promise<Buffer> {
  const {
    delimiter = ',',
    quoteStrings = true,
    includeHeaders = true,
    dateFormat = 'local',
    numberLocale = 'es',
  } = options;

  const formatter = new CSVFormatter(delimiter, quoteStrings, dateFormat, numberLocale);
  const lines: string[] = [];

  // Headers
  if (includeHeaders) {
    const headers = tableData.columns.map((col) => formatter.format(col.label));
    lines.push(headers.join(delimiter));
  }

  // Data rows
  for (const row of tableData.rows) {
    const values = tableData.columns.map((col) =>
      formatter.formatValue(row[col.key], col.type)
    );
    lines.push(values.join(delimiter));
  }

  // Totals row
  if (tableData.totals) {
    const totalValues = tableData.columns.map((col) => {
      if (tableData.totals && col.key in tableData.totals) {
        return formatter.formatValue(tableData.totals[col.key], col.type);
      }
      return col.key === tableData.columns[0].key ? formatter.format('Total') : '';
    });
    lines.push(totalValues.join(delimiter));
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}

/**
 * Generate CSV for KPI data
 */
export async function generateKPICSV(
  kpis: KPIValue[],
  options: CSVExportOptions = {}
): Promise<Buffer> {
  const {
    delimiter = ',',
    quoteStrings = true,
    includeHeaders = true,
  } = options;

  const formatter = new CSVFormatter(delimiter, quoteStrings, 'local', 'es');
  const lines: string[] = [];

  // Headers
  if (includeHeaders) {
    lines.push(['Métrica', 'Valor', 'Unidad', 'Tendencia', 'Cambio %'].join(delimiter));
  }

  // Data
  for (const kpi of kpis) {
    const row = [
      formatter.format(kpi.name),
      formatter.formatNumber(kpi.value),
      kpi.unit,
      kpi.trend || 'stable',
      kpi.changePercent?.toFixed(1) || '0',
    ];
    lines.push(row.join(delimiter));
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}

/**
 * Format a section as CSV lines
 */
function formatSectionCSV(
  section: ReportSection,
  formatter: CSVFormatter,
  includeHeaders: boolean
): string[] {
  const lines: string[] = [];
  const delimiter = formatter.delimiter;

  switch (section.type) {
    case 'kpi_grid': {
      const kpis = section.data as KPIValue[];

      if (includeHeaders) {
        lines.push(['Métrica', 'Valor', 'Unidad', 'Tendencia', 'Cambio %'].join(delimiter));
      }

      for (const kpi of kpis) {
        const row = [
          formatter.format(kpi.name),
          formatter.formatNumber(kpi.value),
          kpi.unit,
          kpi.trend || 'stable',
          kpi.changePercent?.toFixed(1) || '',
        ];
        lines.push(row.join(delimiter));
      }
      break;
    }

    case 'table': {
      const tableData = section.data as TableData;

      if (includeHeaders) {
        const headers = tableData.columns.map((col) => formatter.format(col.label));
        lines.push(headers.join(delimiter));
      }

      for (const row of tableData.rows) {
        const values = tableData.columns.map((col) =>
          formatter.formatValue(row[col.key], col.type)
        );
        lines.push(values.join(delimiter));
      }

      if (tableData.totals) {
        const totalValues = tableData.columns.map((col) => {
          if (tableData.totals && col.key in tableData.totals) {
            return formatter.formatValue(tableData.totals[col.key], col.type);
          }
          return col.key === tableData.columns[0].key ? formatter.format('Total') : '';
        });
        lines.push(totalValues.join(delimiter));
      }
      break;
    }

    case 'chart': {
      const chartData = section.data as ChartData;

      if (includeHeaders) {
        const headers = ['Período', ...chartData.datasets.map((ds) => ds.label)];
        lines.push(headers.map((h) => formatter.format(h)).join(delimiter));
      }

      for (let i = 0; i < chartData.labels.length; i++) {
        const row = [
          formatter.format(chartData.labels[i]),
          ...chartData.datasets.map((ds) => formatter.formatNumber(ds.data[i])),
        ];
        lines.push(row.join(delimiter));
      }
      break;
    }
  }

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV FORMATTER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class CSVFormatter {
  constructor(
    public delimiter: string,
    private quoteStrings: boolean,
    private dateFormat: 'iso' | 'local',
    private numberLocale: 'en' | 'es'
  ) {}

  /**
   * Format a string value for CSV
   */
  format(value: string): string {
    if (!this.quoteStrings) return this.escape(value);

    // Always quote if contains delimiter, quotes, or newlines
    if (
      value.includes(this.delimiter) ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Format a value based on its type
   */
  formatValue(value: unknown, type: string): string {
    if (value === null || value === undefined) return '';

    switch (type) {
      case 'currency':
        return this.formatCurrency(Number(value));
      case 'percentage':
        return `${Number(value).toFixed(1)}%`;
      case 'number':
        return this.formatNumber(Number(value));
      case 'date':
        return this.formatDate(new Date(value as string));
      default:
        return this.format(String(value));
    }
  }

  /**
   * Format a number
   */
  formatNumber(value: number): string {
    if (this.numberLocale === 'es') {
      // Spanish format: 1.234,56
      return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    }
    // English format: 1,234.56
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * Format a currency value
   */
  formatCurrency(value: number): string {
    if (this.numberLocale === 'es') {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format a date
   */
  formatDate(date: Date): string {
    if (this.dateFormat === 'iso') {
      return date.toISOString().slice(0, 10);
    }
    return new Intl.DateTimeFormat(this.numberLocale === 'es' ? 'es-AR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Format a datetime
   */
  formatDateTime(date: Date): string {
    if (this.dateFormat === 'iso') {
      return date.toISOString();
    }
    return new Intl.DateTimeFormat(this.numberLocale === 'es' ? 'es-AR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Escape special characters
   */
  private escape(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING CSV GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate CSV incrementally for large datasets
 */
export async function* generateCSVStream(
  tableData: TableData,
  options: CSVExportOptions = {}
): AsyncGenerator<string> {
  const {
    delimiter = ',',
    quoteStrings = true,
    includeHeaders = true,
    dateFormat = 'local',
    numberLocale = 'es',
  } = options;

  const formatter = new CSVFormatter(delimiter, quoteStrings, dateFormat, numberLocale);

  // Yield headers
  if (includeHeaders) {
    const headers = tableData.columns.map((col) => formatter.format(col.label));
    yield headers.join(delimiter) + '\n';
  }

  // Yield rows
  for (const row of tableData.rows) {
    const values = tableData.columns.map((col) =>
      formatter.formatValue(row[col.key], col.type)
    );
    yield values.join(delimiter) + '\n';
  }

  // Yield totals
  if (tableData.totals) {
    const totalValues = tableData.columns.map((col) => {
      if (tableData.totals && col.key in tableData.totals) {
        return formatter.formatValue(tableData.totals[col.key], col.type);
      }
      return col.key === tableData.columns[0].key ? formatter.format('Total') : '';
    });
    yield totalValues.join(delimiter) + '\n';
  }
}
