/**
 * Excel Report Exporter
 * =====================
 *
 * Phase 10.3: Report Generation Engine
 * Generates Excel reports with multiple sheets using xlsx library.
 */

import { ReportData, ReportSection, ChartData, TableData } from '../report-generator';
import { KPIValue } from '../../analytics.types';
import { log } from '../../../lib/logging/logger';

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
 * Uses xlsx library for actual Excel generation with CSV fallback
 */
export async function generateExcel(
  reportData: ReportData,
  options: ExcelExportOptions = {}
): Promise<Buffer> {
  const {
    separateSheets = true,
    autoWidth = true,
    freezeHeaders = true,
  } = options;

  log.info('Generating Excel report', { templateId: reportData.templateId, separateSheets });

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

  // Try xlsx library first
  try {
    const xlsxBuffer = await generateWithXLSX(sheets, { autoWidth, freezeHeaders });
    log.info('Excel generated with xlsx library', { size: xlsxBuffer.length });
    return xlsxBuffer;
  } catch (xlsxError) {
    log.warn('xlsx generation failed, trying exceljs fallback', { error: xlsxError });
  }

  // Try exceljs as fallback
  try {
    const excelBuffer = await generateWithExcelJS(sheets, reportData, { autoWidth, freezeHeaders });
    log.info('Excel generated with exceljs', { size: excelBuffer.length });
    return excelBuffer;
  } catch (exceljsError) {
    log.warn('exceljs generation failed, using CSV fallback', { error: exceljsError });
  }

  // Fallback to CSV format
  const csvBuffer = generateCSVFallback(sheets);
  log.info('Returning CSV as Excel fallback', { size: csvBuffer.length });
  return csvBuffer;
}

/**
 * Generate Excel using xlsx (SheetJS) library
 */
async function generateWithXLSX(
  sheets: ExcelSheet[],
  options: { autoWidth: boolean; freezeHeaders: boolean }
): Promise<Buffer> {
  const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null);
  if (!XLSX) {
    throw new Error('xlsx library not available');
  }

  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    // Convert data to array of arrays with headers
    const headers = sheet.columns.map((c: typeof sheet.columns[number]) => c.header);
    const rows = sheet.data.map((row: typeof sheet.data[number]) => sheet.columns.map((c: typeof sheet.columns[number]) => row[c.key]));
    const sheetData = [headers, ...rows];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    if (options.autoWidth) {
      const colWidths = sheet.columns.map((col: typeof sheet.columns[number], idx: number) => {
        let maxWidth = col.header.length;
        for (const row of sheet.data) {
          const cellValue = String(row[col.key] || '');
          maxWidth = Math.max(maxWidth, cellValue.length);
        }
        return { wch: Math.min(maxWidth + 2, 50) }; // Cap at 50 chars
      });
      worksheet['!cols'] = colWidths;
    }

    // Freeze first row (header)
    if (options.freezeHeaders) {
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

/**
 * Generate Excel using exceljs library
 */
async function generateWithExcelJS(
  sheets: ExcelSheet[],
  reportData: ReportData,
  options: { autoWidth: boolean; freezeHeaders: boolean }
): Promise<Buffer> {
  const ExcelJS = await import('exceljs').then(m => m.default || m).catch(() => null);
  if (!ExcelJS) {
    throw new Error('exceljs library not available');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CampoTech Analytics';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.lastModifiedBy = 'CampoTech Report Engine';

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    // Define columns
    worksheet.columns = sheet.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // Add rows
    for (const row of sheet.data) {
      worksheet.addRow(row);
    }

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    // Freeze header row
    if (options.freezeHeaders) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    // Auto-fit columns
    if (options.autoWidth) {
      worksheet.columns.forEach((column: any) => {
        if (column.eachCell) {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell: any) => {
            const cellLength = cell.value ? String(cell.value).length : 10;
            if (cellLength > maxLength) {
              maxLength = cellLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50);
        }
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate CSV as fallback (compatible with Excel import)
 */
function generateCSVFallback(sheets: ExcelSheet[]): Buffer {
  const csvSheets = sheets.map((sheet: typeof sheets[number]) => {
    const headers = sheet.columns.map((c: typeof sheet.columns[number]) => escapeCSV(c.header)).join(',');
    const rows = sheet.data.map((row: typeof sheet.data[number]) =>
      sheet.columns.map((c: typeof sheet.columns[number]) => escapeCSV(formatCSVValue(row[c.key]))).join(',')
    );
    return `=== ${sheet.name} ===\n${headers}\n${rows.join('\n')}`;
  });

  return Buffer.from(csvSheets.join('\n\n'), 'utf-8');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
        data: kpis.map((kpi: typeof kpis[number]) => ({
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
        data: tableData.rows.map((row: typeof tableData.rows[number]) => {
          const excelRow: ExcelRow = {};
          for (const col of tableData.columns) {
            excelRow[col.key] = row[col.key] as string | number | Date | null;
          }
          return excelRow;
        }),
        columns: tableData.columns.map((col: typeof tableData.columns[number]) => ({
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
          ...chartData.datasets.map((ds: typeof chartData.datasets[number]) => ({
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
          const values = tableData.columns.map((col: typeof tableData.columns[number]) => row[col.key]).join(' | ');
          rows.push({ seccion: '', tipo: '', valor: values });
        }
        break;
      }

      case 'chart': {
        const chartData = section.data as ChartData;
        for (let i = 0; i < chartData.labels.length; i++) {
          const values = chartData.datasets.map((ds: typeof chartData.datasets[number]) => `${ds.label}: ${ds.data[i]}`).join(', ');
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
    sheets: sheets.map((sheet: typeof sheets[number]) => ({
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
  const csvSheets = sheets.map((sheet: typeof sheets[number]) => {
    const headers = sheet.columns.map((c: typeof sheet.columns[number]) => c.header).join(',');
    const rows = sheet.data.map((row: typeof sheet.data[number]) =>
      sheet.columns.map((c: typeof sheet.columns[number]) => formatCSVValue(row[c.key])).join(',')
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
