/**
 * Excel Report Exporter
 * =====================
 *
 * Phase 10.3: Report Generation Engine
 * Generates Excel reports with multiple sheets.
 */

import { ReportData, ReportSection, ChartData, TableData } from '../report-generator';
import { KPIValue } from '../../analytics.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExcelExportOptions {
  includeCharts?: boolean;
  separateSheets?: boolean;
  autoWidth?: boolean;
  freezeHeaders?: boolean;
}

interface ExcelRow {
  [key: string]: string | number | Date | null;
}

interface ExcelSheet {
  name: string;
  data: ExcelRow[];
  columns: { header: string; key: string; width?: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Excel workbook from report data
 * Returns data in a format compatible with xlsx/exceljs libraries
 */
export async function generateExcel(
  reportData: ReportData,
  options: ExcelExportOptions = {}
): Promise<Buffer> {
  const {
    separateSheets = true,
    autoWidth = true,
  } = options;

  const sheets: ExcelSheet[] = [];

  // Summary sheet
  sheets.push(createSummarySheet(reportData));

  // Section sheets
  if (separateSheets) {
    for (const section of reportData.sections) {
      const sheet = createSectionSheet(section);
      if (sheet) {
        sheets.push(sheet);
      }
    }
  } else {
    // Single data sheet with all sections
    sheets.push(createCombinedDataSheet(reportData));
  }

  // Convert to CSV format as fallback (actual implementation would use xlsx library)
  const workbook = createWorkbookJSON(sheets);

  return Buffer.from(JSON.stringify(workbook, null, 2), 'utf-8');
}

/**
 * Create summary sheet
 */
function createSummarySheet(reportData: ReportData): ExcelSheet {
  const rows: ExcelRow[] = [];

  // Report info
  rows.push({
    campo: 'Informe',
    valor: reportData.templateName,
  });
  rows.push({
    campo: 'Período Inicio',
    valor: formatDate(reportData.dateRange.start),
  });
  rows.push({
    campo: 'Período Fin',
    valor: formatDate(reportData.dateRange.end),
  });
  rows.push({
    campo: 'Generado',
    valor: formatDateTime(reportData.generatedAt),
  });
  rows.push({
    campo: 'Registros Procesados',
    valor: reportData.metadata.totalRecords,
  });
  rows.push({ campo: '', valor: '' });

  // KPIs from all sections
  rows.push({ campo: 'MÉTRICAS CLAVE', valor: '' });

  for (const section of reportData.sections) {
    if (section.type === 'kpi_grid') {
      const kpis = section.data as KPIValue[];
      for (const kpi of kpis) {
        rows.push({
          campo: kpi.name,
          valor: formatKPIValue(kpi),
        });
      }
    }
  }

  return {
    name: 'Resumen',
    data: rows,
    columns: [
      { header: 'Campo', key: 'campo', width: 30 },
      { header: 'Valor', key: 'valor', width: 25 },
    ],
  };
}

/**
 * Create sheet from a section
 */
function createSectionSheet(section: ReportSection): ExcelSheet | null {
  const sheetName = truncateSheetName(section.title);

  switch (section.type) {
    case 'kpi_grid': {
      const kpis = section.data as KPIValue[];
      return {
        name: sheetName,
        data: kpis.map((kpi) => ({
          metrica: kpi.name,
          valor: kpi.value,
          unidad: kpi.unit,
          tendencia: kpi.trend || 'stable',
          cambio: kpi.changePercent || 0,
        })),
        columns: [
          { header: 'Métrica', key: 'metrica', width: 25 },
          { header: 'Valor', key: 'valor', width: 15 },
          { header: 'Unidad', key: 'unidad', width: 12 },
          { header: 'Tendencia', key: 'tendencia', width: 12 },
          { header: 'Cambio %', key: 'cambio', width: 12 },
        ],
      };
    }

    case 'table': {
      const tableData = section.data as TableData;
      return {
        name: sheetName,
        data: tableData.rows.map((row) => {
          const excelRow: ExcelRow = {};
          for (const col of tableData.columns) {
            excelRow[col.key] = row[col.key] as string | number | Date | null;
          }
          return excelRow;
        }),
        columns: tableData.columns.map((col) => ({
          header: col.label,
          key: col.key,
          width: 15,
        })),
      };
    }

    case 'chart': {
      const chartData = section.data as ChartData;
      const rows: ExcelRow[] = [];

      for (let i = 0; i < chartData.labels.length; i++) {
        const row: ExcelRow = { periodo: chartData.labels[i] };
        for (const ds of chartData.datasets) {
          row[ds.label] = ds.data[i];
        }
        rows.push(row);
      }

      return {
        name: sheetName,
        data: rows,
        columns: [
          { header: 'Período', key: 'periodo', width: 15 },
          ...chartData.datasets.map((ds) => ({
            header: ds.label,
            key: ds.label,
            width: 15,
          })),
        ],
      };
    }

    default:
      return null;
  }
}

/**
 * Create combined data sheet
 */
function createCombinedDataSheet(reportData: ReportData): ExcelSheet {
  const rows: ExcelRow[] = [];

  for (const section of reportData.sections) {
    // Section header
    rows.push({ seccion: section.title, tipo: section.type, valor: '' });

    switch (section.type) {
      case 'kpi_grid': {
        const kpis = section.data as KPIValue[];
        for (const kpi of kpis) {
          rows.push({
            seccion: '',
            tipo: kpi.name,
            valor: formatKPIValue(kpi),
          });
        }
        break;
      }

      case 'table': {
        const tableData = section.data as TableData;
        for (const row of tableData.rows) {
          const values = tableData.columns.map((col) => row[col.key]).join(' | ');
          rows.push({ seccion: '', tipo: '', valor: values });
        }
        break;
      }

      case 'chart': {
        const chartData = section.data as ChartData;
        for (let i = 0; i < chartData.labels.length; i++) {
          const values = chartData.datasets.map((ds) => `${ds.label}: ${ds.data[i]}`).join(', ');
          rows.push({ seccion: '', tipo: chartData.labels[i], valor: values });
        }
        break;
      }
    }

    // Empty row between sections
    rows.push({ seccion: '', tipo: '', valor: '' });
  }

  return {
    name: 'Datos',
    data: rows,
    columns: [
      { header: 'Sección', key: 'seccion', width: 25 },
      { header: 'Tipo', key: 'tipo', width: 25 },
      { header: 'Valor', key: 'valor', width: 40 },
    ],
  };
}

/**
 * Create workbook JSON structure
 */
function createWorkbookJSON(sheets: ExcelSheet[]): object {
  return {
    metadata: {
      creator: 'CampoTech Analytics',
      lastModifiedBy: 'CampoTech Analytics',
      created: new Date().toISOString(),
    },
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      columns: sheet.columns,
      data: sheet.data,
    })),
  };
}

