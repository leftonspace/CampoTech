/**
 * Admin Verification Queue API
 * ============================
 *
 * GET /api/admin/verification-queue
 *
 * Returns pending verification submissions (Tier 4 badges) for admin review.
 * Only accessible by SUPER_ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBuenosAiresNow } from '@/lib/timezone';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SubmissionResponse {
    id: string;
    organizationId: string;
    organizationName: string;
    userId: string | null;
    userName: string | null;
    requirementCode: string;
    requirementName: string;
    specialty: string | null;
    submittedValue: string | null;
    documentUrl: string | null;
    status: string;
    submittedAt: string;
    expiresAt: string | null;
}

interface QueueStats {
    pending: number;
    inReview: number;
    approvedToday: number;
    rejectedToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Fetch Verification Queue
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only SUPER_ADMIN can access this
        if (session.role?.toUpperCase() !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { success: false, error: 'Access denied - SUPER_ADMIN required' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'pending';

        // Build status filter
        const statusFilter: string[] = [];
        if (filter === 'pending') {
            statusFilter.push('pending');
        } else if (filter === 'in_review') {
            statusFilter.push('in_review');
        } else if (filter === 'all') {
            statusFilter.push('pending', 'in_review');
        } else {
            statusFilter.push('pending');
        }

        // Fetch Tier 4 submissions that need review
        const submissions = await prisma.verificationSubmission.findMany({
            where: {
                status: { in: statusFilter },
                requirement: {
                    tier: 4, // Only Tier 4 (optional badges like matriculas)
                    isActive: true,
                },
            },
            include: {
                requirement: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                submittedAt: 'asc', // Oldest first
            },
            take: 100,
        });

        // Get today's stats
        const todayStart = getBuenosAiresNow();
        todayStart.setHours(0, 0, 0, 0);

        const [pendingCount, inReviewCount, approvedToday, rejectedToday] = await Promise.all([
            prisma.verificationSubmission.count({
                where: {
                    status: 'pending',
                    requirement: { tier: 4, isActive: true },
                },
            }),
            prisma.verificationSubmission.count({
                where: {
                    status: 'in_review',
                    requirement: { tier: 4, isActive: true },
                },
            }),
            prisma.verificationSubmission.count({
                where: {
                    status: 'approved',
                    requirement: { tier: 4, isActive: true },
                    verifiedAt: { gte: todayStart },
                },
            }),
            prisma.verificationSubmission.count({
                where: {
                    status: 'rejected',
                    requirement: { tier: 4, isActive: true },
                    reviewedAt: { gte: todayStart },
                },
            }),
        ]);

        // Map specialty from requirement code
        const getSpecialtyFromCode = (code: string): string | null => {
            const map: Record<string, string> = {
                gas_matricula: 'GASISTA',
                electrician_matricula: 'ELECTRICISTA',
                plumber_matricula: 'PLOMERO',
                refrigeration_license: 'REFRIGERACION',
            };
            return map[code] || null;
        };

        // Format response
        const formattedSubmissions: SubmissionResponse[] = submissions.map((sub: typeof submissions[0]) => ({
            id: sub.id,
            organizationId: sub.organizationId,
            organizationName: sub.organization?.name || 'Organización desconocida',
            userId: sub.userId,
            userName: sub.user?.name || null,
            requirementCode: sub.requirement.code,
            requirementName: sub.requirement.name,
            specialty: getSpecialtyFromCode(sub.requirement.code),
            submittedValue: sub.submittedValue,
            documentUrl: sub.documentUrl,
            status: sub.status,
            submittedAt: sub.submittedAt?.toISOString() || new Date().toISOString(),
            expiresAt: sub.expiresAt?.toISOString() || null,
        }));

        const stats: QueueStats = {
            pending: pendingCount,
            inReview: inReviewCount,
            approvedToday,
            rejectedToday,
        };

        console.log('[Admin Verification Queue] Fetched:', {
            filter,
            count: formattedSubmissions.length,
            stats,
        });

        return NextResponse.json({
            success: true,
            submissions: formattedSubmissions,
            stats,
        });
    } catch (error) {
        console.error('[Admin Verification Queue] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error fetching queue',
            },
            { status: 500 }
        );
    }
}
