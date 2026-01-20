/**
 * Admin Verification Approve API
 * ==============================
 *
 * POST /api/admin/verification-queue/[id]/approve
 *
 * Approves a verification submission and grants the badge.
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

        if (submission.status === 'approved') {
            return NextResponse.json(
                { success: false, error: 'Already approved' },
                { status: 400 }
            );
        }

        // Calculate expiry date if requirement has renewal period
        const expiresAt = submission.requirement.renewalPeriodDays
            ? new Date(Date.now() + submission.requirement.renewalPeriodDays * 24 * 60 * 60 * 1000)
            : null;

        // Update submission to approved
        await prisma.verificationSubmission.update({
            where: { id },
            data: {
                status: 'approved',
                verifiedAt: new Date(),
                reviewedById: session.id,
                reviewedAt: new Date(),
                expiresAt,
                verificationData: {
                    ...(submission.verificationData as Record<string, unknown> || {}),
                    approvedBy: 'CampoTech Admin',
                    approvedAt: new Date().toISOString(),
                    verificationMethod: 'manual_review',
                },
            },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                organizationId: submission.organizationId,
                userId: session.id,
                action: 'verification_approved',
                entityType: 'verification_submission',
                entityId: id,
                metadata: {
                    requirementCode: submission.requirement.code,
                    submittedValue: submission.submittedValue,
                    approvedBy: session.id,
                },
            },
        });

        console.log('[Admin Verification] Approved:', {
            submissionId: id,
            requirementCode: submission.requirement.code,
            organizationId: submission.organizationId,
            approvedBy: session.id,
        });

        return NextResponse.json({
            success: true,
            message: 'Verificación aprobada exitosamente',
        });
    } catch (error) {
        console.error('[Admin Verification Approve] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error approving submission',
            },
            { status: 500 }
        );
    }
}
