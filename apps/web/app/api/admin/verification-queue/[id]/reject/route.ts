/**
 * Admin Verification Reject API
 * =============================
 *
 * POST /api/admin/verification-queue/[id]/reject
 *
 * Rejects a verification submission with a reason.
 * Only accessible by SUPER_ADMIN role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const body = await request.json();
        const { reason } = body;

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Rejection reason is required' },
                { status: 400 }
            );
        }

        // Find the submission
        const submission = await prisma.verificationSubmission.findUnique({
            where: { id },
            include: { requirement: true },
        });

        if (!submission) {
            return NextResponse.json(
                { success: false, error: 'Submission not found' },
                { status: 404 }
            );
        }

        if (submission.status === 'rejected') {
            return NextResponse.json(
                { success: false, error: 'Already rejected' },
                { status: 400 }
            );
        }

        // Update submission to rejected
        await prisma.verificationSubmission.update({
            where: { id },
            data: {
                status: 'rejected',
                reviewedById: session.id,
                reviewedAt: new Date(),
                rejectionReason: reason.trim(),
                verificationData: {
                    ...(submission.verificationData as Record<string, unknown> || {}),
                    rejectedBy: 'CampoTech Admin',
                    rejectedAt: new Date().toISOString(),
                    rejectionReason: reason.trim(),
                },
            },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                organizationId: submission.organizationId,
                userId: session.id,
                action: 'verification_rejected',
                entityType: 'verification_submission',
                entityId: id,
                metadata: {
                    requirementCode: submission.requirement.code,
                    submittedValue: submission.submittedValue,
                    rejectedBy: session.id,
                    reason: reason.trim(),
                },
            },
        });

        console.log('[Admin Verification] Rejected:', {
            submissionId: id,
            requirementCode: submission.requirement.code,
            organizationId: submission.organizationId,
            rejectedBy: session.id,
            reason: reason.trim(),
        });

        return NextResponse.json({
            success: true,
            message: 'Verificación rechazada',
        });
    } catch (error) {
        console.error('[Admin Verification Reject] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error rejecting submission',
            },
            { status: 500 }
        );
    }
}
