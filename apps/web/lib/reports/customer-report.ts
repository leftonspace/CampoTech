/**
 * Customer Report PDF Generator
 * ==============================
 * 
 * Phase 3: Task 3.4
 * 
 * Generates comprehensive PDF documentation for customers,
 * including all job history, invoices, and service records.
 * 
 * This is for customer data exports, insurance documentation,
 * and ARCO compliance (Ley 25.326 data access requests).
 */

import { getCustomerFolderData, CustomerFolderData, CustomerFolderJob } from '@/lib/services/customer-folder';
import { formatDate, formatDateTime, formatCurrency, formatPhone } from '@/lib/utils';
import { prisma } from '@/lib/prisma';

// =============================================================================
// TYPES
// =============================================================================

export interface CustomerReportOptions {
    customerId: string;
    organizationId: string;
    includeJobs?: boolean;
    includeInvoices?: boolean;
    includePayments?: boolean;
    includePhotos?: boolean;
}

// =============================================================================
// LABEL MAPPINGS
// =============================================================================

const SERVICE_TYPE_LABELS: Record<string, string> = {
    INSTALACION_SPLIT: 'Instalación Split',
    REPARACION_SPLIT: 'Reparación Split',
    MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
    INSTALACION_CALEFACTOR: 'Instalación Calefactor',
    REPARACION_CALEFACTOR: 'Reparación Calefactor',
    MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
    OTRO: 'Otro',
};

const JOB_STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    SCHEDULED: 'Programado',
    IN_PROGRESS: 'En Progreso',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
    FACTURA_A: 'Factura A',
    FACTURA_B: 'Factura B',
    FACTURA_C: 'Factura C',
    PRESUPUESTO: 'Presupuesto',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
    MERCADOPAGO: 'MercadoPago',
    CHECK: 'Cheque',
};

const IVA_CONDITION_LABELS: Record<string, string> = {
    CONSUMIDOR_FINAL: 'Consumidor Final',
    RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
    MONOTRIBUTISTA: 'Monotributista',
    EXENTO: 'Exento',
};

// =============================================================================
// HTML GENERATION
// =============================================================================

function getServiceTypeLabel(serviceType: string, serviceTypeCode: string | null): string {
    if (serviceType === 'OTRO' && serviceTypeCode) {
        return serviceTypeCode.replace(/_/g, ' ');
    }
    return SERVICE_TYPE_LABELS[serviceType] || serviceType.replace(/_/g, ' ');
}

function generateJobCard(job: CustomerFolderJob): string {
    const tripDistance = job.mileageStart && job.mileageEnd
        ? job.mileageEnd - job.mileageStart
        : null;

    return `
    <div class="job-card ${job.status === 'COMPLETED' ? 'completed' : ''}">
      <div class="job-header">
        <div class="job-meta">
          <span class="job-number">${job.jobNumber}</span>
          <span class="job-status ${job.status.toLowerCase()}">${JOB_STATUS_LABELS[job.status] || job.status}</span>
        </div>
        <div class="job-date">${job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha'}</div>
      </div>
      
      <div class="job-title">${getServiceTypeLabel(job.serviceType, job.serviceTypeCode)}</div>
      
      ${job.description ? `<div class="job-desc">${job.description.split('\n\n')[0]}</div>` : ''}
      
      <div class="job-details">
        ${job.technicianName ? `
          <div class="detail-row">
            <span class="detail-label">👷 Técnico:</span>
            <span class="detail-value">${job.technicianName}</span>
          </div>
        ` : ''}
        
        ${job.vehiclePlate ? `
          <div class="detail-row">
            <span class="detail-label">🚐 Vehículo:</span>
            <span class="detail-value">${job.vehiclePlate}${job.vehicleInfo ? ` (${job.vehicleInfo})` : ''}</span>
          </div>
        ` : ''}
        
        ${tripDistance !== null ? `
          <div class="detail-row">
            <span class="detail-label">📍 Recorrido:</span>
            <span class="detail-value">${job.mileageStart?.toLocaleString()} → ${job.mileageEnd?.toLocaleString()} km (${tripDistance} km)</span>
          </div>
        ` : ''}
        
        ${job.visitsCount > 1 ? `
          <div class="detail-row">
            <span class="detail-label">📅 Visitas:</span>
            <span class="detail-value">${job.visitsCompleted} de ${job.visitsCount} completadas</span>
          </div>
        ` : ''}
      </div>
      
      <div class="job-footer">
        <div class="job-indicators">
          ${job.photos.length > 0 ? `<span class="indicator">📸 ${job.photos.length} fotos</span>` : ''}
          ${job.hasSignature ? '<span class="indicator">✍️ Firmado</span>' : ''}
        </div>
        
        ${job.finalTotal ? `
          <div class="job-total">
            <span class="total-label">Total:</span>
            <span class="total-value">${formatCurrency(job.finalTotal)}</span>
          </div>
        ` : ''}
      </div>
      
      ${job.resolution ? `
        <div class="job-resolution">
          <strong>Resolución:</strong> ${job.resolution}
        </div>
      ` : ''}
    </div>
  `;
}

