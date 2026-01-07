/**
 * Claim Profile Request API
 * =========================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/claim-profile/request
 * 
 * Initiates the claim process by sending an OTP to the profile's registered phone/email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnclaimedProfileService } from '@/lib/services/unclaimed-profile.service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { profileId } = body;

        if (!profileId) {
            return NextResponse.json(
                { error: 'Se requiere el ID del perfil' },
                { status: 400 }
            );
        }

        const service = getUnclaimedProfileService();
        const result = await service.requestClaim(profileId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            verificationMethod: result.verificationMethod,
            maskedContact: result.maskedContact,
            expiresInMinutes: result.expiresInMinutes,
            message: result.verificationMethod === 'phone'
                ? `Se envió un código de verificación al teléfono ${result.maskedContact}`
                : `Se envió un código de verificación al email ${result.maskedContact}`,
        });
    } catch (error) {
        console.error('[ClaimProfile/Request] Error:', error);
        return NextResponse.json(
            { error: 'Error al solicitar la verificación' },
            { status: 500 }
        );
    }
}
