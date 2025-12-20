/**
 * Employee Verification Submit API
 * =================================
 *
 * POST /api/verification/employee/submit
 *
 * Submits verification data for the current employee.
 * Supports text-based submissions (like CUIL) where document upload
 * is handled separately by the /api/verification/upload endpoint.
 *
 * Request body:
 * - requirementCode: The verification requirement code (required)
 * - value: The submitted value (for text-based verifications)
 * - expiresAt: Optional expiration date
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';
import { verificationManager } from '@/lib/services/verification-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface SubmitRequest {
  requirementCode: string;
  value?: string;
  expiresAt?: string;
}

interface SubmitResponse {
  success: boolean;
  submissionId?: string;
  status?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Submit Employee Verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<SubmitResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const userId = session.id;
    const organizationId = session.organizationId;

    // Parse request body
    const body: SubmitRequest = await request.json();
    const { requirementCode, value, expiresAt } = body;

    if (!requirementCode) {
      return NextResponse.json(
        { success: false, error: 'Código de requisito es requerido' },
        { status: 400 }
      );
    }

    console.log('[Employee Submit] Request:', {
      userId,
      organizationId,
      requirementCode,
      hasValue: !!value,
    });

    // Get the requirement
    const requirement = await prisma.verificationRequirement.findUnique({
      where: { code: requirementCode },
    });

    if (!requirement) {
      return NextResponse.json(
        { success: false, error: `Requisito no encontrado: ${requirementCode}` },
        { status: 404 }
      );
    }

    // Verify this is an employee requirement
    if (requirement.appliesTo !== 'employee' && requirement.appliesTo !== 'both') {
      return NextResponse.json(
        { success: false, error: 'Este requisito no aplica a empleados' },
        { status: 400 }
      );
    }

    // Check if value is required but not provided
    if (!requirement.requiresDocument && !value) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un valor para este requisito' },
        { status: 400 }
      );
    }

    // For document-based requirements, value is not required here
    // (handled by the upload endpoint)
    if (requirement.requiresDocument && !value) {
      return NextResponse.json(
        { success: false, error: 'Use el endpoint de upload para subir documentos' },
        { status: 400 }
      );
    }

    // Check for existing submission
    const existingSubmission = await prisma.verificationSubmission.findUnique({
      where: {
        organizationId_requirementId_userId: {
          organizationId,
          requirementId: requirement.id,
          userId,
        },
      },
    });

    // Determine initial status based on auto-verification
    let initialStatus: 'pending' | 'in_review' | 'approved' = 'pending';
    let autoVerifyResult = null;

    // For CUIL, check if it was auto-verified
    if (requirementCode === 'employee_cuil' && value) {
      try {
        // The CUIL should have been validated by validate-cuit endpoint already
        // Just mark it as in_review for manual confirmation
        initialStatus = 'in_review';
      } catch (error) {
        console.error('[Employee Submit] Auto-verify error:', error);
        // Continue with pending status if auto-verify fails
      }
    }

    // Create or update the submission
    const submission = await prisma.verificationSubmission.upsert({
      where: {
        organizationId_requirementId_userId: {
          organizationId,
          requirementId: requirement.id,
          userId,
        },
      },
      create: {
        organizationId,
        requirementId: requirement.id,
        userId,
        submittedValue: value,
        status: initialStatus,
        submittedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      update: {
        submittedValue: value,
        status: initialStatus,
        submittedAt: new Date(),
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        rejectionCode: null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        updatedAt: new Date(),
      },
    });

    // Update user verification status
    try {
      await verificationManager.updateUserVerificationStatus(userId);
    } catch (statusErr) {
      console.error('[Employee Submit] Status update error:', statusErr);
      // Don't fail the submission if status update fails
    }

    // Log audit entry
    await logAuditEntry({
      action: 'verification_submit',
      resource: 'verification_submission',
      resourceId: submission.id,
      organizationId,
      actorId: userId,
      details: {
        requirementCode,
        status: initialStatus,
        isUpdate: !!existingSubmission,
      },
    }).catch((err) => console.error('[Employee Submit] Audit log error:', err));

    console.log('[Employee Submit] Completed:', {
      submissionId: submission.id,
      status: initialStatus,
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      status: initialStatus,
    });
  } catch (error) {
    console.error('[Employee Submit] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al enviar verificación',
      },
      { status: 500 }
    );
  }
}