/**
 * Generate actual Excel file using xlsx library pattern
 * This would be the implementation with an actual xlsx library
 */
export function generateExcelBuffer(sheets: ExcelSheet[]): Buffer {
  // For actual implementation, use xlsx or exceljs library:
  //
  // import * as XLSX from 'xlsx';
  // const workbook = XLSX.utils.book_new();
  // for (const sheet of sheets) {
  //   const worksheet = XLSX.utils.json_to_sheet(sheet.data);
  //   XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  // }
  // return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Return CSV format as fallback
  const csvSheets = sheets.map((sheet) => {
    const headers = sheet.columns.map((c) => c.header).join(',');
    const rows = sheet.data.map((row) =>
      sheet.columns.map((c) => formatCSVValue(row[c.key])).join(',')
    );
    return `=== ${sheet.name} ===\n${headers}\n${rows.join('\n')}`;
  });

  return Buffer.from(csvSheets.join('\n\n'), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatKPIValue(kpi: KPIValue): string {
  switch (kpi.unit) {
    case 'currency':
      return formatCurrency(kpi.value);
    case 'percentage':
      return `${kpi.value.toFixed(1)}%`;
    case 'number':
      return kpi.value.toFixed(0);
    case 'days':
      return `${kpi.value.toFixed(0)} días`;
    case 'hours':
      return `${kpi.value.toFixed(1)} hrs`;
    case 'minutes':
      return `${kpi.value.toFixed(0)} min`;
    default:
      return String(kpi.value);
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function truncateSheetName(name: string): string {
  // Excel sheet names have a 31 character limit
  return name.length > 31 ? name.substring(0, 28) + '...' : name;
}

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const strValue = String(value);

  // Escape quotes and wrap in quotes if contains comma or newline
  if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}
