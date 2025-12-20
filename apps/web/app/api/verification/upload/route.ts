/**
 * Verification Document Upload API
 * =================================
 *
 * POST /api/verification/upload
 *
 * Uploads verification documents to Supabase Storage and creates
 * verification_submission records.
 *
 * Accepts multipart/form-data with:
 * - file: The document file (required)
 * - requirementCode: The verification requirement code (required)
 * - userId: The user ID for employee documents (optional)
 *
 * File constraints:
 * - Max size: 10MB
 * - Allowed types: jpg, jpeg, png, webp, pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';
import {
  uploadDocument,
  validateFile,
  isStorageConfigured,
  getSignedUrl,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '@/lib/storage/verification-storage';
import { verificationManager } from '@/lib/services/verification-manager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UploadResponse {
  success: boolean;
  submissionId?: string;
  documentUrl?: string;
  path?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Upload Document
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Check if storage is configured
    if (!isStorageConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'El almacenamiento no está configurado. Contacte soporte.',
        },
        { status: 503 }
      );
    }

    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requirementCode = formData.get('requirementCode') as string | null;
    const targetUserId = formData.get('userId') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    if (!requirementCode) {
      return NextResponse.json(
        { success: false, error: 'Código de requisito es requerido' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

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

    // Check permissions
    const organizationId = session.organizationId;
    const userId = session.id;
    const role = session.role?.toUpperCase();

    // If targeting a different user, must be OWNER or ADMIN
    const effectiveUserId = targetUserId || userId;
    if (targetUserId && targetUserId !== userId) {
      if (role !== 'OWNER' && role !== 'ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: 'No tiene permiso para subir documentos de otro usuario',
          },
          { status: 403 }
        );
      }

      // Verify target user belongs to same organization
      const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, organizationId },
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Usuario no encontrado en la organización' },
          { status: 404 }
        );
      }
    }

    console.log('[Upload] Processing upload:', {
      requirementCode,
      filename: file.name,
      size: file.size,
      type: file.type,
      userId: effectiveUserId,
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const uploadResult = await uploadDocument(
      organizationId,
      requirementCode,
      buffer,
      file.name,
      file.type,
      effectiveUserId !== userId ? effectiveUserId : undefined
    );

    if (!uploadResult.success) {
      return NextResponse.json(
        { success: false, error: uploadResult.error || 'Error al subir archivo' },
        { status: 500 }
      );
    }

    // Check for existing submission and archive it
    const existingSubmission = await prisma.verificationSubmission.findUnique({
      where: {
        organizationId_requirementId_userId: {
          organizationId,
          requirementId: requirement.id,
          userId: effectiveUserId,
        },
      },
    });

    if (existingSubmission && existingSubmission.documentUrl) {
      // Archive the old document (async, don't wait)
      // In the current implementation, we keep old files for audit
      console.log('[Upload] Superseding existing submission:', existingSubmission.id);
    }

    // Create or update verification submission
    const submission = await prisma.verificationSubmission.upsert({
      where: {
        organizationId_requirementId_userId: {
          organizationId,
          requirementId: requirement.id,
          userId: effectiveUserId,
        },
      },
      create: {
        organizationId,
        requirementId: requirement.id,
        userId: effectiveUserId,
        documentUrl: uploadResult.path,
        documentType: file.type,
        documentFilename: file.name,
        status: requirement.requiresDocument ? 'in_review' : 'pending',
        submittedAt: new Date(),
      },
      update: {
        documentUrl: uploadResult.path,
        documentType: file.type,
        documentFilename: file.name,
        status: 'in_review', // Reset to in_review on new upload
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        rejectionCode: null,
        updatedAt: new Date(),
      },
    });

    // Generate signed URL for immediate viewing
    const signedUrl = await getSignedUrl(uploadResult.path!);

    // Update verification status after upload
    // This recalculates the org's overall status based on all submissions
    try {
      await verificationManager.updateOrgVerificationStatus(organizationId);

      // If this is an employee document, also update user status
      if (requirement.appliesTo === 'employee' && effectiveUserId) {
        await verificationManager.updateUserVerificationStatus(effectiveUserId);
      }
    } catch (statusErr) {
      console.error('[Upload] Status update error:', statusErr);
      // Don't fail the upload if status update fails
    }

    // Log audit entry
    await logAuditEntry({
      action: 'document_upload',
      resource: 'verification_submission',
      resourceId: submission.id,
      organizationId,
      actorId: userId,
      details: {
        requirementCode,
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        path: uploadResult.path,
        targetUserId: effectiveUserId !== userId ? effectiveUserId : undefined,
      },
    }).catch((err) => console.error('[Upload] Audit log error:', err));

    console.log('[Upload] Completed:', {
      submissionId: submission.id,
      path: uploadResult.path,
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      documentUrl: signedUrl || undefined,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al procesar la carga',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Upload configuration info
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    config: {
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    },
  });
}
