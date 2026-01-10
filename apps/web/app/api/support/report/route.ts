/**
 * Phase 7.2: Support Report API
 * ===============================
 * 
 * POST /api/support/report - Submit a bug report or suggestion
 * 
 * Accepts:
 * - type: 'bug' | 'suggestion'
 * - description: string
 * - context: object (auto-collected info)
 * - screenshot: File (optional, for bugs)
 * 
 * Actions:
 * 1. Store report in database
 * 2. Send email notification to support
 * 3. Upload screenshot to storage (if provided)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateEmailProvider } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ReportContext {
    userAgent?: string;
    url?: string;
    screenWidth?: number;
    screenHeight?: number;
    timestamp?: string;
    appVersion?: string;
    deviceModel?: string;
    osName?: string;
    osVersion?: string;
    platform?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Submit support report
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        // Get auth context (optional - anonymous reports allowed)
        const session = await getSession().catch(() => null);

        // Parse request body
        let type: string;
        let description: string;
        let context: ReportContext = {};
        let screenshotUrl: string | null = null;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            // Form data with potential file upload
            const formData = await request.formData();
            type = formData.get('type') as string || 'bug';
            description = formData.get('description') as string || '';

            const contextStr = formData.get('context') as string;
            if (contextStr) {
                try {
                    context = JSON.parse(contextStr);
                } catch {
                    // Ignore parse errors
                }
            }

            // Handle screenshot upload
            const screenshot = formData.get('screenshot') as File | null;
            if (screenshot && screenshot.size > 0) {
                // For now, we'll just note that a screenshot was attached
                // In production, upload to Supabase Storage
                screenshotUrl = `[Screenshot attached: ${screenshot.name}, ${(screenshot.size / 1024).toFixed(1)}KB]`;

                // TODO: Upload to Supabase Storage
                // const { data, error } = await supabase.storage
                //     .from('support-screenshots')
                //     .upload(`${Date.now()}-${screenshot.name}`, screenshot);
                // if (!error) screenshotUrl = data.path;
            }
        } else {
            // JSON body
            const body = await request.json();
            type = body.type || 'bug';
            description = body.description || '';
            context = body.context || {};
        }

        // Validate
        if (!description.trim()) {
            return NextResponse.json(
                { error: 'La descripción es requerida' },
                { status: 400 }
            );
        }

        // Create support report in database
        const report = await prisma.supportReport.create({
            data: {
                type: type as 'bug' | 'suggestion' | 'question',
                description: description.trim(),
                status: 'new',
                priority: type === 'bug' ? 'medium' : 'low',
                userId: session?.userId || null,
                organizationId: session?.organizationId || null,
                metadata: {
                    context,
                    screenshotUrl,
                    source: 'help_widget',
                },
            },
        });

        // Send email notification to support team
        await sendSupportEmail({
            type,
            description,
            context,
            screenshotUrl,
            reportId: report.id,
            user: session ? {
                id: session.userId,
                email: session.email ?? undefined,
                organizationId: session.organizationId,
            } : null,
        });

        // Log the report
        console.log(`[Support] New ${type} report #${report.id} from ${session?.email || 'anonymous'}`);

        return NextResponse.json({
            success: true,
            message: type === 'bug'
                ? 'Reporte enviado. Te contactaremos pronto.'
                : 'Sugerencia enviada. ¡Gracias por ayudarnos a mejorar!',
            reportId: report.id,
        });

    } catch (error) {
        console.error('[Support API] Error:', error);

        return NextResponse.json(
            { error: 'Error al enviar el reporte. Intentá de nuevo.' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface SupportEmailData {
    type: string;
    description: string;
    context: ReportContext;
    screenshotUrl: string | null;
    reportId: string;
    user: {
        id: string;
        email?: string;
        organizationId: string;
    } | null;
}

async function sendSupportEmail(data: SupportEmailData): Promise<void> {
    try {
        const emailProvider = getOrCreateEmailProvider();

        const typeLabel = data.type === 'bug' ? '🐛 Bug Report' : '💡 Sugerencia';

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: ${data.type === 'bug' ? '#ef4444' : '#3b82f6'}; color: white; padding: 20px;">
            <h1 style="margin: 0; font-size: 20px;">${typeLabel}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Report #${data.reportId}</p>
        </div>
        
        <div style="padding: 24px;">
            <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">Descripción:</h2>
            <p style="margin: 0; padding: 16px; background: #f9fafb; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(data.description)}</p>
            
            ${data.screenshotUrl ? `
            <h2 style="margin: 20px 0 12px 0; font-size: 16px; color: #374151;">Captura:</h2>
            <p style="margin: 0; padding: 12px; background: #ecfdf5; border-radius: 8px; color: #047857;">${data.screenshotUrl}</p>
            ` : ''}
            
            <h2 style="margin: 20px 0 12px 0; font-size: 16px; color: #374151;">Usuario:</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">ID:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.user?.id || 'Anónimo'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.user?.email || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Organización:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.user?.organizationId || 'N/A'}</td>
                </tr>
            </table>
            
            <h2 style="margin: 20px 0 12px 0; font-size: 16px; color: #374151;">Contexto:</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${data.context.url ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">URL:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(data.context.url)}</td></tr>` : ''}
                ${data.context.userAgent ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">User Agent:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; word-break: break-all;">${escapeHtml(data.context.userAgent)}</td></tr>` : ''}
                ${data.context.screenWidth ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Pantalla:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${data.context.screenWidth}x${data.context.screenHeight}</td></tr>` : ''}
                ${data.context.platform ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Plataforma:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${data.context.platform}</td></tr>` : ''}
                ${data.context.deviceModel ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Dispositivo:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${data.context.deviceModel}</td></tr>` : ''}
                ${data.context.osName ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Sistema:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${data.context.osName} ${data.context.osVersion || ''}</td></tr>` : ''}
                ${data.context.appVersion ? `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Versión App:</td><td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${data.context.appVersion}</td></tr>` : ''}
                <tr><td style="padding: 6px 8px; color: #6b7280;">Timestamp:</td><td style="padding: 6px 8px;">${data.context.timestamp || new Date().toISOString()}</td></tr>
            </table>
        </div>
        
        <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
                Este email fue enviado automáticamente desde CampoTech Help Widget.
            </p>
        </div>
    </div>
</body>
</html>`;

        const text = `
${typeLabel}
Report #${data.reportId}

DESCRIPCIÓN:
${data.description}

${data.screenshotUrl ? `CAPTURA:\n${data.screenshotUrl}\n` : ''}
USUARIO:
- ID: ${data.user?.id || 'Anónimo'}
- Email: ${data.user?.email || 'N/A'}
- Organización: ${data.user?.organizationId || 'N/A'}

CONTEXTO:
- URL: ${data.context.url || 'N/A'}
- User Agent: ${data.context.userAgent || 'N/A'}
- Pantalla: ${data.context.screenWidth || 'N/A'}x${data.context.screenHeight || 'N/A'}
- Timestamp: ${data.context.timestamp || new Date().toISOString()}
`;

        await emailProvider.sendEmail({
            to: process.env.SUPPORT_EMAIL || 'soporte@campotech.com.ar',
            subject: `[CampoTech] ${typeLabel} - ${data.description.substring(0, 50)}...`,
            html,
            text,
        });

    } catch (error) {
        console.error('[Support] Failed to send email notification:', error);
        // Don't throw - report was saved, email is secondary
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
