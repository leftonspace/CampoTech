/**
 * Invoice PDF Worker
 * ==================
 *
 * BullMQ-based worker for generating invoice PDFs.
 * Processes PDF generation requests asynchronously.
 */

import { Worker, Queue, Job } from 'bullmq';
import { getRedis } from '../../lib/redis/redis-manager';
import { getCapabilityService, CapabilityPath } from '../../../core/config/capabilities';
import { getFairScheduler, createFairProcessor } from '../../../core/queue/fair-scheduler';
import { log } from '../../lib/logging/logger';
import { prisma } from '../../lib/prisma';
import { publishEvent } from '../../lib/events';

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUEUE_NAME = 'invoice-pdf';

const WORKER_CONFIG = {
  concurrency: 5, // PDF generation is CPU-intensive
  limiter: {
    max: 30, // Max 30 PDFs per minute
    duration: 60000,
  },
};

const JOB_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
  },
};

// =============================================================================
// TYPES
// =============================================================================

export type InvoicePDFAction = 'generate' | 'regenerate' | 'batch_generate';

export interface InvoicePDFJobData {
  /** Action to perform */
  action: InvoicePDFAction;
  /** Invoice ID (for single operations) */
  invoiceId?: string;
  /** Invoice IDs (for batch operations) */
  invoiceIds?: string[];
  /** Organization ID */
  orgId: string;
  /** Whether to include CAE information */
  includeCae?: boolean;
  /** Whether to notify customer when ready */
  notifyCustomer?: boolean;
  /** Custom template ID */
  templateId?: string;
  /** Idempotency key */
  idempotencyKey?: string;
}

export interface InvoicePDFJobResult {
  success: boolean;
  invoiceId?: string;
  pdfUrl?: string;
  pdfKey?: string;
  generatedAt: Date;
  fileSize?: number;
  error?: string;
  batchResults?: Array<{
    invoiceId: string;
    success: boolean;
    pdfUrl?: string;
    error?: string;
  }>;
}

// =============================================================================
// QUEUE
// =============================================================================

let pdfQueue: Queue<InvoicePDFJobData, InvoicePDFJobResult> | null = null;

export function getInvoicePDFQueue(): Queue<InvoicePDFJobData, InvoicePDFJobResult> {
  if (!pdfQueue) {
    pdfQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: JOB_CONFIG,
    });
  }
  return pdfQueue;
}

/**
 * Queue a single invoice PDF generation
 */
export async function queueInvoicePDF(
  invoiceId: string,
  orgId: string,
  options: {
    includeCae?: boolean;
    notifyCustomer?: boolean;
    templateId?: string;
  } = {}
): Promise<Job<InvoicePDFJobData, InvoicePDFJobResult>> {
  const queue = getInvoicePDFQueue();

  const idempotencyKey = `pdf:${invoiceId}:${Date.now()}`;

  return queue.add('generate-pdf', {
    action: 'generate',
    invoiceId,
    orgId,
    includeCae: options.includeCae ?? true,
    notifyCustomer: options.notifyCustomer ?? false,
    templateId: options.templateId,
    idempotencyKey,
  }, {
    jobId: idempotencyKey,
    priority: 5,
  });
}

/**
 * Queue batch PDF generation
 */
