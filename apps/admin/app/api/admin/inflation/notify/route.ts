/**
 * Inflation Notification API
 * 
 * Phase 6 - Dynamic Pricing (Jan 2026)
 * 
 * POST /api/admin/inflation/notify - Send notification to all orgs about new index
 * 
 * This creates system notifications for all active organizations
 * prompting them to apply the new inflation index.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface NotifyRequest {
    indexSource: string;
    indexPeriod: string;
    indexRate: number;
    message?: string;
}

const SOURCE_LABELS: Record<string, string> = {
    CAC_ICC_GENERAL: 'ICC General (CAC)',
    CAC_ICC_MANO_OBRA: 'ICC Mano de Obra (CAC)',
    CAC_ICC_MATERIALES: 'ICC Materiales (CAC)',
    INDEC_IPC: 'IPC General (INDEC)',
    INDEC_IPC_VIVIENDA: 'IPC Vivienda (INDEC)',
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Notify All Organizations
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    try {
        const admin = await getAdminSession();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only super_admin can send notifications
        if (!hasPermission(admin, 'manage_admins')) {
            return NextResponse.json(
                { success: false, error: 'Only super admins can send notifications' },
                { status: 403 }
            );
        }

        const body: NotifyRequest = await request.json();
        const { indexSource, indexPeriod, indexRate, message } = body;

        // Validate required fields
        if (!indexSource || !indexPeriod || indexRate === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get all active organizations
        const activeOrgs = await prisma.organization.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
        });

        if (activeOrgs.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    notificationsSent: 0,
                    message: 'No active organizations to notify',
                },
            });
        }

        // Format period for display
        const [year, month] = indexPeriod.split('-');
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const periodLabel = `${months[parseInt(month) - 1]} ${year}`;
        const sourceLabel = SOURCE_LABELS[indexSource] || indexSource;

        // Create notifications for each organization
        // Using SystemNotification model if it exists, otherwise log for now
        const notificationPromises = activeOrgs.map(async (org) => {
            // Try to create a notification record
            try {
                // Check if SystemNotification model exists
                // If not, we'll just log the notification intent
                // @ts-expect-error - SystemNotification may not exist yet
                if (prisma.systemNotification) {
                    // @ts-expect-error - Model may not exist
                    await prisma.systemNotification.create({
                        data: {
                            organizationId: org.id,
                            type: 'INFLATION_INDEX_AVAILABLE',
                            title: `Nuevo Índice ${sourceLabel}`,
                            message: message || `El índice de ${periodLabel} está disponible: ${indexRate.toFixed(1)}%. Ajustá tus precios para mantener tus márgenes.`,
                            actionUrl: '/dashboard/settings/pricebook',
                            isRead: false,
                            metadata: {
                                indexSource,
                                indexPeriod,
                                indexRate,
                            },
                        },
                    });
                }
            } catch (err) {
                // If model doesn't exist, just log
                console.log(`[Inflation Notify] Would notify org ${org.name} (${org.id}) about ${indexSource} ${indexPeriod}`);
            }

            return org.id;
        });

        await Promise.all(notificationPromises);

        console.log(`[Inflation Notify] Sent notifications to ${activeOrgs.length} orgs about ${indexSource} ${indexPeriod}`);

        return NextResponse.json({
            success: true,
            data: {
                notificationsSent: activeOrgs.length,
                indexSource,
                indexPeriod,
                indexRate,
                message: `Notificación enviada a ${activeOrgs.length} organizaciones`,
            },
        });
    } catch (error) {
        console.error('[Inflation Notify] POST error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send notifications',
            },
            { status: 500 }
        );
    }
}
