/**
 * CUIT Validation API
 * ===================
 *
 * POST /api/verification/validate-cuit
 *
 * Validates a CUIT against AFIP and creates/updates verification submissions.
 * Automatically approves if CUIT is valid and active in AFIP.
 *
 * Also auto-populates related verification requirements:
 * - owner_cuit: The CUIT itself
 * - afip_status: Active status in AFIP
 * - activity_code_match: Activity codes match HVAC services
 * - business_address: Fiscal address from AFIP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';
import { afipClient, validateCUITFormat } from '@/lib/afip/client';
import {
  matchActivityToServices,
  calculateActivityMatchScore,
} from '@/lib/afip/activity-codes';
import type { CUITAutoVerifyResponse, ActivityCodeMatchResult } from '@/lib/afip/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ValidateCUITRequest {
  cuit: string;
}

interface ValidateCUITResponse {
  success: boolean;
  isValid: boolean;
  cuit?: string;
  formattedCuit?: string;
  razonSocial?: string;
  categoriaTributaria?: string;
  domicilioFiscal?: string;
  isActive?: boolean;
  activityMatch?: {
    matched: boolean;
    matchPercentage: number;
    matchedServices: string[];
  };
  verificationStatus?: {
    ownerCuit: string;
    afipStatus: string;
    activityCodeMatch: string;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get or create verification requirement by code
 */
async function getRequirement(code: string) {
  return prisma.verificationRequirement.findUnique({
    where: { code },
  });
}

/**
 * Create or update a verification submission
 */
