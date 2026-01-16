/**
 * Async Export Service
 * ====================
 * 
 * Phase 3.4: Queue large exports for async processing with email delivery
 * 
 * Handles:
 * - Creating export requests
 * - Processing exports in background
 * - Sending email notifications with download links
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateEmailProvider } from '@/lib/email';
import { generateCustomerFolderReport } from '@/lib/reports/customer-report';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

interface CreateExportRequestOptions {
    organizationId: string;
    userId: string;
    exportType: 'customer_folder' | 'job_report' | 'whatsapp_history';
    targetId: string;
    targetName?: string;
    format?: 'pdf' | 'json';
    deliveryMethod?: 'download' | 'email';
    deliveryEmail?: string;
    options?: {
        includeJobs?: boolean;
        includeInvoices?: boolean;
        includePayments?: boolean;
        includePhotos?: boolean;
    };
}

interface ExportResult {
    success: boolean;
    exportId?: string;
    downloadUrl?: string;
    message?: string;
    error?: string;
}

// =============================================================================
// CREATE EXPORT REQUEST
// =============================================================================

export async function createExportRequest(
    options: CreateExportRequestOptions
): Promise<ExportResult> {
    try {
        // Generate secure download token
        const downloadToken = crypto.randomBytes(32).toString('hex');

        // Set expiration (24 hours for email delivery, 1 hour for immediate download)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + (options.deliveryMethod === 'email' ? 24 : 1));

        // Create the export request
        const exportRequest = await prisma.exportRequest.create({
            data: {
                organizationId: options.organizationId,
                exportType: options.exportType,
                targetId: options.targetId,
                targetName: options.targetName,
                format: options.format || 'pdf',
                options: options.options || {},
                deliveryMethod: options.deliveryMethod || 'download',
                deliveryEmail: options.deliveryEmail,
                downloadToken,
                expiresAt,
                requestedById: options.userId,
                status: 'PENDING',
            },
        });

        // For immediate download, process synchronously
        if (options.deliveryMethod !== 'email') {
            const result = await processExportRequest(exportRequest.id);
            return result;
        }

        // For email delivery, queue for async processing
        // In production, this would be handled by a job queue (BullMQ, etc.)
        // For now, we process immediately but send email when done
        processExportRequestAsync(exportRequest.id).catch(err => {
            console.error(`Failed to process export ${exportRequest.id}:`, err);
        });

        return {
            success: true,
            exportId: exportRequest.id,
            message: `Exportación en proceso. Recibirás un email en ${options.deliveryEmail} cuando esté lista.`,
        };
    } catch (error) {
        console.error('Error creating export request:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// =============================================================================
// PROCESS EXPORT REQUEST
// =============================================================================

export async function processExportRequest(exportId: string): Promise<ExportResult> {
    try {
        // Get the export request
        const exportRequest = await prisma.exportRequest.findUnique({
            where: { id: exportId },
            include: {
                organization: { select: { name: true, phone: true, logo: true, afipCuit: true } },
            },
        });

        if (!exportRequest) {
            return { success: false, error: 'Export request not found' };
        }

        // Update status to processing
        await prisma.exportRequest.update({
            where: { id: exportId },
            data: {
                status: 'PROCESSING',
                startedAt: new Date(),
                progress: 10,
            },
        });

        let buffer: Buffer;
        let filename: string;

        // Generate the export based on type
        switch (exportRequest.exportType) {
            case 'customer_folder':
                const options = exportRequest.options as { includeJobs?: boolean; includeInvoices?: boolean; includePayments?: boolean };
                const result = await generateCustomerFolderReport({
                    customerId: exportRequest.targetId,
                    organizationId: exportRequest.organizationId,
                    includeJobs: options.includeJobs !== false,
                    includeInvoices: options.includeInvoices !== false,
                    includePayments: options.includePayments !== false,
                });
                buffer = result.buffer;
                filename = result.filename;
                // contentType = result.contentType; // Not used currently, but available on result
                break;

            default:
                throw new Error(`Unsupported export type: ${exportRequest.exportType}`);
        }

        // Update progress
        await prisma.exportRequest.update({
            where: { id: exportId },
            data: { progress: 80 },
        });

        // Store the file (in production, upload to S3/Supabase Storage)
        // For now, we'll generate a URL that serves from our API
        const downloadUrl = `/api/exports/${exportRequest.downloadToken}/download`;

        // Update the export request with completion info
        await prisma.exportRequest.update({
            where: { id: exportId },
            data: {
                status: 'COMPLETED',
                progress: 100,
                completedAt: new Date(),
                fileUrl: downloadUrl,
                fileSize: buffer.length,
                fileName: filename,
            },
        });

        return {
            success: true,
            exportId,
            downloadUrl,
        };
    } catch (error) {
        console.error(`Error processing export ${exportId}:`, error);

        // Mark as failed
        await prisma.exportRequest.update({
            where: { id: exportId },
            data: {
                status: 'FAILED',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
        }).catch(() => { }); // Ignore errors updating status

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// =============================================================================
// ASYNC PROCESSING WITH EMAIL
// =============================================================================

async function processExportRequestAsync(exportId: string): Promise<void> {
    const result = await processExportRequest(exportId);

    if (!result.success) {
        return; // Failed exports are already logged
    }

    // Get the updated export request
    const exportRequest = await prisma.exportRequest.findUnique({
        where: { id: exportId },
        include: {
            organization: { select: { name: true } },
            requestedBy: { select: { name: true, email: true } },
        },
    });

    if (!exportRequest || !exportRequest.deliveryEmail) {
        return;
    }

    // Send email with download link
    const emailProvider = getOrCreateEmailProvider();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.campotech.com';
    const downloadUrl = `${baseUrl}/api/exports/${exportRequest.downloadToken}/download`;

    await emailProvider.sendEmail({
        to: exportRequest.deliveryEmail,
        subject: `Tu exportación está lista - ${exportRequest.targetName || 'Datos'}`,
        html: generateExportReadyEmail({
            recipientName: exportRequest.requestedBy?.name || 'Usuario',
            exportType: exportRequest.exportType,
            targetName: exportRequest.targetName || 'Datos',
            downloadUrl,
            expiresAt: exportRequest.expiresAt!,
            organizationName: exportRequest.organization.name,
        }),
    });
}

// =============================================================================
// EMAIL TEMPLATE
// =============================================================================

interface ExportEmailData {
    recipientName: string;
    exportType: string;
    targetName: string;
    downloadUrl: string;
    expiresAt: Date;
    organizationName: string;
}

function generateExportReadyEmail(data: ExportEmailData): string {
    const exportTypeLabels: Record<string, string> = {
        customer_folder: 'Carpeta de Cliente',
        job_report: 'Reporte de Trabajo',
        whatsapp_history: 'Historial de WhatsApp',
    };

    const expiresFormatted = data.expiresAt.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px 20px; background: #ffffff; }
        .file-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .button { display: inline-block; background: #0d9488; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .warning { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 14px; }
        .footer { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; font-size: 12px; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📄 Tu exportación está lista</h1>
        </div>
        <div class="content">
            <p>Hola ${data.recipientName},</p>
            <p>Tu solicitud de exportación ha sido procesada exitosamente.</p>
            
            <div class="file-box">
                <h3 style="margin-top: 0; color: #0f766e;">📁 ${exportTypeLabels[data.exportType] || 'Exportación'}</h3>
                <p style="margin: 5px 0; color: #666;">${data.targetName}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="${data.downloadUrl}" class="button">⬇️ Descargar Archivo</a>
            </p>
            
            <div class="warning">
                <strong>⚠️ Importante:</strong> Este enlace expira el ${expiresFormatted}. Después de esa fecha, deberás solicitar una nueva exportación.
            </div>
            
            <p>Si no solicitaste esta exportación, podés ignorar este correo de forma segura.</p>
        </div>
        <div class="footer">
            <p>Este correo fue enviado automáticamente por CampoTech.</p>
            <p>© ${new Date().getFullYear()} ${data.organizationName} - Powered by CampoTech</p>
        </div>
    </div>
</body>
</html>`;
}

// =============================================================================
// GET EXPORT STATUS
// =============================================================================

export async function getExportStatus(exportId: string, organizationId: string) {
    const exportRequest = await prisma.exportRequest.findFirst({
        where: {
            id: exportId,
            organizationId,
        },
        select: {
            id: true,
            status: true,
            progress: true,
            exportType: true,
            targetName: true,
            fileUrl: true,
            fileName: true,
            fileSize: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
            expiresAt: true,
        },
    });

    return exportRequest;
}

// =============================================================================
// DOWNLOAD EXPORT BY TOKEN
// =============================================================================

export async function getExportByToken(token: string) {
    const exportRequest = await prisma.exportRequest.findUnique({
        where: { downloadToken: token },
        include: {
            organization: { select: { id: true, name: true } },
        },
    });

    if (!exportRequest) {
        return { error: 'Export not found', status: 404 };
    }

    // Check if expired
    if (exportRequest.expiresAt && exportRequest.expiresAt < new Date()) {
        await prisma.exportRequest.update({
            where: { id: exportRequest.id },
            data: { status: 'EXPIRED' },
        });
        return { error: 'Export link has expired', status: 410 };
    }

    // Check download count
    if (exportRequest.downloadCount >= exportRequest.maxDownloads) {
        return { error: 'Maximum downloads exceeded', status: 429 };
    }

    // Increment download count
    await prisma.exportRequest.update({
        where: { id: exportRequest.id },
        data: { downloadCount: { increment: 1 } },
    });

    return { exportRequest };
}
