/**
 * Admin Verification Detail & Actions API
 * =========================================
 *
 * GET /api/admin/verifications/:id - Get submission detail
 * POST /api/admin/verifications/:id - Perform actions (approve, reject, request-correction)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VerificationSubmissionDetail } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.verificationSubmission.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            cuit: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requirement: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            category: true,
            appliesTo: true,
            tier: true,
            requiresExpiration: true,
            autoVerifySource: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Get previous submissions for this requirement from same org/user
    const previousSubmissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId: submission.organizationId,
        userId: submission.userId,
        requirementId: submission.requirementId,
        id: { not: submission.id },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        submittedValue: true,
        documentUrl: true,
        rejectionReason: true,
        submittedAt: true,
        verifiedAt: true,
      },
    });

    // Check if this is first submission for this org
    const orgCreatedAt = submission.organization.createdAt;
    const isNewBusiness = (new Date().getTime() - orgCreatedAt.getTime()) < 7 * 24 * 60 * 60 * 1000;

    let priority: 'new_business' | 'renewal' | 'badge_request' | 'normal' = 'normal';
    if (isNewBusiness) {
      priority = 'new_business';
    } else if (submission.requirement.tier === 4) {
      priority = 'badge_request';
    } else if (previousSubmissions.some(p => p.status === 'approved')) {
      priority = 'renewal';
    }

    const detail: VerificationSubmissionDetail = {
      id: submission.id,
      organizationId: submission.organizationId,
      organizationName: submission.organization.name,
      userId: submission.userId,
      userName: submission.user?.name || null,
      requirementId: submission.requirementId,
      requirementCode: submission.requirement.code,
      requirementName: submission.requirement.name,
      category: submission.requirement.category as VerificationSubmissionDetail['category'],
      appliesTo: submission.requirement.appliesTo as VerificationSubmissionDetail['appliesTo'],
      tier: submission.requirement.tier,
      status: submission.status as VerificationSubmissionDetail['status'],
      submittedValue: submission.submittedValue,
      documentUrl: submission.documentUrl,
      documentType: submission.documentType,
      documentFilename: submission.documentFilename,
      submittedAt: submission.submittedAt.toISOString(),
      priority,
      isFirstSubmission: isNewBusiness,
      verifiedAt: submission.verifiedAt?.toISOString() || null,
      verifiedBy: submission.verifiedBy as VerificationSubmissionDetail['verifiedBy'],
      verifiedByUserId: submission.verifiedByUserId,
      rejectionReason: submission.rejectionReason,
      rejectionCode: submission.rejectionCode,
      expiresAt: submission.expiresAt?.toISOString() || null,
      autoVerifyResponse: submission.autoVerifyResponse as Record<string, unknown> | null,
      autoVerifyCheckedAt: submission.autoVerifyCheckedAt?.toISOString() || null,
      notes: submission.notes,
      adminNotes: submission.adminNotes,
      updatedAt: submission.updatedAt.toISOString(),
      previousSubmissions: previousSubmissions.map((p) => ({
        id: p.id,
        status: p.status as VerificationSubmissionDetail['status'],
        submittedValue: p.submittedValue,
        documentUrl: p.documentUrl,
        rejectionReason: p.rejectionReason,
        submittedAt: p.submittedAt.toISOString(),
        verifiedAt: p.verifiedAt?.toISOString() || null,
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        submission: detail,
        requirement: {
          ...submission.requirement,
        },
      },
    });
  } catch (error) {
    console.error('Admin verification detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching verification' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    const submission = await prisma.verificationSubmission.findUnique({
      where: { id },
      include: {
        requirement: true,
        organization: true,
        user: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'approve':
        return handleApprove(submission, data, session);

      case 'reject':
        return handleReject(submission, data, session);

      case 'request-correction':
        return handleRequestCorrection(submission, data, session);

      case 'start-review':
        return handleStartReview(submission, session);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin verification action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}

async function handleApprove(
  submission: any,
  data: { expiresAt?: string; adminNotes?: string },
  session: { id: string; name: string }
) {
  const { expiresAt, adminNotes } = data;

  // Validate expiration if required
  if (submission.requirement.requiresExpiration && !expiresAt) {
    return NextResponse.json(
      { success: false, error: 'Expiration date is required for this requirement' },
      { status: 400 }
    );
  }

  await prisma.verificationSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'approved',
      verifiedAt: new Date(),
      verifiedBy: 'admin',
      verifiedByUserId: session.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      adminNotes: adminNotes || submission.adminNotes,
    },
  });

  // TODO: Send notification to user about approval

  return NextResponse.json({
    success: true,
    message: 'Verificación aprobada',
  });
}

async function handleReject(
  submission: any,
  data: { rejectionCode: string; rejectionReason: string; adminNotes?: string },
  session: { id: string; name: string }
) {
  const { rejectionCode, rejectionReason, adminNotes } = data;

  if (!rejectionCode || !rejectionReason) {
    return NextResponse.json(
      { success: false, error: 'Rejection code and reason are required' },
      { status: 400 }
    );
  }

  await prisma.verificationSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'rejected',
      rejectionCode,
      rejectionReason,
      verifiedAt: new Date(),
      verifiedBy: 'admin',
      verifiedByUserId: session.id,
      adminNotes: adminNotes || submission.adminNotes,
    },
  });

  // TODO: Send notification to user about rejection

  return NextResponse.json({
    success: true,
    message: 'Verificación rechazada',
  });
}

async function handleRequestCorrection(
  submission: any,
  data: { correctionNote: string; adminNotes?: string },
  session: { id: string; name: string }
) {
  const { correctionNote, adminNotes } = data;

  if (!correctionNote) {
    return NextResponse.json(
      { success: false, error: 'Correction note is required' },
      { status: 400 }
    );
  }

  await prisma.verificationSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'pending', // Back to pending for resubmission
      rejectionCode: 'correction_requested',
      rejectionReason: correctionNote,
      adminNotes: adminNotes || submission.adminNotes,
    },
  });

  // TODO: Send notification to user about correction request

  return NextResponse.json({
    success: true,
    message: 'Solicitud de corrección enviada',
  });
}

async function handleStartReview(
  submission: any,
  session: { id: string; name: string }
) {
  if (submission.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: 'Submission is not in pending status' },
      { status: 400 }
    );
  }

  await prisma.verificationSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'in_review',
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Revisión iniciada',
  });
}
