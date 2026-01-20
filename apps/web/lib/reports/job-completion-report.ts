/**
 * Job Completion Report PDF Generator
 * ====================================
 * 
 * Phase 2: Job Completion Report Implementation
 * 
 * Generates operational PDF documentation for completed jobs,
 * including work details, technician/vehicle snapshots, photos,
 * and customer signatures.
 * 
 * This is SEPARATE from invoices - invoices are for AFIP/billing,
 * this report is for operational documentation.
 */

import { prisma } from '@/lib/prisma';
import { formatDate, formatDateTime, formatAddress, formatPhone, formatCurrency } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface JobReportData {
    job: {
        id: string;
        jobNumber: string;
        serviceType: string;
        serviceTypeCode: string | null;
        description: string | null;
        status: string;
        scheduledDate: Date | null;
        startedAt: Date | null;
        completedAt: Date | null;
        resolution: string | null;
        photos: string[];
        customerSignature: string | null;
        estimatedDuration: number | null;
        actualDuration: number | null;
        address: string | null;
        // Pricing
        estimatedTotal: number | null;
        finalTotal: number | null;
        depositAmount: number | null;
        // Vehicle snapshot
        vehiclePlateAtJob: string | null;
        driverNameAtJob: string | null;
        driverLicenseAtJob: string | null;
        vehicleMileageStart: number | null;
        vehicleMileageEnd: number | null;
        // Per-visit pricing mode (Phase 1 - Jan 2026)
        pricingMode: string | null;
    };
    customer: {
        name: string;
        phone: string;
        email: string | null;
        address: string;
    };
    technician: {
        name: string;
        phone: string | null;
        specialty: string | null;
        driverLicenseNumber: string | null;
        driverLicenseCategory: string | null;
    } | null;
    vehicle: {
        make: string | null;
        model: string | null;
        plateNumber: string | null;
    } | null;
    organization: {
        name: string;
        phone: string | null;
        logo: string | null;
        address: string | null;
    };
    visits: Array<{
        visitNumber: number;
        scheduledDate: Date;
        status: string;
        startedAt: Date | null;
        completedAt: Date | null;
        technician: { name: string } | null;
        vehicleAssignments: Array<{
            vehicle: { make: string | null; model: string | null; plateNumber: string | null };
            vehiclePlateSnapshot: string | null;
            drivers: Array<{
                driverNameSnapshot: string | null;
                driverLicenseSnapshot: string | null;
                user: { name: string };
            }>;
        }>;
        // Per-visit pricing (Phase 1 - Jan 2026)
        estimatedPrice: number | null;
        actualPrice: number | null;
        priceVarianceReason: string | null;
    }>;
    lineItems: Array<{
        description: string;
        quantity: number;
        unit: string;
        unitPrice: number;
        total: number;
    }>;
}

