/**
 * PDF Report Exporter
 * ===================
 *
 * Phase 10.3: Report Generation Engine
 * Generates PDF reports using PDFKit with puppeteer fallback.
 */

import { ReportData, ReportSection, ChartData, TableData } from '../report-generator';
import { KPIValue } from '../../analytics.types';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PDFExportOptions {
  pageSize?: 'A4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeCharts?: boolean;
  includeTables?: boolean;
  watermark?: string;
  companyLogo?: string;
}

export interface PDFDocument {
  title: string;
  content: string;
  metadata: {
    author: string;
    subject: string;
    createdAt: Date;
  };
}

// Page dimensions in points (72 points = 1 inch)
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PDF GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate PDF document from report data
 * Uses PDFKit for native PDF generation, with puppeteer fallback
 */
export async function generatePDF(
  reportData: ReportData,
  options: PDFExportOptions = {}
): Promise<Buffer> {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    includeCharts = true,
    includeTables = true,
  } = options;

  log.info('Generating PDF report', { templateId: reportData.templateId, pageSize, orientation });

  // Try PDFKit first (lighter weight, no browser needed)
  try {
    const pdfBuffer = await generateWithPDFKit(reportData, options);
    log.info('PDF generated with PDFKit', { size: pdfBuffer.length });
    return pdfBuffer;
  } catch (pdfKitError) {
    log.warn('PDFKit generation failed, trying puppeteer fallback', { error: pdfKitError });
  }

  // Try puppeteer as fallback (better HTML rendering)
  try {
    const pdfBuffer = await generateWithPuppeteer(reportData, options);
    log.info('PDF generated with puppeteer', { size: pdfBuffer.length });
    return pdfBuffer;
  } catch (puppeteerError) {
    log.warn('Puppeteer generation failed, using HTML fallback', { error: puppeteerError });
  }

  // Final fallback: return HTML that can be printed to PDF by client
  const htmlContent = generateHTMLReport(reportData, buildPDFContent(reportData, { includeCharts, includeTables }));
  log.info('Returning HTML content as PDF fallback');
  return Buffer.from(htmlContent, 'utf-8');
}

/**
 * Generate PDF using PDFKit library
 */
