/**
 * Phase 4.4: Growth Engine - Unclaimed Profiles Admin API
 * ========================================================
 * 
 * Admin endpoints to view and manage unclaimed profiles from scraped data.
 * 
 * GET    - List unclaimed profiles with filters and pagination
 * DELETE - Soft delete a profile (set isActive = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

async function requireAdmin() {
    try {
        const session = await getSession();
        if (!session) {
            return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
        }
        // Only OWNER role can access admin features
        if (session.role !== 'OWNER') {
            return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
        }
        return { user: session };
    } catch {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List unclaimed profiles
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    try {
        const { searchParams } = new URL(request.url);

        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const skip = (page - 1) * limit;

        // Filters
        const source = searchParams.get('source');
        const province = searchParams.get('province');
        const status = searchParams.get('status'); // 'unclaimed', 'claimed', 'all'
        const search = searchParams.get('search');
        const hasPhone = searchParams.get('hasPhone');
        const hasEmail = searchParams.get('hasEmail');
        const outreachStatus = searchParams.get('outreachStatus');

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            isActive: true,
        };

        if (source && source !== 'all') {
            where.source = source;
        }

        if (province && province !== 'all') {
            where.province = province;
        }

        if (status === 'claimed') {
            where.claimedAt = { not: null };
        } else if (status === 'unclaimed') {
            where.claimedAt = null;
        }

        if (hasPhone === 'true') {
            where.phone = { not: null };
        }

        if (hasEmail === 'true') {
            where.email = { not: null };
        }

        if (outreachStatus && outreachStatus !== 'all') {
            where.outreachStatus = outreachStatus;
        }

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { matricula: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Execute queries
        const [profiles, total] = await Promise.all([
            prisma.unclaimedProfile.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    source: true,
                    fullName: true,
                    phone: true,
                    email: true,
                    matricula: true,
                    province: true,
                    city: true,
                    profession: true,
                    category: true,
                    outreachStatus: true,
                    whatsappStatus: true,
                    claimedAt: true,
                    createdAt: true,
                    dataQuality: true,
                },
            }),
            prisma.unclaimedProfile.count({ where }),
        ]);

        // Get stats
        const stats = await getProfileStats();

        return NextResponse.json({
            success: true,
            profiles,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            stats,
        });
    } catch (error) {
        console.error('[Admin Unclaimed Profiles] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Get Stats
// ═══════════════════════════════════════════════════════════════════════════════

async function getProfileStats() {
    const [
        total,
        claimed,
        withPhone,
        withEmail,
        bySource,
        byProvince,
        byOutreachStatus,
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
            take: 10,
        }),
        prisma.unclaimedProfile.groupBy({
            by: ['outreachStatus'],
            where: { isActive: true },
            _count: { id: true },
        }),
    ]);

    return {
        total,
        claimed,
        unclaimed: total - claimed,
        withPhone,
        withEmail,
        claimRate: total > 0 ? ((claimed / total) * 100).toFixed(2) : '0',
        bySource: bySource.reduce((acc: Record<string, number>, s: { source: string; _count: { id: number } }) => {
            acc[s.source] = s._count.id;
            return acc;
        }, {} as Record<string, number>),
        byProvince: byProvince.reduce((acc: Record<string, number>, p: { province: string | null; _count: { id: number } }) => {
            if (p.province) acc[p.province] = p._count.id;
            return acc;
        }, {} as Record<string, number>),
        byOutreachStatus: byOutreachStatus.reduce((acc: Record<string, number>, s: { outreachStatus: string; _count: { id: number } }) => {
            acc[s.outreachStatus] = s._count.id;
            return acc;
        }, {} as Record<string, number>),
    };
}
