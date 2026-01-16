/**
 * Public Data Access Request API
 * ================================
 * 
 * Phase 4: ARCO Compliance (Ley 25.326 Argentina)
 * 
 * POST /api/public/data-request
 * - Creates a new data access request
 * - Sends verification email
 * 
 * This is a PUBLIC endpoint - no authentication required
 * Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDataAccessRequest, verifyDataAccessRequest } from '@/lib/services/data-access-request';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createRequestSchema = z.object({
    organizationId: z.string().min(1, 'Organization ID is required'),
    requestType: z.enum(['ACCESS', 'RECTIFICATION', 'CANCELLATION', 'OPPOSITION']).default('ACCESS'),
    requesterName: z.string().min(2, 'Nombre requerido'),
    requesterEmail: z.string().email('Email inválido'),
    requesterPhone: z.string().optional(),
    requesterDni: z.string().optional(),
    requestReason: z.string().optional(),
    dataScope: z.array(z.string()).default(['all']),
});

const verifyRequestSchema = z.object({
    requestId: z.string().min(1),
    code: z.string().length(6, 'El código debe tener 6 dígitos'),
});

// =============================================================================
// POST - Create new data access request
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Check if this is a verification request
        if (body.action === 'verify') {
            return handleVerification(request, body);
        }

        // Validate input
        const validationResult = createRequestSchema.safeParse(body);
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

        // Get client info for audit
        const ipAddress = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        // Create the request
        const result = await createDataAccessRequest({
            organizationId: data.organizationId,
            requestType: data.requestType,
            requesterName: data.requesterName,
            requesterEmail: data.requesterEmail,
            requesterPhone: data.requesterPhone,
            requesterDni: data.requesterDni,
            requestReason: data.requestReason,
            dataScope: data.dataScope,
            ipAddress,
            userAgent,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            requestId: result.requestId,
            message: result.message,
        });
    } catch (error) {
        console.error('Error in data access request:', error);
        return NextResponse.json(
            { success: false, error: 'Error al procesar la solicitud' },
            { status: 500 }
        );
    }
}

// =============================================================================
// VERIFICATION HANDLER
// =============================================================================

async function handleVerification(request: NextRequest, body: unknown) {
    // Validate input
    const validationResult = verifyRequestSchema.safeParse(body);
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

    // Get client info for audit
    const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Verify the request
    const result = await verifyDataAccessRequest({
        requestId: data.requestId,
        code: data.code,
        ipAddress,
        userAgent,
    });

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
        );
    }

    return NextResponse.json({
        success: true,
        message: result.message,
    });
}
