/**
 * Badge Verification API
 * ======================
 * 
 * Phase 4.3 Task 4.3.3: Badge Verification Public Endpoint
 * 
 * GET /api/verify-badge/[token] - Verify a badge token (for security guards)
 * 
 * This is a PUBLIC endpoint - no authentication required.
 * Security guards scan QR codes to verify technician credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDigitalBadgeService } from '@/lib/services/digital-badge.service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        if (!token || token.length < 32) {
            return NextResponse.json(
                {
                    success: false,
                    valid: false,
                    error: 'Token inválido',
                },
                { status: 400 }
            );
        }

        const badgeService = getDigitalBadgeService();
        const result = await badgeService.verifyBadge(token);

        if (result.notFound) {
            return NextResponse.json(
                {
                    success: false,
                    valid: false,
                    error: 'Credencial no encontrada',
                    notFound: true,
                },
                { status: 404 }
            );
        }

        if (result.expired) {
            return NextResponse.json(
                {
                    success: false,
                    valid: false,
                    error: 'Credencial expirada',
                    expired: true,
                },
                { status: 410 }
            );
        }

        // Return verification data
        return NextResponse.json({
            success: true,
            valid: result.valid,
            badge: result.badge,
            verifiedAt: result.verifiedAt.toISOString(),
        });
    } catch (error) {
        console.error('[Badge Verification] Error:', error);
        return NextResponse.json(
            {
                success: false,
                valid: false,
                error: 'Error verificando credencial',
            },
            { status: 500 }
        );
    }
}
