/**
 * Phase 4.4: Growth Engine - Unclaimed Profiles Stats API
 * ========================================================
 * 
 * Returns statistics for the admin dashboard.
 * 
 * GET - Get detailed stats for unclaimed profiles
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get stats for dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all stats in parallel
        const [
            total,
            claimed,
            withPhone,
            withEmail,
            bySource,
            byProvince,
            byOutreachStatus,
            byWhatsAppStatus,
            recentClaims,
        ] = await Promise.all([
            prisma.unclaimedProfile.count({ where: { isActive: true } }),
            prisma.unclaimedProfile.count({ where: { isActive: true, claimedAt: { not: null } } }),
            prisma.unclaimedProfile.count({ where: { isActive: true, phone: { not: null } } }),
            prisma.unclaimedProfile.count({ where: { isActive: true, email: { not: null } } }),
            prisma.unclaimedProfile.groupBy({
                by: ['source'],
                where: { isActive: true },
                _count: { id: true },
            }),
            prisma.unclaimedProfile.groupBy({
                by: ['province'],
                where: { isActive: true, province: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 15,
            }),
            prisma.unclaimedProfile.groupBy({
                by: ['outreachStatus'],
                where: { isActive: true },
                _count: { id: true },
            }),
            prisma.unclaimedProfile.groupBy({
                by: ['whatsappStatus'],
                where: { isActive: true },
                _count: { id: true },
            }),
            prisma.unclaimedProfile.findMany({
                where: { claimedAt: { not: null } },
                orderBy: { claimedAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    fullName: true,
                    source: true,
                    province: true,
                    claimedAt: true,
                },
            }),
        ]);

        // Format stats
        const stats = {
            overview: {
                total,
                claimed,
                unclaimed: total - claimed,
                withPhone,
                withEmail,
                withBoth: await prisma.unclaimedProfile.count({
                    where: { isActive: true, phone: { not: null }, email: { not: null } },
                }),
                claimRate: total > 0 ? ((claimed / total) * 100).toFixed(2) : '0',
            },
            bySource: bySource.map((s: { source: string; _count: { id: number } }) => ({
                source: s.source,
                count: s._count.id,
            })).sort((a: { source: string; count: number }, b: { source: string; count: number }) => b.count - a.count),
            byProvince: byProvince.map((p: { province: string | null; _count: { id: number } }) => ({
                province: p.province,
                count: p._count.id,
            })),
            byOutreachStatus: byOutreachStatus.map((s: { outreachStatus: string; _count: { id: number } }) => ({
                status: s.outreachStatus,
                count: s._count.id,
            })),
            byWhatsAppStatus: byWhatsAppStatus.map((s: { whatsappStatus: string; _count: { id: number } }) => ({
                status: s.whatsappStatus,
                count: s._count.id,
            })),
            recentClaims,
        };

        return NextResponse.json({
            success: true,
            stats,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Admin Unclaimed Profiles Stats] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