export function generateCustomerReportHTML(
    data: CustomerFolderData,
    organization: { name: string; phone: string | null; logo: string | null; cuit: string | null },
    options: { includeJobs?: boolean; includeInvoices?: boolean; includePayments?: boolean } = {}
): string {
    const { customer, summary, jobs, invoices, payments } = data;
    const { includeJobs = true, includeInvoices = true, includePayments = true } = options;

    const now = new Date();
    const generatedAt = formatDateTime(now);
    const documentId = `folder_${customer.id.slice(0, 8)}_${now.getTime()}`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Carpeta de Cliente - ${customer.name}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: #1f2937;
      line-height: 1.5;
      background: #fff;
    }
    
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 15px;
      border-bottom: 2px solid #0d9488;
      margin-bottom: 20px;
    }
    
    .org-info {
      flex: 1;
    }
    
    .org-logo {
      max-width: 120px;
      max-height: 50px;
      margin-bottom: 8px;
    }
    
    .org-name {
      font-size: 16px;
      font-weight: 700;
      color: #0d9488;
      margin-bottom: 4px;
    }
    
    .org-contact {
      color: #6b7280;
      font-size: 10px;
    }
    
    .report-title-section {
      text-align: right;
    }
    
    .report-title {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .report-subtitle {
      font-size: 10px;
      color: #6b7280;
    }
    
    /* Customer Info */
    .customer-section {
      background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .customer-name {
      font-size: 18px;
      font-weight: 700;
      color: #0d9488;
      margin-bottom: 4px;
    }
    
    .customer-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    
    .customer-detail {
      font-size: 11px;
    }
    
    .customer-detail strong {
      color: #374151;
    }
    
    .vip-badge {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 600;
      margin-left: 8px;
    }
    
    /* Summary Cards */
    .summary-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .summary-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    
    .summary-value {
      font-size: 20px;
      font-weight: 700;
      color: #0d9488;
    }
    
    .summary-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Sections */
    .section {
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Job Cards */
    .job-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      background: #fff;
    }
    
    .job-card.completed {
      border-left: 3px solid #10b981;
    }
    
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .job-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .job-number {
      font-weight: 600;
      color: #374151;
    }
    
    .job-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .job-status.completed { background: #d1fae5; color: #065f46; }
    .job-status.pending { background: #fef3c7; color: #92400e; }
    .job-status.in_progress { background: #dbeafe; color: #1e40af; }
    .job-status.cancelled { background: #fee2e2; color: #991b1b; }
    
    .job-date {
      font-size: 10px;
      color: #6b7280;
    }
    
    .job-title {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .job-desc {
      font-size: 10px;
      color: #4b5563;
      margin-bottom: 8px;
    }
    
    .job-details {
      background: #f9fafb;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
    }
    
    .detail-row {
      display: flex;
      gap: 8px;
      font-size: 10px;
      margin-bottom: 4px;
    }
    
    .detail-row:last-child { margin-bottom: 0; }
    
    .detail-label {
      color: #6b7280;
      min-width: 80px;
    }
    
    .detail-value {
      color: #1f2937;
    }
    
    .job-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .job-indicators {
      display: flex;
      gap: 8px;
    }
    
    .indicator {
      font-size: 9px;
      color: #6b7280;
    }
    
    .job-total {
      text-align: right;
    }
    
    .total-label {
      font-size: 10px;
      color: #6b7280;
    }
    
    .total-value {
      font-size: 12px;
      font-weight: 600;
      color: #0d9488;
    }
    
    .job-resolution {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 8px;
      font-size: 10px;
      margin-top: 8px;
    }
    
    /* Invoice Table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    .data-table th {
      background: #f3f4f6;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #d1d5db;
    }
    
    .data-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .data-table .text-right { text-align: right; }
    .data-table .text-center { text-align: center; }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #9ca3af;
    }
    
    .footer-disclaimer {
      text-align: center;
      margin-bottom: 8px;
      font-style: italic;
    }
    
    .footer-meta {
      display: flex;
      justify-content: space-between;
    }
    
    @media print {
      .page { padding: 10mm; }
      .job-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="org-info">
        ${organization.logo ? `<img src="${organization.logo}" alt="Logo" class="org-logo" />` : ''}
        <div class="org-name">${organization.name}</div>
        <div class="org-contact">
          ${organization.phone ? formatPhone(organization.phone) : ''}
          ${organization.cuit ? `<br>CUIT: ${organization.cuit}` : ''}
        </div>
      </div>
      <div class="report-title-section">
        <div class="report-title">📁 Carpeta de Cliente</div>
        <div class="report-subtitle">Documentación Completa</div>
      </div>
    </div>

    <!-- Customer Info -->
    <div class="customer-section">
      <div class="customer-name">
        ${customer.name}
        ${customer.isVip ? '<span class="vip-badge">⭐ VIP</span>' : ''}
      </div>
      <div class="customer-details">
        <div class="customer-detail"><strong>📞 Teléfono:</strong> ${formatPhone(customer.phone)}</div>
        ${customer.email ? `<div class="customer-detail"><strong>📧 Email:</strong> ${customer.email}</div>` : ''}
        ${customer.address ? `<div class="customer-detail"><strong>📍 Dirección:</strong> ${customer.address}</div>` : ''}
        ${customer.cuit ? `<div class="customer-detail"><strong>🔢 CUIT:</strong> ${customer.cuit}</div>` : ''}
        ${customer.ivaCondition ? `<div class="customer-detail"><strong>💼 IVA:</strong> ${IVA_CONDITION_LABELS[customer.ivaCondition] || customer.ivaCondition}</div>` : ''}
        <div class="customer-detail"><strong>📅 Cliente desde:</strong> ${formatDate(customer.createdAt)}</div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="summary-section">
      <div class="summary-card">
        <div class="summary-value">${summary.totalJobs}</div>
        <div class="summary-label">Total Trabajos</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.completedJobs}</div>
        <div class="summary-label">Completados</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${formatCurrency(summary.totalInvoiced)}</div>
        <div class="summary-label">Facturado</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.averageRating ? `⭐ ${summary.averageRating.toFixed(1)}` : '-'}</div>
        <div class="summary-label">Rating Prom.</div>
      </div>
    </div>

    ${includeJobs && jobs.length > 0 ? `
      <!-- Job History -->
      <div class="section">
        <div class="section-title">🔧 Historial de Trabajos (${jobs.length})</div>
        ${jobs.map(job => generateJobCard(job)).join('')}
      </div>
    ` : ''}

    ${includeInvoices && invoices.length > 0 ? `
      <!-- Invoices -->
      <div class="section">
        <div class="section-title">📄 Facturas (${invoices.length})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th class="text-right">Subtotal</th>
              <th class="text-right">IVA</th>
              <th class="text-right">Total</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr>
                <td>${inv.invoiceNumber}</td>
                <td>${INVOICE_TYPE_LABELS[inv.type] || inv.type}</td>
                <td>${inv.issuedAt ? formatDate(inv.issuedAt) : '-'}</td>
                <td class="text-right">${formatCurrency(inv.subtotal)}</td>
                <td class="text-right">${formatCurrency(inv.taxAmount)}</td>
                <td class="text-right"><strong>${formatCurrency(inv.total)}</strong></td>
                <td class="text-center">${inv.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${includePayments && payments.length > 0 ? `
      <!-- Payments -->
      <div class="section">
        <div class="section-title">💳 Pagos Recibidos (${payments.length})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Método</th>
              <th>Fecha</th>
              <th>Referencia</th>
              <th class="text-right">Monto</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(payment => `
              <tr>
                <td>${payment.invoiceNumber}</td>
                <td>${PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                <td>${payment.paidAt ? formatDate(payment.paidAt) : '-'}</td>
                <td>${payment.reference || '-'}</td>
                <td class="text-right"><strong>${formatCurrency(payment.amount)}</strong></td>
                <td class="text-center">${payment.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-disclaimer">
        Documento generado por CampoTech<br>
        Registros para uso operativo interno - No constituye documentación certificada<br>
        Para reclamos de seguro, adjuntar documentación oficial adicional
      </div>
      <div class="footer-meta">
        <span>Generado: ${generatedAt} (America/Argentina/Buenos_Aires)</span>
        <span>Organización: ${organization.name}${organization.cuit ? ` (CUIT: ${organization.cuit})` : ''}</span>
        <span>ID: ${documentId}</span>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// =============================================================================
// PDF GENERATION
// =============================================================================

/**
 * Generate PDF buffer from HTML using Puppeteer
 */
export async function generateCustomerReportPDF(
    data: CustomerFolderData,
    organization: { name: string; phone: string | null; logo: string | null; cuit: string | null },
    options: { includeJobs?: boolean; includeInvoices?: boolean; includePayments?: boolean } = {}
): Promise<Buffer> {
    const html = generateCustomerReportHTML(data, organization, options);

    // Dynamic import to avoid server-side bundling issues
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm',
            },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Generate complete customer folder report
 */
export async function generateCustomerFolderReport(
    options: CustomerReportOptions
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { customerId, organizationId, includeJobs = true, includeInvoices = true, includePayments = true } = options;

    // Fetch customer folder data
    const folderData = await getCustomerFolderData(customerId, organizationId);
    if (!folderData) {
        throw new Error('Customer not found');
    }

    // Fetch organization data
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, phone: true, logo: true, afipCuit: true }
    });

    if (!org) {
        throw new Error('Organization not found');
    }

    const organization = {
        name: org.name,
        phone: org.phone,
        logo: org.logo,
        cuit: org.afipCuit
    };

    // Generate PDF
    const buffer = await generateCustomerReportPDF(folderData, organization, {
        includeJobs,
        includeInvoices,
        includePayments
    });

    // Generate filename
    const sanitizedName = folderData.customer.name
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Carpeta_${sanitizedName}_${dateStr}.pdf`;

    return {
        buffer,
        filename,
        contentType: 'application/pdf'
    };
}