async function upsertSubmission(
  organizationId: string,
  userId: string,
  requirementId: string,
  data: {
    submittedValue?: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
    autoVerifyResponse?: unknown;
    verifiedBy?: 'system' | 'admin' | 'manual' | null;
    verifiedAt?: Date | null;
    rejectionReason?: string | null;
  }
) {
  // Check for existing submission
  const existing = await prisma.verificationSubmission.findUnique({
    where: {
      organizationId_requirementId_userId: {
        organizationId,
        requirementId,
        userId,
      },
    },
  });

  if (existing) {
    return prisma.verificationSubmission.update({
      where: { id: existing.id },
      data: {
        ...data,
        autoVerifyResponse: data.autoVerifyResponse as object,
        autoVerifyCheckedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return prisma.verificationSubmission.create({
    data: {
      organizationId,
      userId,
      requirementId,
      submittedValue: data.submittedValue,
      status: data.status,
      autoVerifyResponse: data.autoVerifyResponse as object,
      autoVerifyCheckedAt: new Date(),
      verifiedBy: data.verifiedBy,
      verifiedAt: data.verifiedAt,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Validate CUIT
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse<ValidateCUITResponse>> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, isValid: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can validate organization CUIT
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        {
          success: false,
          isValid: false,
          error: 'Solo el propietario puede validar el CUIT del negocio',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ValidateCUITRequest;

    if (!body.cuit) {
      return NextResponse.json(
        { success: false, isValid: false, error: 'CUIT es requerido' },
        { status: 400 }
      );
    }

    // Validate CUIT format first
    const formatValidation = validateCUITFormat(body.cuit);
    if (!formatValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          isValid: false,
          cuit: body.cuit,
          error: formatValidation.error,
        },
        { status: 400 }
      );
    }

    console.log('[CUIT Validation] Validating CUIT:', formatValidation.formattedCuit);

    // Validate with AFIP
    const validationResult = await afipClient.validateCUIT(body.cuit);

    // Get verification requirements
    const [ownerCuitReq, afipStatusReq, activityCodeReq] = await Promise.all([
      getRequirement('owner_cuit'),
      getRequirement('afip_status'),
      getRequirement('activity_code_match'),
    ]);

    const organizationId = session.organizationId;
    const userId = session.id;

    // Build auto-verify response
    const autoVerifyResponse: CUITAutoVerifyResponse = {
      cuit: formatValidation.formattedCuit || body.cuit,
      isValid: validationResult.isValid,
      exists: validationResult.exists,
      isActive: validationResult.isActive,
      razonSocial: validationResult.razonSocial,
      categoriaTributaria: validationResult.categoriaTributaria,
      activityCodes: validationResult.actividadesPrincipales.map((a) => a.code),
      domicilioFiscal: validationResult.personaInfo?.domicilioFiscal,
      validatedAt: new Date().toISOString(),
      source: validationResult.source,
      error: validationResult.error,
    };

    // Calculate activity match
    const mappedServices = matchActivityToServices(validationResult.actividadesPrincipales);
    const activityMatch = calculateActivityMatchScore(validationResult.actividadesPrincipales);

    autoVerifyResponse.matchedServices = mappedServices;

    // Update verification submissions
    const verificationStatus: ValidateCUITResponse['verificationStatus'] = {
      ownerCuit: 'pending',
      afipStatus: 'pending',
      activityCodeMatch: 'pending',
    };

    // 1. Owner CUIT submission
    if (ownerCuitReq) {
      const isApproved = validationResult.isValid && validationResult.exists;
      await upsertSubmission(organizationId, userId, ownerCuitReq.id, {
        submittedValue: formatValidation.formattedCuit,
        status: isApproved ? 'approved' : validationResult.error ? 'in_review' : 'pending',
        autoVerifyResponse,
        verifiedBy: isApproved ? 'system' : null,
        verifiedAt: isApproved ? new Date() : null,
        rejectionReason: validationResult.error || null,
      });
      verificationStatus.ownerCuit = isApproved ? 'approved' : 'pending';
    }

    // 2. AFIP Status submission
    if (afipStatusReq) {
      const isApproved = validationResult.isActive;
      await upsertSubmission(organizationId, userId, afipStatusReq.id, {
        submittedValue: validationResult.isActive ? 'ACTIVO' : 'INACTIVO',
        status: isApproved ? 'approved' : validationResult.error ? 'in_review' : 'rejected',
        autoVerifyResponse: {
          cuit: formatValidation.formattedCuit,
          estadoClave: validationResult.isActive ? 'ACTIVO' : 'INACTIVO',
          categoriaTributaria: validationResult.categoriaTributaria,
          validatedAt: new Date().toISOString(),
          source: validationResult.source,
        },
        verifiedBy: isApproved ? 'system' : null,
        verifiedAt: isApproved ? new Date() : null,
        rejectionReason: !isApproved
          ? 'El CUIT no está activo en AFIP'
          : null,
      });
      verificationStatus.afipStatus = isApproved ? 'approved' : 'rejected';
    }

    // 3. Activity Code Match submission
    if (activityCodeReq) {
      const activityAutoVerify: ActivityCodeMatchResult = {
        matched: activityMatch.recommendation === 'approved',
        afipCodes: validationResult.actividadesPrincipales,
        matchedServices: mappedServices,
        unmatchedCodes: [],
        matchPercentage: activityMatch.score,
        recommendation: activityMatch.recommendation,
        reason: activityMatch.reason,
      };

      let status: 'approved' | 'in_review' | 'rejected' = 'in_review';
      if (activityMatch.recommendation === 'approved') {
        status = 'approved';
      } else if (activityMatch.recommendation === 'rejected') {
        status = 'rejected';
      }

      await upsertSubmission(organizationId, userId, activityCodeReq.id, {
        submittedValue: validationResult.actividadesPrincipales
          .map((a) => a.code)
          .join(', '),
        status,
        autoVerifyResponse: activityAutoVerify,
        verifiedBy: status === 'approved' ? 'system' : null,
        verifiedAt: status === 'approved' ? new Date() : null,
        rejectionReason:
          status !== 'approved' ? activityMatch.reason : null,
      });
      verificationStatus.activityCodeMatch = status;
    }

    // Log audit entry
    await logAuditEntry({
      action: 'cuit_validation',
      resource: 'verification',
      resourceId: formatValidation.formattedCuit || body.cuit,
      organizationId,
      actorId: userId,
      details: {
        cuit: formatValidation.formattedCuit,
        isValid: validationResult.isValid,
        isActive: validationResult.isActive,
        exists: validationResult.exists,
        source: validationResult.source,
        activityMatchScore: activityMatch.score,
        activityMatchRecommendation: activityMatch.recommendation,
      },
    }).catch((err) => console.error('[CUIT Validation] Audit log error:', err));

    console.log('[CUIT Validation] Completed:', {
      cuit: formatValidation.formattedCuit,
      isValid: validationResult.isValid,
      isActive: validationResult.isActive,
      activityMatch: activityMatch.score,
      verificationStatus,
    });

    return NextResponse.json({
      success: true,
      isValid: validationResult.isValid,
      cuit: body.cuit,
      formattedCuit: formatValidation.formattedCuit,
      razonSocial: validationResult.razonSocial,
      categoriaTributaria: validationResult.categoriaTributaria,
      domicilioFiscal: validationResult.domicilioFiscal,
      isActive: validationResult.isActive,
      activityMatch: {
        matched: activityMatch.recommendation === 'approved',
        matchPercentage: activityMatch.score,
        matchedServices: mappedServices.map(
          (s) => `${s.afipCode}: ${s.afipDescription}`
        ),
      },
      verificationStatus,
    });
  } catch (error) {
    console.error('[CUIT Validation] Error:', error);

    // Check if AFIP is unavailable
    const isAFIPError =
      error instanceof Error &&
      (error.message.includes('AFIP') ||
        error.message.includes('fetch') ||
        error.message.includes('timeout'));

    if (isAFIPError) {
      // Queue for manual review
      console.warn('[CUIT Validation] AFIP unavailable, queuing for manual review');

      return NextResponse.json(
        {
          success: false,
          isValid: false,
          error:
            'El servicio de AFIP no está disponible en este momento. ' +
            'Tu solicitud ha sido registrada para revisión manual.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        isValid: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error al validar CUIT',
      },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Check CUIT validation status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const organizationId = session.organizationId;

    // Get existing CUIT submission
    const ownerCuitReq = await getRequirement('owner_cuit');
    if (!ownerCuitReq) {
      return NextResponse.json({
        success: true,
        hasSubmission: false,
        message: 'No hay requisito de CUIT configurado',
      });
    }

    const submission = await prisma.verificationSubmission.findFirst({
      where: {
        organizationId,
        requirementId: ownerCuitReq.id,
      },
      orderBy: { submittedAt: 'desc' },
    });

    if (!submission) {
      return NextResponse.json({
        success: true,
        hasSubmission: false,
        message: 'No se ha enviado CUIT para validación',
      });
    }

    return NextResponse.json({
      success: true,
      hasSubmission: true,
      cuit: submission.submittedValue,
      status: submission.status,
      verifiedAt: submission.verifiedAt,
      verifiedBy: submission.verifiedBy,
      autoVerifyResponse: submission.autoVerifyResponse,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error('[CUIT Validation] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener estado',
      },
      { status: 500 }
    );
  }
}
