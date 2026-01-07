/**
 * User Badge API
 * ===============
 * 
 * Phase 4.3 Task 4.3.4: Digital Badge Management
 * 
 * GET /api/users/[userId]/badge - Get user's badge data
 * POST /api/users/[userId]/badge/refresh - Refresh badge token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDigitalBadgeService } from '@/lib/services/digital-badge.service';
import { prisma } from '@/lib/prisma';

export async function GET(
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

        // Users can view their own badge, or owners/dispatchers can view team badges
        const isOwnBadge = session.userId === id;
        const canViewTeamBadges = ['OWNER', 'DISPATCHER'].includes(session.role.toUpperCase());

        if (!isOwnBadge && !canViewTeamBadges) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para ver esta credencial' },
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
        const badgeData = await badgeService.generateBadgeData(id);

        return NextResponse.json({
            success: true,
            data: badgeData,
        });
    } catch (error) {
        console.error('[Badge API] Error getting badge:', error);
        return NextResponse.json(
            { success: false, error: 'Error obteniendo credencial' },
            { status: 500 }
        );
    }
}