export interface GenerateReportOptions {
    jobId: string;
    organizationId: string;
    visitId?: string; // For per-visit reports
    includePhotos?: boolean;
    includeSignature?: boolean;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch all data needed for the job completion report
 */
export async function fetchJobReportData(
    jobId: string,
    organizationId: string
): Promise<JobReportData | null> {
    const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId },
        include: {
            customer: {
                select: {
                    name: true,
                    phone: true,
                    email: true,
                    address: true,
                },
            },
            technician: {
                select: {
                    name: true,
                    phone: true,
                    specialty: true,
                    driverLicenseNumber: true,
                    driverLicenseCategory: true,
                },
            },
            vehicle: {
                select: {
                    make: true,
                    model: true,
                    plateNumber: true,
                },
            },
            organization: {
                select: {
                    name: true,
                    phone: true,
                    logo: true,
                    // Note: address may be stored in settings
                },
            },
            visits: {
                orderBy: { visitNumber: 'asc' },
                include: {
                    technician: {
                        select: { name: true },
                    },
                    vehicleAssignments: {
                        include: {
                            vehicle: {
                                select: {
                                    make: true,
                                    model: true,
                                    plateNumber: true,
                                },
                            },
                            drivers: {
                                include: {
                                    user: {
                                        select: { name: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            lineItems: {
                select: {
                    description: true,
                    quantity: true,
                    unit: true,
                    unitPrice: true,
                    total: true,
                },
            },
        },
    });

    if (!job) return null;

    // Transform Prisma types to our interface
    return {
        job: {
            id: job.id,
            jobNumber: job.jobNumber,
            serviceType: job.serviceType,
            serviceTypeCode: job.serviceTypeCode,
            description: job.description,
            status: job.status,
            scheduledDate: job.scheduledDate,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            resolution: job.resolution,
            photos: job.photos || [],
            customerSignature: job.customerSignature,
            estimatedDuration: job.estimatedDuration,
            actualDuration: job.actualDuration,
            address: typeof job.customer.address === 'string'
                ? job.customer.address
                : formatAddress(job.customer.address),
            // Pricing - convert Decimal to number
            estimatedTotal: job.estimatedTotal ? Number(job.estimatedTotal) : null,
            finalTotal: job.finalTotal ? Number(job.finalTotal) : null,
            depositAmount: job.depositAmount ? Number(job.depositAmount) : null,
            // Vehicle snapshot
            vehiclePlateAtJob: job.vehiclePlateAtJob,
            driverNameAtJob: job.driverNameAtJob,
            driverLicenseAtJob: job.driverLicenseAtJob,
            vehicleMileageStart: job.vehicleMileageStart,
            vehicleMileageEnd: job.vehicleMileageEnd,
            // Per-visit pricing mode (Phase 1 - Jan 2026)
            pricingMode: job.pricingMode || null,
        },
        customer: {
            name: job.customer.name,
            phone: job.customer.phone,
            email: job.customer.email,
            address: typeof job.customer.address === 'string'
                ? job.customer.address
                : formatAddress(job.customer.address) || '',
        },
        technician: job.technician,
        vehicle: job.vehicle,
        organization: {
            name: job.organization.name,
            phone: job.organization.phone,
            logo: job.organization.logo,
            address: null, // Can be extended to fetch from settings
        },
        visits: job.visits.map((visit: typeof job.visits[number]) => ({
            visitNumber: visit.visitNumber,
            scheduledDate: visit.scheduledDate,
            status: visit.status,
            startedAt: visit.startedAt,
            completedAt: visit.completedAt,
            technician: visit.technician,
            vehicleAssignments: visit.vehicleAssignments.map((va: typeof visit.vehicleAssignments[number]) => ({
                vehicle: va.vehicle,
                vehiclePlateSnapshot: va.vehiclePlateSnapshot,
                drivers: va.drivers.map((d: typeof va.drivers[number]) => ({
                    driverNameSnapshot: d.driverNameSnapshot,
                    driverLicenseSnapshot: d.driverLicenseSnapshot,
                    user: d.user,
                })),
            })),
            // Per-visit pricing (Phase 1 - Jan 2026)
            estimatedPrice: visit.estimatedPrice ? Number(visit.estimatedPrice) : null,
            actualPrice: visit.actualPrice ? Number(visit.actualPrice) : null,
            priceVarianceReason: visit.priceVarianceReason || null,
        })),
        lineItems: job.lineItems.map((item: typeof job.lineItems[number]) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            total: Number(item.total),
        })),
    };
}

// =============================================================================
// HTML TEMPLATE GENERATION
// =============================================================================

/**
 * Parse job title and description from combined description field
 */
function parseJobText(description: string | null): { title: string; desc: string | null } {
    if (!description) return { title: 'Sin título', desc: null };

    const separatorIndex = description.indexOf('\n\n');
    if (separatorIndex > 0) {
        return {
            title: description.substring(0, separatorIndex).trim(),
            desc: description.substring(separatorIndex + 2).trim() || null,
        };
    }
    return { title: description.trim(), desc: null };
}

/**
 * Get service type display label
 */
function getServiceTypeLabel(serviceType: string, serviceTypeCode: string | null): string {
    const labels: Record<string, string> = {
        INSTALACION_SPLIT: 'Instalación Split',
        REPARACION_SPLIT: 'Reparación Split',
        MANTENIMIENTO_SPLIT: 'Mantenimiento Split',
        INSTALACION_CALEFACTOR: 'Instalación Calefactor',
        REPARACION_CALEFACTOR: 'Reparación Calefactor',
        MANTENIMIENTO_CALEFACTOR: 'Mantenimiento Calefactor',
        OTRO: serviceTypeCode || 'Otro',
    };
    return labels[serviceType] || serviceType.replace(/_/g, ' ');
}

/**
 * Calculate job duration in human-readable format
 */
function formatDuration(minutes: number | null): string {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
}

/**
 * Generate HTML content for the job completion report
 */
export function generateReportHTML(data: JobReportData, options: { includePhotos?: boolean; includeSignature?: boolean } = {}): string {
    const { job, customer, technician, vehicle, organization, visits, lineItems } = data;
    const { includePhotos = true, includeSignature = true } = options;

    const { title: jobTitle, desc: jobDesc } = parseJobText(job.description);
    const serviceLabel = getServiceTypeLabel(job.serviceType, job.serviceTypeCode);

    // Calculate trip distance
    const tripDistance = job.vehicleMileageStart && job.vehicleMileageEnd
        ? job.vehicleMileageEnd - job.vehicleMileageStart
        : null;

    // Format scheduled time
    const scheduledDateStr = job.scheduledDate ? formatDate(job.scheduledDate) : 'Sin fecha';
    const completedDateStr = job.completedAt ? formatDateTime(job.completedAt) : '-';

    // Line items HTML
    const lineItemsHTML = lineItems.length > 0 ? `
    <div class="section">
      <div class="section-title">📦 Detalle de Trabajos Realizados</div>
      <table class="items-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th style="text-align: center">Cantidad</th>
            <th style="text-align: center">Unidad</th>
            <th style="text-align: right">Precio Unit.</th>
            <th style="text-align: right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => `
            <tr>
              <td>${item.description}</td>
              <td style="text-align: center">${item.quantity}</td>
              <td style="text-align: center">${item.unit}</td>
              <td style="text-align: right">${formatCurrency(item.unitPrice)}</td>
              <td style="text-align: right">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

    // Photos HTML
    const photosHTML = includePhotos && job.photos.length > 0 ? `
    <div class="section">
      <div class="section-title">📷 Evidencia Fotográfica</div>
      <div class="photos-grid">
        ${job.photos.slice(0, 6).map((photo, index) => `
          <div class="photo-item">
            <img src="${photo}" alt="Foto ${index + 1}" />
            <span class="photo-label">Foto ${index + 1}</span>
          </div>
        `).join('')}
      </div>
      ${job.photos.length > 6 ? `<p class="text-muted">+${job.photos.length - 6} fotos adicionales disponibles en el sistema</p>` : ''}
    </div>
  ` : '';

    // Signature HTML
    const signatureHTML = includeSignature && job.customerSignature ? `
    <div class="section signature-section">
      <div class="section-title">✍️ Conformidad del Cliente</div>
      <div class="signature-box">
        <img src="${job.customerSignature}" alt="Firma del cliente" class="signature-image" />
        <p class="signature-label">Firma: ${customer.name}</p>
        <p class="signature-date">Fecha: ${completedDateStr}</p>
      </div>
      <p class="confirmation-text">✓ El cliente confirma recepción del servicio realizado</p>
    </div>
  ` : '';

    // Multi-visit section
    const visitsHTML = visits.length > 1 ? `
    <div class="section">
      <div class="section-title">📅 Detalle de Visitas (${visits.length} visitas)</div>
      ${visits.map(visit => `
        <div class="visit-card ${visit.status === 'COMPLETED' ? 'completed' : ''}">
          <div class="visit-header">
            <span class="visit-number">Visita #${visit.visitNumber}</span>
            <span class="visit-status ${visit.status.toLowerCase()}">${visit.status === 'COMPLETED' ? '✓ Completada' : visit.status}</span>
          </div>
          <div class="visit-details">
            <p><strong>Fecha:</strong> ${formatDate(visit.scheduledDate)}</p>
            ${visit.technician ? `<p><strong>Técnico:</strong> ${visit.technician.name}</p>` : ''}
            ${visit.completedAt ? `<p><strong>Finalizada:</strong> ${formatDateTime(visit.completedAt)}</p>` : ''}
          </div>
          ${visit.vehicleAssignments.length > 0 ? `
            <div class="visit-vehicles">
              <p class="vehicles-label">Vehículos utilizados:</p>
              ${visit.vehicleAssignments.map(va => `
                <div class="vehicle-item">
                  <span>🚐 ${va.vehiclePlateSnapshot || va.vehicle.plateNumber || 'Sin patente'}</span>
                  <span class="vehicle-model">${va.vehicle.make} ${va.vehicle.model}</span>
                  ${va.drivers.length > 0 ? `
                    <span class="drivers">
                      Conductores: ${va.drivers.map(d => d.driverNameSnapshot || d.user.name).join(', ')}
                    </span>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

    // Per-visit pricing breakdown (Phase 1 - Jan 2026)
    const perVisitPricingHTML = job.pricingMode && job.pricingMode !== 'FIXED_TOTAL' && visits.length > 0 ? (() => {
        const totalEstimated = visits.reduce((sum, v) => sum + (v.estimatedPrice || 0), 0);
        const totalActual = visits.reduce((sum, v) => sum + (v.actualPrice || 0), 0);
        const hasActualPrices = visits.some(v => v.actualPrice !== null);

        const getStatusLabel = (status: string) => {
            const labels: Record<string, string> = {
                'SCHEDULED': 'Programada',
                'EN_CAMINO': 'En camino',
                'WORKING': 'En progreso',
                'COMPLETED': 'Completada',
                'CANCELLED': 'Cancelada',
            };
            return labels[status] || status;
        };

        return `
    <div class="section">
      <div class="section-title">💵 Desglose de Precios por Visita</div>
      <table class="visits-pricing-table">
        <thead>
          <tr>
            <th>Visita</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th style="text-align: right">Estimado</th>
            ${hasActualPrices ? '<th style="text-align: right">Real</th>' : ''}
            ${hasActualPrices ? '<th style="text-align: right">Variación</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${visits.map((v, i) => {
            const variance = v.estimatedPrice && v.actualPrice
                ? ((v.actualPrice - v.estimatedPrice) / v.estimatedPrice * 100).toFixed(1)
                : null;
            const varianceClass = variance
                ? (parseFloat(variance) > 10 ? 'variance-high' : parseFloat(variance) > 0 ? 'variance-up' : 'variance-down')
                : '';
            return `
            <tr class="${v.status === 'COMPLETED' ? 'row-completed' : ''}">
              <td>${job.pricingMode === 'HYBRID' && i === 0 ? `${i + 1} (Diagnóstico)` : i + 1}</td>
              <td>${formatDate(v.scheduledDate)}</td>
              <td><span class="status-chip ${v.status.toLowerCase()}">${getStatusLabel(v.status)}</span></td>
              <td style="text-align: right">${v.estimatedPrice ? formatCurrency(v.estimatedPrice) : '-'}</td>
              ${hasActualPrices ? `<td style="text-align: right">${v.actualPrice ? formatCurrency(v.actualPrice) : '-'}</td>` : ''}
              ${hasActualPrices ? `
                <td style="text-align: right">
                  ${variance ? `<span class="${varianceClass}">${parseFloat(variance) > 0 ? '+' : ''}${variance}%</span>` : '-'}
                  ${v.priceVarianceReason ? `<br/><span class="variance-reason">${v.priceVarianceReason}</span>` : ''}
                </td>
              ` : ''}
            </tr>
          `;
        }).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="3"><strong>Total</strong></td>
            <td style="text-align: right"><strong>${formatCurrency(totalEstimated)}</strong></td>
            ${hasActualPrices ? `<td style="text-align: right"><strong>${formatCurrency(totalActual)}</strong></td>` : ''}
            ${hasActualPrices ? '<td></td>' : ''}
          </tr>
        </tfoot>
      </table>
    </div>
  `;
    })() : '';

    // Pricing summary
    const pricingHTML = (job.estimatedTotal || job.finalTotal) ? `
    <div class="section pricing-section">
      <div class="section-title">💰 Resumen Financiero</div>
      <div class="pricing-grid">
        ${job.estimatedTotal ? `
          <div class="pricing-row">
            <span>Total Estimado:</span>
            <span class="price">${formatCurrency(job.estimatedTotal)}</span>
          </div>
        ` : ''}
        ${job.depositAmount ? `
          <div class="pricing-row">
            <span>Seña Recibida:</span>
            <span class="price deposit">- ${formatCurrency(job.depositAmount)}</span>
          </div>
        ` : ''}
        ${job.finalTotal ? `
          <div class="pricing-row final">
            <span>Total Final:</span>
            <span class="price">${formatCurrency(job.finalTotal)}</span>
          </div>
        ` : ''}
        ${job.finalTotal && job.depositAmount ? `
          <div class="pricing-row balance">
            <span>Saldo Pendiente:</span>
            <span class="price">${formatCurrency(job.finalTotal - job.depositAmount)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte de Trabajo - ${job.jobNumber}</title>
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
      font-size: 18px;
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
      margin-bottom: 4px;
    }
    
    .job-number {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .report-date {
      font-size: 10px;
      color: #9ca3af;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      margin-top: 8px;
    }
    
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    
    /* Sections */
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 12px;
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    .info-block {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
    }
    
    .info-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 11px;
      color: #1f2937;
    }
    
    .info-value.large {
      font-size: 13px;
      font-weight: 600;
    }
    
    /* Service Info */
    .service-info {
      background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .service-type {
      font-size: 14px;
      font-weight: 700;
      color: #0d9488;
      margin-bottom: 4px;
    }
    
    .service-title {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .service-desc {
      font-size: 11px;
      color: #4b5563;
    }
    
    /* Vehicle & Driver Section */
    .vehicle-section {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px;
    }
    
    .vehicle-title {
      font-size: 11px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .snapshot-notice {
      font-size: 9px;
      color: #6b7280;
      font-style: italic;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    .items-table th {
      background: #f3f4f6;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #d1d5db;
    }
    
    .items-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    /* Photos Grid */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .photo-item {
      text-align: center;
    }
    
    .photo-item img {
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .photo-label {
      font-size: 9px;
      color: #6b7280;
      margin-top: 4px;
      display: block;
    }
    
    /* Signature */
    .signature-section {
      border: 2px solid #d1fae5;
      border-radius: 8px;
      padding: 15px;
      background: #f0fdf4;
    }
    
    .signature-box {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 6px;
      border: 1px dashed #9ca3af;
      margin-bottom: 10px;
    }
    
    .signature-image {
      max-width: 200px;
      max-height: 60px;
    }
    
    .signature-label {
      font-size: 11px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    .signature-date {
      font-size: 10px;
      color: #6b7280;
    }
    
    .confirmation-text {
      text-align: center;
      color: #065f46;
      font-weight: 500;
      font-size: 11px;
    }
    
    /* Pricing */
    .pricing-section {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 8px;
      padding: 15px;
    }
    
    .pricing-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .pricing-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    
    .pricing-row.final {
      border-top: 1px solid #fde047;
      padding-top: 8px;
      font-weight: 700;
      font-size: 13px;
    }
    
    .pricing-row.balance {
      color: #0d9488;
      font-weight: 600;
    }
    
    .price.deposit {
      color: #059669;
    }
    
    /* Visits */
    .visit-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }
    
    .visit-card.completed {
      border-left: 3px solid #10b981;
    }
    
    .visit-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .visit-number {
      font-weight: 600;
    }
    
    .visit-status {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 9999px;
    }
    
    .visit-status.completed {
      background: #d1fae5;
      color: #065f46;
    }
    
    .visit-details p {
      font-size: 10px;
      margin: 2px 0;
    }
    
    .visit-vehicles {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #e5e7eb;
    }
    
    .vehicles-label {
      font-size: 9px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 4px;
    }
    
    .vehicle-item {
      font-size: 10px;
      padding: 4px 0;
    }
    
    .vehicle-model {
      color: #6b7280;
      margin-left: 8px;
    }
    
    .drivers {
      display: block;
      font-size: 9px;
      color: #6b7280;
      margin-left: 20px;
    }
    
    /* Per-visit pricing table (Phase 1 - Jan 2026) */
    .visits-pricing-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 10px;
    }
    
    .visits-pricing-table th {
      background: #f0fdf4;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #10b981;
      color: #065f46;
    }
    
    .visits-pricing-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .visits-pricing-table .row-completed {
      background: #f0fdf4;
    }
    
    .visits-pricing-table .total-row {
      background: #ecfdf5;
      font-weight: 600;
    }
    
    .visits-pricing-table .total-row td {
      border-top: 2px solid #10b981;
      border-bottom: none;
    }
    
    .status-chip {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 500;
    }
    
    .status-chip.completed {
      background: #d1fae5;
      color: #065f46;
    }
    
    .status-chip.scheduled {
      background: #e0e7ff;
      color: #3730a3;
    }
    
    .status-chip.en_camino {
      background: #fef3c7;
      color: #92400e;
    }
    
    .status-chip.working {
      background: #dbeafe;
      color: #1e40af;
    }
    
    .variance-up {
      color: #f59e0b;
      font-weight: 600;
    }
    
    .variance-down {
      color: #10b981;
      font-weight: 600;
    }
    
    .variance-high {
      color: #ef4444;
      font-weight: 700;
      background: #fef2f2;
      padding: 2px 4px;
      border-radius: 4px;
    }
    
    .variance-reason {
      font-size: 8px;
      color: #6b7280;
      font-style: italic;
    }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 9px;
    }
    
    .footer-notice {
      margin-bottom: 4px;
    }
    
    .text-muted {
      color: #6b7280;
      font-size: 10px;
      font-style: italic;
    }
    
    /* Print styles */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .page {
        padding: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="org-info">
        ${organization.logo ? `<img src="${organization.logo}" class="org-logo" alt="Logo" />` : ''}
        <div class="org-name">${organization.name}</div>
        ${organization.phone ? `<div class="org-contact">Tel: ${formatPhone(organization.phone)}</div>` : ''}
      </div>
      <div class="report-title-section">
        <div class="report-title">REPORTE DE TRABAJO</div>
        <div class="job-number">#${job.jobNumber}</div>
        <div class="report-date">Generado: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</div>
        <span class="status-badge ${job.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}">
          ${job.status === 'COMPLETED' ? '✓ COMPLETADO' : job.status}
        </span>
      </div>
    </div>
    
    <!-- Service Info -->
    <div class="service-info">
      <div class="service-type">${serviceLabel}</div>
      <div class="service-title">${jobTitle}</div>
      ${jobDesc ? `<div class="service-desc">${jobDesc}</div>` : ''}
    </div>
    
    <!-- Customer & Schedule Grid -->
    <div class="section">
      <div class="section-title">📋 Información General</div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Cliente</div>
          <div class="info-value large">${customer.name}</div>
          <div class="info-value">${formatPhone(customer.phone)}</div>
          ${customer.email ? `<div class="info-value">${customer.email}</div>` : ''}
          <div class="info-value" style="margin-top: 4px">${job.address || customer.address}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Programación</div>
          <div class="info-value"><strong>Fecha:</strong> ${scheduledDateStr}</div>
          ${job.startedAt ? `<div class="info-value"><strong>Inicio:</strong> ${formatDateTime(job.startedAt)}</div>` : ''}
          ${job.completedAt ? `<div class="info-value"><strong>Fin:</strong> ${completedDateStr}</div>` : ''}
          ${job.actualDuration ? `<div class="info-value"><strong>Duración:</strong> ${formatDuration(job.actualDuration)}</div>` : ''}
        </div>
      </div>
    </div>
    
    <!-- Technician & Vehicle -->
    <div class="section">
      <div class="section-title">👷 Técnico y Vehículo</div>
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Técnico</div>
          <div class="info-value large">${job.driverNameAtJob || technician?.name || 'No asignado'}</div>
          ${job.driverLicenseAtJob || technician?.driverLicenseNumber ? `
            <div class="info-value">Licencia: ${job.driverLicenseAtJob || technician?.driverLicenseNumber} ${technician?.driverLicenseCategory ? `(${technician.driverLicenseCategory})` : ''}</div>
          ` : ''}
          ${technician?.specialty ? `<div class="info-value">Especialidad: ${technician.specialty}</div>` : ''}
        </div>
        <div class="vehicle-section">
          <div class="vehicle-title">🚐 Vehículo</div>
          ${vehicle || job.vehiclePlateAtJob ? `
            <div class="info-value large">${job.vehiclePlateAtJob || vehicle?.plateNumber || 'Sin patente'}</div>
            <div class="info-value">${vehicle?.make || ''} ${vehicle?.model || ''}</div>
            ${job.vehicleMileageStart ? `
              <div class="info-value" style="margin-top: 8px">
                <strong>Km inicio:</strong> ${job.vehicleMileageStart.toLocaleString()}
              </div>
            ` : ''}
            ${job.vehicleMileageEnd ? `
              <div class="info-value"><strong>Km fin:</strong> ${job.vehicleMileageEnd.toLocaleString()}</div>
              ${tripDistance ? `<div class="info-value"><strong>Recorrido:</strong> ${tripDistance.toLocaleString()} km</div>` : ''}
            ` : ''}
          ` : '<div class="info-value">No asignado</div>'}
          <div class="snapshot-notice">⚠️ Datos capturados al momento de completar el trabajo</div>
        </div>
      </div>
    </div>
    
    <!-- Resolution -->
    ${job.resolution ? `
      <div class="section">
        <div class="section-title">✅ Resolución del Trabajo</div>
        <div class="info-block">
          <div class="info-value">${job.resolution}</div>
        </div>
      </div>
    ` : ''}
    
    <!-- Multi-Visit Details -->
    ${visitsHTML}
    
    <!-- Line Items -->
    ${lineItemsHTML}
    
    <!-- Per-Visit Pricing Breakdown (Phase 1 - Jan 2026) -->
    ${perVisitPricingHTML}
    
    <!-- Pricing Summary -->
    ${pricingHTML}
    
    <!-- Photos -->
    ${photosHTML}
    
    <!-- Signature -->
    ${signatureHTML}
    
    <!-- Footer -->
    <div class="footer">
      <p class="footer-notice">Documento generado por CampoTech</p>
      <p class="footer-notice">Registros para uso operativo interno - No constituye documentación fiscal certificada</p>
      <p>Para documentación oficial de facturación, solicitar la Factura correspondiente.</p>
      <p style="margin-top: 8px">ID Reporte: RPT-${job.jobNumber} | Generado: ${new Date().toISOString()}</p>
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
export async function generateReportPDF(
    data: JobReportData,
    options: { includePhotos?: boolean; includeSignature?: boolean } = {}
): Promise<Buffer> {
    const html = generateReportHTML(data, options);

    try {
        // Try to use puppeteer for PDF generation
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm',
            },
            printBackground: true,
        });

        await browser.close();
        return Buffer.from(pdfBuffer);
    } catch (error) {
        console.warn('PDF generation with Puppeteer failed, returning HTML:', error);
        // Fallback: return HTML as buffer (for debugging or when puppeteer is unavailable)
        return Buffer.from(html, 'utf-8');
    }
}

/**
 * Main entry point: Generate job completion report
 */
export async function generateJobCompletionReport(
    options: GenerateReportOptions
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const data = await fetchJobReportData(options.jobId, options.organizationId);

    if (!data) {
        throw new Error('Job not found');
    }

    const pdfBuffer = await generateReportPDF(data, {
        includePhotos: options.includePhotos ?? true,
        includeSignature: options.includeSignature ?? true,
    });

    // Determine content type based on whether PDF generation succeeded
    const isPDF = pdfBuffer.length > 0 && pdfBuffer.slice(0, 5).toString() === '%PDF-';

    return {
        buffer: pdfBuffer,
        filename: `reporte-trabajo-${data.job.jobNumber}.${isPDF ? 'pdf' : 'html'}`,
        contentType: isPDF ? 'application/pdf' : 'text/html',
    };
}
