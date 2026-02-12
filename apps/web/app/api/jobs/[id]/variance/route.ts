import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Job Price Variance API
 * 
 * Handles ADMIN approval/rejection of technician-proposed price changes.
 * Used when a technician completes a job with a different price than originally estimated.
 */

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: jobId } = await context.params;
        const body = await request.json();
        const { action, adjustedAmount, reason: _reason } = body;

        // Validate action
        if (!action || !['approve', 'reject', 'adjust'].includes(action)) {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Must be: approve, reject, or adjust' },
                { status: 400 }
            );
        }

        // Fetch the job
        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                jobNumber: true,
                status: true,
                estimatedTotal: true,
                techProposedTotal: true,
                finalTotal: true,
                pricingLockedAt: true,
                varianceApprovedAt: true,
                varianceRejectedAt: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            );
        }

        // Check if pricing is already locked
        if (job.pricingLockedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'El precio ya está bloqueado porque se generó una factura. No se puede modificar.'
                },
                { status: 400 }
            );
        }

        // Phase 10 Security: Check terminal state before allowing variance operations
        const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
        if (TERMINAL_STATES.includes(job.status)) {
            console.warn('[SECURITY] Variance route terminal state violation:', {
                jobId: jobId,
                currentStatus: job.status,
                userId: session.userId,
                timestamp: new Date().toISOString(),
            });
            return NextResponse.json(
                {
                    success: false,
                    error: `No se puede modificar variación de un trabajo ${job.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
                    terminalStateBlocked: true,
                },
                { status: 403 }
            );
        }

        // Check if variance has already been resolved
        if (job.varianceApprovedAt || job.varianceRejectedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Esta variación de precio ya fue procesada.'
                },
                { status: 400 }
            );
        }

        // Check if there's actually a variance to approve
        if (!job.techProposedTotal) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'No hay precio propuesto por el técnico para aprobar.'
                },
                { status: 400 }
            );
        }

        let updateData: Record<string, unknown> = {};

        switch (action) {
            case 'approve':
                // Approve technician's proposed price
                updateData = {
                    finalTotal: job.techProposedTotal,
                    varianceApprovedAt: new Date(),
                    varianceApprovedById: session.userId,
                };
                break;

            case 'reject':
                // Reject proposed price, keep original estimated
                updateData = {
                    finalTotal: job.estimatedTotal,
                    techProposedTotal: null, // Clear the proposed price
                    varianceRejectedAt: new Date(),
                    varianceRejectedById: session.userId,
                };
                break;

            case 'adjust':
                // Manually adjust to a different amount
                if (adjustedAmount === undefined || adjustedAmount === null) {
                    return NextResponse.json(
                        { success: false, error: 'Adjusted amount is required for adjust action' },
                        { status: 400 }
                    );
                }
                updateData = {
                    finalTotal: adjustedAmount,
                    varianceApprovedAt: new Date(),
                    varianceApprovedById: session.userId,
                };
                break;
        }

        // Update the job
        const updatedJob = await prisma.job.update({
            where: { id: jobId },
            data: updateData,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                technician: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Calculate variance for response
        const estimatedTotal = Number(job.estimatedTotal || 0);
        const techProposedTotal = Number(job.techProposedTotal || 0);
        const variancePercent = estimatedTotal > 0
            ? ((techProposedTotal - estimatedTotal) / estimatedTotal) * 100
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                id: updatedJob.id,
                jobNumber: updatedJob.jobNumber,
                action,
                estimatedTotal,
                techProposedTotal,
                finalTotal: Number(updatedJob.finalTotal),
                variancePercent: Math.round(variancePercent * 10) / 10,
                resolvedAt: action === 'reject' ? updatedJob.varianceRejectedAt : updatedJob.varianceApprovedAt,
                resolvedById: session.userId,
            },
        });
    } catch (error) {
        console.error('Variance resolution error:', error);
        return NextResponse.json(
            { success: false, error: 'Error processing variance resolution' },
            { status: 500 }
        );
    }
}

/**
 * GET handler - Get variance details for a specific job
 */
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: jobId } = await context.params;

        const job = await prisma.job.findFirst({
            where: {
                id: jobId,
                organizationId: session.organizationId,
            },
            select: {
                id: true,
                jobNumber: true,
                estimatedTotal: true,
                techProposedTotal: true,
                finalTotal: true,
                pricingLockedAt: true,
                varianceApprovedAt: true,
                varianceApprovedById: true,
                varianceRejectedAt: true,
                varianceRejectedById: true,
            },
        });

        if (!job) {
            return NextResponse.json(
                { success: false, error: 'Job not found' },
                { status: 404 }
            );
        }

        const estimatedTotal = Number(job.estimatedTotal || 0);
        const techProposedTotal = Number(job.techProposedTotal || 0);
        const finalTotal = Number(job.finalTotal || 0);

        const hasVariance = techProposedTotal > 0 && estimatedTotal > 0 && techProposedTotal !== estimatedTotal;
        const variancePercent = estimatedTotal > 0
            ? ((techProposedTotal - estimatedTotal) / estimatedTotal) * 100
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                id: job.id,
                jobNumber: job.jobNumber,
                hasVariance,
                isPending: hasVariance && !job.varianceApprovedAt && !job.varianceRejectedAt && !job.pricingLockedAt,
                isResolved: !!job.varianceApprovedAt || !!job.varianceRejectedAt,
                isLocked: !!job.pricingLockedAt,
                estimatedTotal,
                techProposedTotal,
                finalTotal,
                variancePercent: Math.round(variancePercent * 10) / 10,
                varianceDirection: variancePercent > 0 ? 'increase' : variancePercent < 0 ? 'decrease' : 'none',
                resolution: job.varianceApprovedAt
                    ? 'approved'
                    : job.varianceRejectedAt
                        ? 'rejected'
                        : null,
                resolvedAt: job.varianceApprovedAt || job.varianceRejectedAt || null,
                resolvedById: job.varianceApprovedById || job.varianceRejectedById || null,
            },
        });
    } catch (error) {
        console.error('Get variance error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching variance details' },
            { status: 500 }
        );
    }
}
