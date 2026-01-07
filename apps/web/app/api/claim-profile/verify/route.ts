/**
 * Claim Profile Verify API
 * ========================
 * 
 * Phase 4.4: Growth Engine
 * POST /api/claim-profile/verify
 * 
 * Verifies the OTP and completes the profile claim process.
 * Links the unclaimed profile to the user's account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnclaimedProfileService } from '@/lib/services/unclaimed-profile.service';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {

            return NextResponse.json(
                { error: 'Debes iniciar sesión para reclamar un perfil' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { profileId, otp } = body;

        if (!profileId) {
            return NextResponse.json(
                { error: 'Se requiere el ID del perfil' },
                { status: 400 }
            );
        }

        if (!otp || otp.length !== 6) {
            return NextResponse.json(
                { error: 'El código de verificación debe tener 6 dígitos' },
                { status: 400 }
            );
        }

        const service = getUnclaimedProfileService();

        // session is TokenPayload with id, userId, organizationId, etc.
        const result = await service.verifyClaim(
            profileId,
            otp,
            session.userId,
            session.organizationId
        );


        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: '¡Perfil reclamado exitosamente! Tu información profesional ya está activa.',
            organizationId: result.organizationId,
        });
    } catch (error) {
        console.error('[ClaimProfile/Verify] Error:', error);
        return NextResponse.json(
            { error: 'Error al verificar el código' },
            { status: 500 }
        );
    }
}
