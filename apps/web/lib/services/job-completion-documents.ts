/**
 * Job Completion Documents Service
 * =================================
 * 
 * Phase 2: Automatic document delivery after job completion
 * 
 * When a job is completed with:
 * - Customer signature captured
 * - Payment confirmed (or invoice issued)
 * 
 * This service automatically:
 * 1. Generates Job Completion Report PDF
 * 2. Generates Invoice PDF (if exists)
 * 3. Uploads to Supabase storage
 * 4. Sends both documents to customer via WhatsApp
 */

import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateWhatsAppProvider } from '@/lib/whatsapp';
import { generateJobCompletionReport, fetchJobReportData } from '@/lib/reports/job-completion-report';
import { formatPhone } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface DocumentDeliveryResult {
    success: boolean;
    jobId: string;
    reportSent: boolean;
    invoiceSent: boolean;
    reportUrl?: string;
    invoiceUrl?: string;
    errors: string[];
}

export interface DeliveryOptions {
    jobId: string;
    organizationId: string;
    ratingToken?: string | null;
    sendReport?: boolean;
    sendInvoice?: boolean;
    customMessage?: string;
}

// =============================================================================
// SUPABASE STORAGE
// =============================================================================

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials not configured');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Upload a PDF buffer to Supabase storage and return public URL
 */
