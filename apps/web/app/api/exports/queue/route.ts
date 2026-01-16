/**
 * Export Queue API
 * =================
 * 
 * Phase 3.4: Async exports with email delivery
 * 
 * POST /api/exports/queue
 * - Queue a new export for async processing
 * 
 * GET /api/exports/queue?id=xxx
 * - Check export status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createExportRequest, getExportStatus } from '@/lib/services/async-export';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createExportSchema = z.object({
    exportType: z.enum(['customer_folder', 'job_report', 'whatsapp_history']),
    targetId: z.string().min(1),
    targetName: z.string().optional(),
    format: z.enum(['pdf', 'json']).default('pdf'),
    deliveryMethod: z.enum(['download', 'email']).default('download'),
    deliveryEmail: z.string().email().optional(),
    options: z.object({
        includeJobs: z.boolean().optional(),
        includeInvoices: z.boolean().optional(),
        includePayments: z.boolean().optional(),
        includePhotos: z.boolean().optional(),
    }).optional(),
});

// =============================================================================
// POST - Queue new export
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        // Authenticate
        const session = await getSession();
        if (!session?.userId || !session.organizationId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validate input
        const validationResult = createExportSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Datos inválidos',
                    details: validationResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const data = validationResult.data;

        // Validate email if email delivery requested
        if (data.deliveryMethod === 'email' && !data.deliveryEmail) {
            return NextResponse.json(
                { success: false, error: 'Email requerido para envío por correo' },
                { status: 400 }
            );
        }

        // Create export request
        const result = await createExportRequest({
            organizationId: session.organizationId,
            userId: session.userId,
            exportType: data.exportType,
            targetId: data.targetId,
            targetName: data.targetName,
            format: data.format,
            deliveryMethod: data.deliveryMethod,
            deliveryEmail: data.deliveryEmail,
            options: data.options,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            exportId: result.exportId,
            downloadUrl: result.downloadUrl,
            message: result.message,
        });
    } catch (error) {
        console.error('Error creating export request:', error);
        return NextResponse.json(
            { success: false, error: 'Error al crear la solicitud de exportación' },
            { status: 500 }
        );
    }
}

// =============================================================================
// GET - Check export status
// =============================================================================

export async function GET(request: NextRequest) {
    try {
        // Authenticate
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Get export ID from query
        const exportId = request.nextUrl.searchParams.get('id');
        if (!exportId) {
            return NextResponse.json(
                { success: false, error: 'Export ID requerido' },
                { status: 400 }
            );
        }

        // Get status
        const exportRequest = await getExportStatus(exportId, session.organizationId);

        if (!exportRequest) {
            return NextResponse.json(
                { success: false, error: 'Exportación no encontrada' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            export: exportRequest,
        });
    } catch (error) {
        console.error('Error getting export status:', error);
        return NextResponse.json(
            { success: false, error: 'Error al obtener estado de exportación' },
            { status: 500 }
        );
    }
}