async function generateWithPDFKit(
  reportData: ReportData,
  options: PDFExportOptions
): Promise<Buffer> {
  const PDFDocument = await import('pdfkit').then(m => m.default || m).catch(() => null);
  if (!PDFDocument) {
    throw new Error('PDFKit not available');
  }

  return new Promise((resolve, reject) => {
    try {
      const { pageSize = 'A4', orientation = 'portrait', margins = { top: 50, right: 50, bottom: 50, left: 50 } } = options;
      const size = PAGE_SIZES[pageSize];
      const isLandscape = orientation === 'landscape';

      const doc = new PDFDocument({
        size: pageSize.toUpperCase(),
        layout: orientation,
        margins,
        info: {
          Title: reportData.templateName,
          Author: 'CampoTech Analytics',
          Subject: `Informe generado el ${formatDateTime(reportData.generatedAt)}`,
          Creator: 'CampoTech Report Engine',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fillColor('#16a34a')
        .fontSize(24)
        .text(reportData.templateName, { align: 'left' });

      doc.moveDown(0.5);
      doc.fillColor('#6b7280')
        .fontSize(10)
        .text(`Período: ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}`);
      doc.text(`Generado: ${formatDateTime(reportData.generatedAt)}`);

      doc.moveDown(1);
      doc.strokeColor('#e5e7eb').lineWidth(1)
        .moveTo(margins.left, doc.y)
        .lineTo(isLandscape ? size.height - margins.right : size.width - margins.right, doc.y)
        .stroke();

      doc.moveDown(1);

      // Sections
      for (const section of reportData.sections) {
        // Check if we need a new page
        if (doc.y > (isLandscape ? size.width : size.height) - 150) {
          doc.addPage();
        }

        doc.fillColor('#374151')
          .fontSize(16)
          .text(section.title);
        doc.moveDown(0.5);

        switch (section.type) {
          case 'kpi_grid':
            renderKPIGrid(doc, section.data as KPIValue[], margins, isLandscape ? size.height : size.width);
            break;
          case 'table':
            if (options.includeTables !== false) {
              renderTable(doc, section.data as TableData, margins, isLandscape ? size.height : size.width);
            }
            break;
          case 'chart':
            if (options.includeCharts !== false) {
              renderChartAsTable(doc, section.data as ChartData, margins, isLandscape ? size.height : size.width);
            }
            break;
        }

        doc.moveDown(1);
      }

      // Footer
      doc.moveDown(2);
      doc.strokeColor('#e5e7eb').lineWidth(1)
        .moveTo(margins.left, doc.y)
        .lineTo(isLandscape ? size.height - margins.right : size.width - margins.right, doc.y)
        .stroke();
      doc.moveDown(0.5);
      doc.fillColor('#9ca3af')
        .fontSize(8)
        .text('Informe generado automáticamente por CampoTech Analytics', { align: 'center' });
      doc.text(`Tiempo de generación: ${reportData.metadata.generationTimeMs}ms | Registros: ${reportData.metadata.totalRecords}`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderKPIGrid(doc: any, kpis: KPIValue[], margins: { left: number; right: number }, pageWidth: number): void {
  const colWidth = (pageWidth - margins.left - margins.right) / 2;

  for (let i = 0; i < kpis.length; i += 2) {
    const kpi1 = kpis[i];
    const kpi2 = kpis[i + 1];
    const startY = doc.y;

    // First KPI
    doc.fillColor('#111827').fontSize(18).text(formatKPIValue(kpi1), margins.left, startY, { width: colWidth - 10 });
    doc.fillColor('#6b7280').fontSize(9).text(kpi1.name, margins.left, doc.y, { width: colWidth - 10 });
    if (kpi1.changePercent) {
      const trendColor = kpi1.trend === 'up' ? '#22c55e' : kpi1.trend === 'down' ? '#ef4444' : '#6b7280';
      doc.fillColor(trendColor).fontSize(8).text(`${kpi1.changePercent > 0 ? '+' : ''}${kpi1.changePercent.toFixed(1)}%`, { continued: false });
    }

    // Second KPI (if exists)
    if (kpi2) {
      doc.fillColor('#111827').fontSize(18).text(formatKPIValue(kpi2), margins.left + colWidth, startY, { width: colWidth - 10 });
      doc.fillColor('#6b7280').fontSize(9).text(kpi2.name, margins.left + colWidth, doc.y - 15, { width: colWidth - 10 });
    }

    doc.moveDown(1.5);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTable(doc: any, tableData: TableData, margins: { left: number; right: number }, pageWidth: number): void {
  if (tableData.rows.length === 0) {
    doc.fillColor('#6b7280').fontSize(10).text('No hay datos disponibles', { italic: true });
    return;
  }

  const tableWidth = pageWidth - margins.left - margins.right;
  const colWidth = tableWidth / tableData.columns.length;

  // Header row
  doc.fillColor('#374151').fontSize(9);
  let headerX = margins.left;
  for (const col of tableData.columns) {
    doc.text(col.label, headerX, doc.y, { width: colWidth - 5, continued: false });
    headerX += colWidth;
  }
  doc.moveDown(0.3);
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(margins.left, doc.y).lineTo(pageWidth - margins.right, doc.y).stroke();
  doc.moveDown(0.3);

  // Data rows (max 15 to avoid page overflow)
  const maxRows = Math.min(tableData.rows.length, 15);
  for (let i = 0; i < maxRows; i++) {
    const row = tableData.rows[i];
    let cellX = margins.left;
    const rowY = doc.y;

    doc.fillColor('#4b5563').fontSize(8);
    for (const col of tableData.columns) {
      const value = formatCellValue(row[col.key], col.type);
      doc.text(value, cellX, rowY, { width: colWidth - 5, height: 12, ellipsis: true });
      cellX += colWidth;
    }
    doc.moveDown(0.5);
  }

  if (tableData.rows.length > maxRows) {
    doc.fillColor('#9ca3af').fontSize(8).text(`... y ${tableData.rows.length - maxRows} filas más`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChartAsTable(doc: any, chartData: ChartData, margins: { left: number; right: number }, pageWidth: number): void {
  // Render chart data as a table since PDFKit doesn't support native charts
  const tableWidth = pageWidth - margins.left - margins.right;
  const colCount = chartData.datasets.length + 1;
  const colWidth = tableWidth / colCount;

  // Header
  doc.fillColor('#374151').fontSize(9);
  doc.text('Período', margins.left, doc.y, { width: colWidth - 5, continued: false });
  let headerX = margins.left + colWidth;
  for (const ds of chartData.datasets) {
    doc.text(ds.label, headerX, doc.y - 12, { width: colWidth - 5, continued: false });
    headerX += colWidth;
  }
  doc.moveDown(0.3);
  doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(margins.left, doc.y).lineTo(pageWidth - margins.right, doc.y).stroke();
  doc.moveDown(0.3);

  // Data rows (max 10)
  const maxRows = Math.min(chartData.labels.length, 10);
  for (let i = 0; i < maxRows; i++) {
    let cellX = margins.left;
    const rowY = doc.y;

    doc.fillColor('#4b5563').fontSize(8);
    doc.text(chartData.labels[i], cellX, rowY, { width: colWidth - 5 });
    cellX += colWidth;

    for (const ds of chartData.datasets) {
      doc.text(formatNumber(ds.data[i]), cellX, rowY, { width: colWidth - 5 });
      cellX += colWidth;
    }
    doc.moveDown(0.5);
  }
}

/**
 * Generate PDF using puppeteer (HTML to PDF conversion)
 */
async function generateWithPuppeteer(
  reportData: ReportData,
  options: PDFExportOptions
): Promise<Buffer> {
  const puppeteer = await import('puppeteer').then(m => m.default || m).catch(() => null);
  if (!puppeteer) {
    throw new Error('Puppeteer not available');
  }

  const { pageSize = 'A4', orientation = 'portrait', margins = { top: 50, right: 50, bottom: 50, left: 50 } } = options;
  const { includeCharts = true, includeTables = true } = options;

  const htmlContent = generateHTMLReport(reportData, buildPDFContent(reportData, { includeCharts, includeTables }));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: pageSize,
      landscape: orientation === 'landscape',
      margin: {
        top: `${margins.top}px`,
        right: `${margins.right}px`,
        bottom: `${margins.bottom}px`,
        left: `${margins.left}px`,
      },
      printBackground: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Build PDF content structure
 */
function buildPDFContent(
  reportData: ReportData,
  options: { includeCharts: boolean; includeTables: boolean }
): string[] {
  const content: string[] = [];

  // Header
  content.push(`# ${reportData.templateName}`);
  content.push('');
  content.push(`**Período:** ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}`);
  content.push(`**Generado:** ${formatDateTime(reportData.generatedAt)}`);
  content.push('');
  content.push('---');

  // Sections
  for (const section of reportData.sections) {
    content.push('');
    content.push(`## ${section.title}`);
    content.push('');

    switch (section.type) {
      case 'kpi_grid':
        content.push(formatKPISection(section.data as KPIValue[]));
        break;

      case 'chart':
        if (options.includeCharts) {
          content.push(formatChartSection(section.data as ChartData));
        }
        break;

      case 'table':
        if (options.includeTables) {
          content.push(formatTableSection(section.data as TableData));
        }
        break;
    }
  }

  // Footer
  content.push('');
  content.push('---');
  content.push('');
  content.push(`*Informe generado automáticamente por CampoTech Analytics*`);

  return content;
}

/**
 * Format KPI section for PDF
 */
function formatKPISection(kpis: KPIValue[]): string {
  const rows: string[] = [];

  for (const kpi of kpis) {
    const value = formatKPIValue(kpi);
    const trend = getTrendIndicator(kpi.trend);
    const change = kpi.changePercent ? ` (${kpi.changePercent > 0 ? '+' : ''}${kpi.changePercent.toFixed(1)}%)` : '';

    rows.push(`- **${kpi.name}:** ${value}${change} ${trend}`);
  }

  return rows.join('\n');
}

/**
 * Format chart section for PDF
 */
function formatChartSection(chartData: ChartData): string {
  // For PDF, we represent charts as a data summary
  // Actual chart rendering would require a chart library

  const rows: string[] = [];
  rows.push('| Período | ' + chartData.datasets.map(ds => ds.label).join(' | ') + ' |');
  rows.push('| --- | ' + chartData.datasets.map(() => '---').join(' | ') + ' |');

  for (let i = 0; i < chartData.labels.length; i++) {
    const values = chartData.datasets.map(ds => formatNumber(ds.data[i]));
    rows.push(`| ${chartData.labels[i]} | ${values.join(' | ')} |`);
  }

  return rows.join('\n');
}

/**
 * Format table section for PDF
 */
function formatTableSection(tableData: TableData): string {
  if (tableData.rows.length === 0) {
    return '*No hay datos disponibles*';
  }

  const rows: string[] = [];

  // Header row
  rows.push('| ' + tableData.columns.map(col => col.label).join(' | ') + ' |');
  rows.push('| ' + tableData.columns.map(() => '---').join(' | ') + ' |');

  // Data rows
  for (const row of tableData.rows) {
    const cells = tableData.columns.map(col => {
      const value = row[col.key];
      return formatCellValue(value, col.type);
    });
    rows.push('| ' + cells.join(' | ') + ' |');
  }

  // Totals row
  if (tableData.totals) {
    const totalCells = tableData.columns.map(col => {
      if (tableData.totals && col.key in tableData.totals) {
        return `**${formatCellValue(tableData.totals[col.key], col.type)}**`;
      }
      return col.key === tableData.columns[0].key ? '**Total**' : '';
    });
    rows.push('| ' + totalCells.join(' | ') + ' |');
  }

  return rows.join('\n');
}

/**
 * Generate HTML report (can be converted to PDF)
 */
function generateHTMLReport(reportData: ReportData, markdownContent: string[]): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportData.templateName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1 {
      color: #16a34a;
      border-bottom: 2px solid #16a34a;
      padding-bottom: 10px;
    }
    h2 {
      color: #374151;
      margin-top: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    .kpi-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
    }
    .kpi-label {
      font-size: 14px;
      color: #6b7280;
    }
    .trend-up { color: #22c55e; }
    .trend-down { color: #ef4444; }
    .trend-stable { color: #6b7280; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    @media print {
      body { max-width: 100%; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <h1>${reportData.templateName}</h1>
  <p>
    <strong>Período:</strong> ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}<br>
    <strong>Generado:</strong> ${formatDateTime(reportData.generatedAt)}
  </p>

  ${reportData.sections.map(section => renderHTMLSection(section)).join('\n')}

  <div class="footer">
    <p>Informe generado automáticamente por CampoTech Analytics</p>
    <p>Tiempo de generación: ${reportData.metadata.generationTimeMs}ms | Registros procesados: ${reportData.metadata.totalRecords}</p>
  </div>
</body>
</html>`;
}

/**
 * Render HTML section
 */
function renderHTMLSection(section: ReportSection): string {
  let content = `<h2>${section.title}</h2>`;

  switch (section.type) {
    case 'kpi_grid': {
      const kpis = section.data as KPIValue[];
      content += '<div class="kpi-grid">';
      for (const kpi of kpis) {
        const trendClass = kpi.trend === 'up' ? 'trend-up' : kpi.trend === 'down' ? 'trend-down' : 'trend-stable';
        content += `
          <div class="kpi-card">
            <div class="kpi-value">${formatKPIValue(kpi)}</div>
            <div class="kpi-label">${kpi.name}
              ${kpi.changePercent ? `<span class="${trendClass}">(${kpi.changePercent > 0 ? '+' : ''}${kpi.changePercent.toFixed(1)}%)</span>` : ''}
            </div>
          </div>`;
      }
      content += '</div>';
      break;
    }

    case 'table': {
      const tableData = section.data as TableData;
      if (tableData.rows.length === 0) {
        content += '<p><em>No hay datos disponibles</em></p>';
      } else {
        content += '<table>';
        content += '<thead><tr>';
        for (const col of tableData.columns) {
          content += `<th>${col.label}</th>`;
        }
        content += '</tr></thead>';
        content += '<tbody>';
        for (const row of tableData.rows) {
          content += '<tr>';
          for (const col of tableData.columns) {
            content += `<td>${formatCellValue(row[col.key], col.type)}</td>`;
          }
          content += '</tr>';
        }
        if (tableData.totals) {
          content += '<tr style="font-weight: bold;">';
          for (const col of tableData.columns) {
            if (tableData.totals[col.key] !== undefined) {
              content += `<td>${formatCellValue(tableData.totals[col.key], col.type)}</td>`;
            } else {
              content += `<td>${col.key === tableData.columns[0].key ? 'Total' : ''}</td>`;
            }
          }
          content += '</tr>';
        }
        content += '</tbody></table>';
      }
      break;
    }

    case 'chart': {
      const chartData = section.data as ChartData;
      // Render as table since HTML doesn't have native charts
      content += '<table>';
      content += '<thead><tr><th>Período</th>';
      for (const ds of chartData.datasets) {
        content += `<th>${ds.label}</th>`;
      }
      content += '</tr></thead>';
      content += '<tbody>';
      for (let i = 0; i < chartData.labels.length; i++) {
        content += '<tr>';
        content += `<td>${chartData.labels[i]}</td>`;
        for (const ds of chartData.datasets) {
          content += `<td>${formatNumber(ds.data[i])}</td>`;
        }
        content += '</tr>';
      }
      content += '</tbody></table>';
      break;
    }
  }

  return content;
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
      return formatNumber(kpi.value);
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

function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return '-';

  switch (type) {
    case 'currency':
      return formatCurrency(Number(value));
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return formatNumber(Number(value));
    case 'date':
      return formatDate(new Date(value as string));
    default:
      return String(value);
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(Math.round(value));
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

function getTrendIndicator(trend?: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    default:
      return '→';
  }
}
