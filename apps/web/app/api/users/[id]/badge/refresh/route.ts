/**
 * Badge Token Refresh API
 * =======================
 * 
 * Phase 4.3 Task 4.3.4: Digital Badge Management
 * 
 * POST /api/users/[userId]/badge/refresh - Refresh badge token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDigitalBadgeService } from '@/lib/services/digital-badge.service';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Users can refresh their own badge, or owners can refresh team badges
        const isOwnBadge = session.userId === id;
        const canManageTeamBadges = session.role.toUpperCase() === 'OWNER';

        if (!isOwnBadge && !canManageTeamBadges) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para renovar esta credencial' },
                { status: 403 }
            );
        }

        // Verify user belongs to same organization
        if (!isOwnBadge) {
            const user = await prisma.user.findUnique({
                where: { id },
                select: { organizationId: true },
            });

            if (!user || user.organizationId !== session.organizationId) {
                return NextResponse.json(
                    { success: false, error: 'Usuario no encontrado' },
                    { status: 404 }
                );
            }
        }

        const badgeService = getDigitalBadgeService();
        const result = await badgeService.refreshBadgeToken(id);

        // Get updated badge data
        const badgeData = await badgeService.generateBadgeData(id);

        return NextResponse.json({
            success: true,
            data: {
                ...badgeData,
                refreshed: true,
            },
            message: 'Credencial renovada correctamente',
        });
    } catch (error) {
        console.error('[Badge API] Error refreshing badge:', error);
        return NextResponse.json(
            { success: false, error: 'Error renovando credencial' },
            { status: 500 }
        );
    }
}