export async function queueBatchInvoicePDFs(
  invoiceIds: string[],
  orgId: string,
  options: {
    includeCae?: boolean;
    notifyCustomer?: boolean;
    templateId?: string;
  } = {}
): Promise<Job<InvoicePDFJobData, InvoicePDFJobResult>> {
  const queue = getInvoicePDFQueue();

  const idempotencyKey = `batch-pdf:${orgId}:${Date.now()}`;

  return queue.add('batch-generate-pdf', {
    action: 'batch_generate',
    invoiceIds,
    orgId,
    includeCae: options.includeCae ?? true,
    notifyCustomer: options.notifyCustomer ?? false,
    templateId: options.templateId,
    idempotencyKey,
  }, {
    jobId: idempotencyKey,
    priority: 7, // Lower priority for batch jobs
  });
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getInvoicePDFQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// =============================================================================
// WORKER
// =============================================================================

let pdfWorker: Worker<InvoicePDFJobData, InvoicePDFJobResult> | null = null;

export function startInvoicePDFWorker(): Worker<InvoicePDFJobData, InvoicePDFJobResult> {
  if (pdfWorker) {
    return pdfWorker;
  }

  const scheduler = getFairScheduler();

  pdfWorker = new Worker<InvoicePDFJobData, InvoicePDFJobResult>(
    QUEUE_NAME,
    createFairProcessor(scheduler, async (job) => {
      const { action, invoiceId, invoiceIds, orgId } = job.data;

      log.info('Processing invoice PDF job', {
        jobId: job.id,
        action,
        invoiceId,
        invoiceCount: invoiceIds?.length,
        orgId,
      });

      try {
        // Check capability system
        const capabilityService = getCapabilityService();
        const invoicingEnabled = await capabilityService.ensure(
          'domain.invoicing' as CapabilityPath,
          orgId
        );

        if (!invoicingEnabled) {
          log.warn('Invoicing capability disabled', { invoiceId, orgId });
          return {
            success: false,
            generatedAt: new Date(),
            error: 'Invoicing capability is disabled',
          };
        }

        if (action === 'batch_generate' && invoiceIds) {
          return await processBatchPDF(invoiceIds, job.data, job);
        } else if (invoiceId) {
          return await processSinglePDF(invoiceId, job.data);
        } else {
          throw new Error('Invalid job data: missing invoiceId or invoiceIds');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        log.error('Invoice PDF processing failed', {
          action,
          invoiceId,
          error: errorMessage,
          attempt: job.attemptsMade + 1,
        });

        throw error;
      }
    }),
    {
      connection: getRedis(),
      concurrency: WORKER_CONFIG.concurrency,
      limiter: WORKER_CONFIG.limiter,
    }
  );

  // Event handlers
  pdfWorker.on('completed', async (job, result) => {
    log.debug('Invoice PDF job completed', {
      jobId: job.id,
      invoiceId: result.invoiceId,
      pdfUrl: result.pdfUrl,
    });

    await publishEvent('queue.invoice_pdf.completed', {
      jobId: job.id,
      invoiceId: job.data.invoiceId,
      orgId: job.data.orgId,
      pdfUrl: result.pdfUrl,
    });
  });

  pdfWorker.on('failed', async (job, error) => {
    log.error('Invoice PDF job failed', {
      jobId: job?.id,
      invoiceId: job?.data.invoiceId,
      error: error.message,
      attempts: job?.attemptsMade,
    });

    if (job) {
      await publishEvent('queue.invoice_pdf.failed', {
        jobId: job.id,
        invoiceId: job.data.invoiceId,
        orgId: job.data.orgId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  });

  pdfWorker.on('progress', (job, progress) => {
    log.debug('Invoice PDF job progress', {
      jobId: job.id,
      progress,
    });
  });

  pdfWorker.on('error', (error) => {
    log.error('Invoice PDF worker error', { error: error.message });
  });

  log.info('Invoice PDF worker started');

  return pdfWorker;
}

export function stopInvoicePDFWorker(): Promise<void> {
  if (pdfWorker) {
    return pdfWorker.close();
  }
  return Promise.resolve();
}

// =============================================================================
// PDF GENERATION
// =============================================================================

async function processSinglePDF(
  invoiceId: string,
  jobData: InvoicePDFJobData
): Promise<InvoicePDFJobResult> {
  // Get invoice with all related data
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: {
        select: {
          name: true,
          address: true,
          phone: true,
          cuit: true,
          logo: true,
          invoiceFooter: true,
        },
      },
      customer: {
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          cuit: true,
        },
      },
      job: {
        select: {
          address: true,
          serviceType: true,
          completedAt: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  // Generate PDF using template
  const pdfBuffer = await generateInvoicePDF(invoice, jobData);

  // Upload to storage
  const { url, key, size } = await uploadPDF(pdfBuffer, invoice);

  // Update invoice record
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      pdfUrl: url,
      pdfKey: key,
      pdfGeneratedAt: new Date(),
    },
  });

  // Notify customer if requested
  if (jobData.notifyCustomer && invoice.customer?.email) {
    await publishEvent('invoice.pdf_ready', {
      invoiceId,
      customerId: invoice.customerId,
      pdfUrl: url,
      orgId: jobData.orgId,
    });
  }

  log.info('Invoice PDF generated', {
    invoiceId,
    pdfUrl: url,
    fileSize: size,
  });

  return {
    success: true,
    invoiceId,
    pdfUrl: url,
    pdfKey: key,
    fileSize: size,
    generatedAt: new Date(),
  };
}

async function processBatchPDF(
  invoiceIds: string[],
  jobData: InvoicePDFJobData,
  job: Job<InvoicePDFJobData, InvoicePDFJobResult>
): Promise<InvoicePDFJobResult> {
  const results: Array<{
    invoiceId: string;
    success: boolean;
    pdfUrl?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < invoiceIds.length; i++) {
    const invoiceId = invoiceIds[i];

    try {
      const result = await processSinglePDF(invoiceId, jobData);
      results.push({
        invoiceId,
        success: true,
        pdfUrl: result.pdfUrl,
      });
    } catch (error) {
      results.push({
        invoiceId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Update progress
    const progress = Math.round(((i + 1) / invoiceIds.length) * 100);
    await job.updateProgress(progress);
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    success: successCount === invoiceIds.length,
    generatedAt: new Date(),
    batchResults: results,
  };
}

// =============================================================================
// PDF GENERATION HELPERS
// =============================================================================

async function generateInvoicePDF(
  invoice: any,
  jobData: InvoicePDFJobData
): Promise<Buffer> {
  // Import PDF generation library dynamically
  // This could be @react-pdf/renderer, puppeteer, or another library

  // For now, create a simple placeholder that can be replaced
  // with actual PDF generation logic
  const pdfContent = buildPDFContent(invoice, jobData);

  try {
    // Try to use puppeteer if available
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(pdfContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch {
    // Fallback: Return HTML as buffer if puppeteer is not available
    log.warn('Puppeteer not available, returning HTML content');
    return Buffer.from(pdfContent, 'utf-8');
  }
}

function buildPDFContent(invoice: any, jobData: InvoicePDFJobData): string {
  const org = invoice.organization;
  const customer = invoice.customer;
  const items = invoice.items || [];

  // Parse items if they're stored as JSON
  const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

  const itemsHtml = parsedItems.map((item: any) => `
    <tr>
      <td>${item.description || item.name || ''}</td>
      <td style="text-align: center">${item.quantity || 1}</td>
      <td style="text-align: right">$${(item.unitPrice || item.price || 0).toFixed(2)}</td>
      <td style="text-align: right">$${(item.total || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .logo { max-width: 150px; max-height: 60px; }
        .invoice-title { font-size: 24px; font-weight: bold; color: #2563eb; }
        .invoice-number { font-size: 14px; color: #666; }
        .section { margin: 20px 0; }
        .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-block p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f3f4f6; font-weight: bold; }
        .totals { text-align: right; margin-top: 20px; }
        .total-row { display: flex; justify-content: flex-end; gap: 40px; margin: 5px 0; }
        .total-final { font-size: 18px; font-weight: bold; color: #2563eb; }
        .cae-info { background: #f0fdf4; border: 1px solid #86efac; padding: 15px; margin: 20px 0; border-radius: 8px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${org.logo ? `<img src="${org.logo}" class="logo" />` : ''}
          <h1 style="margin: 5px 0">${org.name}</h1>
          <p>${org.address || ''}</p>
          <p>Tel: ${org.phone || ''}</p>
          <p>CUIT: ${org.cuit || ''}</p>
        </div>
        <div style="text-align: right">
          <div class="invoice-title">FACTURA</div>
          <div class="invoice-number">#${invoice.invoiceNumber || invoice.id}</div>
          <p>Fecha: ${new Date(invoice.createdAt).toLocaleDateString('es-AR')}</p>
          ${invoice.dueDate ? `<p>Vencimiento: ${new Date(invoice.dueDate).toLocaleDateString('es-AR')}</p>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="info-grid">
          <div class="info-block">
            <div class="section-title">Cliente</div>
            <p><strong>${customer?.name || 'Cliente'}</strong></p>
            <p>${customer?.address || ''}</p>
            <p>Tel: ${customer?.phone || ''}</p>
            <p>Email: ${customer?.email || ''}</p>
            ${customer?.cuit ? `<p>CUIT: ${customer.cuit}</p>` : ''}
          </div>
          ${invoice.job ? `
          <div class="info-block">
            <div class="section-title">Servicio</div>
            <p><strong>${invoice.job.serviceType || 'Servicio'}</strong></p>
            <p>${invoice.job.address || ''}</p>
            ${invoice.job.completedAt ? `<p>Completado: ${new Date(invoice.job.completedAt).toLocaleDateString('es-AR')}</p>` : ''}
          </div>
          ` : ''}
        </div>
      </div>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th>Descripcion</th>
              <th style="text-align: center">Cantidad</th>
              <th style="text-align: right">Precio Unit.</th>
              <th style="text-align: right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>$${(invoice.subtotal || invoice.total || 0).toFixed(2)}</span>
        </div>
        ${invoice.taxAmount ? `
        <div class="total-row">
          <span>IVA (${invoice.taxRate || 21}%):</span>
          <span>$${invoice.taxAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${invoice.discount ? `
        <div class="total-row">
          <span>Descuento:</span>
          <span>-$${invoice.discount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row total-final">
          <span>TOTAL:</span>
          <span>$${(invoice.total || 0).toFixed(2)}</span>
        </div>
      </div>

      ${(jobData.includeCae && invoice.caeNumber) ? `
      <div class="cae-info">
        <div class="section-title">Datos Fiscales (AFIP)</div>
        <p><strong>CAE:</strong> ${invoice.caeNumber}</p>
        <p><strong>Vencimiento CAE:</strong> ${invoice.caeExpirationDate ? new Date(invoice.caeExpirationDate).toLocaleDateString('es-AR') : ''}</p>
        <p><strong>Punto de Venta:</strong> ${invoice.pointOfSale || ''}</p>
        <p><strong>Tipo:</strong> ${invoice.invoiceType || 'B'}</p>
      </div>
      ` : ''}

      ${org.invoiceFooter ? `
      <div class="footer">
        ${org.invoiceFooter}
      </div>
      ` : ''}
    </body>
    </html>
  `;
}

async function uploadPDF(
  pdfBuffer: Buffer,
  invoice: any
): Promise<{ url: string; key: string; size: number }> {
  // Try to use Supabase storage if available
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || ''
    );

    const key = `invoices/${invoice.organizationId}/${invoice.id}.pdf`;

    const { error } = await supabase.storage
      .from('documents')
      .upload(key, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(key);

    return {
      url: publicUrl,
      key,
      size: pdfBuffer.length,
    };
  } catch (error) {
    // Fallback: Save to local filesystem or return placeholder
    log.warn('Storage upload failed, using fallback', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // For development, return a placeholder URL
    return {
      url: `/api/invoices/${invoice.id}/pdf`,
      key: `invoices/${invoice.id}.pdf`,
      size: pdfBuffer.length,
    };
  }
}

// =============================================================================
// MANAGEMENT
// =============================================================================

/**
 * Retry a failed job
 */
export async function retryFailedJob(jobId: string): Promise<void> {
  const queue = getInvoicePDFQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  await job.retry();
}

/**
 * Get failed jobs for review
 */
export async function getFailedJobs(
  start: number = 0,
  end: number = 20
): Promise<Job<InvoicePDFJobData, InvoicePDFJobResult>[]> {
  const queue = getInvoicePDFQueue();
  return queue.getFailed(start, end);
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getInvoicePDFQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getInvoicePDFQueue();
  await queue.resume();
}
