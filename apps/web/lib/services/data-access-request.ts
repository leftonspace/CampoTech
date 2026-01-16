/**
 * ARCO Data Access Request Service
 * ==================================
 * 
 * Phase 4: ARCO Compliance (Ley 25.326 Argentina)
 * 
 * Implements:
 * - A (Acceso): Access to personal data
 * - R (Rectificación): Correction of data
 * - C (Cancelación): Deletion of data
 * - O (Oposición): Objection to data processing
 * 
 * Features:
 * - Customer-facing request form
 * - Email/phone verification
 * - Audit logging for compliance
 * - Secure delivery of data
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateEmailProvider } from '@/lib/email';
// Note: These types are defined in schema but not yet migrated, so we define locally
type DataRequestStatus = 'SUBMITTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'IN_PROGRESS' | 'READY' | 'DOWNLOADED' | 'EXPIRED' | 'REJECTED';
type DataRequestType = 'ACCESS' | 'RECTIFICATION' | 'CANCELLATION' | 'OPPOSITION';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

interface CreateDataRequestOptions {
    organizationId: string;
    requestType: DataRequestType;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    requesterDni?: string;
    requestReason?: string;
    dataScope: string[];
    ipAddress?: string;
    userAgent?: string;
}

interface VerifyRequestOptions {
    requestId: string;
    code: string;
    ipAddress?: string;
    userAgent?: string;
}

interface DataRequestResult {
    success: boolean;
    requestId?: string;
    ticketNumber?: string;
    message?: string;
    error?: string;
}

// =============================================================================
// CREATE DATA ACCESS REQUEST
// =============================================================================

export async function createDataAccessRequest(
    options: CreateDataRequestOptions
): Promise<DataRequestResult> {
    try {
        // Generate verification code (6 digits)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Calculate legal deadline (10 business days per Ley 25.326)
        const legalDeadline = calculateBusinessDays(new Date(), 10);

        // Try to find existing customer by email or phone
        const customer = await prisma.customer.findFirst({
            where: {
                organizationId: options.organizationId,
                OR: [
                    { email: options.requesterEmail },
                    { phone: options.requesterPhone || '' },
                ],
            },
        });

        // Create the data access request
        const dataRequest = await prisma.dataAccessRequest.create({
            data: {
                organizationId: options.organizationId,
                requestType: options.requestType,
                requesterName: options.requesterName,
                requesterEmail: options.requesterEmail,
                requesterPhone: options.requesterPhone,
                requesterDni: options.requesterDni,
                requestReason: options.requestReason,
                dataScope: options.dataScope,
                customerId: customer?.id,
                verificationCode,
                verificationSentAt: new Date(),
                status: 'PENDING_VERIFICATION',
                legalDeadline,
                statusHistory: [{
                    status: 'SUBMITTED',
                    timestamp: new Date().toISOString(),
                    action: 'Request submitted',
                }],
            },
        });

        // Create audit log
        await createAuditLog({
            requestId: dataRequest.id,
            action: 'created',
            newStatus: 'PENDING_VERIFICATION',
            details: { requestType: options.requestType, dataScope: options.dataScope },
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            performedBy: 'customer',
        });

        // Send verification email
        await sendVerificationEmail({
            to: options.requesterEmail,
            name: options.requesterName,
            code: verificationCode,
            requestId: dataRequest.id,
        });

        return {
            success: true,
            requestId: dataRequest.id,
            message: 'Solicitud recibida. Te enviamos un código de verificación a tu email.',
        };
    } catch (error) {
        console.error('Error creating data access request:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al crear la solicitud',
        };
    }
}

// =============================================================================
// VERIFY REQUEST
// =============================================================================

export async function verifyDataAccessRequest(
    options: VerifyRequestOptions
): Promise<DataRequestResult> {
    try {
        const dataRequest = await prisma.dataAccessRequest.findUnique({
            where: { id: options.requestId },
        });

        if (!dataRequest) {
            return { success: false, error: 'Solicitud no encontrada' };
        }

        if (dataRequest.status !== 'PENDING_VERIFICATION') {
            return { success: false, error: 'Esta solicitud ya fue verificada o expiró' };
        }

        // Check verification attempts (max 5)
        if (dataRequest.verificationAttempts >= 5) {
            await prisma.dataAccessRequest.update({
                where: { id: options.requestId },
                data: { status: 'REJECTED', rejectionReason: 'Demasiados intentos de verificación' },
            });
            return { success: false, error: 'Demasiados intentos. La solicitud fue rechazada.' };
        }

        // Increment attempts
        await prisma.dataAccessRequest.update({
            where: { id: options.requestId },
            data: { verificationAttempts: { increment: 1 } },
        });

        // Check code
        if (dataRequest.verificationCode !== options.code) {
            return {
                success: false,
                error: `Código incorrecto. Te quedan ${4 - dataRequest.verificationAttempts} intentos.`
            };
        }

        // Check expiration (code valid for 15 minutes)
        if (dataRequest.verificationSentAt) {
            const expirationTime = new Date(dataRequest.verificationSentAt);
            expirationTime.setMinutes(expirationTime.getMinutes() + 15);

            if (new Date() > expirationTime) {
                return { success: false, error: 'El código expiró. Por favor solicita uno nuevo.' };
            }
        }

        // Verification successful
        await prisma.dataAccessRequest.update({
            where: { id: options.requestId },
            data: {
                status: 'VERIFIED',
                verifiedAt: new Date(),
                statusHistory: {
                    push: {
                        status: 'VERIFIED',
                        timestamp: new Date().toISOString(),
                        action: 'Identity verified',
                    },
                },
            },
        });

        // Create audit log
        await createAuditLog({
            requestId: options.requestId,
            action: 'verified',
            previousStatus: 'PENDING_VERIFICATION',
            newStatus: 'VERIFIED',
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            performedBy: 'customer',
        });

        return {
            success: true,
            requestId: options.requestId,
            message: 'Identidad verificada. Tu solicitud será procesada dentro de los próximos 10 días hábiles.',
        };
    } catch (error) {
        console.error('Error verifying data request:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al verificar',
        };
    }
}

// =============================================================================
// PROCESS REQUEST (Staff action)
// =============================================================================

export async function processDataRequest(
    requestId: string,
    organizationId: string,
    staffUserId: string
) {
    const dataRequest = await prisma.dataAccessRequest.findFirst({
        where: { id: requestId, organizationId },
    });

    if (!dataRequest) {
        return { error: 'Request not found' };
    }

    if (dataRequest.status !== 'VERIFIED') {
        return { error: 'Request not verified' };
    }

    // Generate secure download token
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiration

    // Update status to IN_PROGRESS
    await prisma.dataAccessRequest.update({
        where: { id: requestId },
        data: {
            status: 'IN_PROGRESS',
            assignedToId: staffUserId,
            downloadToken,
            expiresAt,
            statusHistory: {
                push: {
                    status: 'IN_PROGRESS',
                    timestamp: new Date().toISOString(),
                    action: 'Processing started',
                    staffId: staffUserId,
                },
            },
        },
    });

    // Create audit log
    await createAuditLog({
        requestId,
        action: 'processing_started',
        previousStatus: 'VERIFIED',
        newStatus: 'IN_PROGRESS',
        performedBy: staffUserId,
    });

    return { success: true, downloadToken };
}

// =============================================================================
// COMPLETE REQUEST (Staff action)
// =============================================================================

export async function completeDataRequest(
    requestId: string,
    organizationId: string,
    staffUserId: string,
    downloadUrl: string
) {
    const dataRequest = await prisma.dataAccessRequest.findFirst({
        where: { id: requestId, organizationId },
    });

    if (!dataRequest) {
        return { error: 'Request not found' };
    }

    // Update status to READY
    await prisma.dataAccessRequest.update({
        where: { id: requestId },
        data: {
            status: 'READY',
            downloadUrl,
            responseDate: new Date(),
            statusHistory: {
                push: {
                    status: 'READY',
                    timestamp: new Date().toISOString(),
                    action: 'Data ready for download',
                    staffId: staffUserId,
                },
            },
        },
    });

    // Create audit log
    await createAuditLog({
        requestId,
        action: 'completed',
        previousStatus: 'IN_PROGRESS',
        newStatus: 'READY',
        performedBy: staffUserId,
    });

    // Send email to customer with download link
    const emailProvider = getOrCreateEmailProvider();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.campotech.com';

    await emailProvider.sendEmail({
        to: dataRequest.requesterEmail,
        subject: 'Tu solicitud de datos está lista - ARCO',
        html: generateDataReadyEmail({
            name: dataRequest.requesterName,
            downloadUrl: `${baseUrl}/data-request/${dataRequest.downloadToken}`,
            expiresAt: dataRequest.expiresAt!,
        }),
    });

    return { success: true };
}

// =============================================================================
// GET REQUEST BY TOKEN (Public - for customer download)
// =============================================================================

export async function getRequestByToken(token: string) {
    const request = await prisma.dataAccessRequest.findUnique({
        where: { downloadToken: token },
        select: {
            id: true,
            requestType: true,
            requesterName: true,
            status: true,
            downloadUrl: true,
            expiresAt: true,
            downloadedAt: true,
        },
    });

    if (!request) {
        return { error: 'Request not found' };
    }

    if (request.expiresAt && new Date() > request.expiresAt) {
        return { error: 'Download link has expired' };
    }

    return { request };
}

// =============================================================================
// MARK AS DOWNLOADED
// =============================================================================

export async function markAsDownloaded(
    token: string,
    ipAddress?: string,
    userAgent?: string
) {
    const request = await prisma.dataAccessRequest.findUnique({
        where: { downloadToken: token },
    });

    if (!request) {
        return { error: 'Request not found' };
    }

    await prisma.dataAccessRequest.update({
        where: { id: request.id },
        data: {
            status: 'DOWNLOADED',
            downloadedAt: new Date(),
            statusHistory: {
                push: {
                    status: 'DOWNLOADED',
                    timestamp: new Date().toISOString(),
                    action: 'Data downloaded by customer',
                },
            },
        },
    });

    await createAuditLog({
        requestId: request.id,
        action: 'downloaded',
        previousStatus: request.status,
        newStatus: 'DOWNLOADED',
        ipAddress,
        userAgent,
        performedBy: 'customer',
    });

    return { success: true };
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

interface AuditLogOptions {
    requestId: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    details?: Record<string, unknown>;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
}

async function createAuditLog(options: AuditLogOptions) {
    await prisma.dataRequestAuditLog.create({
        data: {
            requestId: options.requestId,
            action: options.action,
            previousStatus: options.previousStatus,
            newStatus: options.newStatus,
            details: options.details || {},
            performedBy: options.performedBy,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
        },
    });
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

interface VerificationEmailData {
    to: string;
    name: string;
    code: string;
    requestId: string;
}

async function sendVerificationEmail(data: VerificationEmailData) {
    const emailProvider = getOrCreateEmailProvider();

    await emailProvider.sendEmail({
        to: data.to,
        subject: 'Verificación de Solicitud de Datos - Código: ' + data.code,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #0f766e; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .code-box { background: #f0fdfa; border: 2px solid #14b8a6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0d9488; }
        .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 10px; margin: 15px 0; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">🔐 Verificación de Identidad</h2>
        </div>
        <div class="content">
            <p>Hola <strong>${data.name}</strong>,</p>
            <p>Recibimos tu solicitud de acceso a datos personales. Para verificar tu identidad, ingresá el siguiente código:</p>
            
            <div class="code-box">
                <div class="code">${data.code}</div>
            </div>
            
            <div class="warning">
                <strong>⚠️ Este código expira en 15 minutos.</strong><br>
                Si no solicitaste acceso a tus datos, ignorá este correo.
            </div>
            
            <p>Una vez verificada tu identidad, procesaremos tu solicitud dentro de los 10 días hábiles según lo establecido por la Ley 25.326 de Protección de Datos Personales.</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automatizado. Por favor no respondas a este correo.</p>
            <p>Ley 25.326 - Protección de Datos Personales (Argentina)</p>
        </div>
    </div>
</body>
</html>`,
    });
}

interface DataReadyEmailData {
    name: string;
    downloadUrl: string;
    expiresAt: Date;
}

function generateDataReadyEmail(data: DataReadyEmailData): string {
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
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #0f766e; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #0d9488; color: white !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; }
        .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 10px; margin: 15px 0; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">📁 Tus Datos Están Listos</h2>
        </div>
        <div class="content">
            <p>Hola <strong>${data.name}</strong>,</p>
            <p>Tu solicitud de acceso a datos personales ha sido procesada. Podés descargar tus datos usando el siguiente enlace:</p>
            
            <p style="text-align: center; margin: 25px 0;">
                <a href="${data.downloadUrl}" class="button">⬇️ Descargar Mis Datos</a>
            </p>
            
            <div class="warning">
                <strong>⚠️ Este enlace expira el ${expiresFormatted}.</strong><br>
                Por razones de seguridad, solo podrás descargar tus datos una vez.
            </div>
            
            <p>Si tenés alguna pregunta sobre los datos recibidos, podés contactarnos respondiendo a este correo.</p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automatizado.</p>
            <p>Ley 25.326 - Protección de Datos Personales (Argentina)</p>
        </div>
    </div>
</body>
</html>`;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateBusinessDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            addedDays++;
        }
    }

    return result;
}

// =============================================================================
// ADMIN FUNCTIONS - List requests for organization
// =============================================================================

export async function listDataRequests(
    organizationId: string,
    options: {
        status?: DataRequestStatus;
        page?: number;
        limit?: number;
    } = {}
) {
    const { status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where = {
        organizationId,
        ...(status ? { status } : {}),
    };

    const [requests, total] = await Promise.all([
        prisma.dataAccessRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip,
            select: {
                id: true,
                requestType: true,
                requesterName: true,
                requesterEmail: true,
                status: true,
                legalDeadline: true,
                createdAt: true,
                verifiedAt: true,
                responseDate: true,
                customer: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true } },
            },
        }),
        prisma.dataAccessRequest.count({ where }),
    ]);

    return {
        requests,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}