async function uploadPDFToStorage(
    buffer: Buffer,
    path: string,
    filename: string
): Promise<string> {
    const supabase = getSupabaseClient();

    const filePath = `${path}/${filename}`;

    const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, buffer, {
            contentType: 'application/pdf',
            upsert: true, // Replace if exists
        });

    if (error) {
        throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

// =============================================================================
// MAIN SERVICE
// =============================================================================

/**
 * Send job completion documents to customer via WhatsApp
 * 
 * This should be called after:
 * - Job is marked COMPLETED
 * - Customer signature is captured
 * - Payment is confirmed (optional - can send report even without invoice)
 */
export async function sendCompletionDocuments(
    options: DeliveryOptions
): Promise<DocumentDeliveryResult> {
    const { jobId, organizationId, ratingToken, sendReport = true, sendInvoice = true, customMessage } = options;
    const errors: string[] = [];

    let reportSent = false;
    let invoiceSent = false;
    let reportUrl: string | undefined;
    let invoiceUrl: string | undefined;

    try {
        // Get job with customer info
        const job = await prisma.job.findFirst({
            where: { id: jobId, organizationId },
            include: {
                customer: {
                    select: {
                        name: true,
                        phone: true,
                    },
                },
                organization: {
                    select: {
                        name: true,
                    },
                },
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        status: true,
                    },
                },
            },
        });

        if (!job) {
            throw new Error('Job not found');
        }

        if (!job.customer?.phone) {
            errors.push('Customer phone number not available');
            return { success: false, jobId, reportSent, invoiceSent, reportUrl, invoiceUrl, errors };
        }

        // Validate that job is completed
        if (job.status !== 'COMPLETED') {
            errors.push('Job is not completed yet');
            return { success: false, jobId, reportSent, invoiceSent, reportUrl, invoiceUrl, errors };
        }

        const whatsapp = getOrCreateWhatsAppProvider();
        const customerPhone = job.customer.phone;
        const customerName = job.customer.name;
        const companyName = job.organization?.name || 'CampoTech';
        const storagePath = `jobs/${organizationId}/${jobId}`;

        // 1. Generate and send Job Completion Report
        if (sendReport) {
            try {
                const reportData = await fetchJobReportData(jobId, organizationId);
                if (reportData) {
                    const { buffer, filename } = await generateJobCompletionReport({
                        jobId,
                        organizationId,
                        includePhotos: true,
                        includeSignature: true,
                    });

                    // Upload to storage
                    reportUrl = await uploadPDFToStorage(buffer, storagePath, filename);

                    // Send via WhatsApp
                    if (whatsapp.sendDocument) {
                        const result = await whatsapp.sendDocument(
                            customerPhone,
                            reportUrl,
                            filename,
                            `📋 Reporte de trabajo #${job.jobNumber} - ${companyName}`
                        );
                        reportSent = result.success;
                        if (!result.success) {
                            errors.push(`Failed to send report: ${result.error}`);
                        }
                    } else {
                        // Fallback: send link as text message
                        await whatsapp.sendMessage(
                            customerPhone,
                            `📋 Reporte de trabajo #${job.jobNumber}\n\nDescargá tu reporte aquí: ${reportUrl}`
                        );
                        reportSent = true;
                    }
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`Report generation failed: ${errorMsg}`);
            }
        }

        // 2. Generate and send Invoice (if exists and is issued)
        if (sendInvoice && job.invoice) {
            try {
                // TODO: Implement invoice PDF generation using existing invoice-pdf.worker.ts pattern
                // For now, we'll check if invoice PDF already exists in storage
                const invoiceFilename = `factura-${job.invoice.invoiceNumber}.pdf`;

                // Check if invoice PDF exists (would have been generated when invoice was issued)
                const supabase = getSupabaseClient();
                const invoicePath = `invoices/${organizationId}/${invoiceFilename}`;

                const { data: existingFile } = await supabase.storage
                    .from('documents')
                    .list(`invoices/${organizationId}`, {
                        search: invoiceFilename,
                    });

                if (existingFile && existingFile.length > 0) {
                    const { data: urlData } = supabase.storage
                        .from('documents')
                        .getPublicUrl(invoicePath);

                    invoiceUrl = urlData.publicUrl;

                    if (whatsapp.sendDocument) {
                        const result = await whatsapp.sendDocument(
                            customerPhone,
                            invoiceUrl,
                            invoiceFilename,
                            `🧾 Factura #${job.invoice.invoiceNumber} - ${companyName}`
                        );
                        invoiceSent = result.success;
                        if (!result.success) {
                            errors.push(`Failed to send invoice: ${result.error}`);
                        }
                    } else {
                        await whatsapp.sendMessage(
                            customerPhone,
                            `🧾 Factura #${job.invoice.invoiceNumber}\n\nDescargá tu factura aquí: ${invoiceUrl}`
                        );
                        invoiceSent = true;
                    }
                } else {
                    // Invoice PDF doesn't exist yet - this is normal if invoice hasn't been finalized
                    console.log(`[Documents] Invoice PDF not found for ${job.invoice.invoiceNumber}`);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                errors.push(`Invoice delivery failed: ${errorMsg}`);
            }
        }

        // 3. Build rating link if token available
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campo.tech';
        const ratingLink = ratingToken ? `${baseUrl}/rate/${ratingToken}` : null;

        // 4. Send thank you message with rating link
        const thankYouMessage = customMessage ||
            `¡Hola ${customerName}! 👋\n\n` +
            `Gracias por confiar en ${companyName}. ` +
            `Tu trabajo #${job.jobNumber} ha sido completado.\n\n` +
            (reportSent ? '📋 Te enviamos el reporte del trabajo.\n' : '') +
            (invoiceSent ? '🧾 Te enviamos la factura correspondiente.\n' : '') +
            (ratingLink ? `\n⭐ ¿Cómo te fue? Dejanos tu opinión:\n${ratingLink}\n` : '') +
            `\n¿Tenés alguna consulta? Respondé este mensaje y te ayudamos. 🙌`;

        await whatsapp.sendMessage(customerPhone, thankYouMessage);

        // Log the delivery
        console.log(`[Documents] Sent to ${formatPhone(customerPhone)}: Report=${reportSent}, Invoice=${invoiceSent}`);

        return {
            success: errors.length === 0,
            jobId,
            reportSent,
            invoiceSent,
            reportUrl,
            invoiceUrl,
            errors,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(errorMsg);
        return { success: false, jobId, reportSent, invoiceSent, reportUrl, invoiceUrl, errors };
    }
}

/**
 * Check if a job is ready for document delivery
 * Ready = COMPLETED + has signature + (has payment OR invoice issued)
 */
export async function isReadyForDocumentDelivery(
    jobId: string,
    organizationId: string
): Promise<{ ready: boolean; reason?: string }> {
    const job = await prisma.job.findFirst({
        where: { id: jobId, organizationId },
        select: {
            status: true,
            customerSignature: true,
            invoice: {
                select: {
                    status: true,
                },
            },
        },
    });

    if (!job) {
        return { ready: false, reason: 'Job not found' };
    }

    if (job.status !== 'COMPLETED') {
        return { ready: false, reason: 'Job not completed' };
    }

    // Removed signature requirement - most jobs complete without formal signature
    // Ready to send report (invoice is optional)
    return { ready: true };
}

/**
 * Queue job completion documents for async processing
 * This is used when you want to trigger document delivery via the queue system
 */
export async function queueDocumentDelivery(
    jobId: string,
    organizationId: string,
    ratingToken?: string | null
): Promise<{ queued: boolean; error?: string }> {
    try {
        // Check if ready
        const { ready, reason } = await isReadyForDocumentDelivery(jobId, organizationId);
        if (!ready) {
            return { queued: false, error: reason };
        }

        // Use the queue system to process async
        const { dispatch } = await import('@/lib/queue');

        await dispatch('job.sendDocuments', {
            jobId,
            organizationId,
            ratingToken,
        }, {
            maxRetries: 3,
        });

        return { queued: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return { queued: false, error: errorMsg };
    }
}
