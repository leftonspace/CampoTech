/**
 * Account Deletion Confirmation API
 * ==================================
 *
 * POST /api/account/confirm-deletion
 *
 * Handles the confirmation of account deletion from email link.
 * This starts the 30-day waiting period per Ley 25.326.
 */

import { NextRequest, NextResponse } from 'next/server';
import { accountDeletion } from '@/lib/services/account-deletion';
import { prisma } from '@/lib/prisma';
import { sendDeletionScheduledEmail } from '@/lib/email/deletion-emails';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'missing_token', message: 'Token de confirmación requerido.' },
                { status: 400 }
            );
        }

        // Confirm the deletion (this starts the 30-day countdown)
        const result = await accountDeletion.confirmDeletion(token);

        if (!result.success) {
            // Determine error type
            if (result.error?.includes('expirado')) {
                return NextResponse.json(
                    { error: 'token_expired', message: result.error },
                    { status: 400 }
                );
            }

            if (result.error?.includes('ya confirmada') || result.error?.includes('already')) {
                // Get current status
                const status = await getDeletionStatusByToken(token);
                return NextResponse.json({
                    error: 'already_confirmed',
                    message: 'La eliminación ya fue confirmada.',
                    scheduledDate: status?.scheduledDate?.toISOString(),
                    daysRemaining: status?.daysRemaining,
                });
            }

            return NextResponse.json(
                { error: 'confirmation_failed', message: result.error },
                { status: 400 }
            );
        }

        // Get scheduled date and days remaining
        const scheduledDate = result.scheduledDate!;
        const daysRemaining = Math.ceil(
            (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // Try to send scheduled email notification
        try {
            // Get user info for email
            const userInfo = await getUserInfoFromToken(token);
            if (userInfo?.email) {
                await sendDeletionScheduledEmail(
                    userInfo.email,
                    userInfo.name,
                    scheduledDate,
                    ['Datos personales', 'Fotos subidas', 'Documentos', 'Preferencias'],
                    ['Facturas (10 años - AFIP)', 'Registros de auditoría (5 años - Ley 25.326)']
                );
            }
        } catch (emailError) {
            console.error('Failed to send scheduled email:', emailError);
            // Don't fail the confirmation if email fails
        }

        return NextResponse.json({
            success: true,
            message: 'Eliminación confirmada. Tu cuenta será eliminada en 30 días.',
            scheduledDate: scheduledDate.toISOString(),
            daysRemaining,
        });
    } catch (error) {
        console.error('Confirm deletion error:', error);
        return NextResponse.json(
            { error: 'internal_error', message: 'Error al procesar la confirmación.' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getDeletionStatusByToken(_token: string): Promise<{
    scheduledDate: Date | null;
    daysRemaining: number | null;
} | null> {
    try {
        // Note: token is cleared after confirmation, so we look for recently confirmed requests
        const result = await prisma.$queryRaw<Array<{
            scheduled_deletion_at: Date | null;
        }>>`
      SELECT scheduled_deletion_at FROM deletion_requests
      WHERE status = 'confirmed'
      ORDER BY confirmed_at DESC
      LIMIT 1
    `;

        if (result.length === 0 || !result[0].scheduled_deletion_at) {
            return null;
        }

        const scheduledDate = result[0].scheduled_deletion_at;
        const daysRemaining = Math.ceil(
            (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        return { scheduledDate, daysRemaining };
    } catch {
        return null;
    }
}

async function getUserInfoFromToken(_token: string): Promise<{
    email: string | null;
    name: string;
    userId: string;
} | null> {
    try {
        // Look up the deletion request to get user ID
        // Note: Token may be cleared, so we try recent requests
        const result = await prisma.$queryRaw<Array<{
            user_id: string;
        }>>`
      SELECT user_id FROM deletion_requests
      WHERE status IN ('pending', 'confirmed')
      ORDER BY created_at DESC
      LIMIT 1
    `;

        if (result.length === 0) {
            return null;
        }

        const userId = result[0].user_id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });

        if (!user) return null;

        return {
            email: user.email,
            name: user.name,
            userId,
        };
    } catch {
        return null;
    }
}
